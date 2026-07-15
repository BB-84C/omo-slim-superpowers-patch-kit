# Verify

## Installation readback

Use a fresh OpenCode process. Plugin code and discovered skills are not reloaded
by an already running process.

Confirm all of the following:

- OMO is `v1.1.2` on the supported 1.x line; OMO 2.x is unsupported.
- The OMO checkout received the v1.1.2 `0001-superpowers-bridge-rollup.patch`
  and then `0002-auto-continue-agent-model-preservation.patch`.
- The plugin list starts with the direct local Superpowers Lite plugin, followed
  by the local OMO plugin.
- `superpowersSkillsDir` points to the same local Lite checkout's `skills`
  directory.
- No upstream Superpowers Git plugin, stock path, junction, alias, second Lite
  clone, or automatic fallback is configured.
- `bun install` and `bun run build` completed in the patched OMO checkout.
- Prompt bridges are loaded from
  `<OPENCODE_CONFIG_DIR>/oh-my-opencode-slim/superpowers-bridge/`: the
  `orchestrator` append identifies the `main-session controller`, states that
  one capable agent is the default, and makes multi-perspective and Best-of-N
  use conditional rather than default-on. It also requires consulting a directly
  matching skill before substantial work while allowing relevant guidance to be
  adapted instead of followed step by step. The `fixer` append includes
  `Superpowers implementer worker`.

Run the prompt contract against both the tracked source and installed bridge:

```text
node tests/prompt-bridge-contract.mjs prompt-bridges/orchestrator_append.md <OPENCODE_CONFIG_DIR>/oh-my-opencode-slim/superpowers-bridge/orchestrator_append.md
```

For the complete local instruction stack, also confirm that global topology
memory and the consultation skill do not override the bridge back to default-on
fan-out:

```text
node tests/lite-active-policy-contract.mjs <OPENCODE_CONFIG_DIR>/oh-my-opencode-slim/superpowers-bridge/orchestrator_append.md <OPENCODE_CONFIG_DIR>/memory/50-subagent-topology-and-delegation.md <OPENCODE_CONFIG_DIR>/skills/multi-perspective-consultation/SKILL.md
```

If the configured Lite directory is unavailable, OMO should warn and disable the
bridge overlay. It must not discover a stock Superpowers catalog.

## Skill and agent checks

In the fresh process, confirm that Lite skills are available from the configured
local checkout and that `using-superpowers` remains bootstrap-only. Confirm these
agents are available: `orchestrator`, `orchestrator-beta`, `orchestrator-delta`,
`fixer`, `oracle`, `explorer`, `librarian`, `designer`, `observer`, and `council`.

Check the established policy:

- `@fixer` can use `test-driven-development`, `systematic-debugging`, and
  `verification-before-completion`.
- `@oracle` can use `systematic-debugging` among the listed Lite review/debug
  skills.
- Root orchestrators can use reserved root-only skills; non-root agents cannot.

## Auto-continue readback

Start an `orchestrator-beta` or `orchestrator-delta` session with a temporary
model override, leave one local todo pending, and allow auto-continue to resume.
The resumed session must retain both the active orchestrator variant and selected
model.

## Consumer scope

Lite supports Claude Code, Cursor, Copilot CLI, Codex CLI/App, Kimi, OpenCode,
Pi, Antigravity, and Factory-compatible consumers. Gemini is end-of-life and
unsupported.
