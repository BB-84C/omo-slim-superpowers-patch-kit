import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PluginInput } from '@opencode-ai/plugin';
import { clearSuperpowersSkillDiscoveryCache } from '../../cli/superpowers-policy';
import type { PluginConfig } from '../../config';
import {
  createFilterAvailableSkillsHook,
  filterAvailableSkillsText,
} from './index';

const mockCtx = {} as PluginInput;

const SUPERPOWERS_TEST_SKILLS = [
  'brainstorming',
  'receiving-code-review',
  'requesting-code-review',
  'subagent-driven-development',
  'systematic-debugging',
  'test-driven-development',
  'using-superpowers',
  'verification-before-completion',
  'writing-plans',
];

let skillsRoot: string;

beforeEach(() => {
  skillsRoot = mkdtempSync(join(tmpdir(), 'omo-lite-policy-'));
  for (const name of SUPERPOWERS_TEST_SKILLS) {
    const dir = join(skillsRoot, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${name}\n---\n`);
  }
  clearSuperpowersSkillDiscoveryCache();
});

afterEach(() => {
  rmSync(skillsRoot, { recursive: true, force: true });
  clearSuperpowersSkillDiscoveryCache();
});

function skillBlock(name: string): string {
  return `<skill>
  <name>${name}</name>
  <description>${name} description</description>
  <location>file:///tmp/${name}</location>
</skill>`;
}

function availableSkillsBlock(...names: string[]): string {
  return `<available_skills>
${names.map((name) => skillBlock(name)).join('\n')}
</available_skills>`;
}

describe('filterAvailableSkillsText', () => {
  test('keeps only allowed skills using exact skill names', () => {
    const text = availableSkillsBlock('skill1', 'skill2', 'skill3');
    const result = filterAvailableSkillsText(text, {
      '*': 'deny',
      skill1: 'allow',
      skill3: 'allow',
    });

    expect(result).toContain('<name>skill1</name>');
    expect(result).not.toContain('<name>skill2</name>');
    expect(result).toContain('<name>skill3</name>');
  });

  test('renders No skills available when nothing is allowed', () => {
    const result = filterAvailableSkillsText(availableSkillsBlock('skill1'), {
      '*': 'deny',
    });

    expect(result).toContain('No skills available.');
    expect(result).not.toContain('<name>skill1</name>');
  });
});

describe('createFilterAvailableSkillsHook', () => {
  test('filters system prompt skill blocks for explicit agent skills', async () => {
    const config: PluginConfig = {
      agents: {
        explorer: {
          skills: ['skill1', 'skill3'],
        },
      },
    };

    const hook = createFilterAvailableSkillsHook(mockCtx, config);
    const output = {
      messages: [
        {
          info: { role: 'system' },
          parts: [
            {
              type: 'text',
              text: availableSkillsBlock('skill1', 'skill2', 'skill3'),
            },
          ],
        },
        {
          info: { role: 'user', agent: 'explorer' },
          parts: [{ type: 'text', text: 'check skills' }],
        },
      ],
    };

    await hook['experimental.chat.messages.transform']({}, output);

    const resultText = output.messages[0].parts[0].text;
    expect(resultText).toContain('<name>skill1</name>');
    expect(resultText).not.toContain('<name>skill2</name>');
    expect(resultText).toContain('<name>skill3</name>');
  });

  test('shows no skills for agents configured with an empty skills list', async () => {
    const config: PluginConfig = {
      agents: {
        fixer: {
          skills: [],
        },
      },
    };

    const hook = createFilterAvailableSkillsHook(mockCtx, config);
    const output = {
      messages: [
        {
          info: { role: 'system' },
          parts: [{ type: 'text', text: availableSkillsBlock('skill1') }],
        },
        {
          info: { role: 'user', agent: 'fixer' },
          parts: [{ type: 'text', text: 'check skills' }],
        },
      ],
    };

    await hook['experimental.chat.messages.transform']({}, output);

    const resultText = output.messages[0].parts[0].text;
    expect(resultText).toContain('No skills available.');
    expect(resultText).not.toContain('<name>skill1</name>');
  });

  test('preserves orchestrator default wildcard allow', async () => {
    const hook = createFilterAvailableSkillsHook(mockCtx, {});
    const output = {
      messages: [
        {
          info: { role: 'system' },
          parts: [
            { type: 'text', text: availableSkillsBlock('skill1', 'skill2') },
          ],
        },
        {
          info: { role: 'user', agent: 'orchestrator' },
          parts: [{ type: 'text', text: 'check skills' }],
        },
      ],
    };

    await hook['experimental.chat.messages.transform']({}, output);

    const resultText = output.messages[0].parts[0].text;
    expect(resultText).toContain('<name>skill1</name>');
    expect(resultText).toContain('<name>skill2</name>');
  });

  test('filters the configured Superpowers catalog for orchestrator prompts', async () => {
    const config: PluginConfig = { superpowersSkillsDir: skillsRoot };
    const hook = createFilterAvailableSkillsHook(mockCtx, config);
    const output = {
      messages: [
        {
          info: { role: 'system' },
          parts: [
            {
              type: 'text',
              text: availableSkillsBlock(
                'brainstorming',
                'writing-plans',
                'using-superpowers',
              ),
            },
          ],
        },
        {
          info: { role: 'user', agent: 'orchestrator' },
          parts: [{ type: 'text', text: 'check skills' }],
        },
      ],
    };

    await hook['experimental.chat.messages.transform']({}, output);

    const resultText = output.messages[0].parts[0].text;
    expect(resultText).toContain('<name>brainstorming</name>');
    expect(resultText).toContain('<name>writing-plans</name>');
    expect(resultText).not.toContain('<name>using-superpowers</name>');
  });

  test('supports wildcard allow with explicit exclusions', async () => {
    const config: PluginConfig = {
      agents: {
        designer: {
          skills: ['*', '!skill2'],
        },
      },
    };

    const hook = createFilterAvailableSkillsHook(mockCtx, config);
    const output = {
      messages: [
        {
          info: { role: 'system' },
          parts: [
            { type: 'text', text: availableSkillsBlock('skill1', 'skill2') },
          ],
        },
        {
          info: { role: 'user', agent: 'designer' },
          parts: [{ type: 'text', text: 'check skills' }],
        },
      ],
    };

    await hook['experimental.chat.messages.transform']({}, output);

    const resultText = output.messages[0].parts[0].text;
    expect(resultText).toContain('<name>skill1</name>');
    expect(resultText).not.toContain('<name>skill2</name>');
  });

  test('defaults to orchestrator when no agent is present', async () => {
    const hook = createFilterAvailableSkillsHook(mockCtx, {});
    const output = {
      messages: [
        {
          info: { role: 'system' },
          parts: [{ type: 'text', text: availableSkillsBlock('skill1') }],
        },
        {
          info: { role: 'user' },
          parts: [{ type: 'text', text: 'check skills' }],
        },
      ],
    };

    await hook['experimental.chat.messages.transform']({}, output);

    expect(output.messages[0].parts[0].text).toContain('<name>skill1</name>');
  });

  test('filters multiple skill blocks across messages', async () => {
    const config: PluginConfig = {
      agents: {
        explorer: {
          skills: ['skill1'],
        },
      },
    };

    const hook = createFilterAvailableSkillsHook(mockCtx, config);
    const output = {
      messages: [
        {
          info: { role: 'system' },
          parts: [
            {
              type: 'text',
              text: `Intro\n${availableSkillsBlock('skill1', 'skill2')}`,
            },
          ],
        },
        {
          info: { role: 'developer' },
          parts: [
            { type: 'text', text: availableSkillsBlock('skill2', 'skill3') },
          ],
        },
        {
          info: { role: 'user', agent: 'explorer' },
          parts: [{ type: 'text', text: 'check skills' }],
        },
      ],
    };

    await hook['experimental.chat.messages.transform']({}, output);

    expect(output.messages[0].parts[0].text).toContain('<name>skill1</name>');
    expect(output.messages[0].parts[0].text).not.toContain(
      '<name>skill2</name>',
    );
    expect(output.messages[1].parts[0].text).toContain('No skills available.');
  });
});
