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
- `src/cli/superpowers-policy.ts` (introduced by 0001, modified by 0003)
- `src/config/agent-mcps.ts` (touched by patch 0002)
- `src/index.ts` (touched by patch 0002)
- prompt bridge loading behavior
- OMO-built-in MCP names
- Superpowers skill inventory
- For patch 0003 specifically: presence of `getCustomAgentNames()` discovery path + `buildCustomAgentDefinition()` in `src/agents/index.ts` (these are how custom agents — including the best-of-N variants — get registered; if upstream changes the discovery mechanism, patch 0003's policy resolution still applies but the custom agent registration may need adjustment)
