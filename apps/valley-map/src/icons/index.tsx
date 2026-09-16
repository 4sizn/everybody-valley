/**
 * 아이콘 — 원본 데모의 인라인 SVG 를 react-native-svg 로 옮긴 것.
 *
 * `viewBox`·좌표·stroke-width·linecap 을 하나도 바꾸지 않았다. 데모는
 * 아이콘마다 크기가 다르므로(18/20/21/30…) 각 컴포넌트가 자기 기본 크기를
 * 갖고, 호출부는 필요할 때만 덮어쓴다.
 *
 * react-native-svg 는 web·android·ios 모두에서 같은 API 로 동작하므로
 * 이 파일은 플랫폼 분기가 없다 — RN 전향 시 그대로 쓰인다.
 */
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/tokens';

export type IconProps = {
  readonly size?: number;
  readonly color?: string;
};

/**
 * 데모에서 `stroke="currentColor"` 였던 자리의 기본값 — 호출부가 색을 주지
 * 않으면 테마의 본문색(`fg`)을 쓴다. 기본 파라미터에서는 훅을 부를 수 없어
 * 함수 몸체에서 해석한다.
 */
function useIconColor(color: string | undefined, role: keyof ThemeColors = 'fg'): string {
  const theme = useTheme();
  return color ?? theme.colors[role];
}

export function SearchIcon({ size = 18, color: colorProp }: IconProps) {
  const color = useIconColor(colorProp, 'fg3');
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M20 20l-3.5-3.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * 나침반 바늘. 회전은 부모가 `transform` 으로 준다 — 데모의
 * `#needle{transition:transform .2s ease-out;transform-origin:center}`.
 */
export function CompassNeedleIcon({ size = 30 }: IconProps) {
  // 북쪽 바늘의 주황은 두 테마 같다. 꼬리는 컨트롤 배경에 따라 보이도록 토큰에서.
  const tail = useIconColor(undefined, 'compassTail');
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G>
        <Path d="M12 3.5 L15.6 12.6 L12 10.9 L8.4 12.6 Z" fill="#ff6b35" />
        <Path d="M12 20.5 L8.4 11.4 L12 13.1 L15.6 11.4 Z" fill={tail} />
      </G>
    </Svg>
  );
}

export function FireworksIcon({ size = 20, color: colorProp }: IconProps) {
  const color = useIconColor(colorProp);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={12} r={2.2} fill={color} />
    </Svg>
  );
}

export function LocateIcon({ size = 20, color: colorProp }: IconProps) {
  const color = useIconColor(colorProp);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={6.5} stroke={color} strokeWidth={1.8} />
      <Circle cx={12} cy={12} r={2} fill={color} />
      <Path
        d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function GlobeIcon({ size = 21, color: colorProp }: IconProps) {
  const color = useIconColor(colorProp);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={1.7} />
      <Ellipse cx={12} cy={12} rx={3.6} ry={8.5} stroke={color} strokeWidth={1.7} />
      <Path d="M3.6 12h16.8" stroke={color} strokeWidth={1.7} />
    </Svg>
  );
}

/**
 * 확대·축소 버튼.
 *
 * 데모에는 없는 아이콘이다 — web 은 maplibre `NavigationControl` 이 자기
 * `+`/`−` 를 그리기 때문이다. 네이티브에는 그 컨트롤이 없어 같은 모양을
 * 직접 그린다(선 두께·linecap 은 이 파일의 다른 아이콘과 같은 값).
 */
export function ZoomInIcon({ size = 20, color: colorProp }: IconProps) {
  const color = useIconColor(colorProp);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function ZoomOutIcon({ size = 20, color: colorProp }: IconProps) {
  const color = useIconColor(colorProp);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** 제보 버튼의 확성기. 데모는 몸통을 `fill="currentColor"` 로 채운다. */
export function MegaphoneIcon({ size = 20, color: colorProp }: IconProps) {
  const color = useIconColor(colorProp);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 10v4h3l6 4V6l-6 4h-3z"
        fill={color}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path
        d="M17 9.2a4 4 0 010 5.6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 하단 내비의 제보 아이콘 — 몸통이 비어 있다(데모와 동일한 차이). */
export function MegaphoneOutlineIcon({ size = 21, color: colorProp }: IconProps) {
  const color = useIconColor(colorProp);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 10v4h3l6 4V6l-6 4h-3z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path
        d="M17 9.2a4 4 0 010 5.6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ShareIcon({ size = 18, color: colorProp }: IconProps) {
  const color = useIconColor(colorProp);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={18} cy={5} r={2.6} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={6} cy={12} r={2.6} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={18} cy={19} r={2.6} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path
        d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function CloseIcon({ size = 18, color: colorProp }: IconProps) {
  const color = useIconColor(colorProp);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function CalendarIcon({ size = 15, color: colorProp }: IconProps) {
  const color = useIconColor(colorProp);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={5} width={17} height={15.5} rx={2.5} stroke={color} strokeWidth={1.8} />
      <Path d="M3.5 10h17M8 3v4M16 3v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function RowsIcon({ size = 14, color: colorProp }: IconProps) {
  const color = useIconColor(colorProp);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h16M4 12h16M4 17h16" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function TilesIcon({ size = 14, color: colorProp }: IconProps) {
  const color = useIconColor(colorProp);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={3.5} width={7} height={7} rx={1.6} stroke={color} strokeWidth={1.9} />
      <Rect x={13.5} y={3.5} width={7} height={7} rx={1.6} stroke={color} strokeWidth={1.9} />
      <Rect x={3.5} y={13.5} width={7} height={7} rx={1.6} stroke={color} strokeWidth={1.9} />
      <Rect x={13.5} y={13.5} width={7} height={7} rx={1.6} stroke={color} strokeWidth={1.9} />
    </Svg>
  );
}

/** 상세 상단의 채워진 반짝임. 데모 `fill="currentColor"`. */
export function SparkleIcon({ size = 14, color: colorProp }: IconProps) {
  const color = useIconColor(colorProp, 'fg2');
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill={color} />
    </Svg>
  );
}

export function DirectionsIcon({ size = 16, color: colorProp }: IconProps) {
  const color = useIconColor(colorProp);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l8 18-8-4-8 4z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

export function VideoIcon({ size = 21, color: colorProp }: IconProps) {
  const color = useIconColor(colorProp);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={2.5} y={5.5} width={19} height={13} rx={4} stroke={color} strokeWidth={1.7} />
      <Path d="M10.5 9.5l4.5 2.5-4.5 2.5z" fill={color} />
    </Svg>
  );
}

export function HomeIcon({ size = 21, color: colorProp }: IconProps) {
  const color = useIconColor(colorProp);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 19z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M9.5 20.5v-6h5v6" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

export function PinIcon({ size = 21, color: colorProp }: IconProps) {
  const color = useIconColor(colorProp);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z" stroke={color} strokeWidth={1.8} />
      <Circle cx={12} cy={10} r={2.4} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

export function SettingsIcon({ size = 21, color: colorProp }: IconProps) {
  const color = useIconColor(colorProp);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3.1} stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
      <Path
        d="M19.4 15a1.6 1.6 0 00.32 1.77l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.6 1.6 0 00-1.77-.32 1.6 1.6 0 00-1 1.47V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1.05-1.47 1.6 1.6 0 00-1.77.32l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.6 1.6 0 004.6 15a1.6 1.6 0 00-1.47-1H3a2 2 0 110-4h.1A1.6 1.6 0 004.6 9a1.6 1.6 0 00-.33-1.77l-.06-.06a2 2 0 112.83-2.83l.06.06A1.6 1.6 0 009 4.6h.08A1.6 1.6 0 0010 3.13V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.47 1.6 1.6 0 001.77-.32l.06-.06a2 2 0 112.83 2.83l-.06.06A1.6 1.6 0 0019.4 9v.08a1.6 1.6 0 001.47 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * 제보 피드 카드(F5c, 화면 결정 (d)) — 사진 없는 제보의 56px 썸네일 자리를 채우는
 * 연필 글리프. 유형 픽토그램(`ReportTypeGlyph`)과는 다른 자리다 — 저건 유형 칩 안에서
 * 유형색으로 그려지고, 이건 사진이 없다는 사실 자체를 말하는 중립색 자리표시자다.
 */
export function PenIcon({ size = 20, color: colorProp }: IconProps) {
  const color = useIconColor(colorProp, 'fg3');
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14.3 4.6l5.1 5.1-9.6 9.6-6 1.2 1.2-6 9.3-9.9z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path d="M12.8 6.1l5.1 5.1" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * 그늘 보기 토글 — 나무 실루엣 + 오른쪽 위 해(F4). 데모에 없는 아이콘이라 이 파일의
 * 다른 아이콘과 같은 선 두께(1.8)·linecap 으로 그렸다. 켜진 버튼(accent 배경)에서는
 * 호출부가 흰색을 준다.
 */
export function ShadeIcon({ size = 20, color: colorProp }: IconProps) {
  const color = useIconColor(colorProp);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={17.5} cy={6.5} r={2.5} stroke={color} strokeWidth={1.8} />
      <Path
        d="M17.5 1.5v1.2M22.5 6.5h-1.2M21 3l-.85.85M21 10l-.85-.85"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Path
        d="M9 3.5c-3 0-5.2 2.4-5.2 5.1 0 1 .3 1.9.8 2.7C3.2 12 2.5 13.2 2.5 14.6c0 2.4 2 4.2 4.5 4.2h4c2.5 0 4.5-1.8 4.5-4.2 0-1.4-.7-2.6-2.1-3.3.5-.8.8-1.7.8-2.7C14.2 5.9 12 3.5 9 3.5z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M9 18.8V22.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
