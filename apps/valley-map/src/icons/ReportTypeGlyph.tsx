/**
 * 제보 유형 6종 픽토그램(F5b). `icons/index.tsx` 의 다른 아이콘과 같은 24px 격자·선 두께(1.7~1.8)·
 * `strokeLinecap="round"` 로 새로 그렸다 — 지도 스프라이트가 아니라 폼 칩 전용이라(작업 지시
 * "아이콘은 앱 쪽 SVG 컴포넌트로 둔다") `map-style` 에 두지 않는다.
 *
 * 색은 항상 호출부가 준다(`REPORT_TYPE_COLORS[mode][type]`) — 유형칩은 6색 각각(화면 결정 (a))이라
 * 테마 기본색으로 떨어질 일이 없다.
 */
import type { ReportType } from '@modu-valley/core';
import Svg, { Circle, Path } from 'react-native-svg';

export type ReportTypeGlyphProps = {
  readonly type: ReportType;
  readonly size?: number;
  readonly color: string;
};

const COMMON = { strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function ReportTypeGlyph({ type, size = 16, color }: ReportTypeGlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {renderPaths(type, color)}
    </Svg>
  );
}

function renderPaths(type: ReportType, color: string) {
  switch (type) {
    // 불법 사유지 — 진입 금지 표지(원 + 사선).
    case 'illegal-property':
      return (
        <>
          <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={1.8} />
          <Path d="M6.5 6.5l11 11" stroke={color} strokeWidth={1.8} {...COMMON} />
        </>
      );
    // 쓰레기 — 쓰레기통.
    case 'trash':
      return (
        <>
          <Path
            d="M5 7h14M9 7V5.5A1.5 1.5 0 0110.5 4h3A1.5 1.5 0 0115 5.5V7M7 7l1 12.5A1.5 1.5 0 0010 21h4a1.5 1.5 0 001.5-1.5L17 7"
            stroke={color}
            strokeWidth={1.7}
            {...COMMON}
          />
          <Path d="M10 11v6M14 11v6" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
        </>
      );
    // 긴급 신고 — 경고 삼각형.
    case 'emergency':
      return (
        <>
          <Path d="M12 3.5L21.3 20H2.7L12 3.5z" stroke={color} strokeWidth={1.8} {...COMMON} />
          <Path d="M12 9.8v4.6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
          <Circle cx={12} cy={17} r={1.05} fill={color} />
        </>
      );
    // 계곡 새정보 — 정보(i).
    case 'valley-info':
      return (
        <>
          <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={1.8} />
          <Path d="M12 11.3v5.2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
          <Circle cx={12} cy={7.7} r={1.05} fill={color} />
        </>
      );
    // 미아찾기 — 사람 + 돋보기.
    case 'missing-person':
      return (
        <>
          <Circle cx={9.5} cy={6.8} r={2.8} stroke={color} strokeWidth={1.7} />
          <Path d="M4.3 19.5a5.2 5.2 0 0110.4 0" stroke={color} strokeWidth={1.7} {...COMMON} />
          <Circle cx={17.3} cy={15.3} r={2.9} stroke={color} strokeWidth={1.5} />
          <Path d="M19.4 17.4L21.5 19.5" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        </>
      );
    // 물건찾기 — 상자(입체감을 주는 이음선).
    case 'lost-item':
      return (
        <>
          <Path
            d="M4 8.3L12 4l8 4.3v9.4L12 22l-8-4.3V8.3z"
            stroke={color}
            strokeWidth={1.7}
            {...COMMON}
          />
          <Path d="M4 8.3L12 12.6l8-4.3M12 12.6V22" stroke={color} strokeWidth={1.7} {...COMMON} />
        </>
      );
  }
}
