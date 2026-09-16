/**
 * 시트 앞면 — 목록 뷰. 데모의 `#faceList`.
 *
 * 스태거 순서는 데모의 선택자 순서(`.cta`, `.card`, `.spot`)와 같고,
 * 앞쪽 8개까지만 애니메이션한다.
 */
import type { Spot, SpotLayout } from '@modu-valley/core';
import { useCallback, useLayoutEffect } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLayoutFlip } from '@/animation/useLayoutFlip';
import { STAGGER_LIMIT, useStaggerEntrance } from '@/animation/useStaggerEntrance';
import { ShareIcon } from '@/icons';
import { showNotice } from '@/platform/notify';
import { useAppState, useSession } from '@/session';
import { FESTIVAL_COPY } from '@/theme/copy';
import { InfoCardPlaceholder } from '../shell/InfoCardPlaceholder';
import { sheetStyles, useSheetThemedStyles } from '../shell/sheetStyles';
import { LayoutSegments } from './LayoutSegments';
import { ProgramCard } from './ProgramCard';
import { SpotItem } from './SpotItem';

/** 데모 선택자 순서상의 시작 인덱스. `.cta`=0, `.card`=1·2, `.spot`=3.. */
const CTA_STAGGER_INDEX = 0;
const PROGRAM_STAGGER_START = 1;
const SPOT_STAGGER_START = 3;

export type SpotListFaceProps = {
  readonly generation: number;
  /** 시트 내부 가용 폭. 타일 배치의 항목 폭을 여기서 나눈다. */
  readonly innerWidth: number;
};

export function SpotListFace({ generation, innerWidth }: SpotListFaceProps) {
  const session = useSession();
  const festival = useAppState((state) => state.festival);
  const layout = useAppState((state) => state.spotLayout);
  const flip = useLayoutFlip();
  const ctaEntrance = useStaggerEntrance(CTA_STAGGER_INDEX, generation);
  const sheetThemed = useSheetThemedStyles();

  // 배치가 커밋된 직후 FLIP 을 재생한다. `capture()` 는 세그먼트가 눌릴 때
  // 이미 불렸으므로, 여기서는 Last/Invert/Play 만 남는다.
  // layout 은 트리거다 — 값을 읽지 않고, 배치가 바뀐 커밋 직후라는 시점만 쓴다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: 위 설명 참고
  useLayoutEffect(() => {
    flip.play();
  }, [flip, layout]);

  const onSelectLayout = useCallback(
    (next: SpotLayout) => {
      flip.capture();
      void session.setSpotLayout(next);
    },
    [flip, session],
  );

  const onPressSpot = useCallback(
    (spot: Spot) => {
      void session.selectSpot(spot.id);
    },
    [session],
  );

  if (festival === null) return <InfoCardPlaceholder />;

  const tileWidth = (innerWidth - 8) / 2;

  return (
    <View>
      <View style={sheetStyles.headerRow}>
        <Text style={[sheetStyles.title, sheetThemed.title]} accessibilityRole="header">
          {festival.title}
        </Text>
        <Pressable
          style={[sheetStyles.roundButton, sheetThemed.roundButton]}
          dataSet={{ mv: 'round-button' }}
          accessibilityLabel={FESTIVAL_COPY.controlTitles.share}
          onPress={() => showNotice(FESTIVAL_COPY.demoAlert)}
        >
          <ShareIcon />
        </Pressable>
      </View>

      <Animated.View style={[sheetStyles.ctaRow, ctaEntrance]}>
        <Pressable
          style={[sheetStyles.ctaButton, sheetStyles.ctaPrimary, sheetThemed.ctaPrimary]}
          dataSet={{ mv: 'cta' }}
          accessibilityLabel={FESTIVAL_COPY.tourButton}
          onPress={() => void session.startTour()}
        >
          <Text style={sheetStyles.ctaPrimaryLabel}>{FESTIVAL_COPY.tourButton}</Text>
        </Pressable>
        <Pressable
          style={[sheetStyles.ctaButton, sheetStyles.ctaGhost, sheetThemed.ctaGhost]}
          dataSet={{ mv: 'cta' }}
          accessibilityLabel={FESTIVAL_COPY.pitchButton}
          onPress={() => void session.togglePitch()}
        >
          <Text style={[sheetStyles.ctaGhostLabel, sheetThemed.ctaGhostLabel]}>
            {FESTIVAL_COPY.pitchButton}
          </Text>
        </Pressable>
      </Animated.View>

      <Text style={[sheetStyles.sectionTitle, sheetThemed.sectionTitle]}>
        {FESTIVAL_COPY.programsHeading}
      </Text>
      <View style={styles.programList}>
        {festival.programs.map((program, index) => (
          <ProgramCard
            key={program.id}
            program={program}
            staggerIndex={PROGRAM_STAGGER_START + index}
            generation={generation}
          />
        ))}
      </View>

      <View style={styles.segmentHeader}>
        <Text style={[sheetStyles.sectionTitle, sheetThemed.sectionTitle, styles.segmentTitle]}>
          {FESTIVAL_COPY.spotsHeading}
        </Text>
        <LayoutSegments value={layout} onSelect={onSelectLayout} />
      </View>
      <Text style={[sheetStyles.sectionNote, sheetThemed.sectionNote]}>
        {FESTIVAL_COPY.spotsNotice}
      </Text>

      <View
        style={layout === 'tiles' ? styles.listTiles : styles.listRows}
        dataSet={{ mv: 'spot-list' }}
      >
        {festival.spots.map((spot, index) => (
          <SpotItem
            key={spot.id}
            spot={spot}
            distance={spot.distanceFrom(festival.launchSite)}
            layout={layout}
            tileWidth={tileWidth}
            flip={flip}
            staggerIndex={Math.min(SPOT_STAGGER_START + index, STAGGER_LIMIT)}
            generation={generation}
            onPress={onPressSpot}
          />
        ))}
      </View>

      <Text style={[sheetStyles.footer, sheetThemed.footer]}>
        {FESTIVAL_COPY.listFooter[0]}
        {'\n'}
        {FESTIVAL_COPY.listFooter[1]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  programList: {
    gap: 8,
  },
  segmentHeader: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  segmentTitle: {
    marginBottom: 0,
  },
  listRows: {
    flexDirection: 'column',
    gap: 8,
  },
  listTiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
