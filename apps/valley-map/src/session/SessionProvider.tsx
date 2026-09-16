/**
 * 세션 조립과 생애 관리 — 이 앱의 DI 지점.
 *
 * 지도 엔진은 표면(DOM 노드 / 네이티브 뷰)이 마운트된 뒤에야 만들 수 있다.
 * 그래서 두 단계로 나뉜다.
 *   1. `MapHost` 를 먼저 붙여 표면 손잡이를 받는다.
 *   2. 손잡이가 생기면 엔진 → 세션을 만들고 초기화를 시작한다.
 *
 * 어느 장면인지는 라우트가 `source` 로 정한다(`app/index.tsx` 계곡, `app/firework.tsx`
 * 데모). 이 컴포넌트는 장면을 모른 채 조립만 한다.
 *
 * 언마운트(또는 StrictMode 의 이중 마운트)에서는 초기화 토큰을 취소하고
 * 세션을 `dispose()` 한다. 세션이 엔진·타이머·큐·구독을 모두 물고 있으므로
 * 이 한 줄로 정리가 끝난다.
 *
 * 테마(C9) — 지도 팔레트는 엔진 생성 시 고정되므로 **테마가 바뀌면 세션을 다시 만든다**
 * (결정 (d)). 세션의 `themeMode` 는 사용자 선택의 진실이고, 이 컴포넌트가 그 변화를
 * `ThemeProvider` 에 알린다(`useThemePreference`). 팔레트가 갈리면 `styleMode` 가 바뀌어
 * 아래 effect 가 다시 돌고, 새 세션은 현재 선택과 열려 있던 설정 면을 **씨앗**으로 이어받아
 * 화면이 튀지 않는다(`MapSessionDeps.seed`). 정리와 생성이 같은 커밋에서 일어나므로 자식은
 * `null` 세션을 보지 않는다.
 */
import {
  CancellationTokenSource,
  ConsoleLogger,
  type InitialCameraView,
  type LngLat,
  type Logger,
  MapSession,
  type SceneSource,
} from '@modu-valley/core';
import { createContext, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createApiClient } from '@/api/createApiClient';
import { DevAlertFixtureApiPort, devAlertOverride } from '@/api/devAlertFixture';
import {
  createMapEngine,
  createStorage,
  MapHost,
  type MapHostHandle,
} from '@/platform/mapPlatform';
import { useTheme, useThemePreference } from '@/theme/ThemeProvider';

export const SessionContext = createContext<MapSession | null>(null);

/**
 * 세션 재생성 손잡이(C7). 스타일 자체를 못 받아 세션이 `failed` 로 끝나면 전면 `RetryState` 가
 * 이것을 부른다 — 엔진을 새로 만들어 스타일 fetch 부터 다시 한다(테마 전환과 같은 경로).
 * Provider 밖에서는 아무 일도 하지 않는다.
 */
export const SessionRestartContext = createContext<() => void>(() => {});

const rootLogger: Logger = new ConsoleLogger('valley');

export type SessionProviderProps = {
  /**
   * 장면과 데이터 출처(`{ scene:'festival', repository }` | `{ scene:'valley', valleyRepository }`).
   * 라우트가 모듈 상수로 넘긴다 — 참조가 바뀌면 세션을 다시 만든다.
   */
  readonly source: SceneSource;
  /** 지도 최초 중심. 엔진은 이 점에서 시작하고, 적재 유즈케이스가 장면에 맞게 시점을 잡는다. */
  readonly initialCenter: LngLat;
  /** 지도 최초 시점(줌·pitch·bearing). 첫 카메라 명령의 offset 이 올바르게 투영되도록 장면과 맞춘다. */
  readonly initialView: InitialCameraView;
  readonly children: ReactNode;
  readonly preserveSelection?: boolean;
};

export function SessionProvider({
  source,
  initialCenter,
  initialView,
  children,
  preserveSelection = false,
}: SessionProviderProps) {
  const [host, setHost] = useState<MapHostHandle | null>(null);
  const [session, setSession] = useState<MapSession | null>(null);
  /* 재시도 세대(C7). 올리면 아래 effect 가 다시 돌아 세션을 새로 만든다 — 스타일 실패 뒤
     "다시 시도". 정상 흐름에서는 0 에 머문다. */
  const [attempt, setAttempt] = useState(0);
  const restart = useCallback(() => setAttempt((current) => current + 1), []);
  /* 지도 팔레트는 UI 테마 모드를 따른다(라이트 → positron 재색칠, 다크 → 데모 밤 장식).
     엔진 생성 시점에 한 번 정해진다 — 모드가 바뀌면 세션을 다시 만든다(C9 결정 (d)). */
  const { mode: styleMode } = useTheme();
  const { preference, setPreference, ready: themeReady } = useThemePreference();

  /* 재생성되는 세션에 넘길 씨앗. ref 인 이유 — 선택(`system` ↔ `dark` 처럼 팔레트가 같은 전환)이
     바뀌는 것만으로 세션을 다시 만들 이유는 없다. 지도가 바뀔 때(`styleMode`)만 다시 만들고,
     그때 최신 선택과 "설정 면이 열려 있었나"를 읽는다. */
  const seed = useRef<{ themeMode: typeof preference; settingsOpen: boolean }>({
    themeMode: preference,
    settingsOpen: false,
  });
  seed.current.themeMode = preference;

  const onHost = useCallback((next: MapHostHandle | null) => setHost(next), []);

  // `setPreference` 는 안정된 setState 이고, 씨앗(`seed`)은 ref 다 — 지도가 바뀔 때(`styleMode`)만 다시 만든다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: 위 설명 참고
  useEffect(() => {
    /* 저장된 테마 선택을 읽기 전에는 엔진을 만들지 않는다 — 읽은 값이 env 기본과 다르면
       방금 만든 엔진을 바로 버리게 된다(네이티브에서 실측: 라이트 엔진 → 20ms 뒤 다크 엔진). */
    if (host === null || !themeReady) return;

    /* 어댑터의 `launchSite` 는 "지도 최초 중심 + 불꽃 발사 원점" 이다. 계곡 장면은
       불꽃을 끄고 시작하므로 원점은 무의미하고 최초 중심만 남는다.
       지형(C10)은 계곡 장면만 — festival 의 스타일은 이전과 같아야 한다(CLAUDE.md 보존). */
    const engine = createMapEngine({
      host,
      launchSite: initialCenter,
      initialView,
      styleMode,
      terrain: source.scene === 'valley',
      logger: rootLogger,
    });
    const next = new MapSession({
      ...source,
      preserveSelection,
      engine,
      storage: createStorage(),
      logger: rootLogger,
      seed: {
        themeMode: seed.current.themeMode,
        sheetFace: seed.current.settingsOpen ? 'settings' : 'list',
      },
      // 상류 강우 경보(F3b) — valley 장면만. festival 은 서버 데이터를 쓰지 않는다.
      // `?devAlert=<level>:<valleyId>` 가 있으면(검증용) 서버 대신 고정 응답을 쓴다.
      ...(source.scene === 'valley'
        ? {
            api: (() => {
              const dev = devAlertOverride();
              return dev
                ? new DevAlertFixtureApiPort(dev)
                : createApiClient({ logger: rootLogger });
            })(),
          }
        : {}),
    });
    setSession(next);

    /* 세션 → 테마 다리. 설정 면에서 고른 값(저장 뒤 상태)이 Provider 로 올라가 팔레트가
       바뀐다. 시작값은 씨앗과 같아 첫 알림은 무변화다. */
    const themeBridge = next.store.subscribe(() => {
      setPreference(next.store.state.themeMode);
    });

    const lifetime = new CancellationTokenSource();
    void next.initialize(lifetime.token);

    /* 앱 전면/배경을 세션에 알린다 — 배경에서는 물줄기 흐름 같은 배터리 연출이 멈춘다(C10c).
       react-native-web 의 `AppState` 는 문서 visibility 를 같은 이벤트로 옮겨 준다. */
    next.setAppActive(AppState.currentState === 'active');
    const appState = AppState.addEventListener('change', (status) => {
      next.setAppActive(status === 'active');
    });

    return () => {
      // 다음 세션이 설정 면을 이어받는다 — 테마를 고른 직후 지도가 다시 뜨는 동안 설정이 닫히지 않게.
      seed.current.settingsOpen = next.store.state.sheetFace === 'settings';
      themeBridge.dispose();
      appState.remove();
      lifetime.cancel('session-provider-unmount');
      lifetime.dispose();
      next.dispose();
      setSession(null);
    };
  }, [host, source, initialCenter, initialView, styleMode, themeReady, attempt, preserveSelection]);

  return (
    <>
      <MapHost onHost={onHost} />
      {session === null ? null : (
        <SessionRestartContext.Provider value={restart}>
          <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
        </SessionRestartContext.Provider>
      )}
    </>
  );
}
