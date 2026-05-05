# Redo Prompt Template

The orchestrator fills this template when no winner emerged from
Phase 5 (vote aggregation) and the redo loop is invoked. Each fixer
variant gets back its OWN prompt with feedback specific to its
previous attempt PLUS shared feedback that all candidates suffered
from.

---

This is REDO ROUND `{REDO_ROUND}` of `{MAX_REDOS}` for task
`{TASK_ID}`. Your previous candidate did not win.

You are fixer variant `{VARIANT}` in a best-of-N fan-out.

## Your Isolated Working Directory

`{WORKTREE_PATH}` (your branch `{CANDIDATE_BRANCH}` has been reset
to the base; your previous attempt is gone).

## CWD DISCIPLINE — CRITICAL

(Same rules as initial dispatch — see candidate-prompt-template.md.)

- All read/write tool calls MUST use absolute paths starting with
  `{WORKTREE_PATH}`.
- All bash calls MUST be prefixed with `cd {WORKTREE_PATH} && `.

## Task Specification (unchanged)

{TASK_SPEC}

## Feedback on Your Previous Attempt

Oracles reviewed your previous candidate alongside the others. Their
specific critique of your variant:

{PER_CANDIDATE_FEEDBACK}

## Shared Feedback Across All Candidates

Multiple oracles flagged these patterns across all four candidates
in the prior round:

{SHARED_FEEDBACK}

## Your Job

Re-implement the task spec from scratch, addressing both the
candidate-specific feedback above and the shared patterns. Avoid
repeating mistakes the prior round made.

## Requirements (unchanged)

- All existing tests must pass within your worktree.
- Lint must pass within your worktree.
- Commit your work to `{CANDIDATE_BRANCH}`.

## Return Format

(Same as initial dispatch.)

If after this redo round there is still no winner and `{REDO_ROUND}`
equals `{MAX_REDOS}`, the orchestrator will escalate to the user.
