/**
 * 제보 폼 — 시트 위 모달 팝업(F5b, 결정 (e)). `MapControls` 의 제보 버튼이 연다
 * (셸을 건드리지 않는다 — 그 버튼의 onPress 만 바뀐다).
 *
 * 구조 — 헤더(제목·닫기) → 119·112 고지(결정 (i), 조건 없이 항상) → 계곡 선택
 * (구간이 선택돼 있었으면 그 계곡으로 미리 채운다) → 유형 6색 칩 줄(`ReportTypeChipRow`) →
 * 본문 → 사진(썸네일 + 추가 타일, 결정 (c)) → 닉네임·비밀번호 한 줄 + 안내(결정 (c)) → 전송.
 *
 * 검증은 core `validateReportDraft` 를 그대로 쓴다(`reportFormLogic.ts`) — 첫 전송 시도 전에는
 * 오류를 보여주지 않는다(타이핑 중 계속 빨간 글씨가 뜨는 것을 막는다).
 *
 * 계곡 선택 UI — 목업 결정에는 없던 부분이다(제보 버튼이 특정 구간이 아니라 지도 전역
 * 컨트롤이라 "어느 계곡 이야기인지"를 폼이 물어야 한다). 30개를 한 줄 칩으로 늘어놓기엔
 * 많아 접힌 필드 + 펼치는 목록으로 뒀다 — `docs/TODO.md` F5 절 후속 제안에 기록.
 */
import {
  type ApiReportDraft,
  ConsoleLogger,
  formatReportCoordinate,
  type LngLat,
  type Logger,
  lookupSegment,
  REPORT_MAX_PHOTOS,
  type ReportType,
  type SegmentId,
  type Valley,
} from '@modu-valley/core';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { createApiClient } from '@/api/createApiClient';
import { CloseIcon } from '@/icons';
import { showNotice } from '@/platform/notify';
import {
  REPORT_LOCATION_PICKER_SUPPORTED,
  ReportLocationPicker,
} from '@/platform/reportLocationPicker';
import { pickReportPhotos, REPORT_PHOTO_PICKER_SUPPORTED } from '@/platform/reportPhotoPicker';
import { useAppState } from '@/session';
import { REPORT_FORM_COPY } from '@/theme/copy';
import { useSafeAreaGutters } from '@/theme/safeArea';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { FONT_FAMILY } from '@/theme/theme';
import { RADII } from '@/theme/tokens';
import { useColumnWidth } from '../../shell/CenterColumn';
import { InfoCardPlaceholder } from '../../shell/InfoCardPlaceholder';
import { ReportTypeChipRow } from './ReportTypeChipRow';
import {
  buildReportDraft,
  classifyReportSubmitError,
  createInitialReportFormState,
  isReportFormValid,
  type ReportFormPhoto,
  type ReportFormState,
  rejectReportPhoto,
  reportFormFieldErrors,
  reportLocationContextLabel,
  reportLocationDefaultCenter,
  retryAfterSecondsOf,
  withReportLocation,
} from './reportFormLogic';

const logger: Logger = new ConsoleLogger('valley').child('report-form');

export type ReportFormModalProps = {
  readonly visible: boolean;
  readonly onClose: () => void;
};

type SubmitStatus = 'idle' | 'submitting' | 'success';

const REPORT_BODY_MAX = 500;
const PHOTO_MAX_MB = 5;
const PHOTO_TILE_SIZE = 72;
const CARD_VERTICAL_MARGIN = 48;
const SUCCESS_CLOSE_DELAY_MS = 900;

/** 열릴 때 계곡(+구간) 컨텍스트를 미리 채운다 — 선택된 구간이 있으면 그 계곡, 없으면 첫 계곡. */
function defaultContextOf(
  valleys: readonly Valley[] | null,
  selectedSegmentId: SegmentId | null,
): { readonly valleyId: string; readonly segmentId?: string } | null {
  if (valleys === null || valleys.length === 0) return null;
  if (selectedSegmentId !== null) {
    const found = lookupSegment(valleys, selectedSegmentId);
    if (found.ok) return { valleyId: found.value.valley.id, segmentId: found.value.segment.id };
  }
  const first = valleys[0];
  return first === undefined ? null : { valleyId: first.id };
}

function revokeObjectUrl(uri: string): void {
  if (typeof URL !== 'undefined' && 'revokeObjectURL' in URL) {
    try {
      URL.revokeObjectURL(uri);
    } catch {
      // 이미 해제됐거나 이 런타임에 없는 API — 조용히 무시.
    }
  }
}

function revokePreviews(photos: readonly ReportFormPhoto[]): void {
  for (const photo of photos) if (photo.previewUri !== undefined) revokeObjectUrl(photo.previewUri);
}

export function ReportFormModal({ visible, onClose }: ReportFormModalProps) {
  const themed = useThemedStyles();
  const width = useColumnWidth();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaGutters();
  const valleys = useAppState((s) => s.valleys);
  const selectedSegmentId = useAppState((s) => s.selectedSegmentId);

  const defaultContext = useMemo(
    () => defaultContextOf(valleys, selectedSegmentId),
    [valleys, selectedSegmentId],
  );

  const [state, setState] = useState<ReportFormState | null>(null);
  const [valleyPickerOpen, setValleyPickerOpen] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | undefined>(undefined);
  const [photoErrorMessage, setPhotoErrorMessage] = useState<string | undefined>(undefined);

  const apiClient = useMemo(() => createApiClient({ logger }), []);
  const wasVisible = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 열릴 때(닫힘 → 열림)만 새 초안으로 리셋한다 — 열려 있는 동안 선택이 바뀌어도 입력을 지우지 않는다.
  useEffect(() => {
    if (visible && !wasVisible.current && defaultContext !== null) {
      setState(createInitialReportFormState(defaultContext.valleyId, defaultContext.segmentId));
      setValleyPickerOpen(false);
      setLocationPickerOpen(false);
      setSubmitAttempted(false);
      setStatus('idle');
      setSubmitErrorMessage(undefined);
      setPhotoErrorMessage(undefined);
    }
    wasVisible.current = visible;
  }, [visible, defaultContext]);

  // 타이머는 언마운트 시에만 정리한다(전송 성공 뒤 예약한 자동 닫힘).
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  const errors = state === null ? [] : reportFormFieldErrors(state);
  const errorOf = useCallback(
    (field: string): string | undefined =>
      submitAttempted ? errors.find((e) => e.field === field)?.reason : undefined,
    [errors, submitAttempted],
  );

  const close = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (status !== 'success') revokePreviews(state?.photos ?? []);
    onClose();
  }, [onClose, status, state]);

  const onSelectValley = useCallback((valley: Valley) => {
    setState((prev) => {
      if (prev === null) return prev;
      // `segmentId` 는 이전 계곡의 구간이라 새 계곡을 고르면 통째로 뺀다(exactOptionalPropertyTypes
      // 아래서는 `undefined` 를 대입하는 대신 키 자체를 없애야 한다).
      const { segmentId: _previousSegmentId, ...rest } = prev;
      return { ...rest, valleyId: valley.id };
    });
    setValleyPickerOpen(false);
  }, []);

  const onAddPhotos = useCallback(async () => {
    if (state === null) return;
    setPhotoErrorMessage(undefined);
    const remaining = REPORT_MAX_PHOTOS - state.photos.length;
    if (remaining <= 0) return;
    const picked = await pickReportPhotos({ maxCount: remaining });
    if (picked.length === 0) return;
    setState((prev) => {
      if (prev === null) return prev;
      let next = prev.photos;
      for (const photo of picked) {
        const rejection = rejectReportPhoto(next.length, photo.bytes);
        if (rejection === 'too-many') {
          setPhotoErrorMessage(REPORT_FORM_COPY.photoTooMany(REPORT_MAX_PHOTOS));
          break;
        }
        if (rejection === 'too-large') {
          setPhotoErrorMessage(REPORT_FORM_COPY.photoTooLarge(PHOTO_MAX_MB));
          continue;
        }
        next = [...next, photo];
      }
      return { ...prev, photos: next };
    });
  }, [state]);

  const onRemovePhoto = useCallback((id: string) => {
    setState((prev) => {
      if (prev === null) return prev;
      const removed = prev.photos.find((p) => p.id === id);
      if (removed?.previewUri !== undefined) revokeObjectUrl(removed.previewUri);
      return { ...prev, photos: prev.photos.filter((p) => p.id !== id) };
    });
    setPhotoErrorMessage(undefined);
  }, []);

  const onSubmit = useCallback(async () => {
    if (state === null) return;
    setSubmitAttempted(true);
    if (!isReportFormValid(state)) return;
    setStatus('submitting');
    setSubmitErrorMessage(undefined);
    const draft: ApiReportDraft = buildReportDraft(state);
    const result = await apiClient.createReport(draft);
    if (result.ok) {
      setStatus('success');
      showNotice(REPORT_FORM_COPY.submitSuccess);
      revokePreviews(state.photos);
      closeTimer.current = setTimeout(onClose, SUCCESS_CLOSE_DELAY_MS);
      return;
    }
    setStatus('idle');
    logger.warn('제보 전송 실패', { code: result.error.code, context: result.error.context });
    const kind = classifyReportSubmitError(result.error.context);
    setSubmitErrorMessage(
      kind === 'rate-limited'
        ? REPORT_FORM_COPY.submitRateLimited(retryAfterSecondsOf(result.error.context))
        : REPORT_FORM_COPY.submitFailed,
    );
  }, [state, apiClient, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel={REPORT_FORM_COPY.closeButton}
          onPress={status === 'submitting' ? undefined : close}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.avoider}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.card,
              themed.card,
              { width, maxHeight: height - insets.top - insets.bottom - CARD_VERTICAL_MARGIN },
            ]}
          >
            <View style={styles.header}>
              <Text style={[styles.title, themed.title]}>{REPORT_FORM_COPY.title}</Text>
              <Pressable
                style={[styles.closeButton, themed.closeButton]}
                accessibilityLabel={REPORT_FORM_COPY.closeButton}
                onPress={close}
              >
                <CloseIcon size={16} />
              </Pressable>
            </View>

            {state === null ? (
              <InfoCardPlaceholder />
            ) : (
              <ReportFormFields
                state={state}
                setState={setState}
                valleys={valleys ?? []}
                valleyPickerOpen={valleyPickerOpen}
                onToggleValleyPicker={() => setValleyPickerOpen((prev) => !prev)}
                onSelectValley={onSelectValley}
                locationPickerOpen={locationPickerOpen}
                onToggleLocationPicker={() => setLocationPickerOpen((prev) => !prev)}
                errorOf={errorOf}
                photoErrorMessage={photoErrorMessage}
                onAddPhotos={() => void onAddPhotos()}
                onRemovePhoto={onRemovePhoto}
                submitErrorMessage={submitErrorMessage}
                status={status}
                onSubmit={() => void onSubmit()}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── 폼 내용(스크롤 영역) ──────────────────────────────────────

type ReportFormFieldsProps = {
  readonly state: ReportFormState;
  readonly setState: (updater: (prev: ReportFormState | null) => ReportFormState | null) => void;
  readonly valleys: readonly Valley[];
  readonly valleyPickerOpen: boolean;
  readonly onToggleValleyPicker: () => void;
  readonly onSelectValley: (valley: Valley) => void;
  readonly locationPickerOpen: boolean;
  readonly onToggleLocationPicker: () => void;
  readonly errorOf: (field: string) => string | undefined;
  readonly photoErrorMessage: string | undefined;
  readonly onAddPhotos: () => void;
  readonly onRemovePhoto: (id: string) => void;
  readonly submitErrorMessage: string | undefined;
  readonly status: SubmitStatus;
  readonly onSubmit: () => void;
};

function ReportFormFields({
  state,
  setState,
  valleys,
  valleyPickerOpen,
  onToggleValleyPicker,
  onSelectValley,
  locationPickerOpen,
  onToggleLocationPicker,
  errorOf,
  photoErrorMessage,
  onAddPhotos,
  onRemovePhoto,
  submitErrorMessage,
  status,
  onSubmit,
}: ReportFormFieldsProps) {
  const theme = useTheme();
  const themed = useThemedStyles();
  const nicknameError = errorOf('nickname');
  const passwordError = errorOf('password');

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.emergencyNotice, themed.emergencyNotice]}>
        {REPORT_FORM_COPY.emergencyNotice}
      </Text>

      <FormSection label={REPORT_FORM_COPY.valleySectionLabel} error={undefined}>
        <ValleyPicker
          valleys={valleys}
          valleyId={state.valleyId}
          open={valleyPickerOpen}
          onToggle={onToggleValleyPicker}
          onSelect={onSelectValley}
        />
      </FormSection>

      <FormSection label={REPORT_FORM_COPY.locationSectionLabel} error={undefined}>
        <ReportLocationField
          state={state}
          valleys={valleys}
          open={locationPickerOpen}
          onToggle={onToggleLocationPicker}
          onChange={(point) => setState((prev) => (prev ? withReportLocation(prev, point) : prev))}
          onClear={() => setState((prev) => (prev ? withReportLocation(prev, null) : prev))}
        />
      </FormSection>

      <FormSection label={REPORT_FORM_COPY.typeSectionLabel} error={errorOf('type')}>
        <ReportTypeChipRow
          value={state.type}
          onChange={(type: ReportType) => setState((prev) => (prev ? { ...prev, type } : prev))}
        />
      </FormSection>

      <FormSection label={undefined} error={errorOf('body')}>
        <TextInput
          style={[styles.bodyInput, themed.input]}
          placeholder={REPORT_FORM_COPY.bodyPlaceholder}
          placeholderTextColor={theme.colors.fg3}
          value={state.body}
          onChangeText={(body) => setState((prev) => (prev ? { ...prev, body } : prev))}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
        <Text style={[styles.counter, themed.counter]}>
          {REPORT_FORM_COPY.bodyCounter(state.body.trim().length, REPORT_BODY_MAX)}
        </Text>
      </FormSection>

      <FormSection
        label={REPORT_FORM_COPY.photoSectionLabel(REPORT_MAX_PHOTOS)}
        error={errorOf('photoCount') ?? photoErrorMessage}
      >
        <PhotoPicker photos={state.photos} onAdd={onAddPhotos} onRemove={onRemovePhoto} />
      </FormSection>

      <View style={styles.credentialRow}>
        <View style={styles.credentialCol}>
          <Text style={[styles.fieldLabel, themed.fieldLabel]}>
            {REPORT_FORM_COPY.nicknameLabel}
          </Text>
          <TextInput
            style={[styles.credentialInput, themed.input]}
            placeholder={REPORT_FORM_COPY.nicknamePlaceholder}
            placeholderTextColor={theme.colors.fg3}
            value={state.nickname}
            onChangeText={(nickname) => setState((prev) => (prev ? { ...prev, nickname } : prev))}
          />
          {nicknameError === undefined ? null : (
            <Text style={[styles.errorText, themed.errorText]}>{nicknameError}</Text>
          )}
        </View>
        <View style={styles.credentialCol}>
          <Text style={[styles.fieldLabel, themed.fieldLabel]}>
            {REPORT_FORM_COPY.passwordLabel}
          </Text>
          <TextInput
            style={[styles.credentialInput, themed.input]}
            placeholder={REPORT_FORM_COPY.passwordPlaceholder}
            placeholderTextColor={theme.colors.fg3}
            value={state.password}
            onChangeText={(password) => setState((prev) => (prev ? { ...prev, password } : prev))}
            secureTextEntry
          />
          {passwordError === undefined ? null : (
            <Text style={[styles.errorText, themed.errorText]}>{passwordError}</Text>
          )}
        </View>
      </View>
      <Text style={[styles.credentialNotice, themed.credentialNotice]}>
        {REPORT_FORM_COPY.credentialNotice}
      </Text>

      {submitErrorMessage === undefined ? null : (
        <Text style={[styles.submitError, themed.submitError]}>{submitErrorMessage}</Text>
      )}

      <Pressable
        style={[
          styles.submitButton,
          themed.submitButton,
          status === 'submitting' ? styles.submitButtonBusy : null,
        ]}
        accessibilityRole="button"
        disabled={status === 'submitting'}
        onPress={onSubmit}
      >
        <Text style={styles.submitLabel}>
          {status === 'submitting' ? REPORT_FORM_COPY.submitting : REPORT_FORM_COPY.submitButton}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

// ── 계곡 선택 ──────────────────────────────────────────────────

type ValleyPickerProps = {
  readonly valleys: readonly Valley[];
  readonly valleyId: string;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly onSelect: (valley: Valley) => void;
};

function ValleyPicker({ valleys, valleyId, open, onToggle, onSelect }: ValleyPickerProps) {
  const themed = useThemedStyles();
  const current = valleys.find((v) => v.id === valleyId);
  return (
    <View>
      <Pressable
        style={[styles.valleyField, themed.valleyField]}
        accessibilityRole="button"
        onPress={onToggle}
      >
        <Text style={[styles.valleyFieldText, themed.valleyFieldText]}>
          {current?.name ?? REPORT_FORM_COPY.valleyPickerEmpty}
        </Text>
        <Text style={[styles.valleyChangeLabel, themed.valleyChangeLabel]}>
          {REPORT_FORM_COPY.valleyChangeLabel}
        </Text>
      </Pressable>
      {open ? (
        <ScrollView style={[styles.valleyList, themed.valleyList]} nestedScrollEnabled>
          {valleys.map((valley) => (
            <Pressable
              key={valley.id}
              style={styles.valleyRow}
              accessibilityRole="button"
              onPress={() => onSelect(valley)}
            >
              <Text
                style={[
                  styles.valleyRowText,
                  themed.valleyRowText,
                  valley.id === valleyId
                    ? [styles.valleyRowTextActive, themed.valleyRowTextActive]
                    : null,
                ]}
              >
                {valley.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

// ── 위치 피커(F5d) ────────────────────────────────────────────

type ReportLocationFieldProps = {
  readonly state: ReportFormState;
  readonly valleys: readonly Valley[];
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly onChange: (point: LngLat) => void;
  readonly onClear: () => void;
};

/**
 * 위치 항목(F5d, 승인된 목업) — 접힌 상태 → "지도에서 선택" → 인라인 지도 + 십자선 + 그
 * 아래 좌표 한 줄과 계곡·구간 라벨, 지우기 가능. 좌표는 선택 사항이다(해석 1) — 접힌 상태로
 * 두면 계곡·구간만으로 제보가 올라간다.
 */
function ReportLocationField({
  state,
  valleys,
  open,
  onToggle,
  onChange,
  onClear,
}: ReportLocationFieldProps) {
  const themed = useThemedStyles();
  const hasCoordinate = state.lat !== undefined && state.lng !== undefined;
  const coordinateText = hasCoordinate
    ? formatReportCoordinate(state.lat as number, state.lng as number)
    : null;

  if (!open) {
    // 바깥을 통째로 Pressable 로 감싸고 그 안에 "지우기" Pressable 을 또 두면 web 에서
    // <button> 안에 <button> 이 중첩돼(DOM 규칙 위반) React 가 경고하고 클릭이 두 버튼
    // 사이에서 뒤엉킨다 — 열기·지우기를 나란한 두 Pressable 로 쪼갠다(같은 View 의 자식).
    return (
      <View style={[styles.valleyField, themed.valleyField]}>
        <Pressable style={styles.locationFieldMain} accessibilityRole="button" onPress={onToggle}>
          <Text style={[styles.valleyFieldText, themed.valleyFieldText]} numberOfLines={1}>
            {coordinateText ?? REPORT_FORM_COPY.locationEmptyLabel}
          </Text>
          <Text style={[styles.valleyChangeLabel, themed.valleyChangeLabel]}>
            {hasCoordinate
              ? REPORT_FORM_COPY.locationChangeLabel
              : REPORT_FORM_COPY.locationOpenLabel}
          </Text>
        </Pressable>
        {hasCoordinate ? (
          <Pressable
            style={styles.locationClearButton}
            accessibilityRole="button"
            onPress={onClear}
            hitSlop={8}
          >
            <Text style={[styles.valleyChangeLabel, themed.valleyChangeLabel]}>
              {REPORT_FORM_COPY.locationClearLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (!REPORT_LOCATION_PICKER_SUPPORTED) {
    return (
      <View>
        <Text style={[styles.photoUnsupported, themed.photoUnsupported]}>
          {REPORT_FORM_COPY.locationPickerUnsupported}
        </Text>
        <Pressable
          style={[styles.locationDoneButton, themed.valleyField]}
          accessibilityRole="button"
          onPress={onToggle}
        >
          <Text style={[styles.valleyChangeLabel, themed.valleyChangeLabel]}>
            {REPORT_FORM_COPY.locationDoneLabel}
          </Text>
        </Pressable>
      </View>
    );
  }

  const center = reportLocationDefaultCenter(valleys, state.valleyId, state.segmentId);
  const contextLabel = reportLocationContextLabel(valleys, state.valleyId, state.segmentId);

  if (center === null)
    return <Text style={themed.valleyFieldText}>{REPORT_FORM_COPY.locationEmptyLabel}</Text>;

  return (
    <View>
      <ReportLocationPicker initialCenter={center} onChange={onChange} />
      <Text style={[styles.locationCoordinateLine, themed.valleyFieldText]}>
        {coordinateText ?? REPORT_FORM_COPY.locationHint}
      </Text>
      {contextLabel === null ? null : (
        <Text style={[styles.locationContextLine, themed.valleyRowText]}>{contextLabel}</Text>
      )}
      <View style={styles.locationActions}>
        <Pressable accessibilityRole="button" onPress={onToggle} hitSlop={8}>
          <Text style={[styles.valleyChangeLabel, themed.valleyChangeLabel]}>
            {REPORT_FORM_COPY.locationDoneLabel}
          </Text>
        </Pressable>
        {hasCoordinate ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onClear();
              onToggle();
            }}
            hitSlop={8}
          >
            <Text style={[styles.valleyChangeLabel, themed.valleyChangeLabel]}>
              {REPORT_FORM_COPY.locationClearLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ── 사진 선택 ──────────────────────────────────────────────────

type PhotoPickerProps = {
  readonly photos: readonly ReportFormPhoto[];
  readonly onAdd: () => void;
  readonly onRemove: (id: string) => void;
};

function PhotoPicker({ photos, onAdd, onRemove }: PhotoPickerProps) {
  const themed = useThemedStyles();
  if (!REPORT_PHOTO_PICKER_SUPPORTED) {
    return (
      <Text style={[styles.photoUnsupported, themed.photoUnsupported]}>
        {REPORT_FORM_COPY.photoPickerUnsupported}
      </Text>
    );
  }
  return (
    <View style={styles.photoRow}>
      {photos.map((photo) => (
        <View key={photo.id} style={styles.photoTile}>
          {photo.previewUri === undefined ? (
            <View style={[styles.photoTilePlaceholder, themed.photoTilePlaceholder]} />
          ) : (
            <Image source={{ uri: photo.previewUri }} style={styles.photoTileImage} />
          )}
          <Pressable
            style={styles.photoRemove}
            accessibilityLabel={REPORT_FORM_COPY.photoRemoveLabel}
            onPress={() => onRemove(photo.id)}
          >
            <CloseIcon size={11} color="#ffffff" />
          </Pressable>
        </View>
      ))}
      {photos.length < REPORT_MAX_PHOTOS ? (
        <Pressable
          style={[styles.photoAddTile, themed.photoAddTile]}
          accessibilityRole="button"
          accessibilityLabel={REPORT_FORM_COPY.photoAddLabel}
          onPress={onAdd}
        >
          <Text style={[styles.photoAddPlus, themed.photoAddPlus]}>+</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ── 폼 섹션 래퍼 ──────────────────────────────────────────────

type FormSectionProps = {
  readonly label: string | undefined;
  readonly error: string | undefined;
  readonly children: ReactNode;
};

function FormSection({ label, error, children }: FormSectionProps) {
  const themed = useThemedStyles();
  return (
    <View style={styles.section}>
      {label === undefined ? null : (
        <Text style={[styles.sectionLabel, themed.sectionLabel]}>{label}</Text>
      )}
      {children}
      {error === undefined ? null : (
        <Text style={[styles.errorText, themed.errorText]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  avoider: {
    width: '100%',
    alignItems: 'center',
  },
  card: {
    borderRadius: RADII.sheet,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    paddingHorizontal: 16,
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
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emergencyNotice: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  valleyField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    paddingHorizontal: 12,
    borderRadius: RADII.info,
    borderWidth: 1,
  },
  valleyFieldText: {
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fontWeight: '600',
  },
  valleyChangeLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '600',
  },
  valleyList: {
    maxHeight: 180,
    marginTop: 6,
    borderRadius: RADII.info,
    borderWidth: 1,
  },
  valleyRow: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  valleyRowText: {
    fontFamily: FONT_FAMILY,
    fontSize: 14,
  },
  valleyRowTextActive: {
    fontWeight: '700',
  },
  locationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationFieldMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  locationClearButton: {
    marginLeft: 12,
  },
  locationDoneButton: {
    height: 40,
    borderRadius: RADII.info,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  locationCoordinateLine: {
    marginTop: 8,
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fontWeight: '600',
  },
  locationContextLine: {
    marginTop: 2,
    marginBottom: 8,
    fontFamily: FONT_FAMILY,
    fontSize: 12,
  },
  bodyInput: {
    minHeight: 88,
    borderRadius: RADII.info,
    borderWidth: 1,
    padding: 12,
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    lineHeight: 20,
  },
  counter: {
    alignSelf: 'flex-end',
    marginTop: 4,
    fontFamily: FONT_FAMILY,
    fontSize: 11,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoTile: {
    width: PHOTO_TILE_SIZE,
    height: PHOTO_TILE_SIZE,
    borderRadius: RADII.info,
    overflow: 'hidden',
  },
  photoTileImage: {
    width: '100%',
    height: '100%',
  },
  photoTilePlaceholder: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  photoAddTile: {
    width: PHOTO_TILE_SIZE,
    height: PHOTO_TILE_SIZE,
    borderRadius: RADII.info,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddPlus: {
    fontSize: 22,
    fontWeight: '300',
  },
  photoUnsupported: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    lineHeight: 17,
  },
  credentialRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  credentialCol: {
    flex: 1,
  },
  fieldLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  credentialInput: {
    height: 40,
    borderRadius: RADII.info,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontFamily: FONT_FAMILY,
    fontSize: 14,
  },
  credentialNotice: {
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 16,
  },
  errorText: {
    marginTop: 4,
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    fontWeight: '600',
  },
  submitError: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  submitButton: {
    height: 48,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonBusy: {
    opacity: 0.7,
  },
  submitLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});

const useThemedStyles = createThemedStyles((theme) => ({
  card: { backgroundColor: theme.colors.surface },
  title: { color: theme.colors.fg },
  closeButton: { backgroundColor: theme.colors.bg },
  input: {
    color: theme.colors.fg,
    borderColor: theme.colors.line2,
    backgroundColor: theme.colors.bg,
  },
  sectionLabel: { color: theme.colors.fg },
  emergencyNotice: { color: theme.colors.fg2 },
  counter: { color: theme.colors.fg3 },
  valleyField: { borderColor: theme.colors.line2, backgroundColor: theme.colors.bg },
  valleyFieldText: { color: theme.colors.fg },
  valleyChangeLabel: { color: theme.colors.accent },
  valleyList: { borderColor: theme.colors.line2, backgroundColor: theme.colors.surface },
  valleyRowText: { color: theme.colors.fg2 },
  valleyRowTextActive: { color: theme.colors.accent },
  photoTilePlaceholder: { backgroundColor: theme.colors.bg },
  photoAddTile: { borderColor: theme.colors.line2 },
  photoAddPlus: { color: theme.colors.fg3 },
  photoUnsupported: { color: theme.colors.fg3 },
  fieldLabel: { color: theme.colors.fg2 },
  credentialNotice: { color: theme.colors.fg3 },
  errorText: { color: theme.colors.live },
  submitError: { color: theme.colors.live },
  submitButton: { backgroundColor: theme.colors.accent },
}));
