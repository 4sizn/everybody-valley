/**
 * maplibre-gl 워커 스크립트를 `public/` 으로 복사한다.
 *
 * 왜 필요한가
 *   maplibre-gl 6 은 ESM 전용이고, 워커를 `import.meta.url` 기준 형제 파일로
 *   `{type:'module'}` 워커로 띄운다(`maplibre-gl-worker.mjs`, 이 파일은 다시
 *   `maplibre-gl-shared.mjs` 를 import 한다). Metro 는 그 두 파일을 번들
 *   산출물로 내보내지 않으므로 워커 요청이 404 가 되고, 워커가 없으면
 *   타일 로딩과 GeoJSON 파싱이 멈춘다 — 지도는 떠 있는데 마커가 하나도
 *   안 보이는 증상으로 나타난다.
 *
 * 왜 커밋하지 않는가
 *   버전이 어긋나면 번들의 maplibre 와 워커가 다른 코드가 된다. 설치된
 *   패키지에서 매번 복사해 그 위험을 없앤다(`public/maplibre/` 는 gitignore).
 */
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

const WORKER_FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];
const TARGET_DIR = join(import.meta.dirname, '..', 'public', 'maplibre');

const packageJsonPath = require.resolve('maplibre-gl/package.json');
const distDir = join(dirname(packageJsonPath), 'dist');
const { version } = require(packageJsonPath);

await mkdir(TARGET_DIR, { recursive: true });
for (const file of WORKER_FILES) {
  await copyFile(join(distDir, file), join(TARGET_DIR, file));
}
// 어떤 버전에서 복사됐는지 남긴다. 번들과 어긋나면 이 파일이 단서가 된다.
await writeFile(join(TARGET_DIR, 'VERSION'), `maplibre-gl@${version}\n`, 'utf8');

process.stdout.write(`maplibre-gl@${version} 워커를 public/maplibre 로 복사했습니다.\n`);
