# Compatibility

## Validated versions

This patch kit is currently validated against:

- `superpowers v5.0.7`
- `oh-my-opencode-slim v1.0.1`

## Expectations for nearby versions

Nearby newer versions are unvalidated; if patch hunks fail or runtime behavior differs, compare the target files against the paths listed below and your own local reference copies before proceeding.

If your local versions are significantly older, upgrade first.

## What to check when versions differ

- `src/cli/skills.ts`
- `src/config/agent-mcps.ts`
- `src/index.ts`
- prompt bridge loading behavior
- OMO-built-in MCP names
- Superpowers skill inventory
