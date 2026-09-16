/** Editorial content is curated; interest counts are not verified visits. */
export interface DiscoveryStory {
  id: string;
  kind: 'banner' | 'blog';
  valleyId: string;
  title: string;
  description: string;
  imageUrl: string;
  imageCredit: string;
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
