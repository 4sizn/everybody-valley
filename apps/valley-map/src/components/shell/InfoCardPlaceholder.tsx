/**
 * 데이터가 아직 없을 때의 자리. 데모에는 없는 상태다 — 데이터가 스크립트에
 * 박혀 있어 "로딩 중" 이 존재하지 않기 때문이다. 저장소 포트가 들어오면서
 * 생긴 상태이므로, 화면이 깜빡이지 않을 만큼만 조용히 비워 둔다.
 */
import { StyleSheet, View } from 'react-native';

export function InfoCardPlaceholder() {
  return <View style={styles.placeholder} />;
}

const styles = StyleSheet.create({
  placeholder: {
    minHeight: 120,
  },
});
