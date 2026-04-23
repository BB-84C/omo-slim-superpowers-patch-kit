import { describe, expect, it } from 'bun:test';
import { getSkillPermissionsForAgent } from './skills';

describe('skills permissions', () => {
  it('allows non-superpowers skills by default', () => {
    const permissions = getSkillPermissionsForAgent('designer');

    expect(permissions['*']).toBe('allow');
    expect(permissions['agent-browser']).toBe('allow');
    expect(permissions.simplify).toBeUndefined();
  });

  it('applies superpowers policy for orchestrator', () => {
    const permissions = getSkillPermissionsForAgent('orchestrator');

    expect(permissions['*']).toBe('allow');
    expect(permissions.brainstorming).toBe('allow');
    expect(permissions['writing-plans']).toBe('allow');
    expect(permissions['using-superpowers']).toBe('deny');
  });

  it('allows only approved superpowers skills for designer', () => {
    const permissions = getSkillPermissionsForAgent('designer');

    expect(permissions['test-driven-development']).toBe('allow');
    expect(permissions['systematic-debugging']).toBe('allow');
    expect(permissions['verification-before-completion']).toBe('allow');
    expect(permissions.brainstorming).toBe('deny');
    expect(permissions['using-superpowers']).toBe('deny');
  });

  it('does not bypass superpowers gating through legacy permission-only skills', () => {
    const permissions = getSkillPermissionsForAgent('oracle');

    expect(permissions.simplify).toBe('allow');
    expect(permissions['receiving-code-review']).toBe('allow');
    expect(permissions['requesting-code-review']).toBe('deny');
    expect(permissions['writing-plans']).toBe('deny');
  });

  it('honors explicit skill list overrides', () => {
    const emptyPerms = getSkillPermissionsForAgent('orchestrator', []);
    expect(emptyPerms['*']).toBe('deny');
    expect(emptyPerms['brainstorming']).toBe('deny');
    expect(emptyPerms['using-superpowers']).toBe('deny');

    const specificPerms = getSkillPermissionsForAgent('designer', [
      'my-skill',
      '!bad-skill',
    ]);
    expect(specificPerms['*']).toBe('deny');
    expect(specificPerms['my-skill']).toBe('allow');
    expect(specificPerms['bad-skill']).toBe('deny');
    expect(specificPerms['test-driven-development']).toBe('deny');
  });

  it('does not let explicit skill lists grant forbidden superpowers skills', () => {
    const permissions = getSkillPermissionsForAgent('designer', [
      'writing-plans',
      'using-superpowers',
      'agent-browser',
    ]);

    expect(permissions['writing-plans']).toBe('deny');
    expect(permissions['using-superpowers']).toBe('deny');
    expect(permissions['agent-browser']).toBe('allow');
  });

  it('lets explicit skill lists narrow otherwise-allowed superpowers skills', () => {
    const permissions = getSkillPermissionsForAgent('orchestrator', [
      'brainstorming',
    ]);

    expect(permissions.brainstorming).toBe('allow');
    expect(permissions['writing-plans']).toBe('deny');
  });

  it('honors wildcard in explicit list', () => {
    const wildcardPerms = getSkillPermissionsForAgent('designer', ['*']);
    expect(wildcardPerms['*']).toBe('allow');
    expect(wildcardPerms['writing-plans']).toBe('deny');
    expect(wildcardPerms['test-driven-development']).toBe('allow');
    expect(wildcardPerms['using-superpowers']).toBe('deny');
  });
});
