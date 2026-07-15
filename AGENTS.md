
## Dreaming Updates (2026-07-09)
- For the OMO Slim / superpowers auto-continue path, the required behavior is to preserve both the user's temporarily selected orchestrator variant (`orchestrator-beta` / `orchestrator-delta` / etc.) and the temporarily selected model override across auto-continue resume. Resuming into base `orchestrator` or the JSON default model is a bug.
- When testing auto-continue, validate the pair together: active agent variant plus active model. A fix is not complete if it preserves the model override but collapses the agent variant.
