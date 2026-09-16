/**
 * 명당 목록 항목. 데모의 `.spot`.
 *
 * 행 배치와 타일 배치에서 같은 데이터가 다른 모양으로 나온다
 * (`#spotList.rows .spot` / `#spotList.tiles .spot`). 두 배치 사이의 이동은
 * FLIP 애니메이션이 메우므로, 이 컴포넌트는 최종 모양만 그린다.
 *
 * 점 주변의 링(`box-shadow: 0 0 0 4px rgba(255,255,255,.06)`)과 3D 접힘에
 * 필요한 `transform-style:preserve-3d` / `backface-visibility:hidden` 은
 * RN 스타일로 표현되지 않아 web 전역 스타일시트가 맡는다.
 */
import type { Distance, Spot, SpotLayout } from '@modu-valley/core';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LayoutFlipController } from '@/animation/useLayoutFlip';
import { useStaggerEntrance } from '@/animation/useStaggerEntrance';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { RADII } from '@/theme/tokens';

export type SpotItemProps = {
  readonly spot: Spot;
  readonly distance: Distance;
  readonly layout: SpotLayout;
  /** 타일 배치에서의 항목 폭. 데모의 `grid-template-columns:1fr 1fr` 에 대응. */
  readonly tileWidth: number;
  readonly flip: LayoutFlipController;
  readonly staggerIndex: number;
  readonly generation: number;
  readonly onPress: (spot: Spot) => void;
};

export function SpotItem({
  spot,
  distance,
  layout,
  tileWidth,
  flip,
  staggerIndex,
  generation,
  onPress,
}: SpotItemProps) {
  const entrance = useStaggerEntrance(staggerIndex, generation);
  const isTiles = layout === 'tiles';
  const themed = useThemedStyles();

  return (
    <Animated.View
      style={[styles.wrapper, isTiles ? { width: tileWidth } : styles.wrapperRows, entrance]}
      ref={(instance) => {
        flip.registerItem(spot.id, instance);
        return () => flip.registerItem(spot.id, null);
      }}
      dataSet={{ mv: 'spot-wrapper' }}
    >
      <Pressable
        style={[styles.spot, themed.spot, isTiles ? styles.spotTiles : styles.spotRows]}
        dataSet={{ mv: 'spot' }}
        accessibilityRole="button"
        accessibilityLabel={`${spot.name} ${spot.tag}`}
        onPress={() => onPress(spot)}
      >
        <View
          style={[styles.dot, { backgroundColor: spot.color }]}
          dataSet={{ mv: 'spot-dot', tiles: isTiles }}
        />
        <View>
          <Text style={[styles.name, themed.name]}>{spot.name}</Text>
          <Text style={[styles.tag, themed.tag]}>{spot.tag}</Text>
        </View>
        <Text
          style={[
            styles.distance,
            themed.distance,
            isTiles ? styles.distanceTiles : styles.distanceRows,
          ]}
          dataSet={{ mv: 'spot-distance' }}
        >
          {distance.format()}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    // FLIP 이 이 래퍼를 움직인다. 안쪽 Pressable 은 hover 전환만 담당한다.
  },
  wrapperRows: {},
  spot: {
    borderRadius: RADII.card,
  },
  spotRows: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
  },
  spotTiles: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    minHeight: 104,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  name: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    fontWeight: '600',
  },
  tag: {
    marginTop: 2,
    fontFamily: FONT_FAMILY,
    fontSize: 12,
  },
  distance: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
  },
  distanceRows: {
    marginLeft: 'auto',
  },
  distanceTiles: {
    marginLeft: 0,
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  spot: { backgroundColor: theme.colors.surface },
  name: { color: theme.colors.fg },
  tag: { color: theme.colors.fg3 },
  distance: { color: theme.colors.fg2 },
}));
