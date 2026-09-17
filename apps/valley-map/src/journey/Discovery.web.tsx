import type { DiscoveryFeed, DiscoveryStory, Valley } from '@modu-valley/core';
import { Alert, Button, Icon } from '@moduvalley/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveApiBase } from '@/api/createApiClient';
import { DRAG_SLOP_PX, HERO_ROTATE_MS, nextSlideLeft, snappedLeft } from './heroSlider';

export function useDiscovery() {
  const [feed, setFeed] = useState<DiscoveryFeed | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    const refreshVisible = () => {
      if (!document.hidden) refresh();
    };
    const timer = window.setInterval(refreshVisible, 60_000);
    window.addEventListener('focus', refreshVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshVisible);
    };
  }, [refresh]);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch(`${resolveApiBase()}/api/discovery`, { signal: controller.signal, cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<DiscoveryFeed>;
      })
      .then((next) => {
        if (!controller.signal.aborted) setFeed(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    window.addEventListener('everybody-content-changed', refresh);
    return () => {
      controller.abort();
      window.removeEventListener('everybody-content-changed', refresh);
    };
  }, [revision, refresh]);
  return { feed, error, refresh };
}
export type DiscoveryState = ReturnType<typeof useDiscovery>;
function StoryImage({ story }: { story: DiscoveryStory }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div className="ev-story-image ev-story-image--missing">
      <Icon name="mountain" size={32} />
      <span>이미지 준비 중</span>
    </div>
  ) : (
    <img
      className="ev-story-image"
      src={story.imageUrl}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
function BlogCard({
  story,
  valley,
  onValley,
}: {
  story: DiscoveryStory;
  valley?: Valley | undefined;
  onValley?: ((valley: Valley) => void) | undefined;
}) {
  return (
    <article className="ev-blog-card">
      <a
        href={story.url}
        target="_blank"
        rel="noopener noreferrer"
        className="ev-blog-link"
        aria-label={`${story.title} · 블로그 원문, 새 탭`}
      >
        <div className="ev-story-media">
          <StoryImage story={story} />
          {story.sponsored && <span className="ev-ad-label">광고</span>}
        </div>
        <div className="ev-blog-copy">
          <div className="ev-story-byline">
            <span>{story.author}</span>
            <time dateTime={story.publishedOn}>{story.publishedOn.replaceAll('-', '.')}</time>
          </div>
          <h3>{story.title}</h3>
          <p>{story.description}</p>
          <span className="ev-story-read">
            블로그 원문 읽기 <Icon name="navigation" size={16} />
          </span>
        </div>
      </a>
      <div className="ev-story-credit">사진 · {story.imageCredit}</div>
      {valley && onValley && (
        <button className="ev-story-valley" type="button" onClick={() => onValley(valley)}>
          <Icon name="map" size={16} />
          {valley.name} 미리보기
          <Icon name="chevron-right" size={16} />
        </button>
      )}
    </article>
  );
}
export function BlogSection({
  discovery,
  valleys,
  valley,
  onValley,
}: {
  discovery: DiscoveryState;
  valleys: readonly Valley[];
  valley?: Valley;
  onValley?: (valley: Valley) => void;
}) {
  const posts =
    discovery.feed?.stories.filter(
      (s) => s.kind === 'blog' && (!valley || s.valleyId === valley.id),
    ) ?? [];
  return (
    <section
      className="ev-editorial-section"
      aria-label={valley ? `${valley.name} 방문 후기` : '계곡별 블로그'}
    >
      <div className="app-section-heading">
        <div>
          <span className="ev-eyebrow">BLOG & GUIDE</span>
          <h2>{valley ? '다녀온 사람들의 이야기' : '계곡을 먼저 만나보세요'}</h2>
        </div>
        {!!posts.length && <span>{posts.length}편</span>}
      </div>
      <p className="ev-muted">
        {valley
          ? `${valley.name}의 풍경과 방문 팁을 블로그에서 살펴보세요.`
          : '사진으로 둘러보고, 마음에 드는 계곡을 골라보세요.'}
      </p>
      {discovery.error ? (
        <Alert status="error" title="방문 후기를 불러오지 못했어요">
          <Button variant="ghost" onClick={discovery.refresh}>
            다시 불러오기
          </Button>
        </Alert>
      ) : !discovery.feed ? (
        <p className="ev-muted" role="status">
          방문 후기를 불러오는 중…
        </p>
      ) : posts.length ? (
        <div className="ev-blog-grid">
          {posts.map((s) => (
            <BlogCard
              key={`${s.id}:${s.imageUrl}`}
              story={s}
              valley={valleys.find((v) => v.id === s.valleyId)}
              onValley={onValley}
            />
          ))}
        </div>
      ) : (
        <div className="ev-editorial-empty">
          <Icon name="image" />
          <strong>
            {valley ? '아직 소개된 후기가 없어요' : '첫 계곡 이야기를 준비하고 있어요'}
          </strong>
          <p>이용자가 참고할 만한 방문기와 주변 명소를 모아 소개합니다.</p>
          {valley && (
            <a
              className="ev-link"
              href={`https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(`${valley.name} 방문 후기`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {valley.name} 블로그 검색하기 ↗
            </a>
          )}
        </div>
      )}
      <p className="ev-story-note">
        외부 블로그로 이동합니다. 글의 작성 시점과 현재 현장 상황은 다를 수 있습니다.
      </p>
    </section>
  );
}
/**
 * 히어로 한 장. 배너가 없으면 안내 문구만 있는 같은 모양의 한 장을 그린다.
 */
function HeroSlide({
  banner,
  position,
  target,
  onPreview,
  onExplore,
}: {
  banner?: DiscoveryStory | undefined;
  position?: string | undefined;
  target?: Valley | undefined;
  onPreview?: ((v: Valley) => void) | undefined;
  onExplore: () => void;
}) {
  return (
    <section
      className={`ev-home-hero ${banner ? 'ev-home-hero--image' : ''}`}
      aria-roledescription={banner ? '슬라이드' : undefined}
      aria-label={banner ? `${position} ${banner.title}` : '이번 주 계곡 안내'}
    >
      {banner && <StoryImage key={banner.imageUrl} story={banner} />}
      <div className="ev-home-hero-copy">
        <span className="ev-hero-tag">
          {banner?.sponsored ? `광고 · ${banner.author}` : '이번 주 계곡 이야기'}
        </span>
        <h2>
          {banner?.title ?? (
            <>
              물소리 따라,
              <br />
              이번 주의 계곡
            </>
          )}
        </h2>
        <p>
          {banner?.description ??
            '계곡의 풍경부터 주변 명소까지. 떠나기 전에, 여기서 먼저 만나보세요.'}
        </p>
        {banner?.url ? (
          <a className="ev-hero-cta" href={banner.url} target="_blank" rel="noopener noreferrer">
            {banner.sponsored ? '광고 자세히 보기' : '이야기 읽기'}{' '}
            <Icon name="navigation" size={18} />
          </a>
        ) : (
          <button
            className="ev-hero-cta"
            type="button"
            onClick={() => (target && onPreview ? onPreview(target) : onExplore())}
          >
            {target ? `${target.name} 살펴보기` : '나에게 맞는 계곡 찾기'}
            <Icon name="chevron-right" size={18} />
          </button>
        )}
      </div>
      {banner && <span className="ev-hero-credit">사진 · {banner.imageCredit}</span>}
    </section>
  );
}

/**
 * 히어로 슬라이더 조작 전부.
 *
 * - 손가락 스와이프는 브라우저의 가로 스크롤이 그냥 해 준다.
 * - 마우스는 스크롤 컨테이너를 끌 수 없어서 포인터로 직접 끌어 준다. 끄는 동안은 스냅을
 *   껐다가 손을 뗄 때 가장 가까운 슬라이드로 맞춘다.
 * - 6초마다 자동으로 넘기고, 사용자가 한 번이라도 직접 넘기면 멈춘다. 키보드는 아래 점 버튼으로 고른다.
 * - 탭이 뒤에 있을 때와 동작 줄이기(`prefers-reduced-motion`)에서는 자동으로 넘기지 않는다.
 *
 * 멈춤·드래그는 리액트 합성 이벤트가 아니라 트랙의 네이티브 이벤트로 잡는다 — 실제 스와이프는
 * 스크롤이라 합성 이벤트를 거치지 않는다.
 */
function useHeroRotation(count: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const stopped = useRef(false);
  useEffect(() => {
    const track = ref.current;
    if (!track || count < 2) return;
    const stop = () => {
      stopped.current = true;
    };
    // 점 표시는 스크롤 위치에서 읽는다. 같은 값이면 리액트가 다시 그리지 않는다.
    const follow = () => {
      if (track.clientWidth > 0) setIndex(Math.round(track.scrollLeft / track.clientWidth));
    };
    let dragFrom: number | null = null;
    let dragScroll = 0;
    const down = (event: PointerEvent) => {
      stop();
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      dragFrom = event.clientX;
      dragScroll = track.scrollLeft;
      track.style.scrollSnapType = 'none';
      try {
        track.setPointerCapture(event.pointerId);
      } catch {
        // 포인터가 이미 사라진 경우다. 캡처 없이도 트랙 위에서는 끌린다.
      }
    };
    const move = (event: PointerEvent) => {
      if (dragFrom === null) return;
      track.scrollLeft = dragScroll - (event.clientX - dragFrom);
    };
    const up = (event: PointerEvent) => {
      if (dragFrom === null) return;
      const dragged = Math.abs(event.clientX - dragFrom) > DRAG_SLOP_PX;
      dragFrom = null;
      track.style.scrollSnapType = '';
      track.scrollTo({
        left: snappedLeft(track.scrollLeft, track.clientWidth),
        behavior: 'smooth',
      });
      // 끌고 나서 손을 떼는 자리에 버튼이 있으면 눌리지 않게 그 한 번만 막는다.
      if (dragged)
        track.addEventListener(
          'click',
          (click) => {
            click.preventDefault();
            click.stopPropagation();
          },
          { capture: true, once: true },
        );
    };
    track.addEventListener('scroll', follow, { passive: true });
    track.addEventListener('pointerdown', down);
    track.addEventListener('pointermove', move);
    track.addEventListener('pointerup', up);
    track.addEventListener('pointercancel', up);
    track.addEventListener('wheel', stop, { passive: true });
    track.addEventListener('keydown', stop);
    const rotates = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = rotates
      ? window.setInterval(() => {
          if (stopped.current || document.hidden) return;
          track.scrollTo({
            left: nextSlideLeft(track.scrollLeft, track.clientWidth, count),
            behavior: 'smooth',
          });
        }, HERO_ROTATE_MS)
      : undefined;
    return () => {
      if (timer !== undefined) window.clearInterval(timer);
      track.removeEventListener('scroll', follow);
      track.removeEventListener('pointerdown', down);
      track.removeEventListener('pointermove', move);
      track.removeEventListener('pointerup', up);
      track.removeEventListener('pointercancel', up);
      track.removeEventListener('wheel', stop);
      track.removeEventListener('keydown', stop);
    };
  }, [count]);
  const goTo = useCallback((slide: number) => {
    stopped.current = true;
    const track = ref.current;
    if (track) track.scrollTo({ left: slide * track.clientWidth, behavior: 'smooth' });
  }, []);
  return { ref, index, goTo };
}

export function DiscoveryHome({
  discovery,
  valleys,
  onPreview,
  onExplore,
  onSafety,
}: {
  discovery: DiscoveryState;
  valleys: readonly Valley[];
  onPreview: (v: Valley) => void;
  onExplore: () => void;
  onSafety: () => void;
}) {
  const banners = discovery.feed?.stories.filter((s) => s.kind === 'banner') ?? [];
  const slider = useHeroRotation(banners.length);
  return (
    <div className="ev-home-content">
      <section
        className="ev-hero-slider"
        ref={slider.ref}
        aria-roledescription="캐러셀"
        aria-label="이번 주 계곡 안내 — 좌우로 넘기거나 아래 점으로 고르세요"
      >
        {banners.length === 0 ? (
          <HeroSlide onExplore={onExplore} />
        ) : (
          banners.map((banner, i) => (
            <HeroSlide
              key={banner.id}
              banner={banner}
              position={`${i + 1} / ${banners.length}`}
              target={valleys.find((v) => v.id === banner.valleyId)}
              onPreview={onPreview}
              onExplore={onExplore}
            />
          ))
        )}
      </section>
      {banners.length > 1 && (
        /* ponytail: 배너가 30장이면 점도 30개라 하나가 12 px 폭이다 — 권장 터치 크기(24 px)보다
           좁다. 공개 배너를 8장 안쪽으로 두면 점을 24 px 로 키울 수 있다. */
        <div className="ev-hero-dots">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              aria-label={`${i + 1}번 배너: ${b.title}`}
              aria-current={i === slider.index}
              onClick={() => slider.goTo(i)}
            />
          ))}
        </div>
      )}
      <section className="ev-editorial-section" aria-label="주간 관심 계곡 순위">
        <div className="app-section-heading">
          <div>
            <span className="ev-eyebrow">WEEKLY TOP 5</span>
            <h2>이번 주, 관심이 모인 계곡</h2>
          </div>
          <button className="ev-all-valleys" type="button" onClick={onExplore}>
            전체 보기 <Icon name="chevron-right" size={16} />
          </button>
        </div>
        <p className="ev-muted">최근 7일 계곡 선택 기준 · 실제 방문 인증 순위는 아닙니다.</p>
        {discovery.feed && (
          <p className="ev-ranking-period">
            {discovery.feed.period.from} — {discovery.feed.period.to} · 한국 시간
          </p>
        )}
        {discovery.error ? (
          <Alert status="error" title="주간 순위를 불러오지 못했어요">
            <Button variant="ghost" onClick={discovery.refresh}>
              다시 불러오기
            </Button>
          </Alert>
        ) : discovery.feed?.ranking.length ? (
          <ol className="ev-ranking-list">
            {discovery.feed.ranking.map((r) => {
              const v = valleys.find((v) => v.id === r.valleyId);
              if (!v) return null;
              return (
                <li key={v.id}>
                  <button type="button" onClick={() => onPreview(v)}>
                    <span className="ev-rank">{String(r.rank).padStart(2, '0')}</span>
                    <span className="ev-rank-copy">
                      <strong>{v.name}</strong>
                      <small>
                        관심 선택 {r.count}회 · 주변 시설 {v.facilities.length}곳
                      </small>
                    </span>
                    <Icon name="chevron-right" size={18} />
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="ev-editorial-empty">
            <strong>
              {discovery.feed ? '이번 주의 관심을 모으고 있어요' : '주간 순위를 불러오는 중…'}
            </strong>
            <p>계곡 지도를 선택하면 관심 순위에 반영됩니다.</p>
            <Button variant="secondary" onClick={onExplore}>
              계곡 둘러보기
            </Button>
          </div>
        )}
      </section>
      <BlogSection discovery={discovery} valleys={valleys} onValley={onPreview} />
      <button type="button" className="safety-row" onClick={onSafety}>
        <Icon name="shield-check" />
        <span>
          <strong>떠나기 전, 이것만은 확인하세요</strong>
          <small>현장 통제 · 기상 · 물놀이 안내</small>
        </span>
        <Icon name="chevron-right" />
      </button>
    </div>
  );
}
