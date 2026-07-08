# Changelog

## 2026-07-08 — auto-continue variant agent + model preservation fix

### Fixed
- Auto-continue now preserves the session's active variant agent (`orchestrator-beta`, `orchestrator-delta`, etc.) and user-selected model across continuation prompts. Previously the auto-continue prompt call omitted `agent` and `model` from the body, causing OpenCode to resolve the default `orchestrator` agent with its JSONC-defined model — dropping both variant identity and any temporary model overrides the user had selected in-session.
- Root cause: `todo-continuation/index.ts:632-638` called `session.prompt()` without `agent` or `model`. The hook had no way to look up either value for a session.
- Fix: added `getSessionAgent` / `getSessionModel` callbacks to `createTodoContinuationHook` config, exposed `ForegroundFallbackManager.getSessionModel()` (the manager already tracked both agent and model per session via `message.updated` events), and wired the callbacks from `index.ts` using the existing `sessionAgentMap` and the new public accessor. The continuation body now includes `agent` and `model` when available (no-op if not tracked — backward compatible).

### Changed files (snapshot)
- `src/hooks/todo-continuation/index.ts` — import `parseModelReference`, accept `getSessionAgent`/`getSessionModel` config callbacks, include `agent` and `model` in continuation prompt body
- `src/hooks/foreground-fallback/index.ts` — add public `getSessionModel(sessionID)` method
- `src/index.ts` — wire `getSessionAgent` / `getSessionModel` callbacks to `createTodoContinuationHook` constructor

## v1.1.2 release (2026-06-13)

Refreshed onto upstream `oh-my-opencode-slim v1.1.2` (validated basis = `oh-my-opencode-slim v1.1.2` + `superpowers v5.1.0`). All prior bridge semantics preserved.

### Added
- New rollup `patches/oh-my-opencode-slim/v1.1.2/0001-superpowers-bridge-rollup.patch` reapplies the full superpowers bridge onto a clean `v1.1.2` checkout in one step.
- Auto-continue now recognizes orchestrator variants. Previously the `todo-continuation` hook gated on a literal `agent === 'orchestrator'` check at three sites, which dropped auto-continue support for `orchestrator-beta`, `orchestrator-delta`, etc. The hook now routes through a shared `isOrchestratorAgent()` helper in `src/utils/orchestrator-identity.ts` (prefix-match on `orchestrator`).
- Snapshot anchor for `src/hooks/todo-continuation/index.ts` so the variant fix is part of the comparison surface.

### Fixed (carried forward from upstream that the v1.0.7-based merge had lost)
- `displayName` safe-alias validation in `src/agents/index.ts`. Upstream v1.1.2 added an explicit `isSafeDisplayName(normalized)` check that throws `displayName '<x>' must match /^[a-z][a-z0-9_-]*$/i` when a user-supplied displayName contains spaces or other unsafe characters; our v1.0.7-based merge resolution did not carry this check forward. This release reintroduces the constant `SAFE_AGENT_ALIAS_RE`, the `isSafeDisplayName(...)` helper, and the throw on unsafe displayName at the validation loop. `display-name.test.ts` and `index.test.ts` regression cases pass.

### Inherited from upstream v1.1.0 / v1.1.1 / v1.1.2 (we keep)
- `session-goal` hook + `/session-goal` command (subtask worker sessions can now carry a session goal).
- `subtask` tool surface (new `/subtask` worker sessions for parallel-agent delegation).
- `clonedeps` skill (utility for clone-and-then-deepwork-on-deps).
- `phase-reminder` UI/chat-history leak fix (upstream PR #448).
- `apply_patch` readonly-args fix (upstream PR #449).
- Insufficient-balance detection added to the foreground-fallback rate-limit classifier (upstream PR #484).
- Auto-update channel/dist-tag hardening (upstream PRs #519–#525, the "v1-safe-auto-update" chain).
- README translations (Japanese, Korean, Chinese) and contributor metadata.

### Still pruned (intentional)
- `src/divoom/*`, `src/tui*`, `src/cli/doctor*`, `src/hooks/task-session-manager/*` — same exclusions as the v1.0.7 release; v1.1.2 did not change our stance on these.

### Validated basis
- `oh-my-opencode-slim v1.1.2` (commit `89f7a40`)
- `superpowers v5.1.0` (unchanged)

### Fresh-install simulation
- Apply-check on clean `v1.1.2` clone: PASS, no whitespace warnings
- `bun install`, `bun test`, `bun run build`, `bunx tsc --noEmit`, `bun test scripts/build-cleanliness.test.ts`: all PASS
- Fresh-install focused test suite: **319 pass / 0 fail**.
- Full test suite on live tree: 1180 pass / 75 fail (the 75 fails are all Windows path/interview env-sensitive tests that pre-existed in the v1.0.7 baseline and in bare upstream v1.1.2; no new regressions introduced by this refresh).

## 2026-05-09 — release-basis docs refresh

### Changed
- Install-facing documentation now names `oh-my-opencode-slim v1.0.7` and `superpowers v5.1.0` as the current validated basis instead of the previous release pair.

## 2026-05-08 — docs follow-up

### Changed
- `README.md`, `docs/install.md`, and `docs/verify.md` now call out the most common installation miss explicitly: patching/building the local `oh-my-opencode-slim` checkout is not enough unless the user also merges `config-templates/oh-my-opencode-slim.superpowers-bridge.jsonc` into `~/.config/opencode/oh-my-opencode-slim.jsonc`.

## 2026-05-08 — v1.6.0

### Added
- Publication patch `0007-final-orchestrator-pivot-cleanup.patch` for the final verified orchestrator pivot behavior.
- `orchestrator-delta` in the public config template as a manual GPT root without fallback-enforcement semantics.
- Snapshot coverage for final pivot source files, tests, `package.json`, and clean-build scripts.
- Final design and plan docs for the beta/delta pivot cleanup.

### Changed
- Automatic retry pivot is exactly `orchestrator` -> `orchestrator-beta` on `gauge-forge-openai/gpt-5.4`.
- Fresh child task pre-route depends only on the current root identity being `orchestrator-beta`.
- Reserved orchestrator-only skills now allow `orchestrator`, `orchestrator-beta`, and `orchestrator-delta`.
- `bun run build` now runs `clean:dist` first so stale deleted `dist/` files do not survive rebuilds.

### Removed
- Removed forced degraded override and debug retry probe surfaces from final public behavior.
- Removed stale public guidance docs for the abandoned debug-root probe.

## 2026-05-07 — v1.5.0

### Added
- `src/utils/orchestrator-identity.ts` for root identity constants and helpers.
- `ForegroundFallbackManager.pivotOrchestrator()` for one-shot `orchestrator` -> `orchestrator-beta` replay.
- Resumed `task` blocking when beta pivot mode sees a `task_id` for an Anthropic-primary child.

### Changed
- Task pre-route consults the current root agent name instead of a separate degraded flag.

### Removed
- Removed the separate degraded root set and auto-clear behavior.

### Fixed
- Root auto-pivot is one-way per session; returning to `orchestrator` is manual.
- Child pre-route now consults root identity, avoiding the previous stale-flag race.

### Internal
- Superseded by final public docs in v1.6.0.

## 2026-05-05 — v1.4.0

### Added
- Closed-set restricted-MCP blacklist (`src/config/agent-mcp-blacklist.ts`). `windows-mcp`, `chrome-devtools`, `playwright` are now auto-denied for non-operator agents. Future restricted MCPs require only a single line addition.
- Reserved orchestrator-only skill mechanism (`src/config/orchestrator-only-skills.ts`). `best-of-n-with-judge` and `update-memory` (placeholder) are now exclusive to `orchestrator` and `orchestrator-beta`.
- Per-agent tier policy (`src/cli/agent-tier-policy.ts`). Tier-3 read-only agents default to `* deny` for non-SP skills; tier-1/2 default to `* allow`.
- Tool deny rules in base agent factories (oracle/explorer/librarian/observer read-only; council denies edit/write/bash/todowrite but keeps task for councillor dispatch; fixer/designer deny task only).

### Changed
- Oracle Superpowers allowlist tightened to `systematic-debugging` only. Removed `verification-before-completion` (mismatched: oracle reviews, doesn't claim completion) and `receiving-code-review` (mismatched: oracle gives reviews, doesn't receive them).
- `receiving-code-review` added to `fixer` and `designer` (the actual receivers of code review).
- `simplify` custom skill moved from `oracle` to `fixer` (oracle is read-only post-redesign and cannot land changes).
- Tier-3 markdown agents (oracle*, explorer*, librarian*, scout, validator, gist, wildcard) now deny `write` and `todowrite` in addition to `edit`/`bash`/`task`.

### Removed
- Redundant `windows-mcp`/`chrome-devtools`/`playwright` listings in operator-class jsonc agent `mcps:` arrays. The closed-set blacklist now handles these implicitly.

### Fixed
- Agent-config merge in `src/index.ts` was previously a shallow merge (`{...pluginAgent, ...existing}`) at the agent level, which dropped the plugin-emitted `permission.skill` map for any agent that had a user markdown file with its own `permission:` block. Reserved-skill enforcement therefore silently broke on every variant agent (`*-alpha/beta/gamma/delta`) and every utility agent (`scout`, `validator`, `gist`, `wildcard`). Fixed by introducing `src/utils/merge-agent-config.ts` which deep-merges `permission` and `permission.skill` while keeping all other fields shallow-merged. Verified with a 7-test unit suite plus a live smoke probe where `wildcard` correctly denies `update-memory` after the fix.

### Internal
- Spec: `docs/specs/2026-05-05-permission-redesign.md`
- Plan: `docs/plans/2026-05-05-omo-permission-redesign.md`

## 2026-05-05 — v1.3.0

- Added **Anthropic-aware cooldown tracking** (patch `0005-anthropic-cooldown-tracking.patch`):
  - New module `src/hooks/foreground-fallback/cooldowns.ts` exports:
    - `parseAnthropicCooldown(headers)` — extracts the latest reset epoch from `anthropic-ratelimit-requests-reset` / `anthropic-ratelimit-tokens-reset` / `anthropic-ratelimit-input-tokens-reset` / `anthropic-ratelimit-output-tokens-reset` headers (case-insensitive, malformed values silently skipped, returns null when no recognizable header present)
    - `createCooldownStore({filePath?, nowFn?})` — disk-backed `Map<provider/model, resetEpochMs>` with atomic temp-rename writes; loads + auto-purges expired entries on construction; persists immediately on `set()`
    - `getDefaultCooldownPath()` — `<getConfigDir()>/.omo-slim-cooldowns.json` (hidden)
  - `ForegroundFallbackManager` now accepts an optional `cooldowns` 4th constructor argument (defaults to a disk-backed store):
    - On rate-limit events with response headers, `captureCooldown()` records the affected model's reset time
    - In `tryFallback()`, chain selection prefers untried models that AREN'T currently in cooldown; falls back to "first untried" if every model is cooling (cooldown is a soft hint, not a hard block)
    - New public `getCooldownStore()` accessor for downstream consumers
  - Plugin init in `src/index.ts` now uses the same cooldown store at **startup-time model selection** (in the `effectiveArrays` loop): the first non-cooling model from each agent's chain is chosen as the startup model. This eliminates the ~30s of OpenCode-native exponential-backoff retries against a known-rate-limited model on the first message of every fresh session.
  - 22 new tests across `cooldowns.test.ts` (17 unit) and `index.test.ts` (5 integration). All 138 foreground-fallback plus early-series regression tests passed on the then-current clean OMO Slim basis plus patches 0001+0002+0003+0004+0005.
- Added new snapshots: `src/hooks/foreground-fallback/{index.ts,index.test.ts,cooldowns.ts,cooldowns.test.ts}` (post-0005); updated `src/index.ts` (post-0005).
- Use case: register a model array on the main `orchestrator` agent (e.g. `[opus-4-7, gpt-5.4]`). When Opus's 5-hour rolling quota is exhausted:
  - **Within a session**: first message detects 429 + parses reset header + persists cooldown + replays last user message on gpt-5.4 (zero-wait subsequent turns; opus skipped automatically)
  - **Across sessions / OpenCode restarts**: cooldown survives via `~/.config/opencode/.omo-slim-cooldowns.json`. Next fresh session starts directly on gpt-5.4, bypassing the wasted 30-second retry storm. When Opus's reset time elapses, future sessions resume on Opus normally.
- Configuration: jsonc only. Future model swaps are pure config edits — no rebuild, no patch regeneration. The cooldown machinery is provider/model-id-agnostic; any future Anthropic model automatically gets header parsing.

## 2026-05-05 — v1.2.0

- Added **orchestrator prefix matching** (patch `0004-orchestrator-prefix-matching.patch`):
  - New exported helper `isOrchestratorAgent(name)` in `src/cli/superpowers-policy.ts` returns `true` for any agent name starting with `orchestrator` (literal `orchestrator`, dash-suffix variants like `orchestrator-beta`, no-separator variants like `orchestrator2`).
  - All four hardcoded `agentName === 'orchestrator'` string-equality sites in OMO Slim are generalized to use `isOrchestratorAgent()`:
    - `src/cli/superpowers-policy.ts` `getAllowedSuperpowersSkillsForAgent` — orchestrator-shaped agents get the full superpowers allowlist
    - `src/agents/index.ts` `applyClassification` — orchestrator-shaped agents get `mode = 'primary'` (visible in OpenCode's primary agent picker)
    - `src/index.ts` post-file-tool nudge hook — fires for any orchestrator-shaped session
    - `src/index.ts` chat.system.transform hook — injects the literal orchestrator's bridge prompt into every orchestrator-shaped session, so variants behave identically
  - Use case: define a fallback primary orchestrator (e.g. `orchestrator-beta` on a different model) so users can switch agents from the OpenCode picker when their main orchestrator's model rate-limits, without re-running the entire 5-hour cooldown clock.
  - Permissions, MCPs, and prompts auto-inherit from `applyDefaultPermissions` (custom-agent path) and the runtime hook respectively — no per-variant configuration required beyond `model` + (optional) `mcps`.
  - 5 new tests in `src/cli/superpowers-policy.test.ts` covering literal/dash-suffix/no-separator-suffix matches and negative cases (mid-name `orchestrator` substrings do NOT match).
- Updated `snapshots/oh-my-opencode-slim/src/cli/{superpowers-policy.ts,superpowers-policy.test.ts}`, `src/agents/index.ts` (NEW snapshot — was missing in v1.1.0), and `src/index.ts` to post-0004 state.
- Updated `README.md`, `COMPATIBILITY.md`, `docs/architecture.md`, `docs/install.md`, `docs/verify.md` with patch-0004 install/verify guidance.
- Patch 0004 is **recommended for all installations** (not opt-in like 0003): the change is purely a generalization of an existing string equality and does not alter behavior for the literal `orchestrator` agent. Skip only if you intentionally need orchestrator-shaped names (e.g., `orchestrator-something`) to NOT be treated as orchestrators.

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
