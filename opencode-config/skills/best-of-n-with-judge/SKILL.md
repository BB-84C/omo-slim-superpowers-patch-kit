---
name: best-of-n-with-judge
description: Use when one task has multiple plausible solutions and you want to generate N candidates in parallel, gate them on tests/lint, then have M oracle reviewers blind-vote a single winner. Triggers - best-of-N, tournament selection, jury, parallel candidates, competitive generation, "fan out", "pick the best".
---

# Best-of-N with Judge

## Overview

Generate N parallel candidate implementations of the same task, hard-gate
them on tests + lint, dispatch M oracle reviewers to blind-review and vote,
escalate splits to `@council`, run a redo loop on no-winner, land exactly
one winner via cherry-pick or squash-merge, and clean up all losers
deterministically.

**Core principle:** Diversity (different models per variant) + isolation
(git worktrees) + structured voting + bounded redo + unconditional cleanup.

**Announce at start:** "I'm using the best-of-n-with-judge skill to fan out
this task across N candidates."

## When to Use

Trigger this skill when ANY of these are true:

1. The user explicitly says "fan out", "best of N", "parallel candidates",
   "tournament", "ensemble", or asks you to generate multiple competing
   implementations.

2. You decided to use `dispatching-parallel-agents` AND the work is N
   implementations of the SAME task (not N independent tasks). If the
   tasks are independent (different test files, different bugs), use
   `dispatching-parallel-agents` directly without this skill.

3. The work has high stakes / multiple plausible approaches and the user
   has not specified a single approach.

4. Brainstorming Phase 4 (propose 2-3 approaches) — see Section "Ideation
   Sub-Mode" below for the read-only, no-worktree variant.

**Do NOT trigger for:**
- Routine bounded tasks where a single `@fixer` suffices.
- Tasks where the user has dictated a specific approach.
- Pure-research tasks (use `@librarian` / `@explorer` directly).

## Architecture Constraints (read first)

- opencode's native `task` tool **cannot pass per-call cwd**. All child
  sessions share the orchestrator's instance cwd. Per-candidate isolation
  therefore requires (a) git worktrees for separate directory trees,
  (b) fixer prompt discipline (absolute paths only), (c) hard-gate
  filtering as safety net.

- This skill uses git worktrees + branches as the canonical isolation
  primitive. Path: `<main-repo>/.worktrees/bestofn-<slug>-<ts>/<variant>/`,
  branch: `bestofn/<slug>-<ts>/<variant>`.

- Variant agents are pre-registered: `fixer-{alpha,beta,gamma,delta}`,
  `oracle-{alpha,beta,gamma,delta}`, `designer-{alpha,beta,gamma,delta}`,
  `explorer-{alpha,beta}`, `librarian-{alpha,beta}`. Each backed by a
  different model. NB: `fixer-delta` is a deliberate "naive challenger"
  lane (gpt-5.4-mini) — kept in the pool to surface obvious-simple
  baselines the stronger variants overthink past.
- Ideation sub-mode also dispatches `@wildcard` (mini-tier, high temp)
  alongside the four domain agents for cheap-noise divergent proposals.

## Phase Pipeline

```
Phase 0: Pre-flight verification         (sweep stale, verify clean WC)
Phase 1: Worktree setup                  (4 git worktree add, state file)
Phase 2: Candidate dispatch              (4 fixer variants, parallel task())
Phase 3: Hard-gate filter                (tests + lint per worktree)
Phase 4: Blind oracle review             (4 oracle variants, parallel task())
Phase 5: Vote aggregation                (read prose verdicts, count)
Phase 6a: Council arbitration            (only on split votes)
Phase 6b: Redo loop                      (only on majority "none")
Phase 7: Winner landing                  (cherry-pick / squash-merge)
Phase 8: Cleanup                         (always runs, success or failure)
```

## Phase 0 — Pre-flight

```bash
# 1. Verify in a git repo
git rev-parse --git-dir || abort

# 2. Verify clean working copy
[[ -z "$(git status --porcelain)" ]] || abort_with_message "WC dirty. Commit or stash before fan-out."

# 3. Resolve main repo (handles user being in a feature worktree)
MAIN_GIT="$(git rev-parse --git-common-dir)"
MAIN_REPO="$(dirname "$MAIN_GIT")"

# 4. Capture current state
BASE_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
BASE_WORKTREE="$(pwd)"

# 5. Generate task identity (slug = kebab-case from task description, ~30 chars)
SLUG="<derived-from-task-description>"
TS="$(date -u +%Y%m%d%H%M)"
TASK_ID="${SLUG}-${TS}"

# 6. SWEEP 1 - detect stale candidates from prior runs
ls "$MAIN_REPO/.worktrees/bestofn-"* 2>/dev/null
git -C "$MAIN_REPO" for-each-ref --format='%(refname:short)' refs/heads/bestofn/
ls "$MAIN_REPO/.opencode/bestofn-state/" 2>/dev/null
# If any stale: report to user, ask: clean / abort / proceed-keeping-stale

# 7. Verify .worktrees/ is gitignored in user's project (delegate to using-git-worktrees skill if not)

# 8. Verify .opencode/ is gitignored (add the line and commit if missing)
grep -q '^\.opencode/' "$MAIN_REPO/.gitignore" || {
  echo '.opencode/' >> "$MAIN_REPO/.gitignore"
  git -C "$MAIN_REPO" add .gitignore
  git -C "$MAIN_REPO" commit -m "chore: gitignore .opencode/ ephemeral state"
}
```

## Phase 1 — Worktree Setup

```bash
mkdir -p "$MAIN_REPO/.opencode/bestofn-state"

# Initialize state file
STATE_FILE="$MAIN_REPO/.opencode/bestofn-state/${TASK_ID}.json"
cat > "$STATE_FILE" <<EOF
{
  "task_id": "${TASK_ID}",
  "slug": "${SLUG}",
  "timestamp": "${TS}",
  "base_branch": "${BASE_BRANCH}",
  "base_worktree_path": "${BASE_WORKTREE}",
  "main_repo_path": "${MAIN_REPO}",
  "candidates": [],
  "judge_state": {"phase": "setup"},
  "phase": "setup",
  "started_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "last_updated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# Create 4 worktrees
for variant in alpha beta gamma delta; do
  WORKTREE_PATH="$MAIN_REPO/.worktrees/bestofn-${TASK_ID}/${variant}"
  CANDIDATE_BRANCH="bestofn/${TASK_ID}/${variant}"
  git -C "$MAIN_REPO" worktree add "$WORKTREE_PATH" -b "$CANDIDATE_BRANCH" "$BASE_BRANCH"
  # Update STATE_FILE candidates array with {variant, worktree_path, branch_name, status="setup"}
done
```

## Phase 2 — Candidate Dispatch

Use the `task` tool 4 times in parallel from a single orchestrator turn.
Each call passes the candidate prompt template (see
`candidate-prompt-template.md`) with these substitutions:

- `{VARIANT}` -> alpha / beta / gamma / delta
- `{TASK_ID}` -> the generated task ID
- `{WORKTREE_PATH}` -> absolute path to that variant's worktree
- `{CANDIDATE_BRANCH}` -> bestofn/<task-id>/<variant>
- `{TASK_SPEC}` -> the full task specification provided by the user
- `{TEST_COMMAND}` -> autodetected (e.g. `pnpm test`, `pytest`, `cargo test`)
- `{LINT_COMMAND}` -> autodetected (e.g. `pnpm lint`, `ruff check .`)
- `{BASE_BRANCH}` -> the captured base branch name

```
parallel:
  task(subagent_type="fixer-alpha",
       description="best-of-N candidate alpha for ${SLUG}",
       prompt=<filled candidate-prompt-template>)
  task(subagent_type="fixer-beta",  ...)
  task(subagent_type="fixer-gamma", ...)
  task(subagent_type="fixer-delta", ...)

await all 4 to complete
update state phase = "candidates-returned"
```

## Phase 3 — Hard-Gate Filter

For each candidate worktree, run tests + lint and check non-empty diff:

```bash
for variant in alpha beta gamma delta; do
  WORKTREE_PATH="$MAIN_REPO/.worktrees/bestofn-${TASK_ID}/${variant}"

  cd "$WORKTREE_PATH"

  # tests
  if ! eval "${TEST_COMMAND}"; then
    mark candidate failed-tests
    continue
  fi

  # lint
  if ! eval "${LINT_COMMAND}"; then
    mark candidate failed-lint
    continue
  fi

  # diff exists
  if [[ -z "$(git diff "$BASE_BRANCH"..HEAD)" ]]; then
    mark candidate empty-diff
    continue
  fi

  mark candidate passed-hardgate
done

cd "$BASE_WORKTREE"
update state phase = "hardgate-filtered"
```

Decisions:
- 0 passed -> jump to Phase 6b (redo) with feedback "all candidates failed hard gate".
- 1 passed -> jump to Phase 7 (land winner) — no judging needed.
- 2+ passed -> proceed to Phase 4.

## Phase 4 — Blind Oracle Review

Compute per-candidate diff text, build per-reviewer label-shuffle map,
fill judge-prompt-template.md, dispatch 4 oracles in parallel.

```bash
for variant in <passed_candidates>; do
  CANDIDATE_BRANCH="bestofn/${TASK_ID}/${variant}"
  CANDIDATE_DIFF[$variant]="$(git -C "$MAIN_REPO" diff "$BASE_BRANCH".."$CANDIDATE_BRANCH")"
done
```

Per-reviewer label shuffling (anti-bias):

```python
# pseudo
import random
real_variants = ['alpha', 'beta', 'gamma', 'delta']
for reviewer in ['oracle-alpha', 'oracle-beta', 'oracle-gamma', 'oracle-delta']:
    shuffled = random.sample(real_variants, len(real_variants))
    label_map[reviewer] = dict(zip(['A','B','C','D'], shuffled))
    # i.e. when oracle-alpha says "Verdict: merge candidate A",
    # the orchestrator looks up label_map['oracle-alpha']['A'] to get real variant
```

Dispatch:

```
parallel:
  task(subagent_type="oracle-alpha",
       description="best-of-N reviewer alpha for ${SLUG}",
       prompt=<filled judge-prompt-template with shuffled labels>)
  task(subagent_type="oracle-beta",  ...shuffled differently...)
  task(subagent_type="oracle-gamma", ...shuffled differently...)
  task(subagent_type="oracle-delta", ...shuffled differently...)

await all 4
update state phase = "oracle-reviews-returned"
```

## Phase 5 — Vote Aggregation (orchestrator-internal turn)

```
votes = []
for each oracle response:
  parse the LAST line of the response
  expect format "Verdict: merge candidate <X>" or "Verdict: none of these are mergeable"
  if matches "merge candidate <X>":
    real_variant = label_map[reviewer_id][X]
    votes.append(real_variant)
  elif matches "none of these are mergeable":
    votes.append("none")
  else:
    votes.append("malformed")
    log warning, treat as "none"

count_by_variant = Counter(v for v in votes if v not in ("none", "malformed"))
none_count = sum(1 for v in votes if v in ("none", "malformed"))
```

Decision tree:

```
if none_count >= 3:
  -> Phase 6b (redo)
elif max(count_by_variant.values()) >= 3:
  winner = argmax(count_by_variant)
  -> Phase 7 (land)
elif max(count_by_variant.values()) == 2 and only-one-variant-has-2:
  winner = that variant
  -> Phase 7 (land)
else:
  # split: 2-2, 2-1-1, 1-1-1-1, etc
  -> Phase 6a (council arbitration)
```

Update state with full oracle responses, votes, decision.

## Phase 6a — Council Arbitration (split votes only)

Dispatch `@council` once with the full context:

```
task(subagent_type="council",
     description="best-of-N tiebreaker for ${SLUG}",
     prompt="""
You are arbitrating a best-of-N tiebreaker. The 4 oracle reviewers
voted with no clear majority. You must pick a single winner or
declare 'none' to trigger redo.

Task spec:
{TASK_SPEC}

Candidate diffs (4 candidates):
{ALL_4_DIFFS}

Oracle reviews (full text from each reviewer, including their verdicts):
{ALL_4_ORACLE_RESPONSES}

Vote tally:
{VOTE_BREAKDOWN}

Conclude with a single line: 'Verdict: merge candidate <variant>' or
'Verdict: none -> redo'.
""")

await council response
parse final Verdict line
update state with council decision

if council picked a variant:
  winner = that variant
  -> Phase 7 (land)
else:
  -> Phase 6b (redo)
```

## Phase 6b — Redo Loop (no winner)

```
read max_redos from skill config (default 1)
read current redo_count from state (initially 0)

if redo_count >= max_redos:
  -> ESCALATE to user. Print:
     - Task spec
     - All candidate diffs
     - All oracle reviews
     - Council verdict if any
     - Ask user to pick manually or abort.
  -> Phase 8 (cleanup) regardless of user choice.
  -> Skill exits.

redo_count += 1
update state phase = "redo-${redo_count}"

# Aggregate feedback
per_candidate_feedback = {}
shared_feedback_patterns = []

for variant in [alpha, beta, gamma, delta]:
  per_candidate_feedback[variant] = concat all oracle critiques specific to this candidate
  (extracted from each oracle's structured Strengths/Issues sections)

shared_feedback_patterns = find issues that >=2 oracles raised across multiple candidates

# Reset candidate worktrees and branches
for variant in [alpha, beta, gamma, delta]:
  WORKTREE_PATH="$MAIN_REPO/.worktrees/bestofn-${TASK_ID}/${variant}"
  cd "$WORKTREE_PATH"
  git reset --hard "$BASE_BRANCH"
  git clean -fdx

# Re-dispatch fixers with redo prompt
parallel:
  task(subagent_type="fixer-alpha",
       prompt=<filled redo-prompt-template with per_candidate_feedback[alpha] + shared_feedback_patterns>)
  task(subagent_type="fixer-beta",  ...)
  task(subagent_type="fixer-gamma", ...)
  task(subagent_type="fixer-delta", ...)

await all 4
-> back to Phase 3 (hard-gate filter)
```

## Phase 7 — Winner Landing

```bash
WINNER_BRANCH="bestofn/${TASK_ID}/${winner}"

cd "$BASE_WORKTREE"

commit_count="$(git rev-list --count "$BASE_BRANCH".."$WINNER_BRANCH")"

if [[ "$commit_count" -eq 1 ]]; then
  git cherry-pick "$WINNER_BRANCH"
elif [[ "$commit_count" -gt 1 ]]; then
  git merge --squash "$WINNER_BRANCH"
  git commit -F <(generate_squashed_commit_message)
fi

# Verify post-land
git status --porcelain  # should be empty
eval "${TEST_COMMAND}"  # must still pass

if tests fail:
  echo "WARNING: tests fail after landing winner. Possible base-branch drift."
  git reset --hard HEAD~1
  ESCALATE to user
  -> Phase 8 (cleanup) anyway

update state phase = "landed"
```

Squashed commit message format:

```
<winner's primary commit subject>

<winner's primary commit body>

Best-of-N selection from 4 candidates.
Winner: ${winner} | Vote: ${vote_breakdown}
Reviewers: oracle-{alpha,beta,gamma,delta}
${if council invoked:}Council arbitration: ${council_verdict}
${if redo invoked:}Redo rounds: ${redo_count}
Task: ${SLUG} | Time: ${TS}

Generated via best-of-n-with-judge skill.
```

## Phase 8 — Cleanup (UNCONDITIONAL)

Cleanup runs regardless of whether the prior phases succeeded, failed,
or were aborted. Wrap your skill execution in a try/finally equivalent:
even on errors, complete this phase before exiting.

```bash
# Read state for the registry
read STATE_FILE

# Loop with retry ladder per candidate
for candidate in state.candidates:
  WORKTREE_PATH = candidate.worktree_path
  CANDIDATE_BRANCH = candidate.branch_name

  # Worktree removal ladder
  if git -C "$MAIN_REPO" worktree remove "$WORKTREE_PATH"; then
    : # NORMAL succeeded
  elif git -C "$MAIN_REPO" worktree remove --force "$WORKTREE_PATH"; then
    : # FORCE succeeded
  elif rm -rf "$WORKTREE_PATH" && git -C "$MAIN_REPO" worktree prune; then
    : # PRUNE succeeded
  else
    add to escalation list
    continue
  fi

  # Branch deletion ladder
  if git -C "$MAIN_REPO" branch -D "$CANDIDATE_BRANCH"; then
    : # NORMAL succeeded
  elif {
    other_worktree=$(git -C "$MAIN_REPO" worktree list | grep "$CANDIDATE_BRANCH" | awk '{print $1}')
    [[ -n "$other_worktree" ]] && \
    git -C "$MAIN_REPO" worktree remove --force "$other_worktree" && \
    git -C "$MAIN_REPO" branch -D "$CANDIDATE_BRANCH"
  }; then
    : # RECOVER succeeded
  else
    add to escalation list
  fi
done

# Remove parent directory if empty
PARENT_DIR="$MAIN_REPO/.worktrees/bestofn-${TASK_ID}"
rmdir "$PARENT_DIR" 2>/dev/null  # ignore failure (means user added files; warn)
if [[ -d "$PARENT_DIR" ]]; then
  echo "WARNING: $PARENT_DIR not empty after cleanup. Inspect manually."
fi

# Final prune
git -C "$MAIN_REPO" worktree prune

# SWEEP 2 — verify nothing left
remaining_worktrees="$(git -C "$MAIN_REPO" worktree list | grep "bestofn-${TASK_ID}")"
remaining_branches="$(git -C "$MAIN_REPO" for-each-ref --format='%(refname:short)' "refs/heads/bestofn/${TASK_ID}/")"

if [[ -n "$remaining_worktrees" || -n "$remaining_branches" ]]; then
  add all to escalation list
fi

# Delete state file on success; preserve on failure for diagnosis
if [[ ${#escalation_list[@]} -eq 0 ]]; then
  rm "$STATE_FILE"
else
  # Preserve state, log failures
  cat >> "$MAIN_REPO/.opencode/bestofn-failed-cleanups.log" <<EOF
[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Task ${TASK_ID} cleanup escalation:
${escalation_list[@]}
EOF
  print red banner with manual cleanup commands (see "Manual Escape Hatch" below)
fi
```

## Manual Escape Hatch

If the skill itself crashes or hangs, you can clean up manually:

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

## Pre-flight Sweep on Skill Load

Whenever the skill is loaded for a fresh fan-out, run discovery on
stale state from prior runs (interrupted skill runs leave residue):

```bash
stale_state_files="$(ls "$MAIN_REPO/.opencode/bestofn-state/"*.json 2>/dev/null)"
stale_worktrees="$(ls -d "$MAIN_REPO/.worktrees/bestofn-"* 2>/dev/null)"
stale_branches="$(git -C "$MAIN_REPO" for-each-ref --format='%(refname:short)' refs/heads/bestofn/)"

if [[ -n "$stale_state_files" || -n "$stale_worktrees" || -n "$stale_branches" ]]; then
  print "Found stale best-of-N state from prior interrupted run(s):"
  print stale items
  ask user: clean now / abort / proceed-keeping-stale
fi
```

## Ideation Sub-Mode (brainstorming Phase 4)

When invoked from brainstorming's "propose 2-3 approaches" step,
this skill runs a stripped-down ideation fan-out:

- No worktrees, no branches, no candidate fixer dispatch.
- Read-only: dispatches FIVE agents in parallel:
  - `oracle-alpha` (architectural lens)
  - `librarian-alpha` (prior-art lens)
  - `explorer-alpha` (codebase-realism lens)
  - `designer-alpha` (UX lens)
  - `wildcard` (mini-tier, high temperature; deliberate naive /
    contrarian / cross-domain / constraint-flipping noise injection)
- The four domain agents provide expert-grounded depth.
- The wildcard provides genuine divergence — its job is to propose
  what the experts would NOT propose. Its weakness as a model is the
  feature, not a bug; treat its contributions as "the thing nobody
  else suggested."
- Each returns 1-2 candidate approaches from its lens.
- Orchestrator dedupes, summarizes, presents to user as part of normal
  brainstorming Phase 4.
- No judging, no winner, no cleanup needed.

This sub-mode is purely an ideation diversifier; do not confuse with
the implementation fan-out above.

## Configuration

Override defaults via skill invocation context:

| Config key | Default | Effect |
|---|---|---|
| `max_redos` | `1` | Maximum redo rounds before escalating to user |
| `enable_label_shuffle` | `true` | Anti-bias label shuffling for oracles |
| `min_passed_candidates` | `2` | If fewer pass hard gate, treat as no-winner |
| `commit_style` | `cherry-pick-or-squash` | Alternative: `merge-commit` (preserves candidate branch in log) |

## Red Flags — DO NOT

- Do not skip Phase 0 sweep — interrupted runs leave residue you cannot see otherwise.
- Do not let cwd discipline drift — fixers must use absolute paths in tool calls.
- Do not auto-trigger best-of-N for routine bounded tasks. It is opt-in.
- Do not preserve "interesting losers" — cleanup is unconditional.
- Do not fan out on dirty WC — refuse and ask user to commit/stash.
- Do not allow infinite redo — hard cap (default 1, max 3).

## Integration

**Pairs with:**
- `using-git-worktrees` — for `.worktrees/` gitignore enforcement
- `dispatching-parallel-agents` — for the parallel-task discipline
- `requesting-code-review` — for the single-candidate review template
- `verification-before-completion` — for post-land verification

**Replaces:** nothing. Best-of-N is opt-in alongside existing flows.

## Worked Example

User: "We need to refactor the auth module to use JWT. Run best-of-N
on this — high-stakes, multiple plausible designs."

Orchestrator (you):
1. Recognize fan-out trigger.
2. Load this skill.
3. Phase 0:
   - git rev-parse --git-dir -> ok
   - git status --porcelain -> empty, ok
   - MAIN_REPO=/path/to/main
   - BASE_BRANCH=feature/auth-refactor
   - SLUG=auth-jwt-refactor, TS=202605041534, TASK_ID=auth-jwt-refactor-202605041534
   - Sweep finds nothing stale.
4. Phase 1: Create 4 worktrees + branches + state file.
5. Phase 2: Dispatch fixer-alpha through fixer-delta in parallel with the
   spec "refactor auth module to use JWT, see docs/auth-spec.md".
6. Phase 3: Run npm test + npm run lint in each. 3 of 4 pass.
   Candidate gamma fails tests (chose JWT lib that conflicts with existing TLS layer).
7. Phase 4: Build per-reviewer label maps. Dispatch oracle-alpha through
   oracle-delta in parallel with the 3 passing candidates' diffs.
8. Phase 5: Read responses. Votes: alpha, alpha, beta, alpha. -> 3-1 majority.
   Winner: alpha.
9. Phase 7: cd back to feature/auth-refactor, cherry-pick winner alpha's commit.
   Tests pass post-land.
10. Phase 8: git worktree remove all 4, git branch -D all 4, rmdir parent,
    git worktree prune, sweep clean. State file deleted.

User sees: clean WC except the new alpha commit, with descriptive message
including vote breakdown.
