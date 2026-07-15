# Upstream notice

This is a third-party patch kit that redistributes selected modified source
snapshots and patch files for `oh-my-opencode-slim`.

- Upstream project: https://github.com/alvinunreal/oh-my-opencode-slim
- Upstream basis: `v1.1.2` on OMO 1.x only; OMO 2.x is unsupported.
- Current install sequence:
  1. `patches/oh-my-opencode-slim/v1.1.2/0001-superpowers-bridge-rollup.patch`
  2. `patches/oh-my-opencode-slim/v1.1.2/0002-auto-continue-agent-model-preservation.patch`
- Included upstream MIT license: [`UPSTREAM-LICENSE-oh-my-opencode-slim.txt`](./UPSTREAM-LICENSE-oh-my-opencode-slim.txt)

The Superpowers runtime is a direct local Superpowers Lite development checkout,
not an upstream Git installation or an automatic discovery target. The local
checkout is intentionally unpinned and needs no second clone, junction, alias,
or stock fallback. Its edits appear after a fresh OpenCode process starts.

Lite supports Claude Code, Cursor, Copilot CLI, Codex CLI/App, Kimi, OpenCode,
Pi, Antigravity, and Factory-compatible consumers. Gemini is end-of-life and
unsupported.

The older top-level `0001`-`0007` patch chain and v1.0.7 rollup are retained as
historical provenance, not current install instructions.

Users should review the upstream licensing terms before reusing or redistributing
upstream-derived material. This repository does not claim affiliation with or
maintenance authority over the upstream project.
