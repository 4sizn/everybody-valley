/**
 * 웹 앱을 담는 네이티브 셸 — 화면은 서버가 주는 `ValleyApp`(웹) 이고, 앱은 그것을 띄운다.
 *
 * 주소는 서버 주소와 같다(`resolveApiBase`) — 서버가 웹과 `/api` 를 한 출처에서 서빙하기
 * 때문에 주소를 따로 들고 있을 필요가 없다. 개발 중에는 `EXPO_PUBLIC_API_BASE` 가 맥의
 * LAN 주소(`http://192.168.x.x:8788`)를 가리킨다.
 *
 * 셸이 하는 일은 셋뿐이다: 첫 로딩을 덮어 두기, 못 열렸을 때 다시 시도하기, iOS 에서 좌우
 * 스와이프로 뒤로 가기. 나머지(주소·상태·뒤로가기 경로)는 웹 앱이 스스로 관리한다.
 */
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { resolveApiBase } from '@/api/createApiClient';
import { ABSOLUTE_FILL } from '@/theme/layout';
import { useSafeAreaGutters } from '@/theme/safeArea';
import { createThemedStyles } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { RADII } from '@/theme/tokens';

const WEB_URL = resolveApiBase();

export function WebShell() {
  const webView = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const themed = useThemedStyles();
  // WKWebView 안에서는 `env(safe-area-inset-top)` 이 0 이라 웹의 상단바가 다이내믹 아일랜드에
  // 겹친다. 상단 인셋은 셸이 여백으로 준다. 하단은 `env(safe-area-inset-bottom)` 이 살아 있어
  // 웹이 스스로 띄우므로 셸이 더하면 두 번 띄운다.
  const insets = useSafeAreaGutters();

  const retry = () => {
    setFailed(false);
    setLoading(true);
    setAttempt((count) => count + 1);
  };

  return (
    <View style={[styles.root, themed.root, { paddingTop: insets.top }]}>
      <WebView
        key={attempt}
        ref={webView}
        source={{ uri: WEB_URL }}
        style={[styles.web, themed.root]}
        // 지도 타일과 관측 자료가 계속 들어온다 — 배경에서 멈추면 돌아왔을 때 빈 지도가 된다.
        mediaPlaybackRequiresUserAction={false}
        allowsBackForwardNavigationGestures
        // 웹 앱이 현재 위치로 지도를 맞춘다. 권한 문구는 Info.plist 에 있다.
        geolocationEnabled
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
        onHttpError={({ nativeEvent }) => {
          if (nativeEvent.statusCode >= 500) setFailed(true);
        }}
      />
      {loading && !failed && (
        <View style={[styles.cover, themed.root]} accessibilityRole="progressbar">
          <ActivityIndicator size="large" color={themed.spinner.color} />
        </View>
      )}
      {failed && (
        <View style={[styles.cover, themed.root]}>
          <Text style={[styles.title, themed.title]} accessibilityRole="header">
            계곡 정보를 불러오지 못했어요
          </Text>
          <Text style={[styles.note, themed.note]}>
            연결 상태를 확인하고 다시 시도해주세요.{'\n'}
            {WEB_URL}
          </Text>
          <Pressable
            style={[styles.retry, themed.retry]}
            accessibilityRole="button"
            accessibilityLabel="다시 시도"
            onPress={retry}
          >
            <Text style={[styles.retryText, themed.retryText]}>다시 시도</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  web: { flex: 1 },
  cover: {
    ...ABSOLUTE_FILL,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  title: { fontFamily: FONT_FAMILY, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  note: { fontFamily: FONT_FAMILY, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retry: { marginTop: 4, paddingHorizontal: 18, paddingVertical: 12, borderRadius: RADII.pill },
  retryText: { fontFamily: FONT_FAMILY, fontSize: 15, fontWeight: '600' },
});

const useThemedStyles = createThemedStyles((theme) => ({
  root: { backgroundColor: theme.colors.bg },
  title: { color: theme.colors.fg },
  note: { color: theme.colors.fg2 },
  retry: { backgroundColor: theme.colors.accent },
  retryText: { color: '#ffffff' },
  spinner: { color: theme.colors.accent },
}));
