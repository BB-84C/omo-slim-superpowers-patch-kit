/**
 * Identity-driven Anthropic fallback constants and helpers.
 *
 * Replaces the prior `anthropicDegradedRoots` flag-based system with a
 * single source of truth: the current root session's `agent` identity.
 *
 * - When the active foreground agent is `ANTHROPIC_PRIMARY_ORCHESTRATOR`
 *   and a retry/retryable error fires, ForegroundFallbackManager pivots
 *   the entire session to `PIVOT_TARGET_ORCHESTRATOR` on `PIVOT_TARGET_MODEL`.
 * - When the active root agent is `PIVOT_TARGET_ORCHESTRATOR`, fresh `task`
 *   calls to anthropic-primary subagents auto-route to their
 *   `__task_fallback` shadow.
 *
 * The transition is one-way per session. Returning to the anthropic primary
 * orchestrator requires manual TUI selection by the user.
 */

export const ANTHROPIC_PRIMARY_ORCHESTRATOR = 'orchestrator' as const;
export const PIVOT_TARGET_ORCHESTRATOR = 'orchestrator-beta' as const;

export const PIVOT_TARGET_MODEL: Readonly<{
  providerID: string;
  modelID: string;
}> = Object.freeze({
  providerID: 'gauge-forge-openai',
  modelID: 'gpt-5.4',
});

export const ANTHROPIC_PRIMARY_MODEL: Readonly<{
  providerID: string;
  modelID: string;
}> = Object.freeze({
  providerID: 'gauge-forge-anthropic',
  modelID: 'claude-opus-4-7',
});

/**
 * Return true if the given agent name is the literal anthropic-primary
 * orchestrator that should pivot to PIVOT_TARGET_ORCHESTRATOR on retry.
 */
export function isAnthropicPrimaryOrchestrator(
  agentName: string | undefined,
): boolean {
  return agentName === ANTHROPIC_PRIMARY_ORCHESTRATOR;
}

/**
 * Return true if the given agent name is the pivot-target orchestrator,
 * meaning subagent pre-route should fire for anthropic-primary children.
 * Manual GPT roots such as `orchestrator-delta` are explicitly non-fallback
 * roots and must not trigger this beta-only routing.
 */
export function isPivotedRootAgent(agentName: string | undefined): boolean {
  return agentName === PIVOT_TARGET_ORCHESTRATOR;
}

/**
 * Return true if the given agent name is an orchestrator-shaped agent: the
 * literal `orchestrator` or any prefix-extended variant such as
 * `orchestrator-beta`, `orchestrator-delta`, `orchestrator-gamma`, etc.
 *
 * Used by orchestrator-only runtime behaviors that must apply uniformly to
 * variants: bridge-prompt injection, mode='primary' classification, full
 * superpowers skill allowance, and auto-continue session tracking. Without
 * this, variants drift into "subagent" semantics and lose features like
 * auto-continuation when the root session is anything other than the literal
 * `orchestrator`.
 */
export function isOrchestratorAgent(
  agentName: string | undefined,
): boolean {
  return agentName !== undefined && agentName.startsWith('orchestrator');
}
