/**
 * 상단 검색바. 데모의 `.topbar` — 전체폭 pill 하나에 브랜드를 겹쳐 올린다.
 *
 * `backdrop-filter: blur(14px)` 와 다층 `box-shadow` 는 RN 스타일로 표현할 수
 * 없어 web 전역 스타일시트가 `[data-mv="topbar"]` 에 얹는다.
 * `::placeholder` 색은 RN 의 `placeholderTextColor` 로 표현된다.
 *
 * 브랜드·칩·검색 자리표시는 장면 문구(`sceneCopy`)에서 온다 — festival 은 데모
 * 그대로, valley 는 "모두의계곡" + 베타 칩(SD1 전엔 샘플). 접미어·칩이 없는 장면은 그 요소를
 * 그리지 않는다(빈 텍스트를 두면 gap 만큼 밀린다).
 *
 * 휴대폰에서는 데모의 `top:16px` 자리에 상태바·노치가 있다. 안전 영역을
 * 더해 그 아래로 내린다(web 인셋은 0 이라 데모와 같은 위치).
 *
 * 검색 배선(SR1, 사용자 결정 2026-09-08) — `TopBar` 는 `/firework` 와 공유하는
 * 셸이다. 값·핸들러는 **옵셔널 props** 로만 받는다(`search`) — 계곡 화면(`Chrome`)만
 * 채워 넘기고 festival 은 지금처럼 넘기지 않는다. 그러면 festival 의 입력칸은
 * `value`·`onChangeText` 가 없는 죽은 상태 그대로 남는다(결정 8, 클론 대신 이 방법).
 * 레이아웃·스타일 수치는 하나도 바꾸지 않았다 — `search` 가 있을 때만 지우기(×)
 * 버튼을 뒤에 더 그린다(새 요소, 기존 값 변경 아님).
 */
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CloseIcon, SearchIcon } from '@/icons';
import { useSession } from '@/session';
import { sceneCopy } from '@/theme/copy';
import { useSafeAreaGutters } from '@/theme/safeArea';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { RADII, SIZES } from '@/theme/tokens';

/** 검색 값·핸들러 — 넘기지 않으면(festival) 입력칸은 배선 이전과 똑같이 죽어 있다. */
export type TopBarSearchProps = {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  /** 지우기(×) 버튼(결정 8). 값이 있을 때만 그린다. */
  readonly onClear: () => void;
  /** 지우기 버튼 접근성 라벨. */
  readonly clearLabel: string;
};

export type TopBarProps = {
  readonly search?: TopBarSearchProps | undefined;
};

export function TopBar({ search }: TopBarProps = {}) {
  const copy = sceneCopy(useSession().scene);
  const insets = useSafeAreaGutters();
  const theme = useTheme();
  const themed = useThemedStyles();

  return (
    <View
      style={[styles.topbar, themed.topbar, { top: insets.top + SIZES.gutter }]}
      dataSet={{ mv: 'topbar' }}
    >
      <View style={[styles.brand, themed.brand]}>
        <Text style={[styles.brandName, themed.brandName]}>{copy.brandName}</Text>
        {copy.brandSuffix === null ? null : (
          <Text style={[styles.brandSuffix, themed.brandSuffix]}>{copy.brandSuffix}</Text>
        )}
      </View>
      {copy.brandChip === null ? null : (
        <Text style={[styles.chip, themed.chip]}>{copy.brandChip}</Text>
      )}
      <SearchIcon />
      <TextInput
        style={[styles.input, themed.input]}
        placeholder={copy.searchPlaceholder}
        placeholderTextColor={theme.colors.fg3}
        dataSet={{ mv: 'search-input' }}
        {...(search === undefined
          ? null
          : { value: search.value, onChangeText: search.onChangeText })}
      />
      {search === undefined || search.value.length === 0 ? null : (
        <Pressable
          style={styles.clear}
          accessibilityRole="button"
          accessibilityLabel={search.clearLabel}
          onPress={search.onClear}
          dataSet={{ mv: 'search-clear' }}
        >
          <CloseIcon size={16} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: {
    position: 'absolute',
    left: SIZES.gutter,
    right: SIZES.gutter,
    zIndex: 6,
    height: SIZES.topbarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: RADII.pill,
    borderWidth: 1,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingRight: 12,
    marginRight: 2,
    borderRightWidth: 1,
  },
  brandName: {
    fontFamily: FONT_FAMILY,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  brandSuffix: {
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fontWeight: '600',
  },
  chip: {
    alignSelf: 'center',
    fontFamily: FONT_FAMILY,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    borderWidth: 1,
    borderRadius: RADII.pill,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  input: {
    flex: 1,
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    // 데모의 input 은 테두리·배경·아웃라인이 모두 없다.
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  /** 지우기(×, SR1 결정 8) — `search` prop 이 있을 때만 그려지는 새 요소. */
  clear: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  topbar: { backgroundColor: theme.colors.glass, borderColor: theme.colors.line },
  brand: { borderRightColor: theme.colors.line },
  brandName: { color: theme.colors.fg },
  brandSuffix: { color: theme.colors.accent },
  chip: { color: theme.colors.fg3, borderColor: theme.colors.line2 },
  input: { color: theme.colors.fg },
}));
