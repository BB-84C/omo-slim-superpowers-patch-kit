# Architecture

## Layer 1: OpenCode native

OpenCode provides the base session model, child sessions, agents, tools, and MCP runtime.

## Layer 2: OMO Slim

OMO Slim provides specialist agents, model routing, lane specialization, and prompt-bridge behavior.

## Layer 3: Superpowers

Superpowers provides the workflow/controller layer:

- brainstorming
- planning
- implementation discipline
- review loops
- verification
- completion flow

## Cooperation model

- Superpowers remains the director
- OMO Slim provides the worker seats
- the plugin snippet intentionally disables OpenCode's default `general` and `explore` lanes to avoid duplicate/default lane competition
- only Superpowers skills are selectively restricted
- only OMO-managed MCPs are selectively restricted
- all other custom skills and MCPs remain available

Within the council/councillor area, `councillor` is an internal-only worker used by the council flow rather than a normal user-facing agent lane. It intentionally keeps OMO Slim's internal/upstream council prompt behavior, so this patch kit does not publish a separate `councillor` prompt bridge file.

Patches mainly constrain Layer 2 worker behavior, prompt bridges connect Layer 2 seats to Layer 3 workflow rules, and config templates pin the Layer 1+2 wiring that makes the stack reproducible.
