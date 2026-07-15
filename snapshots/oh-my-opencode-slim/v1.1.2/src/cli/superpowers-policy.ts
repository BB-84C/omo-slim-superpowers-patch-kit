import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const AGENT_ALLOWED_SUPERPOWERS: Record<string, string[]> = {
  // Base-name marker: orchestrator-shaped variants receive their full catalog
  // allowance in getAllowedSuperpowersSkillsForAgent, not from this empty list.
  orchestrator: [],
  fixer: [
    'test-driven-development',
    'systematic-debugging',
    'verification-before-completion',
    'receiving-code-review',
  ],
  designer: [
    'test-driven-development',
    'systematic-debugging',
    'verification-before-completion',
    'receiving-code-review',
  ],
  oracle: ['systematic-debugging'],
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

/**
 * Detect whether an agent name should be treated as an orchestrator.
 * Matches the literal "orchestrator" plus any prefix-extended name like
 * "orchestrator-beta", "orchestrator2", "orchestratorx", etc. Used to make
 * orchestrator-shaped variant agents (intended as fallback primary agents
 * when the main orchestrator's model rate-limits) inherit orchestrator's
 * runtime behaviour: bridge-prompt injection, post-file-tool nudge,
 * mode='primary' classification, and full superpowers skill allowance.
 */
export function isOrchestratorAgent(agentName: string): boolean {
  return agentName.startsWith('orchestrator');
}

const cachedSuperpowersSkills = new Map<string, string[]>();

export function clearSuperpowersSkillDiscoveryCache(): void {
  cachedSuperpowersSkills.clear();
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

export function discoverSuperpowersSkillNames(skillsRoot?: string): string[] {
  const configuredRoot = skillsRoot?.trim();
  if (!configuredRoot) {
    return [];
  }

  const resolvedRoot = resolve(configuredRoot);
  const cached = cachedSuperpowersSkills.get(resolvedRoot);
  // Cached empty catalogs intentionally suppress repeated unavailable-root warnings.
  if (cached) {
    return [...cached];
  }

  if (!existsSync(resolvedRoot)) {
    console.warn(
      `[oh-my-opencode-slim] Superpowers skills directory is unavailable: ${resolvedRoot}; bridge overlay disabled.`,
    );
    cachedSuperpowersSkills.set(resolvedRoot, []);
    return [];
  }

  try {
    const discovered = readdirSync(resolvedRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) =>
        extractSkillName(join(resolvedRoot, entry.name), entry.name),
      )
      .filter(Boolean);
    const catalog = [...new Set(discovered)].sort();
    cachedSuperpowersSkills.set(resolvedRoot, catalog);
    return [...catalog];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[oh-my-opencode-slim] Superpowers skills directory is unreadable: ${resolvedRoot}; bridge overlay disabled. ${message}`,
    );
    cachedSuperpowersSkills.set(resolvedRoot, []);
    return [];
  }
}

export function getAllowedSuperpowersSkillsForAgent(
  agentName: string,
  superpowersSkills: readonly string[] = [],
): Set<string> {
  // Orchestrator-shaped agents (literal "orchestrator", "orchestrator-beta",
  // "orchestrator2", etc.) get the full superpowers allowlist so a fallback
  // orchestrator can do real orchestration work when the main one is
  // rate-limited.
  if (isOrchestratorAgent(agentName)) {
    return new Set(
      superpowersSkills.filter((name) => name !== 'using-superpowers'),
    );
  }

  // Resolve variant suffix names (e.g., "fixer-alpha" -> "fixer") so they
  // inherit the base agent's policy without per-variant entries.
  const resolvedName = resolveBaseAgentName(agentName);

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
  superpowersSkills: readonly string[] = [],
): Record<string, 'allow' | 'deny'> {
  const permissions: Record<string, 'allow' | 'deny'> = {};
  const allowed = getAllowedSuperpowersSkillsForAgent(
    agentName,
    superpowersSkills,
  );

  for (const skill of superpowersSkills) {
    if (skill === 'using-superpowers') {
      permissions[skill] = 'deny';
      continue;
    }

    permissions[skill] = allowed.has(skill) ? 'allow' : 'deny';
  }

  return permissions;
}
