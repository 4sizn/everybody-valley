/**
 * 루트 레이아웃.
 *
 * 데모는 화면이 하나뿐인 단일 페이지다. expo-router 를 쓰는 이유는
 *  · web 에서 `+html.tsx` 로 문서 셸(폰트·전역 CSS)을 다룰 수 있고,
 *  · 화면이 늘어날 때 라우팅 구조를 다시 짜지 않아도 되기 때문이다.
 *
 * 안전 영역 provider 를 여기에 둔다 — 화면 가장자리에 붙는 상단바·하단
 * 내비·출처 표기가 노치와 홈 인디케이터를 피하려면 인셋이 필요하다
 * (`@/theme/safeArea`).
 */
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { AppSafeAreaProvider } from '@/theme/safeArea';
import { createThemedStyles, ThemeProvider, useTheme } from '@/theme/ThemeProvider';

export default function RootLayout() {
  return (
    <AppSafeAreaProvider>
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </AppSafeAreaProvider>
  );
}

function Shell() {
  const theme = useTheme();
  const themed = useThemedStyles();
  return (
    <View style={[styles.root, themed.root]}>
      {/* 상태바 글자는 배경의 반대 명도. expo-status-bar 57 은 배경을 칠하지
          않으므로 지도가 상태바 뒤까지 이어진다. */}
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  root: { backgroundColor: theme.colors.bg },
}));
