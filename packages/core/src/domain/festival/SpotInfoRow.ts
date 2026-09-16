/**
 * 상세 패널의 2×2 정보 카드 한 칸.
 *
 * 데모는 `[['관람 포인트','...'], ...]` 튜플 배열을 쓰고, 아이콘을 한국어
 * 라벨 문자열로 조회한다(`ICON[l] ?? ICON._`). 라벨 오타 하나로 아이콘이
 * 조용히 기본값으로 떨어지므로, 종류를 타입으로 고정하고 라벨은 종류에서
 * 파생시킨다.
 */
export const INFO_ROW_KINDS = ['viewpoint', 'crowd', 'restroom', 'transit', 'other'] as const;
export type InfoRowKind = (typeof INFO_ROW_KINDS)[number];

const KIND_LABELS: Readonly<Record<InfoRowKind, string>> = {
  viewpoint: '관람 포인트',
  crowd: '혼잡도',
  restroom: '화장실',
  transit: '교통',
  other: '안내',
};

export type SpotInfoRow = {
  readonly kind: InfoRowKind;
  readonly label: string;
  readonly value: string;
};

export function infoRow(kind: InfoRowKind, value: string, label?: string): SpotInfoRow {
  return { kind, label: label ?? KIND_LABELS[kind], value };
}

export function infoRowLabel(kind: InfoRowKind): string {
  return KIND_LABELS[kind];
}
