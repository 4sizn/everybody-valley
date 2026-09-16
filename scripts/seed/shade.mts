/**
 * P1 그늘 파이프라인 호출 — 계곡별 파일을 `python -m shade build` 에 넘긴다 (결정 (h)).
 *
 * `pnpm shade:build` 의 build.sh 와 같은 호출을 계곡별 `data/valleys/<id>.geojson` 으로 한다.
 * 파이프라인은 `shadeByHour`·`canopyCover`·`shadeRatio` 를 입력 파일에 역기입하고
 * `data/shade/<id>/*.geojson` + `index.json` 을 쓴다. 계곡당 ~35 s(첫 실행은 자산 다운로드).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { FACILITIES_DIR, ROOT, SHADE_DIR, VALLEYS_DIR } from './env.mts';
import { log, warn } from './log.mts';

const PYTHON = path.join(ROOT, 'scripts/shade/.venv/bin/python');

export function shadeEnvironmentReady(): boolean {
  return fs.existsSync(PYTHON);
}

/** 한 계곡의 그늘을 산출·역기입한다. 실패해도 다음 계곡으로 간다(반환값 false). */
export function runShade(valleyId: string): boolean {
  const segments = path.join(VALLEYS_DIR, `${valleyId}.geojson`);
  const facilities = path.join(FACILITIES_DIR, `${valleyId}.geojson`);
  const args = ['-m', 'shade', 'build', '--segments', segments, '--out', SHADE_DIR];
  if (fs.existsSync(facilities)) args.push('--facilities', facilities);
  const started = Date.now();
  const result = spawnSync(PYTHON, args, {
    cwd: ROOT,
    env: { ...process.env, PYTHONPATH: path.join(ROOT, 'scripts') },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const seconds = Math.round((Date.now() - started) / 1000);
  if (result.status !== 0) {
    warn(
      `[shade] ${valleyId} 실패(${seconds}s): ${(result.stderr ?? '').trim().split('\n').slice(-3).join(' | ')}`,
    );
    return false;
  }
  const lines = (result.stdout ?? '').trim().split('\n');
  log(
    `[shade] ${valleyId} ${seconds}s — ${lines.find((line) => line.includes('canopyCover')) ?? lines.at(-1) ?? ''}`,
  );
  return true;
}
