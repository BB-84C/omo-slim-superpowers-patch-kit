/**
 * Skills that may only be invoked by manual root orchestrators.
 *
 * For all other agents, these skill names are explicitly denied —
 * regardless of the agent's non-SP `* allow` / `* deny`
 * posture. This forms a closed-set whitelist that is symmetric to the
 * closed-set blacklist in `agent-mcp-blacklist.ts`.
 *
 * Future skills that should be orchestrator-only just append here.
 */
export const RESERVED_ORCHESTRATOR_ONLY_SKILLS: ReadonlyArray<string> = [
  'best-of-n-with-judge',
  'update-memory', // PLACEHOLDER: skill landing in a future commit (memory layer)
] as const;

/**
 * Return `true` if the given agent is permitted to invoke reserved
 * orchestrator-only skills. Currently: `orchestrator`, `orchestrator-beta`,
 * and manual non-fallback GPT root `orchestrator-delta` only. Variant agents
 * (e.g. `fixer-alpha`) do NOT inherit this access.
 */
export function isReservedSkillAllowed(agentName: string): boolean {
  return (
    agentName === 'orchestrator' ||
    agentName === 'orchestrator-beta' ||
    agentName === 'orchestrator-delta'
  );
}
