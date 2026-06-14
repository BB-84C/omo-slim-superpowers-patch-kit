# Architecture

## Layers

1. **OpenCode native**: sessions, child sessions, agents, tools, MCP runtime.
2. **OMO Slim**: specialist agents, model routing, prompt bridge behavior.
3. **Superpowers**: workflow/controller layer for design, implementation, review, and verification discipline.

The cooperation model is simple: Superpowers directs the workflow, while OMO Slim provides worker seats and model routing. The plugin snippet disables OpenCode's default `general` and `explore` lanes so they do not compete with the patched worker layout.

## Version basis

The current validated integration basis is `oh-my-opencode-slim v1.1.2` with `superpowers v5.1.0`.

## Permission model

The patch kit governs three resource classes:

- Superpowers skills: restricted by per-agent allowlists.
- OMO-managed MCPs: restricted only for OMO built-ins unless explicitly blacklisted.
- Restricted MCPs: `windows-mcp`, `chrome-devtools`, and `playwright` are denied for non-operator agents.

Key invariants:

- Tier-3 read-only agents deny mutation tools by default.
- `council` keeps `task` only for councillor dispatch.
- Reserved skills (`best-of-n-with-judge`, `update-memory`) are allowed only for `orchestrator`, `orchestrator-beta`, and `orchestrator-delta`.
- Custom MCPs remain untouched unless you add them to the blacklist.

## Orchestrator roots

Patch 0004 makes `orchestrator-*` names inherit root prompt/primary-mode behavior. Patch 0007 separates that prompt inheritance from fallback enforcement.

| Root | Purpose | Automatic pivot source | Automatic pivot target | Enforces Claude child fallback | Reserved root skills |
|---|---|---:|---:|---:|---:|
| `orchestrator` | Anthropic-primary controller | yes | no | no | yes |
| `orchestrator-beta` | automatic GPT fallback root | no | yes | yes | yes |
| `orchestrator-delta` | manual GPT root | no | no | no | yes |

Final pivot invariants:

- Automatic retry pivot is exactly `orchestrator` -> `orchestrator-beta`.
- `orchestrator-beta` is the only fallback-enforcing root identity.
- `orchestrator-delta` is manual-only and does not force child fallback.
- Temporary debug/probe and forced degraded override commands are not part of the public surface.

Full final design: [`docs/specs/2026-05-08-final-orchestrator-pivot-cleanup.md`](specs/2026-05-08-final-orchestrator-pivot-cleanup.md).

## Build cleanliness

Patch 0007 adds `scripts/clean-dist.ts` and changes `bun run build` to run `clean:dist` first. This prevents stale deleted hook or command artifacts from surviving in `dist/` after rebuild.

## Optional Best-of-N support

Patch 0003 adds suffix-stripping policy resolution so variant agents like `fixer-alpha` inherit their base agent policy. The optional `opencode-config/` tree demonstrates 16 variants, 4 utility agents, and the `best-of-n-with-judge` workflow.
