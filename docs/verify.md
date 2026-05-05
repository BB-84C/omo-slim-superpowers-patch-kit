# Verify

## Static checks

- `superpowers` is in your OpenCode plugin list
- the patched local OMO Slim path is in your OpenCode plugin list
- prompt bridge files are present at `~/.config/opencode/oh-my-opencode-slim/superpowers-bridge/`
- your OMO Slim config loads the `superpowers-bridge` preset
- your local `oh-my-opencode-slim` checkout was built after patching (`git checkout v1.0.1`, `git apply` both patches, `bun install`, `bun run build`)

## Agent availability checks

- confirm these README-promised agents are available: `orchestrator`, `fixer`, `oracle`, `explorer`, `librarian`, `designer`, `observer`, and `council`
- example probe: `@orchestrator list the available worker lanes in this setup`
- example probe: `@council explain when this kit expects council escalation instead of the default oracle review lane`
- `councillor` does not need its own published prompt bridge file; it is an internal council worker that keeps upstream/internal prompt behavior

## Skill checks

- `@fixer` can access:
  - `test-driven-development`
  - `systematic-debugging`
  - `verification-before-completion`
- `@fixer` cannot access:
  - `writing-plans`
  - `subagent-driven-development`

- `@oracle` can access:
  - `receiving-code-review`
  - `systematic-debugging`
  - `verification-before-completion`
- `@oracle` cannot access:
  - `writing-plans`
  - `subagent-driven-development`

- concrete allow probe: `@fixer use verification-before-completion and tell me what must be checked before claiming done`
- concrete block probe: `@fixer use writing-plans to draft a plan for this repo`
- concrete allow probe: `@oracle use receiving-code-review to review a small patch`
- concrete block probe: `@oracle use subagent-driven-development to delegate implementation`
- optional custom-skill probe (only if you have your own non-Superpowers custom skill installed): `@fixer use my non-Superpowers custom skill <your-skill-name> and report whether it is still available in this lane`

## MCP checks

- `@fixer` or `@oracle` can still access your custom MCPs
- `@fixer` or `@oracle` cannot access blocked OMO MCPs like `websearch` when their `mcps` list is empty

- optional custom-MCP probe (only if you have your own custom MCP configured): `@fixer use my custom MCP <name> to run its normal check`
- concrete block probe: `@fixer use the OMO-managed websearch MCP to look up release notes`
- concrete block probe: `@oracle use the OMO-managed websearch MCP to research an issue`

## Workflow checks

- the main session still starts with `brainstorming` for new design work
- `writing-plans` still comes after approved design
- `oracle` remains the default review lane
- `council` appears only as an escalation path

## Healthy signals

| Signal | Meaning |
|---|---|
| non-Superpowers custom skill still works in `fixer` | custom skills were not accidentally gated |
| custom MCP still works in `fixer` | MCP patch is working |
| `websearch` blocked in `fixer` | OMO MCP gating is working |
| main session starts with `brainstorming` | Superpowers still owns workflow |
| review goes to `oracle` by default | lane mapping is working |

## Optional: Best-of-N + fast-lane verification

Only run these checks if you installed the `opencode-config/` example setup (patch 0003 applied + agent/prompt/skill files copied + jsonc merged).

### Variant agent availability

- example probe: `dispatch task(subagent_type="fixer-alpha", prompt="reply with the single word pong, no tools")` — should succeed
- repeat for: `fixer-beta`, `fixer-gamma`, `fixer-delta`, `oracle-alpha`, `oracle-beta`, `oracle-gamma`, `oracle-delta`, `designer-alpha`, `designer-beta`, `designer-gamma`, `designer-delta`, `explorer-alpha`, `explorer-beta`, `librarian-alpha`, `librarian-beta`
- all 16 variants should respond

### Fast-lane utility agent availability

- `dispatch task(subagent_type="scout", prompt="find any file containing the string 'foo' in this directory, max 3 tool calls")` — should return `<file>:<line>` answer or `REQUIRES_DEEPER_AGENT`
- `dispatch task(subagent_type="validator", prompt="is the string '{\"x\":1}' valid JSON?")` — should return `VALID`
- `dispatch task(subagent_type="gist", prompt="summarize README.md in 3 lines")` — should return ≤3 lines
- `dispatch task(subagent_type="wildcard", prompt="propose one naive approach to the problem of caching API responses")` — should return one labelled proposal

### Suffix-resolution policy inheritance

- `@fixer-alpha use verification-before-completion to check claims of done` — should ALLOW (inherits from `fixer`)
- `@fixer-alpha use writing-plans to draft a plan` — should DENY (not in `fixer` allowed list)
- `@oracle-beta use receiving-code-review to review a small patch` — should ALLOW (inherits from `oracle`)
- `@oracle-delta use subagent-driven-development to delegate work` — should DENY
- `@validator use verification-before-completion to verify a JSON parse` — should ALLOW (explicit policy entry)
- `@scout use systematic-debugging to investigate a flaky test` — should DENY (empty allowed list)

### Best-of-n-with-judge skill discoverability

- `Load the best-of-n-with-judge skill and summarize its 9 phases without starting a fan-out` — should return Phase 0 through Phase 8 + ideation sub-mode summary

### Best-of-N end-to-end smoke (optional but valuable)

- Set up a tiny git project with a failing test
- Trigger fan-out: `Run best-of-N on this task: <task spec>. Use 4 fixer variants and 4 oracle variants. max_redos=0.`
- Expected: 4 candidates dispatched, hard gate filter, oracle reviews, winner cherry-picked, all `.worktrees/bestofn-*` cleaned, `.opencode/bestofn-state/` empty post-run
- See `opencode-config/docs/plans/2026-05-04-best-of-n-with-judge-plan.md` Task 15 Step 4 for full post-condition checklist

## Optional: orchestrator-prefix verification (requires patch 0004)

Only run these checks if you applied patch 0004 and registered an `orchestrator-beta` (or other orchestrator-prefix variant) in your OMO Slim config.

### Visibility checks

- The variant orchestrator appears in the OpenCode agent picker as a switchable primary agent (not hidden, not subagent)
- Switching to it does not crash or fall back to a default subagent prompt

### Behavior parity probes

Run the same probe with both `@orchestrator` and `@orchestrator-beta` (assuming you registered `orchestrator-beta`):

- `list the available worker lanes in this setup` — both should respond with the full lane map (proves the bridge prompt is injected for the variant)
- `which superpowers skills can you invoke?` — both should list the full superpowers allowlist (brainstorming, writing-plans, subagent-driven-development, etc.) — proves `isOrchestratorAgent()` widened the policy correctly
- `dispatch task(subagent_type="explorer", ...)` — both should be allowed to delegate (proves MCP `["*", "!context7"]` and permission inheritance work)

### Negative probes

- An agent whose name does NOT start with `orchestrator` (e.g. your `laborer`) should NOT get mode='primary' — confirm via the agent picker that `laborer` only appears as a subagent
- A new agent named `my-orchestrator` (mid-name `orchestrator`) should NOT match — patch 0004 uses prefix matching only

## Optional: Anthropic cooldown verification (requires patch 0005)

Only run these checks if you applied patch 0005 and configured a model fallback array on at least one agent.

### Static checks

- After at least one observed rate-limit event, file `~/.config/opencode/.omo-slim-cooldowns.json` exists
- File content: JSON object mapping `provider/model` → epoch ms (number)
- Hidden filename (leading dot) keeps the config dir listing clean

### Behavior probes (require an actually-rate-limited model)

The cleanest way to test live behavior is to wait until your real Anthropic quota is exhausted, then:

1. Send a prompt to `@orchestrator` (configured with `model: [opus, gpt-5.4]`)
2. Observe: ~30s retry wait → response arrives via gpt-5.4 (foreground fallback fired)
3. Check `~/.config/opencode/.omo-slim-cooldowns.json` — should contain an `anthropic/claude-opus-4-7` entry
4. Restart OpenCode
5. Send another prompt to `@orchestrator`
6. Observe: response arrives IMMEDIATELY on gpt-5.4 (no retry storm — startup-time cooldown skip worked)
7. Wait until the recorded epoch elapses (or manually edit the file to remove the entry)
8. Send another prompt — should now resume on Opus

### Synthetic check via test suite

If you don't want to wait for real rate limits, the unit + integration tests already exercise the full flow:

```bash
cd /path/to/oh-my-opencode-slim
bun test src/hooks/foreground-fallback/
```

Expected: 48+ tests pass / 0 fail (17 cooldown unit tests + 26 fallback baseline + 5 cooldown integration tests).
