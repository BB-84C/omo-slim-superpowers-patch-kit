# Install

> [!IMPORTANT]
> **Do not stop after patching/building the local `oh-my-opencode-slim` checkout.**
> The runtime behavior in OpenCode comes from your live OMO Slim config too, so you must merge `config-templates/oh-my-opencode-slim.superpowers-bridge.jsonc` into `~/.config/opencode/oh-my-opencode-slim.jsonc`.
> If you skip that merge, OpenCode can keep running your old preset even though the patched plugin source built successfully.

## Prerequisites

- OpenCode is already installed.
- `superpowers` is installed or can be installed.
- `oh-my-opencode-slim` is available locally or can be cloned locally.
- This patch-kit repo has been cloned or downloaded locally.
- Validated basis: `oh-my-opencode-slim v1.0.7` and `superpowers v5.1.0`.

Back up your current `opencode.json` and `oh-my-opencode-slim.jsonc` before merging templates.

## Step 1: clone or download this patch-kit

Fresh installs start with a local copy of this repository. Clone it, or download and extract the ZIP, before using any `/absolute/path/to/omo-slim-superpowers-patch-kit/...` examples below.

```bash
git clone https://github.com/BB-84C/omo-slim-superpowers-patch-kit.git
cd omo-slim-superpowers-patch-kit
```

In the commands below, replace `/absolute/path/to/omo-slim-superpowers-patch-kit` with the absolute path to that local patch-kit checkout or extracted directory.

## Critical note before you start

### TL;DR

You need **both** of these:

1. a patched-and-built local `oh-my-opencode-slim` source checkout;
2. a merged live runtime config at `~/.config/opencode/oh-my-opencode-slim.jsonc`.

If either half is missing, the install is incomplete.

Patching the local `oh-my-opencode-slim` source tree does **not** automatically update the OMO Slim preset that OpenCode loads at runtime.

You must merge:

- `config-templates/oh-my-opencode-slim.superpowers-bridge.jsonc`

into:

- `~/.config/opencode/oh-my-opencode-slim.jsonc`

If you do not do this, OpenCode may still be running your previous preset even though the patched plugin source builds successfully.

## Agentic install workflow

Ask your OpenCode agent to:

1. clone or download this patch-kit repo locally
2. locate or clone a local editable checkout of `oh-my-opencode-slim`
3. check out upstream tag `v1.0.7`
4. apply the default fresh-install rollup patch: `patches/oh-my-opencode-slim/v1.0.7/0001-superpowers-bridge-rollup.patch`
5. run `bun install`
6. run `bun run build`
7. point OpenCode at that local checkout only after the build succeeds
8. copy `prompt-bridges/` into `~/.config/opencode/oh-my-opencode-slim/superpowers-bridge/`
9. merge config templates — especially `config-templates/oh-my-opencode-slim.superpowers-bridge.jsonc` into `~/.config/opencode/oh-my-opencode-slim.jsonc` — without overwriting existing MCPs
10. restart OpenCode
11. verify with `docs/verify.md`

## Manual install workflow

Start from the local patch-kit checkout or extracted ZIP created in Step 1. Then clone the upstream OMO Slim source separately:

```bash
git clone https://github.com/alvinunreal/oh-my-opencode-slim.git
cd oh-my-opencode-slim
git checkout v1.0.7
```

Apply the default `v1.0.7` rollup patch:

```bash
git apply /absolute/path/to/omo-slim-superpowers-patch-kit/patches/oh-my-opencode-slim/v1.0.7/0001-superpowers-bridge-rollup.patch
```

Do not also apply the old top-level `0001`–`0007` patch chain. That split sequence is retained as legacy/historical material for review and archaeology, not as the default fresh-install path.

The rollup is not a pure additive overlay on every upstream v1.0.7 surface. It
matches the validated slim target, which intentionally omits upstream-only
surfaces that were not carried forward for this release path: the separate TUI
companion package surface, Divoom display integration, the `doctor` diagnostic
CLI surface, and task-session-manager hook/docs. Fresh installs should not add a
missing TUI plugin to `tui.json`; configure only the patched plugin entry in
`opencode.json`.

Install and build:

```bash
bun install
bun run build
```

The rollup includes the legacy patch-0007 build cleanup, so `bun run build` cleans `dist/` first.

Legacy note: in the old split patch chain, patch 0003 was safe even if you did not copy the optional best-of-N example setup; it only generalized policy resolution and added utility policy entries. Fresh installs should use the rollup patch instead of replaying that chain.

Then:

1. Copy `prompt-bridges/*.md` to `~/.config/opencode/oh-my-opencode-slim/superpowers-bridge/`.
2. Merge `config-templates/oh-my-opencode-slim.superpowers-bridge.jsonc` into `~/.config/opencode/oh-my-opencode-slim.jsonc`.
   - This is the step that actually switches your runtime OMO Slim preset/config to the published worker layout.
   - If you only patch source and skip this merge, your old preset can stay active.
3. Merge `config-templates/opencode.plugin-snippet.jsonc` into `opencode.json`, replacing `<LOCAL_OMO_SLIM_PATH>` with the patched checkout path.
4. Restart OpenCode.
5. Follow `docs/verify.md`.

## Important merge rule

Do not replace your existing MCP block wholesale. Preserve your own MCPs and other plugins.

## Optional best-of-N setup

Copy optional example files if you want the maintainer's best-of-N setup:

```bash
cp -r /absolute/path/to/omo-slim-superpowers-patch-kit/opencode-config/agents/* ~/.config/opencode/agents/
cp -r /absolute/path/to/omo-slim-superpowers-patch-kit/opencode-config/prompts/* ~/.config/opencode/prompts/
cp -r /absolute/path/to/omo-slim-superpowers-patch-kit/opencode-config/skills/best-of-n-with-judge ~/.config/opencode/skills/
```

On Windows, use `Copy-Item -Recurse` with equivalent paths.

## Root orchestrators

The final template includes:

- `orchestrator`: Anthropic-primary root and only automatic pivot source.
- `orchestrator-beta`: automatic GPT fallback target and only fallback-enforcing root.
- `orchestrator-delta`: manual GPT root with no child fallback enforcement.

Future model swaps are config-only: edit `~/.config/opencode/oh-my-opencode-slim.jsonc`, save, rebuild only if source patches changed, and restart OpenCode.

## If your version differs

If patch application fails, compare the affected files against `snapshots/` and port the changes manually.
