/**
 * 조건 필터 칩 줄(N1) — 화장실·주차장·무료·야영·그늘 많음 5개, 다중 선택·AND(결정 (a)(c)).
 *
 * 문구는 **조건 명사 최단형**이다(어미 금지) — 규칙과 근거는 core `FILTER_CHIPS` 주석에 있다.
 * 개수는 라벨의 꼬리가 아니라 계량값이라 **얇은 세로선으로 끊고** 자릿수를 고정폭으로 맞춘다.
 *
 * `BottomSheet` 가 이 컴포넌트를 시트의 `ScrollView` **밖**에 형제로 얹는다 — 그래서
 * 스크롤·목록/상세 면 전환과 무관하게 화면에 남는다(결정 (d)). 상세가 열려 있어도
 * 계속 조절할 수 있어야 "선택이 필터를 이긴다"(해석 4)는 상황이 실제로 만들어진다 —
 * 필터를 목록에서만 만지게 하면 이미 열린 상세의 계곡이 걸리는 경로가 생기지 않는다.
 *
 * 배지 개수는 다른 칩의 현재 선택을 반영한 값이다(결정 (b), core `filterChipMatchCounts`) —
 * 선택 전에도 보이고, 다른 칩을 고르면 "이 칩까지 더하면 몇 곳" 으로 바뀐다.
 */
import { FILTER_CHIPS, type FilterChipKey, filterChipMatchCounts } from '@modu-valley/core';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppState, useSession } from '@/session';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { Chip, chipLabelStyle } from './Pill';

/** 선택된 칩의 흰 글자 — accent 배경 위, 다른 accent 칩과 같은 관례(`ReportTypeChipRow`). */
const SELECTED_LABEL_COLOR = '#ffffff';

export function FilterChipRow() {
  const session = useSession();
  const valleys = useAppState((state) => state.valleys);
  const selected = useAppState((state) => state.filterChips);
  const themed = useThemedStyles();

  const counts = useMemo(
    () => (valleys === null ? null : filterChipMatchCounts(valleys, selected)),
    [valleys, selected],
  );

  if (valleys === null) return null;

  const onPress = (key: FilterChipKey) => () => {
    session.toggleFilterChip(key);
  };

  return (
    <View style={styles.row} dataSet={{ mv: 'filter-chip-row' }}>
      {FILTER_CHIPS.map((chip) => {
        const isSelected = selected.has(chip.key);
        const count = counts?.get(chip.key) ?? 0;
        return (
          <Chip
            key={chip.key}
            style={[themed.chip, isSelected ? themed.chipSelected : null]}
            dataSet={{ mv: 'filter-chip', key: chip.key }}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${chip.label} ${count}곳`}
            onPress={onPress(chip.key)}
          >
            <Text
              style={[chipLabelStyle, themed.label, isSelected ? styles.selectedText : null]}
              numberOfLines={1}
            >
              {chip.label}
            </Text>
            <Text
              style={[
                styles.count,
                themed.count,
                isSelected ? styles.selectedText : null,
                isSelected ? themed.countSelected : null,
              ]}
              numberOfLines={1}
            >
              {count}
            </Text>
          </Chip>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  /** 개수는 라벨이 아니라 **계량값**이다 — 얇은 세로선으로 끊고 자릿수를 고정폭으로 맞춘다. */
  count: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    paddingLeft: 7,
    borderLeftWidth: 1,
  },
  selectedText: {
    color: SELECTED_LABEL_COLOR,
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  chip: { backgroundColor: theme.colors.surface, borderColor: theme.colors.line2 },
  chipSelected: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  label: { color: theme.colors.fg },
  count: { color: theme.colors.fg3, borderLeftColor: theme.colors.line },
  /** 선택된 칩은 accent 배경이라 구분선도 흰 계열로 — 남색 선이 배경에 묻힌다. */
  countSelected: { borderLeftColor: 'rgba(255,255,255,.45)' },
}));
