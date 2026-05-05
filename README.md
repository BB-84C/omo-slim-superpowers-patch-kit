# OMO Slim + Superpowers Patch Kit

A third-party patch kit for patching a local editable `oh-my-opencode-slim` checkout so it cooperates cleanly with `superpowers` in OpenCode.

Upstream/source snapshot notice: see [`UPSTREAM.md`](./UPSTREAM.md).
An included copy of the upstream MIT license is provided at [`UPSTREAM-LICENSE-oh-my-opencode-slim.txt`](./UPSTREAM-LICENSE-oh-my-opencode-slim.txt).

## Quick start

Tell OpenCode: Fetch and follow instructions from https://github.com/BB-84C/omo-slim-superpowers-patch-kit/blob/main/docs/install.md

## What this repo does

This kit is for users who want:

- `superpowers` to remain the workflow/controller layer
- `oh-my-opencode-slim` to provide specialist agents and per-agent model routing
- only `superpowers` skills to be selectively restricted
- only OMO-managed MCPs to be selectively restricted
- all other custom skills and MCPs left untouched

## Tested versions

Validated with:

- `superpowers v5.0.7`
- `oh-my-opencode-slim v1.0.1`

Nearby newer versions will likely still work, but if patch application fails or behavior differs, inspect the provided snapshots before proceeding.

## What this kit patches

This patch kit changes OMO Slim in three ways:

1. **Superpowers-only skill gating** (patch 0001)
   - OMO Slim only selectively restricts `superpowers` skills
   - your other custom skills remain available unless you restrict them yourself

2. **OMO-managed MCP-only gating** (patch 0002)
   - OMO Slim only selectively restricts its own built-in MCPs:
     - `websearch`
     - `context7`
     - `grep_app`
   - your other MCPs remain untouched

3. **Best-of-N agent name resolution** (patch 0003)
   - Variant agents like `fixer-alpha`, `oracle-gamma` are auto-resolved to their base via suffix-stripping (`resolveBaseAgentName`)
   - Variants inherit the base agent's superpowers permission policy without needing per-variant entries
   - Adds explicit policy entries for fast-lane utility agents (`scout`, `validator`, `gist`, `wildcard`)
   - Required if you adopt the optional `opencode-config/` example setup (best-of-N + fast-lane agents)

It also includes prompt bridge files so OMO Slim agents understand how to behave inside a Superpowers-managed workflow.

This kit patches source, then expects you to build that local checkout before pointing OpenCode at it.

The provided OpenCode plugin snippet intentionally disables the default `general` and `explore` lanes so they do not compete with the patched OMO Slim worker layout.

## Optional: Best-of-N + Fast-Lane example setup

The kit ships an optional `opencode-config/` subtree that demonstrates the maintainer's complete best-of-N setup on top of the patched OMO Slim base:

- 16 best-of-N variant agents (4 each of fixer/oracle/designer + 2 each of explorer/librarian) for parallel candidate generation with blind oracle review
- 4 fast-lane utility agents (`scout`, `validator`, `gist`, `wildcard`) for latency-critical narrow tasks and divergent ideation
- A `best-of-n-with-judge` skill orchestrating fan-out, hard-gate filtering, voting, redo loops, and winner landing
- Shared base prompts and design docs

This is opt-in. The base patch kit (patches 0001 + 0002 + bridges + base agent template) works without it.

## What this kit does NOT do

- It does not replace Superpowers with OMO Slim
- It does not turn OMO Slim into the workflow controller
- It does not replace OpenCode itself
- It does not manage your auth, secrets, or session data
- It does not overwrite your existing MCP block unless you choose to do that manually

## Repository layout

- `patches/` — patch files to apply against an upstream local OMO Slim checkout (3 patches: skill gating, MCP gating, best-of-N name resolution)
- `snapshots/` — validated modified source files for manual comparison
- `config-templates/` — template configs based on the maintainer profile
- `prompt-bridges/` — per-agent append prompts for Superpowers-aware behavior
- `opencode-config/` — optional example mirror of the maintainer's `~/.config/opencode/` artifacts demonstrating the best-of-N + fast-lane setup (`agents/`, `prompts/`, `skills/best-of-n-with-judge/`, `docs/plans/`)
- `docs/` — install, verify, rollback, and architecture notes

## Maintainer profile included

This repo includes a validated opinionated default profile based on the maintainer's setup.

You do not have to use the exact same models or agent mappings, but the templates are designed to provide a working starting point.

## Verification checklist

After installation, verify:

- Superpowers bootstrap is active
- `orchestrator`, `fixer`, `oracle`, `explorer`, `librarian`, `designer`, `observer`, and `council` are available
- `councillor` is treated as an internal-only council worker, not a normal end-user lane
- `councillor` intentionally uses OMO Slim's internal/upstream council prompt flow and does not require a separate published prompt bridge file
- `fixer` and `oracle` cannot access blocked Superpowers skills
- `fixer` and `oracle` can still access your custom MCPs
- OMO built-in MCP restrictions do not affect your own MCPs

If you installed the optional `opencode-config/` setup, also verify:
- 16 variant agents (`fixer-{alpha,beta,gamma,delta}`, `oracle-{alpha,beta,gamma,delta}`, `designer-{alpha,beta,gamma,delta}`, `explorer-{alpha,beta}`, `librarian-{alpha,beta}`) are dispatchable via the task tool
- 4 utility agents (`scout`, `validator`, `gist`, `wildcard`) are dispatchable
- Variant agents inherit base superpowers (e.g., `@fixer-alpha` can use `verification-before-completion`)
- The `best-of-n-with-judge` skill is loadable

## Rollback

If you want to undo this integration:

1. remove the patched OMO Slim plugin entry from `opencode.json`
2. restore your previous `oh-my-opencode-slim.jsonc`
3. remove the prompt bridge files
4. optionally delete the local patched OMO Slim checkout

See `docs/rollback.md` for the detailed checklist.
