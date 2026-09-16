/**
 * 시트 앞면 — 계곡 목록. `festival/SpotListFace` 의 계곡판.
 *
 * 구조
 *   제목("계곡 목록") → [선택된 시설 미니 행] → 요약 한 줄(계곡 n · 구간 n · 시설 n · 정오 그늘 평균)
 *   → 계곡마다: 헤더(계곡명 [현장 미확인 배지 — SD1 (g), desk 검수] · 상류→하류 · 구간 n개) + 구간 카드들
 *   → 하단 고지(데이터셋 설명 → 출처 → 검수 고지)
 *
 * V1 (e) — 데이터셋 `description`(샘플 고지)이 카드보다 먼저 오던 자리를 화면이 담은 것의
 * 요약으로 바꿨다. 고지는 footer 첫 줄. 수치는 코어 `summarizeValleys`, 문장은 `VALLEY_COPY`.
 *
 * 구간은 `Valley.segments` 가 이미 상류→하류(`order`)로 정렬해 들고 있다 —
 * 여기서는 다시 정렬하지 않는다. 카드 부제의 "주차장 320m" 는 구간 **시작점**
 * 기준 가장 가까운 주차장이다(`Valley.nearestFacility`).
 *
 * 스태거는 데모와 같은 규칙(앞쪽 8개까지) — 미니 행이 있으면 0번, 카드는 그 뒤.
 */
import type { Report, SearchResult, Segment, Valley } from '@modu-valley/core';
import {
  filterValleys,
  lookupFacility,
  pinnedValleyId,
  searchCatalog,
  selectFeedReports,
  summarizeValleys,
  verificationLabel,
} from '@modu-valley/core';
import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { STAGGER_LIMIT } from '@/animation/useStaggerEntrance';
import { useAppState, useSession } from '@/session';
import { REPORT_FEED_COPY, VALLEY_COPY } from '@/theme/copy';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { InfoCardPlaceholder } from '../shell/InfoCardPlaceholder';
import { sheetStyles, useSheetThemedStyles } from '../shell/sheetStyles';
import { FacilityRow } from './FacilityRow';
import { Badge } from './Pill';
import { ReportCard } from './report/ReportCard';
import { SearchResultRow } from './SearchResultRow';
import { SegmentCard } from './SegmentCard';

export type ValleyListFaceProps = {
  readonly generation: number;
  /** 시트 내부 가용 폭. 계곡 면은 한 열이라 지금은 쓰지 않지만 면 인터페이스를 맞춘다. */
  readonly innerWidth: number;
};

export function ValleyListFace({ generation }: ValleyListFaceProps) {
  const session = useSession();
  const valleys = useAppState((state) => state.valleys);
  const metadata = useAppState((state) => state.valleyMetadata);
  const selectedSegmentId = useAppState((state) => state.selectedSegmentId);
  const selectedFacilityId = useAppState((state) => state.selectedFacilityId);
  const filterChips = useAppState((state) => state.filterChips);
  const alerts = useAppState((state) => state.alerts);
  const reports = useAppState((state) => state.reports);
  const searchQuery = useAppState((state) => state.searchQuery);
  const sheetThemed = useSheetThemedStyles();
  const themed = useThemedStyles();
  const theme = useTheme();
  // 계곡 배열은 적재 때 한 번 굳는다(MapContentComposer) — 참조가 같으면 다시 세지 않는다.
  const summary = useMemo(() => (valleys === null ? null : summarizeValleys(valleys)), [valleys]);
  // N1 — 선택된 계곡은 필터를 이긴다(해석 4). 지도(`MapContentComposer`)와 같은 핀 규칙.
  const filtered = useMemo(
    () =>
      valleys === null
        ? null
        : filterValleys(
            valleys,
            filterChips,
            pinnedValleyId({ valleys, selectedSegmentId, selectedFacilityId }),
          ),
    [valleys, filterChips, selectedSegmentId, selectedFacilityId],
  );
  // "실시간 정보" 3건(화면 결정 (f)) — 최신순 절단. 제보가 없으면 섹션 자체를 그리지 않는다.
  const feedReports = useMemo(
    () => (reports === null ? [] : selectFeedReports(reports)),
    [reports],
  );
  // 검색(SR1) — 값이 있으면(공백만이어도) 검색 모드다(결정 2). `searchCatalog` 는 core 의
  // 순수 함수 — 필터 칩을 모른다(결정 6, 검색은 필터를 무시한다).
  const isSearching = searchQuery.length > 0;
  const searchResults = useMemo(
    () => (valleys === null ? [] : searchCatalog(valleys, searchQuery)),
    [valleys, searchQuery],
  );

  const onPressSearchResult = useCallback(
    (result: SearchResult) => {
      if (result.kind === 'valley') void session.selectSegment(result.segmentId);
      else void session.selectFacility(result.facility.id);
      // 결정 5 — 선택하면 검색어를 지운다(찾았으니 끝).
      session.setSearchQuery('');
    },
    [session],
  );
  const onPressSegment = useCallback(
    (segment: Segment) => {
      void session.selectSegment(segment.id);
    },
    [session],
  );
  const onPressReport = useCallback(
    (report: Report) => {
      void session.selectReport(report.id);
    },
    [session],
  );
  const onClearFacility = useCallback(() => {
    void session.clearSelection();
  }, [session]);

  if (valleys === null || filtered === null) return <InfoCardPlaceholder />;

  // 검색 모드(결정 2) — 구간 섹션·"실시간 정보"·선택된 시설 미니 행까지 전부 숨기고
  // 검색 결과만 보여준다. 모드 전환이 헷갈리지 않으려면 다른 것을 섞지 않는다.
  if (isSearching) {
    return (
      <SearchResultsSection
        results={searchResults}
        filterIgnored={filterChips.size > 0}
        onPressResult={onPressSearchResult}
      />
    );
  }

  const selectedFacility =
    selectedFacilityId === null ? undefined : lookupFacility(valleys, selectedFacilityId);
  const facility = selectedFacility?.ok === true ? selectedFacility.value.facility : undefined;
  // 미니 행이 스태거 0번을 차지하면 카드는 1번부터.
  let stagger = facility === undefined ? 0 : 1;
  // 제보 카드의 상대 시각 기준 — 한 번 고정해 같은 렌더 안의 카드들이 같은 값을 쓴다.
  const now = new Date();

  return (
    <View>
      <View style={sheetStyles.headerRow}>
        <Text style={[sheetStyles.title, sheetThemed.title]} accessibilityRole="header">
          {VALLEY_COPY.listTitle}
        </Text>
      </View>

      {facility === undefined ? null : (
        <FacilityRow
          facility={facility}
          staggerIndex={0}
          generation={generation}
          onClear={onClearFacility}
        />
      )}

      {summary === null ? null : (
        <Text style={[sheetStyles.sectionNote, sheetThemed.sectionNote]}>
          {VALLEY_COPY.listSummary(summary)}
        </Text>
      )}

      {feedReports.length === 0 ? null : (
        <View style={styles.reportSection} dataSet={{ mv: 'report-feed' }}>
          <Text style={[sheetStyles.sectionTitle, sheetThemed.sectionTitle]}>
            {REPORT_FEED_COPY.sectionTitle}
          </Text>
          <View style={styles.reportCards}>
            {feedReports.map((report) => (
              <ReportCard key={report.id} report={report} now={now} onPress={onPressReport} />
            ))}
          </View>
        </View>
      )}

      {filtered.valleys.map((valley) => (
        <View key={valley.id} style={styles.valleyBlock}>
          <View style={styles.valleyHeader}>
            <View style={styles.valleyTitleRow}>
              <Text style={[sheetStyles.sectionTitle, sheetThemed.sectionTitle, styles.valleyName]}>
                {valley.name}
              </Text>
              {valley.verified === 'desk' ? (
                <Badge
                  label={verificationLabel(valley.verified)}
                  textColor={theme.colors.fg3}
                  borderColor={theme.colors.line2}
                  dataSet={{ mv: 'desk' }}
                />
              ) : null}
            </View>
            <Text style={[styles.valleyNote, themed.valleyNote]}>
              {VALLEY_COPY.valleyOrderNote(valley.segments.length)}
            </Text>
          </View>
          <View style={styles.cards} dataSet={{ mv: 'segment-list' }}>
            {valley.segments.map((segment) => {
              const index = Math.min(stagger, STAGGER_LIMIT);
              stagger += 1;
              return (
                <SegmentCard
                  key={segment.id}
                  valley={valley}
                  segment={segment}
                  nearestParking={nearestParkingOf(valley, segment)}
                  alertState={alerts?.get(valley.id)}
                  staggerIndex={index}
                  generation={generation}
                  onPress={onPressSegment}
                />
              );
            })}
          </View>
        </View>
      ))}

      {/* N1 결정 (e) E2 — 0곳이어도 문구만, 완화 제안·해제 버튼은 만들지 않는다. */}
      {filterChips.size > 0 && filtered.valleys.length === 0 ? (
        <Text
          style={[sheetStyles.sectionNote, sheetThemed.sectionNote]}
          dataSet={{ mv: 'filter-empty-result' }}
        >
          {VALLEY_COPY.filter.emptyResult}
        </Text>
      ) : null}

      {/* N1 결정 (b) — 정보가 없어 필터 판정에서 제외된 계곡 수. 칩이 없으면(필터 미적용) 0. */}
      {filtered.excludedByMissingInfo > 0 ? (
        <Text
          style={[styles.valleyNote, themed.valleyNote]}
          dataSet={{ mv: 'filter-excluded-count' }}
        >
          {VALLEY_COPY.filter.excludedByMissingInfo(filtered.excludedByMissingInfo)}
        </Text>
      ) : null}

      <Text style={[sheetStyles.footer, sheetThemed.footer]}>
        {[metadata?.description, ...VALLEY_COPY.listFooter].filter(Boolean).join('\n')}
      </Text>
    </View>
  );
}

/** 카드 부제의 "주차장 320m" — 구간 시작점(상류 끝) 기준. */
function nearestParkingOf(valley: Valley, segment: Segment) {
  return valley.nearestFacility(segment.start, 'parking');
}

type SearchResultsSectionProps = {
  readonly results: readonly SearchResult[];
  /** 결정 6 — 검색은 필터 칩을 무시한다. 필터가 걸려 있으면 안내 한 줄만 덧붙인다. */
  readonly filterIgnored: boolean;
  readonly onPressResult: (result: SearchResult) => void;
};

/**
 * 검색 모드(결정 2) 전용 렌더 — `ValleyListFace` 에서 갈라낸 별도 컴포넌트다(복잡도
 * 완화 목적도 있지만, 검색 모드가 다른 것과 섞이지 않는다는 것도 이 분리로 더 분명해진다).
 *
 * 결과 없음(결정 7) 문구 아래 별도 지우기 버튼을 뒀었지만, 시트 기본 스냅("half")
 * 에서 그 버튼이 접힌 높이 아래로 밀려 안 보였다(실측, 스크린샷으로 발견). 상단바의
 * ×(결정 8, `TopBar` 의 `search.onClear`) 가 이미 항상 보이는 지우기 수단이라 중복 없이
 * 그것으로 족하다 — 이 컴포넌트는 지우기를 몰라도 된다.
 */
function SearchResultsSection({
  results,
  filterIgnored,
  onPressResult,
}: SearchResultsSectionProps) {
  const sheetThemed = useSheetThemedStyles();

  return (
    <View>
      <View style={sheetStyles.headerRow}>
        <Text style={[sheetStyles.title, sheetThemed.title]} accessibilityRole="header">
          {VALLEY_COPY.search.heading}
        </Text>
      </View>

      {results.length === 0 ? (
        <Text
          style={[sheetStyles.sectionNote, sheetThemed.sectionNote]}
          dataSet={{ mv: 'search-empty-result' }}
        >
          {VALLEY_COPY.search.emptyResult}
        </Text>
      ) : (
        <View style={styles.searchResultList} dataSet={{ mv: 'search-result-list' }}>
          {results.map((result) => (
            <SearchResultRow
              key={searchResultKey(result)}
              result={result}
              onPress={onPressResult}
            />
          ))}
        </View>
      )}

      {filterIgnored ? (
        <Text
          style={[sheetStyles.sectionNote, sheetThemed.sectionNote, styles.searchFilterNotice]}
          dataSet={{ mv: 'search-filter-ignored-notice' }}
        >
          {VALLEY_COPY.search.filterIgnoredNotice}
        </Text>
      ) : null}
    </View>
  );
}

/** 검색 결과 목록의 key — 계곡·시설 id 를 종류로 구분해 합친다. */
function searchResultKey(result: SearchResult): string {
  return result.kind === 'valley' ? `valley:${result.valley.id}` : `facility:${result.facility.id}`;
}

const styles = StyleSheet.create({
  /** "실시간 정보" 섹션(F5c) — 구간 섹션 위(화면 결정 (f)). */
  reportSection: {
    marginBottom: 20,
  },
  reportCards: {
    gap: 8,
  },
  /** 검색 결과 목록(SR1). */
  searchResultList: {
    gap: 8,
  },
  searchFilterNotice: {
    marginTop: 12,
  },
  valleyBlock: {
    marginBottom: 20,
  },
  valleyHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  valleyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  valleyName: {
    marginBottom: 0,
  },
  valleyNote: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
  },
  cards: {
    gap: 8,
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  valleyNote: { color: theme.colors.fg3 },
}));
