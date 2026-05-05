> **Note**: This file is a snapshot of the maintainer's live `~/.config/opencode/README.md`, included here as a reference example for the optional best-of-N + fast-lane setup. It documents the maintainer's specific config (provider names, paths) and is **not an installation target**. Use it as a reference for what a working setup looks like, then adapt the model assignments to your own provider catalog.
>
> Installation steps for the best-of-N + fast-lane setup are in [`../docs/install.md`](../docs/install.md) under "Optional: install the best-of-N + fast-lane example setup".

---

# opencode user config

Personal opencode configuration: plugins, custom agents, skills, prompts.

## Layout

```
.config/opencode/
├── opencode.json                    # core opencode config (plugins, providers, MCPs)
├── oh-my-opencode-slim.jsonc        # omo-slim plugin config (per-agent presets)
├── agents/                          # user-level subagent definitions (markdown)
├── prompts/                         # shared prompt fragments referenced by agents
├── skills/                          # custom skills (best-of-n-with-judge, ...)
├── superpowers/                     # local checkout of obra/superpowers
├── oh-my-opencode-slim/             # omo-slim bridge layer (superpowers integration)
├── oh-my-opencode-slim-local/       # local fork of omo-slim plugin source
├── plugins/                         # custom plugin scripts
├── tools/                           # auxiliary CLI helpers
└── docs/plans/                      # design docs + implementation plans
```

## Best-of-N with Judge

This config installs a `best-of-n-with-judge` skill that adds parallel
candidate generation + blind oracle review + winner selection on top of
the standard superpowers + omo-slim flow.

**Trigger phrases:** "best of N", "fan out", "tournament", "parallel
candidates".

**Variant agents** are pre-registered in `agents/`:
- `fixer-{alpha,beta,gamma}` — code candidate generators (frontier-tier diversity)
- `fixer-delta` — deliberate naive-challenger lane (gpt-5.4-mini) for simple-baseline diversity
- `oracle-{alpha,beta,gamma,delta}` — blind reviewers (4 different models)
- `designer-{alpha,beta,gamma,delta}` — UI candidate generators
- `explorer-{alpha,beta}` — parallel reconnaissance (gpt-5.5 / sonnet, both hot-path competent)
- `librarian-{alpha,beta}` — parallel docs research

**Fast-lane utility agents** (haiku/mini-tier, latency-optimized; not in best-of-N pool):
- `@scout` — narrow file/code lookup ("which file contains X")
- `@validator` — format/syntax check (JSON/YAML/regex)
- `@gist` — 3-line file summarizer
- `@wildcard` — divergent ideation contributor for brainstorming Phase 4 only

**Worktree convention:** candidates land at
`<main-repo>/.worktrees/bestofn-<slug>-<ts>/<variant>/`. Each candidate
gets its own branch `bestofn/<slug>-<ts>/<variant>`. Cleanup is
unconditional. State persists at
`<main-repo>/.opencode/bestofn-state/<task-id>.json` until the fan-out
completes successfully (then deleted).

**Manual cleanup escape hatch** (if a fan-out is interrupted):

```bash
# Discovery
git worktree list | grep bestofn-
git for-each-ref --format='%(refname:short)' refs/heads/bestofn/

# Forced cleanup
for w in $(git worktree list --porcelain | grep -A1 'bestofn-' | grep '^worktree ' | cut -d' ' -f2); do
  git worktree remove --force "$w"
done
for b in $(git for-each-ref --format='%(refname:short)' refs/heads/bestofn/); do
  git branch -D "$b"
done
git worktree prune
rm -rf .worktrees/bestofn-* .opencode/bestofn-state/
```

**Spec & plan:**
- Design: `docs/plans/2026-05-04-best-of-n-with-judge-design.md`
- Plan: `docs/plans/2026-05-04-best-of-n-with-judge-plan.md`

**Variant + utility model assignments** live centrally in
`oh-my-opencode-slim.jsonc` under `presets.superpowers-bridge`. Each
variant + utility agent name (e.g. `fixer-alpha`, `oracle-gamma`,
`scout`, `wildcard`) has one entry specifying `model`, optional
`variant` (reasoning-effort tag), optional `mcps`, and an
`orchestratorPrompt` teaching the orchestrator when to dispatch it.
Edit there to re-tune any agent's model — one file, one source of
truth, same mechanism as the existing `laborer` agent.

The variant md files in `agents/` carry only opencode-native behavioral
contract fields (`permission`, `hidden`, `mode`, `temperature`,
`description`, `prompt` reference). omo-slim does not manage these
fields, so they remain fully under markdown control.

`opencode.json` `agent` block contains only `explore`/`general` disable
entries — no per-variant overrides (which would shallow-replace
omo-slim's synthesized permissions and lose default `skill`/`question`
scaffolding).

Superpowers skill policy auto-inheritance: variant suffix names are
resolved to base agents via `resolveBaseAgentName()` in
`oh-my-opencode-slim-local/src/cli/superpowers-policy.ts` (introduced
by patch 0003 in this patch-kit). So `fixer-alpha` automatically
inherits `fixer`'s allowed superpowers (test-driven-development,
systematic-debugging, verification-before-completion). Utility agents
have explicit policy entries (`validator` gets
verification-before-completion; `scout`/`gist`/`wildcard` get empty
allowed = no superpowers).

**Non-superpowers skills and non-omo MCPs are preserved**: omo-slim's
default skill permission is `*: allow` (overlaid only with specific
superpowers denies), and managed MCP rules touch only
`websearch_*`/`context7_*`/`grep_app_*` — leaving `chrome-devtools`,
`playwright`, `windows-mcp`, `best-of-n-with-judge`,
`inspect-opencode-sessions` untouched.

## How variants work without modifying omo-slim's discovery mechanism

Each variant agent is a **user-level opencode markdown agent**
(`agents/<name>.md`). opencode auto-loads these alongside plugin-provided
agents at session start. They reference shared base prompts via
`prompt: "{file:../prompts/<base>-base.md}"` so all four variants of one
agent type share methodology, differing only in model. The bridge append
`oh-my-opencode-slim/superpowers-bridge/oracle_append.md` was patched to
teach oracle the multi-candidate verdict format.

Patch 0003 modifies omo-slim source code at
`oh-my-opencode-slim-local/src/cli/*.ts` to add suffix-stripping policy
resolution. On omo-slim upgrade, manually re-apply patch 0003 (or use
`git apply`) and rebuild via `bun run build`.
