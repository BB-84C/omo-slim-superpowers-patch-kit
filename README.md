# OMO Slim + Superpowers Lite Patch Kit

This patch kit prepares a local `oh-my-opencode-slim` v1.1.2 checkout to use a
direct local Superpowers Lite development checkout in OpenCode.

## Supported basis

- OMO Slim: `v1.1.2` on the 1.x line only. OMO 2.x is unsupported.
- Superpowers runtime: a local Superpowers Lite development checkout. It is not
  pinned, copied into a second checkout, or replaced by a stock installation.
- Supported Lite consumers: Claude Code, Cursor, Copilot CLI, Codex CLI/App,
  Kimi, OpenCode, Pi, Antigravity, and Factory-compatible consumers.
- Gemini is end-of-life and unsupported.

The active plugin order is local Lite first, then local OMO. Use the placeholders
in `config-templates/opencode.plugin-snippet.jsonc`; do not put machine-specific
paths in a shared configuration.

## Install path

1. Keep one editable local Superpowers Lite checkout and use it directly.
2. Clone upstream `oh-my-opencode-slim`, check out `v1.1.2`, and apply:

   ```text
   patches/oh-my-opencode-slim/v1.1.2/0001-superpowers-bridge-rollup.patch
   patches/oh-my-opencode-slim/v1.1.2/0002-auto-continue-agent-model-preservation.patch
   ```

   Apply them in that order.
3. Build the patched OMO checkout and merge both configuration templates without
   overwriting unrelated settings.
4. Copy all eight `prompt-bridges/*_append.md` files into the OMO
   `superpowers-bridge` preset directory. See the
   [prompt-bridge install step](./docs/install.md#4-install-prompt-bridges).
5. Start a fresh OpenCode process before checking the result. Existing processes
   retain loaded plugin code.

There is no junction, alias, second Lite clone, or automatic stock-Superpowers
fallback. OMO reads only the configured `superpowersSkillsDir`; when it is absent
or unavailable, the bridge overlay is disabled rather than discovering upstream
Superpowers.

See [`docs/install.md`](./docs/install.md) for the complete sequence and
[`docs/verify.md`](./docs/verify.md) for readback checks.

## What the rollup changes

The v1.1.2 rollup carries the established OMO bridge behavior and the explicit
`superpowersSkillsDir` configuration field. The separate second patch preserves a
selected orchestrator variant and model across auto-continue. The verified slim
target intentionally omits upstream-only divoom, TUI, doctor CLI, and
task-session-manager surfaces.

The top-level `0001`-`0007` patch files are historical provenance only. Do not
apply them in addition to the v1.1.2 pair.

## Snapshot

`snapshots/oh-my-opencode-slim/v1.1.2/` is a partial comparison aid, not a
runnable checkout or install artifact. Use an upstream v1.1.2 clone plus the two
versioned patches for installation.

## Scope

This repository does not manage credentials, auth, session data, or unrelated
MCP configuration. It also does not install or silently locate upstream
Superpowers.

See [`UPSTREAM.md`](./UPSTREAM.md) and
[`UPSTREAM-LICENSE-oh-my-opencode-slim.txt`](./UPSTREAM-LICENSE-oh-my-opencode-slim.txt)
for upstream notices.
