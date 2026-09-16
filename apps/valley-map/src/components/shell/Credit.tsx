/**
 * 지도 출처 표기. 데모의 `.credit`.
 *
 * 원본은 `<a target="_blank">` 링크다. RNW 는 `href`/`hrefAttrs` 를 받으면
 * `<a>` 로 렌더링하므로 web 은 같은 마크업이 나온다. 네이티브에는 `<a>` 가
 * 없으므로 `onPress` + `Linking` 으로 같은 결과(외부 브라우저에서 열기)를
 * 만든다 — 지도 데이터 출처 표기는 라이선스 요구사항이라 세 플랫폼 모두에서
 * 눌려야 한다.
 */
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { ATTRIBUTION } from '@/theme/copy';
import { useSafeAreaGutters } from '@/theme/safeArea';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { SIZES } from '@/theme/tokens';

/** 데모 `.credit{bottom:8px}`. */
const CREDIT_BOTTOM = 8;

export function Credit() {
  const insets = useSafeAreaGutters();
  const themed = useThemedStyles();

  return (
    <View
      style={[styles.credit, { bottom: insets.bottom + CREDIT_BOTTOM }]}
      dataSet={{ mv: 'credit' }}
    >
      <Text style={[styles.text, themed.text]}>
        {'© '}
        <AttributionLink
          label={ATTRIBUTION.openFreeMap.label}
          href={ATTRIBUTION.openFreeMap.href}
        />
        {' · © '}
        <AttributionLink
          label={ATTRIBUTION.openStreetMap.label}
          href={ATTRIBUTION.openStreetMap.href}
        />
      </Text>
    </View>
  );
}

function AttributionLink({ label, href }: { readonly label: string; readonly href: string }) {
  /* web 에서는 `href` 만으로 이미 링크다. `onPress` 를 함께 걸면 앵커의 기본
     이동과 `Linking.openURL` 이 둘 다 일어나 탭이 두 개 열린다. 그래서
     핸들러는 네이티브에만 붙인다. */
  const pressProps = Platform.OS === 'web' ? {} : { onPress: () => void Linking.openURL(href) };
  const themed = useThemedStyles();

  return (
    <Text style={[styles.link, themed.link]} href={href} hrefAttrs={LINK_ATTRS} {...pressProps}>
      {label}
    </Text>
  );
}

const LINK_ATTRS = { target: '_blank', rel: 'noreferrer' } as const;

const styles = StyleSheet.create({
  credit: {
    position: 'absolute',
    left: SIZES.gutter,
    zIndex: 4,
  },
  text: {
    fontFamily: FONT_FAMILY,
    fontSize: 10.5,
  },
  link: {
    // 데모는 `<a>` 의 기본 밑줄을 지우지 않는다(`.credit a{color:inherit}` 뿐).
    // react-native-web 은 밑줄을 초기화하므로 다시 명시한다.
    textDecorationLine: 'underline',
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  text: { color: theme.colors.credit },
  link: { color: theme.colors.credit },
}));
