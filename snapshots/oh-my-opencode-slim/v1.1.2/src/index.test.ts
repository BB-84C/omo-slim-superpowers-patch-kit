import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import OhMyOpenCodeLite from './index';

describe('plugin orchestrator pivot identity', () => {
  let projectDir: string;
  let configHome: string;
  let previousXdgConfigHome: string | undefined;
  let previousOpenCodeConfigDir: string | undefined;

  beforeEach(() => {
    projectDir = mkTestDir('omo-plugin-project-');
    configHome = mkTestDir('omo-plugin-config-');
    previousXdgConfigHome = process.env.XDG_CONFIG_HOME;
    previousOpenCodeConfigDir = process.env.OPENCODE_CONFIG_DIR;
    process.env.XDG_CONFIG_HOME = configHome;
    delete process.env.OPENCODE_CONFIG_DIR;

    const configDir = join(projectDir, '.opencode');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'oh-my-opencode-slim.json'),
      JSON.stringify({
        showStartupToast: false,
        multiplexer: { type: 'none' },
        agents: {
          orchestrator: {
            model: [
              'gauge-forge-anthropic/claude-opus-4-7',
              'gauge-forge-openai/gpt-5.4',
            ],
          },
          librarian: {
            model: [
              'gauge-forge-anthropic/claude-opus-4-7',
              'gauge-forge-openai/gpt-5.4',
            ],
          },
        },
      }),
    );
  });

  afterEach(() => {
    restoreEnv('XDG_CONFIG_HOME', previousXdgConfigHome);
    restoreEnv('OPENCODE_CONFIG_DIR', previousOpenCodeConfigDir);
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(configHome, { recursive: true, force: true });
  });

  test('fresh child preroute sees orchestrator-beta after foreground pivot', async () => {
    const plugin = await OhMyOpenCodeLite({
      directory: projectDir,
      client: {
        app: { log: mock(async () => ({})) },
        session: {
          messages: mock(async () => ({
            data: [
              {
                info: { role: 'user' },
                parts: [{ type: 'text', text: 'delegate this' }],
              },
            ],
          })),
          abort: mock(async () => ({})),
          promptAsync: mock(async () => ({})),
        },
      },
    } as Parameters<typeof OhMyOpenCodeLite>[0]);

    await plugin['chat.message'](
      { sessionID: 'root-session', agent: 'orchestrator' },
      { message: { agent: 'orchestrator' } },
    );
    await plugin.event({
      event: {
        type: 'message.updated',
        properties: {
          info: {
            sessionID: 'root-session',
            agent: 'orchestrator',
            providerID: 'gauge-forge-anthropic',
            modelID: 'claude-opus-4-7',
          },
        },
      },
    });
    await plugin.event({
      event: {
        type: 'session.status',
        properties: {
          sessionID: 'root-session',
          status: { type: 'retry', message: 'rate-limited' },
        },
      },
    });

    const output = { args: { subagent_type: 'librarian' } };
    await plugin['tool.execute.before'](
      { tool: 'task', sessionID: 'root-session' },
      output,
    );

    expect(output.args.subagent_type).toBe('librarian__task_fallback');
  });
});

function mkTestDir(prefix: string): string {
  const dir = join(
    tmpdir(),
    `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
  );
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
