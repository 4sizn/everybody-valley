/**
 * "즐길 거리" — 계곡을 골랐을 때 주변에서 할 것·볼 것·먹을 것(사용자 요청 2026-09-23).
 *
 * 세 묶음이고 전부 이미 있는 재료다.
 *   1. 즐기기 팁     운영 콘텐츠 `kind: 'tip'`  — 운영자가 어드민에서 직접 쓴 편집 글.
 *   2. 주변 명소     운영 콘텐츠 `kind: 'spot'` — TourAPI 시딩(`pnpm seed:discovery --kind spot`) 또는 운영자 등록.
 *   3. 먹거리·카페   시설 데이터의 식당·카페(`Valley.eateries`) — 지도 핀에서는 뺐지만 데이터는 있다.
 *
 * 계곡 미리보기와 지도 시트 탭이 같은 컴포넌트를 쓴다(`BlogSection` 과 같은 배치).
 */
import type { DiscoveryStory, Valley } from '@modu-valley/core';
import { facilityTypeLabel } from '@modu-valley/core';
import { Alert, Button, FacilityRow, Icon } from '@moduvalley/ui';
import { DIRECTIONS_PROVIDERS } from '@/components/valley/directions';
import type { DiscoveryState } from './Discovery.web';

/** 먹거리 줄 수. 도심 계곡은 3 km 안에 식당이 수백 곳이라 가까운 몇 곳만. */
export const EATERY_LIMIT = 8;

function TipCard({ story }: { story: DiscoveryStory }) {
  return (
    <article className="ev-blog-card">
      {story.imageUrl && (
        <img
          className="ev-story-image"
          src={story.imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      )}
      <div className="ev-blog-copy">
        <div className="ev-story-byline">
          <span>{story.kind === 'spot' ? '주변 명소' : '즐기기 팁'}</span>
          <span>{story.author}</span>
        </div>
        <h3>{story.title}</h3>
        <p>{story.description}</p>
        {story.url && (
          <a className="ev-story-read" href={story.url} target="_blank" rel="noopener noreferrer">
            {story.kind === 'spot' ? '지도에서 찾기' : '자세히 보기'}{' '}
            <Icon name="navigation" size={16} />
          </a>
        )}
      </div>
      {story.imageUrl && <div className="ev-story-credit">사진 · {story.imageCredit}</div>}
    </article>
  );
}

export function FunSection({ discovery, valley }: { discovery: DiscoveryState; valley: Valley }) {
  const mine = discovery.feed?.stories.filter((s) => s.valleyId === valley.id) ?? [];
  const tips = mine.filter((s) => s.kind === 'tip');
  const spots = mine.filter((s) => s.kind === 'spot');
  const eateries = valley.eateriesAround().slice(0, EATERY_LIMIT);
  // 카카오맵 길찾기 — 시설 상세 면의 길찾기 고르개와 같은 URL 규약. 먹거리는 지도 핀이 없어 바로 연다.
  const kakao = DIRECTIONS_PROVIDERS.find((p) => p.id === 'kakao') ?? DIRECTIONS_PROVIDERS[0];
  const empty = !tips.length && !spots.length && !eateries.length;
  return (
    <section className="ev-editorial-section ev-fun" aria-label={`${valley.name} 즐길 거리`}>
      <div className="app-section-heading">
        <div>
          <span className="ev-eyebrow">THINGS TO DO</span>
          <h2>이 계곡에서 즐기기</h2>
        </div>
      </div>
      {discovery.error ? (
        <Alert status="error" title="즐길 거리를 불러오지 못했어요">
          <Button variant="ghost" onClick={discovery.refresh}>
            다시 불러오기
          </Button>
        </Alert>
      ) : !discovery.feed ? (
        <p className="ev-muted" role="status">
          즐길 거리를 불러오는 중…
        </p>
      ) : empty ? (
        <div className="ev-editorial-empty">
          <Icon name="compass" />
          <strong>아직 소개할 즐길 거리가 없어요</strong>
          <p>주변 명소와 즐기기 팁을 모아 소개합니다.</p>
        </div>
      ) : (
        <>
          {tips.length > 0 && (
            <div className="ev-blog-grid">
              {tips.map((s) => (
                <TipCard key={s.id} story={s} />
              ))}
            </div>
          )}
          {spots.length > 0 && (
            <section aria-label="주변 명소">
              <h4>주변 명소 {spots.length}</h4>
              <div className="ev-blog-grid">
                {spots.map((s) => (
                  <TipCard key={s.id} story={s} />
                ))}
              </div>
            </section>
          )}
          {eateries.length > 0 && (
            <section aria-label="먹거리·카페">
              <h4>먹거리·카페 · 물가에서 가까운 순</h4>
              {eateries.map(({ facility, distance, alsoHere }) => (
                <FacilityRow
                  key={facility.id}
                  name={
                    alsoHere?.length
                      ? `${facility.name} 외 ${alsoHere.length}곳 같은 자리`
                      : facility.name
                  }
                  type={facilityTypeLabel(facility.facilityType)}
                  valley={`물가에서 ${distance.format()}`}
                  onClick={() =>
                    kakao &&
                    window.open(kakao.url(facility.position, facility.name), '_blank', 'noopener')
                  }
                />
              ))}
              <p className="ev-muted">
                공공데이터·OSM 좌표이며 영업 여부는 미확인입니다. 누르면 카카오맵 길찾기를 엽니다.
              </p>
            </section>
          )}
        </>
      )}
      <p className="ev-story-note">
        명소 소개는 한국관광공사 관광정보(공공누리 제1유형)와 운영자 등록 글입니다. 현장 운영 상황은
        다를 수 있습니다.
      </p>
    </section>
  );
}
