# Design: Best-of-N with Judge for opencode

**Date:** 2026-05-04
**Status:** Draft (awaiting user review)
**Scope:** Add a `best-of-n-with-judge` capability to the existing
superpowers + oh-my-opencode-slim stack.
**Author:** orchestrator (with iterative user input)

---

## 1. Goal

Enable the orchestrator to dispatch N parallel candidate
implementations of the same task, have M reviewers cross-evaluate
all candidates, and land exactly one winner verbatim into the
user's branch — with deterministic cleanup of all losers.

This pattern is canonically called **Best-of-N with LLM-as-judge**
(NVIDIA GenSelect formalism, agentpatterns.ai "Recursive Best-of-N
Delegation"). Our specific shape:

- **N = 4** candidate fixers (`fixer-{alpha,beta,gamma,delta}`),
  each backed by a different model in the user's `oh-my-opencode-slim.jsonc`.
- **M = 4** oracle reviewers (`oracle-{alpha,beta,gamma,delta}`),
  blind-reviewing all candidates in parallel.
- **Tiebreaker:** `@council` arbitrates split votes (reuses existing
  consensus primitive).
- **No-winner:** redo loop, re-dispatch fixers with reviewer feedback.
- **Bonus:** ideation-stage fan-out reuses domain agents (oracle,
  librarian, explorer, designer) to provide multi-perspective approach
  proposals during brainstorming's "propose 2-3 approaches" phase.

## 2. Non-goals

- Modifying upstream omo-slim, superpowers, or opencode source code.
  Everything is additive at the user-config layer or omo-slim's
  bridge layer (which is already user-owned).
- Replacing or deprecating any existing skill or agent. Best-of-N
  is opt-in, opt-out, and composable.
- Implementing per-session cwd via plugin hooks. opencode upstream
  PR #9365 will deliver this; we will not race it.
- Auto-syncing variant base prompts with omo-slim source. Manual
  sync on omo-slim upgrade is acceptable (YAGNI for now).

## 3. Background and Constraints

### 3.1. Existing primitives we leverage

| Primitive | Location | Role |
|---|---|---|
| `@fixer` | omo-slim plugin | Implementation worker (base for variants) |
| `@oracle` | omo-slim plugin | Reviewer, with structured Strengths/Issues/Assessment verdict |
| `@designer` | omo-slim plugin | UI implementer (base for variants) |
| `@explorer` | omo-slim plugin | Read-only repo recon |
| `@librarian` | omo-slim plugin | External docs research |
| `@council` | omo-slim plugin | Consensus synthesis (escalation) |
| `dispatching-parallel-agents` | superpowers skill | Fan-out methodology for independent tasks |
| `using-git-worktrees` | superpowers skill | Worktree creation + .gitignore enforcement |
| `requesting-code-review` | superpowers skill | Single-candidate review template |
| `subagent-driven-development` | superpowers skill | Per-task review loop |

### 3.2. Architectural constraints discovered

**C1.** opencode native `task` tool **does not support per-call cwd**.
Child sessions inherit instance-wide `InstanceState.context.directory`
unconditionally. Source: `packages/opencode/src/tool/task.ts`.

**Consequence:** N parallel `task()` calls all share the same cwd.
Per-candidate isolation must therefore be handled by:
- Git worktrees (separate directory trees, but cwd still shared)
- Fixer prompt discipline (absolute paths in all tool calls)
- Hard-gate filtering as safety net

**C2.** opencode supports user-level agent definitions via
`~/.config/opencode/agents/<name>.md` and via `agent: { ... }`
in `opencode.json`. These coexist with plugin-registered agents.
`mode: subagent`, `hidden: true`, hyphenated names (`fixer-alpha`),
and `prompt: "{file:./path}"` are all officially supported.
Source: https://opencode.ai/docs/agents/

**Consequence:** Variant agents can be registered as plain markdown
files. Zero plugin modification required.

**C3.** Subagent invocation via `task` tool returns prose appended
to orchestrator's context, not structured JSON. Vote aggregation
must therefore happen in orchestrator's "thinking" turn, reading
each oracle's prose review and counting verdicts.

**Consequence:** The skill specifies a verdict-line convention
(e.g. `Verdict: merge candidate alpha`) for unambiguous parsing,
but does not enforce JSON schemas.

## 4. Architectural Decisions

| ID | Decision | Rationale |
|---|---|---|
| D1 | Variants registered as user-level markdown agents | Zero plugin modification; survives omo-slim upgrades |
| D2 | Worktree shape: full git worktree + named branches | Free diff/cherry-pick/cleanup tooling; deterministic state |
| D3 | Worktree path: `<main-repo>/.worktrees/bestofn-<slug>-<ts>/<variant>/` | Reuses superpowers convention; `bestofn-` prefix is the cleanup safety key |
| D4 | Resolve to main repo via `git rev-parse --git-common-dir` | Avoid worktree nesting when user is already in a feature worktree |
| D5 | Refuse fan-out on dirty working copy | Stash-based alternatives produce inconsistent baselines across candidates |
| D6 | Winner lands via cherry-pick or squash-merge | Keeps user branch history clean; ephemeral candidate branches do not pollute log |
| D7 | All cleanup runs unconditionally (success / failure / abort) | Users do not review losers; archive is YAGNI |
| D8 | State persisted at `<main-repo>/.opencode/bestofn-state/<task-id>.json` | Survives interruption; supports both registry-based and glob-based recovery |
| D9 | Oracle methodology unchanged; one-line verdict convention added | Existing oracle review structure is already strong; do not reinvent |
| D10 | Council handles split-vote arbitration | Reuses existing escalation primitive; council does the multi-LLM consensus that is its core competence |
| D11 | Redo loop limited to 1 retry by default (configurable up to 3) | Prevents runaway loops; failure escalates to user |
| D12 | Brainstorming ideation fan-out reuses domain agents | Existing oracle/librarian/explorer/designer prompts already encode diverse expert lenses |
| D13 | Variant counts: fixer×4, oracle×4, designer×4, explorer×2, librarian×2 | Matches user request; no observer variants (single-task focused) |
| D14 | Fixer cwd isolation via prompt discipline + hard-gate safety net | Architectural limit; safety nets compensate; future PR #9365 unlocks proper fix |

## 5. Component Inventory

```
~/.config/opencode/
+-- agents/                                  (NEW, 16 files)
|   +-- fixer-alpha.md
|   +-- fixer-beta.md
|   +-- fixer-gamma.md
|   +-- fixer-delta.md
|   +-- oracle-alpha.md
|   +-- oracle-beta.md
|   +-- oracle-gamma.md
|   +-- oracle-delta.md
|   +-- designer-alpha.md
|   +-- designer-beta.md
|   +-- designer-gamma.md
|   +-- designer-delta.md
|   +-- explorer-alpha.md
|   +-- explorer-beta.md
|   +-- librarian-alpha.md
|   +-- librarian-beta.md
+-- prompts/                                 (NEW, 5 files)
|   +-- fixer-base.md
|   +-- oracle-base.md
|   +-- designer-base.md
|   +-- explorer-base.md
|   +-- librarian-base.md
+-- skills/best-of-n-with-judge/             (NEW)
|   +-- SKILL.md
|   +-- candidate-prompt-template.md         (template fragment)
|   +-- judge-prompt-template.md             (template fragment)
|   +-- redo-prompt-template.md              (template fragment)
+-- oh-my-opencode-slim/superpowers-bridge/  (EXISTING)
|   +-- oracle_append.md                     (PATCH: +5 lines)
|   +-- orchestrator_append.md               (PATCH: +6 lines)
```

Net diff:
- 16 new variant agent markdown files (~10 lines each, ~160 lines total)
- 5 new shared prompt files (~30-80 lines each, copied from omo-slim source)
- 1 new SKILL.md (~300 lines) + 3 prompt template fragments (~80 lines)
- 2 patched bridge files (+11 lines)
- **Zero source-code changes.**

## 6. Variant Agent Schema

**Architecture revised after smoke testing (see Changelog v0.2):** model
assignments are now centralized in `opencode.json` under the top-level
`agent` block. The variant md files carry only the behavioral contract.

Each variant agent is a markdown file with YAML frontmatter:

```yaml
---
description: One-liner explaining what this variant is, surfaced to the
  task tool's routing layer. Include "(best-of-N variant of <base>)" so
  the orchestrator can identify it in agent listings.
mode: subagent
hidden: true                # not in @ autocomplete; task tool can still call
temperature: <as-base>      # behavioral, not retuned often; stays in md
permission:
  edit: <as-base>           # variants inherit base permissions
  bash: <as-base>
  task: deny                # variants do not dispatch other subagents
prompt: "{file:../prompts/<base>-base.md}"
---

You are running as variant <name> in a best-of-N fan-out.
<Variant-specific notes appended to the shared base prompt body.>
```

Model and reasoning-effort variant assignments live in `opencode.json`:

```json
"agent": {
  "fixer-alpha":  { "model": "gauge-forge-openai/gpt-5.5" },
  "fixer-beta":   { "model": "gauge-forge-anthropic/claude-opus-4-7" },
  "fixer-gamma":  { "model": "gauge-forge-openai/gpt-5.4", "variant": "xhigh" },
  "fixer-delta":  { "model": "gauge-forge-anthropic/claude-sonnet-4-6" },
  ...
}
```

opencode merges `agent.<name>` from `opencode.json` over the markdown
agent definition field-by-field. JSON wins on any field it specifies
(scalars override; permissions deep-merge). This lets us change model
assignments by editing one JSON file instead of 16 markdown files.

The shared `prompts/<base>-base.md` files contain the canonical agent
prompt copied from `oh-my-opencode-slim-local/src/agents/<base>.ts`
plus the corresponding `superpowers-bridge/<base>_append.md`. This
keeps the methodology stable across all variants. Manual re-sync on
omo-slim upgrade.

### 6.1. Model assignment guidance (user fills jsonc to taste)

| Variant | Suggested model class | Rationale |
|---|---|---|
| `*-alpha` | Fast, cheap (e.g. gpt-5.5 medium) | First responder, broad coverage |
| `*-beta` | Different vendor (e.g. claude-opus / gemini) | Diversity by training corpus |
| `*-gamma` | Strong reasoning (e.g. claude-opus high) | Deep analytical voice |
| `*-delta` | Different vendor again or specialized model | Tiebreaker / unconventional angle |

The skill does not hardcode model choices. Users configure via their
`oh-my-opencode-slim.jsonc` (or directly in each variant's frontmatter
if they prefer per-variant model strings).

## 7. The best-of-n-with-judge Skill

### 7.1. Trigger conditions

The orchestrator loads this skill when:

1. The user explicitly says "fan out", "best of N", "parallel candidates",
   "tournament", or equivalent.
2. The orchestrator has decided to use `dispatching-parallel-agents` AND
   the dispatched work is N implementations of the same task (not N
   independent tasks).
3. During brainstorming's "propose 2-3 approaches" phase, when ideation
   diversity warrants multi-perspective input (uses domain-agent fan-out
   sub-mode, see 7.6).

### 7.2. Phase pipeline

```
Phase 0: Pre-flight verification
Phase 1: Worktree setup
Phase 2: Candidate dispatch (4 fixer variants in parallel)
Phase 3: Hard-gate filter (tests + lint per candidate)
Phase 4: Blind oracle review (4 oracle variants in parallel)
Phase 5: Vote aggregation (orchestrator-internal turn)
Phase 6a: Council arbitration  (only if Phase 5 split)
   or
Phase 6b: Redo loop             (only if Phase 5 majority "none")
Phase 7: Winner landing
Phase 8: Cleanup (always runs)
```

### 7.3. Phase 0 — Pre-flight

```
1. Verify git repo:
     git rev-parse --git-dir
2. Verify clean WC:
     git status --porcelain == empty
     If dirty -> abort with explicit message instructing user
     to commit or stash.
3. Resolve main repo:
     MAIN_GIT=$(git rev-parse --git-common-dir)
     MAIN_REPO=$(dirname "$MAIN_GIT")
4. Capture base branch:
     BASE_BRANCH=$(git rev-parse --abbrev-ref HEAD)
     BASE_WORKTREE=$(pwd)
5. Generate task identity:
     SLUG=<short kebab-case derived from task description, ~30 chars>
     TS=<UTC timestamp YYYYMMDDHHMM>
     TASK_ID="${SLUG}-${TS}"
6. Sweep stale candidates from prior runs:
     For each path matching $MAIN_REPO/.worktrees/bestofn-*:
       For each branch matching refs/heads/bestofn/*:
         Check $MAIN_REPO/.opencode/bestofn-state/*.json
     Report stale items to user; ask: clean / abort / proceed-and-keep.
7. Verify .worktrees/ is gitignored (delegate to using-git-worktrees skill
   if not already configured).
8. Verify .opencode/ is gitignored (add to .gitignore if missing).
```

### 7.4. Phase 1 — Worktree setup

```
For each variant in [alpha, beta, gamma, delta]:
  WORKTREE_PATH="$MAIN_REPO/.worktrees/bestofn-${TASK_ID}/${variant}"
  CANDIDATE_BRANCH="bestofn/${TASK_ID}/${variant}"
  git worktree add "$WORKTREE_PATH" -b "$CANDIDATE_BRANCH" "$BASE_BRANCH"
  Append (variant, WORKTREE_PATH, CANDIDATE_BRANCH, status="setup") to registry
  Persist state file:
    $MAIN_REPO/.opencode/bestofn-state/${TASK_ID}.json
```

### 7.5. Phase 2 — Candidate dispatch

```
In parallel (4 task() calls, single orchestrator turn):
  task(
    subagent_type = "fixer-${variant}",
    description = "best-of-N candidate ${variant}",
    prompt = <CANDIDATE_PROMPT_TEMPLATE filled with:>
      - your worktree absolute path
      - explicit cwd discipline (use absolute paths; bash with cd prefix)
      - the task spec (full context)
      - testing requirements (must pass before returning)
      - commit requirement (must commit your work to your branch)
      - return format (a brief summary of what you implemented)
  )
```

Candidate prompt template (`candidate-prompt-template.md`):

```
You are fixer variant {variant} in a best-of-N fan-out.

Your isolated working directory is: {WORKTREE_PATH}
Your branch is: {CANDIDATE_BRANCH}

CWD DISCIPLINE (CRITICAL):
- All read/write tool calls MUST use absolute paths starting with
  {WORKTREE_PATH}.
- All bash calls MUST be prefixed with `cd {WORKTREE_PATH} && `.
- Do not read or write any file outside {WORKTREE_PATH}.
- Verify your cwd before every bash call: `cd {WORKTREE_PATH} && pwd`
  should print {WORKTREE_PATH}.

TASK SPEC:
{TASK_SPEC}

REQUIREMENTS:
- Implement the spec.
- All existing tests must continue to pass within your worktree.
- Lint must pass within your worktree.
- Commit your work to {CANDIDATE_BRANCH} with a descriptive message.
- If multiple commits are natural, that is fine.

RETURN:
- Summary of your implementation approach.
- Confirmation tests pass.
- Confirmation lint passes.
- The commit SHAs you produced.
```

### 7.6. Phase 2-alt — Ideation fan-out (brainstorming sub-mode)

When triggered from brainstorming's propose-approaches phase:

```
In parallel (4 task() calls):
  task(subagent_type = "oracle-alpha",  prompt = ideation_prompt(architectural_lens))
  task(subagent_type = "librarian-alpha", prompt = ideation_prompt(prior_art_lens))
  task(subagent_type = "explorer-alpha", prompt = ideation_prompt(codebase_lens))
  task(subagent_type = "designer-alpha", prompt = ideation_prompt(ux_lens))

Each returns 1-2 candidate approaches with rationale.
Orchestrator dedupes, summarizes, presents to user as part of normal
brainstorming Phase 4 (propose-approaches).
```

This sub-mode shares no worktrees, no judges, no winner-landing — it
is purely a multi-voice ideation step that feeds back into the standard
brainstorming flow.

### 7.7. Phase 3 — Hard-gate filter

```
For each candidate:
  cd <worktree>
  Run project tests (auto-detect: pnpm/npm/cargo/pytest/go test/...)
  Run linter (auto-detect: eslint/clippy/ruff/biome/...)
  Confirm git diff $BASE_BRANCH..HEAD is non-empty

  Update registry: status = passed | failed | empty-diff

If 0 candidates pass:
  Skip to Phase 6b (redo loop) with feedback "all candidates failed
  hard gate".
If 1 candidate passes:
  Skip to Phase 7 (land) with that candidate as winner.
Otherwise:
  Proceed to Phase 4.
```

### 7.8. Phase 4 — Blind oracle review

```
Compute per-candidate diff:
  CANDIDATE_DIFF[v] = git diff $BASE_BRANCH..bestofn/${TASK_ID}/${v}

In parallel (4 task() calls):
  task(
    subagent_type = "oracle-${variant}",
    description = "best-of-N reviewer ${variant}",
    prompt = <JUDGE_PROMPT_TEMPLATE filled>
  )
```

Judge prompt template (`judge-prompt-template.md`):

```
You are oracle variant {variant} reviewing 4 candidate implementations
of the same task in a best-of-N fan-out.

TASK SPEC (what was asked):
{TASK_SPEC}

CANDIDATES (each is a complete diff against the base branch):

=== Candidate A ===
{DIFF_A}

=== Candidate B ===
{DIFF_B}

=== Candidate C ===
{DIFF_C}

=== Candidate D ===
{DIFF_D}

(Note: candidate labels A/B/C/D have been shuffled per reviewer to
prevent positional bias. The skill maps your verdict back to the
real variant ID.)

INSTRUCTIONS:

Apply your standard Superpowers review methodology to each candidate
independently. For each, identify Strengths and Issues
(Critical/Important/Minor) with file:line references.

Then conclude with a single verdict line in this exact format:

  Verdict: merge candidate <X>

OR

  Verdict: none of these are mergeable

Where <X> is one of A, B, C, D. The verdict line must be the LAST
line of your response. Provide one paragraph of comparative rationale
just above the verdict line.
```

Per-reviewer label shuffling is implemented by orchestrator
maintaining a per-reviewer `LABEL_MAP[reviewer] -> {A: variant, ...}`
and translating the verdict back. This is opt-in; if the orchestrator
finds shuffling burdensome, labels can match variant names directly
at the cost of some position bias.

### 7.9. Phase 5 — Vote aggregation (orchestrator turn)

```
votes = []
for each oracle response:
  parse final "Verdict:" line
  resolve real variant (via LABEL_MAP if shuffled)
  append to votes

count_by_variant = Counter(votes excluding "none")
none_count = count("none" in votes)

decision = case:
  none_count >= 3:                           -> Phase 6b (redo)
  max(count_by_variant.values) >= 3:         -> winner = argmax       (supermajority/unanimous)
  max(count_by_variant.values) == 2 with no
  other 2-tie:                               -> winner = that variant (clear plurality)
  multiple variants tied:                    -> Phase 6a (council)
  no variant has >=2 votes (4-way 1-1-1-1):  -> Phase 6a (council)
```

### 7.10. Phase 6a — Council arbitration

```
task(
  subagent_type = "council",
  description = "best-of-N tiebreaker",
  prompt = <COUNCIL_TIEBREAKER_PROMPT filled with:>
    - task spec
    - all 4 candidate diffs (full)
    - all 4 oracle reviews (full text)
    - the vote tally and why orchestrator escalated
)

Council uses its existing default preset and consensus protocol.
Council returns either:
  Verdict: merge candidate <variant>
  OR
  Verdict: none -> redo
```

### 7.11. Phase 6b — Redo loop

```
Aggregate feedback:
  per_candidate_feedback[v] = concatenate all oracle critiques
                              specific to candidate v
  shared_feedback = patterns across multiple oracle reviews
                    that appeared as common issues

If redo_count >= max_redos (default 1):
  Escalate to user with full context. Stop.

redo_count += 1

For each variant in [alpha, beta, gamma, delta]:
  In parallel (4 task() calls):
    task(
      subagent_type = "fixer-${variant}",
      description = "best-of-N redo ${variant}",
      prompt = <REDO_PROMPT_TEMPLATE filled with:>
        - your worktree path (REUSED, branch reset to base)
        - same task spec
        - your previous attempt's specific feedback
        - shared feedback across all candidates
        - explicit "this is a redo, address the feedback"
    )

Reset candidate branches:
  git -C <worktree> reset --hard $BASE_BRANCH
  git -C <worktree> clean -fdx

Re-run from Phase 3 (hard-gate filter).
```

### 7.12. Phase 7 — Winner landing

```
cd $BASE_WORKTREE
WINNER_BRANCH=bestofn/${TASK_ID}/${winner}

commit_count=$(git rev-list --count $BASE_BRANCH..$WINNER_BRANCH)
if commit_count == 1:
  git cherry-pick $WINNER_BRANCH
elif commit_count > 1:
  git merge --squash $WINNER_BRANCH
  git commit -F <(generate_squashed_commit_message)

Verify post-land:
  git status --porcelain  # should be clean except staged commit
  Run tests + lint in $BASE_WORKTREE
  If tests fail post-land:
    Diagnose (rare): typically a base-branch drift between fan-out
    start and now. Roll back via `git reset --hard HEAD~1`, alert user.

Generated commit message format:
  <winner's commit subject>

  <winner's commit body>

  Best-of-N selection from 4 candidates.
  Winner: ${winner} | Vote: <tally>
  Reviewers: oracle-{alpha,beta,gamma,delta}
  [Council: arbitrated tiebreak | Redo: round 2 | Sanity: clean]
  Task: ${SLUG} | Time: ${TS}

  Generated via best-of-n-with-judge skill.
```

### 7.13. Phase 8 — Cleanup

See section 9 (Cleanup Discipline) for full detail.

## 8. Bridge Layer Patches

### 8.1. `oracle_append.md` (current text + addition)

Existing:

```
You are filling the Superpowers reviewer, debugger, and adjudicator role.

Operating rules:
- Default role: spec reviewer, code-quality reviewer, final reviewer, or debugging adjudicator.
- Read the actual code and diff. Do not trust implementer summaries at face value.
- For debugging and feedback disputes, use evidence and technical reasoning.
- Before saying work is complete or ready, follow `superpowers:verification-before-completion` when it is available.
- Use file:line references for concrete findings.
- Do not take over planning or execution flow control unless the controller explicitly changes your role.
```

Append:

```
Multi-candidate review (best-of-N mode):
- When the controller dispatches a review of N candidate implementations
  of the same task, apply your standard methodology to each candidate
  independently.
- Conclude your response with a single explicit verdict line in this
  exact format: "Verdict: merge candidate <ID>" or
  "Verdict: none of these are mergeable". The verdict line must be the
  LAST line of your response.
- Provide one paragraph of comparative rationale immediately above the
  verdict line.
```

### 8.2. `orchestrator_append.md` (current text + addition)

Existing (full text already in role contract elsewhere).

Append:

```
Best-of-N awareness:
- When the user explicitly requests fan-out / best-of-N / parallel
  candidates, OR when you decide to use dispatching-parallel-agents
  for N implementations of the same task (not N independent tasks),
  invoke the best-of-n-with-judge skill.
- Variant agents are pre-registered for this purpose:
  fixer-{alpha,beta,gamma,delta}, oracle-{alpha,beta,gamma,delta},
  designer-{alpha,beta,gamma,delta}, explorer-{alpha,beta},
  librarian-{alpha,beta}.
- Best-of-N is opt-in. Do not auto-trigger for routine bounded tasks.
```

## 9. Cleanup Discipline

### 9.1. Pollution sources and lifecycle

| Source | Origin | Cleanup mechanism |
|---|---|---|
| `.git/worktrees/<name>/` metadata | `git worktree add` | `git worktree remove` clears it |
| `bestofn/<task-id>/<variant>` branches | `-b` flag on add | `git branch -D <name>` |
| `.worktrees/bestofn-<task-id>/` directory | `worktree add` creates leaf, skill creates parent | `rmdir` parent after children removed |
| Build artifacts in worktrees (node_modules etc) | candidate execution | removed transitively with worktree |
| `.opencode/bestofn-state/<task-id>.json` | skill writes | skill deletes on success; sweep deletes on stale detection |

### 9.2. Cleanup is unconditional

Cleanup runs in three contexts:
1. Normal completion (after Phase 7 lands winner).
2. Failure path (any phase aborts).
3. Skill interruption (next skill invocation detects stale state).

There is no "preserve losers for inspection" mode. Users do not
review losers; if losers had useful insights, those are reflected
in the oracle reviews and the redo loop.

### 9.3. Recovery strategy ladder

For each tracked worktree, attempt deletion in this order:

```
1. NORMAL:    git worktree remove "<path>"
2. FORCE:     git worktree remove --force "<path>"
3. PRUNE:     rm -rf "<path>" && git worktree prune
4. ESCALATE:  add to escalation list, continue
```

For each tracked branch:

```
1. NORMAL:    git branch -D "<branch>"
2. RECOVER:   git worktree list | grep "<branch>" -> force-remove that worktree -> retry NORMAL
3. ESCALATE:  add to escalation list, continue
```

After the loop, if escalation list is non-empty:
- Print red banner with list of unrecoverable items.
- Append to `.opencode/bestofn-failed-cleanups.log`.
- Print copy-paste-ready manual cleanup commands.
- Skill exits with non-zero status, marking task failed.

### 9.4. State persistence schema

`<main-repo>/.opencode/bestofn-state/<task-id>.json`:

```json
{
  "task_id": "auth-fix-202605041534",
  "slug": "auth-fix",
  "timestamp": "202605041534",
  "base_branch": "feature-foo",
  "base_worktree_path": "/path/to/main/.worktrees/feature-foo",
  "main_repo_path": "/path/to/main",
  "candidates": [
    {
      "variant": "alpha",
      "worktree_path": "/path/.worktrees/bestofn-auth-fix-202605041534/alpha",
      "branch_name": "bestofn/auth-fix-202605041534/alpha",
      "status": "passed-hardgate",
      "tests": "passed",
      "lint": "passed",
      "diff_lines": 47
    },
    "..."
  ],
  "judge_state": {
    "phase": "vote-aggregation",
    "oracle_responses": {
      "alpha": "<full prose>",
      "beta": "<full prose>",
      "gamma": "<full prose>",
      "delta": "<full prose>"
    },
    "votes": ["alpha", "alpha", "beta", "alpha"],
    "winner": "alpha",
    "council_invoked": false,
    "redo_count": 0
  },
  "phase": "land",
  "started_at": "2026-05-04T15:34:00Z",
  "last_updated": "2026-05-04T15:39:12Z"
}
```

State file is updated at each phase transition. Deleted on successful
Phase 8 completion. Lingering files indicate interrupted runs.

### 9.5. Failure mode catalogue

| ID | Mode | Detection | Recovery |
|---|---|---|---|
| F1 | Worktree dirty | `git worktree remove` reports "dirty" | --force, then PRUNE |
| F2 | File lock (Windows) | rm/remove EBUSY/EACCES | retry 3x with backoff (1/3/5s), then escalate |
| F3 | Branch checked out elsewhere | `git branch -D` reports "checked out at" | find via `worktree list`, force-remove that, retry |
| F4 | Parent dir non-empty (user content) | `rmdir` non-empty | warn user, do not delete |
| F5 | SIGINT mid-flight | next run detects stale state files | pre-flight prompts user |
| F6 | State file corrupted | JSON parse error | glob-fallback discovery |
| F7 | Disk full mid-fanout | tool errors during setup | immediate cleanup of partial state, error to user |
| F8 | Concurrent best-of-N | path uniqueness via timestamp slug | refuse to start if collision |
| F9 | Main repo `.git` corruption | git operations fail with fatal errors | abort, do not proceed |
| F10 | User /abort | command intercept | run cleanup as if normal completion |

### 9.6. Idempotency

All cleanup operations are idempotent:
- `git worktree remove` on already-removed: error, ignored
- `git branch -D` on already-deleted: error, ignored
- `rm -rf` on missing: no-op
- State file deletion on missing: no-op

Re-running cleanup is always safe.

### 9.7. Manual escape hatch

The skill documents (in its README/SKILL.md) the raw commands a user
can run if the skill itself is dead:

```bash
# Discovery
git worktree list | grep bestofn-
git for-each-ref --format='%(refname:short)' refs/heads/bestofn/

# Forced cleanup
for w in $(git worktree list --porcelain | grep -A1 bestofn- | grep worktree | cut -d' ' -f2); do
  git worktree remove --force "$w"
done

for b in $(git for-each-ref --format='%(refname:short)' refs/heads/bestofn/); do
  git branch -D "$b"
done

git worktree prune
rm -rf .worktrees/bestofn-* .opencode/bestofn-state/
```

## 10. CWD Discipline (Safety Architecture)

opencode's task tool architecturally cannot scope cwd per child
session. We compensate with three layers:

### 10.1. Layer 1 — Prompt discipline

Every `fixer-*` candidate prompt explicitly states:
- Working directory absolute path
- Tool-call rules (absolute paths only)
- Bash prefix rule (`cd <abs path> && <cmd>`)
- Pre-bash sanity check (`pwd` must equal expected path)

The orchestrator and fixers run smart models; in practice they comply.

### 10.2. Layer 2 — Hard-gate filter

After Phase 2 returns, Phase 3 runs tests and lint **in each
candidate's worktree**. If a fixer wrote to the wrong location:
- The candidate's worktree contains no actual changes -> empty diff
  -> filtered out as `empty-diff`.
- The candidate's worktree may have inconsistent state -> tests fail
  -> filtered out.

### 10.3. Layer 3 — Post-land sweep

After Phase 7 lands the winner:
- `cd $BASE_WORKTREE` (user's original location)
- Check `git status --porcelain` for unexpected uncommitted changes
- Any unexpected files indicate cwd-discipline failure
- Alert user with file list, do not auto-touch

### 10.4. Future improvement

When opencode upstream PR #9365 (per-session cwd in task tool) lands,
this skill should be refactored to drop layers 1 and 3 and rely on
opencode's native cwd plumbing. The skill structure itself remains
unchanged.

## 11. Open Risks

| Risk | Severity | Mitigation |
|---|---|---|
| R1: cwd discipline failure poisons main repo | High | 3-layer safety (prompt + hard-gate + post-sweep); future PR #9365 unlocks proper fix |
| R2: variant base prompts drift from omo-slim source | Medium | Manual sync on omo-slim upgrade documented in SKILL.md; future automation YAGNI |
| R3: 4x disk + 4x compute on every fan-out | Medium | Best-of-N is opt-in only; not the default for routine work |
| R4: oracles vote consistently due to model homogeneity | Medium | User configures diverse models per variant in jsonc; council escalation catches degenerate cases |
| R5: redo loop infinite in pathological spec ambiguity | Low | Hard cap (default 1, max 3) + escalation to user |
| R6: cleanup leaves orphan branches if user kills mid-run | Low | State file + glob-fallback sweep on next run |
| R7: position bias in oracle judging | Low | Per-reviewer label shuffling (optional but recommended) |
| R8: redo prompt too vague, fixer repeats same mistake | Medium | Aggregated per-candidate + shared-pattern feedback structure |

## 12. Implementation Order (high-level; plan stage will detail)

```
Order   Task                                                    Est size
-----   -----------------------------------------------------   --------
T1      Copy omo-slim agent prompts to ~/.config/opencode/      Trivial
        prompts/<base>-base.md (5 files)
T2      Author 16 variant agent markdown files                  Small
T3      Write best-of-n-with-judge SKILL.md (core methodology)  Medium-Large
T4      Write 3 prompt templates (candidate / judge / redo)     Small
T5      Patch oracle_append.md (+5 lines)                       Trivial
T6      Patch orchestrator_append.md (+6 lines)                 Trivial
T7      Add .opencode/ to project .gitignore (where applicable) Trivial
T8      End-to-end smoke test on a small dummy task             Small
T9      Document manual cleanup escape hatch in SKILL.md README Small
T10     Document model-assignment guidance in jsonc comments    Small
```

## 13. References

- agentpatterns.ai "Recursive Best-of-N Delegation"
- NVIDIA GenSelect (arxiv.org/abs/2507.17797)
- Anthropic "Building effective agents" (orchestrator-workers + evaluator-optimizer)
- spencerpauly/awesome-cursor-skills/best-of-n-solving (SKILL.md format reference)
- opencode native task tool source: packages/opencode/src/tool/task.ts
- opencode user agent docs: https://opencode.ai/docs/agents/
- opencode upstream PR #9365 (per-session cwd, future)
- omo-slim CouncilManager (precedent for SDK-direct, retained for council use only)
- superpowers using-git-worktrees skill (worktree convention reused)
- superpowers requesting-code-review skill (single-candidate review template)

## 14. Changelog

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-05-04 | Initial draft after iterative brainstorming |
| 0.2 | 2026-05-04 | Post-smoke-test refactor: moved `model` and `variant` fields out of variant md frontmatter into centralized `opencode.json` `agent` block. Single source of truth for model assignments. Updated Section 6 schema. Variant md files now carry only behavioral contract. T3 smoke also surfaced gpt-5.5-pro subscription block; gamma variants reassigned to gpt-5.4 + xhigh reasoning effort. |
| 0.3 | 2026-05-04 | Strategic model-tier expansion after dual @oracle + @librarian critique on cheap-model role. Three additions: (1) `fixer-delta` re-cast as deliberate naive-challenger lane on gpt-5.4-mini for "simple-baseline" diversity in implementation fan-out; (2) added 3 fast-lane base utility agents @scout (haiku, narrow file lookup), @validator (mini, format check), @gist (haiku, 3-line summarizer); (3) added @wildcard (mini, high temp) as 5th ideation participant alongside 4 domain alpha-variants. Cheap models now have explicit ecological niches outside the strong-tier variant pool. `explorer-alpha` and `explorer-beta` upgraded (gpt-5.4-medium → gpt-5.5-high; haiku → sonnet) per consensus that hot-path recon needs competence floor. |
| 0.4 | 2026-05-04 | Architecture migration to omo-slim hosting. After discovering omo-slim supports custom-agent registration via `getCustomAgentNames()` (not just `SUBAGENT_FACTORIES`), migrated all 16 variants + 4 utility agents from `opencode.json` agent block into `oh-my-opencode-slim.jsonc` `presets.superpowers-bridge`. Each agent now has per-variant `orchestratorPrompt` injection. Source patches to `oh-my-opencode-slim-local/src/cli/superpowers-policy.ts` (added `resolveBaseAgentName` function with suffix-stripping; added `validator/scout/gist/wildcard` to `AGENT_ALLOWED_SUPERPOWERS` map) and `src/cli/skills.ts` (use resolved name in `RECOMMENDED_SKILLS`/`CUSTOM_SKILLS`/`PERMISSION_ONLY_SKILLS` allowedAgents checks) ensure variants inherit base superpowers policy automatically. Markdown files retain `permission`/`hidden`/`mode` (opencode-native fields omo-slim does not manage). `opencode.json` agent block now contains only `explore`/`general` disable entries. Non-superpowers skills and non-omo MCPs preserved by design (no explicit `skills:` arrays in jsonc; omo-slim only synthesizes managed-MCP rules). |

---

End of design document. Awaiting user review before invoking writing-plans skill.
