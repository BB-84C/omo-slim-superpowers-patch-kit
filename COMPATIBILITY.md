# Compatibility

## Validated OMO basis

This kit supports `oh-my-opencode-slim v1.1.2` on the OMO 1.x line only. OMO 2.x
is unsupported.

Start from upstream v1.1.2 and apply these patches in order:

```text
patches/oh-my-opencode-slim/v1.1.2/0001-superpowers-bridge-rollup.patch
patches/oh-my-opencode-slim/v1.1.2/0002-auto-continue-agent-model-preservation.patch
```

The top-level `0001`-`0007` files and the v1.0.7 rollup are historical reference
material, not the current installation path.

## Superpowers Lite runtime

Use one direct local Superpowers Lite development checkout. It is the supported
runtime source; no commit pin, second clone, junction, alias, stock path, or
automatic upstream fallback is needed. Configure OMO's top-level
`superpowersSkillsDir` to that checkout's `skills` directory. If the path is
absent or unreadable, OMO disables the overlay instead of discovering upstream
Superpowers.

Lite supports Claude Code, Cursor, Copilot CLI, Codex CLI/App, Kimi, OpenCode,
Pi, Antigravity, and Factory-compatible consumers. Gemini is end-of-life and
unsupported.

Local Lite edits take effect after a fresh OpenCode process starts; an already
running process does not reload plugins automatically.

## Nearby versions

Other OMO versions are unvalidated. If the patches do not apply, compare the
affected files against the versioned snapshot before porting the change. The
snapshot is partial and is not a runnable checkout.
