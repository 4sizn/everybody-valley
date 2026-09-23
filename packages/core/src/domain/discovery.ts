/**
 * Editorial content is curated; interest counts are not verified visits.
 *
 * `kind`:
 *   - `banner` 홈 히어로 배너. 링크를 비우면 계곡 미리보기를 연다.
 *   - `blog`   방문 후기·안내 글. 원문 링크 필수.
 *   - `tip`    즐기기 팁(운영자 편집 글, "즐길 거리" 탭). 이미지·링크 선택.
 *   - `spot`   주변 명소(TourAPI 시딩 또는 운영자 등록, "즐길 거리" 탭). 이미지·링크 선택.
 */
export const DISCOVERY_KINDS = ['banner', 'blog', 'tip', 'spot'] as const;
export type DiscoveryKind = (typeof DISCOVERY_KINDS)[number];
export interface DiscoveryStory {
  id: string;
  kind: DiscoveryKind;
  valleyId: string;
  title: string;
  description: string;
  /** `tip`·`spot` 은 비울 수 있다. 비우면 사진 없는 카드다. */
  imageUrl: string;
  /** 이미지가 있으면 필수. */
  imageCredit: string;
  /** `blog`·광고는 필수, `banner` 는 선택, `tip`·`spot` 은 선택. */
  url: string;
  author: string;
  publishedOn: string;
  startsOn: string;
  endsOn: string;
  sponsored: boolean;
  enabled: boolean;
}
export interface DiscoveryFeed {
  stories: DiscoveryStory[];
  ranking: { valleyId: string; count: number; rank: number }[];
  period: { from: string; to: string };
}
