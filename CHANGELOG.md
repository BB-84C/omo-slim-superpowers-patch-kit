# Changelog

## 2026-05-04

- Added optional **best-of-N + fast-lane extension**:
  - New patch `0003-best-of-n-agent-name-resolution.patch`: adds `resolveBaseAgentName()` suffix-stripping in `src/cli/superpowers-policy.ts` and `src/cli/skills.ts` so variant agents (`fixer-alpha`, `oracle-gamma`, etc.) inherit base agent superpowers policy automatically. Adds explicit policy entries for `scout`, `validator`, `gist`, `wildcard` utility agents.
  - New `opencode-config/` subtree: optional example mirror of the maintainer's full setup, containing 20 agent markdown files (16 variants + 4 utility), 5 shared base prompt files, the `best-of-n-with-judge` skill (SKILL.md + 3 prompt templates), and design/plan docs.
  - Updated `config-templates/oh-my-opencode-slim.superpowers-bridge.jsonc`: 20 new agent entries with model + variant + orchestratorPrompt for the best-of-N + utility agents.
  - Updated `prompt-bridges/oracle_append.md`: new "Multi-candidate review (best-of-N mode)" section teaching oracle the verdict format.
  - Updated `prompt-bridges/orchestrator_append.md`: new "Best-of-N awareness" section teaching the controller when to invoke the skill.
  - Updated `snapshots/oh-my-opencode-slim/src/cli/superpowers-policy.ts` and `snapshots/oh-my-opencode-slim/src/cli/skills.ts` to reflect post-patch-0003 state.
  - Updated `README.md`, `docs/architecture.md`, `docs/install.md`, `docs/verify.md` with optional best-of-N install/verify guidance.
- Best-of-N is opt-in. The base patch kit (patches 0001 + 0002 + bridges + base agent templates) works without applying patch 0003 or copying `opencode-config/`.

## 2026-04-22

- Initial public patch-kit repository setup
- Added baseline project metadata and compatibility notes for the validated local `superpowers + oh-my-opencode-slim` integration
