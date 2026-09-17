import {
  type ApiReport,
  type ApiReportPhotoInput,
  formatReportCoordinate,
  isWithinReportCoordinateRadius,
  LngLat,
  REPORT_BODY_MAX_LENGTH,
  REPORT_COORDINATE_MAX_DISTANCE_M,
  REPORT_PHOTO_MAX_BYTES,
  REPORT_TYPES,
  type ReportType,
  reportCoordinateCopyText,
  reportRelativeTimeLabel,
  reportTypeLabel,
  segmentPositionLabel,
  type Valley,
  validateReportDraft,
} from '@modu-valley/core';
import {
  Alert,
  Badge,
  Button,
  Chip,
  Dialog,
  EmptyState,
  Field,
  type LocalPhoto,
  PhotoInput,
  type Status,
} from '@moduvalley/ui';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createApiClient, reportPhotoUrl } from '@/api/createApiClient';
import { ReportLocationPicker } from '@/platform/reportLocationPicker';
import { PARSED } from '@/session/valleySource';
import type { Place } from './journey';
import { Navigation } from './Navigation.web';

const api = createApiClient();

/** 판정에 쓰는 중심선 — 서버(`loadValleyCenterlines`)가 보는 첫 LineString 과 같은 것.
 * 지금 계곡 33개 모두 LineString 이 하나라 첫 구간 경로가 곧 그 중심선이다(실측).
 * 한 계곡이 구간 여럿으로 쪼개지면 여기서 모든 구간 경로를 이어야 한다.
 * 모르면 빈 배열이고, 그때는 아무것도 판정하지 않는다(서버가 거절한다). */
function centerlineOf(valley: Valley | undefined): readonly LngLat[] {
  return valley?.segments[0]?.path ?? [];
}

/** 제보 좌표가 놓일 수 있는 영역 밖인가 — 중심선에서 3km 밖(F5d 해석 4). */
function outOfRange(point: LngLat | null, valley: Valley | undefined): boolean {
  const centerline = centerlineOf(valley);
  if (point === null || centerline.length === 0) return false;
  return !isWithinReportCoordinateRadius(point, centerline);
}

/** 구간 이름만 — "중류"(복사 문자열 첫 줄이 계곡명과 따로 받는 조각, F5d 계약). */
function segmentLabelOf(
  valley: Valley | undefined,
  segmentId: string | null | undefined,
): string | undefined {
  const segment = valley?.segments.find((s) => s.id === segmentId);
  return segment === undefined ? undefined : segmentPositionLabel(segment.position);
}

/** 피커·좌표 줄이 함께 읽는 한 줄 — "조무락골 중류". */
function contextLabelOf(valley: Valley | undefined, segmentId: string | null | undefined): string {
  if (valley === undefined) return '';
  const label = segmentLabelOf(valley, segmentId);
  return label === undefined ? valley.name : `${valley.name} ${label}`;
}

const RADIUS_KM = REPORT_COORDINATE_MAX_DISTANCE_M / 1000;

/** 좌표를 보여주는 자리가 모두 쓰는 한 줄 — "조무락골 중류 · 37.983412, 127.460591". */
function CoordinateLine({
  valley,
  segmentId,
  point,
  prefix,
}: {
  valley: Valley | undefined;
  segmentId: string | null | undefined;
  point: LngLat;
  prefix?: string;
}) {
  return (
    <p>
      {prefix}
      {contextLabelOf(valley, segmentId)} · {formatReportCoordinate(point.lat, point.lng)}
    </p>
  );
}

/** 피커 아래 한 줄 — 영역 밖이면 왜 쓸 수 없는지, 안이면 어디까지 되는지. */
function RadiusNotice({ point, valley }: { point: LngLat | null; valley: Valley | undefined }) {
  return outOfRange(point, valley) ? (
    <Alert status="error" title="이 계곡에서 너무 먼 지점입니다">
      계곡 중심선에서 {RADIUS_KM}km 안의 지점만 등록할 수 있습니다.
    </Alert>
  ) : (
    <p className="ev-muted">계곡 중심선에서 {RADIUS_KM}km 안까지 지정할 수 있습니다.</p>
  );
}

type Props = { place: Place; compose: boolean; onCompose: (open: boolean) => void; risk: Status };
export function Reports({ place, compose, onCompose, risk }: Props) {
  const [items, setItems] = useState<readonly ApiReport[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ApiReport | null>(null);
  const [revision, setRevision] = useState(0);
  const [moreBusy, setMoreBusy] = useState(false);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    void revision;
    let active = true;
    setLoading(true);
    const load = async () => {
      const result = await api.reports({ valleyId: place.valley.id, limit: 30 });
      if (!active) return;
      setLoading(false);
      if (result.ok) {
        setItems(result.value.reports);
        setCursor(result.value.nextCursor);
        setError('');
      } else setError('제보를 불러오지 못했습니다.');
    };
    void load();
    const subscription = api.subscribeEvents(['report'], () => void load());
    window.addEventListener('everybody-reports-changed', refresh);
    return () => {
      active = false;
      subscription.dispose();
      window.removeEventListener('everybody-reports-changed', refresh);
    };
  }, [place.valley.id, revision, refresh]);
  const more = async () => {
    if (!cursor || moreBusy) return;
    setMoreBusy(true);
    const result = await api.reports({ valleyId: place.valley.id, limit: 30, cursor });
    setMoreBusy(false);
    if (result.ok) {
      setItems((current) => [
        ...new Map([...current, ...result.value.reports].map((r) => [r.id, r])).values(),
      ]);
      setCursor(result.value.nextCursor);
    } else setError('이전 제보를 불러오지 못했습니다. 다시 시도해주세요.');
  };
  return (
    <>
      <Button icon="message-square" onClick={() => onCompose(true)}>
        현장 제보 작성
      </Button>
      <p className="ev-muted">
        {place.valley.name}의 제보입니다. 긴급 구조는 119에 직접 요청하세요.
      </p>
      {loading && <p role="status">제보를 불러오고 있어요…</p>}
      {error && (
        <Alert
          status="error"
          title={error}
          action={
            <Button variant="ghost" onClick={refresh}>
              다시 시도
            </Button>
          }
        />
      )}
      {!loading && !error && !items.length && (
        <EmptyState
          title="아직 등록된 제보가 없어요"
          description="현장에서 확인한 내용을 이 계곡에 남겨주세요."
        />
      )}
      {items.map((report) => (
        <button
          className="ev-report"
          type="button"
          key={report.id}
          onClick={() => setSelected(report)}
        >
          <div className="ev-report-meta">
            <strong>{reportTypeLabel(report.type)}</strong>
            <span>{reportRelativeTimeLabel(report.createdAt, new Date())}</span>
          </div>
          <p>{report.body}</p>
          <span className="ev-muted">
            {report.nickname}
            {report.photos.length ? ` · 사진 ${report.photos.length}장` : ''}
          </span>
        </button>
      ))}
      {cursor && (
        <Button variant="secondary" loading={moreBusy} onClick={() => void more()}>
          이전 제보 더 보기
        </Button>
      )}
      <ReportComposer
        key={place.valley.id}
        place={place}
        open={compose}
        onClose={() => onCompose(false)}
        onComplete={(report) => {
          setItems((current) => [report, ...current.filter((r) => r.id !== report.id)]);
          onCompose(false);
        }}
        risk={risk}
      />
      {selected && (
        <ReportDetail
          key={selected.id}
          report={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

function ReportComposer({
  place,
  open,
  onClose,
  onComplete,
  risk,
}: {
  place: Place;
  open: boolean;
  onClose: () => void;
  onComplete: (report: ApiReport) => void;
  risk: Status;
}) {
  const [type, setType] = useState<ReportType>('valley-info');
  const [body, setBody] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [location, setLocation] = useState<LngLat | null>(null);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<LngLat | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const discardNavigation = useRef<(() => void) | null>(null);
  const navigation = useContext(Navigation);
  const dirty = !!(body || nickname || password || photos.length || location);
  useEffect(() => {
    if (!dirty || !open) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    if (navigation)
      navigation.current.guard = (proceed) => {
        if (submitting.current) return;
        discardNavigation.current = proceed;
        setConfirm(true);
      };
    window.addEventListener('beforeunload', prevent);
    return () => {
      window.removeEventListener('beforeunload', prevent);
      if (navigation) navigation.current.guard = null;
    };
  }, [dirty, open, navigation]);
  const close = () => {
    if (busy) return;
    if (dirty) setConfirm(true);
    else onClose();
  };
  const reset = () => {
    setBody('');
    setNickname('');
    setPassword('');
    setPhotos([]);
    setLocation(null);
    setError('');
    setType('valley-info');
  };
  const submit = async () => {
    if (submitting.current) return;
    const errors = validateReportDraft({
      type,
      body,
      nickname,
      password,
      photoCount: photos.length,
    });
    if (errors.length) {
      setError(errors.map((e) => e.reason).join(' · '));
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const uploads: ApiReportPhotoInput[] = [];
      for (const photo of photos) {
        if (!photo.file || photo.file.size > REPORT_PHOTO_MAX_BYTES)
          throw new Error('사진은 장당 5MB 이하 파일이어야 합니다.');
        uploads.push({
          data: new Uint8Array(await photo.file.arrayBuffer()),
          filename: photo.name,
          contentType: photo.file.type,
        });
      }
      const result = await api.createReport({
        valleyId: place.valley.id,
        segmentId: place.segment.id,
        type,
        body,
        nickname,
        password,
        photos: uploads,
        ...(location ? { lat: location.lat, lng: location.lng } : {}),
      });
      if (!result.ok) {
        setError(
          result.error.context['status'] === 429
            ? '등록 요청이 많습니다. 잠시 후 다시 시도해주세요. 작성 내용은 유지됩니다.'
            : '등록하지 못했습니다. 연결 상태를 확인하고 다시 시도해주세요. 작성 내용은 유지됩니다.',
        );
        return;
      }
      reset();
      window.dispatchEvent(new Event('everybody-reports-changed'));
      onComplete(result.value);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : '사진을 준비하지 못했습니다. 다시 시도해주세요.',
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <Dialog
        open={open}
        onClose={close}
        title="현장 제보 작성"
        description={`${place.valley.name}에 공개할 내용을 작성하세요.`}
        footer={
          <>
            <Button variant="secondary" disabled={busy} onClick={close}>
              취소
            </Button>
            <Button loading={busy} onClick={() => void submit()}>
              제보 등록
            </Button>
          </>
        }
      >
        <div className="ev-form">
          {(risk === 'warning' || risk === 'evacuate' || risk === 'caution') && (
            <Alert status={risk} title="현장 경보가 있습니다">
              안전을 먼저 확보하고 현장 안내를 따르세요.
            </Alert>
          )}
          <fieldset className="ev-fieldset" disabled={busy}>
            <legend>제보 유형</legend>
            <div className="ev-choice">
              {REPORT_TYPES.map((value) => (
                <Chip key={value} selected={value === type} onClick={() => setType(value)}>
                  {reportTypeLabel(value)}
                </Chip>
              ))}
            </div>
          </fieldset>
          <Field
            label="제보 내용"
            required
            multiline
            maxLength={REPORT_BODY_MAX_LENGTH}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            hint={`${body.length}/500자 · 개인 연락처 등 개인정보를 적지 마세요.`}
            disabled={busy}
          />
          <fieldset className="ev-fieldset" disabled={busy}>
            <PhotoInput
              value={photos}
              onChange={(next) => {
                if (next.some((p) => (p.file?.size ?? 0) > REPORT_PHOTO_MAX_BYTES)) {
                  next
                    .filter((p) => !photos.includes(p))
                    .forEach((p) => {
                      URL.revokeObjectURL(p.url);
                    });
                  setError('사진은 장당 5MB 이하로 선택해주세요.');
                } else setPhotos(next);
              }}
            />
          </fieldset>
          <Button
            variant="secondary"
            icon="map"
            disabled={busy}
            onClick={() => {
              setPicked(location);
              setPicking(true);
            }}
          >
            {location ? '공개 위치 변경' : '공개 위치 지정 (선택)'}
          </Button>
          {location && (
            <>
              <CoordinateLine valley={place.valley} segmentId={place.segment.id} point={location} />
              <Button variant="ghost" disabled={busy} onClick={() => setLocation(null)}>
                위치 지우기
              </Button>
            </>
          )}
          <p className="ev-muted">
            지도에서 직접 지정한 지점만 공개됩니다. 기기의 GPS 위치를 사용하지 않습니다.
          </p>
          <Field
            label="닉네임"
            required
            maxLength={20}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            disabled={busy}
            autoComplete="nickname"
          />
          <Field
            label="제보 비밀번호"
            required
            type="password"
            minLength={4}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="4자 이상 · 이 제보를 수정하거나 삭제할 때 사용합니다."
            disabled={busy}
            autoComplete="new-password"
          />
          <p className="ev-muted">
            사진은 업로드 시 위치 메타데이터를 제거합니다. 제보 등록은 119 신고가 아닙니다.
          </p>
          {error && (
            <Alert status="error" title="등록 내용을 확인해주세요">
              {error}
            </Alert>
          )}
        </div>
      </Dialog>
      <Dialog
        open={picking}
        onClose={() => setPicking(false)}
        title="공개 위치 지정"
        description="지도를 움직여 중앙 표시를 제보 지점에 맞추세요."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPicking(false)}>
              취소
            </Button>
            <Button
              disabled={!picked || outOfRange(picked, place.valley)}
              onClick={() => {
                setLocation(picked);
                setPicking(false);
              }}
            >
              이 위치 사용
            </Button>
          </>
        }
      >
        {picking && (
          <ReportLocationPicker
            initialCenter={location ?? place.segment.midpoint()}
            onChange={setPicked}
            limit={centerlineOf(place.valley)}
          />
        )}
        {picked && (
          <CoordinateLine valley={place.valley} segmentId={place.segment.id} point={picked} />
        )}
        <RadiusNotice point={picked} valley={place.valley} />
      </Dialog>
      <Dialog
        open={confirm}
        onClose={() => {
          discardNavigation.current = null;
          setConfirm(false);
        }}
        title="작성 중인 제보가 있어요"
        description="계속 작성하거나 내용을 폐기할 수 있습니다."
        destructive
        footer={
          <>
            <Button
              data-initial-focus
              autoFocus
              onClick={() => {
                discardNavigation.current = null;
                setConfirm(false);
              }}
            >
              계속 쓰기
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                reset();
                setConfirm(false);
                onClose();
                discardNavigation.current?.();
                discardNavigation.current = null;
              }}
            >
              내용 폐기
            </Button>
          </>
        }
      />
    </>
  );
}

export function ReportDetail({
  report,
  onClose,
  onChanged,
}: {
  report: ApiReport;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<'read' | 'edit' | 'delete'>('read');
  const [password, setPassword] = useState('');
  const [body, setBody] = useState(report.body);
  const [type, setType] = useState(report.type);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  /** 저장된 공개 지점 — 표시·복사와 위치 수정 초기값이 같은 값을 읽는다. */
  const published =
    report.lat !== undefined && report.lng !== undefined ? LngLat.of(report.lng, report.lat) : null;
  const [location, setLocation] = useState<LngLat | null>(published);
  const [picked, setPicked] = useState<LngLat | null>(null);
  const [picking, setPicking] = useState(false);
  const locked = useRef(false);
  const valley = PARSED.ok ? PARSED.value.valleys.find((v) => v.id === report.valleyId) : undefined;

  const mutate = async () => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    const result =
      mode === 'delete'
        ? await api.deleteReport(report.id, password)
        : await api.updateReport(report.id, {
            password,
            body,
            type,
            lat: location?.lat ?? null,
            lng: location?.lng ?? null,
          });
    locked.current = false;
    setBusy(false);
    if (result.ok) {
      window.dispatchEvent(new Event('everybody-reports-changed'));
      onChanged();
    } else setMessage('처리하지 못했습니다. 비밀번호와 연결 상태를 확인해주세요.');
  };
  const flag = async () => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    const result = await api.flagReport(report.id);
    locked.current = false;
    setBusy(false);
    setMessage(
      result.ok ? '운영 신고가 접수되었습니다.' : '신고 접수에 실패했습니다. 다시 시도해주세요.',
    );
  };
  return (
    <>
      <Dialog
        open
        onClose={() => {
          if (!busy) onClose();
        }}
        title={mode === 'edit' ? '제보 수정' : mode === 'delete' ? '제보 삭제' : '현장 제보'}
        footer={
          mode === 'read' ? (
            <Button variant="secondary" loading={busy} onClick={() => void flag()}>
              운영자에게 신고
            </Button>
          ) : (
            <>
              <Button variant="secondary" disabled={busy} onClick={() => setMode('read')}>
                취소
              </Button>
              <Button
                variant={mode === 'delete' ? 'danger' : 'primary'}
                loading={busy}
                onClick={() => void mutate()}
              >
                {mode === 'delete' ? '삭제 확인' : '수정 저장'}
              </Button>
            </>
          )
        }
      >
        <div className="ev-form">
          <Badge>{reportTypeLabel(report.type)}</Badge>
          <div className="ev-report-meta">
            <span>{report.nickname}</span>
            <time dateTime={report.createdAt}>
              {new Date(report.createdAt).toLocaleString('ko-KR')}
            </time>
          </div>
          {mode === 'edit' ? (
            <>
              <div className="ev-choice">
                {REPORT_TYPES.map((value) => (
                  <Chip key={value} selected={type === value} onClick={() => setType(value)}>
                    {reportTypeLabel(value)}
                  </Chip>
                ))}
              </div>
              <Field
                disabled={busy}
                label="수정 내용"
                multiline
                required
                value={body}
                maxLength={500}
                onChange={(e) => setBody(e.target.value)}
              />
              {valley && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setPicked(location);
                    setPicking(true);
                  }}
                >
                  공개 위치 변경
                </Button>
              )}
              {location && (
                <>
                  <CoordinateLine valley={valley} segmentId={report.segmentId} point={location} />
                  <Button variant="ghost" disabled={busy} onClick={() => setLocation(null)}>
                    공개 위치 지우기
                  </Button>
                </>
              )}
            </>
          ) : (
            <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{report.body}</p>
          )}
          <div className="ev-photos">
            {report.photos.map((p, i) => (
              <img key={p.id} src={reportPhotoUrl(p.url)} alt={`현장 제보 사진 ${i + 1}`} />
            ))}
          </div>
          {published && (
            <>
              <CoordinateLine
                valley={valley}
                segmentId={report.segmentId}
                point={published}
                prefix="공개 지점: "
              />
              <Button
                variant="ghost"
                icon="copy"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(
                      reportCoordinateCopyText(
                        valley?.name ?? '',
                        segmentLabelOf(valley, report.segmentId),
                        published.lat,
                        published.lng,
                      ),
                    )
                    .then(() => setMessage('좌표를 복사했습니다.'))
                    .catch(() =>
                      setMessage('복사하지 못했습니다. 좌표를 직접 선택해 복사해주세요.'),
                    );
                }}
              >
                공개 좌표 복사
              </Button>
            </>
          )}
          {mode === 'read' ? (
            <div className="ev-choice">
              <Button variant="ghost" onClick={() => setMode('edit')}>
                내 제보 수정
              </Button>
              <Button variant="ghost" onClick={() => setMode('delete')}>
                내 제보 삭제
              </Button>
            </div>
          ) : (
            <>
              <Field
                label="제보 비밀번호"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode === 'delete' && (
                <Alert status="warning">삭제한 제보는 복구할 수 없습니다.</Alert>
              )}
            </>
          )}
          {message && <p role="status">{message}</p>}
          <p className="ev-muted">긴급 구조가 필요하면 제보 대신 119로 전화하세요.</p>
        </div>
      </Dialog>
      <Dialog
        open={picking}
        title="공개 위치 변경"
        description="지도에서 새 제보 지점을 직접 지정하세요."
        onClose={() => setPicking(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPicking(false)}>
              취소
            </Button>
            <Button
              disabled={!picked || outOfRange(picked, valley)}
              onClick={() => {
                setLocation(picked);
                setPicking(false);
              }}
            >
              이 위치 사용
            </Button>
          </>
        }
      >
        {picking && valley && (
          <ReportLocationPicker
            initialCenter={location ?? valley.center()}
            onChange={setPicked}
            limit={centerlineOf(valley)}
          />
        )}
        {picked && <CoordinateLine valley={valley} segmentId={report.segmentId} point={picked} />}
        <RadiusNotice point={picked} valley={valley} />
      </Dialog>
    </>
  );
}
