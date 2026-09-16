/**
 * 배포 번들. `@modu-valley/core` 는 소스(.ts, 확장자 없는 상대 import)를 그대로 내보내는 패키지라
 * Node 가 직접 실행할 수 없다 — esbuild 로 한 파일에 묶는다. 네이티브 바인딩(better-sqlite3·sharp)만 밖에 둔다
 * — 둘 다 플랫폼별 프리빌트 바이너리를 자기 패키지 디렉터리 기준 상대 경로로 찾는다(F5a).
 */
import path from 'node:path';
import { build } from 'esbuild';

const here = import.meta.dirname;
const root = path.resolve(here, '..');

await build({
  entryPoints: [path.join(root, 'src/index.ts')],
  outfile: path.join(root, 'dist/index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  external: ['better-sqlite3', 'sharp'],
  // 번들 안에서 CJS 의존성이 `require` 를 쓰는 경우를 위해 ESM 진입점에 셈을 붙인다.
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
  logLevel: 'info',
});
