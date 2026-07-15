import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildSuperpowersSkillPermissions,
  clearSuperpowersSkillDiscoveryCache,
  discoverSuperpowersSkillNames,
  getAllowedSuperpowersSkillsForAgent,
  isOrchestratorAgent,
} from './superpowers-policy';

const TEST_SUPERPOWERS_SKILLS = [
  'brainstorming',
  'receiving-code-review',
  'subagent-driven-development',
  'systematic-debugging',
  'test-driven-development',
  'using-superpowers',
  'verification-before-completion',
  'writing-plans',
];

describe('superpowers skill discovery', () => {
  let skillsRoot: string;

  beforeEach(() => {
    skillsRoot = mkdtempSync(join(tmpdir(), 'superpowers-lite-skills-'));
    clearSuperpowersSkillDiscoveryCache();
  });

  afterEach(() => {
    rmSync(skillsRoot, { recursive: true, force: true });
    clearSuperpowersSkillDiscoveryCache();
  });

  function addSkill(dirName: string, declaredName = dirName): void {
    const dir = join(skillsRoot, dirName);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${declaredName}\n---\n`);
  }

  it('returns an empty catalog when the root is omitted', () => {
    expect(discoverSuperpowersSkillNames()).toEqual([]);
  });

  it('discovers and sorts Lite skills from the explicit root', () => {
    addSkill('writing-plans');
    addSkill('brainstorming');
    expect(discoverSuperpowersSkillNames(skillsRoot)).toEqual([
      'brainstorming',
      'writing-plans',
    ]);
  });

  it('deduplicates frontmatter names and returns defensive copies', () => {
    addSkill('brainstorming-one', 'brainstorming');
    addSkill('brainstorming-two', 'brainstorming');
    const catalog = discoverSuperpowersSkillNames(skillsRoot);
    catalog.push('mutated-result');

    expect(discoverSuperpowersSkillNames(skillsRoot)).toEqual([
      'brainstorming',
    ]);
  });

  it('warns and returns empty for a missing root without stock fallback', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    expect(discoverSuperpowersSkillNames(join(skillsRoot, 'missing'))).toEqual(
      [],
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(
      'Superpowers skills directory is unavailable',
    );
    warn.mockRestore();
  });

  it('warns and returns empty when the configured root is not a directory', () => {
    const filePath = join(skillsRoot, 'not-a-directory');
    writeFileSync(filePath, 'not a skill root');
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    expect(discoverSuperpowersSkillNames(filePath)).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(
      'Superpowers skills directory is unreadable',
    );
    warn.mockRestore();
  });

  it('isolates cached catalogs by resolved root', () => {
    const otherRoot = mkdtempSync(
      join(tmpdir(), 'superpowers-lite-skills-other-'),
    );
    addSkill('brainstorming');
    mkdirSync(join(otherRoot, 'writing-plans'), { recursive: true });
    writeFileSync(
      join(otherRoot, 'writing-plans', 'SKILL.md'),
      '---\nname: writing-plans\n---\n',
    );
    expect(discoverSuperpowersSkillNames(skillsRoot)).toEqual([
      'brainstorming',
    ]);
    expect(discoverSuperpowersSkillNames(otherRoot)).toEqual(['writing-plans']);
    rmSync(otherRoot, { recursive: true, force: true });
  });
});

describe('superpowers policy', () => {
  it('fixer gets TDD + DBG + VBC + RCR (4 skills, RCR added)', () => {
    const allowed = getAllowedSuperpowersSkillsForAgent(
      'fixer',
      TEST_SUPERPOWERS_SKILLS,
    );

    expect(allowed.has('test-driven-development')).toBe(true);
    expect(allowed.has('systematic-debugging')).toBe(true);
    expect(allowed.has('verification-before-completion')).toBe(true);
    expect(allowed.has('receiving-code-review')).toBe(true);
    expect(allowed.size).toBe(4);
  });

  it('designer gets TDD + DBG + VBC + RCR (4 skills, RCR added)', () => {
    const allowed = getAllowedSuperpowersSkillsForAgent(
      'designer',
      TEST_SUPERPOWERS_SKILLS,
    );

    expect(allowed.has('test-driven-development')).toBe(true);
    expect(allowed.has('systematic-debugging')).toBe(true);
    expect(allowed.has('verification-before-completion')).toBe(true);
    expect(allowed.has('receiving-code-review')).toBe(true);
    expect(allowed.size).toBe(4);
  });

  it('oracle gets only systematic-debugging in SP allowlist', () => {
    const allowed = getAllowedSuperpowersSkillsForAgent(
      'oracle',
      TEST_SUPERPOWERS_SKILLS,
    );

    expect(allowed.has('systematic-debugging')).toBe(true);
    expect(allowed.has('verification-before-completion')).toBe(false);
    expect(allowed.has('receiving-code-review')).toBe(false);
    expect(allowed.size).toBe(1);
  });

  it('oracle-alpha inherits oracle (DBG only)', () => {
    const allowed = getAllowedSuperpowersSkillsForAgent(
      'oracle-alpha',
      TEST_SUPERPOWERS_SKILLS,
    );

    expect(allowed.has('systematic-debugging')).toBe(true);
    expect(allowed.size).toBe(1);
  });

  it('grants only systematic-debugging to oracle and hides controller skills', () => {
    const permissions = buildSuperpowersSkillPermissions(
      'oracle',
      TEST_SUPERPOWERS_SKILLS,
    );

    expect(permissions['systematic-debugging']).toBe('allow');
    expect(permissions['verification-before-completion']).toBe('deny');
    expect(permissions['receiving-code-review']).toBe('deny');
    expect(permissions['writing-plans']).toBe('deny');
    expect(permissions['subagent-driven-development']).toBe('deny');
  });

  it('keeps using-superpowers bootstrap-only even for orchestrator', () => {
    const permissions = buildSuperpowersSkillPermissions(
      'orchestrator',
      TEST_SUPERPOWERS_SKILLS,
    );

    expect(permissions.brainstorming).toBe('allow');
    expect(permissions['writing-plans']).toBe('allow');
    expect(permissions['using-superpowers']).toBe('deny');
  });

  it('fails safe for unknown future superpowers skills', () => {
    const futureSkills = [
      ...TEST_SUPERPOWERS_SKILLS,
      'future-superpowers-skill',
    ];

    expect(
      buildSuperpowersSkillPermissions('fixer', futureSkills)[
        'future-superpowers-skill'
      ],
    ).toBe('deny');
    expect(
      buildSuperpowersSkillPermissions('orchestrator', futureSkills)[
        'future-superpowers-skill'
      ],
    ).toBe('allow');
  });

  describe('isOrchestratorAgent()', () => {
    it('matches the literal orchestrator', () => {
      expect(isOrchestratorAgent('orchestrator')).toBe(true);
    });

    it('matches dash-suffix variants like orchestrator-beta', () => {
      expect(isOrchestratorAgent('orchestrator-beta')).toBe(true);
      expect(isOrchestratorAgent('orchestrator-alpha')).toBe(true);
      expect(isOrchestratorAgent('orchestrator-fallback')).toBe(true);
    });

    it('matches no-separator prefix variants like orchestrator2', () => {
      expect(isOrchestratorAgent('orchestrator2')).toBe(true);
      expect(isOrchestratorAgent('orchestratorx')).toBe(true);
    });

    it('does not match unrelated agents that happen to contain "orchestrator" mid-name', () => {
      expect(isOrchestratorAgent('fixer')).toBe(false);
      expect(isOrchestratorAgent('oracle')).toBe(false);
      expect(isOrchestratorAgent('my-orchestrator')).toBe(false);
      expect(isOrchestratorAgent('preorchestrator')).toBe(false);
    });
  });

  it('grants full superpowers allowlist to orchestrator-prefix variants', () => {
    const permissionsBeta = buildSuperpowersSkillPermissions(
      'orchestrator-beta',
      TEST_SUPERPOWERS_SKILLS,
    );
    expect(permissionsBeta.brainstorming).toBe('allow');
    expect(permissionsBeta['writing-plans']).toBe('allow');
    expect(permissionsBeta['subagent-driven-development']).toBe('allow');
    expect(permissionsBeta['using-superpowers']).toBe('deny');

    const permissionsX = buildSuperpowersSkillPermissions(
      'orchestrator2',
      TEST_SUPERPOWERS_SKILLS,
    );
    expect(permissionsX.brainstorming).toBe('allow');
    expect(permissionsX['writing-plans']).toBe('allow');
  });
});
