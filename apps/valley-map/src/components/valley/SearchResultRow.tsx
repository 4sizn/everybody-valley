/**
 * 검색 결과 한 줄(SR1, 사용자 결정 2026-09-08) — `FacilityRow` 와 같은 표면
 * (`surface`, 테두리, radius) 이지만 내용은 결과 종류로 갈린다.
 *
 *   계곡 매치 — 계곡명만("백운계곡").
 *   시설 매치 — "계곡명 · 시설명 · 유형"(결정 4) + 픽토그램(`FacilityGlyph`, 목록
 *              미니 행과 같은 도형·크기).
 *
 * 누르면(`onPress`) 부모가 계곡은 `selectSegment`, 시설은 `selectFacility` 를
 * 부르고 검색어를 지운다(결정 5) — 이 컴포넌트는 어떤 유즈케이스인지 모른다.
 */
import { facilityTypeLabel, type SearchResult } from '@modu-valley/core';
import { Pressable, StyleSheet, Text } from 'react-native';
import { FacilityGlyph } from '@/icons/FacilityGlyph';
import { VALLEY_COPY } from '@/theme/copy';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { RADII } from '@/theme/tokens';
import { FACILITY_GLYPH_SIZE } from './FacilityRow';

export type SearchResultRowProps = {
  readonly result: SearchResult;
  readonly onPress: (result: SearchResult) => void;
};

export function SearchResultRow({ result, onPress }: SearchResultRowProps) {
  const themed = useThemedStyles();
  const label =
    result.kind === 'valley'
      ? result.valley.name
      : VALLEY_COPY.search.facilityResultLabel(
          result.valley.name,
          result.facility.name,
          facilityTypeLabel(result.facility.facilityType),
        );

  return (
    <Pressable
      style={[styles.row, themed.row]}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onPress(result)}
      dataSet={{ mv: 'search-result', kind: result.kind }}
    >
      {result.kind === 'facility' ? (
        <FacilityGlyph type={result.facility.facilityType} size={FACILITY_GLYPH_SIZE} />
      ) : null}
      <Text style={[styles.label, themed.label]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderRadius: RADII.card,
  },
  label: {
    flex: 1,
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fontWeight: '500',
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  row: { backgroundColor: theme.colors.surface, borderColor: theme.colors.line2 },
  label: { color: theme.colors.fg },
}));
