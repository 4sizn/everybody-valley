/**
 * 시트 세 번째 면 — 설정 (C9). 두 장면(`/`·`/firework`)이 같은 면을 쓴다.
 *
 * 구조 (결정 (b)(c))
 *   제목 "설정" + 닫기(×) → 목록 면
 *   → 테마 카드: 3분할 세그먼트(라이트 · 다크 · 시스템) + "현재 적용: 라이트|다크" 한 줄
 *   → 정보 카드: 지도 출처 · 지형 출처 · 앱 버전(expo-constants)
 *
 * 세그먼트 색은 전부 토큰이다 — 활성 `accent` 배경 + 흰 글자(CTA 와 같은 조합), 비활성
 * `segActive` 배경 + `fg` 글자. 새 리터럴 색은 없다. 표면(테두리·반경·패딩)은 상세 면의
 * 정보 타일과 같다.
 *
 * 선택은 세션으로 간다(`session.setThemeMode`) — 저장 뒤 상태가 바뀌고, `SessionProvider` 가
 * 그 값을 `ThemeProvider` 에 올려 팔레트가 갈리면 지도가 다시 뜬다(결정 (d)). 이 컴포넌트는
 * 상태를 읽고 의도를 보낼 뿐이다. "현재 적용" 은 풀린 팔레트(`useTheme().mode`)라 시스템을
 * 골랐을 때 기기 설정이 무엇으로 풀렸는지 그대로 보인다.
 */
import { THEME_MODES, type ThemeMode } from '@modu-valley/core';
import Constants from 'expo-constants';
import { useCallback } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useStaggerEntrance } from '@/animation/useStaggerEntrance';
import { CloseIcon } from '@/icons';
import { useAppState, useSession } from '@/session';
import { SETTINGS_COPY } from '@/theme/copy';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { RADII } from '@/theme/tokens';
import { sheetStyles, useSheetThemedStyles } from './sheetStyles';

/** 스태거 자리 — 테마 카드 0, 정보 카드 1(데모의 `.cta`, `.card` 순서와 같은 감각). */
const THEME_STAGGER_INDEX = 0;
const INFO_STAGGER_INDEX = 1;

export type SettingsFaceProps = {
  readonly generation: number;
  /** 시트 내부 가용 폭. 이 면은 카드가 전폭이라 쓰지 않지만 다른 면과 계약을 같게 둔다. */
  readonly innerWidth: number;
};

export function SettingsFace({ generation }: SettingsFaceProps) {
  const session = useSession();
  const themeMode = useAppState((state) => state.themeMode);
  const scene = useAppState((state) => state.scene);
  const theme = useTheme();
  const themed = useThemedStyles();
  const sheetThemed = useSheetThemedStyles();
  const themeEntrance = useStaggerEntrance(THEME_STAGGER_INDEX, generation);
  const infoEntrance = useStaggerEntrance(INFO_STAGGER_INDEX, generation);

  const close = useCallback(() => {
    void session.closeSettings();
  }, [session]);
  const onSelectMode = useCallback(
    (mode: ThemeMode) => {
      void session.setThemeMode(mode);
    },
    [session],
  );

  // 계곡 데이터·그늘 출처(SD1b)는 계곡 장면에만 — `/firework` 의 설정 면은 C9 그대로 둔다(보존 규칙).
  const infoRows: readonly { label: string; value: string }[] = [
    { label: SETTINGS_COPY.info.map, value: SETTINGS_COPY.info.mapValue },
    { label: SETTINGS_COPY.info.terrain, value: SETTINGS_COPY.info.terrainValue },
    ...(scene === 'valley'
      ? [
          { label: SETTINGS_COPY.info.valleyData, value: SETTINGS_COPY.info.valleyDataValue },
          { label: SETTINGS_COPY.info.shade, value: SETTINGS_COPY.info.shadeValue },
        ]
      : []),
    { label: SETTINGS_COPY.info.version, value: appVersionLabel() },
  ];

  return (
    <View>
      <View style={sheetStyles.headerRow}>
        <Text style={[sheetStyles.title, sheetThemed.title]} accessibilityRole="header">
          {SETTINGS_COPY.title}
        </Text>
        <Pressable
          style={[sheetStyles.roundButton, sheetThemed.roundButton]}
          dataSet={{ mv: 'round-button' }}
          accessibilityLabel={SETTINGS_COPY.closeButton}
          accessibilityRole="button"
          onPress={close}
        >
          <CloseIcon />
        </Pressable>
      </View>

      <Text style={[sheetStyles.sectionTitle, sheetThemed.sectionTitle]}>
        {SETTINGS_COPY.themeHeading}
      </Text>
      <Animated.View style={[styles.card, themed.card, themeEntrance]}>
        <Text style={[styles.cardNote, themed.cardNote]}>{SETTINGS_COPY.themeNote}</Text>
        <View style={styles.segmentBar} accessibilityRole="radiogroup">
          {THEME_MODES.map((mode) => {
            const isActive = mode === themeMode;
            return (
              <Pressable
                key={mode}
                style={[styles.segment, isActive ? themed.segmentActive : themed.segment]}
                dataSet={{ mv: 'seg', act: isActive }}
                accessibilityRole="radio"
                accessibilityLabel={SETTINGS_COPY.themeModes[mode]}
                accessibilityState={{ checked: isActive }}
                aria-checked={isActive}
                onPress={() => onSelectMode(mode)}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    isActive ? styles.segmentLabelActive : themed.segmentLabel,
                  ]}
                >
                  {SETTINGS_COPY.themeModes[mode]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.applied, themed.applied]} dataSet={{ mv: 'theme-applied' }}>
          {SETTINGS_COPY.applied(theme.mode)}
        </Text>
        <Text style={[styles.cardNote, styles.reloadNote, themed.cardNote]}>
          {SETTINGS_COPY.reloadNote}
        </Text>
      </Animated.View>

      <Text style={[sheetStyles.sectionTitle, sheetThemed.sectionTitle, styles.infoHeading]}>
        {SETTINGS_COPY.infoHeading}
      </Text>
      <Animated.View style={[styles.card, styles.infoCard, themed.card, infoEntrance]}>
        {infoRows.map((row, index) => (
          <View
            key={row.label}
            style={[styles.infoRow, index === 0 ? null : [styles.infoRowDivider, themed.divider]]}
          >
            <Text style={[styles.infoLabel, themed.infoLabel]}>{row.label}</Text>
            <Text style={[styles.infoValue, themed.infoValue]} numberOfLines={1}>
              {row.value}
            </Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

/**
 * 앱 버전 — `app.json` 의 `expo.version`(expo-constants). 네이티브 빌드는 스토어 빌드 번호를
 * 괄호로 덧붙인다. 정적 렌더처럼 설정을 모르는 환경은 "알 수 없음".
 */
function appVersionLabel(): string {
  const version = Constants.expoConfig?.version;
  if (version === undefined || version === null) return SETTINGS_COPY.info.versionUnknown;
  const build = Constants.nativeBuildVersion;
  return build === undefined || build === null ? version : `${version} (${build})`;
}

/** `sheetStyles.ctaPrimaryLabel` 과 같은 흰 글자 — accent 위라 두 테마가 같다. */
const ACTIVE_LABEL_COLOR = '#ffffff';

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: RADII.card,
    padding: 12,
  },
  cardNote: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  reloadNote: {
    marginTop: 8,
    marginBottom: 0,
  },
  segmentBar: {
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 36,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fontWeight: '600',
  },
  segmentLabelActive: {
    color: ACTIVE_LABEL_COLOR,
  },
  applied: {
    marginTop: 10,
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '500',
  },
  infoHeading: {
    marginTop: 24,
  },
  infoCard: {
    paddingVertical: 0,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },
  infoRowDivider: {
    borderTopWidth: 1,
  },
  infoLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fontWeight: '500',
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  card: { backgroundColor: theme.colors.surface, borderColor: theme.colors.line },
  cardNote: { color: theme.colors.fg3 },
  segment: { backgroundColor: theme.colors.segActive },
  segmentActive: { backgroundColor: theme.colors.accent },
  segmentLabel: { color: theme.colors.fg },
  applied: { color: theme.colors.fg2 },
  divider: { borderTopColor: theme.colors.line },
  infoLabel: { color: theme.colors.fg3 },
  infoValue: { color: theme.colors.fg },
}));
