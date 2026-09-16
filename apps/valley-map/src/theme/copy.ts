/**
 * 화면 문구 — 도메인별 절.
 *
 *   FESTIVAL_COPY  `/firework` 데모 화면. 원본 데모의 텍스트 그대로(D2 보존).
 *                  원본은 학습용 클론 예제임을 화면에 명시한다(CLONE 칩, 안내 문구,
 *                  하단 고지). 그 고지도 화면의 일부이므로 함께 옮긴다.
 *   VALLEY_COPY    `/` 계곡 화면. 이 앱의 문구.
 *   SETTINGS_COPY  시트 설정 면(C9). 두 장면이 같은 면을 쓰므로 장면 절 밖에 있다.
 *
 * 두 장면이 **같은 셸**(상단바·컨트롤·내비)을 쓰므로 셸이 읽는 부분은 `ShellCopy`
 * 로 모양을 맞춰 두고, 셸 컴포넌트는 `sceneCopy(scene)` 으로 고른다. 나머지
 * (시트 내용)는 각 도메인 컴포넌트가 자기 절을 직접 import 한다.
 */
import type { NavTab, Scene, ThemeMode } from '@modu-valley/core';

/** 두 장면의 셸이 공통으로 읽는 문구. */
export type ShellCopy = {
  readonly brandName: string;
  /** 브랜드 뒤 accent 색 접미어. 없으면 그리지 않는다. */
  readonly brandSuffix: string | null;
  /** 브랜드 옆 작은 칩(CLONE·샘플). 없으면 그리지 않는다. */
  readonly brandChip: string | null;
  readonly searchPlaceholder: string;
  readonly reportButton: string;
  readonly controlTitles: {
    readonly compass: string;
    readonly locate: string;
    readonly zoomIn: string;
    readonly zoomOut: string;
    readonly report: string;
    readonly close: string;
  };
  readonly navTitles: Readonly<Record<NavTab, string>>;
};

export const FESTIVAL_COPY = {
  brandName: 'spotts',
  brandSuffix: 'fireworks',
  brandChip: 'CLONE',
  searchPlaceholder: '관람 지역 검색',

  tourButton: '명당 순회 비행',
  pitchButton: '2D / 3D',
  reportButton: '현장 제보',

  programsHeading: '행사 프로그램',
  calendarAction: '캘린더 등록',

  spotsHeading: '관람 명당',
  spotsNotice: '예시 데이터입니다. 원본 사이트의 큐레이션 목록이 아닙니다.',

  detailEyebrow: '관람 Spot',
  directionsButton: '길찾기',
  nearbyButton: '주변에서 명당 찾기',
  detailNotice: '예시 데이터입니다 — 실제 관람 정보가 아닙니다.',
  distancePrefix: '불꽃까지 약 ',

  demoAlert: '클론 예제입니다 — 동작하지 않습니다.',

  /**
   * 지도 엔진이 불꽃 파티클을 지원하지 않을 때. 데모의 `demoAlert` 와 달리
   * "이 예제가 원래 안 하는 일"이 아니라 "이 플랫폼에서 못 하는 일"이므로
   * 문구를 따로 둔다(android/ios — `NativeMapCapabilities.ts` 참고).
   */
  fireworksUnsupported: '이 기기의 지도 엔진에서는 불꽃 애니메이션을 지원하지 않습니다.',

  listFooter: [
    '지도 © OpenFreeMap · 데이터 © OpenStreetMap contributors',
    '학습용 클론 예제 — 공식으로 제공하는 정보가 아닙니다.',
  ],

  controlTitles: {
    compass: '북쪽으로 정렬',
    fireworks: '불꽃 애니메이션',
    locate: '발사 지점으로',
    globe: '지구본에서 보기',
    zoomIn: '확대',
    zoomOut: '축소',
    report: '현장 제보',
    share: '공유',
    close: '닫기',
    rows: '행 배치',
    tiles: '타일 배치',
  },

  navTitles: {
    video: '영상',
    home: '홈',
    spots: '명당',
    report: '제보',
    settings: '설정',
  },
} as const;

export const VALLEY_COPY = {
  brandName: '모두의계곡',
  brandSuffix: null,
  /**
   * 데이터가 데스크 검수 단계임을 상단에서부터 드러낸다 — 데모의 CLONE 칩과 같은 자리.
   * F1~V1 의 '샘플' 은 SD1 실데이터 30개가 들어오며 '베타' 로 바꿨다(수기 항목·현장 확인은 SD1b 이후).
   */
  brandChip: '베타',
  /** SR1 — 지오코딩 없이 계곡명·시설명만 찾는다. "지역"은 기대를 넘겨(주소·지오코딩) 뺐다. */
  searchPlaceholder: '계곡·시설 검색',
  reportButton: '제보',

  /**
   * 목록 면 제목. 데이터셋 `metadata.description` 은 문장이라 제목이 아닌 footer 첫 줄에 쓴다(V1 (e)).
   *
   * 2026-09-09 에 '수도권 계곡' 에서 바꿨다 — 광주 무등산(증심사·원효계곡)이 들어오면서 지역
   * 이름이 사실과 어긋났다. 지역을 제목에 박으면 계곡이 늘 때마다 문구가 거짓이 된다. 개수는
   * 바로 아래 요약 줄이 말한다.
   */
  listTitle: '계곡 목록',
  /**
   * 헤더 아래 요약 한 줄 — "계곡 1 · 구간 3 · 시설 4 · 정오 그늘 평균 58%". 그늘 데이터가 없는
   * 데이터셋은 그늘 조각을 생략한다(`noonShadeAverage === null`). 수치는 코어 `summarizeValleys`.
   */
  listSummary: (summary: {
    readonly valleys: number;
    readonly segments: number;
    readonly facilities: number;
    readonly noonShadeAverage: number | null;
  }): string => {
    const parts = [
      `계곡 ${summary.valleys}`,
      `구간 ${summary.segments}`,
      `시설 ${summary.facilities}`,
    ];
    if (summary.noonShadeAverage !== null) {
      parts.push(`정오 그늘 평균 ${Math.round(summary.noonShadeAverage * 100)}%`);
    }
    return parts.join(' · ');
  },
  /** 계곡 헤더 아래 정렬 안내. */
  valleyOrderNote: (segmentCount: number) => `상류 → 하류 · 구간 ${segmentCount}개`,

  /**
   * 조건 필터 칩(N1). 칩 라벨·술어는 core `FILTER_CHIPS` 것 — 여기는 필터 결과를
   * 알리는 문구만 담는다. (e) 결정 — 0곳이어도 완화 제안·해제 버튼 없이 문구만.
   */
  filter: {
    /** 목록 맨 아래 — 정보가 없어 필터 판정에서 제외된 계곡 수(결정 (b)). */
    excludedByMissingInfo: (count: number) => `정보가 없어 제외된 ${count}곳`,
    /** 결정 (e) E2 — 완화 제안·해제 버튼 없이 문구만. */
    emptyResult: '조건에 맞는 계곡이 없습니다.',
  },

  /**
   * 검색(SR1, 사용자 결정 2026-09-08). 검색어가 있으면 목록 면은 이 절만 그리고
   * 구간 섹션·"실시간 정보" 는 숨는다(결정 2). 필터 칩과 무관하다(결정 6) — 필터가
   * 걸려 있으면 결과 아래에 안내 한 줄만 덧붙인다.
   */
  search: {
    /** 목록 면 제목을 이걸로 바꿔 "지금 검색 결과를 보고 있다"를 분명히 한다(결정 2). */
    heading: '검색 결과',
    /** `TopBar` × 버튼의 접근성 라벨 — 지우기 수단은 결과 없음일 때도 상단바 하나뿐이다. */
    clearLabel: '검색어 지우기',
    /** 결정 7 — 완화 제안 없이 문구만. 지우기는 상단바 × 로 충분하다(실측 — 시트 아래 별도
     * 버튼은 기본 스냅에서 접힌 높이 밖으로 밀려 안 보였다). */
    emptyResult: '찾는 계곡·시설이 없습니다.',
    /** 결정 6 — 검색은 필터를 무시한다는 것을 결과 아래에서 알린다. */
    filterIgnoredNotice: '필터를 무시하고 찾았습니다.',
    /** 시설 결과 한 줄(결정 4) — "계곡명 · 시설명 · 유형". 일반명(주차장·CU)은 계곡명 없이 구별 안 됨. */
    facilityResultLabel: (valleyName: string, facilityName: string, typeLabel: string): string =>
      `${valleyName} · ${facilityName} · ${typeLabel}`,
  },

  badges: {
    free: '무료',
    camping: '야영 가능',
    pet: '반려견 동반',
  },
  difficultyPrefix: '접근 ',
  swimBanned: '물놀이 금지 구역',
  riskHeading: '안전 안내',

  info: {
    depth: '수심',
    bed: '바닥',
    access: '접근',
    difficulty: '난이도',
    unknown: '정보 없음',
  },
  /** 접근 카드 값 — "320m · 경사 5.1%". 없는 것은 생략. */
  accessValue: (distanceM: number | undefined, gradePct: number | undefined): string => {
    const parts: string[] = [];
    if (distanceM !== undefined) parts.push(`${distanceM}m`);
    if (gradePct !== undefined) parts.push(`경사 ${gradePct}%`);
    return parts.length === 0 ? '정보 없음' : parts.join(' · ');
  },

  facilitiesHeading: '주변 시설',
  facilitiesNote: '구간 시작점 기준 거리순',
  facilitiesEmpty: '등록된 시설이 없습니다.',
  /** 시설 미니 행 — "주차장 · 백운 제1주차장 · 무료 · 120면". */
  capacityUnit: '면',

  shadeHeading: '그늘',
  /**
   * 그늘 데이터가 없는 구간 — P1 산출물이 없는 계곡. F4 이전의 "준비 중" 자리가 이 뜻으로
   * 옮겨 왔다(D6: 그늘은 데이터 산출로만 채운다).
   */
  shadePending: '정보 없음',
  /**
   * 그늘 태그(N5, 결정 (a)) — `shadeAmountLabel` 이 3단계("나무 그늘 많음/보통/적음")를
   * 낸다. 늦은 오후 급증 배지 문구는 **정의만** 두고 어떤 화면도 렌더하지 않는다(결정 (d),
   * (c) 와의 상충 처리 — 나중에 배지를 켜면 이 문구를 그대로 쓴다).
   */
  shadeLateAfternoonBadge: '늦은 오후 그늘',
  /** 그늘 타일 라벨 — "그늘 · 14:00 기준". 시각은 지도와 같다(그늘이 꺼져 있으면 정오). */
  shadeTileLabel: (hour: string): string => `그늘 · ${hour} 기준`,
  /** 그늘 타일 값 — "68% · 나무 많음". 나무 밀도를 모르면 비율만. */
  shadeTileValue: (ratio: number, canopyLabel: string | undefined): string => {
    const percent = `${Math.round(ratio * 100)}%`;
    return canopyLabel === undefined ? percent : `${percent} · ${canopyLabel}`;
  },
  /**
   * 그늘 타일 아래 한 줄 고지(README "한계 고지"). 촬영 연도는 계곡마다 달라 파일
   * `metadata.chmAcquisition` 에서 읽는다 — 모르면 그 조각을 뺀다.
   */
  shadeNotice: (chmYears: string | undefined, representativeDate: string | undefined): string => {
    const parts = ['위성 기반 추정'];
    if (chmYears !== undefined) parts.push(`수관 ${chmYears} 촬영`);
    if (representativeDate !== undefined) parts.push(`대표일 ${representativeDate}`);
    parts.push('현장과 다를 수 있습니다');
    return parts.join(' · ');
  },
  /** 시간 트랙. 눈금은 "10"…"18", 접근성 라벨은 "14시". */
  shadeTrack: {
    label: '그늘 시각',
    previous: '한 시간 전',
    next: '한 시간 후',
    hour: (hour: string): string => `${hour}시`,
  },

  /**
   * 상류 강우 경보 상세 타일(F3b, 그늘 타일 옆). 활성 경보가 있을 때만 라벨에
   * "N분 전 · 확신"이 붙는다 — 평시·자료 없음은 고정 문구(`docs/F3_ALERT_DESIGN.md` §4).
   */
  alertTile: {
    heading: '상류 강우',
    label: (minutesAgo: number, confidenceLabel: string): string =>
      `상류 강우 · ${minutesAgo}분 전 · ${confidenceLabel}`,
    idleValue: '최근 1시간 0 mm · 수위 관심 아래',
    value: (rainfall1hMm: number, waterLevelNote: string): string =>
      `최근 1시간 ${Math.round(rainfall1hMm)} mm · 수위 ${waterLevelNote}`,
    waterRising: '상승 중',
    waterBelowAttention: '관심 아래',
    notice: '관측소·레이더 기반 추정입니다. 상류가 보이지 않으면 물에서 나오는 것이 우선입니다.',
    staleLabel: (hhmm: string): string => `15분 넘게 자료 없음 · 마지막 ${hhmm}`,
    staleValue: '갱신 대기 중',
  },

  /** 지도 배너 문구(F3b, C7 자리) — "○○계곡 상류 경보 · 물에서 나오세요". */
  alertBanner: {
    message: (valleyName: string, levelLabel: string, instruction: string): string =>
      `${valleyName} 상류 ${levelLabel} · ${instruction}`,
    watch: '지켜보세요',
    warning: '물에서 나오세요',
    evacuate: '물가에서 벗어나세요',
  },

  directionsButton: '길찾기',
  closeButton: '닫기',
  reportComingSoon: '제보는 준비 중입니다 — 다음 단계(MVP-2)에서 열립니다.',
  /** 상세 면 하단 고지 — SD1 데스크 검수 데이터(현장 미확인). 라이선스 표기 정리는 SD1b. */
  sampleNotice: '데스크 검수 데이터 — 현장과 다를 수 있습니다. 방문 전 지자체 공고를 확인하세요.',

  /**
   * 목록 footer — 출처·라이선스 표기(SD1b). 계곡 좌표열은 OSM(ODbL), 시설은 공공데이터포털 표준데이터(공공누리 1유형),
   * 유역 코드는 브이월드(이용 표시 의무), 표고·지형은 Mapzen/AWS Terrarium, 그늘은 Meta/WRI 수관(CC BY 4.0)·Copernicus GLO-30.
   */
  listFooter: [
    '지도 © OpenFreeMap · 데이터 © OpenStreetMap contributors (ODbL)',
    '계곡 좌표 OSM(ODbL) · 시설 공공데이터포털 표준데이터(공공누리 1유형) · 유역 브이월드 · 지형 Terrarium · 수관 Meta/WRI(CC BY 4.0)',
    '데스크 검수 데이터 — 현장과 다를 수 있습니다. 방문 전 지자체 공고를 확인하세요.',
  ],

  controlTitles: {
    compass: '북쪽으로 정렬',
    shade: '그늘 보기',
    locate: '계곡으로',
    zoomIn: '확대',
    zoomOut: '축소',
    report: '제보',
    close: '닫기',
    clearFacility: '시설 선택 해제',
  },

  navTitles: {
    video: '소식',
    home: '홈',
    spots: '계곡',
    report: '제보',
    settings: '설정',
  },
} as const;

/**
 * 셸 컴포넌트가 장면에 맞는 문구를 고르는 유일한 자리. 두 절이 `ShellCopy` 에
 * 맞는지는 이 반환 타입이 검사한다(`satisfies` 는 초과 속성을 거절해 쓸 수 없다).
 */
export function sceneCopy(scene: Scene): ShellCopy {
  return scene === 'festival' ? FESTIVAL_COPY : VALLEY_COPY;
}

/**
 * 제보 폼(F5b) — 시트 위 모달 팝업(결정 (e)). 유형·본문·닉네임·비밀번호·사진, 긴급 고지.
 * 필드 오류 문구는 core `validateReportDraft` 의 `reason` 을 그대로 쓴다(여기서 다시 쓰지
 * 않는다) — 이 절은 core 가 모르는 화면 문구(레이블·안내·전송 상태)만 담는다.
 */
export const REPORT_FORM_COPY = {
  title: '제보하기',
  closeButton: '닫기',
  typeSectionLabel: '어떤 이야기인가요',
  valleySectionLabel: '계곡',
  /** 계곡 선택 필드 — 접힌 상태에서 누르면 목록이 펼쳐진다. */
  valleyChangeLabel: '변경',
  valleyPickerEmpty: '계곡을 골라 주세요',
  /** 위치 항목(F5d) — 접힌 상태 → "지도에서 선택" → 인라인 지도 + 십자선(승인된 목업). */
  locationSectionLabel: '위치',
  locationEmptyLabel: '위치를 선택하지 않았습니다',
  locationOpenLabel: '지도에서 선택',
  locationChangeLabel: '변경',
  locationDoneLabel: '완료',
  locationClearLabel: '지우기',
  locationHint: '지도를 움직여 십자선 아래 지점을 고르세요',
  /** 네이티브는 아직 인라인 지도 피커가 없다(`platform/reportLocationPicker` 능력 매트릭스). */
  locationPickerUnsupported: '이 기기에서는 지도로 위치를 고르는 기능이 아직 지원되지 않습니다.',
  /** 지도 엔진 초기화가 일정 시간 안에 끝나지 않거나 실패했을 때. */
  locationMapError: '지도를 불러오지 못했습니다. 좌표 없이 제보하거나 다시 시도해 주세요.',
  locationRetryButton: '다시 시도',
  bodyPlaceholder: '무엇을 알려주고 싶나요?',
  bodyCounter: (length: number, max: number): string => `${length}/${max}`,
  nicknameLabel: '닉네임',
  nicknamePlaceholder: '닉네임',
  passwordLabel: '비밀번호',
  passwordPlaceholder: '삭제·수정용 비밀번호',
  /** 결정 (c) — 전송 버튼 바로 위, 닉네임·비밀번호 한 줄 아래 안내. */
  credentialNotice: '이 제보를 지우거나 고칠 때만 씁니다. 계정이 만들어지지 않습니다.',
  /** 결정 (i) — 긴급 신고 유형이 아니어도 폼 전체에 병기한다. */
  emergencyNotice:
    '사람이 다쳤거나 위급하면 119·112 로 직접 전화하세요. 제보는 신고 접수가 아닙니다.',
  photoSectionLabel: (max: number): string => `사진 (최대 ${max}장)`,
  photoAddLabel: '사진 추가',
  photoRemoveLabel: '사진 삭제',
  /** 이 런타임(네이티브)이 아직 사진 선택을 지원하지 않을 때 — 능력 매트릭스 패턴(MapControls 참고). */
  photoPickerUnsupported: '이 기기에서는 사진 첨부가 아직 지원되지 않습니다.',
  photoTooMany: (max: number): string => `사진은 최대 ${max}장까지입니다.`,
  photoTooLarge: (maxMb: number): string => `사진은 장당 ${maxMb}MB 까지입니다.`,
  submitButton: '제보하기',
  submitting: '전송 중…',
  submitSuccess: '제보가 등록되었습니다.',
  submitRateLimited: (retryAfterSec: number | null): string =>
    retryAfterSec === null
      ? '요청이 많습니다. 잠시 후 다시 시도해 주세요.'
      : `요청이 많습니다. ${retryAfterSec}초 뒤 다시 시도해 주세요.`,
  submitFailed: '전송에 실패했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.',
} as const;

/**
 * 제보 피드·상세(F5c) — 목록 면 "실시간 정보" 섹션·피드 카드·상세 캐러셀·신고하기.
 * 119·112 고지는 폼과 같은 문구(`REPORT_FORM_COPY.emergencyNotice`)를 그대로 쓴다(결정 (i)).
 */
export const REPORT_FEED_COPY = {
  /** 목록 면 상단 섹션(화면 결정 (f)) — 제보가 없으면 섹션 자체를 그리지 않는다. */
  sectionTitle: '실시간 정보',
  /** 사진 없는 카드의 썸네일 자리(화면 결정 (d)) — 접근성 라벨. */
  cardNoPhotoLabel: '사진 없음',
  detailEyebrow: '제보',
  carouselPhotoLabel: (index: number, total: number): string => `사진 ${index}/${total}`,
  flagButton: '신고하기',
  flagSuccess: '접수되었습니다.',
  flagFailed: '신고 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  /** 상세 면 좌표 줄(F5d 해석 5) — 좌표가 있는 제보에만 보인다. */
  copyCoordinateLabel: '좌표 복사',
  copyCoordinateSuccess: '좌표를 복사했습니다.',
  copyCoordinateFailed: '복사에 실패했습니다.',
} as const;

/**
 * 수관 촬영 연월 목록(`['2019-03', '2019-05']`) → "2019년" / "2016~2018년". 비어 있으면 `undefined`.
 * 연도만 보이는 이유: 고지는 한 줄이고, 사용자에게 의미 있는 단위는 "몇 년 전 영상인가" 다.
 */
export function chmYearsLabel(acquisition: readonly string[]): string | undefined {
  const years = [...new Set(acquisition.map((item) => item.slice(0, 4)))].sort();
  const first = years[0];
  const last = years[years.length - 1];
  if (first === undefined || last === undefined) return undefined;
  return first === last ? `${first}년` : `${first}~${last}년`;
}

/** 'YYYY-MM-DD' → "8월 1일". 형식이 다르면 그대로 돌려준다(로더가 이미 검사했다). */
export function representativeDateLabel(date: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  if (match === null) return date;
  return `${Number(match[1])}월 ${Number(match[2])}일`;
}

/**
 * ISO 8601 UTC → KST "HH:MM"(F3b 자료 없음 타일 "마지막 14:20"). `Intl`/`toLocaleString` 을
 * 쓰지 않는다 — RN 런타임(Hermes)이 타임존 데이터를 항상 들고 있지 않는다(크로스플랫폼 제약).
 * UTC ms 에 9시간을 더해 UTC 필드로 읽는 수기 변환이라 어디서나 같은 값을 낸다.
 */
export function formatKstHHMM(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * 설정 면(C9). 테마 카드(세그먼트 + 현재 적용) + 정보 카드(지도·지형 출처, 앱 버전).
 * 출처 문구는 결정 (c) 그대로 — 지도 openfreemap(D4)·OSM, 지형 Terrarium(C10).
 */
const THEME_MODE_LABELS: Readonly<Record<ThemeMode, string>> = {
  light: '라이트',
  dark: '다크',
  system: '시스템',
};

export const SETTINGS_COPY = {
  title: '설정',
  closeButton: '닫기',

  themeHeading: '테마',
  themeNote: '화면과 지도의 밝기. 시스템은 기기 설정을 따릅니다.',
  themeModes: THEME_MODE_LABELS,
  /** 세그먼트 아래 한 줄 — 시스템을 골랐을 때 실제로 어느 팔레트인지 드러낸다. */
  applied: (mode: 'light' | 'dark'): string => `현재 적용: ${THEME_MODE_LABELS[mode]}`,
  /** 테마를 바꾸면 지도가 다시 뜬다는 안내(결정 (d) 세션 재생성). */
  reloadNote: '테마를 바꾸면 지도를 다시 불러옵니다.',

  infoHeading: '정보',
  info: {
    map: '지도',
    mapValue: 'OpenFreeMap · OpenStreetMap',
    terrain: '지형',
    terrainValue: 'Mapzen/AWS Open Data (Terrarium)',
    /** SD1b — 계곡·시설 데이터 출처. 좌표열은 OSM, 시설은 표준데이터, 유역 코드는 브이월드(기하 미저장). */
    valleyData: '계곡 데이터',
    valleyDataValue: 'OSM(ODbL) · 표준데이터(공공누리) · 브이월드',
    /** SD1b — 그늘 산출 자산(P1). */
    shade: '그늘',
    shadeValue: 'Meta/WRI CHM(CC BY 4.0) · GLO-30',
    version: '버전',
    /** 버전을 모르는 빌드(정적 렌더 등). */
    versionUnknown: '알 수 없음',
  },
} as const;

/**
 * 베이스맵 헬스(C7). 두 장면이 같은 셸 배너·전면 화면을 쓰므로 장면 절 밖에 있다.
 *   outage      상단바 아래 띠 — 타일이 8초 넘게 안 오고 있다(`AppState.baseMapHealth.outage`).
 *   styleFailed 전면 — 스타일 자체를 못 받아 지도가 없다(세션 `failed`).
 */
export const BASEMAP_HEALTH_COPY = {
  outage: '지도 타일을 불러오지 못하고 있어요',
  retry: '다시 시도',
  styleFailedTitle: '지도를 불러오지 못했어요',
  styleFailedNote: '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
} as const;

export const ATTRIBUTION = {
  openFreeMap: { label: 'OpenFreeMap', href: 'https://openfreemap.org' },
  openStreetMap: {
    label: 'OpenStreetMap',
    href: 'https://www.openstreetmap.org/copyright',
  },
} as const;

/**
 * 제보 운영 도구(OPS1, 임시 — 계정 플로우가 생기면 제거) — 좌상단 10탭 → 토큰 입력 →
 * 관리자 모드. 관리자 모드에서만 쓰이는 문구를 여기 한곳에 모은다.
 */
export const ADMIN_COPY = {
  tokenModalTitle: '관리자 모드',
  tokenModalActiveNote: '관리자 모드가 켜져 있습니다.',
  tokenLabel: '관리자 토큰',
  tokenPlaceholder: '서버에 설정한 ADMIN_TOKEN 붙여넣기',
  applyButton: '적용',
  applying: '확인 중…',
  exitButton: '관리자 모드 해제',
  applySuccess: '관리자 모드가 켜졌습니다.',
  exitSuccess: '관리자 모드를 해제했습니다.',
  tokenEmpty: '토큰을 입력해 주세요.',
  tokenInvalid: '토큰이 올바르지 않습니다.',
  tokenCheckFailed: '서버에 닿지 못했습니다. 잠시 후 다시 시도해 주세요.',
  closeButton: '닫기',
  /** 평소 화면과 구별되는 배너 — 실수로 켠 채 두는 것을 막는다. */
  bannerLabel: '관리자 모드',
  panelTitle: '제보 운영',
  tabHidden: '숨긴 제보',
  tabFlags: '신고 목록',
  hiddenEmpty: '숨긴 제보가 없습니다.',
  flagsEmpty: '접수된 신고가 없습니다.',
  hideButton: '숨김',
  restoreButton: '복구',
  hideSuccess: '숨겼습니다.',
  restoreSuccess: '복구했습니다.',
  actionFailed: '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  flagCount: (n: number): string => `신고 ${n}건`,
  loading: '불러오는 중…',
} as const;
