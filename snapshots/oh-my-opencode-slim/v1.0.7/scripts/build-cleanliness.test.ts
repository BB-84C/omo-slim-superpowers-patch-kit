import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dir, '..');
const staleDebugHookDeclaration = join(
  repoRoot,
  'dist',
  'hooks',
  'debug-root-retry',
  'index.d.ts',
);

describe('build artifact cleanliness', () => {
  test('build removes stale hook declarations from dist before emitting', () => {
    mkdirSync(dirname(staleDebugHookDeclaration), { recursive: true });
    writeFileSync(staleDebugHookDeclaration, 'export {};\n');

    const build = Bun.spawnSync(['bun', 'run', 'build'], {
      cwd: repoRoot,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    if (build.exitCode !== 0) {
      throw new Error(
        [
          'build failed',
          build.stdout.toString(),
          build.stderr.toString(),
        ].join('\n'),
      );
    }

    expect(existsSync(staleDebugHookDeclaration)).toBe(false);
  });
});
