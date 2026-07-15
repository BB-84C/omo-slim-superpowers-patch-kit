# Superpowers Lite Local Cutover and OMO Slim Compatibility

## Objective

Replace the active upstream Superpowers plugin with the local Superpowers Lite
development checkout and make OMO Slim 1.1.2 consume Lite skills through an
explicit configuration field.

The upstream Superpowers 6.1.1 clone remains untouched as an inactive manual
fallback. It is retired from normal OpenCode and OMO operation: no plugin entry,
automatic fallback, junction, compatibility alias, or implicit skills lookup may
refer to it.

## Current substrate

- Active OpenCode config loads an unpinned upstream Superpowers Git plugin,
  followed by the local OMO Slim tree and Vault-Tec.
- The local OMO Slim runtime is based on 1.1.2.
- OMO currently discovers skills from a hard-coded
  `<OPENCODE_CONFIG_DIR>/superpowers/skills` path and falls back to a stock skill
  roster when the directory is absent.
- The Superpowers Lite development checkout is `D:\superpowers-lite`.
- The patch-kit release basis is OMO Slim 1.1.2; the existing live OMO checkout
  has stale Git metadata and is not a trustworthy construction source.

## Decisions

### The development checkout is the live Lite installation

OpenCode loads the plugin directly from:

```text
D:\superpowers-lite\.opencode\plugins\superpowers.js
```

OMO reads skills directly from:

```text
D:\superpowers-lite\skills
```

There is no second runtime clone and no pinned commit in OpenCode or OMO
configuration. Future development in `D:\superpowers-lite` becomes active after
a fresh OpenCode start. Package version metadata may continue to identify a
release, but it is not the local runtime selection mechanism.

### Upstream Superpowers is retired

The existing checkout at
`C:\Users\Administrator\.config\opencode\superpowers` remains unchanged and
inactive. Nothing in the normal configuration or compatibility layer points to
it. Recovery to upstream is a deliberate manual operation using the backup and
rollback instructions; OMO must never silently select it.

### OMO receives an explicit Lite skills root

OMO Slim adds the optional top-level configuration field:

```jsonc
"superpowersSkillsDir": "D:\\superpowers-lite\\skills"
```

The field follows the existing camelCase top-level configuration style.

Data flow:

```text
oh-my-opencode-slim.jsonc
  -> PluginConfigSchema / generated JSON Schema
  -> loaded PluginConfig
  -> agent skill permissions
  -> available-skills prompt filtering
  -> one resolved Lite skill roster
```

Both permission construction and available-skill filtering must use the same
resolved path. The discovery cache is keyed by the resolved skills root, or is
removed if reliable path-keyed caching is not worthwhile.

If `superpowersSkillsDir` is absent, the Superpowers bridge overlay is disabled.
If it points to a missing or unreadable directory, OMO emits a clear warning and
disables the overlay. It does not probe `superpowers/skills` and does not restore
the retired fallback roster.

`using-superpowers` remains bootstrap-only: Lite injects its bootstrap, while OMO
does not offer that skill through the skill tool. Other discovered Lite skills
remain available according to the existing per-agent policy.

## Construction architecture

The current dirty live OMO checkout is not edited in place as the source of
truth. A clean staging tree is constructed from upstream OMO Slim v1.1.2, then
the current patch-kit rollup is applied before adding the Lite path capability.

Expected OMO source surfaces:

- `src/config/schema.ts`
- `src/cli/superpowers-policy.ts`
- `src/cli/skills.ts`
- `src/agents/index.ts`
- `src/hooks/filter-available-skills/index.ts`
- focused tests for policy, permissions, agents, filter behavior, and config
  user/project override merging
- generated `oh-my-opencode-slim.schema.json`
- configuration documentation

The patch-kit rollup is regenerated from a clean v1.1.2 checkout instead of
appending an opaque patch to the existing rollup. Changed anchors are added to
the partial snapshot and its manifest.

## Local cutover

Before mutation, create timestamped backups of:

- `opencode.json`
- `oh-my-opencode-slim.jsonc`
- the complete live `oh-my-opencode-slim-local` tree
- metadata identifying the inactive upstream Superpowers checkout and current
  active plugin entry

The new active plugin order is:

```text
Superpowers Lite local plugin
OMO Slim 1.1.2 local plugin
Vault-Tec plugin
```

The upstream Git Superpowers plugin entry is removed. The live OMO config receives
the explicit `superpowersSkillsDir` path. Its currently dangling `preset:
"expensive"` value is corrected to the only defined and intended preset,
`superpowers-bridge`, so the existing agent/model layout is actually merged.
No junction, symlink, environment-wide skills override, or stock-path
compatibility layer is created.

The running OpenCode process is not killed or restarted by automation. Config and
plugin changes take effect only in a new process.

## Patch-kit surface

Update the patch-kit to describe and reproduce the same architecture:

- regenerated OMO 1.1.2 rollup
- `superpowersSkillsDir` config template
- installation instructions using a local Superpowers Lite checkout path
- compatibility notes that upstream Superpowers is retired and never an implicit
  fallback
- updated changed-file snapshot and manifest
- verification instructions for one Lite plugin source and one Lite skill roster

The template uses a replaceable local path placeholder, not the machine-specific
`D:\superpowers-lite` value. Patch-kit commit and push remain a separate authority
gate.

## Semantic acceptance

### OMO construction

A clean OMO Slim v1.1.2 checkout plus the regenerated rollup must pass:

- dependency installation
- focused policy/config/filter tests
- complete test suite
- build cleanliness checks
- TypeScript checking
- production build and generated-schema verification

Tests cover:

- an explicit valid Lite root
- an absent field disabling the bridge overlay
- a missing/unreadable root warning and disabled overlay
- user/project configuration override behavior
- cache isolation between different roots
- permission and `<available_skills>` agreement
- `using-superpowers` remaining bootstrap-only
- no stock directory or fallback roster access

### Local OpenCode readback

A fresh OpenCode process must demonstrate:

- configuration contains no upstream Superpowers Git plugin
- the only Superpowers-family plugin is the local Lite plugin
- Lite bootstrap appears once
- OMO discovers the Lite roster through `superpowersSkillsDir`
- active preset is `superpowers-bridge`, with no missing-preset warning
- orchestrator variants remain present
- Gauge Forge provider IDs remain unchanged
- no duplicate plugin or skill names
- no runtime path references the retired upstream checkout

### Rollback

Rollback restores the timestamped OpenCode and OMO configuration backups and the
previous OMO live tree. Re-enabling upstream Superpowers is a separate deliberate
manual choice; rollback does not silently activate the preserved clone.

## Permission boundaries

- Do not terminate or restart the user's current OpenCode process.
- Do not modify or delete the preserved upstream Superpowers checkout.
- Do not commit or push the patch-kit without separate authority.
- Do not expose credentials while reading or rewriting OpenCode configuration.
- Stop before final release actions until the user has validated a fresh OpenCode
  session against the live cutover.

## Completion boundary

The local installation is complete only after staging and live OMO verification,
fresh-install simulation, backup readback, configuration readback, and a fresh
OpenCode process demonstrate the Lite + OMO behavior above. Patch-kit publication
is tracked separately and is not implied by local cutover success.
