/**
 * 제보 위치 피커(F5d) — web 구현. `mapPlatform.web.tsx` 의 `createMapEngine`/`MapHost` 를
 * 그대로 재사용한다(계곡 메인 지도와 같은 어댑터 경계) — 다만 `MapSession` 은 물지 않는다.
 * 이 피커는 구간·시설·경보 같은 애플리케이션 상태를 몰라도 되고(빈 지도 위에 십자선만
 * 있으면 된다), `renderContent` 를 한 번도 부르지 않는다 — 어댑터는 그 상태에서 베이스맵만
 * 그린다(피처 레이어가 없다).
 *
 * 제스처는 pan(지도 이동)·pinchZoom(정밀도 조절)만 켠다 — 회전·기울이기·더블탭 줌은 끈다
 * (지도가 늘 북쪽 고정 평면이어야 십자선 아래 좌표가 화면 위치와 어긋나지 않는다).
 *
 * 브라우저 실측 중 위치 항목을 열고 접기를 반복하면(메인 지도가 이미 떠 있는 상태에서
 * 두 번째 엔진을 만들 때) `initialize()` 가 멈춘 채 끝나지 않는 경우를 한때 관찰했다 —
 * `ReportFormModal` 의 접힌 위치 필드가 "지우기" Pressable 을 "변경" Pressable **안에**
 * 중첩해(웹에서 `<button>` 안에 `<button>`, DOM 규칙 위반) React 가 렌더 중 오류를 던지고
 * 있었고, 그 렌더 오류를 고치자(나란한 두 Pressable 로 분리) 재현되지 않았다 — 커밋 안에
 * 두 수정이 함께 있는 이유다. 근본 원인이 정말 그 렌더 오류였는지 어댑터 내부까지 확증하지
 * 못했으므로, 초기화 타임아웃(`INIT_TIMEOUT_MS`)과 재시도 버튼은 안전망으로 남겨 둔다 —
 * 같은 증상이 다시 보이면 이 파일이 조용히 방치하지 않고 사용자에게 드러낸다.
 */
import {
  CancellationTokenSource,
  ConsoleLogger,
  cameraCommand,
  clampReportCoordinate,
  type LngLat,
  type Logger,
  MAX_PITCH,
  VALLEY_DETAIL_ZOOM,
} from '@modu-valley/core';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { REPORT_FORM_COPY } from '@/theme/copy';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { RADII } from '@/theme/tokens';
import { createMapEngine, MapHost, type MapHostHandle } from './mapPlatform';

export const REPORT_LOCATION_PICKER_SUPPORTED = true;

export type ReportLocationPickerProps = {
  readonly initialCenter: LngLat;
  readonly onChange: (point: LngLat) => void;
  /**
   * 지정할 수 있는 영역의 기준 — 그 계곡 중심선(F5d 반경 3km). 주면 그 밖으로 끌었을 때
   * 지도를 허용 영역 안으로 되돌린다. 비어 있거나 없으면 되돌리지 않는다(서버가 거절한다).
   */
  readonly limit?: readonly LngLat[];
};

/* 피커는 좌표를 집는 화면이라 **정북 고정**이다 — web 정책이 핀치 회전을 켜도
   여기서는 꺼 둔다(회전한 지도에서 한 점을 집으면 방향 감각이 어긋난다). */
const PICKER_GESTURES = {
  pan: true,
  pinchZoom: true,
  pinchRotate: false,
  doubleTapZoom: false,
  quickZoom: false,
  dragPitch: false,
} as const;

/** 이 시간 안에 `initialize()` 가 끝나지 않으면 멈춘 것으로 본다(위 "알려진 한계" 참고). */
const INIT_TIMEOUT_MS = 8000;

/**
 * 허용 영역 밖으로 끌린 지도를 되돌리기까지 기다리는 시간.
 * ponytail: 드래그가 끝났는지 알려주는 이벤트가 포트에 없어 "마지막 카메라 변화 뒤 조용해지면"
 * 으로 대신한다 — 끄는 도중에 카메라를 잡아채면 제스처와 싸운다. 포트에 `camera-idle` 이
 * 생기면 그 이벤트로 바꾼다.
 */
const SNAP_DELAY_MS = 250;
/** 되돌리는 이동 — 짧은 직선 보간. 사용자가 "튕겨 나왔다"고 읽을 만큼은 보여야 한다. */
const SNAP_TRANSITION = { motion: 'ease', durationMs: 400, essential: true } as const;

const logger: Logger = new ConsoleLogger('valley').child('report-location-picker');

type EngineStatus = 'loading' | 'ready' | 'error';

export function ReportLocationPicker({
  initialCenter,
  onChange,
  limit,
}: ReportLocationPickerProps) {
  const { mode: styleMode } = useTheme();
  const themed = useThemedStyles();
  const [host, setHost] = useState<MapHostHandle | null>(null);
  const [status, setStatus] = useState<EngineStatus>('loading');
  // 재시도 버튼이 올리면 아래 effect 가 새 엔진으로 다시 시도한다.
  const [attempt, setAttempt] = useState(0);
  // 최초 중심만 쓴다 — 피커가 열려 있는 동안 폼의 다른 입력이 바뀌어도 지도를 다시 옮기지
  // 않는다(사용자가 끌어 둔 위치를 지키기 위해).
  const initialCenterRef = useRef(initialCenter);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const limitRef = useRef(limit);
  limitRef.current = limit;

  // `attempt` 는 값을 읽지 않고 재시도 버튼이 새 엔진을 만들게 하는 신호로만 쓴다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: 위 설명 참고
  useEffect(() => {
    if (host === null) return;
    setStatus('loading');
    const engine = createMapEngine({
      host,
      launchSite: initialCenterRef.current,
      initialView: { zoom: VALLEY_DETAIL_ZOOM, pitch: 0, bearing: 0, maxPitch: MAX_PITCH },
      styleMode,
      terrain: false,
      logger,
    });
    const lifetime = new CancellationTokenSource();
    let settled = false;
    let snapTimer: ReturnType<typeof setTimeout> | undefined;
    const subscription = engine.events.on('camera-change', (pose) => {
      onChangeRef.current(pose.center);
      const centerline = limitRef.current;
      clearTimeout(snapTimer);
      if (centerline === undefined || centerline.length === 0) return;
      const clamped = clampReportCoordinate(pose.center, centerline);
      if (clamped === pose.center) return; // 허용 영역 안 — 되돌릴 것이 없다.
      snapTimer = setTimeout(() => {
        void engine.moveCamera(cameraCommand({ center: clamped }, SNAP_TRANSITION), lifetime.token);
      }, SNAP_DELAY_MS);
    });
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      logger.warn('위치 피커 지도 초기화가 시간 안에 끝나지 않았다', {
        timeoutMs: INIT_TIMEOUT_MS,
      });
      setStatus('error');
    }, INIT_TIMEOUT_MS);
    void engine.initialize(lifetime.token).then((result) => {
      if (settled) return; // 타임아웃이 이미 발화했다 — 뒤늦은 성공은 무시(재시도가 새 엔진을 만든다).
      settled = true;
      clearTimeout(timeout);
      if (!result.ok) {
        logger.warn('위치 피커 지도 초기화 실패', { code: result.error.code });
        setStatus('error');
        return;
      }
      engine.setGestures(PICKER_GESTURES);
      setStatus('ready');
      // 사용자가 아직 끌지 않은 최초 중심도 좌표 줄에 곧바로 보이게(십자선은 항상 화면
      // 중앙을 가리키므로 이 값이 "지금 고른 지점"이다).
      const pose = engine.getCamera();
      if (pose.ok) onChangeRef.current(pose.value.center);
    });
    return () => {
      clearTimeout(timeout);
      clearTimeout(snapTimer);
      subscription.dispose();
      lifetime.cancel('report-location-picker-unmount');
      lifetime.dispose();
      engine.dispose();
    };
  }, [host, styleMode, attempt]);

  return (
    <View style={styles.container} dataSet={{ mv: 'report-location-picker' }}>
      <MapHost onHost={setHost} />
      {status === 'ready' ? (
        <View style={styles.crosshair} pointerEvents="none" dataSet={{ mv: 'report-crosshair' }}>
          <View style={styles.crosshairDot} />
        </View>
      ) : null}
      {status === 'error' ? (
        <View style={[styles.overlay, themed.overlay]}>
          <Text style={[styles.overlayText, themed.overlayText]}>
            {REPORT_FORM_COPY.locationMapError}
          </Text>
          <Pressable
            style={[styles.retryButton, themed.retryButton]}
            accessibilityRole="button"
            onPress={() => setAttempt((n) => n + 1)}
          >
            <Text style={[styles.retryLabel, themed.retryLabel]}>
              {REPORT_FORM_COPY.locationRetryButton}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const CROSSHAIR_SIZE = 14;

const styles = StyleSheet.create({
  container: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  crosshair: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crosshairDot: {
    width: CROSSHAIR_SIZE,
    height: CROSSHAIR_SIZE,
    borderRadius: CROSSHAIR_SIZE / 2,
    borderWidth: 2,
    borderColor: '#ff4d4f',
    backgroundColor: 'rgba(255,77,79,0.25)',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  overlayText: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  retryButton: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  overlay: { backgroundColor: theme.colors.surface },
  overlayText: { color: theme.colors.fg2 },
  retryButton: { backgroundColor: theme.colors.accent },
  retryLabel: { color: '#ffffff' },
}));
