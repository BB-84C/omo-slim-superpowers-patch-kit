import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const distDir = resolve(import.meta.dir, '..', 'dist');

rmSync(distDir, { recursive: true, force: true });
