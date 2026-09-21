/**
 * 계곡 출입(입산) 통제 판정 — "이 계곡에 지금 들어갈 수 있나".
 *
 * 재료는 **계곡 기준**으로 이미 좁혀진 통제 기록(`AccessControl`)이다: 산림청·지방산림청·
 * 지자체 고시의 통제구역(지번 폴리곤)이 계곡 중심선 버퍼와 겹치는지, 개방 등산로가 계곡
 * 접근로인지는 시더(`scripts/seed/access.mts`)가 미리 판정해 계곡 id 로 적어 둔다. 이 함수는
 * 날짜만 본다 — 오늘이 통제 기간 안인 기록 중 가장 강한 것을 고른다.
 *
 * 원칙(`data/seed/README.md`): 기록이 없으면 `unknown` 이다. "고시에 없음" 은 "열림" 이 아니다 —
 * 우리가 그 관할 고시를 못 읽었을 수도 있다. `open` 은 고시가 그 구간을 개방으로 명시했을 때만.
 */

export const ACCESS_STATUSES = ['closed', 'trail-open', 'open', 'unknown'] as const;
export type AccessStatus = (typeof ACCESS_STATUSES)[number];

const STATUS_LABELS: Readonly<Record<AccessStatus, string>> = {
  closed: '입산 통제',
  'trail-open': '지정 등산로만 개방',
  open: '출입 가능',
  unknown: '통제 정보 없음',
};

export function accessStatusLabel(status: AccessStatus): string {
  return STATUS_LABELS[status];
}

/** 통제 기록 하나가 계곡을 어떻게 건드리는가. */
export const ACCESS_KINDS = ['closed-area', 'trail-closed', 'trail-open'] as const;
export type AccessKind = (typeof ACCESS_KINDS)[number];

/** 계곡과 어떻게 이어졌나 — 확신의 근거. */
export const ACCESS_BASES = ['parcel', 'ri', 'trail'] as const;
export type AccessBasis = (typeof ACCESS_BASES)[number];

export type AccessControl = {
  readonly valleyId: string;
  readonly kind: AccessKind;
  /** KST `YYYY-MM-DD`, 둘 다 포함. */
  readonly from: string;
  readonly to: string;
  /** parcel = 고시 지번 폴리곤이 중심선 버퍼와 교차(높음) · ri = 리·산 이름 대조(중간) · trail = 등산로 이름. */
  readonly basis: AccessBasis;
  readonly agency: string;
  readonly sourceUrl: string;
  readonly note?: string;
};

export type AccessState = {
  readonly status: AccessStatus;
  /** 상태를 정한 기록. `unknown` 이면 `null`. */
  readonly control: AccessControl | null;
  /** 오늘은 기간 밖이지만 앞으로 올 통제 중 가장 가까운 것. 안내용. */
  readonly upcoming: AccessControl | null;
};

const RANK: Readonly<Record<AccessKind, number>> = {
  'closed-area': 3,
  'trail-closed': 2,
  'trail-open': 1,
};

const STATUS_OF: Readonly<Record<AccessKind, AccessStatus>> = {
  'closed-area': 'closed',
  'trail-closed': 'closed',
  'trail-open': 'trail-open',
};

export function evaluateAccess(input: {
  readonly controls: readonly AccessControl[];
  /** KST `YYYY-MM-DD`. */
  readonly today: string;
}): AccessState {
  const { controls, today } = input;
  const active = controls.filter((c) => c.from <= today && today <= c.to);
  // 같은 계곡에 통제구역(closed-area)과 개방 등산로(trail-open)가 함께 있으면 "지정 등산로만 개방" —
  // 개방 기록이 통제를 이기는 유일한 경우. 개방 기록이 없으면 가장 강한 통제.
  if (active.some((c) => c.kind === 'trail-open') && active.some((c) => c.kind === 'closed-area')) {
    const control = active.find((c) => c.kind === 'trail-open') as AccessControl;
    return { status: 'trail-open', control, upcoming: null };
  }
  const strongest = [...active].sort((a, b) => RANK[b.kind] - RANK[a.kind])[0];
  if (strongest) return { status: STATUS_OF[strongest.kind], control: strongest, upcoming: null };
  const upcoming =
    [...controls].filter((c) => c.from > today).sort((a, b) => (a.from < b.from ? -1 : 1))[0] ??
    null;
  return { status: 'unknown', control: null, upcoming };
}
