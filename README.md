# OMO Slim + Superpowers Patch Kit

A third-party patch kit for patching a local editable `oh-my-opencode-slim` checkout so it cooperates cleanly with `superpowers` in OpenCode.

See [`UPSTREAM.md`](./UPSTREAM.md) and [`UPSTREAM-LICENSE-oh-my-opencode-slim.txt`](./UPSTREAM-LICENSE-oh-my-opencode-slim.txt) for upstream source and license notes.

## Quick start

Fresh users should first clone or download this patch-kit repo so all later path examples have a real local base directory:

```bash
git clone https://github.com/BB-84C/omo-slim-superpowers-patch-kit.git
cd omo-slim-superpowers-patch-kit
```

Then tell OpenCode: Follow the instructions in `docs/install.md` from this local patch-kit checkout.

The default fresh-install patch for `oh-my-opencode-slim v1.0.7` is:

```text
patches/oh-my-opencode-slim/v1.0.7/0001-superpowers-bridge-rollup.patch
```

The older top-level `0001`–`0007` patch chain is retained as legacy/historical reference material only; new installs should use the versioned rollup patch above.

> [!IMPORTANT]
> **If you only patch/build the local `oh-my-opencode-slim` checkout, the install is still incomplete.**
> You must also merge `config-templates/oh-my-opencode-slim.superpowers-bridge.jsonc` into your live `~/.config/opencode/oh-my-opencode-slim.jsonc`, or OpenCode may keep using your old OMO Slim preset and none of the published orchestrator/fallback behavior will actually show up at runtime.

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
- `superpowers` skills to be selectively restricted, with reserved root-only skills kept on orchestrator lanes
- OMO-managed MCPs and the documented restricted-MCP blacklist to apply without clobbering unrelated custom MCPs
- non-Superpowers/custom skills to continue following the plugin's tier policy rather than a blanket global deny
- an automatic retry pivot from `orchestrator` to `orchestrator-beta`
- a manual GPT root, `orchestrator-delta`, without beta fallback semantics

## Tested versions

Validated with:

- `superpowers v5.1.0`
- `oh-my-opencode-slim v1.0.7`

## What this kit patches

The default `v1.0.7` rollup patch starts from upstream OMO Slim v1.0.7 and
lands the seven Superpowers bridge changes below. It also intentionally keeps
the validated slim target pruned of upstream-only v1.0.7 surfaces that are not
part of this release path: the separate TUI companion package surface, Divoom
display integration, the `doctor` diagnostic CLI surface, and the
task-session-manager hook/docs.

The seven bridge changes are:

1. **Superpowers-only skill gating**: restricts only Superpowers skills.
2. **OMO-managed MCP-only gating**: restricts only OMO built-ins (`websearch`, `context7`, `grep_app`).
3. **Best-of-N agent name resolution**: variants like `fixer-alpha` inherit base policy by suffix stripping.
4. **Orchestrator prefix matching**: `orchestrator-*` roots inherit primary-mode prompt and root posture.
5. **Anthropic-aware cooldown tracking**: persists reset-header cooldowns and skips cooling models.
6. **Agent permission redesign**: enforces read-only tier-3 agents, restricted MCP blacklist, reserved root-only skills, and deep permission merges.
7. **Final orchestrator pivot cleanup**: makes beta the only automatic pivot/fallback-enforcing root, adds manual-only delta, removes debug/degraded knobs, and cleans `dist/` before build.

Legacy note: the old split patch files `0001`–`0007` remain in the repository to show the historical change sequence, but they are not the default fresh-install path and should not be applied in addition to the `v1.0.7` rollup.

Important final behavior:

- Automatic retry pivot is exactly `orchestrator` -> `orchestrator-beta`.
- `orchestrator-beta` is the only root identity that forces Anthropic-primary child tasks onto `__task_fallback` shadows.
- `orchestrator-delta` is manual-only and does not force child fallback.
- Reserved orchestrator-only skill access is limited to `orchestrator`, `orchestrator-beta`, and `orchestrator-delta`.
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
