# OMO Slim + Superpowers Patch Kit

A third-party patch kit for patching a local editable `oh-my-opencode-slim` checkout so it cooperates cleanly with `superpowers` in OpenCode.

See [`UPSTREAM.md`](./UPSTREAM.md) and [`UPSTREAM-LICENSE-oh-my-opencode-slim.txt`](./UPSTREAM-LICENSE-oh-my-opencode-slim.txt) for upstream source and license notes.

## Quick start

Tell OpenCode: Fetch and follow instructions from https://github.com/BB-84C/omo-slim-superpowers-patch-kit/blob/main/docs/install.md

## Most common installation miss

Patching the `oh-my-opencode-slim` source checkout is **not** enough by itself.

You must also merge this repo's OMO Slim config template into your live user config:

- source: `config-templates/oh-my-opencode-slim.superpowers-bridge.jsonc`
- target: `~/.config/opencode/oh-my-opencode-slim.jsonc`

If you skip that merge, OpenCode keeps using your old OMO Slim preset and you will not actually get the published orchestrator/fallback behavior.

## What this repo does

This kit is for users who want:

- `superpowers` to remain the workflow/controller layer
- `oh-my-opencode-slim` to provide specialist agents and per-agent model routing
- only `superpowers` skills and OMO-managed MCPs to be selectively restricted
- custom skills and custom MCPs left untouched
- an automatic retry pivot from `orchestrator` to `orchestrator-beta`
- a manual GPT root, `orchestrator-delta`, without beta fallback semantics

## Tested versions

Validated with:

- `superpowers v5.0.7`
- `oh-my-opencode-slim v1.0.1`

## What this kit patches

This patch kit changes OMO Slim in seven ways:

1. **Superpowers-only skill gating** (0001): restricts only Superpowers skills.
2. **OMO-managed MCP-only gating** (0002): restricts only OMO built-ins (`websearch`, `context7`, `grep_app`).
3. **Best-of-N agent name resolution** (0003): variants like `fixer-alpha` inherit base policy by suffix stripping.
4. **Orchestrator prefix matching** (0004): `orchestrator-*` roots inherit primary-mode prompt and root posture.
5. **Anthropic-aware cooldown tracking** (0005): persists reset-header cooldowns and skips cooling models.
6. **Agent permission redesign** (0006): enforces read-only tier-3 agents, restricted MCP blacklist, reserved root-only skills, and deep permission merges.
7. **Final orchestrator pivot cleanup** (0007): makes beta the only automatic pivot/fallback-enforcing root, adds manual-only delta, removes debug/degraded knobs, and cleans `dist/` before build.

Important final behavior:

- Automatic retry pivot is exactly `orchestrator` -> `orchestrator-beta`.
- `orchestrator-beta` is the only root identity that forces Anthropic-primary child tasks onto `__task_fallback` shadows.
- `orchestrator-delta` is manual-only and does not force child fallback.
- Reserved orchestrator-only skills include `orchestrator`, `orchestrator-beta`, and `orchestrator-delta`.
- Forced degraded override and debug retry probe commands are not supported public knobs.

## Optional: Best-of-N + Fast-Lane example setup

The optional `opencode-config/` subtree demonstrates the maintainer's setup:

- 16 variant agents for parallel candidate generation and review
- 4 utility agents (`scout`, `validator`, `gist`, `wildcard`)
- `orchestrator-beta` as the automatic pivot target
- `orchestrator-delta` as a manual GPT root
- `best-of-n-with-judge` orchestration skill

## What this kit does NOT do

- It does not replace Superpowers with OMO Slim.
- It does not turn OMO Slim into the workflow controller.
- It does not replace OpenCode itself.
- It does not manage auth, secrets, or session data.
- It does not overwrite existing MCP blocks unless you choose to merge that manually.
- It does not publish temporary debug/probe commands as supported controls.

## Repository layout

- `patches/` — patch files to apply against upstream OMO Slim
- `snapshots/` — validated modified source files for manual comparison
- `config-templates/` — template configs based on the maintainer profile
- `prompt-bridges/` — per-agent append prompts for Superpowers-aware behavior
- `opencode-config/` — optional example user config
- `docs/` — install, verify, rollback, architecture, specs, and plans

## Verification checklist

After installation, verify:

- Superpowers bootstrap is active.
- `orchestrator`, `orchestrator-beta`, `orchestrator-delta`, and specialist worker agents are available.
- Non-root agents cannot access reserved root-only skills.
- Custom MCPs still work where intended.
- `orchestrator` retry pivots to `orchestrator-beta`.
- `orchestrator-beta` forces Claude-primary child fallback; `orchestrator-delta` does not.
- `bun run build` removes stale deleted `dist/` artifacts.

See `docs/verify.md` for detailed probes.

## Rollback

If you want to undo this integration:

1. remove the patched OMO Slim plugin entry from `opencode.json`
2. restore your previous `oh-my-opencode-slim.jsonc`
3. remove the prompt bridge files
4. optionally delete the local patched OMO Slim checkout

See `docs/rollback.md` for the detailed checklist.
