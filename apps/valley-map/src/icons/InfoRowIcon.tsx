/**
 * 정보 카드 아이콘.
 *
 * 데모는 한국어 라벨 문자열로 아이콘을 찾는다(`ICON[l] ?? ICON._`). 라벨에
 * 오타가 나면 조용히 기본 아이콘으로 떨어진다. 여기서는 `InfoRowKind`
 * 유니온으로 조회하므로 빠진 경우를 컴파일이 잡는다.
 */
import type { InfoRowKind } from '@modu-valley/core';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

export type InfoRowIconProps = {
  readonly kind: InfoRowKind;
  readonly size?: number;
  readonly color?: string;
};

/** 데모의 헬퍼 `I(d, f)` 와 같은 공통 속성. */
const COMMON = {
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function InfoRowIcon({ kind, size = 13, color }: InfoRowIconProps) {
  const theme = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {renderPaths(kind, color ?? theme.colors.fg3)}
    </Svg>
  );
}

function renderPaths(kind: InfoRowKind, color: string) {
  switch (kind) {
    case 'viewpoint':
      return (
        <>
          <Path
            d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z"
            stroke={color}
            {...COMMON}
          />
          <Circle cx={12} cy={12} r={2.6} stroke={color} {...COMMON} />
        </>
      );
    case 'crowd':
      return (
        <>
          <Circle cx={9} cy={8} r={3} stroke={color} {...COMMON} />
          <Path d="M3 20a6 6 0 0112 0" stroke={color} {...COMMON} />
          <Path d="M16 5.2a3 3 0 010 5.6M17.5 20a6 6 0 00-2-4.5" stroke={color} {...COMMON} />
        </>
      );
    case 'restroom':
      return (
        <>
          <Path
            d="M7 21v-6M7 15a2.5 2.5 0 01-2.5-2.5V10A2.5 2.5 0 017 7.5 2.5 2.5 0 019.5 10v2.5A2.5 2.5 0 017 15z"
            stroke={color}
            {...COMMON}
          />
          <Circle cx={7} cy={4} r={1.6} stroke={color} {...COMMON} />
          <Path d="M17 21v-6l2-5-2-2.5-2 2.5 2 5" stroke={color} {...COMMON} />
          <Circle cx={17} cy={4} r={1.6} stroke={color} {...COMMON} />
        </>
      );
    case 'transit':
      return (
        <>
          <Rect x={5} y={3} width={14} height={14} rx={3} stroke={color} {...COMMON} />
          <Path d="M5 12h14M8 21l2-4M16 21l-2-4" stroke={color} {...COMMON} />
          <Circle cx={8.5} cy={14.5} r={0.9} fill={color} />
          <Circle cx={15.5} cy={14.5} r={0.9} fill={color} />
        </>
      );
    case 'other':
      return (
        <>
          <Circle cx={12} cy={12} r={9} stroke={color} {...COMMON} />
          <Path d="M12 16v-4M12 8h.01" stroke={color} {...COMMON} />
        </>
      );
  }
}
