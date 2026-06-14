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

The default fresh-install patch for `oh-my-opencode-slim v1.1.2` is:

```text
patches/oh-my-opencode-slim/v1.1.2/0001-superpowers-bridge-rollup.patch
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
- `oh-my-opencode-slim v1.1.2`

## Compatibility scope: 1.x only, no 2.x support

This patch kit targets the `oh-my-opencode-slim` 1.x line and **does not support 2.x**. The 1.x ceiling is `v1.1.2`. We do not plan to publish a 2.x rollup.

We re-evaluated upstream `v2.0.0` stable (released 2026-06-12) against the harness requirements this kit is designed around. Five operator-facing gaps that we flagged on the `v2.0.0-beta.7` preview are still open in `v2.0.0` stable:

1. **No hung-job detection.** The `BackgroundJobBoard` tracks `running` / `completed` / `error` / `cancelled` / `reconciled` flags, but there is no watchdog, heartbeat, or stale-job sweep. A `timedOut` mark only appears after the orchestrator itself happens to call `task_status` with a timeout; the harness does not surface stuck jobs on its own.
2. **No hard dependency barrier.** Dependency ordering between lanes is documented as advisory and lives in the orchestrator prompt. No runtime primitive prevents a dependent lane from being dispatched before its blocker reaches terminal + reconciled.
3. **No auto-recovery.** Cancellation lifecycle was hardened (`markCancelled(force?)`, stale-state guard), but there is no auto-relaunch when a child session dies or a provider drops.
4. **No TUI parity for background jobs.** `v2.0.0` ships the same flat TUI surface as `v2.0.0-beta.7`; no sidebar, attach-to-running-child surface, or per-job status panel was added. Upstream OpenCode itself is moving the other way: PR [`anomalyco/opencode#28508`](https://github.com/anomalyco/opencode/pull/28508) (merged 2026-05-20) **removed** always-visible subagent tabs in favor of an on-demand picker. Operator visibility issues [`#26062`](https://github.com/anomalyco/opencode/issues/26062), [`#28047`](https://github.com/anomalyco/opencode/pull/28047), [`#28171`](https://github.com/anomalyco/opencode/issues/28171), [`#28738`](https://github.com/anomalyco/opencode/issues/28738), [`#28995`](https://github.com/anomalyco/opencode/issues/28995), [`#27898`](https://github.com/anomalyco/opencode/issues/27898) all remain unresolved.
5. **`task_status` correctness was sidestepped, not fixed.** OMO `v2.0.0` removed `task_status` as a tool ([PR #481](https://github.com/alvinunreal/oh-my-opencode-slim/pull/481) lists "remove task_status" as a goal) and now reconciles via `session.idle` hook events. Upstream OpenCode issue [`#27827`](https://github.com/anomalyco/opencode/issues/27827) (`task_status returns 'cancelled' for completed tasks`) closed without a linked fix; related bug [`#28995`](https://github.com/anomalyco/opencode/issues/28995) reopened the same failure mode.

Two further changes in `v2.0.0` would actively reduce parity with the workflow this kit supports:

- **Auto-continue removed.** `v2.0.0` ships the commit `Remove auto-continue feature`. Auto-continue is core to this kit's orchestrator loop; the variant-recognition fix in this release (see `CHANGELOG.md`) doubles down on it.
- **Background orchestration is now the default**, with the orchestrator reframed as a scheduler rather than the primary worker. That is a different operating model from the worker-with-delegation orchestrator this kit is built around.

### Why we expect v1.1.2 to be the long-term stable 1.x

Structural signals from upstream all point at `v1.1.2` being the de-facto frozen 1.x release:

- No `v1.1.3` tag exists; no v1.x release has shipped since `v1.1.2` (2026-06-08).
- Upstream's `master` branch now contains `v2.x` code.
- The npm `latest` dist-tag points at `2.0.1`; there is no `1.x-lts` dist-tag.
- No `release/1.x` or `1.x-maintenance` branch exists.
- Every open PR upstream targets `master` (v2.x).
- Neither the `v1.1.2` release notes nor the `v2.0.0` README contains a 1.x EOL or LTS declaration; the line is simply not being touched.

Because of that, this kit can stay on `v1.1.2` for the foreseeable future without forcing frequent rollup refreshes. That stability is itself part of why we recommend users stay on the 1.x line until — and only if — the five harness gaps above are concretely closed in a future 2.x release.

## What this kit patches

The default `v1.1.2` rollup patch starts from upstream OMO Slim v1.1.2 and
lands the seven Superpowers bridge changes below. It also carries upstream's
auto-update hardening, session-goal command, subtask worker sessions, and
clonedeps skill. The validated slim target still intentionally prunes divoom,
tui, doctor CLI, and task-session-manager surfaces that are not part of this
release path.

The seven bridge changes are:

1. **Superpowers-only skill gating**: restricts only Superpowers skills.
2. **OMO-managed MCP-only gating**: restricts only OMO built-ins (`websearch`, `context7`, `grep_app`).
3. **Best-of-N agent name resolution**: variants like `fixer-alpha` inherit base policy by suffix stripping.
4. **Orchestrator prefix matching**: `orchestrator-*` roots inherit primary-mode prompt and root posture.
5. **Anthropic-aware cooldown tracking**: persists reset-header cooldowns and skips cooling models.
6. **Agent permission redesign**: enforces read-only tier-3 agents, restricted MCP blacklist, reserved root-only skills, and deep permission merges.
7. **Final orchestrator pivot cleanup**: makes beta the only automatic pivot/fallback-enforcing root, adds manual-only delta, removes debug/degraded knobs, and cleans `dist/` before build.

Legacy note: the old split patch files `0001`–`0007` remain in the repository to show the historical change sequence, but they are not the default fresh-install path and should not be applied in addition to the `v1.1.2` rollup.

Important final behavior:

- Automatic retry pivot is exactly `orchestrator` -> `orchestrator-beta`.
- Auto-continue now recognizes `orchestrator` variants (`orchestrator-beta`, `orchestrator-delta`, etc.), not just the literal `orchestrator`.
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
