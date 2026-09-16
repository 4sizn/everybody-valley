/**
 * 시트 뒷면 — 명당 상세. 데모의 `#faceDetail`.
 *
 * 스태거 순서는 데모 선택자 순서(`.cta`, `.ddesc`, `.icard`)와 같다.
 */
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useStaggerEntrance } from '@/animation/useStaggerEntrance';
import { CloseIcon, DirectionsIcon, ShareIcon, SparkleIcon } from '@/icons';
import { showNotice } from '@/platform/notify';
import { useAppState, useSession } from '@/session';
import { FESTIVAL_COPY } from '@/theme/copy';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { InfoCardPlaceholder } from '../shell/InfoCardPlaceholder';
import { sheetStyles, useSheetThemedStyles } from '../shell/sheetStyles';
import { InfoCard } from './InfoCard';

const CTA_STAGGER_INDEX = 0;
const DESC_STAGGER_INDEX = 1;
const INFO_STAGGER_START = 2;

export type SpotDetailFaceProps = {
  readonly generation: number;
  /** 시트 내부 가용 폭. 2×2 정보 카드의 칸 폭을 여기서 나눈다. */
  readonly innerWidth: number;
};

export function SpotDetailFace({ generation, innerWidth }: SpotDetailFaceProps) {
  const session = useSession();
  const festival = useAppState((state) => state.festival);
  const selectedId = useAppState((state) => state.selectedSpotId);
  const ctaEntrance = useStaggerEntrance(CTA_STAGGER_INDEX, generation);
  const descEntrance = useStaggerEntrance(DESC_STAGGER_INDEX, generation);
  const themed = useThemedStyles();
  const sheetThemed = useSheetThemedStyles();

  if (festival === null || selectedId === null) return <InfoCardPlaceholder />;

  const found = festival.findSpot(selectedId);
  if (!found.ok) return <InfoCardPlaceholder />;

  const spot = found.value;
  const distance = spot.distanceFrom(festival.launchSite);
  const cardWidth = (innerWidth - 8) / 2;

  return (
    <View>
      <View style={[sheetStyles.headerRow, styles.headerRow]}>
        <View>
          <Text style={[styles.eyebrow, themed.eyebrow]}>{FESTIVAL_COPY.detailEyebrow}</Text>
          <Text style={[sheetStyles.title, sheetThemed.title]} accessibilityRole="header">
            {spot.name}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={[sheetStyles.roundButton, sheetThemed.roundButton]}
            dataSet={{ mv: 'round-button' }}
            accessibilityLabel={FESTIVAL_COPY.controlTitles.share}
            onPress={() => showNotice(FESTIVAL_COPY.demoAlert)}
          >
            <ShareIcon />
          </Pressable>
          <Pressable
            style={[sheetStyles.roundButton, sheetThemed.roundButton]}
            dataSet={{ mv: 'round-button' }}
            accessibilityLabel={FESTIVAL_COPY.controlTitles.close}
            onPress={() => void session.clearSelection()}
          >
            <CloseIcon />
          </Pressable>
        </View>
      </View>

      <View style={styles.meta}>
        <SparkleIcon />
        <Text style={[styles.metaText, themed.metaText]}>
          {`${FESTIVAL_COPY.distancePrefix}${distance.format()}`}
        </Text>
      </View>

      <Animated.View style={[sheetStyles.ctaRow, ctaEntrance]}>
        <Pressable
          style={[
            sheetStyles.ctaButton,
            sheetStyles.ctaGhost,
            sheetThemed.ctaGhost,
            styles.flexOne,
          ]}
          dataSet={{ mv: 'cta' }}
          accessibilityLabel={FESTIVAL_COPY.directionsButton}
          onPress={() => showNotice(FESTIVAL_COPY.demoAlert)}
        >
          <View style={styles.iconLabel}>
            <DirectionsIcon />
            <Text style={[sheetStyles.ctaGhostLabel, sheetThemed.ctaGhostLabel]}>
              {FESTIVAL_COPY.directionsButton}
            </Text>
          </View>
        </Pressable>
        <Pressable
          style={[
            sheetStyles.ctaButton,
            sheetStyles.ctaPrimary,
            sheetThemed.ctaPrimary,
            styles.flexOne,
          ]}
          dataSet={{ mv: 'cta' }}
          accessibilityLabel={FESTIVAL_COPY.nearbyButton}
          onPress={() => void session.inspectNearby()}
        >
          <Text style={sheetStyles.ctaPrimaryLabel}>{FESTIVAL_COPY.nearbyButton}</Text>
        </Pressable>
      </Animated.View>

      <Animated.Text style={[styles.description, themed.description, descEntrance]}>
        {spot.description}
      </Animated.Text>

      <View style={styles.infoGrid}>
        {spot.infoRows.map((row, index) => (
          <InfoCard
            key={`${row.kind}-${row.label}`}
            row={row}
            width={cardWidth}
            staggerIndex={INFO_STAGGER_START + index}
            generation={generation}
          />
        ))}
      </View>

      <Text style={[sheetStyles.footer, sheetThemed.footer]}>{FESTIVAL_COPY.detailNotice}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    height: 'auto',
    alignItems: 'flex-start',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  eyebrow: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 3,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  metaText: {
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fontWeight: '500',
  },
  flexOne: {
    flex: 1,
  },
  iconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  description: {
    marginBottom: 14,
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    lineHeight: 22.5,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  eyebrow: { color: theme.colors.eyebrow },
  metaText: { color: theme.colors.fg2 },
  description: { color: theme.colors.fg2 },
}));
