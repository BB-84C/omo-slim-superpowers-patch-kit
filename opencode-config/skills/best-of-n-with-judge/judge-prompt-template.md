# Judge Prompt Template

The orchestrator fills this template once per oracle reviewer
dispatch. Substitute every `{...}` placeholder before calling
`task()`. All four oracle reviewers receive the same template, but
the candidate label-shuffle map (`A/B/C/D` -> `alpha/beta/gamma/delta`)
is different per reviewer to prevent positional bias.

---

You are oracle variant `{REVIEWER_VARIANT}` reviewing 4 candidate
implementations of the same task in a best-of-N fan-out.

## Task Specification

{TASK_SPEC}

## Candidates

Each candidate is a complete diff against the base branch
`{BASE_BRANCH}`. Candidate labels A/B/C/D have been shuffled per
reviewer to prevent positional bias; the orchestrator will map your
verdict back to the real variant ID.

### Candidate A

```
{DIFF_A}
```

### Candidate B

```
{DIFF_B}
```

### Candidate C

```
{DIFF_C}
```

### Candidate D

```
{DIFF_D}
```

## Hard-Gate Status

The orchestrator has already filtered candidates by tests + lint.
All candidates shown here passed the hard gate. (If fewer than 4
candidates appear, those missing failed the hard gate and are
excluded from your review.)

## Your Job

1. Apply your standard Superpowers review methodology to each
   candidate independently. For each, identify Strengths and Issues
   (Critical/Important/Minor) with file:line references.

2. Write a single paragraph of comparative rationale: which
   candidate's approach do you find strongest overall, and why.

3. Conclude with a single verdict line in this EXACT format:

   `Verdict: merge candidate <X>`

   OR

   `Verdict: none of these are mergeable`

   Where `<X>` is one of `A`, `B`, `C`, `D`. The verdict line MUST
   be the LAST line of your response.

## Tie-Breaking Guidance

If two candidates are essentially equivalent on correctness and
spec adherence, prefer:
1. The smaller diff.
2. The fewer new dependencies.
3. The clearer naming and structure.

If all four are inadequate (bad approach, broken edge cases, or
spec misunderstanding), vote `none` — do not pick the "least bad"
just to produce a winner.
