# Install

## Supported setup

Use a direct local Superpowers Lite development checkout as the runtime source.
Keep that one checkout editable; do not pin it, create a second Lite clone, add a
junction or alias, or install upstream Superpowers as a fallback. OMO reads the
configured Lite skills directory only. An absent or invalid directory disables
the bridge overlay; it does not discover stock Superpowers.

This kit supports `oh-my-opencode-slim v1.1.2` on the OMO 1.x line only. OMO 2.x
is unsupported.

## 1. Prepare local paths

Keep local paths private to your machine. In the examples below, replace:

- `<LOCAL_SUPERPOWERS_LITE_PATH>` with the root of your direct Lite development
  checkout.
- `<LOCAL_OMO_SLIM_PATH>` with the patched OMO checkout.
- `<PATCH_KIT_PATH>` with this patch-kit checkout.

The Lite plugin path is:

```text
<LOCAL_SUPERPOWERS_LITE_PATH>/.opencode/plugins/superpowers.js
```

The Lite skills directory is:

```text
<LOCAL_SUPERPOWERS_LITE_PATH>/skills
```

## 2. Build the OMO checkout

Clone upstream OMO and select the supported tag:

```bash
git clone https://github.com/alvinunreal/oh-my-opencode-slim.git
cd oh-my-opencode-slim
git checkout v1.1.2
```

Apply the published patches in this exact order:

```bash
git apply <PATCH_KIT_PATH>/patches/oh-my-opencode-slim/v1.1.2/0001-superpowers-bridge-rollup.patch
git apply <PATCH_KIT_PATH>/patches/oh-my-opencode-slim/v1.1.2/0002-auto-continue-agent-model-preservation.patch
bun install
bun run build
```

Do not apply the historical top-level `0001`-`0007` chain in addition to this
pair. The v1.1.2 snapshot is a partial comparison aid, not a runnable checkout.

## 3. Merge configuration

Back up your existing OpenCode configuration. Merge, rather than replace,
`config-templates/opencode.plugin-snippet.jsonc` into `opencode.json` and
`config-templates/oh-my-opencode-slim.superpowers-bridge.jsonc` into your OMO
configuration.

Replace both placeholders in the plugin template. Its plugin list must contain
only the local Lite plugin followed by the local OMO plugin. Set the top-level
`superpowersSkillsDir` field to the Lite `skills` directory. Preserve unrelated
plugins, MCPs, providers, models, and agent settings.

No upstream Superpowers Git specification, stock path, junction, or compatibility
alias is part of this setup.

## 4. Install prompt bridges

The rollup does not embed the prompt bridges. Before fresh-process validation,
copy all eight `prompt-bridges/*_append.md` files into:

```text
<OPENCODE_CONFIG_DIR>/oh-my-opencode-slim/superpowers-bridge/
```

The required files are `council_append.md`, `designer_append.md`,
`explorer_append.md`, `fixer_append.md`, `librarian_append.md`,
`observer_append.md`, `oracle_append.md`, and `orchestrator_append.md`.

Windows PowerShell:

```powershell
$kit = "<PATCH_KIT_PATH>"
$configRoot = "<OPENCODE_CONFIG_DIR>"
$destination = Join-Path $configRoot "oh-my-opencode-slim\superpowers-bridge"
New-Item -ItemType Directory -Force -Path $destination | Out-Null
Copy-Item -Path (Join-Path $kit "prompt-bridges\*_append.md") -Destination $destination -Force
```

POSIX shell:

```bash
mkdir -p "<OPENCODE_CONFIG_DIR>/oh-my-opencode-slim/superpowers-bridge"
cp "<PATCH_KIT_PATH>/prompt-bridges/"*_append.md \
  "<OPENCODE_CONFIG_DIR>/oh-my-opencode-slim/superpowers-bridge/"
```

## 5. Start fresh and verify

Start a fresh OpenCode process after changing the local Lite checkout, OMO source,
or either configuration file. Existing processes retain the plugin code they
already loaded. Follow [`verify.md`](./verify.md) for semantic readback.

## Lite consumer scope

Superpowers Lite supports Claude Code, Cursor, Copilot CLI, Codex CLI/App, Kimi,
OpenCode, Pi, Antigravity, and Factory-compatible consumers. Gemini is
end-of-life and unsupported.
