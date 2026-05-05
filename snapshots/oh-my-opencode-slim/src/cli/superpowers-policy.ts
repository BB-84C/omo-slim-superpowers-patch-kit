import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const FALLBACK_SUPERPOWERS_SKILLS = [
  'brainstorming',
  'dispatching-parallel-agents',
  'executing-plans',
  'finishing-a-development-branch',
  'receiving-code-review',
  'requesting-code-review',
  'subagent-driven-development',
  'systematic-debugging',
  'test-driven-development',
  'using-git-worktrees',
  'using-superpowers',
  'verification-before-completion',
  'writing-plans',
  'writing-skills',
] as const;

const AGENT_ALLOWED_SUPERPOWERS: Record<string, string[]> = {
  orchestrator: FALLBACK_SUPERPOWERS_SKILLS.filter(
    (name) => name !== 'using-superpowers',
  ),
  fixer: [
    'test-driven-development',
    'systematic-debugging',
    'verification-before-completion',
  ],
  designer: [
    'test-driven-development',
    'systematic-debugging',
    'verification-before-completion',
  ],
  oracle: [
    'systematic-debugging',
    'verification-before-completion',
    'receiving-code-review',
  ],
  explorer: [],
  librarian: [],
  observer: [],
  council: [],
  councillor: [],
  // Best-of-N utility agents (custom; fall-through default = empty allowed)
  scout: [],
  validator: ['verification-before-completion'],
  gist: [],
  wildcard: [],
};

/**
 * Resolve a possibly-suffixed agent name to its base name for policy lookup.
 * Variant agents like "fixer-alpha", "oracle-gamma", "designer-delta" map to
 * their base "fixer", "oracle", "designer" respectively, so they inherit the
 * base agent's superpowers permission policy without needing to be listed
 * explicitly in AGENT_ALLOWED_SUPERPOWERS.
 *
 * Names that are already in the policy map are returned as-is (no stripping).
 * Names whose base prefix is not in the map are returned unchanged (will
 * fall through to empty-allowed default).
 *
 * Examples:
 *   "fixer-alpha"  -> "fixer"     (suffix-stripped)
 *   "fixer"        -> "fixer"     (already in map)
 *   "validator"    -> "validator" (already in map, no strip)
 *   "scout"        -> "scout"     (already in map)
 *   "unknown-foo"  -> "unknown-foo" (no match; empty allowed by default)
 */
export function resolveBaseAgentName(agentName: string): string {
  if (agentName in AGENT_ALLOWED_SUPERPOWERS) {
    return agentName;
  }
  const baseName = agentName.split('-')[0];
  if (baseName in AGENT_ALLOWED_SUPERPOWERS) {
    return baseName;
  }
  return agentName;
}

let cachedSuperpowersSkills: string[] | null = null;

function getOpencodeConfigDir(): string {
  const custom = process.env.OPENCODE_CONFIG_DIR?.trim();
  return custom || join(homedir(), '.config', 'opencode');
}

function extractSkillName(skillDirPath: string, fallbackName: string): string {
  const skillFile = join(skillDirPath, 'SKILL.md');
  if (!existsSync(skillFile)) {
    return fallbackName;
  }

  const content = readFileSync(skillFile, 'utf8');
  const match = content.match(/(?:^|\n)name:\s*["']?([^"'\r\n]+)["']?/);
  return match?.[1]?.trim() || fallbackName;
}

export function discoverSuperpowersSkillNames(): string[] {
  if (cachedSuperpowersSkills) {
    return [...cachedSuperpowersSkills];
  }

  const skillsRoot = join(getOpencodeConfigDir(), 'superpowers', 'skills');
  if (!existsSync(skillsRoot)) {
    cachedSuperpowersSkills = [...FALLBACK_SUPERPOWERS_SKILLS];
    return [...cachedSuperpowersSkills];
  }

  const discovered = readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => extractSkillName(join(skillsRoot, entry.name), entry.name))
    .filter(Boolean);

  cachedSuperpowersSkills = discovered.length
    ? [...new Set(discovered)].sort()
    : [...FALLBACK_SUPERPOWERS_SKILLS];

  return [...cachedSuperpowersSkills];
}

export function getAllowedSuperpowersSkillsForAgent(
  agentName: string,
  superpowersSkills: readonly string[] = discoverSuperpowersSkillNames(),
): Set<string> {
  // Resolve variant suffix names (e.g., "fixer-alpha" -> "fixer") so they
  // inherit the base agent's policy without per-variant entries.
  const resolvedName = resolveBaseAgentName(agentName);

  if (resolvedName === 'orchestrator') {
    return new Set(superpowersSkills.filter((name) => name !== 'using-superpowers'));
  }

  const explicit = new Set(AGENT_ALLOWED_SUPERPOWERS[resolvedName] ?? []);
  const allowed = new Set<string>();

  for (const skill of superpowersSkills) {
    if (skill === 'using-superpowers') {
      continue;
    }

    if (explicit.has(skill)) {
      allowed.add(skill);
    }
  }

  return allowed;
}

export function buildSuperpowersSkillPermissions(
  agentName: string,
  superpowersSkills: readonly string[] = discoverSuperpowersSkillNames(),
): Record<string, 'allow' | 'deny'> {
  const permissions: Record<string, 'allow' | 'deny'> = {};
  const allowed = getAllowedSuperpowersSkillsForAgent(agentName, superpowersSkills);

  for (const skill of superpowersSkills) {
    if (skill === 'using-superpowers') {
      permissions[skill] = 'deny';
      continue;
    }

    permissions[skill] = allowed.has(skill) ? 'allow' : 'deny';
  }

  return permissions;
}
