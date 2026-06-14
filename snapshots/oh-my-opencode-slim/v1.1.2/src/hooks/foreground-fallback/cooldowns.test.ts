import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCooldownStore, parseAnthropicCooldown } from './cooldowns';

// ---------------------------------------------------------------------------
// parseAnthropicCooldown
// ---------------------------------------------------------------------------

describe('parseAnthropicCooldown', () => {
  test('returns null when headers is undefined', () => {
    expect(parseAnthropicCooldown(undefined)).toBeNull();
  });

  test('returns null when no recognizable reset header is present', () => {
    expect(parseAnthropicCooldown({ 'x-rate-limit-reset': '2026-05-05T15:00:00Z' })).toBeNull();
    expect(parseAnthropicCooldown({})).toBeNull();
  });

  test('parses anthropic-ratelimit-requests-reset', () => {
    const ts = parseAnthropicCooldown({
      'anthropic-ratelimit-requests-reset': '2026-05-05T15:00:00Z',
    });
    expect(ts).toBe(Date.parse('2026-05-05T15:00:00Z'));
  });

  test('takes the maximum across all 4 reset headers', () => {
    const ts = parseAnthropicCooldown({
      'anthropic-ratelimit-requests-reset': '2026-05-05T15:00:00Z',
      'anthropic-ratelimit-tokens-reset': '2026-05-05T15:30:00Z',
      'anthropic-ratelimit-input-tokens-reset': '2026-05-05T14:00:00Z',
      'anthropic-ratelimit-output-tokens-reset': '2026-05-05T15:15:00Z',
    });
    expect(ts).toBe(Date.parse('2026-05-05T15:30:00Z'));
  });

  test('header lookup is case-insensitive', () => {
    const ts = parseAnthropicCooldown({
      'Anthropic-RateLimit-Requests-Reset': '2026-05-05T15:00:00Z',
    });
    expect(ts).toBe(Date.parse('2026-05-05T15:00:00Z'));
  });

  test('skips malformed values without throwing', () => {
    const ts = parseAnthropicCooldown({
      'anthropic-ratelimit-requests-reset': 'not-a-date',
      'anthropic-ratelimit-tokens-reset': '2026-05-05T15:00:00Z',
    });
    expect(ts).toBe(Date.parse('2026-05-05T15:00:00Z'));
  });

  test('returns null when all values are malformed', () => {
    const ts = parseAnthropicCooldown({
      'anthropic-ratelimit-requests-reset': 'not-a-date',
      'anthropic-ratelimit-tokens-reset': '',
    });
    expect(ts).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createCooldownStore
// ---------------------------------------------------------------------------

describe('createCooldownStore', () => {
  let tmp: string;
  let storePath: string;
  let now: number;
  const advanceClock = (ms: number): void => {
    now += ms;
  };

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'omo-cooldowns-'));
    storePath = join(tmp, '.omo-slim-cooldowns.json');
    now = Date.parse('2026-05-05T12:00:00Z');
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  test('starts empty when file does not exist', () => {
    const store = createCooldownStore({ filePath: storePath, nowFn: () => now });
    expect(store.snapshot()).toEqual({});
    expect(store.isCoolingDown('any/model')).toBe(false);
  });

  test('set persists immediately', () => {
    const store = createCooldownStore({ filePath: storePath, nowFn: () => now });
    const future = now + 60_000;
    store.set('anthropic/claude-opus-4-7', future);
    expect(existsSync(storePath)).toBe(true);
    const persisted = JSON.parse(readFileSync(storePath, 'utf8'));
    expect(persisted['anthropic/claude-opus-4-7']).toBe(future);
  });

  test('isCoolingDown returns true while cooldown is active', () => {
    const store = createCooldownStore({ filePath: storePath, nowFn: () => now });
    store.set('anthropic/claude-opus-4-7', now + 60_000);
    expect(store.isCoolingDown('anthropic/claude-opus-4-7')).toBe(true);
  });

  test('isCoolingDown returns false after expiry and clears the entry', () => {
    const store = createCooldownStore({ filePath: storePath, nowFn: () => now });
    store.set('anthropic/claude-opus-4-7', now + 60_000);
    advanceClock(120_000);
    expect(store.isCoolingDown('anthropic/claude-opus-4-7')).toBe(false);
    expect(store.snapshot()['anthropic/claude-opus-4-7']).toBeUndefined();
  });

  test('set ignores reset times in the past', () => {
    const store = createCooldownStore({ filePath: storePath, nowFn: () => now });
    store.set('anthropic/claude-opus-4-7', now - 1);
    expect(store.snapshot()).toEqual({});
  });

  test('set keeps the latest cooldown when called twice', () => {
    const store = createCooldownStore({ filePath: storePath, nowFn: () => now });
    store.set('anthropic/claude-opus-4-7', now + 30_000);
    store.set('anthropic/claude-opus-4-7', now + 90_000);
    expect(store.snapshot()['anthropic/claude-opus-4-7']).toBe(now + 90_000);
    // A subsequent earlier value does NOT overwrite a later one.
    store.set('anthropic/claude-opus-4-7', now + 60_000);
    expect(store.snapshot()['anthropic/claude-opus-4-7']).toBe(now + 90_000);
  });

  test('reload from disk drops expired entries', () => {
    const s1 = createCooldownStore({ filePath: storePath, nowFn: () => now });
    s1.set('anthropic/claude-opus-4-7', now + 60_000);
    s1.set('openai/gpt-5.4', now + 600_000);

    advanceClock(120_000);
    const s2 = createCooldownStore({ filePath: storePath, nowFn: () => now });
    expect(s2.isCoolingDown('anthropic/claude-opus-4-7')).toBe(false);
    expect(s2.isCoolingDown('openai/gpt-5.4')).toBe(true);
    expect(Object.keys(s2.snapshot())).toEqual(['openai/gpt-5.4']);
  });

  test('purgeExpired removes elapsed entries and persists', () => {
    const store = createCooldownStore({ filePath: storePath, nowFn: () => now });
    const m1Reset = now + 30_000;
    const m2Reset = now + 600_000;
    store.set('a/m1', m1Reset);
    store.set('b/m2', m2Reset);
    advanceClock(60_000);
    store.purgeExpired();
    expect(store.snapshot()).toEqual({ 'b/m2': m2Reset });
    // Re-load from disk to confirm persistence
    const reloaded = createCooldownStore({ filePath: storePath, nowFn: () => now });
    expect(Object.keys(reloaded.snapshot())).toEqual(['b/m2']);
  });

  test('handles corrupt JSON file gracefully', () => {
    writeFileSync(storePath, '{not valid json', 'utf8');
    const store = createCooldownStore({ filePath: storePath, nowFn: () => now });
    expect(store.snapshot()).toEqual({});
    // Subsequent set() works normally
    store.set('a/m', now + 60_000);
    expect(store.isCoolingDown('a/m')).toBe(true);
  });

  test('ignores non-string keys and non-number values from disk', () => {
    writeFileSync(
      storePath,
      JSON.stringify({
        'good/model': now + 60_000,
        'bad-1/model': 'not-a-number',
        '': 12345,
      }),
      'utf8',
    );
    const store = createCooldownStore({ filePath: storePath, nowFn: () => now });
    expect(Object.keys(store.snapshot())).toEqual(['good/model']);
  });
});
