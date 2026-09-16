/**
 * 시트 내부에서 여러 컴포넌트가 공유하는 스타일.
 *
 * 데모에서 `.sec`, `.sub`, `.card`, `.cta`, `.share`, `.foot` 처럼 여러
 * 곳에 걸쳐 쓰이던 클래스들에 대응한다.
 *
 * 레이아웃·타이포는 `sheetStyles`(정적), 색은 `useSheetThemedStyles`(테마)
 * 로 나뉜다. 같은 키를 `[sheetStyles.x, themed.x]` 로 겹쳐 쓴다.
 */
import { StyleSheet } from 'react-native';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { RADII } from '@/theme/tokens';

export const sheetStyles = StyleSheet.create({
  /** `h2.sec` */
  sectionTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  /** `p.sub` */
  sectionNote: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    marginBottom: 12,
  },
  /** `.hrow` */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    marginBottom: 16,
  },
  /** `.hrow h1` */
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.6,
  },
  /** `.share` */
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: RADII.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** `.cta` */
  ctaRow: {
    flexDirection: 'row',
    gap: 8,
    height: 40,
    marginBottom: 24,
  },
  /** `.cta button` 공통 */
  ctaButton: {
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * `.cta .primary`
   *
   * 데모의 primary 는 자체 padding 을 주지 않아 브라우저의 `<button>` 기본
   * 좌우 padding 6px 이 그대로 남는다. 상세 패널처럼 두 버튼이 모두 `flex:1`
   * 인 곳에서는 그 12px 이 폭 배분을 바꿔(273/247 vs 279/241) 눈에 보이는
   * 차이를 만든다. 그래서 우연이 아니라 명시적으로 옮겨 둔다.
   */
  ctaPrimary: {
    flex: 1,
    paddingHorizontal: 6,
  },
  /** accent 위의 흰 글자 — 두 테마가 같다(accent 도 같다). */
  ctaPrimaryLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    fontWeight: '500',
    color: '#ffffff',
  },
  /** `.cta .ghost` */
  ctaGhost: {
    paddingHorizontal: 18,
    borderWidth: 1,
  },
  ctaGhostLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    fontWeight: '500',
  },
  /** `.foot` */
  footer: {
    marginTop: 20,
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    lineHeight: 19.2,
    textAlign: 'center',
  },
});

export const useSheetThemedStyles = createThemedStyles((theme) => ({
  sectionTitle: { color: theme.colors.fg },
  sectionNote: { color: theme.colors.fg3 },
  title: { color: theme.colors.fg },
  roundButton: { backgroundColor: theme.colors.bg, borderColor: theme.colors.line },
  ctaPrimary: { backgroundColor: theme.colors.accent },
  ctaGhost: { backgroundColor: theme.colors.bg, borderColor: theme.colors.line2 },
  ctaGhostLabel: { color: theme.colors.fg },
  footer: { color: theme.colors.fg3 },
}));
