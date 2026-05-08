# Install

## Prerequisites

- OpenCode is already installed.
- `superpowers` is installed or can be installed.
- `oh-my-opencode-slim` is available locally or can be cloned locally.
- Validated basis: `oh-my-opencode-slim v1.0.1` and `superpowers v5.0.7`.

Back up your current `opencode.json` and `oh-my-opencode-slim.jsonc` before merging templates.

## Critical note before you start

Patching the local `oh-my-opencode-slim` source tree does **not** automatically update the OMO Slim preset that OpenCode loads at runtime.

You must merge:

- `config-templates/oh-my-opencode-slim.superpowers-bridge.jsonc`

into:

- `~/.config/opencode/oh-my-opencode-slim.jsonc`

If you do not do this, OpenCode may still be running your previous preset even though the patched plugin source builds successfully.

## Agentic install workflow

Ask your OpenCode agent to:

1. locate or clone a local editable checkout of `oh-my-opencode-slim`
2. check out upstream tag `v1.0.1`
3. apply patch files from `patches/oh-my-opencode-slim/` in numeric order
4. run `bun install`
5. run `bun run build`
6. point OpenCode at that local checkout only after the build succeeds
7. copy `prompt-bridges/` into `~/.config/opencode/oh-my-opencode-slim/superpowers-bridge/`
8. merge config templates — especially `config-templates/oh-my-opencode-slim.superpowers-bridge.jsonc` into `~/.config/opencode/oh-my-opencode-slim.jsonc` — without overwriting existing MCPs
9. restart OpenCode
10. verify with `docs/verify.md`

## Manual install workflow

```bash
git clone https://github.com/alvinunreal/oh-my-opencode-slim.git
cd oh-my-opencode-slim
git checkout v1.0.1
```

Apply patches in numeric order:

```bash
git apply /absolute/path/to/omo-slim-superpowers-patch-kit/patches/oh-my-opencode-slim/0001-superpowers-skill-gating.patch
git apply /absolute/path/to/omo-slim-superpowers-patch-kit/patches/oh-my-opencode-slim/0002-omo-managed-mcp-gating.patch
git apply /absolute/path/to/omo-slim-superpowers-patch-kit/patches/oh-my-opencode-slim/0003-best-of-n-agent-name-resolution.patch
git apply /absolute/path/to/omo-slim-superpowers-patch-kit/patches/oh-my-opencode-slim/0004-orchestrator-prefix-matching.patch
git apply /absolute/path/to/omo-slim-superpowers-patch-kit/patches/oh-my-opencode-slim/0005-anthropic-cooldown-tracking.patch
git apply /absolute/path/to/omo-slim-superpowers-patch-kit/patches/oh-my-opencode-slim/0006-permission-redesign.patch
git apply /absolute/path/to/omo-slim-superpowers-patch-kit/patches/oh-my-opencode-slim/0007-final-orchestrator-pivot-cleanup.patch
```

Patch 0003 is safe even if you do not copy the optional best-of-N example setup; it only generalizes policy resolution and adds utility policy entries.

Install and build:

```bash
bun install
bun run build
```

Patch 0007 makes `bun run build` clean `dist/` first.

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
