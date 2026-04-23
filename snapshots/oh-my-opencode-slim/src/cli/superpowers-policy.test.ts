import { describe, expect, it } from 'bun:test';
import {
  FALLBACK_SUPERPOWERS_SKILLS,
  buildSuperpowersSkillPermissions,
  getAllowedSuperpowersSkillsForAgent,
} from './superpowers-policy';

describe('superpowers policy', () => {
  it('grants only implementer-discipline skills to fixer', () => {
    const allowed = [...getAllowedSuperpowersSkillsForAgent('fixer', FALLBACK_SUPERPOWERS_SKILLS)].sort();

    expect(allowed).toEqual([
      'systematic-debugging',
      'test-driven-development',
      'verification-before-completion',
    ]);
  });

  it('grants reviewer skills to oracle and hides controller skills', () => {
    const permissions = buildSuperpowersSkillPermissions('oracle', FALLBACK_SUPERPOWERS_SKILLS);

    expect(permissions['systematic-debugging']).toBe('allow');
    expect(permissions['verification-before-completion']).toBe('allow');
    expect(permissions['receiving-code-review']).toBe('allow');
    expect(permissions['writing-plans']).toBe('deny');
    expect(permissions['subagent-driven-development']).toBe('deny');
  });

  it('keeps using-superpowers bootstrap-only even for orchestrator', () => {
    const permissions = buildSuperpowersSkillPermissions('orchestrator', FALLBACK_SUPERPOWERS_SKILLS);

    expect(permissions['brainstorming']).toBe('allow');
    expect(permissions['writing-plans']).toBe('allow');
    expect(permissions['using-superpowers']).toBe('deny');
  });

  it('fails safe for unknown future superpowers skills', () => {
    const futureSkills = [...FALLBACK_SUPERPOWERS_SKILLS, 'future-superpowers-skill'];

    expect(buildSuperpowersSkillPermissions('fixer', futureSkills)['future-superpowers-skill']).toBe('deny');
    expect(buildSuperpowersSkillPermissions('orchestrator', futureSkills)['future-superpowers-skill']).toBe('allow');
  });
});
