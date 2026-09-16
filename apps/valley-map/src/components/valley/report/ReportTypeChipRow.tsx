/**
 * 제보 유형 6종 — 가로 스크롤 칩 한 줄(F5b, 화면 결정 확정 (b) B3). 유형색 각각(결정 (a))이
 * 6색이 섞여도 어지럽지 않게 아이콘+라벨 최소 폭 칩으로 좁혔다.
 *
 * 완화 셋(목업 검토가 지적한 위험 — 미아찾기·물건찾기가 화면 밖에 숨는다):
 *   1. 오른쪽 끝 페이드 — `[data-mv="report-type-fade"]`(`+html.tsx`, web 전용 CSS) + 네이티브는
 *      칩 사이 gap 을 좁혀 마지막 칩 일부가 항상 살짝 보이게 한다(대체 신호).
 *   2. 칩은 아이콘+라벨 최소 폭 — `flexShrink: 0`, 내용에 맞춘 padding.
 *   3. 선택된 칩이 화면 밖이면 보이는 위치로 스크롤 — `onLayout` 으로 각 칩의 x 를 기억해 뒀다가
 *      `value` 가 바뀔 때 그 좌표로 스크롤한다.
 */
import { REPORT_TYPES, type ReportType, reportTypeLabel } from '@modu-valley/core';
import { REPORT_TYPE_COLORS } from '@modu-valley/map-style';
import { useCallback, useEffect, useRef } from 'react';
import { type LayoutChangeEvent, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ReportTypeGlyph } from '@/icons/ReportTypeGlyph';
import { useTheme } from '@/theme/ThemeProvider';
import { Chip, chipLabelStyle } from '../Pill';

export type ReportTypeChipRowProps = {
  readonly value: ReportType | null;
  readonly onChange: (type: ReportType) => void;
};

/** 선택 흰 글자 — 유형색 배경 위, 두 테마 공통(다른 accent 위 흰 글자와 같은 관례). */
const SELECTED_LABEL_COLOR = '#ffffff';

export function ReportTypeChipRow({ value, onChange }: ReportTypeChipRowProps) {
  const theme = useTheme();
  const colors = REPORT_TYPE_COLORS[theme.mode];
  const scrollRef = useRef<ScrollView>(null);
  const chipX = useRef<Partial<Record<ReportType, number>>>({});

  useEffect(() => {
    if (value === null) return;
    const x = chipX.current[value];
    if (x !== undefined) {
      scrollRef.current?.scrollTo({ x: Math.max(0, x - CHIP_SCROLL_MARGIN), animated: true });
    }
  }, [value]);

  const onChipLayout = useCallback(
    (type: ReportType) => (event: LayoutChangeEvent) => {
      chipX.current[type] = event.nativeEvent.layout.x;
    },
    [],
  );

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        dataSet={{ mv: 'report-type-scroll' }}
        contentContainerStyle={styles.row}
      >
        {REPORT_TYPES.map((type) => {
          const selected = value === type;
          const color = colors[type];
          return (
            <Chip
              key={type}
              onLayout={onChipLayout(type)}
              style={styles.chip}
              borderColor={color}
              backgroundColor={selected ? color : undefined}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={reportTypeLabel(type)}
              onPress={() => onChange(type)}
            >
              <ReportTypeGlyph
                type={type}
                size={16}
                color={selected ? SELECTED_LABEL_COLOR : color}
              />
              <Text style={[chipLabelStyle, { color: selected ? SELECTED_LABEL_COLOR : color }]}>
                {reportTypeLabel(type)}
              </Text>
            </Chip>
          );
        })}
      </ScrollView>
      {/* web 은 CSS 그라디언트 페이드(`+html.tsx`), 네이티브는 아직 배선하지 않았다(F5 후속). */}
      {Platform.OS === 'web' ? (
        <View style={styles.fade} dataSet={{ mv: 'report-type-fade' }} pointerEvents="none" />
      ) : null}
    </View>
  );
}

/** 스크롤 도착 지점 왼쪽 여백 — 칩이 화면 가장자리에 딱 붙지 않게. */
const CHIP_SCROLL_MARGIN = 8;
const FADE_WIDTH = 28;

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: FADE_WIDTH,
  },
  /** 폭은 아이콘+라벨 내용에 맞춘다(완화 2) — 그 외 크기·패딩·테두리는 `Chip` 공유값(DS3). */
  chip: {
    flexShrink: 0,
  },
  fade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: FADE_WIDTH,
  },
});
