/**
 * Persistent cross-session cooldown tracker for rate-limited models.
 *
 * Anthropic (and some other providers) returns specific reset-time headers
 * on rate-limit responses, e.g.:
 *   anthropic-ratelimit-requests-reset:       2026-05-05T15:00:00Z
 *   anthropic-ratelimit-tokens-reset:         2026-05-05T15:00:00Z
 *   anthropic-ratelimit-input-tokens-reset:   2026-05-05T15:00:00Z
 *
 * Without parsing these, omo-slim's ForegroundFallbackManager wastes the
 * first attempt of every new session re-trying a model whose 5-hour rolling
 * quota is still exhausted. This module:
 *
 *   1. Parses the headers (parseAnthropicCooldown)
 *   2. Persists a Map<provider/model, resetEpochMs> to disk
 *   3. Lets ForegroundFallbackManager skip cooled-down models at chain
 *      selection time (isCoolingDown) so the FIRST attempt of every new
 *      session hits a working model directly.
 *
 * Persistence file lives at: <getConfigDir()>/.omo-slim-cooldowns.json
 * Atomic writes use the same temp+rename pattern used by config-io.ts.
 *
 * The store is provider-agnostic — a non-Anthropic provider that emits an
 * x-ratelimit-reset (or similar) header could be added by extending
 * parseAnthropicCooldown; the cooldown machinery itself stores plain
 * (modelKey, resetEpochMs) pairs.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { getConfigDir } from '../../cli/paths';
import { log } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Header parsing
// ---------------------------------------------------------------------------

const ANTHROPIC_RESET_HEADERS = [
  'anthropic-ratelimit-requests-reset',
  'anthropic-ratelimit-tokens-reset',
  'anthropic-ratelimit-input-tokens-reset',
  'anthropic-ratelimit-output-tokens-reset',
] as const;

/**
 * Extract the latest cooldown-until epoch (ms) from an Anthropic response
 * headers object. Returns null if no recognizable reset header is present
 * or all headers fail to parse.
 *
 * Header values are ISO-8601 timestamps per Anthropic's docs. We accept
 * any input Date.parse() understands (covers RFC 2822, IETF, etc.) so we
 * stay robust to provider format drift.
 */
export function parseAnthropicCooldown(
  headers: Record<string, string> | undefined,
): number | null {
  if (!headers) return null;

  // Headers may arrive in any case; build a case-insensitive lookup.
  const lc: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    lc[k.toLowerCase()] = v;
  }

  let max: number | null = null;
  for (const name of ANTHROPIC_RESET_HEADERS) {
    const raw = lc[name];
    if (typeof raw !== 'string' || raw.length === 0) continue;
    const t = Date.parse(raw);
    if (!Number.isFinite(t)) continue;
    if (max === null || t > max) max = t;
  }
  return max;
}

// ---------------------------------------------------------------------------
// Persistent store
// ---------------------------------------------------------------------------

export interface CooldownStore {
  /** Mark a model as cooling down until the given epoch ms. */
  set(modelKey: string, resetEpochMs: number): void;
  /** Return true if the model is still cooling down at `now`. */
  isCoolingDown(modelKey: string, now?: number): boolean;
  /** Remove all entries whose cooldown has elapsed. */
  purgeExpired(now?: number): void;
  /** Persist the current map to disk atomically. */
  save(): void;
  /** Snapshot of current entries (for tests/observability). */
  snapshot(): Record<string, number>;
}

interface CreateOptions {
  /** Override file path (default: <getConfigDir()>/.omo-slim-cooldowns.json). */
  filePath?: string;
  /** Override clock (default: Date.now). Used in tests. */
  nowFn?: () => number;
}

/**
 * Default cooldown file path. Hidden filename (leading dot) so it doesn't
 * clutter the user's config dir listing.
 */
export function getDefaultCooldownPath(): string {
  return join(getConfigDir(), '.omo-slim-cooldowns.json');
}

/**
 * Construct an in-memory cooldown store backed by a JSON file. The store
 * loads existing entries (and purges expired ones) at construction time.
 *
 * Calls to `set()` immediately persist (so a crash mid-fallback doesn't
 * lose cooldown state); `save()` is exposed for tests and explicit flushes.
 */
export function createCooldownStore(opts: CreateOptions = {}): CooldownStore {
  const filePath = opts.filePath ?? getDefaultCooldownPath();
  const nowFn = opts.nowFn ?? (() => Date.now());
  const map = new Map<string, number>();

  // Initial load + purge of expired entries.
  if (existsSync(filePath)) {
    try {
      const raw = readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const now = nowFn();
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof k !== 'string' || k.length === 0) continue;
        if (typeof v !== 'number' || !Number.isFinite(v)) continue;
        if (v > now) map.set(k, v);
      }
    } catch (err) {
      // Corrupt file is non-fatal; log and start fresh.
      log('[foreground-fallback/cooldowns] failed to load store', {
        filePath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  function save(): void {
    try {
      const dir = dirname(filePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      const obj: Record<string, number> = {};
      for (const [k, v] of map.entries()) obj[k] = v;
      const content = `${JSON.stringify(obj, null, 2)}\n`;

      const tmp = `${filePath}.tmp`;
      const bak = `${filePath}.bak`;
      if (existsSync(filePath)) {
        try {
          copyFileSync(filePath, bak);
        } catch {
          // Backup failure is non-fatal; main write still proceeds.
        }
      }
      writeFileSync(tmp, content);
      renameSync(tmp, filePath);
    } catch (err) {
      log('[foreground-fallback/cooldowns] failed to persist store', {
        filePath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    set(modelKey, resetEpochMs) {
      if (!modelKey || !Number.isFinite(resetEpochMs)) return;
      // Only record forward-looking cooldowns; ignore stale resets.
      if (resetEpochMs <= nowFn()) return;
      // Keep the LATEST reset time if we already have one.
      const existing = map.get(modelKey);
      if (existing !== undefined && existing >= resetEpochMs) return;
      map.set(modelKey, resetEpochMs);
      save();
    },

    isCoolingDown(modelKey, now) {
      const reset = map.get(modelKey);
      if (reset === undefined) return false;
      const t = now ?? nowFn();
      if (reset <= t) {
        map.delete(modelKey);
        save();
        return false;
      }
      return true;
    },

    purgeExpired(now) {
      const t = now ?? nowFn();
      let changed = false;
      for (const [k, v] of map.entries()) {
        if (v <= t) {
          map.delete(k);
          changed = true;
        }
      }
      if (changed) save();
    },

    save,

    snapshot() {
      const out: Record<string, number> = {};
      for (const [k, v] of map.entries()) out[k] = v;
      return out;
    },
  };
}
