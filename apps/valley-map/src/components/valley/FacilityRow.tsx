/**
 * 선택된 시설의 미니 행 — 목록 면 최상단 한 줄 (F1 결정 (c)).
 *
 * "[P] 주차장 · 백운 제1주차장 · 무료 · 120면". 시설은 구간의 부속이라 상세 면을
 * 열지 않고, 지도 핀과 짝을 이루는 이 한 줄로 끝난다. 앞의 픽토그램은 지도 핀 안의 글리프와
 * 같은 도형(C5, `FacilityGlyph`) — 목록에서 본 것을 지도에서 찾을 수 있게. 닫기(×)는 선택 해제 —
 * 지도 빈 곳 탭·Esc 와 같은 경로(`clearSelection`).
 */
import { type Facility, facilityTypeLabel } from '@modu-valley/core';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useStaggerEntrance } from '@/animation/useStaggerEntrance';
import { CloseIcon } from '@/icons';
import { FacilityGlyph } from '@/icons/FacilityGlyph';
import { VALLEY_COPY } from '@/theme/copy';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { RADII } from '@/theme/tokens';

export type FacilityRowProps = {
  readonly facility: Facility;
  readonly staggerIndex: number;
  readonly generation: number;
  readonly onClear: () => void;
};

export function FacilityRow({ facility, staggerIndex, generation, onClear }: FacilityRowProps) {
  const entrance = useStaggerEntrance(staggerIndex, generation);
  const themed = useThemedStyles();

  return (
    <Animated.View style={[styles.row, themed.row, entrance]} dataSet={{ mv: 'facility-row' }}>
      <FacilityGlyph type={facility.facilityType} size={FACILITY_GLYPH_SIZE} />
      <View style={styles.text}>
        <Text style={[styles.type, themed.type]}>{facilityTypeLabel(facility.facilityType)}</Text>
        <Text style={[styles.summary, themed.summary]} numberOfLines={1}>
          {facilitySummary(facility)}
        </Text>
      </View>
      <Pressable
        style={styles.close}
        accessibilityRole="button"
        accessibilityLabel={VALLEY_COPY.controlTitles.clearFacility}
        onPress={onClear}
      >
        <CloseIcon size={16} />
      </Pressable>
    </Animated.View>
  );
}

/** "백운 제1주차장 · 무료 · 120면" — 종류는 앞의 라벨이 맡으므로 뺀다. 없는 항목은 생략. */
export function facilitySummary(facility: Facility): string {
  const parts: string[] = [facility.name];
  if (facility.feeNote !== undefined) parts.push(facility.feeNote);
  if (facility.capacity !== undefined) {
    parts.push(`${facility.capacity}${VALLEY_COPY.capacityUnit}`);
  }
  if (facility.operatingHours !== undefined) parts.push(facility.operatingHours);
  return parts.join(' · ');
}

/** 목록 픽토그램 크기(C5 (b)) — 상세 시트 시설 목록과 같은 값. */
export const FACILITY_GLYPH_SIZE = 16;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    paddingVertical: 10,
    paddingLeft: 13,
    paddingRight: 8,
    borderWidth: 1,
    borderRadius: RADII.card,
  },
  text: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  type: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '600',
  },
  summary: {
    flex: 1,
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fontWeight: '500',
  },
  close: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  row: { backgroundColor: theme.colors.surface, borderColor: theme.colors.line2 },
  type: { color: theme.colors.eyebrow },
  summary: { color: theme.colors.fg },
}));
