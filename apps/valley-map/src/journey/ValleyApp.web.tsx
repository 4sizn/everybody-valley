import {
  depthLabel,
  FILTER_CHIPS,
  type FilterChipKey,
  facilityTypeLabel,
  filterValleys,
  searchCatalog,
  segmentPositionLabel,
  type Valley,
} from '@modu-valley/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  FacilityRow,
  Icon,
  IconButton,
  type IconName,
  IconProvider,
  Metric,
  SearchField,
  ValleyCard,
} from '@moduvalley/ui';
import '@moduvalley/ui/styles.css';
import { useEffect, useRef, useState } from 'react';
import { resolveApiBase } from '@/api/createApiClient';
import { PARSED } from '@/session/valleySource';
import { useTheme } from '@/theme/ThemeProvider';
import { BlogSection, DiscoveryHome, useDiscovery } from './Discovery.web';
import { FieldMap } from './FieldMap.web';
import { FoliageLeaf } from './FoliageLeaf.web';
import {
  isStoriesUrl,
  journeySearch,
  type Place,
  parseJourneyLink,
  placeForValley,
  STORIES_SEARCH,
} from './journey';
import { type JourneyNavigation, Navigation } from './Navigation.web';
import { SettingsDialog } from './SettingsDialog.web';
import { useAccess } from './useAccess';
import { useFoliage } from './useFoliage';
import './reference.css';
import './journey.css';

const valleys = PARSED.ok ? PARSED.value.valleys : [];
const filterIcons: Record<FilterChipKey, IconName> = {
  restroom: 'toilet',
  parking: 'square-parking',
  freeAccess: 'banknote',
  camping: 'tent',
  shadeMany: 'tree-pine',
};

/** 미리보기 주차장 한 줄 — 물가 800 m 안이면 거리, 그 밖에만 있으면 "가는 길에", 없으면 등록 없음. */
function parkingLabel(valley: Valley): string {
  const around = valley.facilitiesAround();
  const near = around.nearby.find((f) => f.facility.facilityType === 'parking');
  if (near) return `물가에서 ${near.distance.format()}`;
  const far = around.onTheWay.find((f) => f.facility.facilityType === 'parking');
  if (far) return `가는 길에 ${far.distance.format()}`;
  return '등록 없음';
}

export function ValleyApp() {
  const theme = useTheme();
  const discovery = useDiscovery();
  const navigation = useRef<JourneyNavigation>({
    url: typeof window === 'undefined' ? '/' : window.location.href,
    guard: null,
  });
  // Static HTML and the first client render must agree; restore the public URL after hydration.
  const [initial] = useState(() => parseJourneyLink('', valleys));
  const [place, setPlace] = useState<Place | null>(initial.place);
  const [candidate, setCandidate] = useState<Place | null>(null);
  const foliage = useFoliage(candidate?.valley.id ?? '');
  const access = useAccess(candidate?.valley.id ?? '');
  const [page, setPage] = useState<'home' | 'explore' | 'blog'>(initial.place ? 'explore' : 'home');
  const [query, setQuery] = useState('');
  const [storyValley, setStoryValley] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReadonlySet<FilterChipKey>>(new Set());
  const [dialog, setDialog] = useState<'settings' | 'safety' | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const scrollPosition = useRef(0);
  const [link, setLink] = useState(initial);
  const selectedValleyId = place?.valley.id;
  useEffect(() => {
    if (!selectedValleyId) return;
    void fetch(
      `${resolveApiBase()}/api/discovery/interest/${encodeURIComponent(selectedValleyId)}`,
      { method: 'POST' },
    )
      .then((r) => {
        if (r.ok) discovery.refresh();
      })
      .catch(() => {});
  }, [selectedValleyId, discovery.refresh]);
  useEffect(() => {
    const restored = parseJourneyLink(window.location.search, valleys);
    setPlace(restored.place);
    setLink(restored);
    if (restored.place) setPage('explore');
    else if (isStoriesUrl(window.location.search)) setPage('blog');
    const pop = () => {
      const target = window.location.href;
      const next = parseJourneyLink(window.location.search, valleys);
      const proceed = () => {
        window.history.replaceState(null, '', target);
        navigation.current.url = target;
        setPlace(next.place);
        setCandidate(null);
        setLink(next);
        // 주소가 화면을 정한다 — 뒤로가기로 목록에 되돌아오거나 홈으로 빠져나온다.
        if (!next.place) setPage(isStoriesUrl(window.location.search) ? 'blog' : 'home');
      };
      if (navigation.current.guard) {
        window.history.pushState(null, '', navigation.current.url);
        navigation.current.guard(proceed);
      } else proceed();
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => {
    if (!place && !candidate && scroll.current) scroll.current.scrollTop = scrollPosition.current;
  }, [place, candidate]);
  const remember = () => {
    scrollPosition.current = scroll.current?.scrollTop ?? scrollPosition.current;
  };
  const preview = (valley: Valley) => {
    remember();
    setCandidate(placeForValley(valley));
  };
  /** 목록은 홈 아래 화면이다 — 탭을 만들지 않고 주소만 남겨 뒤로가기·공유·새로고침이 살아 있게 한다. */
  const openStories = () => {
    remember();
    setPage('blog');
    if (scroll.current) scroll.current.scrollTop = 0;
    window.history.pushState(null, '', STORIES_SEARCH);
    navigation.current.url = window.location.href;
  };
  const closeStories = () => {
    setPage('home');
    setStoryValley(null);
    window.history.pushState(null, '', window.location.pathname);
    navigation.current.url = window.location.href;
  };
  const choose = (next: Place) => {
    remember();
    setPlace(next);
    setCandidate(null);
    setLink({ place: next, sheet: 'peek', hour: link.hour });
    window.history.pushState(null, '', journeySearch(next, 'peek', link.hour));
    navigation.current.url = window.location.href;
  };
  const leave = () => {
    setPlace(null);
    setCandidate(null);
    window.history.pushState(null, '', window.location.pathname);
    navigation.current.url = window.location.href;
  };
  const storyValleys = valleys.filter((v) =>
    discovery.feed?.stories.some((s) => s.kind === 'blog' && s.valleyId === v.id),
  );
  const results = query.trim() ? searchCatalog(valleys, query) : [];
  const visible = filterValleys(valleys, filters).valleys;
  return (
    <Navigation.Provider value={navigation}>
      <IconProvider baseUrl="/moduvalley/icons">
        <div className="mv-system ev-app" data-theme={theme.mode}>
          {place ? (
            <FieldMap
              place={place}
              initialSheet={link.sheet}
              initialHour={link.hour}
              discovery={discovery}
              onPlace={setPlace}
              onLeave={leave}
              onSafety={() => setDialog('safety')}
              onSettings={() => setDialog('settings')}
            />
          ) : (
            <main
              className={`journey-app ev-discovery ${query && !candidate ? 'journey-app--search' : ''}`}
            >
              {candidate ? (
                <>
                  <header className="app-page-header">
                    <IconButton
                      label="탐색으로 돌아가기"
                      icon="arrow-left"
                      onClick={() => setCandidate(null)}
                    />
                    <h1>계곡 미리보기</h1>
                  </header>
                  <div className="app-scroll candidate-body">
                    <Badge status="unknown">현장 이용 정보 확인 필요</Badge>
                    <h2>{candidate.valley.name}</h2>
                    <p>
                      {candidate.valley.segments.length}개 구간 ·{' '}
                      {candidate.valley.facilities.length}개 시설
                    </p>
                    <Card>
                      <h3>방문 전 확인할 정보</h3>
                      <div className="app-metrics">
                        <Metric
                          label="수심"
                          value={
                            candidate.segment.depth ? depthLabel(candidate.segment.depth) : '미확인'
                          }
                          icon="waves"
                        />
                        <Metric
                          label="입장료"
                          value={
                            candidate.segment.freeAccess === true
                              ? '무료 개방'
                              : candidate.segment.freeAccess === false
                                ? '유료'
                                : '미확인'
                          }
                          icon="banknote"
                        />
                        <Metric
                          label="주차장"
                          value={parkingLabel(candidate.valley)}
                          icon="square-parking"
                        />
                        <Metric
                          label="야영"
                          value={
                            candidate.segment.campingAllowed === true
                              ? '가능 · 현장 확인'
                              : candidate.segment.campingAllowed === false
                                ? '불가'
                                : '미확인'
                          }
                          icon="tent"
                        />
                        {foliage.inSeason && (
                          <div className="mv-metric">
                            <FoliageLeaf stage={foliage.stage} />
                            <span>단풍</span>
                            <strong>{foliage.line ?? '관측 지점 없음'}</strong>
                          </div>
                        )}
                        {access.line && (
                          <Metric
                            label="입산"
                            value={access.line}
                            icon={access.status === 'closed' ? 'triangle-alert' : 'shield-check'}
                          />
                        )}
                      </div>
                    </Card>
                    <section>
                      <h3>이용 구간</h3>
                      <div className="mv-inline">
                        {candidate.valley.segments.map((s) => (
                          <Chip
                            key={s.id}
                            selected={s.id === candidate.segment.id}
                            onClick={() => setCandidate({ valley: candidate.valley, segment: s })}
                          >
                            {segmentPositionLabel(s.position)}
                          </Chip>
                        ))}
                      </div>
                    </section>
                    <Alert
                      status={candidate.segment.swimBanned ? 'warning' : 'unknown'}
                      title={
                        candidate.segment.swimBanned
                          ? '물놀이 금지 구간'
                          : '현장 통제와 공식 안내를 확인하세요'
                      }
                    >
                      {candidate.segment.riskNote ??
                        '미확인 정보는 이용 가능이나 안전을 뜻하지 않습니다.'}
                    </Alert>
                    <p className="ev-muted">
                      선택하면 {candidate.valley.name}{' '}
                      {segmentPositionLabel(candidate.segment.position)} 지도를 엽니다.
                    </p>
                    <BlogSection
                      discovery={discovery}
                      valleys={valleys}
                      valley={candidate.valley}
                    />
                  </div>
                  <footer className="ev-cta">
                    <Button icon="map" onClick={() => choose(candidate)}>
                      이 계곡 선택 · 큰 지도 열기
                    </Button>
                  </footer>
                </>
              ) : (
                <>
                  <header className="app-home-header">
                    <div>
                      <h1 className="app-wordmark">
                        모두밸리
                        <span className="wordmark-dot" />
                      </h1>
                    </div>
                    <IconButton
                      label="설정 열기"
                      icon="settings-2"
                      onClick={() => setDialog('settings')}
                    />
                  </header>
                  {/* 검색은 홈·계곡 찾기의 도구다. 이야기 목록은 제 페이지라 검색 줄을 비운다. */}
                  {page !== 'blog' && (
                    <div className="app-search">
                      <SearchField
                        value={query}
                        onChange={setQuery}
                        onClear={() => setQuery('')}
                        {...(query ? { onBack: () => setQuery('') } : {})}
                      />
                    </div>
                  )}
                  <div className="app-scroll" ref={scroll}>
                    {!PARSED.ok ? (
                      <Alert status="error" title="계곡 자료를 불러오지 못했습니다">
                        앱을 새로고침해주세요.
                      </Alert>
                    ) : query.trim() ? (
                      <>
                        <div className="app-section-heading">
                          <h2>
                            검색 결과 <span>{results.length}</span>
                          </h2>
                          <Button variant="ghost" onClick={() => setQuery('')}>
                            취소
                          </Button>
                        </div>
                        <p className="ev-muted">검색 중에는 조건 필터를 적용하지 않습니다.</p>
                        <div className="app-list">
                          {results.map((item) =>
                            item.kind === 'valley' ? (
                              <ValleyCard
                                key={item.valley.id}
                                name={item.valley.name}
                                region={`${item.valley.segments.length}개 구간`}
                                description="계곡 미리보기"
                                onClick={() => preview(item.valley)}
                              />
                            ) : (
                              <FacilityRow
                                key={item.facility.id}
                                name={item.facility.name}
                                type={facilityTypeLabel(item.facility.facilityType)}
                                valley={item.valley.name}
                                onClick={() => {
                                  const next = placeForValley(item.valley);
                                  if (next) choose({ ...next, facility: item.facility });
                                }}
                              />
                            ),
                          )}
                        </div>
                        {!results.length && (
                          <EmptyState
                            title="검색 결과가 없어요"
                            description="계곡 이름이나 시설 이름을 바꿔보세요."
                            action={
                              <Button variant="secondary" onClick={() => setQuery('')}>
                                검색어 지우기
                              </Button>
                            }
                          />
                        )}
                      </>
                    ) : page === 'home' ? (
                      <DiscoveryHome
                        discovery={discovery}
                        valleys={valleys}
                        onPreview={preview}
                        onExplore={() => {
                          setPage('explore');
                          if (scroll.current) scroll.current.scrollTop = 0;
                        }}
                        onSafety={() => setDialog('safety')}
                        onBlogs={openStories}
                      />
                    ) : page === 'blog' ? (
                      <>
                        <header className="app-page-header ev-subpage-header">
                          <IconButton
                            label="홈으로 돌아가기"
                            icon="arrow-left"
                            onClick={closeStories}
                          />
                          <div>
                            <nav className="ev-crumb" aria-label="현재 위치">
                              <button type="button" onClick={closeStories}>
                                홈
                              </button>
                              <Icon name="chevron-right" size={14} />
                              <span aria-current="page">계곡 이야기</span>
                            </nav>
                            <h1>계곡 이야기</h1>
                          </div>
                        </header>
                        <div className="app-chip-scroll">
                          <Chip selected={!storyValley} onClick={() => setStoryValley(null)}>
                            전체
                          </Chip>
                          {storyValleys.map((v) => (
                            <Chip
                              key={v.id}
                              selected={storyValley === v.id}
                              onClick={() => setStoryValley(v.id)}
                            >
                              {v.name}
                            </Chip>
                          ))}
                        </div>
                        <BlogSection
                          discovery={discovery}
                          valleys={valleys}
                          onValley={preview}
                          {...(storyValley ? { only: storyValley } : {})}
                        />
                      </>
                    ) : (
                      <>
                        <div className="app-section-heading">
                          <h2>계곡 찾기</h2>
                        </div>
                        <div className="app-chip-scroll">
                          {FILTER_CHIPS.map((f) => (
                            <Chip
                              key={f.key}
                              icon={filterIcons[f.key]}
                              selected={filters.has(f.key)}
                              onClick={() =>
                                setFilters((current) => {
                                  const next = new Set(current);
                                  if (next.has(f.key)) next.delete(f.key);
                                  else next.add(f.key);
                                  return next;
                                })
                              }
                            >
                              {f.label}
                            </Chip>
                          ))}
                        </div>
                        <div className="app-section-heading">
                          <h2>{filters.size ? '조건에 맞는 계곡' : '둘러볼 계곡'}</h2>
                          <span>{visible.length}곳</span>
                        </div>
                        {!!filters.size && (
                          <p className="ev-muted">미확인 조건은 결과에서 제외됩니다.</p>
                        )}
                        <div className="app-list">
                          {visible.map((v) => (
                            <ValleyCard
                              key={v.id}
                              name={v.name}
                              region={`${v.segments.length}개 구간 · 주변 시설 ${v.facilities.length}곳`}
                              description="구간별 그늘과 주변 시설 살펴보기"
                              onClick={() => preview(v)}
                            />
                          ))}
                        </div>
                        {!visible.length && (
                          <EmptyState
                            title="조건에 맞는 계곡이 없어요"
                            description="미확인 값은 조건 충족으로 세지 않습니다."
                            action={
                              <Button variant="secondary" onClick={() => setFilters(new Set())}>
                                필터 초기화
                              </Button>
                            }
                          />
                        )}
                        <button
                          type="button"
                          className="safety-row"
                          onClick={() => setDialog('safety')}
                        >
                          <Icon name="shield-check" />
                          <span>
                            <strong>안전한 물놀이의 시작</strong>
                            <small>계곡 이용 전 확인사항</small>
                          </span>
                          <Icon name="chevron-right" />
                        </button>
                      </>
                    )}
                  </div>
                  <nav className="app-bottom-nav" aria-label="탐색 메뉴">
                    <button
                      type="button"
                      aria-current={page === 'home' ? 'page' : undefined}
                      onClick={() => {
                        setPage('home');
                        setQuery('');
                      }}
                    >
                      <Icon name="house" />
                      <span>홈</span>
                    </button>
                    <button
                      type="button"
                      aria-current={page === 'explore' ? 'page' : undefined}
                      onClick={() => {
                        setPage('explore');
                        setQuery('');
                      }}
                    >
                      <Icon name="map" />
                      <span>계곡 찾기</span>
                    </button>
                    <button type="button" onClick={() => setDialog('settings')}>
                      <Icon name="settings-2" />
                      <span>설정</span>
                    </button>
                  </nav>
                </>
              )}
            </main>
          )}
          <SettingsDialog kind={dialog} onClose={() => setDialog(null)} />
        </div>
      </IconProvider>
    </Navigation.Provider>
  );
}
