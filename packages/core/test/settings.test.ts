/**
 * 설정 면·테마 선택 (C9).
 *
 * 검증하는 것 — 결정 (a) 설정 면은 시트의 세 번째 면이고 목록 ↔ 설정은 기존 플립을 탄다,
 * 닫기는 목록으로 / (d) 테마 선택은 저장되고 세션이 다시 만들어질 때 씨앗·저장값으로
 * 이어진다 / 해석 순서: 저장값 → 앱 기본(씨앗).
 */
import { describe, expect, it } from 'vitest';
import { MapSession } from '../src/application/MapSession';
import { STORAGE_KEYS } from '../src/application/ports/StoragePort';
import type { AppStateSeed } from '../src/application/state/AppState';
import {
  initialAppState,
  isThemeMode,
  SHEET_FACES,
  type SheetFace,
  THEME_MODES,
} from '../src/application/state/AppState';
import { MemoryStorage } from '../src/data/MemoryStorage';
import { StaticFestivalRepository } from '../src/data/StaticFestivalRepository';
import { createSeoulFireworks2026, LAUNCH_SITE } from '../src/data/seoulFireworks2026';
import { INITIAL_VIEW } from '../src/domain/camera/CameraPresets';
import { NONE_CANCELLATION_TOKEN } from '../src/shared/async/cancellation';
import { NoopLogger } from '../src/shared/logger/NoopLogger';
import { FakeMapEngine } from './doubles/FakeMapEngine';

const logger = new NoopLogger();
const festival = createSeoulFireworks2026();

function createSession(options: { storage?: MemoryStorage; seed?: AppStateSeed } = {}) {
  const engine = new FakeMapEngine(logger, {
    center: LAUNCH_SITE,
    zoom: INITIAL_VIEW.zoom,
    pitch: INITIAL_VIEW.pitch,
    bearing: INITIAL_VIEW.bearing,
  });
  const storage = options.storage ?? new MemoryStorage();
  const session = new MapSession({
    scene: 'festival',
    engine,
    repository: new StaticFestivalRepository(),
    storage,
    logger,
    ...(options.seed === undefined ? {} : { seed: options.seed }),
  });
  return { session, engine, storage };
}

async function readySession(options: { storage?: MemoryStorage; seed?: AppStateSeed } = {}) {
  const ctx = createSession(options);
  await ctx.session.initialize(NONE_CANCELLATION_TOKEN);
  return ctx;
}

/** 면이 바뀐 순서만 기록한다 — 플립이 어느 면을 거쳤는지 읽기 위해. */
function recordFaces(session: MapSession): SheetFace[] {
  const faces: SheetFace[] = [session.store.state.sheetFace];
  session.store.subscribe(() => {
    const face = session.store.state.sheetFace;
    if (faces.at(-1) !== face) faces.push(face);
  });
  return faces;
}

describe('상태 모델', () => {
  it('시트 면은 목록·상세·설정 셋이고 테마 선택은 라이트·다크·시스템 셋이다', () => {
    expect(SHEET_FACES).toEqual(['list', 'detail', 'settings']);
    expect(THEME_MODES).toEqual(['light', 'dark', 'system']);
  });

  it('isThemeMode 는 세 값만 받는다', () => {
    expect(isThemeMode('light')).toBe(true);
    expect(isThemeMode('dark')).toBe(true);
    expect(isThemeMode('system')).toBe(true);
    expect(isThemeMode('auto')).toBe(false);
    expect(isThemeMode('')).toBe(false);
    expect(isThemeMode(null)).toBe(false);
    expect(isThemeMode(undefined)).toBe(false);
  });

  it('초기 테마 선택은 system, 씨앗이 있으면 그 값으로 시작한다', () => {
    expect(initialAppState('festival').themeMode).toBe('system');
    expect(initialAppState('valley').themeMode).toBe('system');
    expect(initialAppState('festival', undefined, { themeMode: 'dark' }).themeMode).toBe('dark');
  });

  it('씨앗의 설정 면은 면과 내비 탭을 함께 켠다 — 목록 씨앗은 기본과 같다', () => {
    const settings = initialAppState('valley', undefined, { sheetFace: 'settings' });
    expect(settings.sheetFace).toBe('settings');
    expect(settings.navTab).toBe('settings');
    expect(settings.fireworksEnabled).toBe(false);
    const list = initialAppState('valley', undefined, { sheetFace: 'list' });
    expect(list.sheetFace).toBe('list');
    expect(list.navTab).toBe('home');
  });
});

describe('테마 선택 복원 — 저장값 → 씨앗', () => {
  it('저장값이 없으면 씨앗(앱 기본)을 그대로 둔다', async () => {
    const { session } = await readySession({ seed: { themeMode: 'light' } });
    expect(session.store.state.themeMode).toBe('light');
    session.dispose();
  });

  it('저장값이 없고 씨앗도 없으면 system', async () => {
    const { session } = await readySession();
    expect(session.store.state.themeMode).toBe('system');
    session.dispose();
  });

  it('저장값이 있으면 씨앗을 이긴다', async () => {
    const storage = new MemoryStorage();
    await storage.write(STORAGE_KEYS.themeMode, 'dark', NONE_CANCELLATION_TOKEN);
    const { session } = await readySession({ storage, seed: { themeMode: 'light' } });
    expect(session.store.state.themeMode).toBe('dark');
    session.dispose();
  });

  it('모르는 저장값은 버리고 씨앗을 쓴다', async () => {
    const storage = new MemoryStorage();
    await storage.write(STORAGE_KEYS.themeMode, 'sepia', NONE_CANCELLATION_TOKEN);
    const { session } = await readySession({ storage, seed: { themeMode: 'light' } });
    expect(session.store.state.themeMode).toBe('light');
    expect(session.store.state.status).toBe('ready');
    session.dispose();
  });

  it('저장 키는 modu-valley/theme-mode', () => {
    expect(STORAGE_KEYS.themeMode).toBe('modu-valley/theme-mode');
  });
});

describe('테마 선택 변경', () => {
  it('저장하고 상태를 바꾼다', async () => {
    const { session, storage } = await readySession({ seed: { themeMode: 'light' } });
    const result = await session.setThemeMode('dark');

    expect(result.ok).toBe(true);
    expect(session.store.state.themeMode).toBe('dark');
    const saved = await storage.read(STORAGE_KEYS.themeMode, NONE_CANCELLATION_TOKEN);
    expect(saved.ok && saved.value).toBe('dark');
    session.dispose();
  });

  it('같은 값은 저장하지 않는다', async () => {
    const { session, storage } = await readySession({ seed: { themeMode: 'light' } });
    await session.setThemeMode('light');
    const saved = await storage.read(STORAGE_KEYS.themeMode, NONE_CANCELLATION_TOKEN);
    expect(saved.ok && saved.value).toBeNull();
    session.dispose();
  });

  it('새 세션은 저장값을 이어받는다 — 재생성(결정 (d))의 근거', async () => {
    const storage = new MemoryStorage();
    const first = await readySession({ storage, seed: { themeMode: 'light' } });
    await first.session.setThemeMode('system');
    first.session.dispose();

    const second = await readySession({ storage, seed: { themeMode: 'light' } });
    expect(second.session.store.state.themeMode).toBe('system');
    second.session.dispose();
  });
});

describe('설정 면 열기·닫기', () => {
  it('목록에서 열면 플립 한 번으로 설정 면 + 설정 탭', async () => {
    const { session } = await readySession();
    const faces = recordFaces(session);

    const pending = session.openSettings();
    // 탭·접힘은 동기, 면은 접힘이 끝난 뒤 바뀐다(데모 flipTo).
    expect(session.store.state.navTab).toBe('settings');
    expect(session.store.state.flipPhase).toBe('folding');
    expect(session.store.state.sheetFace).toBe('list');

    const result = await pending;
    expect(result.ok).toBe(true);
    expect(faces).toEqual(['list', 'settings']);
    expect(session.store.state.flipPhase).toBe('idle');
    session.dispose();
  });

  it('peek 이던 시트는 half 로 펴진다 (C8)', async () => {
    const { session } = await readySession();
    session.setSheetSnap('peek');
    expect(session.store.state.sheetSnap).toBe('peek');
    await session.openSettings();
    expect(session.store.state.sheetSnap).toBe('half');
    session.dispose();
  });

  it('full 이던 시트는 그대로 둔다 (C8) — 설정 열기가 끌어올린 상태를 되돌리지 않는다', async () => {
    const { session } = await readySession();
    session.setSheetSnap('full');
    await session.openSettings();
    expect(session.store.state.sheetSnap).toBe('full');
    session.dispose();
  });

  it('이미 설정 면이면 다시 뒤집지 않는다', async () => {
    const { session } = await readySession();
    await session.openSettings();
    const faces = recordFaces(session);
    const result = await session.openSettings();
    expect(result.ok).toBe(true);
    expect(faces).toEqual(['settings']);
    session.dispose();
  });

  it('상세에서 열면 선택을 해제하며 목록을 거치지 않고 곧장 설정 면으로', async () => {
    const { session, engine } = await readySession();
    const spot = festival.spots[0];
    if (spot === undefined) throw new Error('fixture');
    await session.selectSpot(spot.id);
    const faces = recordFaces(session);

    const result = await session.openSettings();
    const state = session.store.state;
    expect(result.ok).toBe(true);
    expect(faces).toEqual(['detail', 'settings']);
    expect(state.selectedSpotId).toBeNull();
    expect(state.navTab).toBe('settings');
    expect(state.tickerVisible).toBe(true);
    expect(engine.selections.at(-1)).toBeNull();
    // 복귀 카메라(데모 closeSpot 의 easeTo)는 그대로 돈다.
    expect(engine.lastMove?.target.zoom).toBe(13.8);
    session.dispose();
  });

  it('닫으면 목록 면 + 홈 탭', async () => {
    const { session } = await readySession();
    await session.openSettings();
    const faces = recordFaces(session);

    const pending = session.closeSettings();
    expect(session.store.state.navTab).toBe('home');
    const result = await pending;
    expect(result.ok).toBe(true);
    expect(faces).toEqual(['settings', 'list']);
    session.dispose();
  });

  it('설정 면이 아닐 때 닫기는 무시된다', async () => {
    const { session } = await readySession();
    const result = await session.closeSettings();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.context['reason']).toBe('not-open');
    expect(session.store.state.sheetFace).toBe('list');
    session.dispose();
  });

  it('전환 중 재진입은 버려진다', async () => {
    const { session } = await readySession();
    const first = session.openSettings();
    const dropped = await session.closeSettings();
    expect(dropped.ok).toBe(false);
    await first;
    expect(session.store.state.sheetFace).toBe('settings');
    session.dispose();
  });

  it('내비 설정 탭은 설정 면을 열고, 설정 면에서 다른 탭을 누르면 닫히며 그 탭이 켜진다', async () => {
    const { session } = await readySession();
    session.setNavTab('settings');
    await new Promise((r) => setTimeout(r, 600));
    expect(session.store.state.sheetFace).toBe('settings');

    session.setNavTab('spots');
    expect(session.store.state.navTab).toBe('spots');
    await new Promise((r) => setTimeout(r, 600));
    expect(session.store.state.sheetFace).toBe('list');
    expect(session.store.state.navTab).toBe('spots');
    session.dispose();
  });

  it('목록 면에서 다른 탭은 표시만 바꾼다(데모)', async () => {
    const { session } = await readySession();
    const faces = recordFaces(session);
    session.setNavTab('report');
    expect(session.store.state.navTab).toBe('report');
    expect(faces).toEqual(['list']);
    session.dispose();
  });

  it('설정 면 씨앗으로 만든 세션은 설정 면에서 시작한다 — 테마 전환 뒤 재생성', async () => {
    const { session } = await readySession({
      seed: { sheetFace: 'settings', themeMode: 'dark' },
    });
    expect(session.store.state.sheetFace).toBe('settings');
    expect(session.store.state.navTab).toBe('settings');
    expect(session.store.state.themeMode).toBe('dark');
    expect(session.store.state.status).toBe('ready');
    session.dispose();
  });
});
