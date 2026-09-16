/**
 * 우측 원형 컨트롤 묶음. 데모의 `.controls`.
 *
 * 나침반 바늘은 `rotate(-bearing)` 을 200ms ease-out 으로 따라간다
 * (데모 `#needle{transition:transform .2s ease-out}` + `map.on('rotate')`).
 *
 * ⚠ 데모와 의도적으로 다른 한 곳: 데모는 `rotate` 이벤트가 처음 발생할 때만
 * 바늘 각도를 쓴다. 그래서 초기 bearing 이 -22도인데도 바늘은 지도를 한 번
 * 돌리기 전까지 정북을 가리킨다 — 나침반이 지도와 어긋나 있는 상태다.
 * 여기서는 카메라 스냅샷을 그대로 반영하므로 처음부터 맞는 방향을 가리킨다.
 *
 * 불꽃 버튼의 활성 배경은 엔진이 그 기능을 지원할 때만 의미가 있으므로,
 * 능력 매트릭스가 `particleLayer: false`(android/ios)면 버튼을 흐리게 두고,
 * 눌리면 "이 플랫폼에서 못 한다"를 그대로 말한다. 데모의 "동작하지 않습니다"
 * 안내와 섞지 않는다 — 원인이 다르면 문구도 달라야 한다.
 *
 * 장면(scene)에 따라 — 계곡 화면에는 불꽃·지구본 버튼이 없고, "내 위치" 자리
 * 버튼은 발사 지점 대신 계곡 전체 보기(`recenterValley`)로 간다. 불꽃 버튼 자리
 * (나침반 아래)에는 **그늘 보기** 토글이 앉는다(F4 결정 (c)) — 시트가 접혀도 지도 위
 * 레이어는 조작할 수 있어야 하므로 시트 안이 아니라 컨트롤 열에 둔다. 켜지면
 * `ctrlOn`(accent 배경)이고 시간 트랙(`ShadeHourTrack`)이 왼쪽에 나타난다. 나머지
 * 배치는 같다(파리티 기준은 festival).
 *
 * 확대·축소 필도 같은 방식으로 능력을 읽는다. web 은 maplibre 의
 * `NavigationControl` 이 이미 +/− 를 얹으므로(`builtInZoomControls: true`)
 * 이 필을 그리지 않고, 그 컨트롤이 없는 네이티브에서만 나타난다 — 줌 버튼이
 * 두 벌로 겹치지 않게 하는 유일한 판단 지점이다.
 *
 * 필을 **가로**로 둔 이유: 오른쪽 컨트롤 열은 이미 세로로 꽉 차 있다.
 * 휴대폰(시트 45%)에서 세로로 한 칸을 더 쌓으면 나침반이 상단바 뒤로 밀린다.
 * 제보 버튼과 같은 행에 놓으면 세로 공간을 전혀 쓰지 않는다.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { USE_NATIVE_DRIVER } from '@/animation/driver';
import { EASE_OUT } from '@/animation/easings';
import { ReportFormModal } from '@/components/valley/report/ReportFormModal';
import {
  CompassNeedleIcon,
  FireworksIcon,
  GlobeIcon,
  LocateIcon,
  MegaphoneIcon,
  ShadeIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '@/icons';
import { showNotice } from '@/platform/notify';
import { useAppState, useSession } from '@/session';
import { FESTIVAL_COPY, sceneCopy, VALLEY_COPY } from '@/theme/copy';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { RADII, SIZES } from '@/theme/tokens';

const NEEDLE_DURATION_MS = 200;
/** 켜진 컨트롤(accent 배경) 위의 아이콘 — CTA 글자와 같은 흰색, 두 테마 공통. */
const ON_ICON_COLOR = '#ffffff';

export type MapControlsProps = {
  /** 시트 위로 띄우는 높이. 데모 `bottom: calc(var(--sheet-h) + 16px)`. */
  readonly bottom: number;
};

export function MapControls({ bottom }: MapControlsProps) {
  const session = useSession();
  const isValley = session.scene === 'valley';
  const copy = sceneCopy(session.scene);
  const bearing = useAppState((state) => state.camera?.bearing ?? 0);
  const fireworksEnabled = useAppState((state) => state.fireworksEnabled);
  const shadeVisible = useAppState((state) => state.shadeVisible);
  const particlesSupported = session.capabilities.particleLayer;
  // 엔진이 자기 줌 버튼을 그려 주지 않을 때만 우리 필을 얹는다.
  const needsZoomControls = !session.capabilities.builtInZoomControls;
  // 제보 폼(F5b) — 시트 위 모달 팝업(결정 (e)). festival 은 이 버튼이 여전히 "동작하지
  // 않습니다" 데모 알림이라 상태를 쓰지 않는다.
  const [reportFormOpen, setReportFormOpen] = useState(false);
  const themed = useThemedStyles();

  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(rotation, {
      toValue: -bearing,
      duration: NEEDLE_DURATION_MS,
      easing: EASE_OUT,
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    animation.start();
    return () => animation.stop();
  }, [bearing, rotation]);

  const needleStyle = {
    transform: [
      {
        rotate: rotation.interpolate({
          inputRange: [-360, 360],
          outputRange: ['-360deg', '360deg'],
        }),
      },
    ],
  };

  /* 컬럼의 **빈 자리**(버튼 사이 간격·좁은 행 왼쪽)까지 터치를 잡으면 그 위에서 시작한
     핀치가 지도까지 닿지 않는다 — 손가락 하나가 컬럼에 떨어지면 maplibre 의
     `_getMapTouches` 가 그 손가락을 걸러내 두 손가락 제스처가 아예 시작되지 않고 한 손가락
     이동만 남는다(실측: 오른쪽 y 270~450 대역에서 회전이 안 됐다). 계곡 화면은 `box-none`
     으로 버튼만 남기고 빈 자리를 통과시킨다. festival 은 데모의 `pointer-events:auto` 를
     그대로 둔다(CLAUDE.md 보존 — 데모의 히트 영역도 결과물이다). */
  return (
    <View style={[styles.controls, { bottom }]} pointerEvents={isValley ? 'box-none' : 'auto'}>
      <Pressable
        style={[styles.ctrl, themed.ctrl]}
        dataSet={{ mv: 'ctrl' }}
        accessibilityLabel={copy.controlTitles.compass}
        onPress={() => void session.alignNorth()}
      >
        <Animated.View style={needleStyle}>
          <CompassNeedleIcon />
        </Animated.View>
      </Pressable>

      {/* 불꽃·지구본은 축제 연출 — 계곡 화면에는 없다. 그 자리에 그늘 보기 토글(F4). */}
      {isValley ? (
        <Pressable
          style={[styles.ctrl, themed.ctrl, shadeVisible ? themed.ctrlOn : null]}
          dataSet={{ mv: 'ctrl', on: shadeVisible }}
          accessibilityRole="button"
          accessibilityLabel={VALLEY_COPY.controlTitles.shade}
          accessibilityState={{ selected: shadeVisible }}
          onPress={() => void session.toggleShade()}
        >
          {shadeVisible ? <ShadeIcon color={ON_ICON_COLOR} /> : <ShadeIcon />}
        </Pressable>
      ) : (
        <Pressable
          style={[
            styles.ctrl,
            themed.ctrl,
            fireworksEnabled && particlesSupported ? themed.ctrlOn : null,
            particlesSupported ? null : styles.ctrlUnsupported,
          ]}
          dataSet={{ mv: 'ctrl', on: fireworksEnabled && particlesSupported }}
          accessibilityLabel={FESTIVAL_COPY.controlTitles.fireworks}
          accessibilityState={{ disabled: !particlesSupported }}
          onPress={() => {
            if (!particlesSupported) {
              showNotice(FESTIVAL_COPY.fireworksUnsupported);
              return;
            }
            const result = session.toggleFireworks();
            if (!result.ok) showNotice(FESTIVAL_COPY.demoAlert);
          }}
        >
          <FireworksIcon />
        </Pressable>
      )}

      {/* 같은 자리, 다른 목적지 — festival 은 발사 지점, valley 는 계곡 전체 보기. */}
      <Pressable
        style={[styles.ctrl, themed.ctrl]}
        dataSet={{ mv: 'ctrl' }}
        accessibilityLabel={copy.controlTitles.locate}
        onPress={() => void (isValley ? session.recenterValley() : session.recenterLaunch())}
      >
        <LocateIcon />
      </Pressable>

      {isValley ? null : (
        <Pressable
          style={[styles.ctrl, themed.ctrl]}
          dataSet={{ mv: 'ctrl' }}
          accessibilityLabel={FESTIVAL_COPY.controlTitles.globe}
          onPress={() => void session.toggleGlobe()}
        >
          <GlobeIcon />
        </Pressable>
      )}

      <View style={styles.bottomRow}>
        {needsZoomControls ? (
          <View style={[styles.zoomPill, themed.zoomPill]} dataSet={{ mv: 'ctrl' }}>
            <Pressable
              style={styles.zoomButton}
              dataSet={{ mv: 'zoom' }}
              accessibilityRole="button"
              accessibilityLabel={copy.controlTitles.zoomOut}
              onPress={() => void session.zoomOut()}
            >
              <ZoomOutIcon />
            </Pressable>
            <View style={[styles.zoomDivider, themed.zoomDivider]} />
            <Pressable
              style={styles.zoomButton}
              dataSet={{ mv: 'zoom' }}
              accessibilityRole="button"
              accessibilityLabel={copy.controlTitles.zoomIn}
              onPress={() => void session.zoomIn()}
            >
              <ZoomInIcon />
            </Pressable>
          </View>
        ) : null}

        <Pressable
          style={[styles.report, themed.report]}
          dataSet={{ mv: 'ctrl' }}
          accessibilityLabel={copy.controlTitles.report}
          onPress={() => {
            if (isValley) {
              setReportFormOpen(true);
              return;
            }
            showNotice(FESTIVAL_COPY.demoAlert);
          }}
        >
          <MegaphoneIcon />
          <Text style={[styles.reportLabel, themed.reportLabel]}>{copy.reportButton}</Text>
        </Pressable>
      </View>

      {isValley ? (
        <ReportFormModal visible={reportFormOpen} onClose={() => setReportFormOpen(false)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    position: 'absolute',
    right: SIZES.gutter,
    alignItems: 'flex-end',
    gap: 12,
    // 데모 `.controls{pointer-events:auto}` — 컬럼의 none 을 되살린다.
    pointerEvents: 'auto',
  },
  ctrl: {
    width: SIZES.controlSize,
    height: SIZES.controlSize,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** 엔진이 지원하지 않는 기능. 버튼은 남기고 상태를 드러낸다. */
  ctrlUnsupported: {
    opacity: 0.45,
  },
  /** 제보 버튼과 줌 필이 같은 행에 앉는다 — 세로 공간을 더 쓰지 않는다. */
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    pointerEvents: 'auto',
  },
  zoomPill: {
    height: SIZES.reportHeight,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADII.pill,
    overflow: 'hidden',
  },
  zoomButton: {
    width: SIZES.controlSize,
    height: SIZES.reportHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** 두 버튼의 경계. 데모의 `.ctrl` 계열과 같은 선 색. */
  zoomDivider: {
    width: 1,
    height: 20,
  },
  report: {
    height: SIZES.reportHeight,
    paddingHorizontal: 18,
    borderRadius: RADII.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    fontWeight: '500',
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  ctrl: { backgroundColor: theme.colors.bg },
  ctrlOn: { backgroundColor: theme.colors.accent },
  zoomPill: { backgroundColor: theme.colors.bg },
  /** 두 버튼의 경계. 데모의 `.ctrl` 계열과 같은 선 색. */
  zoomDivider: { backgroundColor: theme.colors.line2 },
  report: { backgroundColor: theme.colors.bg },
  reportLabel: { color: theme.colors.fg },
}));
