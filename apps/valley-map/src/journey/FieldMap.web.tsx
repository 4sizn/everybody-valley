import {
  alertConfidenceLabel,
  alertLevelLabel,
  bedLabel,
  clampShadeHourIndex,
  depthLabel,
  FACILITY_NEARBY_M,
  FACILITY_TYPES,
  facilitySummary,
  facilityTypeLabel,
  InMemoryValleyRepository,
  type LandParcel,
  lookupFacility,
  lookupSegment,
  parseLandParcels,
  type SceneSource,
  type SheetSnap,
  segmentPositionLabel,
  VALLEY_INITIAL_VIEW,
} from '@modu-valley/core';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  EmptyState,
  FacilityRow,
  IconButton,
  MapSheet,
  MapTool,
  Metric,
  type Status,
  Tabs,
} from '@moduvalley/ui';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { resolveApiBase } from '@/api/createApiClient';
import { DIRECTIONS_PROVIDERS } from '@/components/valley/directions';
import { SessionProvider, useAppState, useSession, useSessionRestart } from '@/session';
import { PARSED, VALLEY_SOURCE } from '@/session/valleySource';
import { BlogSection, type DiscoveryState } from './Discovery.web';
import { journeySearch, type Place } from './journey';
import { LandLegend, type LandStatus } from './LandLegend.web';
import { Navigation } from './Navigation.web';
import { Reports } from './Reports.web';
import { ShadeHourTrack } from './ShadeHourTrack.web';
import { useWeather } from './useWeather';

type Props = {
  place: Place;
  initialSheet: SheetSnap;
  initialHour: number;
  discovery: DiscoveryState;
  onPlace: (place: Place) => void;
  onLeave: () => void;
  onSafety: () => void;
  onSettings: () => void;
};
export function FieldMap(props: Props) {
  const center = useMemo(() => props.place.valley.center(), [props.place.valley]);
  const source = useMemo<SceneSource>(
    () =>
      PARSED.ok
        ? {
            scene: 'valley',
            valleyRepository: new InMemoryValleyRepository({
              ...PARSED.value,
              valleys: [props.place.valley],
            }),
          }
        : VALLEY_SOURCE,
    [props.place.valley],
  );
  return (
    <section className="ev-map" aria-label="선택 계곡 지도">
      <SessionProvider
        preserveSelection
        source={source}
        initialCenter={center}
        initialView={VALLEY_INITIAL_VIEW}
      >
        <MapChrome {...props} />
      </SessionProvider>
    </section>
  );
}
function MapChrome({
  place,
  initialSheet,
  initialHour,
  discovery,
  onPlace,
  onLeave,
  onSafety,
  onSettings,
}: Props) {
  const session = useSession();
  const navigation = useContext(Navigation);
  const restart = useSessionRestart();
  const status = useAppState((s) => s.status);
  const state = useAppState((s) => s);
  const [sheet, setSheet] = useState<SheetSnap>(initialSheet);
  const [tab, setTab] = useState('segment');
  const [overlay, setOverlay] = useState<'shade' | 'land' | null>(null);
  const [hour, setHour] = useState(initialHour);
  const [composer, setComposer] = useState(false);
  const [landStatus, setLandStatus] = useState<LandStatus>('loading');
  const [landRetry, setLandRetry] = useState(0);
  const [top, setTop] = useState(180);
  const [directions, setDirections] = useState(false);
  const [controls, setControls] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const initialized = useRef<typeof session | null>(null);
  const selecting = useRef(false);
  const weather = useWeather(place.valley.id);
  const alert = weather.value?.alert;
  const risk: Status =
    alert?.level === 'watch'
      ? 'caution'
      : (alert?.level ?? (weather.error ? 'error' : weather.value?.stale ? 'stale' : 'unknown'));
  const weatherTitle = alert
    ? `상류 강우 ${alertLevelLabel(alert.level)} · ${alertConfidenceLabel(alert.confidence)}`
    : weather.error
      ? '관측 정보를 불러오지 못했어요'
      : weather.value?.stale
        ? '관측 자료가 지연되고 있어요'
        : weather.value?.lastObservedAt
          ? '현재 활성 경보 없음'
          : '강우 판단 자료가 없습니다';
  const observed = weather.value?.lastObservedAt;
  useEffect(() => {
    if (status !== 'ready' || initialized.current === session) return;
    initialized.current = session;
    session.setShadeHour(clampShadeHourIndex(hour - 10));
    session.setSheetSnap(sheet);
    selecting.current = true;
    void (
      place.facility
        ? session.selectFacility(place.facility.id)
        : session.selectSegment(place.segment.id)
    ).finally(() => {
      selecting.current = false;
      void session.recenterSelection();
    });
  }, [session, status, hour, sheet, place]);
  useEffect(() => {
    if (status !== 'ready' || selecting.current) return;
    const valleys = state.valleys ?? [];
    if (state.selectedFacilityId && state.selectedFacilityId !== place.facility?.id) {
      const match = lookupFacility(valleys, state.selectedFacilityId);
      if (match.ok) {
        const segment = match.value.valley.segments[0];
        if (segment) {
          onPlace({ valley: match.value.valley, segment, facility: match.value.facility });
          setSheet('half');
        }
      }
    } else if (
      state.selectedSegmentId &&
      (state.selectedSegmentId !== place.segment.id || place.facility)
    ) {
      const match = lookupSegment(valleys, state.selectedSegmentId);
      if (match.ok) onPlace({ valley: match.value.valley, segment: match.value.segment });
    }
  }, [state.selectedFacilityId, state.selectedSegmentId, state.valleys, status, place, onPlace]);
  useEffect(() => {
    window.history.replaceState(null, '', journeySearch(place, sheet, hour));
    if (navigation) navigation.current.url = window.location.href;
  }, [place, sheet, hour, navigation]);
  useEffect(() => {
    let moveTimer: ReturnType<typeof setTimeout>;
    const measure = () => {
      const topHeight = (topRef.current?.getBoundingClientRect().bottom ?? 168) + 12;
      const sheetElement = sheetRef.current?.querySelector('.mv-map-sheet');
      const bottom = sheetElement?.getBoundingClientRect().height ?? 158;
      setTop(topHeight);
      session.setViewportInsets({ top: topHeight, bottom });
      session.setSheetSnap(sheet);
      clearTimeout(moveTimer);
      if (sheet !== 'full')
        moveTimer = setTimeout(() => {
          void session.recenterSelection();
        }, 220);
    };
    const observer = new ResizeObserver(measure);
    if (topRef.current) observer.observe(topRef.current);
    const sheetElement = sheetRef.current?.querySelector('.mv-map-sheet');
    if (sheetElement) observer.observe(sheetElement);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      clearTimeout(moveTimer);
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [session, sheet]);
  useEffect(() => {
    if (status !== 'ready') return;
    const shouldShow = overlay === 'shade';
    if (session.store.state.shadeVisible !== shouldShow) void session.toggleShade();
    session.setShadeHour(clampShadeHourIndex(hour - 10));
  }, [overlay, hour, status, session]);
  useEffect(() => {
    session.setLandParcels([]);
    if (overlay !== 'land' || status !== 'ready') return;
    const controller = new AbortController();
    setLandStatus('loading');
    void landRetry;
    void fetch(`${resolveApiBase()}/api/land/${encodeURIComponent(place.valley.id)}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('조회 실패');
        const data = (await response.json()) as { parcels: LandParcel[]; partial: boolean };
        const codes = { individual: '01', organization: '06', public: '02', unknown: 'ZZ' };
        const parcels = parseLandParcels({
          features: data.parcels.map((p) => ({
            geometry: { type: 'Polygon', coordinates: p.coordinates },
            properties: { posesn_se_code: codes[p.ownership] },
          })),
        });
        if (controller.signal.aborted) return;
        session.setLandParcels(parcels);
        setLandStatus(parcels.length ? (data.partial ? 'partial' : 'ready') : 'empty');
      })
      .catch(() => {
        if (!controller.signal.aborted) setLandStatus('error');
      });
    return () => {
      controller.abort();
      session.setLandParcels([]);
    };
  }, [session, status, overlay, place.valley.id, landRetry]);
  const select = async (next: Place) => {
    selecting.current = true;
    const result = await (next.facility
      ? session.selectFacility(next.facility.id)
      : session.selectSegment(next.segment.id));
    if (result.ok) {
      void session.recenterSelection();
      onPlace(next);
      setSheet(next.facility ? 'half' : 'peek');
    }
    selecting.current = false;
  };
  const backToValley = () => {
    setTab('segment');
    void select({ valley: place.valley, segment: place.segment });
  };
  useEffect(() => {
    if (place.facility) setOverlay(null);
  }, [place.facility]);
  const title = place.facility?.name ?? place.valley.name;
  const around = useMemo(() => place.valley.facilitiesAround(), [place.valley]);
  const destination = place.facility?.position ?? place.segment.midpoint();
  const shade = state.valleyShade?.get(place.valley.id);
  return (
    <div className="ev-map-chrome">
      <div className="app-map-top ev-map-top" ref={topRef}>
        <header className="map-place-header ev-selected">
          <IconButton
            icon="arrow-left"
            label={place.facility ? '계곡 지도로 돌아가기' : '선택 해제하고 탐색으로'}
            onClick={place.facility ? backToValley : onLeave}
          />
          <div className="ev-selected-title">
            <h1>{title}</h1>
          </div>
          <IconButton
            icon="x"
            label={place.facility ? '시설 선택 해제' : '선택 해제'}
            onClick={place.facility ? backToValley : onLeave}
          />
        </header>
        <Alert status={risk} title={weatherTitle}>
          {observed
            ? `${new Date(observed).toLocaleString('ko-KR')} 관측 · 현장 안내 우선`
            : '자료 없음은 안전을 뜻하지 않습니다.'}
          {weather.error && alert
            ? ' · 갱신 실패, 이전 경보 유지'
            : weather.value?.stale && alert
              ? ' · 갱신 지연, 이전 경보 유지'
              : ''}
        </Alert>
        {state.baseMapHealth.outage && (
          <Alert
            status="error"
            title="배경 지도를 불러오지 못했습니다"
            action={
              <Button variant="ghost" onClick={() => session.retryBaseMap()}>
                다시 시도
              </Button>
            }
          >
            구간 정보와 시설 목록을 이용할 수 있습니다.
          </Alert>
        )}
      </div>
      {sheet === 'peek' && !place.facility && (
        <div className="ev-map-tools" style={{ top: top + 4 }}>
          <MapTool
            icon="tree-pine"
            label="그늘"
            selected={overlay === 'shade'}
            onClick={() => {
              setOverlay(overlay === 'shade' ? null : 'shade');
              setSheet('peek');
            }}
          />
          <MapTool
            icon="square-parking"
            label="시설"
            onClick={() => {
              setTab('facilities');
              setSheet('half');
            }}
          />
          <MapTool
            icon="layers"
            label="토지"
            selected={overlay === 'land'}
            onClick={() => setOverlay(overlay === 'land' ? null : 'land')}
          />
          <MapTool
            icon="message-square"
            label="제보"
            onClick={() => {
              setTab('reports');
              setSheet('half');
            }}
          />
          <IconButton icon="settings-2" label="지도 조작" onClick={() => setControls(true)} />
        </div>
      )}
      {status === 'failed' ? (
        <div className="ev-loading">
          <EmptyState
            title="지도를 준비하지 못했어요"
            description="연결 상태를 확인하고 다시 시도해주세요."
            action={<Button onClick={restart}>지도 다시 시도</Button>}
          />
          <Button variant="ghost" onClick={onLeave}>
            계곡 탐색으로 돌아가기
          </Button>
        </div>
      ) : status !== 'ready' ? (
        <div className="ev-loading" role="status">
          선택한 계곡 지도를 준비하고 있어요…
        </div>
      ) : null}
      {overlay === 'shade' && sheet === 'peek' && (
        <ShadeHourTrack value={hour} onChange={setHour} />
      )}
      {overlay === 'land' && sheet === 'peek' && (
        <LandLegend status={landStatus} onRetry={() => setLandRetry((v) => v + 1)} />
      )}
      <div ref={sheetRef}>
        <MapSheet
          state={sheet}
          onChange={setSheet}
          topInset={top}
          title={title}
          subtitle={
            place.facility
              ? `${facilityTypeLabel(place.facility.facilityType)} · ${place.valley.name}`
              : `${segmentPositionLabel(place.segment.position)} · 주변 시설 ${around.nearby.length}곳`
          }
          actions={
            alert?.level === 'evacuate' ? (
              <>
                <Button variant="danger" icon="triangle-alert" onClick={onSafety}>
                  대피 안내
                </Button>
                <Button
                  variant="secondary"
                  icon="phone"
                  onClick={() => {
                    window.location.href = 'tel:119';
                  }}
                >
                  119 전화
                </Button>
              </>
            ) : place.facility ? (
              <>
                <Button icon="navigation" onClick={() => setDirections(true)}>
                  길찾기
                </Button>
                <Button variant="secondary" icon="map" onClick={backToValley}>
                  계곡으로 돌아가기
                </Button>
              </>
            ) : (
              <>
                <Button
                  icon="tree-pine"
                  onClick={() => {
                    setOverlay(overlay === 'shade' ? null : 'shade');
                    setSheet('peek');
                  }}
                >
                  그늘 {overlay === 'shade' ? '끄기' : '확인'}
                </Button>
                <Button
                  variant="secondary"
                  icon="info"
                  onClick={() => {
                    setTab('segment');
                    setSheet(sheet === 'peek' ? 'half' : 'peek');
                  }}
                >
                  {sheet === 'peek' ? '구간 정보' : '지도 크게'}
                </Button>
              </>
            )
          }
        >
          {place.facility ? (
            <section className="ev-sheet-stack" aria-label={`${title} 시설 정보`}>
              <h3>이용 정보</h3>
              <dl className="ev-facility-facts">
                <div>
                  <dt>운영시간</dt>
                  <dd>{place.facility.operatingHours ?? '미확인'}</dd>
                </div>
                <div>
                  <dt>이용 요금</dt>
                  <dd>{place.facility.feeNote ?? '미확인'}</dd>
                </div>
                {place.facility.capacity !== undefined && (
                  <div>
                    <dt>{place.facility.facilityType === 'parking' ? '주차 면수' : '수용 규모'}</dt>
                    <dd>{place.facility.capacity}</dd>
                  </div>
                )}
                {place.facility.nationalPointNumber && (
                  <div>
                    <dt>국가지점번호</dt>
                    <dd>{place.facility.nationalPointNumber}</dd>
                  </div>
                )}
              </dl>
              <p className="ev-muted">운영 여부와 이용 조건은 방문 전에 시설에 확인해주세요.</p>
            </section>
          ) : (
            <div className="ev-sheet-stack">
              <Tabs
                label="현장 정보"
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'segment', label: '구간 정보' },
                  { value: 'facilities', label: '주변 시설' },
                  { value: 'blogs', label: '방문 후기' },
                  { value: 'rain', label: '강우' },
                  { value: 'reports', label: '현장 제보' },
                ]}
              />
              {tab === 'segment' && (
                <>
                  <div className="ev-choice">
                    {place.valley.segments.map((s) => (
                      <Chip
                        key={s.id}
                        selected={s.id === place.segment.id && !place.facility}
                        onClick={() => void select({ valley: place.valley, segment: s })}
                      >
                        {segmentPositionLabel(s.position)}
                      </Chip>
                    ))}
                  </div>
                  <div className="app-metrics">
                    <Metric
                      label="수심"
                      value={place.segment.depth ? depthLabel(place.segment.depth) : '미확인'}
                      icon="waves"
                    />
                    <Metric
                      label="바닥"
                      value={place.segment.bed ? bedLabel(place.segment.bed) : '미확인'}
                    />
                    <Metric
                      label="그늘 비율"
                      value={
                        place.segment.shadeByHour?.[hour - 10] === undefined
                          ? '미확인'
                          : `${Math.round((place.segment.shadeByHour[hour - 10] ?? 0) * 100)}% · 추정`
                      }
                      icon="tree-pine"
                    />
                    <Metric label="구간 길이" value={place.segment.length().format()} />
                  </div>
                  <p>{place.segment.riskNote ?? '이용 조건과 현장 통제를 방문 전에 확인하세요.'}</p>
                  <Button
                    variant="secondary"
                    icon="tree-pine"
                    onClick={() => {
                      setOverlay('shade');
                      setSheet('peek');
                    }}
                  >
                    시간별 그늘 보기
                  </Button>
                  <Button
                    variant="ghost"
                    icon="layers"
                    onClick={() => {
                      setOverlay('land');
                      setSheet('peek');
                    }}
                  >
                    토지 경계 보기
                  </Button>
                  <Button variant="secondary" icon="navigation" onClick={() => setDirections(true)}>
                    선택 구간 길찾기
                  </Button>
                  <Button
                    variant="secondary"
                    icon="message-square"
                    onClick={() => {
                      setTab('reports');
                      setComposer(true);
                    }}
                  >
                    현장 제보 작성
                  </Button>
                  <p className="ev-muted">
                    자료 출처: {state.valleyMetadata?.description ?? '계곡·시설 수집 자료'}. 그늘은{' '}
                    {shade?.metadata.source ?? '지형·수관 모델'} 기반 추정입니다.
                  </p>
                </>
              )}
              {tab === 'facilities' && (
                <>
                  {place.valley.facilities.length > 0 && (
                    <p className="ev-muted">{facilitySummary(around.nearby)}</p>
                  )}
                  {FACILITY_TYPES.map((type) => {
                    const items = around.nearby.filter((f) => f.facility.facilityType === type);
                    if (items.length === 0) return null;
                    return (
                      <section key={type} aria-label={facilityTypeLabel(type)}>
                        <h4>
                          {facilityTypeLabel(type)} {items.length}
                        </h4>
                        {items.map(({ facility, distance, alsoHere }) => (
                          <FacilityRow
                            key={facility.id}
                            name={
                              alsoHere?.length
                                ? `${facility.name} 외 ${alsoHere.length}곳 같은 자리`
                                : facility.name
                            }
                            type={facilityTypeLabel(type)}
                            valley={
                              facility.operatingHours
                                ? `물가에서 ${distance.format()} · ${facility.operatingHours}`
                                : `물가에서 ${distance.format()}`
                            }
                            onClick={() => void select({ ...place, facility })}
                          />
                        ))}
                      </section>
                    );
                  })}
                  {around.onTheWay.length > 0 && (
                    <section aria-label="가는 길에">
                      <h4>가는 길에 · 물가에서 {FACILITY_NEARBY_M} m 밖</h4>
                      {around.onTheWay.map(({ facility, distance, alsoHere }) => (
                        <FacilityRow
                          key={facility.id}
                          name={
                            alsoHere?.length
                              ? `${facility.name} 외 ${alsoHere.length}곳 같은 자리`
                              : facility.name
                          }
                          type={facilityTypeLabel(facility.facilityType)}
                          valley={`물가에서 ${distance.format()}`}
                          onClick={() => void select({ ...place, facility })}
                        />
                      ))}
                    </section>
                  )}
                  {!place.valley.facilities.length && (
                    <EmptyState
                      title="등록된 시설이 없어요"
                      description="주차장·화장실 표준데이터와 OSM 을 조회했지만 없었습니다. 등록 없음이 현장에 없음은 아닙니다 — 현장 안내를 확인하세요."
                    />
                  )}
                </>
              )}
              {tab === 'rain' && (
                <>
                  <Alert status={risk} title={weatherTitle}>
                    {observed
                      ? `마지막 관측: ${new Date(observed).toLocaleString('ko-KR')}`
                      : '관측 시각 미확인'}
                  </Alert>
                  <div className="app-metrics">
                    <Metric
                      label="1시간 강우"
                      value={
                        alert?.rainfall1hMm === undefined ? '자료 없음' : `${alert.rainfall1hMm} mm`
                      }
                      icon="cloud-rain"
                    />
                    <Metric
                      label="3시간 강우"
                      value={
                        alert?.rainfall3hMm === undefined ? '자료 없음' : `${alert.rainfall3hMm} mm`
                      }
                    />
                  </div>
                  <p className="ev-muted">
                    관측소·유역 기준 정보이며 현장 안전이나 입수 가능을 보장하지 않습니다.
                  </p>
                  <Button variant="secondary" onClick={weather.refresh}>
                    관측 정보 새로고침
                  </Button>
                  <Button variant="ghost" onClick={onSafety}>
                    계곡 이용 안전 안내
                  </Button>
                </>
              )}
              {tab === 'reports' && (
                <Reports place={place} compose={composer} onCompose={setComposer} risk={risk} />
              )}
              {tab === 'blogs' && (
                <BlogSection discovery={discovery} valleys={[place.valley]} valley={place.valley} />
              )}
            </div>
          )}
        </MapSheet>
      </div>
      <Dialog
        open={controls}
        onClose={() => setControls(false)}
        title="지도 조작"
        footer={<Button onClick={() => setControls(false)}>지도 보기</Button>}
      >
        <div className="ev-form">
          <div className="ev-choice">
            <Button variant="secondary" icon="plus" onClick={() => void session.zoomIn()}>
              확대
            </Button>
            <Button variant="secondary" icon="minus" onClick={() => void session.zoomOut()}>
              축소
            </Button>
            <Button variant="secondary" icon="mountain" onClick={() => void session.togglePitch()}>
              {(state.camera?.pitch ?? 0) > 0 ? '2D 평면으로' : '3D 지형으로'}
            </Button>
            <Button variant="secondary" icon="compass" onClick={() => void session.alignNorth()}>
              북쪽 정렬
            </Button>
            <Button
              variant="secondary"
              icon="locate-fixed"
              onClick={() => {
                void session.recenterSelection();
                setControls(false);
              }}
            >
              선택 장소로
            </Button>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setControls(false);
              onSettings();
            }}
          >
            화면 테마 설정
          </Button>
          <Button variant="ghost" onClick={onSafety}>
            계곡 이용 안전 안내
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={directions}
        onClose={() => setDirections(false)}
        title={place.facility ? '시설 길찾기' : '선택 구간 길찾기'}
        footer={DIRECTIONS_PROVIDERS.map((provider, index) => (
          <Button
            key={provider.id}
            variant={index === 0 ? 'primary' : 'secondary'}
            aria-label={`길찾기 · ${provider.name}`}
            onClick={() =>
              window.open(provider.url(destination, title), '_blank', 'noopener,noreferrer')
            }
          >
            {provider.label}
          </Button>
        ))}
      >
        <h3>{title}</h3>
        <p>
          {destination.lat.toFixed(6)}, {destination.lng.toFixed(6)}
        </p>
        <p>사용할 지도 앱을 고르세요. 도착지 주변 통제와 실제 진입로를 확인하세요.</p>
      </Dialog>
    </div>
  );
}
