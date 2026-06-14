import { describe, expect, test } from 'bun:test';
import { getSkillPermissionsForAgent } from '../cli/skills';
import type { PluginConfig } from '../config';
import {
  AgentOverrideConfigSchema,
  CouncilConfigSchema,
  DEFAULT_DISABLED_AGENTS,
  DEFAULT_MODELS,
  PluginConfigSchema,
  SUBAGENT_NAMES,
} from '../config';
import {
  createAgents,
  getAgentConfigs,
  getDisabledAgents,
  getEnabledAgentNames,
  isSubagent,
} from './index';
import { decideTaskPreroute } from './preroute-decision';

const TASK_FALLBACKS_FIXTURE = {
  librarian: {
    shadowAgentName: 'librarian__task_fallback',
  },
};

describe('agent alias backward compatibility', () => {
  test("applies 'explore' config to 'explorer' agent", () => {
    const config: PluginConfig = {
      agents: {
        explore: { model: 'test/old-explore-model' },
      },
    };
    const agents = createAgents(config);
    const explorer = agents.find((a) => a.name === 'explorer');
    expect(explorer).toBeDefined();
    expect(explorer?.config.model).toBe('test/old-explore-model');
  });

  test("applies 'frontend-ui-ux-engineer' config to 'designer' agent", () => {
    const config: PluginConfig = {
      agents: {
        'frontend-ui-ux-engineer': { model: 'test/old-frontend-model' },
      },
    };
    const agents = createAgents(config);
    const designer = agents.find((a) => a.name === 'designer');
    expect(designer).toBeDefined();
    expect(designer?.config.model).toBe('test/old-frontend-model');
  });

  test('new name takes priority over old alias', () => {
    const config: PluginConfig = {
      agents: {
        explore: { model: 'old-model' },
        explorer: { model: 'new-model' },
      },
    };
    const agents = createAgents(config);
    const explorer = agents.find((a) => a.name === 'explorer');
    expect(explorer?.config.model).toBe('new-model');
  });

  test('new agent names work directly', () => {
    const config: PluginConfig = {
      agents: {
        explorer: { model: 'direct-explorer' },
        designer: { model: 'direct-designer' },
      },
    };
    const agents = createAgents(config);
    expect(agents.find((a) => a.name === 'explorer')?.config.model).toBe(
      'direct-explorer',
    );
    expect(agents.find((a) => a.name === 'designer')?.config.model).toBe(
      'direct-designer',
    );
  });

  test('temperature override via old alias', () => {
    const config: PluginConfig = {
      agents: {
        explore: { temperature: 0.5 },
      },
    };
    const agents = createAgents(config);
    const explorer = agents.find((a) => a.name === 'explorer');
    expect(explorer?.config.temperature).toBe(0.5);
  });

  test('variant override via old alias', () => {
    const config: PluginConfig = {
      agents: {
        explore: { variant: 'low' },
      },
    };
    const agents = createAgents(config);
    const explorer = agents.find((a) => a.name === 'explorer');
    expect(explorer?.config.variant).toBe('low');
  });
});

describe('fixer agent fallback', () => {
  test('fixer inherits librarian model when no fixer config provided', () => {
    const config: PluginConfig = {
      agents: {
        librarian: { model: 'librarian-custom-model' },
      },
    };
    const agents = createAgents(config);
    const fixer = agents.find((a) => a.name === 'fixer');
    const librarian = agents.find((a) => a.name === 'librarian');
    expect(fixer?.config.model).toBe(librarian?.config.model);
  });

  test('fixer uses its own model when explicitly configured', () => {
    const config: PluginConfig = {
      agents: {
        librarian: { model: 'librarian-model' },
        fixer: { model: 'fixer-specific-model' },
      },
    };
    const agents = createAgents(config);
    const fixer = agents.find((a) => a.name === 'fixer');
    expect(fixer?.config.model).toBe('fixer-specific-model');
  });
});

describe('base agent factory tool denies', () => {
  test('oracle has edit/write/bash/task/todowrite deny', () => {
    const agents = createAgents();
    const oracle = agents.find((a) => a.name === 'oracle');
    expect(oracle).toBeDefined();
    const perm = (oracle?.config.permission as Record<string, string>) ?? {};
    expect(perm.edit).toBe('deny');
    expect(perm.write).toBe('deny');
    expect(perm.bash).toBe('deny');
    expect(perm.task).toBe('deny');
    expect(perm.todowrite).toBe('deny');
  });

  test('explorer has edit/write/bash/task/todowrite deny', () => {
    const agents = createAgents();
    const explorer = agents.find((a) => a.name === 'explorer');
    expect(explorer).toBeDefined();
    const perm = (explorer?.config.permission as Record<string, string>) ?? {};
    expect(perm.edit).toBe('deny');
    expect(perm.write).toBe('deny');
    expect(perm.bash).toBe('deny');
    expect(perm.task).toBe('deny');
    expect(perm.todowrite).toBe('deny');
  });

  test('librarian has edit/write/bash/task/todowrite deny', () => {
    const agents = createAgents();
    const librarian = agents.find((a) => a.name === 'librarian');
    expect(librarian).toBeDefined();
    const perm = (librarian?.config.permission as Record<string, string>) ?? {};
    expect(perm.edit).toBe('deny');
    expect(perm.write).toBe('deny');
    expect(perm.bash).toBe('deny');
    expect(perm.task).toBe('deny');
    expect(perm.todowrite).toBe('deny');
  });

  test('observer has edit/write/bash/task/todowrite deny', () => {
    const agents = createAgents({ disabled_agents: [] });
    const observer = agents.find((a) => a.name === 'observer');
    expect(observer).toBeDefined();
    const perm = (observer?.config.permission as Record<string, string>) ?? {};
    expect(perm.edit).toBe('deny');
    expect(perm.write).toBe('deny');
    expect(perm.bash).toBe('deny');
    expect(perm.task).toBe('deny');
    expect(perm.todowrite).toBe('deny');
  });

  test('council has edit/write/bash/todowrite deny but task not denied (dispatches councillor)', () => {
    const agents = createAgents();
    const council = agents.find((a) => a.name === 'council');
    expect(council).toBeDefined();
    const perm = (council?.config.permission as Record<string, string>) ?? {};
    expect(perm.edit).toBe('deny');
    expect(perm.write).toBe('deny');
    expect(perm.bash).toBe('deny');
    expect(perm.todowrite).toBe('deny');
    expect(perm.task).not.toBe('deny');
  });

  test('fixer has task deny (no further delegation)', () => {
    const agents = createAgents();
    const fixer = agents.find((a) => a.name === 'fixer');
    expect(fixer).toBeDefined();
    const perm = (fixer?.config.permission as Record<string, string>) ?? {};
    expect(perm.task).toBe('deny');
    expect(perm.write).not.toBe('deny');
    expect(perm.edit).not.toBe('deny');
    expect(perm.bash).not.toBe('deny');
    expect(perm.todowrite).not.toBe('deny');
  });

  test('designer has task deny (same shape as fixer)', () => {
    const agents = createAgents();
    const designer = agents.find((a) => a.name === 'designer');
    expect(designer).toBeDefined();
    const perm = (designer?.config.permission as Record<string, string>) ?? {};
    expect(perm.task).toBe('deny');
    expect(perm.write).not.toBe('deny');
    expect(perm.edit).not.toBe('deny');
    expect(perm.bash).not.toBe('deny');
    expect(perm.todowrite).not.toBe('deny');
  });
});
describe('orchestrator agent', () => {
  test('orchestrator is first in agents array', () => {
    const agents = createAgents();
    expect(agents[0].name).toBe('orchestrator');
  });

  test('orchestrator has question permission set to allow', () => {
    const agents = createAgents();
    const orchestrator = agents.find((a) => a.name === 'orchestrator');
    expect(orchestrator?.config.permission).toBeDefined();
    expect((orchestrator?.config.permission as any).question).toBe('allow');
  });

  test('orchestrator is denied access to council_session', () => {
    const agents = createAgents();
    const orchestrator = agents.find((a) => a.name === 'orchestrator');
    expect((orchestrator?.config.permission as any).council_session).toBe(
      'deny',
    );
  });

  test('orchestrator accepts overrides', () => {
    const config: PluginConfig = {
      agents: {
        orchestrator: { model: 'custom-orchestrator-model', temperature: 0.3 },
      },
    };
    const agents = createAgents(config);
    const orchestrator = agents.find((a) => a.name === 'orchestrator');
    expect(orchestrator?.config.model).toBe('custom-orchestrator-model');
    expect(orchestrator?.config.temperature).toBe(0.3);
  });

  test('orchestrator accepts variant override', () => {
    const config: PluginConfig = {
      agents: {
        orchestrator: { variant: 'high' },
      },
    };
    const agents = createAgents(config);
    const orchestrator = agents.find((a) => a.name === 'orchestrator');
    expect(orchestrator?.config.variant).toBe('high');
  });

  test('orchestrator stores model array with per-model variants in _modelArray', () => {
    const config: PluginConfig = {
      agents: {
        orchestrator: {
          model: [
            { id: 'google/gemini-3-pro', variant: 'high' },
            { id: 'github-copilot/claude-3.5-haiku' },
            'openai/gpt-4',
          ],
        },
      },
    };
    const agents = createAgents(config);
    const orchestrator = agents.find((a) => a.name === 'orchestrator');
    expect(orchestrator?._modelArray).toEqual([
      { id: 'google/gemini-3-pro', variant: 'high' },
      { id: 'github-copilot/claude-3.5-haiku' },
      { id: 'openai/gpt-4' },
    ]);
    expect(orchestrator?.config.model).toBeUndefined();
  });
});

describe('per-model variant in array config', () => {
  test('subagent stores model array with per-model variants', () => {
    const config: PluginConfig = {
      agents: {
        explorer: {
          model: [
            { id: 'google/gemini-3-flash', variant: 'low' },
            'openai/gpt-4o-mini',
          ],
        },
      },
    };
    const agents = createAgents(config);
    const explorer = agents.find((a) => a.name === 'explorer');
    expect(explorer?._modelArray).toEqual([
      { id: 'google/gemini-3-flash', variant: 'low' },
      { id: 'openai/gpt-4o-mini' },
    ]);
    expect(explorer?.config.model).toBeUndefined();
  });

  test('top-level variant preserved alongside per-model variants', () => {
    const config: PluginConfig = {
      agents: {
        orchestrator: {
          model: [
            { id: 'google/gemini-3-pro', variant: 'high' },
            'openai/gpt-4',
          ],
          variant: 'low',
        },
      },
    };
    const agents = createAgents(config);
    const orchestrator = agents.find((a) => a.name === 'orchestrator');
    // top-level variant still set as default
    expect(orchestrator?.config.variant).toBe('low');
    // per-model variants stored in _modelArray
    expect(orchestrator?._modelArray?.[0]?.variant).toBe('high');
    expect(orchestrator?._modelArray?.[1]?.variant).toBeUndefined();
  });
});

describe('skill permissions', () => {
  test('orchestrator gets command-style bundled skills allowed by default', () => {
    const agents = createAgents();
    const orchestrator = agents.find((a) => a.name === 'orchestrator');
    expect(orchestrator).toBeDefined();
    const skillPerm = (
      orchestrator?.config.permission as Record<string, unknown>
    )?.skill as Record<string, string>;
    // orchestrator gets wildcard allow by default
    expect(skillPerm?.['*']).toBe('allow');
    // CUSTOM_SKILLS loop must also add a named codemap entry for orchestrator
    expect(skillPerm?.codemap).toBe('allow');
    expect(skillPerm?.clonedeps).toBe('allow');
  });

  test('fixer does not get codemap skill allowed by default', () => {
    const agents = createAgents();
    const fixer = agents.find((a) => a.name === 'fixer');
    expect(fixer).toBeDefined();
    const skillPerm = (fixer?.config.permission as Record<string, unknown>)
      ?.skill as Record<string, string>;
    expect(skillPerm?.codemap).not.toBe('allow');
    expect(skillPerm?.clonedeps).not.toBe('allow');
  });

  test('oracle does not get requesting-code-review skill allowed by default', () => {
    const agents = createAgents();
    const oracle = agents.find((a) => a.name === 'oracle');
    expect(oracle).toBeDefined();
    const skillPerm = (oracle?.config.permission as Record<string, unknown>)
      ?.skill as Record<string, string>;
    expect(skillPerm?.['requesting-code-review']).toBe('deny');
  });

  test('fixer has simplify skill allowed (moved from oracle)', () => {
    const agents = createAgents();
    const fixer = agents.find((a) => a.name === 'fixer');
    expect(fixer).toBeDefined();
    const skillPerm = (fixer?.config.permission as Record<string, unknown>)
      ?.skill as Record<string, string>;
    expect(skillPerm?.simplify).toBe('allow');
  });

  test('oracle does NOT have simplify skill allowed (moved to fixer)', () => {
    const agents = createAgents();
    const oracle = agents.find((a) => a.name === 'oracle');
    expect(oracle).toBeDefined();
    const skillPerm = (oracle?.config.permission as Record<string, unknown>)
      ?.skill as Record<string, string>;
    expect(skillPerm?.simplify).not.toBe('allow');
  });

  test('fixer-alpha has simplify (variant inherits at skill-resolution layer)', () => {
    const skillPerm = getSkillPermissionsForAgent('fixer-alpha');
    expect(skillPerm.simplify).toBe('allow');
  });

  test('oracle-alpha does NOT have simplify (variant inherits at skill-resolution layer)', () => {
    const skillPerm = getSkillPermissionsForAgent('oracle-alpha');
    expect(skillPerm.simplify).not.toBe('allow');
  });
});

describe('tool permissions', () => {
  test('council agent is allowed to invoke council_session', () => {
    const agents = createAgents();
    const council = agents.find((a) => a.name === 'council');
    expect((council?.config.permission as any).council_session).toBe('allow');
  });

  test('oracle is denied access to council_session', () => {
    const agents = createAgents();
    const oracle = agents.find((a) => a.name === 'oracle');
    expect((oracle?.config.permission as any).council_session).toBe('deny');
  });

  test('explorer is denied access to council_session', () => {
    const agents = createAgents();
    const explorer = agents.find((a) => a.name === 'explorer');
    expect((explorer?.config.permission as any).council_session).toBe('deny');
  });

  test('councillor is denied access to council_session', () => {
    const agents = createAgents();
    const councillor = agents.find((a) => a.name === 'councillor');
    expect((councillor?.config.permission as any).council_session).toBe('deny');
  });
});

describe('isSubagent type guard', () => {
  test('returns true for valid subagent names', () => {
    expect(isSubagent('explorer')).toBe(true);
    expect(isSubagent('librarian')).toBe(true);
    expect(isSubagent('oracle')).toBe(true);
    expect(isSubagent('designer')).toBe(true);
    expect(isSubagent('fixer')).toBe(true);
  });

  test('returns false for orchestrator', () => {
    expect(isSubagent('orchestrator')).toBe(false);
  });

  test('returns false for invalid agent names', () => {
    expect(isSubagent('invalid-agent')).toBe(false);
    expect(isSubagent('')).toBe(false);
    expect(isSubagent('explore')).toBe(false); // old alias, not actual agent name
  });
});

describe('agent classification', () => {
  test('SUBAGENT_NAMES excludes orchestrator', () => {
    expect(SUBAGENT_NAMES).not.toContain('orchestrator');
    expect(SUBAGENT_NAMES).toContain('explorer');
    expect(SUBAGENT_NAMES).toContain('fixer');
  });

  test('getAgentConfigs applies correct classification visibility and mode', () => {
    // Enable all agents (including observer) for classification testing
    const configs = getAgentConfigs({ disabled_agents: [] });

    // Primary agent
    expect(configs.orchestrator.mode).toBe('primary');

    // Subagents
    for (const name of SUBAGENT_NAMES) {
      // Council is a dual-mode agent ("all"), rest are subagents
      if (name === 'council') {
        expect(configs[name].mode).toBe('all');
      } else {
        expect(configs[name].mode).toBe('subagent');
      }
    }
  });
});

describe('createAgents', () => {
  test('creates all agents without config', () => {
    const agents = createAgents();
    const names = agents.map((a) => a.name);
    expect(names).toContain('orchestrator');
    expect(names).toContain('explorer');
    expect(names).toContain('designer');
    expect(names).toContain('oracle');
    expect(names).toContain('librarian');
    expect(names).toContain('fixer');
  });

  test('creates exactly 8 agents by default (1 orchestrator + 7 subagents, observer disabled)', () => {
    const agents = createAgents();
    expect(agents.length).toBe(8);
  });
});
describe('getAgentConfigs', () => {
  test('returns config record keyed by agent name', () => {
    const configs = getAgentConfigs();
    expect(configs.orchestrator).toBeDefined();
    expect(configs.explorer).toBeDefined();
    // orchestrator has no hardcoded default model; resolved at runtime via
    // chat.message hook when _modelArray is configured, or left to the user
    expect(configs.explorer.model).toBeDefined();
  });

  test('includes description in SDK config', () => {
    const configs = getAgentConfigs();
    expect(configs.orchestrator.description).toBeDefined();
    expect(configs.explorer.description).toBeDefined();
  });

  test('adds hidden backup shadow config for anthropic-primary task fallback agents', () => {
    const configs = getAgentConfigs({
      agents: {
        librarian: {
          model: [
            {
              id: 'gauge-forge-anthropic/claude-opus-4-7',
              variant: 'high',
            },
            { id: 'gauge-forge-openai/gpt-5.4', variant: 'xhigh' },
          ],
        },
      },
    });

    const shadow = configs.librarian__task_fallback;
    expect(shadow).toBeDefined();
    expect(shadow.model).toBe('gauge-forge-openai/gpt-5.4');
    expect(shadow.variant).toBe('xhigh');
    expect(shadow.hidden).toBe(true);
    expect(shadow.mode).toBe('subagent');
  });

  test('does not add task fallback shadow config for orchestrator-shaped root agents', () => {
    const configs = getAgentConfigs({
      agents: {
        'orchestrator-beta': {
          model: [
            {
              id: 'gauge-forge-anthropic/claude-opus-4-7',
              variant: 'high',
            },
            { id: 'gauge-forge-openai/gpt-5.4', variant: 'xhigh' },
          ],
        },
      },
    });

    expect(configs['orchestrator-beta']?.mode).toBe('primary');
    expect(configs.orchestrator).toBeDefined();
    expect(configs['orchestrator-beta__task_fallback']).toBeUndefined();
  });
  test('does not add backup shadow config for non-anthropic primary arrays', () => {
    const configs = getAgentConfigs({
      agents: {
        explorer: {
          model: [
            { id: 'gauge-forge-openai/gpt-5.4', variant: 'medium' },
            {
              id: 'gauge-forge-anthropic/claude-sonnet-4-6',
              variant: 'high',
            },
          ],
        },
      },
    });

    expect(configs.explorer__task_fallback).toBeUndefined();
  });
});

describe('getAgentConfigs — restricted MCP blacklist', () => {
  test('oracle has windows-mcp_*, chrome-devtools_*, playwright_* denied', () => {
    const configs = getAgentConfigs();
    const oraclePerm =
      (configs.oracle.permission as Record<string, unknown>) ?? {};
    expect(oraclePerm['windows-mcp_*']).toBe('deny');
    expect(oraclePerm['chrome-devtools_*']).toBe('deny');
    expect(oraclePerm['playwright_*']).toBe('deny');
  });

  test('fixer has no restricted MCP denies (operator)', () => {
    const configs = getAgentConfigs();
    const fixerPerm =
      (configs.fixer.permission as Record<string, unknown>) ?? {};
    expect(fixerPerm['windows-mcp_*']).toBeUndefined();
    expect(fixerPerm['chrome-devtools_*']).toBeUndefined();
    expect(fixerPerm['playwright_*']).toBeUndefined();
  });

  test('librarian has windows-mcp_* deny but not chrome/playwright (mixed operator)', () => {
    const configs = getAgentConfigs();
    const libPerm =
      (configs.librarian.permission as Record<string, unknown>) ?? {};
    expect(libPerm['windows-mcp_*']).toBe('deny');
    expect(libPerm['chrome-devtools_*']).toBeUndefined();
    expect(libPerm['playwright_*']).toBeUndefined();
  });

  test('explorer-alpha (variant) inherits explorer denies', () => {
    const configs = getAgentConfigs({
      agents: {
        'explorer-alpha': { model: 'openai/gpt-5.4-mini' },
      },
    });
    const epAlpha =
      (configs['explorer-alpha']?.permission as Record<string, unknown>) ?? {};
    expect(epAlpha['windows-mcp_*']).toBe('deny');
    expect(epAlpha['chrome-devtools_*']).toBe('deny');
    expect(epAlpha['playwright_*']).toBe('deny');
  });

  test('wildcard has all 3 restricted MCPs denied', () => {
    const configs = getAgentConfigs({
      agents: {
        wildcard: { model: 'openai/gpt-5.4-mini' },
      },
    });
    const wcPerm =
      (configs.wildcard?.permission as Record<string, unknown>) ?? {};
    expect(wcPerm['windows-mcp_*']).toBe('deny');
    expect(wcPerm['chrome-devtools_*']).toBe('deny');
    expect(wcPerm['playwright_*']).toBe('deny');
  });
});

describe('council agent model resolution', () => {
  test('council agent uses default model', () => {
    const agents = createAgents();
    const council = agents.find((a) => a.name === 'council');
    expect(council?.config.model).toBe(DEFAULT_MODELS.council);
  });

  test('councillor agent uses default model', () => {
    const agents = createAgents();
    const councillor = agents.find((a) => a.name === 'councillor');
    expect(councillor?.config.model).toBe(DEFAULT_MODELS.councillor);
  });

  test('council falls back to legacy master.model when no preset override', () => {
    // Simulates a pre-1.0.0 config with council.master.model but no council
    // entry in the agent preset — the exact scenario from issue #369.
    const config: PluginConfig = {
      agents: {
        oracle: { model: 'openai/gpt-5.4' },
      },
      council: {
        presets: {
          default: {
            alpha: { model: 'openai/gpt-5.4-mini' },
          },
        },
        _legacyMasterModel: 'anthropic/claude-opus-4-6',
      },
    };
    const agents = createAgents(config);
    const council = agents.find((a) => a.name === 'council');
    expect(council?.config.model).toBe('anthropic/claude-opus-4-6');
  });

  test('council preset override takes precedence over legacy master.model', () => {
    // If user has explicit council in preset, that wins — legacy is ignored.
    const config: PluginConfig = {
      agents: {
        council: { model: 'google/gemini-3-pro' },
      },
      council: {
        presets: {
          default: {
            alpha: { model: 'openai/gpt-5.4-mini' },
          },
        },
        _legacyMasterModel: 'anthropic/claude-opus-4-6',
      },
    };
    const agents = createAgents(config);
    const council = agents.find((a) => a.name === 'council');
    expect(council?.config.model).toBe('google/gemini-3-pro');
  });

  test('council uses default when no legacy master and no preset override', () => {
    // No legacy master, no preset override → standard default
    const config: PluginConfig = {
      council: {
        presets: {
          default: {
            alpha: { model: 'openai/gpt-5.4-mini' },
          },
        },
      },
    };
    const agents = createAgents(config);
    const council = agents.find((a) => a.name === 'council');
    expect(council?.config.model).toBe(DEFAULT_MODELS.council);
  });

  test('end-to-end: raw master.model config flows through schema to council agent', () => {
    // Integration test: start from raw user config with deprecated master.model,
    // parse through CouncilConfigSchema, then pass to createAgents.
    // This validates the full seam between schema transform and agent resolution.
    const rawCouncilConfig = {
      master: { model: 'anthropic/claude-opus-4-6' },
      presets: {
        default: {
          alpha: { model: 'openai/gpt-5.4-mini' },
        },
      },
    };

    const parsed = CouncilConfigSchema.safeParse(rawCouncilConfig);
    expect(parsed.success).toBe(true);

    if (parsed.success) {
      const config: PluginConfig = {
        council: parsed.data,
      };
      const agents = createAgents(config);
      const council = agents.find((a) => a.name === 'council');
      // Legacy master.model should flow through schema → agent
      expect(council?.config.model).toBe('anthropic/claude-opus-4-6');
    }
  });
});

describe('options passthrough', () => {
  test('options are applied to agent config via overrides', () => {
    const config: PluginConfig = {
      agents: {
        oracle: {
          model: 'openai/gpt-5.4',
          options: { textVerbosity: 'low' },
        },
      },
    };
    const agents = createAgents(config);
    const oracle = agents.find((a) => a.name === 'oracle');
    expect(oracle?.config.options).toEqual({ textVerbosity: 'low' });
  });

  test('options with nested objects are passed through', () => {
    const config: PluginConfig = {
      agents: {
        oracle: {
          model: 'anthropic/claude-sonnet-4-6',
          options: {
            thinking: { type: 'enabled', budgetTokens: 16000 },
          },
        },
      },
    };
    const agents = createAgents(config);
    const oracle = agents.find((a) => a.name === 'oracle');
    expect(oracle?.config.options).toEqual({
      thinking: { type: 'enabled', budgetTokens: 16000 },
    });
  });

  test('options work with other overrides', () => {
    const config: PluginConfig = {
      agents: {
        oracle: {
          model: 'openai/gpt-5.4',
          variant: 'high',
          temperature: 0.7,
          options: { textVerbosity: 'low', reasoningEffort: 'medium' },
        },
      },
    };
    const agents = createAgents(config);
    const oracle = agents.find((a) => a.name === 'oracle');
    expect(oracle?.config.model).toBe('openai/gpt-5.4');
    expect(oracle?.config.variant).toBe('high');
    expect(oracle?.config.temperature).toBe(0.7);
    expect(oracle?.config.options).toEqual({
      textVerbosity: 'low',
      reasoningEffort: 'medium',
    });
  });

  test('options are absent when not configured', () => {
    const config: PluginConfig = {
      agents: {
        oracle: { model: 'openai/gpt-5.4' },
      },
    };
    const agents = createAgents(config);
    const oracle = agents.find((a) => a.name === 'oracle');
    expect(oracle?.config.options).toBeUndefined();
  });

  test('options flow through getAgentConfigs to SDK output', () => {
    const config: PluginConfig = {
      agents: {
        oracle: {
          model: 'openai/gpt-5.4',
          options: { textVerbosity: 'low' },
        },
      },
    };
    const configs = getAgentConfigs(config);
    expect(configs.oracle.options).toEqual({ textVerbosity: 'low' });
  });

  test('options are shallow-merged with existing agent config options', () => {
    // Simulate an agent factory setting default options
    const config: PluginConfig = {
      agents: {
        oracle: {
          model: 'openai/gpt-5.4',
          options: { reasoningEffort: 'medium' },
        },
      },
    };
    const agents = createAgents(config);
    const oracle = agents.find((a) => a.name === 'oracle');
    // Override options should merge with (not replace) any factory defaults
    expect(oracle?.config.options).toEqual({ reasoningEffort: 'medium' });
  });
});

describe('AgentOverrideConfigSchema options validation', () => {
  test('accepts valid options object', () => {
    const result = AgentOverrideConfigSchema.safeParse({
      options: { textVerbosity: 'low' },
    });
    expect(result.success).toBe(true);
  });

  test('accepts empty options object', () => {
    const result = AgentOverrideConfigSchema.safeParse({ options: {} });
    expect(result.success).toBe(true);
  });

  test('accepts nested values in options', () => {
    const result = AgentOverrideConfigSchema.safeParse({
      options: {
        thinking: { type: 'enabled', budgetTokens: 16000 },
      },
    });
    expect(result.success).toBe(true);
  });

  test('accepts options alongside other fields', () => {
    const result = AgentOverrideConfigSchema.safeParse({
      model: 'openai/gpt-5.4',
      variant: 'high',
      temperature: 0.7,
      options: { textVerbosity: 'low' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.options).toEqual({ textVerbosity: 'low' });
    }
  });

  test('config without options is valid', () => {
    const result = AgentOverrideConfigSchema.safeParse({
      model: 'openai/gpt-5.4',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.options).toBeUndefined();
    }
  });

  test('rejects non-object options', () => {
    const result = AgentOverrideConfigSchema.safeParse({
      options: 'not-an-object',
    });
    expect(result.success).toBe(false);
  });

  test('rejects empty model arrays', () => {
    const result = AgentOverrideConfigSchema.safeParse({
      model: [],
    });
    expect(result.success).toBe(false);
  });

  test('accepts prompt and orchestratorPrompt override fields', () => {
    const result = AgentOverrideConfigSchema.safeParse({
      model: 'openai/gpt-5.4',
      prompt: 'You are a specialized reviewer.',
      orchestratorPrompt: '@reviewer\n- Role: Specialized reviewer',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.prompt).toBe('You are a specialized reviewer.');
      expect(result.data.orchestratorPrompt).toBe(
        '@reviewer\n- Role: Specialized reviewer',
      );
    }
  });

  test('rejects empty prompt fields', () => {
    const result = AgentOverrideConfigSchema.safeParse({
      model: 'openai/gpt-5.4',
      prompt: '',
    });
    expect(result.success).toBe(false);
  });

  test('rejects empty orchestratorPrompt fields', () => {
    const result = AgentOverrideConfigSchema.safeParse({
      model: 'openai/gpt-5.4',
      orchestratorPrompt: '',
    });
    expect(result.success).toBe(false);
  });

  test('rejects description field on overrides', () => {
    const result = AgentOverrideConfigSchema.safeParse({
      model: 'openai/gpt-5.4',
      description: 'not supported for custom agents',
    } as Record<string, unknown>);
    expect(result.success).toBe(false);
  });
});

describe('PluginConfigSchema custom-agent-only prompt fields', () => {
  test('rejects prompt on built-in top-level agent overrides', () => {
    const result = PluginConfigSchema.safeParse({
      agents: {
        oracle: {
          model: 'openai/gpt-5.4',
          prompt: 'ignored built-in prompt override',
        },
      },
    });

    expect(result.success).toBe(false);
  });

  test('rejects orchestratorPrompt on built-in top-level agent overrides', () => {
    const result = PluginConfigSchema.safeParse({
      agents: {
        explorer: {
          model: 'openai/gpt-5.4-mini',
          orchestratorPrompt: '@explorer\n- Role: should be invalid here',
        },
      },
    });

    expect(result.success).toBe(false);
  });

  test('rejects custom-only prompt fields on built-in preset agents', () => {
    const result = PluginConfigSchema.safeParse({
      presets: {
        openai: {
          oracle: {
            model: 'openai/gpt-5.4',
            prompt: 'ignored preset built-in prompt override',
          },
        },
      },
    });

    expect(result.success).toBe(false);
  });

  test('allows prompt fields on custom agents', () => {
    const result = PluginConfigSchema.safeParse({
      agents: {
        janitor: {
          model: 'openai/gpt-5.4-mini',
          prompt: 'You are Janitor.',
          orchestratorPrompt: '@janitor\n- Role: Cleanup specialist',
        },
      },
    });

    expect(result.success).toBe(true);
  });
});

describe('disabled_agents', () => {
  test('disabled agents are not created', () => {
    const config: PluginConfig = {
      disabled_agents: ['designer', 'fixer'],
    };
    const agents = createAgents(config);
    const names = agents.map((a) => a.name);
    expect(names).not.toContain('designer');
    expect(names).not.toContain('fixer');
    expect(names).toContain('orchestrator');
    expect(names).toContain('explorer');
    expect(names).toContain('oracle');
    expect(names).toContain('librarian');
  });

  test('protected agents cannot be disabled', () => {
    const config: PluginConfig = {
      disabled_agents: ['orchestrator', 'councillor'],
    };
    const agents = createAgents(config);
    const names = agents.map((a) => a.name);
    expect(names).toContain('orchestrator');
    expect(names).toContain('councillor');
  });

  test('disabling council disables council agent', () => {
    const config: PluginConfig = {
      disabled_agents: ['council'],
    };
    const agents = createAgents(config);
    const names = agents.map((a) => a.name);
    expect(names).not.toContain('council');
    // councillor is protected, it stays
    expect(names).toContain('councillor');
  });

  test('agent count decreases when agents are disabled', () => {
    const agents = createAgents();
    expect(agents.length).toBe(8); // 1 + 7 (observer disabled by default)

    const disabledConfig: PluginConfig = {
      disabled_agents: ['observer', 'designer'],
    };
    const disabledAgents = createAgents(disabledConfig);
    expect(disabledAgents.length).toBe(7);
  });

  test('getDisabledAgents respects protection rules', () => {
    const config: PluginConfig = {
      disabled_agents: ['orchestrator', 'designer', 'councillor'],
    };
    const disabled = getDisabledAgents(config);
    expect(disabled.has('designer')).toBe(true);
    expect(disabled.has('orchestrator')).toBe(false);
    expect(disabled.has('councillor')).toBe(false);
  });

  test('getEnabledAgentNames filters correctly', () => {
    const config: PluginConfig = {
      disabled_agents: ['designer', 'fixer'],
    };
    const enabled = getEnabledAgentNames(config);
    expect(enabled).not.toContain('designer');
    expect(enabled).not.toContain('fixer');
    expect(enabled).toContain('orchestrator');
    expect(enabled).toContain('explorer');
  });

  test('getEnabledAgentNames includes enabled custom agents', () => {
    const config: PluginConfig = {
      disabled_agents: ['janitor'],
      agents: {
        janitor: { model: 'openai/gpt-5.4-mini' },
        reviewer: { model: 'openai/gpt-5.4-mini' },
      },
    };

    const enabled = getEnabledAgentNames(config);
    expect(enabled).toContain('reviewer');
    expect(enabled).not.toContain('janitor');
  });

  test('empty disabled_agents creates all agents including observer', () => {
    const config: PluginConfig = {
      disabled_agents: [],
    };
    const agents = createAgents(config);
    expect(agents.length).toBe(9);
    expect(agents.map((a) => a.name)).toContain('observer');
  });
});

describe('observer agent', () => {
  test('observer is disabled by default', () => {
    const agents = createAgents();
    const names = agents.map((a) => a.name);
    expect(names).not.toContain('observer');
  });

  test('observer is enabled when removed from disabled_agents', () => {
    const config: PluginConfig = {
      disabled_agents: [],
    };
    const agents = createAgents(config);
    const names = agents.map((a) => a.name);
    expect(names).toContain('observer');
  });

  test('observer is disabled when explicitly listed', () => {
    const config: PluginConfig = {
      disabled_agents: ['observer'],
    };
    const agents = createAgents(config);
    const names = agents.map((a) => a.name);
    expect(names).not.toContain('observer');
  });

  test('observer can be enabled alongside other disabled agents', () => {
    const config: PluginConfig = {
      disabled_agents: ['designer'],
    };
    const agents = createAgents(config);
    const names = agents.map((a) => a.name);
    expect(names).toContain('observer');
    expect(names).not.toContain('designer');
  });

  test('DEFAULT_DISABLED_AGENTS contains observer', () => {
    expect(DEFAULT_DISABLED_AGENTS).toContain('observer');
  });
});

describe('permission redesign — spec coverage summary', () => {
  test('reserved skills are denied on all non-orchestrator agents', () => {
    const configs = getAgentConfigs();
    const reservedSkills = ['best-of-n-with-judge', 'update-memory'];
    const orchestratorAgents = ['orchestrator', 'orchestrator-beta'];

    for (const [agentName, agentConfig] of Object.entries(configs)) {
      const perm = (agentConfig.permission as Record<string, unknown>) ?? {};
      const skillPerm = (perm.skill as Record<string, string>) ?? {};
      for (const reserved of reservedSkills) {
        if (orchestratorAgents.includes(agentName)) {
          expect(skillPerm[reserved]).toBe('allow');
        } else {
          expect(skillPerm[reserved]).toBe('deny');
        }
      }
    }
  });

  test('all tier-3 agents have * deny on non-SP skills', () => {
    const tier3 = [
      'oracle',
      'oracle-alpha',
      'oracle-beta',
      'oracle-gamma',
      'oracle-delta',
      'explorer',
      'explorer-alpha',
      'explorer-beta',
      'librarian',
      'librarian-alpha',
      'librarian-beta',
      'observer',
      'council',
      'councillor',
      'scout',
      'validator',
      'gist',
      'wildcard',
    ];
    for (const name of tier3) {
      const skillPerm = getSkillPermissionsForAgent(name);
      expect(skillPerm['*']).toBe('deny');
    }
  });

  test('restricted MCP denies partition operators, librarians, and all other agents correctly', () => {
    const configs = getAgentConfigs();
    const operatorBases = new Set([
      'fixer',
      'orchestrator',
      'laborer',
      'designer',
    ]);
    for (const [agentName, agentConfig] of Object.entries(configs)) {
      const perm = (agentConfig.permission as Record<string, unknown>) ?? {};
      const base = agentName.split('-')[0];
      if (operatorBases.has(base)) {
        expect(perm['windows-mcp_*']).toBeUndefined();
        expect(perm['chrome-devtools_*']).toBeUndefined();
        expect(perm['playwright_*']).toBeUndefined();
      } else if (base === 'librarian') {
        expect(perm['windows-mcp_*']).toBe('deny');
        expect(perm['chrome-devtools_*']).toBeUndefined();
        expect(perm['playwright_*']).toBeUndefined();
      } else {
        expect(perm['windows-mcp_*']).toBe('deny');
        expect(perm['chrome-devtools_*']).toBe('deny');
        expect(perm['playwright_*']).toBe('deny');
      }
    }
  });
});
describe('subagent pivot via root agent identity (orchestrator-beta)', () => {
  test('reroutes anthropic-primary subagent to shadow when root agent is orchestrator-beta', async () => {
    const verdict = await decideTaskPreroute({
      rootAgent: 'orchestrator-beta',
      subagentType: 'librarian',
      taskId: undefined,
      anthropicTaskFallbacks: TASK_FALLBACKS_FIXTURE,
    });
    expect(verdict.action).toBe('rewrite');
    if (verdict.action === 'rewrite') {
      expect(verdict.newSubagentType).toBe('librarian__task_fallback');
    }
  });

  test('passes through when root agent is orchestrator', async () => {
    const verdict = await decideTaskPreroute({
      rootAgent: 'orchestrator',
      subagentType: 'librarian',
      taskId: undefined,
      anthropicTaskFallbacks: TASK_FALLBACKS_FIXTURE,
    });
    expect(verdict.action).toBe('passthrough');
  });


  test('passes through anthropic-primary subagent when root agent is orchestrator-delta', async () => {
    const verdict = await decideTaskPreroute({
      rootAgent: 'orchestrator-delta',
      subagentType: 'librarian',
      taskId: undefined,
      anthropicTaskFallbacks: TASK_FALLBACKS_FIXTURE,
    });
    expect(verdict.action).toBe('passthrough');
  });

  test('passes through gpt-primary subagent regardless of root', async () => {
    const verdict = await decideTaskPreroute({
      rootAgent: 'orchestrator-beta',
      subagentType: 'fixer-alpha',
      taskId: undefined,
      anthropicTaskFallbacks: TASK_FALLBACKS_FIXTURE,
    });
    expect(verdict.action).toBe('passthrough');
  });

  test('blocks resumed task on anthropic-primary child session in pivot mode', async () => {
    const verdict = await decideTaskPreroute({
      rootAgent: 'orchestrator-beta',
      subagentType: 'librarian',
      taskId: 'ses_old_anthropic',
      lookupSessionAgent: async () => 'librarian',
      anthropicTaskFallbacks: TASK_FALLBACKS_FIXTURE,
    });
    expect(verdict.action).toBe('block');
    if (verdict.action === 'block') {
      expect(verdict.errorMessage).toMatch(/cannot resume.*pivot mode/i);
      expect(verdict.errorMessage).toContain('backup shadow agent');
      expect(verdict.errorMessage).not.toContain('gpt fallback');
      expect(verdict.errorMessage).toContain('librarian__task_fallback');
    }
  });

  test('passes through resumed task on gpt-primary child session', async () => {
    const verdict = await decideTaskPreroute({
      rootAgent: 'orchestrator-beta',
      subagentType: 'fixer-alpha',
      taskId: 'ses_old_gpt',
      lookupSessionAgent: async () => 'fixer-alpha',
      anthropicTaskFallbacks: TASK_FALLBACKS_FIXTURE,
    });
    expect(verdict.action).toBe('passthrough');
  });

  test('passes through resumed task when not in pivot mode', async () => {
    const verdict = await decideTaskPreroute({
      rootAgent: 'orchestrator',
      subagentType: 'librarian',
      taskId: 'ses_old_anthropic',
      lookupSessionAgent: async () => 'librarian',
      anthropicTaskFallbacks: TASK_FALLBACKS_FIXTURE,
    });
    expect(verdict.action).toBe('passthrough');
  });


  test('passes through resumed anthropic-primary child when root agent is orchestrator-delta', async () => {
    const verdict = await decideTaskPreroute({
      rootAgent: 'orchestrator-delta',
      subagentType: 'librarian',
      taskId: 'ses_old_anthropic',
      lookupSessionAgent: async () => 'librarian',
      anthropicTaskFallbacks: TASK_FALLBACKS_FIXTURE,
    });
    expect(verdict.action).toBe('passthrough');
  });
});
