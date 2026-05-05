# Compatibility

## Validated versions

This patch kit is currently validated against:

- `superpowers v5.0.7`
- `oh-my-opencode-slim v1.0.1`

## Expectations for nearby versions

Nearby newer versions are unvalidated; if patch hunks fail or runtime behavior differs, compare the target files against the paths listed below and your own local reference copies before proceeding.

If your local versions are significantly older, upgrade first.

## What to check when versions differ

- `src/cli/skills.ts` (touched by patches 0001 and 0003)
- `src/cli/superpowers-policy.ts` (introduced by 0001, modified by 0003 and 0004)
- `src/cli/superpowers-policy.test.ts` (introduced by 0001, extended by 0004)
- `src/config/agent-mcps.ts` (touched by patch 0002)
- `src/index.ts` (touched by patches 0002, 0004, and 0005)
- `src/agents/index.ts` (touched by patch 0004 — `applyClassification` mode='primary' check)
- `src/hooks/foreground-fallback/index.ts` (touched by patch 0005)
- `src/hooks/foreground-fallback/cooldowns.ts` (introduced by patch 0005)
- `src/hooks/foreground-fallback/cooldowns.test.ts` (introduced by patch 0005)
- `src/hooks/foreground-fallback/index.test.ts` (extended by patch 0005)
- prompt bridge loading behavior
- OMO-built-in MCP names
- Superpowers skill inventory
- For patch 0003 specifically: presence of `getCustomAgentNames()` discovery path + `buildCustomAgentDefinition()` in `src/agents/index.ts` (these are how custom agents — including the best-of-N variants — get registered; if upstream changes the discovery mechanism, patch 0003's policy resolution still applies but the custom agent registration may need adjustment)
- For patch 0004 specifically: presence of literal `agentName === 'orchestrator'` checks in `src/index.ts` (post-file-tool nudge hook around line 229, chat.system.transform hook around line 679) and in `src/agents/index.ts` `applyClassification` (mode='primary' branch). If upstream renames or restructures these sites, the patch will need re-targeting but the underlying generalization is straightforward (`isOrchestratorAgent(name)` instead of `name === 'orchestrator'`).
- For patch 0005 specifically (Anthropic cooldown tracking): adds two new files (`src/hooks/foreground-fallback/cooldowns.ts` and `cooldowns.test.ts`) and modifies `src/hooks/foreground-fallback/index.ts` (constructor signature gains an optional `cooldowns` 4th argument; new private `captureCooldown()` helper; chain selection in `tryFallback()` uses cooldown-aware filter) and `src/index.ts` (the `effectiveArrays` startup loop reads from `foregroundFallback.getCooldownStore()` to skip cooled models). If upstream restructures `ForegroundFallbackManager.tryFallback` or moves the startup model-selection loop, the patch will need re-targeting; the cooldown helper module itself is upstream-independent.
- Patch 0005 expects `error.data.responseHeaders` to be available on rate-limit error payloads (per `@opencode-ai/sdk` `ApiError.data.responseHeaders` typing). If a future SDK version drops this field, the cooldown capture becomes a no-op (the rest of the fallback machinery remains functional).
