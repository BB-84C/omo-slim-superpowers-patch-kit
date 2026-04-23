# Rollback

## Option A: disable patched OMO Slim

Remove the patched OMO Slim plugin entry from `opencode.json`, and also remove or restore the `agent.general.disable` / `agent.explore.disable` changes that were added by the plugin snippet, then restart OpenCode. Your OMO Slim config normally lives at `~/.config/opencode/oh-my-opencode-slim.jsonc`.

## Option B: restore your previous OMO Slim config

- if you used the backup-first install path, restore your backed-up `opencode.json`
- if you used the backup-first install path, restore your backed-up `oh-my-opencode-slim.jsonc`
- restore or remove the `agent.general.disable` / `agent.explore.disable` overrides in `opencode.json`
- remove the prompt bridge files from `~/.config/opencode/oh-my-opencode-slim/superpowers-bridge/`

## Option C: return to Superpowers-only fallback

- disable patched OMO Slim
- restore or remove the `general` / `explore` lane disable overrides from `opencode.json`
- keep `superpowers`
- restart OpenCode
- use your fallback workflow mode

## Cleanup

- delete the local patched OMO Slim checkout if you no longer need it
- delete copied prompt bridge files from `~/.config/opencode/oh-my-opencode-slim/superpowers-bridge/` if you no longer want the integration
