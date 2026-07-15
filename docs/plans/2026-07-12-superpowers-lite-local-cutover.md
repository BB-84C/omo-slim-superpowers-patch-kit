# Superpowers Lite Local Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `D:\superpowers-lite` the only active Superpowers runtime source, teach OMO Slim 1.1.2 to consume its skills through `superpowersSkillsDir`, rebuild the patch-kit, and prove the local cutover in a fresh OpenCode process.

**Architecture:** Build the OMO change in a clean temporary clone based on upstream v1.1.2, with the existing bridge rollup applied before the new behavior. Discovery receives one explicit skills-root argument and returns an empty catalog when disabled or invalid; that same catalog drives both agent permissions and `<available_skills>` filtering. Only after clean-source and fresh-install verification do we back up and replace the live OMO tree and present the final OpenCode configuration diff for mutation approval.

**Tech Stack:** TypeScript, Bun, Zod 4, OpenCode plugin APIs, PowerShell 7, Git patch artifacts, JSONC.

## Global Constraints

- Live Lite source is exactly `D:\superpowers-lite`; do not create a second clone or pin a commit.
- OpenCode plugin entry is exactly `D:\superpowers-lite\.opencode\plugins\superpowers.js`.
- OMO skills root is exactly `D:\superpowers-lite\skills`.
- Preserve `C:\Users\Administrator\.config\opencode\superpowers` unchanged and inactive.
- Do not create junctions, symlinks, stock-path aliases, automatic stock fallbacks, or a built-in fallback roster.
- OMO compatibility target is 1.x only, exactly upstream v1.1.2 for this rollup; 2.x remains unsupported.
- Preserve the user's complete OMO agent/model configuration, including orchestrator variants, Gauge Forge provider IDs, MCPs, auto-continue agent/model behavior, and Vault-Tec plugin order.
- Correct the dangling live OMO preset from `expensive` to the only defined intended preset, `superpowers-bridge`; this is required for the preserved agent/model configuration to be merged.
- Do not modify the existing untracked patch-kit `AGENTS.md`.
- Do not terminate or restart the current OpenCode process.
- Do not mutate live OpenCode configuration until the staged diff has been shown and explicitly approved.
- Do not commit or push the patch-kit without separate user authorization.
- Keep credentials and token values out of logs, artifacts, and terminal output.

## File Structure

### Temporary OMO implementation checkout

- `src/config/schema.ts` — declares `superpowersSkillsDir`.
- `src/config/loader.test.ts` — proves user/project scalar override behavior.
- `src/cli/superpowers-policy.ts` — discovers the Lite catalog from one explicit root and builds per-agent policy.
- `src/cli/superpowers-policy.test.ts` — proves valid, absent, missing, cache-isolated, and bootstrap-only behavior.
- `src/cli/skills.ts` — accepts the configured root when constructing skill permissions.
- `src/cli/skills.test.ts` — proves explicit-list intersection with the discovered Lite catalog.
- `src/agents/index.ts` — threads `config.superpowersSkillsDir` into every built-in, custom, and orchestrator permission build.
- `src/agents/index.test.ts` — proves generated agent permissions come from the configured Lite catalog.
- `src/hooks/filter-available-skills/index.ts` — threads the same root into prompt filtering.
- `src/hooks/filter-available-skills/index.test.ts` — proves prompt filtering and permission construction agree.
- `oh-my-opencode-slim.schema.json` — generated schema containing the new field.
- `README.md` — documents the field's disabled and invalid-path semantics.

### Patch-kit checkout

- `patches/oh-my-opencode-slim/v1.1.2/0001-superpowers-bridge-rollup.patch` — regenerated v1.1.2 bridge rollup including explicit Lite-root support.
- `snapshots/oh-my-opencode-slim/v1.1.2/src/...` — changed source/test anchors copied from the verified target.
- `snapshots/oh-my-opencode-slim/v1.1.2/oh-my-opencode-slim.schema.json` — generated schema anchor.
- `snapshots/oh-my-opencode-slim/v1.1.2/README.md` — user-facing field documentation anchor.
- `snapshots/oh-my-opencode-slim/v1.1.2/MANIFEST.md` — updated snapshot basis and included-file list.
- `config-templates/opencode.plugin-snippet.jsonc` — Lite local plugin plus local OMO plugin placeholders.
- `config-templates/oh-my-opencode-slim.superpowers-bridge.jsonc` — `superpowersSkillsDir` placeholder.
- `docs/install.md` — local Lite checkout installation and no-stock-fallback instructions.
- `docs/verify.md` — semantic local/fresh-install verification matrix.
- `README.md`, `COMPATIBILITY.md`, `UPSTREAM.md`, `CHANGELOG.md` — compatibility, basis, and release narrative.
- `docs/specs/2026-07-12-superpowers-lite-local-cutover-design.md` — approved design.
- `docs/plans/2026-07-12-superpowers-lite-local-cutover.md` — this implementation plan.

### Live local configuration

- `C:\Users\Administrator\.config\opencode\opencode.json` — replaces the upstream Git plugin with the local Lite plugin while preserving every unrelated entry.
- `C:\Users\Administrator\.config\opencode\oh-my-opencode-slim.jsonc` — adds `superpowersSkillsDir` without changing agent/model/MCP semantics.
- `C:\Users\Administrator\.config\opencode\oh-my-opencode-slim-local\` — receives the fully verified clean OMO target tree.
- `D:\BB84.ai\.opencode\artifacts\superpowers-lite-cutover\` — timestamped backups, redacted diffs, command logs, and semantic readback.

---

### Task 1: Construct a Clean OMO v1.1.2 Implementation Checkout

**Files:**
- Create: `C:\Users\ADMINI~1\AppData\Local\Temp\opencode\omo-superpowers-lite-cutover\`
- Read: `patches/oh-my-opencode-slim/v1.1.2/0001-superpowers-bridge-rollup.patch`

**Interfaces:**
- Consumes: upstream tag `v1.1.2` and the current rollup.
- Produces: a clean local Git branch whose working target equals current patched OMO before Lite-root changes.

- [ ] **Step 1: Verify the staging parent and reserve a clean path**

Run from PowerShell:

```powershell
$parent = 'C:\Users\ADMINI~1\AppData\Local\Temp\opencode'
$stage = Join-Path $parent 'omo-superpowers-lite-cutover'
if (-not (Test-Path -LiteralPath $parent)) { throw "Missing approved temp parent: $parent" }
if (Test-Path -LiteralPath $stage) { throw "Staging path already exists: $stage" }
```

Expected: no output and exit code 0. Do not delete an existing path automatically.

- [ ] **Step 2: Clone and branch from upstream v1.1.2**

```powershell
git clone https://github.com/alvinunreal/oh-my-opencode-slim.git $stage
git -C $stage checkout v1.1.2
git -C $stage switch -c local/superpowers-lite-cutover
git -C $stage rev-parse HEAD
```

Expected final output: `89f7a4025f2547584aa91c674fc508593a668006`.

- [ ] **Step 3: Apply and commit the existing v1.1.2 rollup as the baseline**

```powershell
$kit = 'D:\BB84.ai\general_work\omo-slim-superpowers-patch-kit'
git -C $stage apply --check "$kit\patches\oh-my-opencode-slim\v1.1.2\0001-superpowers-bridge-rollup.patch"
git -C $stage apply "$kit\patches\oh-my-opencode-slim\v1.1.2\0001-superpowers-bridge-rollup.patch"
git -C $stage add --all
git -C $stage commit -m 'baseline: apply BB84 superpowers bridge rollup'
```

Expected: `git apply --check` succeeds and the commit contains only the existing rollup.

- [ ] **Step 4: Prove the baseline builds before adding the new behavior**

```powershell
bun install --cwd $stage
bun test --cwd $stage
bun run --cwd $stage typecheck
bun run --cwd $stage build
git -C $stage status --short
```

Expected: tests, typecheck, and build pass; status is clean. A baseline failure is a containment breach to diagnose before proceeding.

### Task 2: Add and Merge the Explicit Configuration Field

**Files:**
- Modify: `src/config/schema.ts:288-324`
- Modify: `src/config/loader.test.ts`
- Test: `src/config/loader.test.ts`

**Interfaces:**
- Consumes: existing `PluginConfigSchema` and scalar deep-merge behavior.
- Produces: `PluginConfig['superpowersSkillsDir']: string | undefined`.

- [ ] **Step 1: Write schema and loader tests first**

Add a schema-load test near other top-level scalar tests:

```ts
test('loads superpowersSkillsDir when configured', () => {
  const projectDir = path.join(tempDir, 'project');
  const projectConfigDir = path.join(projectDir, '.opencode');
  fs.mkdirSync(projectConfigDir, { recursive: true });
  fs.writeFileSync(
    path.join(projectConfigDir, 'oh-my-opencode-slim.json'),
    JSON.stringify({ superpowersSkillsDir: 'D:\\superpowers-lite\\skills' }),
  );

  expect(loadPluginConfig(projectDir).superpowersSkillsDir).toBe(
    'D:\\superpowers-lite\\skills',
  );
});
```

Add a merge test in the merge describe block:

```ts
test('project superpowersSkillsDir overrides the user value', () => {
  const userOpencodeDir = path.join(userConfigDir, 'opencode');
  fs.mkdirSync(userOpencodeDir, { recursive: true });
  fs.writeFileSync(
    path.join(userOpencodeDir, 'oh-my-opencode-slim.json'),
    JSON.stringify({ superpowersSkillsDir: 'C:\\user\\skills' }),
  );

  const projectDir = path.join(tempDir, 'project');
  const projectConfigDir = path.join(projectDir, '.opencode');
  fs.mkdirSync(projectConfigDir, { recursive: true });
  fs.writeFileSync(
    path.join(projectConfigDir, 'oh-my-opencode-slim.json'),
    JSON.stringify({ superpowersSkillsDir: 'D:\\project\\skills' }),
  );

  expect(loadPluginConfig(projectDir).superpowersSkillsDir).toBe(
    'D:\\project\\skills',
  );
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

```powershell
bun test --cwd $stage src/config/loader.test.ts
```

Expected: both new tests fail because the Zod object strips the undeclared field.

- [ ] **Step 3: Add the field to `PluginConfigSchema`**

Insert after `showStartupToast`:

```ts
superpowersSkillsDir: z
  .string()
  .trim()
  .min(1)
  .optional()
  .describe(
    'Absolute path to the active Superpowers Lite skills directory. When omitted, the Superpowers bridge overlay is disabled.',
  ),
```

- [ ] **Step 4: Run focused tests and commit**

```powershell
bun test --cwd $stage src/config/loader.test.ts
git -C $stage add src/config/schema.ts src/config/loader.test.ts
git -C $stage commit -m 'feat: configure explicit superpowers skills root'
```

Expected: focused tests pass and the commit contains only schema/loader behavior.

### Task 3: Replace Implicit and Fallback Discovery with an Explicit Catalog

**Files:**
- Modify: `src/cli/superpowers-policy.ts`
- Modify: `src/cli/superpowers-policy.test.ts`

**Interfaces:**
- Produces: `discoverSuperpowersSkillNames(skillsRoot?: string): string[]`.
- Produces: `clearSuperpowersSkillDiscoveryCache(): void` for deterministic tests.
- Produces: `buildSuperpowersSkillPermissions(agentName, superpowersSkills): Record<string, 'allow' | 'deny'>` with no implicit filesystem default.

- [ ] **Step 1: Replace fallback-dependent tests with isolated filesystem tests**

Use temporary directories and explicit catalogs:

```ts
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
```

Add these cases:

```ts
let skillsRoot: string;

beforeEach(() => {
  skillsRoot = mkdtempSync(join(tmpdir(), 'superpowers-lite-skills-'));
  clearSuperpowersSkillDiscoveryCache();
});

afterEach(() => {
  rmSync(skillsRoot, { recursive: true, force: true });
  clearSuperpowersSkillDiscoveryCache();
});

function addSkill(dirName: string, declaredName = dirName): void {
  const dir = join(skillsRoot, dirName);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${declaredName}\n---\n`);
}

it('returns an empty catalog when the root is omitted', () => {
  expect(discoverSuperpowersSkillNames()).toEqual([]);
});

it('discovers and sorts Lite skills from the explicit root', () => {
  addSkill('writing-plans');
  addSkill('brainstorming');
  expect(discoverSuperpowersSkillNames(skillsRoot)).toEqual([
    'brainstorming',
    'writing-plans',
  ]);
});

it('warns and returns empty for a missing root without stock fallback', () => {
  const warn = spyOn(console, 'warn').mockImplementation(() => {});
  expect(discoverSuperpowersSkillNames(join(skillsRoot, 'missing'))).toEqual([]);
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn.mock.calls[0][0]).toContain('Superpowers skills directory is unavailable');
  warn.mockRestore();
});

it('warns and returns empty when the configured root is not a directory', () => {
  const filePath = join(skillsRoot, 'not-a-directory');
  writeFileSync(filePath, 'not a skill root');
  const warn = spyOn(console, 'warn').mockImplementation(() => {});
  expect(discoverSuperpowersSkillNames(filePath)).toEqual([]);
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn.mock.calls[0][0]).toContain('Superpowers skills directory is unreadable');
  warn.mockRestore();
});

it('isolates cached catalogs by resolved root', () => {
  const otherRoot = mkdtempSync(join(tmpdir(), 'superpowers-lite-skills-other-'));
  addSkill('brainstorming');
  mkdirSync(join(otherRoot, 'writing-plans'), { recursive: true });
  writeFileSync(
    join(otherRoot, 'writing-plans', 'SKILL.md'),
    '---\nname: writing-plans\n---\n',
  );
  expect(discoverSuperpowersSkillNames(skillsRoot)).toEqual(['brainstorming']);
  expect(discoverSuperpowersSkillNames(otherRoot)).toEqual(['writing-plans']);
  rmSync(otherRoot, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run the policy tests and confirm the old behavior fails**

```powershell
bun test --cwd $stage src/cli/superpowers-policy.test.ts
```

Expected: failures show the old zero-argument config-root lookup and fallback roster.

- [ ] **Step 3: Implement explicit, path-keyed discovery**

Replace the global array cache and config-root resolution with:

```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const cachedSuperpowersSkills = new Map<string, string[]>();

export function clearSuperpowersSkillDiscoveryCache(): void {
  cachedSuperpowersSkills.clear();
}

export function discoverSuperpowersSkillNames(skillsRoot?: string): string[] {
  const configuredRoot = skillsRoot?.trim();
  if (!configuredRoot) {
    return [];
  }

  const resolvedRoot = resolve(configuredRoot);
  const cached = cachedSuperpowersSkills.get(resolvedRoot);
  if (cached) {
    return [...cached];
  }

  if (!existsSync(resolvedRoot)) {
    console.warn(
      `[oh-my-opencode-slim] Superpowers skills directory is unavailable: ${resolvedRoot}; bridge overlay disabled.`,
    );
    cachedSuperpowersSkills.set(resolvedRoot, []);
    return [];
  }

  try {
    const discovered = readdirSync(resolvedRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) =>
        extractSkillName(join(resolvedRoot, entry.name), entry.name),
      )
      .filter(Boolean);
    const catalog = [...new Set(discovered)].sort();
    cachedSuperpowersSkills.set(resolvedRoot, catalog);
    return [...catalog];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[oh-my-opencode-slim] Superpowers skills directory is unreadable: ${resolvedRoot}; bridge overlay disabled. ${message}`,
    );
    cachedSuperpowersSkills.set(resolvedRoot, []);
    return [];
  }
}
```

Delete `FALLBACK_SUPERPOWERS_SKILLS`, `homedir`, `getOpencodeConfigDir`, and all default parameters that call zero-argument discovery. Policy tests use an explicit fixture catalog such as:

```ts
const TEST_SUPERPOWERS_SKILLS = [
  'brainstorming',
  'receiving-code-review',
  'subagent-driven-development',
  'systematic-debugging',
  'test-driven-development',
  'using-superpowers',
  'verification-before-completion',
  'writing-plans',
];
```

- [ ] **Step 4: Prove bootstrap-only and no-fallback semantics, then commit**

```powershell
bun test --cwd $stage src/cli/superpowers-policy.test.ts
git -C $stage add src/cli/superpowers-policy.ts src/cli/superpowers-policy.test.ts
git -C $stage commit -m 'refactor: discover superpowers skills from explicit root'
```

Expected: all policy tests pass; repository search finds no `FALLBACK_SUPERPOWERS_SKILLS`, `superpowers/skills`, or config-root construction in `superpowers-policy.ts`.

### Task 4: Thread One Catalog Through Permissions and Prompt Filtering

**Files:**
- Modify: `src/cli/skills.ts:118-153`
- Modify: `src/cli/skills.test.ts`
- Modify: `src/agents/index.ts:208-390`
- Modify: `src/agents/index.test.ts`
- Modify: `src/hooks/filter-available-skills/index.ts:106-139`
- Modify: `src/hooks/filter-available-skills/index.test.ts`

**Interfaces:**
- Consumes: `discoverSuperpowersSkillNames(superpowersSkillsDir)`.
- Produces: `getSkillPermissionsForAgent(agentName, skillList?, superpowersSkillsDir?)`.
- Guarantees: agent permissions and prompt filtering derive from the same configured root.

- [ ] **Step 1: Add failing permission and hook tests**

Create a temporary Lite skills root in each relevant test file. In `skills.test.ts`, add:

```ts
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clearSuperpowersSkillDiscoveryCache } from './superpowers-policy';

const SUPERPOWERS_TEST_SKILLS = [
  'brainstorming',
  'receiving-code-review',
  'requesting-code-review',
  'subagent-driven-development',
  'systematic-debugging',
  'test-driven-development',
  'using-superpowers',
  'verification-before-completion',
  'writing-plans',
];

let skillsRoot: string;

beforeEach(() => {
  skillsRoot = mkdtempSync(join(tmpdir(), 'omo-lite-policy-'));
  for (const name of SUPERPOWERS_TEST_SKILLS) {
    const dir = join(skillsRoot, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${name}\n---\n`);
  }
  clearSuperpowersSkillDiscoveryCache();
});

afterEach(() => {
  rmSync(skillsRoot, { recursive: true, force: true });
  clearSuperpowersSkillDiscoveryCache();
});
```

Pass `skillsRoot` as the third argument to every existing test that asserts a Superpowers skill permission. Keep tests that only assert non-Superpowers defaults or reserved custom skills zero-root so they also prove the overlay can be disabled.

Then assert:

```ts
const permissions = getSkillPermissionsForAgent(
  'orchestrator',
  undefined,
  skillsRoot,
);
expect(permissions['brainstorming']).toBe('allow');
expect(permissions['writing-plans']).toBe('allow');
expect(permissions['using-superpowers']).toBe('deny');
expect(permissions['not-in-lite-catalog']).toBeUndefined();
```

The absent catalog case must preserve the agent's non-Superpowers wildcard while injecting no retired names:

```ts
const disabledOverlay = getSkillPermissionsForAgent('orchestrator');
expect(disabledOverlay['*']).toBe('allow');
expect(disabledOverlay['brainstorming']).toBeUndefined();
expect(disabledOverlay['writing-plans']).toBeUndefined();
expect(disabledOverlay['using-superpowers']).toBeUndefined();
```

For the hook, set:

```ts
const config: PluginConfig = { superpowersSkillsDir: skillsRoot };
```

and assert that an orchestrator prompt containing `brainstorming`, `writing-plans`, and `using-superpowers` keeps the first two and removes `using-superpowers`.

In `agents/index.test.ts`, create the same fixture root and pass `superpowersSkillsDir: skillsRoot` into every `createAgents(...)` case that asserts Lite permissions. Direct calls to `getSkillPermissionsForAgent` that assert Lite policy also receive `skillsRoot` as their third argument.

- [ ] **Step 2: Run focused tests and confirm signature failures**

```powershell
bun test --cwd $stage src/cli/skills.test.ts src/agents/index.test.ts src/hooks/filter-available-skills/index.test.ts
```

Expected: new tests fail because the configured root is not threaded through.

- [ ] **Step 3: Update permission construction**

Change the signature and discovery call:

```ts
export function getSkillPermissionsForAgent(
  agentName: string,
  skillList?: string[],
  superpowersSkillsDir?: string,
): Record<string, 'allow' | 'ask' | 'deny'> {
  const superpowersSkills = discoverSuperpowersSkillNames(superpowersSkillsDir);
  const superpowersPermissions = buildSuperpowersSkillPermissions(
    agentName,
    superpowersSkills,
  );
```

Preserve all existing explicit-skill intersection and reserved-skill override semantics.

- [ ] **Step 4: Thread the field through every agent permission call**

Change the helper to:

```ts
function applyDefaultPermissions(
  agent: AgentDefinition,
  configuredSkills?: string[],
  superpowersSkillsDir?: string,
): void {
  // existing permission merge
  const skillPermissions = getSkillPermissionsForAgent(
    agent.name,
    configuredSkills,
    superpowersSkillsDir,
  );
```

Pass `config?.superpowersSkillsDir` in all three call sites because `createAgents` accepts an omitted config:

```ts
applyDefaultPermissions(agent, override?.skills, config?.superpowersSkillsDir);
applyDefaultPermissions(orchestrator, orchestratorOverride?.skills, config?.superpowersSkillsDir);
```

- [ ] **Step 5: Thread the field through the prompt filter**

Use:

```ts
const permissionRules = getSkillPermissionsForAgent(
  agentName,
  configuredSkills,
  config.superpowersSkillsDir,
);
```

- [ ] **Step 6: Run focused tests, search for missed calls, and commit**

```powershell
bun test --cwd $stage src/cli/skills.test.ts src/agents/index.test.ts src/hooks/filter-available-skills/index.test.ts
rg "getSkillPermissionsForAgent\(" "$stage\src"
git -C $stage add src/cli/skills.ts src/cli/skills.test.ts src/agents/index.ts src/agents/index.test.ts src/hooks/filter-available-skills/index.ts src/hooks/filter-available-skills/index.test.ts
git -C $stage commit -m 'feat: use Lite catalog for permissions and prompts'
```

Expected: focused tests pass; every production call either supplies the configured root or intentionally operates with the overlay disabled.

### Task 5: Generate Schema, Document Semantics, and Gate the OMO Target

**Files:**
- Modify: `README.md`
- Generate: `oh-my-opencode-slim.schema.json`
- Test: all OMO tests and build outputs

**Interfaces:**
- Consumes: completed OMO source changes.
- Produces: a clean, buildable target commit and generated schema.

- [ ] **Step 1: Document the exact field behavior**

Add this configuration example to OMO README configuration docs:

```jsonc
{
  "superpowersSkillsDir": "D:\\superpowers-lite\\skills"
}
```

State that omission disables the bridge overlay, an unavailable directory warns and disables it, and OMO never probes `~/.config/opencode/superpowers/skills` or restores a stock roster.

- [ ] **Step 2: Generate and verify the schema**

```powershell
bun run --cwd $stage generate-schema
rg 'superpowersSkillsDir' "$stage\oh-my-opencode-slim.schema.json"
```

Expected: generated schema contains one optional non-empty string property with the configured description.

- [ ] **Step 3: Run the complete OMO gate**

```powershell
bun test --cwd $stage
bun run --cwd $stage check:ci
bun run --cwd $stage typecheck
bun run --cwd $stage build
bun run --cwd $stage verify:release
git -C $stage status --short
```

Expected: all commands pass. Only `README.md` and generated schema remain uncommitted.

- [ ] **Step 4: Commit generated and documented behavior**

```powershell
git -C $stage add README.md oh-my-opencode-slim.schema.json
git -C $stage commit -m 'docs: describe Lite skills root configuration'
git -C $stage status --short
```

Expected: clean status.

### Task 6: Regenerate Patch-Kit Rollup, Snapshots, Templates, and Docs

**Files:**
- Modify: patch-kit files listed in the File Structure section.

**Interfaces:**
- Consumes: verified staging `HEAD` and upstream base `89f7a4025f2547584aa91c674fc508593a668006`.
- Produces: a reproducible uncommitted patch-kit delta ready for review.

- [ ] **Step 1: Regenerate the rollup from the upstream base**

```powershell
$rollup = "$kit\patches\oh-my-opencode-slim\v1.1.2\0001-superpowers-bridge-rollup.patch"
git -C $stage diff --binary --output="$rollup" 89f7a4025f2547584aa91c674fc508593a668006..HEAD
git -C $stage diff --quiet 89f7a4025f2547584aa91c674fc508593a668006..HEAD
if ($LASTEXITCODE -ne 1) { throw 'Expected a non-empty rollup diff' }
```

Expected: Git writes an LF-preserving complete upstream-v1.1.2-to-target patch directly, avoiding the PowerShell `Set-Content` CRLF corruption that broke the previous binary deletion blocks. The rollup excludes the separate `0002-auto-continue-agent-model-preservation.patch` delta.

- [ ] **Step 2: Sync only changed comparison anchors**

Copy the files named in the File Structure section from `$stage` into `snapshots/oh-my-opencode-slim/v1.1.2/`, preserving relative paths. Add the new config, policy, skill, agent, hook, README, and schema anchors to `MANIFEST.md`; retain the statement that the snapshot is partial and non-runnable.

Use this bounded copy shape for each file:

```powershell
$relative = 'src\cli\superpowers-policy.ts'
$destination = Join-Path "$kit\snapshots\oh-my-opencode-slim\v1.1.2" $relative
$parent = Split-Path -Parent $destination
if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }
Copy-Item -LiteralPath (Join-Path $stage $relative) -Destination $destination
```

- [ ] **Step 3: Update config templates**

Set the plugin template to:

```jsonc
{
  "plugin": [
    "<LOCAL_SUPERPOWERS_LITE_PATH>/.opencode/plugins/superpowers.js",
    "<LOCAL_OMO_SLIM_PATH>"
  ],
  "agent": {
    "explore": { "disable": true },
    "general": { "disable": true }
  }
}
```

Add this top-level property to the OMO template:

```jsonc
"superpowersSkillsDir": "<LOCAL_SUPERPOWERS_LITE_PATH>/skills",
```

- [ ] **Step 4: Update public installation and compatibility copy**

Update `README.md`, `COMPATIBILITY.md`, `UPSTREAM.md`, `CHANGELOG.md`, `docs/install.md`, and `docs/verify.md` so they consistently state:

- Superpowers Lite local checkout is the supported runtime source.
- OMO remains on v1.1.2 and 1.x only.
- Upstream Superpowers is not installed or discovered automatically.
- No junction or stock path is needed.
- Local Lite edits become visible after starting a fresh OpenCode process.
- The rollup plus the separate auto-continue patch are both applied in that order.
- Superpowers Lite supports Claude Code, Cursor, Copilot CLI, Codex CLI/App, Kimi, OpenCode, Pi, Antigravity, and Factory-compatible consumers; Gemini is end-of-life and unsupported.

- [ ] **Step 5: Run a placeholder and retired-path scan**

```powershell
rg -n "superpowers@git\+https://github.com/obra/superpowers|#v5\.1\.0|~/.config/opencode/superpowers/skills|FALLBACK_SUPERPOWERS_SKILLS" $kit
rg -n "<LOCAL_SUPERPOWERS_LITE_PATH>|<LOCAL_OMO_SLIM_PATH>" "$kit\config-templates" "$kit\docs"
```

Expected: first command returns only explicitly labeled historical material, never active instructions/templates. Second command finds documented placeholders with replacement instructions.

### Task 7: Prove the Regenerated Patch from a Second Clean Checkout

**Files:**
- Create: `C:\Users\ADMINI~1\AppData\Local\Temp\opencode\omo-superpowers-lite-fresh-install\`
- Preserve logs under: `D:\BB84.ai\.opencode\artifacts\superpowers-lite-cutover\fresh-install\`

**Interfaces:**
- Consumes: regenerated rollup and existing `0002` auto-continue patch.
- Produces: semantic fresh-install evidence independent of the implementation checkout.

- [ ] **Step 1: Create the second clean checkout without deleting pre-existing state**

```powershell
$fresh = 'C:\Users\ADMINI~1\AppData\Local\Temp\opencode\omo-superpowers-lite-fresh-install'
if (Test-Path -LiteralPath $fresh) { throw "Fresh-install path already exists: $fresh" }
git clone --no-checkout https://github.com/alvinunreal/oh-my-opencode-slim.git $fresh
git -C $fresh config core.autocrlf false
git -C $fresh checkout v1.1.2
```

Expected: the persisted repo-local setting makes the checkout LF-clean for Biome without changing global Git configuration.

- [ ] **Step 2: Apply both published patches exactly as documented**

```powershell
git -C $fresh apply --check "$kit\patches\oh-my-opencode-slim\v1.1.2\0001-superpowers-bridge-rollup.patch"
git -C $fresh apply "$kit\patches\oh-my-opencode-slim\v1.1.2\0001-superpowers-bridge-rollup.patch"
git -C $fresh apply --check "$kit\patches\oh-my-opencode-slim\v1.1.2\0002-auto-continue-agent-model-preservation.patch"
git -C $fresh apply "$kit\patches\oh-my-opencode-slim\v1.1.2\0002-auto-continue-agent-model-preservation.patch"
```

Expected: both checks and applications succeed with no offsets or rejects.

- [ ] **Step 3: Run the complete fresh-install gate**

```powershell
bun install --cwd $fresh
bun test --cwd $fresh
bun run --cwd $fresh check:ci
bun run --cwd $fresh typecheck
bun run --cwd $fresh build
bun run --cwd $fresh verify:release
```

Expected: all commands pass from the second checkout.

- [ ] **Step 4: Compare the generated target to staging**

```powershell
git -C $stage diff --no-index -- "$stage\src" "$fresh\src"
git -C $stage diff --no-index -- "$stage\oh-my-opencode-slim.schema.json" "$fresh\oh-my-opencode-slim.schema.json"
```

Expected: source may differ only in files owned by the separate auto-continue patch; schema is identical. Any unrelated difference blocks cutover.

### Task 8: Prepare Backups and Surface the Live Mutation Diff

**Files:**
- Create: `D:\BB84.ai\.opencode\artifacts\superpowers-lite-cutover\<timestamp>\`
- Read/redact: live OpenCode and OMO config.
- Do not modify live state in this task.

**Interfaces:**
- Consumes: fully verified fresh checkout.
- Produces: complete backups, hashes, and a redacted proposed diff for user confirmation.

- [ ] **Step 1: Create the backup directory and copy live state**

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$evidence = "D:\BB84.ai\.opencode\artifacts\superpowers-lite-cutover\$stamp"
$configRoot = 'C:\Users\Administrator\.config\opencode'
if (-not (Test-Path -LiteralPath 'D:\BB84.ai\.opencode\artifacts')) { throw 'Missing artifact parent' }
New-Item -ItemType Directory -Path $evidence | Out-Null
Copy-Item -LiteralPath "$configRoot\opencode.json" -Destination "$evidence\opencode.json.before"
Copy-Item -LiteralPath "$configRoot\oh-my-opencode-slim.jsonc" -Destination "$evidence\oh-my-opencode-slim.jsonc.before"
Copy-Item -LiteralPath "$configRoot\oh-my-opencode-slim-local" -Destination "$evidence\oh-my-opencode-slim-local.before" -Recurse
git -C "$configRoot\superpowers" rev-parse HEAD | Set-Content "$evidence\retired-superpowers-head.txt"
```

- [ ] **Step 2: Record integrity hashes**

```powershell
Get-FileHash "$evidence\opencode.json.before", "$evidence\oh-my-opencode-slim.jsonc.before" |
  Format-Table -AutoSize | Out-String | Set-Content "$evidence\config-hashes.txt"
```

- [ ] **Step 3: Generate proposed configs in the artifact directory**

Create `$evidence\prepare-cutover-configs.ts` with semantic JSON/JSONC parsing, not regex replacement:

```ts
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const configRoot = process.env.CONFIG_ROOT;
const evidence = process.env.EVIDENCE;
const freshOmo = process.env.FRESH_OMO;
if (!configRoot || !evidence || !freshOmo) {
  throw new Error('CONFIG_ROOT, EVIDENCE, and FRESH_OMO are required');
}

const parserUrl = pathToFileURL(join(freshOmo, 'src', 'cli', 'config-io.ts')).href;
const { stripJsonComments } = await import(parserUrl);
const parseJsonc = (path: string): Record<string, unknown> =>
  JSON.parse(stripJsonComments(readFileSync(path, 'utf8')));
const clone = <T>(value: T): T => structuredClone(value);

const opencodePath = join(configRoot, 'opencode.json');
const opencode = parseJsonc(opencodePath);
const opencodeBefore = clone(opencode);
assert.ok(Array.isArray(opencode.plugin), 'opencode.plugin must be an array');
const upstreamIndexes = opencode.plugin
  .map((entry, index) =>
    typeof entry === 'string' && entry.includes('github.com/obra/superpowers')
      ? index
      : -1,
  )
  .filter((index) => index >= 0);
assert.deepEqual(upstreamIndexes.length, 1, 'expected exactly one upstream Superpowers plugin');
const pluginIndex = upstreamIndexes[0];
const oldPlugin = opencode.plugin[pluginIndex];
opencode.plugin[pluginIndex] =
  'D:\\superpowers-lite\\.opencode\\plugins\\superpowers.js';
const opencodeReverted = clone(opencode);
opencodeReverted.plugin[pluginIndex] = oldPlugin;
assert.deepEqual(opencodeReverted, opencodeBefore);

const omoPath = join(configRoot, 'oh-my-opencode-slim.jsonc');
const omo = parseJsonc(omoPath);
const omoBefore = clone(omo);
const oldSkillsDir = omo.superpowersSkillsDir;
const oldPreset = omo.preset;
assert.equal(oldPreset, 'expensive', 'expected the diagnosed dangling preset before cutover');
omo.preset = 'superpowers-bridge';
omo.superpowersSkillsDir = 'D:\\superpowers-lite\\skills';
const omoReverted = clone(omo);
omoReverted.preset = oldPreset;
if (oldSkillsDir === undefined) {
  delete omoReverted.superpowersSkillsDir;
} else {
  omoReverted.superpowersSkillsDir = oldSkillsDir;
}
assert.deepEqual(omoReverted, omoBefore);

writeFileSync(
  join(evidence, 'opencode.json.proposed'),
  `${JSON.stringify(opencode, null, 2)}\n`,
);
writeFileSync(
  join(evidence, 'oh-my-opencode-slim.jsonc.proposed'),
  `${JSON.stringify(omo, null, 2)}\n`,
);
writeFileSync(
  join(evidence, 'semantic-diff.json'),
  `${JSON.stringify(
    {
      plugin: { index: pluginIndex, before: oldPlugin, after: opencode.plugin[pluginIndex] },
      preset: { before: oldPreset, after: omo.preset },
      superpowersSkillsDir: { before: oldSkillsDir ?? null, after: omo.superpowersSkillsDir },
      unrelatedSemanticChanges: 0,
    },
    null,
    2,
  )}\n`,
);
```

Run it without printing either full config:

```powershell
$env:CONFIG_ROOT = $configRoot
$env:EVIDENCE = $evidence
$env:FRESH_OMO = $fresh
bun "$evidence\prepare-cutover-configs.ts"
Remove-Item Env:CONFIG_ROOT, Env:EVIDENCE, Env:FRESH_OMO
```

This preserves every unrelated semantic property and array position, replacing only the upstream Superpowers plugin entry with `D:\superpowers-lite\.opencode\plugins\superpowers.js` and adding:

```jsonc
"superpowersSkillsDir": "D:\\superpowers-lite\\skills"
```

It also corrects the diagnosed dangling preset:

```jsonc
"preset": "superpowers-bridge"
```

Write candidates to:

```text
opencode.json.proposed
opencode.json.comment-preserved.proposed
oh-my-opencode-slim.jsonc.proposed
```

The normalized `opencode.json.proposed` is semantic comparison evidence only.
Create `opencode.json.comment-preserved.proposed` by replacing exactly one
JSON-string literal for plugin index 0 in the guarded raw JSONC text, then parse
and compare it to the normalized candidate. Assert the two existing commented-out
operator toggle lines remain byte-preserved. Do not log values of
credential-bearing properties.

- [ ] **Step 4: Surface a redacted semantic diff and stop for confirmation**

The diff must show:

- exactly one plugin replacement;
- exactly one preset correction and one new `superpowersSkillsDir` field;
- no model/provider/MCP/agent changes;
- no upstream checkout mutation;
- the planned live OMO source replacement from `$fresh`.

Expected: user explicitly approves the displayed dry-run before Task 9 begins.

### Task 9: Build and Rehearse a Journaled Cutover Transaction

The first two approved cutover attempts rolled back safely but exposed two
transaction defects: an inline verifier quoting failure, then a monolithic
copy/build/mutate command whose tool call timed out after live mutation. Do not
retry that shape. This task is offline-only until its final approval gate.

**Files:**
- Create: `D:\BB84.ai\.opencode\artifacts\superpowers-lite-cutover\20260712-145734\cutover-transaction.ps1`
- Create: `D:\BB84.ai\.opencode\artifacts\superpowers-lite-cutover\20260712-145734\recover-cutover.ps1`
- Modify: `D:\BB84.ai\.opencode\artifacts\superpowers-lite-cutover\20260712-145734\run-verify-live-cutover.ps1`
- Modify: `D:\BB84.ai\.opencode\artifacts\superpowers-lite-cutover\20260712-145734\verify-live-cutover.ts`
- Create during preparation only: `C:\Users\Administrator\.config\opencode\oh-my-opencode-slim-local.candidate-<transaction-id>\`
- Create during preparation only: `C:\Users\Administrator\.config\opencode\.superpowers-lite-cutover\<transaction-id>\`
- Preserve: both existing `oh-my-opencode-slim-local.failed-*` trees and all Task 8 backups.

**Interfaces:**
- Consumes: Task 8 backups, the comment-preserved OpenCode candidate, the OMO
  config candidate, and the fully verified fresh OMO target.
- Produces: a foreground, short-lived, idempotently recoverable transaction whose
  live window contains only same-volume renames, atomic config replacements, and
  bounded semantic verification.
- Prohibits: copy, dependency installation, tests, builds, Git operations, or
  unbounded child processes after the first live mutation.

- [ ] **Step 1: Pre-stage and seal every input outside the live window**

Before creating a transaction, verify free space, the Task 8 backup hashes, the
restored live-before hashes, the clean Lite checkout, and the retired upstream
checkout HEAD/status. Copy the fresh OMO target to a transaction-specific sibling
candidate and run its focused tests and build before mutation.

Write a candidate identity marker containing the transaction ID, verified source
commit, the two published patch hashes, the candidate build-output hashes, and
the exact source path. Hash the marker and record that hash in the transaction
manifest. The transaction must verify the marker before the first rename and
again after the candidate becomes the live directory, proving that the live path
is the same sealed candidate directory.

Copy these four files into the transaction-specific same-volume staging directory:

```text
opencode.json.next       <- opencode.json.comment-preserved.proposed
opencode.json.rollback   <- opencode.json.before
omo.jsonc.next           <- oh-my-opencode-slim.jsonc.proposed
omo.jsonc.rollback       <- oh-my-opencode-slim.jsonc.before
```

Record their SHA-256 values in the manifest. The normalized
`opencode.json.proposed` is comparison evidence only and must never be installed.

- [ ] **Step 2: Implement durable lock and write-ahead journal semantics**

Use a single global lock file opened with `FileShare.None`; a stale filename is
not itself a lock because process death releases the handle. Assign one immutable
transaction ID and write a manifest before mutation.

Before every mutating operation, atomically persist and flush an `intent` event;
after success, persist a corresponding `done` event. Journal events must include
the transaction ID, sequence, operation, source, destination, expected hashes or
topology, and UTC timestamp. Write each event through temp-file + flush-to-disk +
same-volume rename so a crash can at most leave an ignorable temp file.

The recovery script must acquire the same lock and derive truth from both the
journal and actual path/config hashes. It must be safe to run repeatedly from any
interruption point and converge to one of two complete states only:

```text
BEFORE: original configs + original OMO at live path; candidate/failed target preserved
AFTER:  approved configs + sealed candidate at live path; original OMO preserved as pre-cutover
```

Any unrecognized mixed topology or hash must stop without guessing.

- [ ] **Step 3: Make config replacement and verification bounded**

Install configs with same-volume atomic replacement (`System.IO.File.Replace` or
an equivalent replace primitive), never `Copy-Item` over a live config. Pre-stage
rollback copies so rollback uses the same atomic primitive.

Make the verifier self-contained in the evidence package; it must not import a
parser from a temporary checkout. The wrapper must:

- run the verifier with a hard timeout no greater than 30 seconds;
- capture stdout/stderr to transaction-scoped files;
- require exit code 0;
- parse the verifier JSON and require exactly one object with `pass: true`;
- verify the candidate identity marker at the live OMO path;
- avoid printing full configs, tokens, or credential-bearing values.

- [ ] **Step 4: Keep the live transaction mechanically short**

The foreground transaction sequence is:

```text
1. acquire global lock
2. verify BEFORE state, manifest hashes, candidate identity, and path topology
3. journal intent/done: rename live OMO -> transaction-specific pre-cutover path
4. journal intent/done: rename sealed candidate -> live OMO path
5. journal intent/done: atomically replace opencode.json from opencode.json.next
6. journal intent/done: atomically replace oh-my-opencode-slim.jsonc from omo.jsonc.next
7. run bounded AFTER verifier and parse pass:true
8. journal committed and release lock
```

On any failure after mutation begins, attempt the idempotent recovery routine,
run the bounded BEFORE verifier, journal `rolled-back`, and return non-zero. Do
not delete or overwrite the failed candidate; quarantine it under a
transaction-specific `.failed-*` name when rollback requires moving it aside.

- [ ] **Step 5: Rehearse commit and every crash boundary offline**

Use an isolated same-volume simulation root, never the live paths. Rehearse at
least three clean commit runs and inject a stop after each individual mutation.
For every injected stop, run recovery twice and prove both invocations converge
to the same valid state. Preserve transaction manifests, journals, verifier
outputs, topology readbacks, config hashes, and elapsed times under:

```text
D:\BB84.ai\.opencode\artifacts\superpowers-lite-cutover\20260712-145734\transaction-rehearsal\
```

Acceptance requires zero mixed states, idempotent second recovery, no secret
output, and every mutation-to-verification transaction completing within the
bounded foreground budget.

- [ ] **Step 6: Independent transaction review and fresh authority gate**

Dispatch an oracle reviewer over the scripts and rehearsal artifacts. The review
must approve crash recovery, atomicity, timeout behavior, candidate identity,
comment preservation, and scope. Resolve all Critical/Important findings and
repeat the review.

Then surface one bundled proposal: exact pre-staged paths and hashes, measured
transaction duration, recovery commands, preserved failed trees, and current
live-before readback. Stop for a new explicit live-mutation approval. Prior
approval does not authorize a third attempt after the transaction design changed.

### Task 9 Live Gate: Execute the Newly Approved Transaction

Only after the fresh approval, run the reviewed foreground transaction once. Do
not detach it, do not combine preparation with mutation, and do not touch the
current OpenCode process. If the tool call is interrupted, run the reviewed
recovery command before interpreting or retrying anything.

Read back structurally that:

```text
plugin[0] = D:\superpowers-lite\.opencode\plugins\superpowers.js
plugin[1] = C:\Users\Administrator\.config\opencode\oh-my-opencode-slim-local
superpowersSkillsDir = D:\superpowers-lite\skills
preset = superpowers-bridge
candidate identity marker = approved transaction marker
```

Also prove there is no active `obra/superpowers` Git spec, both commented-out
operator toggles remain byte-preserved, and the retired upstream checkout HEAD
and status are unchanged.

### Task 10: Validate in a Fresh OpenCode Process and Review Semantic Evidence

**Files:**
- Preserve evidence under: `D:\BB84.ai\.opencode\artifacts\superpowers-lite-cutover\<timestamp>\fresh-process\`
- Do not terminate the current OpenCode process.

**Interfaces:**
- Consumes: live cutover.
- Produces: semantic runtime evidence and rollback decision.

- [ ] **Step 1: Launch a separate bounded OpenCode process**

Run a one-shot process rather than attaching the current session:

```powershell
$freshEvidence = Join-Path $evidence 'fresh-process'
New-Item -ItemType Directory -Path $freshEvidence | Out-Null
opencode run `
  --agent orchestrator-delta `
  --model gauge-forge-openai/gpt-5.6-sol `
  --variant xhigh `
  --format json `
  --title "superpowers-lite-cutover-$stamp" `
  "Use the skill tool to load writing-plans, then report only: active agent name, active model ID and variant, the loaded SKILL.md path, and whether using-superpowers appears as a skill-tool option. Do not modify files." `
  1> "$freshEvidence\skill-probe.jsonl" `
  2> "$freshEvidence\skill-probe.stderr.log"
if ($LASTEXITCODE -ne 0) { throw 'Fresh OpenCode skill probe failed' }
```

This starts an independent bounded process, does not attach the current session, and captures only the runtime probe. Do not print or export environment variables, auth files, or full configuration.

Run a second bounded probe for auto-continue:

```powershell
opencode run `
  --agent orchestrator-delta `
  --model gauge-forge-openai/gpt-5.6-sol `
  --variant xhigh `
  --format json `
  --title "superpowers-lite-auto-continue-$stamp" `
  "Create exactly two local no-op todos. Complete only the first, leave the second pending, and end your first response. When auto-continued, complete the second and report the active agent name, model ID, and model variant. Do not modify files." `
  1> "$freshEvidence\auto-continue-probe.jsonl" `
  2> "$freshEvidence\auto-continue-probe.stderr.log"
if ($LASTEXITCODE -ne 0) { throw 'Fresh OpenCode auto-continue probe failed' }
```

- [ ] **Step 2: Verify the runtime matrix**

Prove in the fresh process:

- Lite bootstrap appears exactly once.
- `using-superpowers` is bootstrap-only and absent from skill-tool availability.
- `brainstorming`, `writing-plans`, and other Lite skills are discovered from `D:\superpowers-lite\skills`.
- orchestrator variants remain visible.
- active agent variant and active model override both survive auto-continue.
- Gauge Forge provider IDs are unchanged.
- Vault-Tec remains loaded after OMO.
- no duplicate skill/plugin names appear.
- no runtime path references `C:\Users\Administrator\.config\opencode\superpowers`.

- [ ] **Step 3: Exercise one real skill invocation and one non-orchestrator policy**

In the fresh process, invoke `writing-plans` from an orchestrator and confirm the loaded file is under `D:\superpowers-lite\skills`. Inspect a fixer/designer permission surface and confirm controller-only Lite skills remain denied while implementation skills remain allowed.

- [ ] **Step 4: Roll back immediately if the fresh-process matrix fails**

Do not delete the failed target. Restore the exact before-state:

```powershell
$failedOmo = "$configRoot\oh-my-opencode-slim-local.failed-$stamp"
Rename-Item -LiteralPath "$configRoot\oh-my-opencode-slim-local" -NewName (Split-Path -Leaf $failedOmo)
Rename-Item -LiteralPath "$configRoot\oh-my-opencode-slim-local.pre-cutover" -NewName 'oh-my-opencode-slim-local'
Copy-Item -LiteralPath "$evidence\opencode.json.before" -Destination "$configRoot\opencode.json"
Copy-Item -LiteralPath "$evidence\oh-my-opencode-slim.jsonc.before" -Destination "$configRoot\oh-my-opencode-slim.jsonc"
```

Then read back the restored config hashes and stop. Run this step only on semantic failure; on success, continue to review.

- [ ] **Step 5: Run independent semantic review**

Dispatch an oracle reviewer over the preserved request/startup/permission/readback artifacts. The reviewer answers only:

```text
Does the evidence prove that local Superpowers Lite is the sole active Superpowers source, OMO consumes the explicit Lite roster, stock fallback is absent, and all pre-existing OMO agent/model behavior remains intact?
```

Expected: PASS with evidence references, or a precise containment breach requiring rollback/fix.

- [ ] **Step 6: Preserve rollback readiness and report the publication gate**

Keep the before-backups and `oh-my-opencode-slim-local.pre-cutover` until the user validates their own new session. Report separately:

- local cutover semantic status;
- patch-kit working-tree status;
- whether patch-kit commit/push remains unauthorized.

Do not commit, push, release, delete backups, or remove the preserved upstream clone without a new explicit instruction.

---

## Final Acceptance Checklist

- [ ] Clean v1.1.2 implementation checkout passes complete OMO gate.
- [ ] Regenerated rollup applies to a second clean v1.1.2 checkout.
- [ ] Separate auto-continue patch still applies and preserves agent variant plus model override.
- [ ] Patch-kit templates contain only Lite + local OMO plugin entries.
- [ ] No active code path probes the retired stock Superpowers directory or fallback roster.
- [ ] Timestamped backups and integrity hashes exist before live mutation.
- [ ] User approved the redacted dry-run diff before cutover.
- [ ] Live config readback shows the exact Lite plugin and skills paths.
- [ ] Live config readback shows `preset = superpowers-bridge` and no missing-preset warning.
- [ ] Fresh-process semantic matrix passes.
- [ ] Independent reviewer approves the preserved runtime evidence.
- [ ] Current OpenCode process and retired upstream clone were not touched.
- [ ] Patch-kit remains uncommitted/unpushed unless separately authorized.
