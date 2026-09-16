/**
 * 하단 플로팅 내비. 데모의 `.nav`.
 *
 * 화면(컬럼이 아니라 뷰포트) 가운데에 붙는다 — 데모에서도 `<nav>` 가
 * `.col` 밖의 body 자식이다.
 *
 * 탭 활성 표시는 색 + 배경 + `inset` 링이다. RN 은 inset box-shadow 를
 * 표현하지 못하므로 같은 두께의 테두리로 대체하고, 정확한 링은 web 전역
 * 스타일시트가 `[data-mv="nav-button"][data-act="true"]` 에 얹는다.
 */
import { NAV_TABS, type NavTab } from '@modu-valley/core';
import { Pressable, StyleSheet, View } from 'react-native';
import { HomeIcon, MegaphoneOutlineIcon, PinIcon, SettingsIcon, VideoIcon } from '@/icons';
import { useAppState, useSession } from '@/session';
import { sceneCopy } from '@/theme/copy';
import { ABSOLUTE_FILL } from '@/theme/layout';
import { useSafeAreaGutters } from '@/theme/safeArea';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { RADII, SIZES } from '@/theme/tokens';

const ICONS: Readonly<Record<NavTab, (props: { color: string }) => React.ReactElement>> = {
  video: ({ color }) => <VideoIcon color={color} />,
  home: ({ color }) => <HomeIcon color={color} />,
  spots: ({ color }) => <PinIcon color={color} />,
  report: ({ color }) => <MegaphoneOutlineIcon color={color} />,
  settings: ({ color }) => <SettingsIcon color={color} />,
};

export function FloatingNav() {
  const session = useSession();
  const copy = sceneCopy(session.scene);
  const active = useAppState((state) => state.navTab);
  const insets = useSafeAreaGutters();
  const theme = useTheme();
  const themed = useThemedStyles();

  return (
    // 홈 인디케이터가 있는 기기에서는 그만큼 더 띄운다.
    <View style={[styles.frame, { paddingBottom: insets.bottom + SIZES.gutter }]}>
      <View style={[styles.nav, themed.nav]} dataSet={{ mv: 'nav' }}>
        {NAV_TABS.map((tab) => {
          const isActive = tab === active;
          const Icon = ICONS[tab];
          return (
            <Pressable
              key={tab}
              style={[styles.button, isActive ? themed.buttonActive : null]}
              dataSet={{ mv: 'nav-button', act: isActive }}
              accessibilityLabel={copy.navTitles[tab]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              onPress={() => session.setNavTab(tab)}
            >
              <Icon color={isActive ? theme.colors.fg : theme.colors.fg3} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    ...ABSOLUTE_FILL,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 7,
    pointerEvents: 'box-none',
  },
  nav: {
    height: SIZES.navHeight,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADII.pill,
  },
  button: {
    width: SIZES.navButton,
    height: SIZES.navButton,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  nav: { backgroundColor: theme.colors.bg },
  buttonActive: { backgroundColor: theme.colors.segActive },
}));
