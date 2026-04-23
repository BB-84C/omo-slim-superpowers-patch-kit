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
