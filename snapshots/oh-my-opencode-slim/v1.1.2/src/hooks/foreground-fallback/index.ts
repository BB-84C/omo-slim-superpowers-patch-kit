/**
 * Runtime model fallback for foreground (interactive) agent sessions.
 *
 * When OpenCode fires a session.error, message.updated, or session.status
 * event containing a rate-limit signal, this manager:
 *   1. Looks up the next untried model in the agent's configured chain
 *   2. Aborts the rate-limited prompt via client.session.abort()
 *   3. Re-queues the last user message via client.session.promptAsync()
 *      with the new model — promptAsync returns immediately so we never
 *      block the event handler waiting for a full LLM response.
 *
 * This mirrors the same fallback loop used for delegated sessions, but operates
 * reactively through the event system instead of wrapping prompt() in a
 * try/catch, which is not possible for interactive (foreground) sessions.
 */

import type { PluginInput } from '@opencode-ai/plugin';
import { log } from '../../utils/logger';
import {
  ANTHROPIC_PRIMARY_ORCHESTRATOR,
  isAnthropicPrimaryOrchestrator,
  PIVOT_TARGET_MODEL,
  PIVOT_TARGET_ORCHESTRATOR,
} from '../../utils/orchestrator-identity';
import {
  type CooldownStore,
  createCooldownStore,
  parseAnthropicCooldown,
} from './cooldowns';

type OpencodeClient = PluginInput['client'];
type SessionAgentChangeHandler = (sessionID: string, agentName: string) => void;

// ---------------------------------------------------------------------------
// Retryable-failure detection (behavior-based, no message regex)
// ---------------------------------------------------------------------------

type RetryableApiError = {
  name?: string;
  message?: string;
  data?: {
    isRetryable?: boolean;
    responseHeaders?: Record<string, string>;
    statusCode?: number;
    message?: string;
    responseBody?: string;
  };
  error?: unknown;
};

/**
 * Normalize plugin-visible errors.
 *
 * OpenCode exposes structured API errors on assistant messages and
 * session.error events. Some layers wrap the real payload as
 * `{ error: ApiError }`, so unwrap recursively.
 */
function unwrapApiError(error: unknown): RetryableApiError | null {
  if (!error || typeof error !== 'object') return null;
  const err = error as RetryableApiError;
  if (err.data || err.name) return err;
  if (err.error) return unwrapApiError(err.error);
  return err;
}

/**
 * Structured retryable-failure detector.
 *
 * We intentionally do NOT regex-match free-form provider text here.
 * Instead we follow OpenCode's behavior contract:
 *   - retryable direct API failures carry `data.isRetryable === true`
 *   - 429 is always retryable even if `isRetryable` is absent
 */
export function isRateLimitError(error: unknown): boolean {
  const err = unwrapApiError(error);
  if (!err) return false;
  const insufficientBalanceText = [
    err.message,
    err.data?.message,
    err.data?.responseBody,
  ]
    .filter((value): value is string => typeof value === 'string')
    .some((value) => /insufficient\s+balance/i.test(value));
  if (insufficientBalanceText) return true;
  if (!err.data) return false;
  return err.data.isRetryable === true || err.data.statusCode === 429;
}

/**
 * Extract response headers from a structured API error.
 * Lives at error.data.responseHeaders per @opencode-ai/sdk's ApiError type.
 */
function extractResponseHeaders(
  error: unknown,
): Record<string, string> | undefined {
  const headers = unwrapApiError(error)?.data?.responseHeaders;
  if (!headers || typeof headers !== 'object') return undefined;
  return headers as Record<string, string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseModel(
  model: string,
): { providerID: string; modelID: string } | null {
  const slash = model.indexOf('/');
  if (slash <= 0 || slash >= model.length - 1) return null;
  return { providerID: model.slice(0, slash), modelID: model.slice(slash + 1) };
}

/** Prevent re-triggering within this window for the same session. */
const DEDUP_WINDOW_MS = 5_000;

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

/**
 * Manages runtime model fallback for foreground agent sessions.
 *
 * Constructed at plugin init with the ordered fallback chains for each agent
 * (built from _modelArray entries merged with fallback.chains config).
 */
export class ForegroundFallbackManager {
  /** sessionID → last observed model string ("providerID/modelID") */
  private readonly sessionModel = new Map<string, string>();
  /** sessionID → agent name (populated from message.updated info.agent field) */
  private readonly sessionAgent = new Map<string, string>();
  /** sessionID → set of models already attempted this session */
  private readonly sessionTried = new Map<string, Set<string>>();
  /** Sessions with an active fallback switch in flight */
  private readonly inProgress = new Set<string>();
  /** sessionID → timestamp of last trigger (for deduplication) */
  private readonly lastTrigger = new Map<string, number>();
  /** task/subagent-owned child sessions (session.created with parentID) */
  private readonly childSessions = new Set<string>();

  /**
   * Persistent cross-session cooldown tracker. When an Anthropic rate-limit
   * response arrives with anthropic-ratelimit-*-reset headers, the affected
   * model is recorded here so subsequent chain traversals (in this session
   * AND in fresh sessions across plugin restarts) skip it until the reset
   * time elapses. Falls back to the default disk-backed store unless the
   * caller provides one (tests inject an in-memory clock-controllable
   * store).
   */
  private readonly cooldowns: CooldownStore;

  constructor(
    private readonly client: OpencodeClient,
    /**
     * Ordered fallback chains per agent.
     * e.g. { orchestrator: ['anthropic/claude-opus-4-5', 'openai/gpt-4o'] }
     * The first model that hasn't been tried yet is selected on each fallback.
     */
    private readonly chains: Record<string, string[]>,
    private readonly enabled: boolean,
    cooldowns?: CooldownStore,
    private readonly onSessionAgentChange?: SessionAgentChangeHandler,
  ) {
    this.cooldowns = cooldowns ?? createCooldownStore();
  }

  /** Expose the cooldown store (used by startup-time model selection). */
  getCooldownStore(): CooldownStore {
    return this.cooldowns;
  }

  /**
   * Capture an Anthropic-style cooldown for the model that just hit a rate
   * limit. Idempotent: only records forward-looking reset times. Persists
   * to disk synchronously.
   */
  private captureCooldown(sessionID: string, error: unknown): void {
    const currentModel = this.sessionModel.get(sessionID);
    if (!currentModel) return;
    const headers = extractResponseHeaders(error);
    const epoch = parseAnthropicCooldown(headers);
    if (epoch === null) return;
    this.cooldowns.set(currentModel, epoch);
    log('[foreground-fallback] recorded model cooldown', {
      sessionID,
      model: currentModel,
      until: new Date(epoch).toISOString(),
    });
  }

  /**
   * Process an OpenCode plugin event.
   * Call this from the plugin's `event` hook for every event received.
   */
  async handleEvent(rawEvent: unknown): Promise<void> {
    if (!this.enabled) return;
    const event = rawEvent as { type: string; properties?: unknown };
    if (!event?.type) return;

    switch (event.type) {
      case 'session.created': {
        const props = event.properties as
          | { info?: { id?: string; parentID?: string | null } }
          | undefined;
        const id = props?.info?.id;
        const parentID = props?.info?.parentID;
        if (id && parentID) {
          this.childSessions.add(id);
        }
        break;
      }

      case 'message.updated': {
        const info = (
          event.properties as { info?: Record<string, unknown> } | undefined
        )?.info;
        if (!info) break;
        const sessionID = info.sessionID as string | undefined;
        if (!sessionID) break;
        // Capture agent name when available (OpenCode includes it on subagent messages)
        if (typeof info.agent === 'string') {
          this.sessionAgent.set(sessionID, info.agent);
        }
        // Track the model currently serving this session
        if (
          typeof info.providerID === 'string' &&
          typeof info.modelID === 'string'
        ) {
          this.sessionModel.set(
            sessionID,
            `${info.providerID}/${info.modelID}`,
          );
        }
        // Rate-limit on an individual message
        if (info.error && isRateLimitError(info.error)) {
          this.captureCooldown(sessionID, info.error);
          await this.tryFallback(sessionID);
        }
        break;
      }

      case 'session.error': {
        const props = event.properties as
          | { sessionID?: string; error?: unknown }
          | undefined;
        if (props?.sessionID && props.error && isRateLimitError(props.error)) {
          this.captureCooldown(props.sessionID, props.error);
          await this.tryFallback(props.sessionID);
        }
        break;
      }

      case 'session.status': {
        const props = event.properties as
          | {
              sessionID?: string;
              status?: { type?: string; message?: string };
            }
          | undefined;
        if (!props?.sessionID || props.status?.type !== 'retry') break;
        // Behavior-based trigger: if OpenCode has entered structured retry mode,
        // we should switch models regardless of the provider's free-form message text.
        await this.tryFallback(props.sessionID);
        break;
      }

      case 'subagent.session.created': {
        // Some builds of OpenCode include the agent name here.
        const props = event.properties as
          | { sessionID?: string; agentName?: unknown }
          | undefined;
        if (props?.sessionID) {
          this.childSessions.add(props.sessionID);
          if (typeof props.agentName === 'string') {
            this.sessionAgent.set(props.sessionID, props.agentName);
          }
        }
        break;
      }

      case 'session.deleted': {
        // Clean up all per-session state to prevent unbounded memory growth
        // in long-running instances with many subagent sessions.
        // OpenCode emits two shapes depending on context:
        //   { properties: { sessionID } }   — subagent / task sessions
        //   { properties: { info: { id } } } — top-level session deletion
        // Mirror the same dual-shape lookup used elsewhere in the plugin.
        const props = event.properties as
          | { sessionID?: string; info?: { id?: string } }
          | undefined;
        const id = props?.info?.id ?? props?.sessionID;
        if (id) {
          this.sessionModel.delete(id);
          this.sessionAgent.delete(id);
          this.sessionTried.delete(id);
          this.childSessions.delete(id);
          this.inProgress.delete(id);
          this.lastTrigger.delete(id);
        }
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Core fallback logic
  // ---------------------------------------------------------------------------

  private async tryFallback(sessionID: string): Promise<void> {
    if (!sessionID) return;
    if (this.shouldPivotOrchestrator(sessionID)) {
      await this.pivotOrchestrator(sessionID);
      return;
    }
    await this.chainWalkFallback(sessionID);
  }

  /**
   * Return true if a fallback trigger on this session should perform the
   * one-shot orchestrator → orchestrator-beta pivot rather than the
   * generic chain-walk.
   *
   * Conditions:
   *   - sessionID is a foreground session (not in childSessions)
   *   - sessionAgent.get(sessionID) === ANTHROPIC_PRIMARY_ORCHESTRATOR
   */
  private shouldPivotOrchestrator(sessionID: string): boolean {
    if (this.childSessions.has(sessionID)) return false;
    return isAnthropicPrimaryOrchestrator(this.sessionAgent.get(sessionID));
  }

  private async chainWalkFallback(sessionID: string): Promise<void> {
    if (this.inProgress.has(sessionID)) return;

    if (this.childSessions.has(sessionID)) {
      // Task-owned child sessions are pre-routed at startup by the main
      // plugin logic. Mid-flight rescue inside the same child session is
      // deliberately disabled because it races the parent/task completion
      // contract and causes empty immediate returns.
      log('[foreground-fallback] child session mid-flight fallback disabled', {
        sessionID,
      });
      return;
    }

    // Deduplicate: multiple events can fire for a single rate-limit event.
    const now = Date.now();
    if (now - (this.lastTrigger.get(sessionID) ?? 0) < DEDUP_WINDOW_MS) return;
    this.lastTrigger.set(sessionID, now);

    this.inProgress.add(sessionID);
    try {
      const currentModel = this.sessionModel.get(sessionID);
      const agentName = this.sessionAgent.get(sessionID);
      const chain = this.resolveChain(agentName, currentModel);
      if (!chain.length) {
        log('[foreground-fallback] no chain configured', {
          sessionID,
          agentName,
        });
        return;
      }

      if (!this.sessionTried.has(sessionID)) {
        this.sessionTried.set(sessionID, new Set());
      }
      // biome-ignore lint/style/noNonNullAssertion: We just set this above
      const tried = this.sessionTried.get(sessionID)!;
      if (currentModel) tried.add(currentModel);

      // Prefer untried models that aren't currently in cooldown. If the
      // entire chain is cooled down, fall back to "first untried" so the
      // user isn't stuck waiting (cooldown is a soft hint, not a hard
      // block — better to attempt and fail than to give up entirely).
      // We let the cooldown store use its own clock so tests can inject
      // a fake nowFn for deterministic behavior.
      let nextModel = chain.find(
        (m) => !tried.has(m) && !this.cooldowns.isCoolingDown(m),
      );
      if (!nextModel) {
        nextModel = chain.find((m) => !tried.has(m));
      }
      if (!nextModel) {
        log('[foreground-fallback] fallback chain exhausted', {
          sessionID,
          agentName,
          tried: [...tried],
        });
        return;
      }
      tried.add(nextModel);

      const ref = parseModel(nextModel);
      if (!ref) {
        log('[foreground-fallback] invalid model format', {
          sessionID,
          nextModel,
        });
        return;
      }

      // Retrieve the last user message to re-submit with the fallback model.
      const result = await this.client.session.messages({
        path: { id: sessionID },
      });
      const messages = (result.data ?? []) as Array<{
        info: { role: string };
        parts: unknown[];
      }>;
      const lastUser = [...messages]
        .reverse()
        .find((m) => m.info.role === 'user');
      if (!lastUser) {
        log('[foreground-fallback] no user message found', { sessionID });
        return;
      }

      // Foreground/main sessions use abort + async replay. The abort is
      // what flips OpenCode out of its core retry loop so the replay can
      // take over cleanly. Child sessions returned above before any
      // mid-flight fallback work begins.
      try {
        await this.client.session.abort({ path: { id: sessionID } });
      } catch {
        // Session may already be idle; safe to ignore.
      }

      // Give the server a moment to finalise the abort before re-prompting.
      await new Promise((r) => setTimeout(r, 500));

      const body = {
        parts: lastUser.parts,
        model: ref,
        ...(agentName ? { agent: agentName } : {}),
      };

      const sessionClient = this.client.session as unknown as {
        promptAsync: (args: {
          path: { id: string };
          body: {
            parts: unknown[];
            model: { providerID: string; modelID: string };
            agent?: string;
          };
        }) => Promise<unknown>;
      };

      // Foreground/main sessions stay non-blocking: queue the replay and
      // return immediately so the event hook does not stall the UI.
      await sessionClient.promptAsync({
        path: { id: sessionID },
        body,
      });

      this.sessionModel.set(sessionID, nextModel);
      log('[foreground-fallback] switched to fallback model', {
        sessionID,
        agentName,
        from: currentModel,
        to: nextModel,
      });
    } catch (err) {
      log('[foreground-fallback] fallback attempt failed', {
        sessionID,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.inProgress.delete(sessionID);
    }
  }

  /**
   * One-shot pivot from the anthropic-primary orchestrator to
   * orchestrator-beta. Aborts the rate-limited foreground session, sleeps
   * briefly to let the abort settle, then replays the last user message
   * with body.agent = 'orchestrator-beta' and body.model = gpt-5.4.
   *
   * The session's agent identity is reassigned via the replay's body.agent
   * field; the plugin-level identity callback updates the same map used by
   * subsequent subagent pre-route decisions.
   *
   * No chain walking. No sessionTried bookkeeping. The pivot is one-way
   * per session — the user must manually re-select 'orchestrator' from
   * the TUI to revert.
   */
  private async pivotOrchestrator(sessionID: string): Promise<void> {
    if (!sessionID) return;
    if (this.inProgress.has(sessionID)) return;
    const now = Date.now();
    if (now - (this.lastTrigger.get(sessionID) ?? 0) < DEDUP_WINDOW_MS) return;
    this.lastTrigger.set(sessionID, now);
    this.inProgress.add(sessionID);

    try {
      const result = await this.client.session.messages({
        path: { id: sessionID },
      });
      const messages = (result.data ?? []) as Array<{
        info: { role: string };
        parts: unknown[];
      }>;
      const lastUser = [...messages]
        .reverse()
        .find((m) => m.info.role === 'user');
      if (!lastUser) {
        log('[orchestrator-pivot] no user message found', { sessionID });
        return;
      }

      try {
        await this.client.session.abort({ path: { id: sessionID } });
      } catch {
        // Session may already be idle; safe to ignore.
      }
      await new Promise((r) => setTimeout(r, 500));

      const body = {
        parts: lastUser.parts,
        model: PIVOT_TARGET_MODEL,
        agent: PIVOT_TARGET_ORCHESTRATOR,
      };

      const sessionClient = this.client.session as unknown as {
        promptAsync: (args: {
          path: { id: string };
          body: {
            parts: unknown[];
            model: { providerID: string; modelID: string };
            agent?: string;
          };
        }) => Promise<unknown>;
      };

      await sessionClient.promptAsync({
        path: { id: sessionID },
        body,
      });

      this.sessionAgent.set(sessionID, PIVOT_TARGET_ORCHESTRATOR);
      this.onSessionAgentChange?.(sessionID, PIVOT_TARGET_ORCHESTRATOR);
      this.sessionModel.set(
        sessionID,
        `${PIVOT_TARGET_MODEL.providerID}/${PIVOT_TARGET_MODEL.modelID}`,
      );

      log('[orchestrator-pivot] switched to orchestrator-beta', {
        sessionID,
        from: ANTHROPIC_PRIMARY_ORCHESTRATOR,
        to: PIVOT_TARGET_ORCHESTRATOR,
        model: `${PIVOT_TARGET_MODEL.providerID}/${PIVOT_TARGET_MODEL.modelID}`,
      });
    } catch (err) {
      log('[orchestrator-pivot] pivot failed', {
        sessionID,
        error: String(err),
      });
    } finally {
      this.inProgress.delete(sessionID);
    }
  }

  // ---------------------------------------------------------------------------
  // Chain resolution
  // ---------------------------------------------------------------------------

  /**
   * Determine the fallback chain to use for a session.
   *
   * Priority:
   * 1. Agent name known AND has a configured chain → return it directly
   * 2. Agent name known but NO chain configured → return [] (no fallback;
   *    do NOT bleed into other agents' chains which would re-prompt the
   *    session with a model belonging to a completely different agent)
   * 3. Agent name unknown, current model known → search all chains for
   *    the model to infer which chain to use
   * 4. Nothing matches → flatten all chains as a last resort (only
   *    reached when both agent name and current model are unavailable)
   */
  private resolveChain(
    agentName: string | undefined,
    currentModel: string | undefined,
  ): string[] {
    if (agentName) {
      // Agent is known: use its chain exactly, or no chain at all.
      // Never fall through to cross-agent chains when the agent is identified.
      return this.chains[agentName] ?? [];
    }

    // Agent unknown: try to infer from the current model.
    if (currentModel) {
      for (const chain of Object.values(this.chains)) {
        if (chain.includes(currentModel)) return chain;
      }
    }

    // Last resort: merged list across all agents preserving insertion order.
    // Only reached when both agent name and current model are unavailable.
    const all: string[] = [];
    const seen = new Set<string>();
    for (const chain of Object.values(this.chains)) {
      for (const m of chain) {
        if (!seen.has(m)) {
          seen.add(m);
          all.push(m);
        }
      }
    }
    return all;
  }
}
