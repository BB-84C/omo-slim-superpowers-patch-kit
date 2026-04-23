import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_AGENT_MCPS,
  buildAgentMcpPermissionRules,
  getManagedMcpNames,
  parseList,
} from './agent-mcps';

describe('parseList', () => {
  test('empty list returns empty array', () => {
    expect(parseList([], ['mcp1', 'mcp2'])).toEqual([]);
  });

  test('wildcard includes all available', () => {
    expect(parseList(['*'], ['mcp1', 'mcp2', 'mcp3'])).toEqual([
      'mcp1',
      'mcp2',
      'mcp3',
    ]);
  });

  test('orchestrator wildcard excludes context7 but includes custom mcps', () => {
    expect(
      parseList(DEFAULT_AGENT_MCPS.orchestrator, [
        'websearch',
        'context7',
        'grep_app',
        'custom-mcp',
      ]),
    ).toEqual(['websearch', 'grep_app', 'custom-mcp']);
  });

  test('wildcard with exclusions', () => {
    expect(parseList(['*', '!mcp2'], ['mcp1', 'mcp2', 'mcp3'])).toEqual([
      'mcp1',
      'mcp3',
    ]);
  });

  test('exclude wildcard returns empty', () => {
    expect(parseList(['!*'], ['mcp1', 'mcp2'])).toEqual([]);
  });

  test('specific items only', () => {
    expect(
      parseList(['mcp1', 'mcp3'], ['mcp1', 'mcp2', 'mcp3', 'mcp4']),
    ).toEqual(['mcp1', 'mcp3']);
  });

  test('specific items with exclusions', () => {
    expect(
      parseList(['mcp1', 'mcp3', '!mcp3'], ['mcp1', 'mcp2', 'mcp3']),
    ).toEqual(['mcp1']);
  });

  test('exclusions without matching allows', () => {
    expect(parseList(['!mcp2'], ['mcp1', 'mcp2', 'mcp3'])).toEqual([]);
  });

  test('managed permission rules ignore custom mcps', () => {
    const rules = buildAgentMcpPermissionRules([], {
      websearch: true,
      context7: true,
      grep_app: true,
      'windows-mcp': true,
    });

    expect(rules).toEqual({
      'websearch_*': 'deny',
      'context7_*': 'deny',
      'grep_app_*': 'deny',
    });
    expect('windows-mcp' in rules).toBe(false);
  });

  test('managed mcp names are built-in only', () => {
    expect(getManagedMcpNames()).toEqual(['websearch', 'context7', 'grep_app']);
  });
});
