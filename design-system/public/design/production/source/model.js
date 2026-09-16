export const valleys = [
  {
    id: "baegun",
    name: "백운계곡",
    region: "경기 포천",
    description: "구간별 그늘과 주변 시설 살펴보기",
    parking: true,
    toilet: true,
    free: null,
    camp: null,
    shade: true,
  },
  {
    id: "songchu",
    name: "송추계곡",
    region: "경기 양주",
    description: "방문 전 이용 가능한 구간 확인",
    parking: true,
    toilet: null,
    free: null,
    camp: false,
    shade: false,
  },
  {
    id: "wonhyo",
    name: "원효계곡",
    region: "광주 무등산",
    description: "현장 통제와 공식 안내 확인",
    parking: null,
    toilet: true,
    free: null,
    camp: false,
    shade: true,
  },
];
export const facilities = [
  { id: "parking", name: "공영주차장", type: "주차장", valleyId: "baegun" },
  { id: "toilet", name: "입구 화장실", type: "화장실", valleyId: "baegun" },
];
export const filterOptions = [
  { value: "toilet", label: "화장실", icon: "toilet" },
  { value: "parking", label: "주차장", icon: "square-parking" },
  { value: "free", label: "무료", icon: "banknote" },
  { value: "camp", label: "야영", icon: "tent" },
  { value: "shade", label: "그늘 많음", icon: "tree-pine" },
];
export function searchPlaces(query, filters = []) {
  const q = query.trim().toLocaleLowerCase();
  if (q)
    return [
      ...valleys
        .filter((v) => (v.name + v.region).toLocaleLowerCase().includes(q))
        .map((v) => ({ ...v, kind: "valley" })),
      ...facilities
        .filter((f) =>
          (f.name + f.type + valleys.find((v) => v.id === f.valleyId).name)
            .toLocaleLowerCase()
            .includes(q),
        )
        .map((f) => ({ ...f, kind: "facility" })),
    ];
  return valleys
    .filter((v) => filters.every((f) => v[f] === true))
    .map((v) => ({ ...v, kind: "valley" }));
}
export function validateReport({ body }) {
  return !body.trim()
    ? "현장 상황을 입력해주세요."
    : body.length > 500
      ? "500자 이내로 작성해주세요."
      : "";
}
