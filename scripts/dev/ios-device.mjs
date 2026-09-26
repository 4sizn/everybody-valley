/**
 * 아이폰 실기기에서 웹 화면을 열고 만지고 찍는다 (시각 증명 보조, 2026-09-26).
 *
 * `xcrun devicectl` 은 화면 캡처와 URL 열기는 되지만 **탭·스와이프가 없다**. 그래서 터치가
 * 필요한 확인(지도 끌기, 탭 전환, 목록 스크롤)은 Appium + WebDriverAgent 로 한다. 이 파일은
 * 그 둘을 한 줄 명령으로 감싼 것이고, 새로 만든 로직은 없다.
 *
 *   node scripts/dev/ios-device.mjs shot  <out.png> [url]     # 열고(선택) 찍는다 — Appium 불필요
 *   node scripts/dev/ios-device.mjs drag  <url> [dx] [dy]     # 화면 가운데에서 끌고 전후를 찍는다
 *   node scripts/dev/ios-device.mjs tap   <url> <보이는 글자> # 그 글자의 요소를 누르고 찍는다
 *
 * 결과 PNG 는 `.proof/ios/` 에 쌓인다(gitignore). `python3 scripts/proof-check.py .proof/ios`
 * 로 빈 화면을 먼저 거르고, 사람이 직접 열어 본다.
 *
 * 준비 (한 번만)
 *   npm i -g appium && appium driver install xcuitest
 *   IOS_TEAM_ID=<팀 ID> node scripts/dev/ios-device.mjs drag http://…   ← 첫 실행이 WDA 를 서명·설치
 *   폰에 "'XCTest' 앱을 사용하려면 iPhone 암호 입력" 이 뜨면 **기기 소유자가 직접** 입력한다.
 *
 * 환경변수
 *   IOS_UDID     생략하면 연결된 실기기 중 첫 번째를 쓴다.
 *   IOS_TEAM_ID  WDA 서명 팀. 생략하면 설치된 프로비저닝 프로파일에서 찾는다.
 *   APPIUM_URL   기본 http://127.0.0.1:4723
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const APPIUM = process.env.APPIUM_URL ?? 'http://127.0.0.1:4723';
const OUT_DIR = '.proof/ios';
const die = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

/** 연결된 실기기의 UDID. 시뮬레이터는 `physical` 이 아니라서 걸러진다. */
async function deviceUdid() {
  if (process.env.IOS_UDID) return process.env.IOS_UDID;
  const { stdout } = await run('xcrun', ['devicectl', 'list', 'devices']);
  const line = stdout.split('\n').find((l) => l.includes('physical') && !l.includes('unavailable'));
  const udid =
    line?.match(/\b([0-9A-F]{8}-[0-9A-F]{16})\b/i)?.[1] ?? line?.match(/\b(\d{8}-\w+)\b/)?.[1];
  if (!udid) die('연결된 아이폰이 없다. 케이블을 확인하고 폰의 잠금을 풀어라.');
  return udid;
}

/** WDA 를 서명할 팀. 설치된 프로파일에서 찾지 못하면 사용자가 알려 줘야 한다. */
async function teamId() {
  if (process.env.IOS_TEAM_ID) return process.env.IOS_TEAM_ID;
  const dir = `${process.env.HOME}/Library/MobileDevice/Provisioning Profiles`;
  const files = await fs.readdir(dir).catch(() => []);
  for (const file of files.filter((f) => f.endsWith('.mobileprovision'))) {
    const { stdout } = await run('sh', [
      '-c',
      `security cms -D -i ${JSON.stringify(path.join(dir, file))} | plutil -extract TeamIdentifier.0 raw -`,
    ]).catch(() => ({ stdout: '' }));
    const id = stdout.trim();
    if (id) return id;
  }
  die('서명 팀을 찾지 못했다. IOS_TEAM_ID=<팀 ID> 로 알려 줘라.');
}

/**
 * 긴 변을 이 크기로 줄이면서 **8비트로 낮춘다**. `devicectl` 이 주는 PNG 는 채널당 16비트라
 * `scripts/proof-check.py` 가 읽지 못하고, 한 장이 1.3 MB 를 넘는다(2026-09-26 실측).
 */
const SHOT_LONG_EDGE = 1400;

async function capture(udid, out) {
  await fs.mkdir(path.dirname(out), { recursive: true });
  await run('xcrun', [
    'devicectl',
    'device',
    'capture',
    'screenshot',
    '--device',
    udid,
    '--destination',
    out,
  ]);
  await run('sips', ['-Z', String(SHOT_LONG_EDGE), out, '--out', out]);
  return out;
}

const api = async (method, endpoint, body) => {
  const response = await fetch(APPIUM + endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 300) };
  }
};

async function session(udid) {
  const status = await fetch(`${APPIUM}/status`).catch(() => null);
  if (!status?.ok) die(`Appium 이 꺼져 있다. 먼저 켠다:  appium --port 4723`);
  const created = await api('POST', '/session', {
    capabilities: {
      alwaysMatch: {
        platformName: 'iOS',
        'appium:automationName': 'XCUITest',
        'appium:udid': udid,
        'appium:deviceName': 'iPhone',
        'appium:browserName': 'Safari',
        'appium:xcodeOrgId': await teamId(),
        'appium:xcodeSigningId': 'Apple Development',
        'appium:wdaLaunchTimeout': 300_000,
        'appium:newCommandTimeout': 600,
      },
      firstMatch: [{}],
    },
  });
  const id = created.value?.sessionId;
  if (!id) die(`세션을 못 만들었다: ${JSON.stringify(created).slice(0, 400)}`);
  return id;
}

/** 페이지가 뜨는 데 걸리는 시간. 지도 타일까지 기다린다. */
const SETTLE_MS = 15_000;

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const udid = await deviceUdid();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  if (command === 'shot') {
    const [out, url] = rest;
    if (!out) die('쓸 파일 이름이 없다: shot <out.png> [url]');
    if (url) {
      await run('xcrun', [
        'devicectl',
        'device',
        'process',
        'openURL',
        '--device',
        udid,
        '--activate',
        url,
      ]);
      await new Promise((r) => setTimeout(r, SETTLE_MS));
    }
    process.stdout.write(`${await capture(udid, out)}\n`);
    return;
  }

  if (command !== 'drag' && command !== 'tap') {
    die('쓸 수 있는 명령: shot · drag · tap');
  }

  const [url, a, b] = rest;
  if (!url) die(`${command} <url> …`);
  const id = await session(udid);
  try {
    await api('POST', `/session/${id}/url`, { url });
    await new Promise((r) => setTimeout(r, SETTLE_MS));
    const before = await capture(udid, `${OUT_DIR}/${stamp}-before.png`);
    process.stdout.write(`before ${before}\n`);

    if (command === 'drag') {
      const { width, height } = (await api('GET', `/session/${id}/window/rect`)).value;
      const x = Math.round(width / 2);
      const y = Math.round(height * 0.42);
      const dx = Number(a ?? 0);
      const dy = Number(b ?? -160);
      await api('POST', `/session/${id}/actions`, {
        actions: [
          {
            type: 'pointer',
            id: 'finger1',
            parameters: { pointerType: 'touch' },
            actions: [
              { type: 'pointerMove', duration: 0, x, y },
              { type: 'pointerDown', button: 0 },
              { type: 'pause', duration: 120 },
              { type: 'pointerMove', duration: 600, x: x + dx, y: y + dy },
              { type: 'pause', duration: 150 },
              { type: 'pointerUp', button: 0 },
            ],
          },
        ],
      });
      process.stdout.write(`drag ${x},${y} -> ${x + dx},${y + dy}\n`);
    } else {
      if (!a) die('누를 글자가 없다: tap <url> <보이는 글자>');
      const found = await api('POST', `/session/${id}/element`, {
        using: 'xpath',
        value: `//*[normalize-space(text())=${JSON.stringify(a)}]`,
      });
      const element = found.value?.['element-6066-11e4-a52e-4f735466cecf'] ?? found.value?.ELEMENT;
      if (!element) die(`'${a}' 를 찾지 못했다: ${JSON.stringify(found).slice(0, 200)}`);
      await api('POST', `/session/${id}/element/${element}/click`);
      process.stdout.write(`tap ${a}\n`);
    }

    await new Promise((r) => setTimeout(r, 2500));
    process.stdout.write(`after  ${await capture(udid, `${OUT_DIR}/${stamp}-after.png`)}\n`);
  } finally {
    await api('DELETE', `/session/${id}`);
  }
}

await main();
