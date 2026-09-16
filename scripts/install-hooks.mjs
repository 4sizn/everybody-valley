import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (existsSync(new URL('../.git', import.meta.url)))
  execFileSync('git', ['config', 'core.hooksPath', '.githooks']);
