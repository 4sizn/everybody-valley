/**
 * 관리자 토큰 입력(OPS1) — 좌상단 10탭으로 연다. 붙여넣기 가능(RN `TextInput` 기본
 * 동작), 화면에는 마스킹(`secureTextEntry`)만 보인다.
 *
 * "적용" 은 곧바로 저장하지 않는다 — 서버에 가벼운 인증 호출(`adminFlags`)을 한 번 던져
 * 토큰이 실제로 통하는지 확인한 뒤에만 `AdminModeProvider.enter()` 로 기기에 저장한다.
 * 틀린 토큰을 조용히 저장해 뒀다가 첫 숨김 시도에서야 실패로 드러나는 것을 막는다.
 *
 * 관리자 모드가 이미 켜져 있으면 같은 모달에서 "관리자 모드 해제" 버튼도 보인다 —
 * 이것이 사용자 규칙이 요구하는 "관리자 모드 해제 수단"이다.
 */
import { ConsoleLogger, type Logger } from '@modu-valley/core';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { createApiClient } from '@/api/createApiClient';
import { CloseIcon } from '@/icons';
import { showNotice } from '@/platform/notify';
import { ADMIN_COPY } from '@/theme/copy';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { RADII } from '@/theme/tokens';
import { useAdminMode } from './AdminModeContext';

const logger: Logger = new ConsoleLogger('valley').child('admin-token-modal');

export type AdminTokenModalProps = {
  readonly visible: boolean;
  readonly onClose: () => void;
};

type Status = 'idle' | 'checking';

export function AdminTokenModal({ visible, onClose }: AdminTokenModalProps) {
  const admin = useAdminMode();
  const themed = useThemedStyles();
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | undefined>(undefined);

  // 열릴 때마다 입력을 비운다 — 토큰을 화면에 남겨 두지 않는다.
  useEffect(() => {
    if (visible) {
      setInput('');
      setError(undefined);
      setStatus('idle');
    }
  }, [visible]);

  const onApply = useCallback(async () => {
    const candidate = input.trim();
    if (!candidate) {
      setError(ADMIN_COPY.tokenEmpty);
      return;
    }
    setStatus('checking');
    setError(undefined);
    const apiClient = createApiClient({ logger });
    const result = await apiClient.adminFlags(candidate);
    setStatus('idle');
    if (!result.ok) {
      const httpStatus = result.error.context['status'];
      setError(httpStatus === 401 ? ADMIN_COPY.tokenInvalid : ADMIN_COPY.tokenCheckFailed);
      return;
    }
    await admin.enter(candidate);
    showNotice(ADMIN_COPY.applySuccess);
    onClose();
  }, [input, admin, onClose]);

  const onExit = useCallback(async () => {
    await admin.exit();
    showNotice(ADMIN_COPY.exitSuccess);
    onClose();
  }, [admin, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel={ADMIN_COPY.closeButton}
          onPress={onClose}
        />
        <View style={[styles.card, themed.card]} dataSet={{ mv: 'admin-token-modal' }}>
          <View style={styles.header}>
            <Text style={[styles.title, themed.title]}>{ADMIN_COPY.tokenModalTitle}</Text>
            <Pressable
              style={[styles.closeButton, themed.closeButton]}
              accessibilityLabel={ADMIN_COPY.closeButton}
              onPress={onClose}
            >
              <CloseIcon size={16} />
            </Pressable>
          </View>

          {admin.token !== null ? (
            <Text style={[styles.activeNote, themed.activeNote]}>
              {ADMIN_COPY.tokenModalActiveNote}
            </Text>
          ) : null}

          <Text style={[styles.label, themed.label]}>{ADMIN_COPY.tokenLabel}</Text>
          <TokenInputField value={input} onChangeText={setInput} editable={status !== 'checking'} />
          {error === undefined ? null : (
            <Text style={[styles.errorText, themed.errorText]}>{error}</Text>
          )}

          <Pressable
            style={[
              styles.applyButton,
              themed.applyButton,
              status === 'checking' ? styles.applyButtonBusy : null,
            ]}
            accessibilityRole="button"
            disabled={status === 'checking'}
            onPress={() => void onApply()}
          >
            <Text style={styles.applyLabel}>
              {status === 'checking' ? ADMIN_COPY.applying : ADMIN_COPY.applyButton}
            </Text>
          </Pressable>

          {admin.token !== null ? (
            <Pressable
              style={styles.exitButton}
              accessibilityRole="button"
              onPress={() => void onExit()}
            >
              <Text style={[styles.exitLabel, themed.exitLabel]}>{ADMIN_COPY.exitButton}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/** web 은 `<input type=password>` 로 IME·붙여넣기가 자연스럽고, 네이티브는 RN `secureTextEntry`. */
function TokenInputField({
  value,
  onChangeText,
  editable,
}: {
  readonly value: string;
  readonly onChangeText: (next: string) => void;
  readonly editable: boolean;
}) {
  const theme = useTheme();
  const themed = useThemedStyles();
  return (
    <TextInput
      style={[styles.input, themed.input]}
      placeholder={ADMIN_COPY.tokenPlaceholder}
      placeholderTextColor={theme.colors.fg3}
      value={value}
      onChangeText={onChangeText}
      editable={editable}
      secureTextEntry
      autoCapitalize="none"
      autoCorrect={false}
      dataSet={{ mv: 'admin-token-input' }}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: RADII.sheet,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 17,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeNote: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    marginBottom: 12,
  },
  label: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderRadius: RADII.info,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontFamily: FONT_FAMILY,
    fontSize: 14,
  },
  errorText: {
    marginTop: 6,
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '600',
  },
  applyButton: {
    marginTop: 16,
    height: 46,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonBusy: {
    opacity: 0.7,
  },
  applyLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  exitButton: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
  },
  exitLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '600',
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  card: { backgroundColor: theme.colors.surface },
  title: { color: theme.colors.fg },
  closeButton: { backgroundColor: theme.colors.bg },
  activeNote: { color: theme.colors.accent },
  label: { color: theme.colors.fg2 },
  input: {
    color: theme.colors.fg,
    borderColor: theme.colors.line2,
    backgroundColor: theme.colors.bg,
  },
  errorText: { color: theme.colors.live },
  applyButton: { backgroundColor: theme.colors.accent },
  exitLabel: { color: theme.colors.live },
}));
