# Install

## Primary installation path

If you are reading this on GitHub, tell OpenCode: Fetch and follow instructions from https://github.com/BB-84C/omo-slim-superpowers-patch-kit/blob/main/docs/install.md

## Prerequisites

- OpenCode is already installed
- `superpowers` is installed or can be installed
- `oh-my-opencode-slim` is available locally or can be cloned locally
- Your versions are not significantly older than:
  - `superpowers v5.0.7`
  - `oh-my-opencode-slim v1.0.1`

## Agentic install workflow

Ask your OpenCode agent to:

1. locate or clone a local editable checkout of `oh-my-opencode-slim`
2. check out upstream tag `v1.0.1`
3. apply both patch files from `patches/oh-my-opencode-slim/`
4. run `bun install`
5. run `bun run build`
6. only after the build succeeds, point OpenCode at that local checkout path
7. copy the files from `prompt-bridges/` into `~/.config/opencode/oh-my-opencode-slim/superpowers-bridge/`
8. merge the config templates from `config-templates/` into your existing config
9. update your `opencode.json` plugin list without overwriting your existing MCPs
10. verify the resulting setup using `docs/verify.md`

Before you merge anything, back up your current `opencode.json` changes and your existing `oh-my-opencode-slim.jsonc` so you can restore them if needed.

## Manual install workflow

Your OMO Slim config file normally lives at `~/.config/opencode/oh-my-opencode-slim.jsonc`.

When you merge `config-templates/opencode.plugin-snippet.jsonc`, replace `<LOCAL_OMO_SLIM_PATH>` with the real absolute path to your local patched-and-built `oh-my-opencode-slim` checkout. Use the path as an OpenCode plugin string, for example:

- Windows: `C:\\path\\to\\oh-my-opencode-slim`
- macOS/Linux: `/path/to/oh-my-opencode-slim`

That snippet intentionally disables the default OpenCode `general` and `explore` lanes so the patched OMO Slim/Superpowers stack controls the worker layout instead.

1. Clone the upstream OMO Slim repo and check out the validated version basis:

   ```bash
   git clone https://github.com/alvinunreal/oh-my-opencode-slim.git
   cd oh-my-opencode-slim
   git checkout v1.0.1
   ```

2. Apply both publication patch files from this repo:

   ```bash
   git apply /absolute/path/to/omo-slim-superpowers-patch-kit/patches/oh-my-opencode-slim/0001-superpowers-skill-gating.patch
   git apply /absolute/path/to/omo-slim-superpowers-patch-kit/patches/oh-my-opencode-slim/0002-omo-managed-mcp-gating.patch
   ```

3. If patch hunks fail, compare the affected files against `snapshots/` and port the changes manually.

4. Install dependencies in that local checkout:

   ```bash
   bun install
   ```

5. Build the patched local checkout before wiring it into OpenCode:

   ```bash
   bun run build
   ```

6. Only after step 5 succeeds, copy `prompt-bridges/*.md` to `~/.config/opencode/oh-my-opencode-slim/superpowers-bridge/`.
7. Merge `config-templates/oh-my-opencode-slim.superpowers-bridge.jsonc` into your existing OMO Slim config at `~/.config/opencode/oh-my-opencode-slim.jsonc`.
8. Merge `config-templates/opencode.plugin-snippet.jsonc` into your existing `opencode.json`, replacing `<LOCAL_OMO_SLIM_PATH>` with your real local patched-and-built checkout path.
9. Restart OpenCode.
10. Follow `docs/verify.md`.

Before step 6 or 7, back up any existing `opencode.json` edits and your current `oh-my-opencode-slim.jsonc`.

## Important merge rule

Do not replace your existing MCP block wholesale. Preserve your own MCPs and other plugins.

This kit is designed to restrict only:

- `superpowers` skills
- OMO-managed built-in MCPs (`websearch`, `context7`, `grep_app`)

## If your version differs

If patch application fails cleanly, compare the modified target files against `snapshots/` and port the changes manually.
