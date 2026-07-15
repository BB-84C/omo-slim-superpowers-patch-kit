# `v1.1.2` Snapshot Manifest

This directory is a **partial comparison snapshot**, not a runnable checkout.

## What it is

- Source basis: upstream `oh-my-opencode-slim v1.1.2` commit `89f7a4025f2547584aa91c674fc508593a668006`
- Target basis: verified local-Superpowers-Lite OMO target `17666e36b3064b3dce49ace3c96652a3e43269d7`
- Purpose: help reviewers and users compare the most important changed files without unpacking the entire working tree

## What it is NOT

- It is **not** a complete buildable source tree
- It is **not** a replacement for cloning upstream OMO
- It is **not** the install artifact itself

For a fresh install, use:

- the upstream OMO checkout at `v1.1.2`
- the versioned rollup patch under:
  - `patches/oh-my-opencode-slim/v1.1.2/0001-superpowers-bridge-rollup.patch`
  - then `patches/oh-my-opencode-slim/v1.1.2/0002-auto-continue-agent-model-preservation.patch`

## Included file classes

This snapshot intentionally contains only key changed anchor files, including:

- package/build anchors
  - `package.json`
  - `scripts/clean-dist.ts`
  - `scripts/build-cleanliness.test.ts`
- root/plugin integration anchors
  - `src/index.ts`
  - `src/index.test.ts`
- agent/pivot anchors
  - `src/agents/index.ts`
  - `src/agents/index.test.ts`
  - `src/agents/preroute-decision.ts`
  - `src/utils/orchestrator-identity.ts`
  - `src/utils/orchestrator-identity.test.ts`
  - `src/utils/session.ts`
  - `src/utils/session.test.ts`
- reserved-skill / fallback-policy anchors
  - `src/config/schema.ts`
  - `src/config/loader.test.ts`
  - `src/cli/superpowers-policy.ts`
  - `src/cli/superpowers-policy.test.ts`
  - `src/cli/skills.ts`
  - `src/cli/skills.test.ts`
  - `src/hooks/filter-available-skills/index.ts`
  - `src/hooks/filter-available-skills/index.test.ts`
  - `src/config/orchestrator-only-skills.ts`
  - `src/config/orchestrator-only-skills.test.ts`
- foreground fallback anchors
  - `src/hooks/foreground-fallback/index.ts`
  - `src/hooks/foreground-fallback/index.test.ts`
  - `src/hooks/foreground-fallback/cooldowns.ts`
  - `src/hooks/foreground-fallback/cooldowns.test.ts`
- todo continuation anchors
  - `src/hooks/todo-continuation/index.ts`
- user-facing/generated anchors
  - `README.md`
  - `oh-my-opencode-slim.schema.json`

## How to read it

Treat this snapshot as “important changed files only.”

If you need a real runnable tree:

1. clone upstream `oh-my-opencode-slim`
2. check out `v1.1.2`
3. apply `0001-superpowers-bridge-rollup.patch`, then `0002-auto-continue-agent-model-preservation.patch`
4. run `bun install` and `bun run build`

That is the canonical install path. This snapshot is only a review aid.
