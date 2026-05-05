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

2. Apply the publication patch files from this repo:

   ```bash
   git apply /absolute/path/to/omo-slim-superpowers-patch-kit/patches/oh-my-opencode-slim/0001-superpowers-skill-gating.patch
   git apply /absolute/path/to/omo-slim-superpowers-patch-kit/patches/oh-my-opencode-slim/0002-omo-managed-mcp-gating.patch
   ```

   Recommended — apply patch 0004 to enable orchestrator-prefix-matching (lets you define `orchestrator-beta` and similar fallback primary orchestrators):

   ```bash
   git apply /absolute/path/to/omo-slim-superpowers-patch-kit/patches/oh-my-opencode-slim/0004-orchestrator-prefix-matching.patch
   ```

   Recommended — apply patch 0005 to enable Anthropic-aware cooldown tracking (eliminates the ~30s retry storm against rate-limited models on fresh sessions when using model-array fallback chains):

   ```bash
   git apply /absolute/path/to/omo-slim-superpowers-patch-kit/patches/oh-my-opencode-slim/0005-anthropic-cooldown-tracking.patch
   ```

   Optional — apply patch 0003 ONLY if you intend to install the best-of-N + fast-lane example setup from `opencode-config/`:

   ```bash
   git apply /absolute/path/to/omo-slim-superpowers-patch-kit/patches/oh-my-opencode-slim/0003-best-of-n-agent-name-resolution.patch
   ```

   Note: apply patches in numeric order (0001 → 0002 → 0003 → 0004 → 0005). Each later patch may depend on earlier ones being in place.

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

## Optional: install the best-of-N + fast-lane example setup

If you applied patch 0003 in step 2 above, you can also install the example best-of-N + fast-lane configuration from `opencode-config/`:

1. Copy agent markdown files:

   ```bash
   cp -r /absolute/path/to/omo-slim-superpowers-patch-kit/opencode-config/agents/* ~/.config/opencode/agents/
   cp -r /absolute/path/to/omo-slim-superpowers-patch-kit/opencode-config/prompts/* ~/.config/opencode/prompts/
   cp -r /absolute/path/to/omo-slim-superpowers-patch-kit/opencode-config/skills/best-of-n-with-judge ~/.config/opencode/skills/
   ```

   On Windows: `Copy-Item -Recurse` with the equivalent paths.

2. Merge the 20 new agent entries from the updated `config-templates/oh-my-opencode-slim.superpowers-bridge.jsonc` into your existing OMO Slim config. The new entries are at the bottom of the `presets.superpowers-bridge` block, with `// ============ Best-of-N variant agents (16) ============` and `// ============ Fast-lane utility agents (4) ============` separators.

3. Rebuild your patched local OMO Slim checkout (`bun run build`) so patch 0003's source changes take effect.

4. Restart OpenCode.

5. Optional: review the design and implementation plan docs at `opencode-config/docs/plans/` for the maintainer's full reasoning behind the variant assignments and skill design.

The 20 new agents will be discovered by OMO Slim's `getCustomAgentNames()` mechanism (same code path as `laborer`). Variant agents inherit base superpowers via patch 0003's `resolveBaseAgentName()`. Markdown files at `~/.config/opencode/agents/` carry `hidden`/`permission`/`mode` (OpenCode-native fields OMO Slim does not manage).

## Optional: register a fallback orchestrator (requires patch 0004)

If you applied patch 0004, you can register additional primary orchestrators that mirror the main `orchestrator` behavior with a different model. This is useful for surviving 5-hour rolling rate limits without abandoning the session.

Add to your `oh-my-opencode-slim.jsonc` under `presets.superpowers-bridge`:

```jsonc
"orchestrator-beta": {
  "model": "openai/gpt-5.4",
  "variant": "xhigh",
  "mcps": ["*", "!context7"]
}
```

After restart, `orchestrator-beta` appears in the OpenCode agent picker as a primary agent. Switching to it preserves the bridge prompt, MCPs, permissions, and superpowers skill access — only the underlying model differs.

Any agent name starting with `orchestrator` works (e.g. `orchestrator-fallback`, `orchestrator2`). Skip this section if you do not want fallback orchestrators.

## Optional: configure auto-failover with model arrays (requires patch 0005 for best UX)

Even better than manual `orchestrator-beta` switching is configuring the main `orchestrator` agent with a priority-ordered model array. With patch 0005, OMO Slim's `ForegroundFallbackManager` automatically:

1. Detects rate-limit / quota / overload errors mid-session
2. Parses the `anthropic-ratelimit-*-reset` headers (Anthropic) and persists the cooldown across sessions
3. Replays the last user message on the next available model in the chain
4. On fresh sessions during the cooldown window, starts directly on the fallback model (no wasted retry storm)

Example — replace your `orchestrator` entry's single-string `model` with an array:

```jsonc
"orchestrator": {
  "model": [
    { "id": "anthropic/claude-opus-4-7",  "variant": "high"  },
    { "id": "openai/gpt-5.4",             "variant": "xhigh" }
  ],
  "mcps": ["*", "!context7"]
}
```

After restart, the auto-failover is fully automatic. Your only visible change is occasional model-mismatch in the response style when Opus is rate-limited.

**Future model swaps**: edit the array in `~/.config/opencode/oh-my-opencode-slim.jsonc`, save, restart OpenCode. No rebuild, no patch regeneration. The cooldown machinery is provider-agnostic.

The cooldown state file lives at `~/.config/opencode/.omo-slim-cooldowns.json`. It's safe to delete if you want to force-clear all known cooldowns; it'll be regenerated on the next rate-limit event.

## If your version differs

If patch application fails cleanly, compare the modified target files against `snapshots/` and port the changes manually.
