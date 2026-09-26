import React, { useState, useCallback, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  Icon,
  Button,
  IconButton,
  Field,
  SearchField,
  Chip,
  Segmented,
  Switch,
  Badge,
  Alert,
  Card,
  ValleyCard,
  FacilityRow,
  Metric,
  Tabs,
  EmptyState,
  Skeleton,
  TimePicker,
  Dialog,
  Toast,
  MapTool,
  PhotoInput,
  Notice,
} from "./components.jsx";
import { JourneyPreview, ReportComposer } from "./patterns.jsx";
import tokens from "./tokens.json";
import { ReferencePage } from "./reference.jsx";
import "./studio.css";
const catalog = [
  {
    id: "button",
    name: "Button",
    ko: "행동 버튼",
    group: "행동",
    spec: "48h · 16/24/600 · visual 40h · inset 4 · gap 8",
    props:
      "variant: primary | secondary | ghost | danger · loading · disabled · icon",
    contract:
      "한 화면의 주요 행동은 하나. 처리 중에는 중복 실행을 차단하고, 비활성 이유는 가까이 표시합니다.",
  },
  {
    id: "icon",
    name: "IconButton / MapTool",
    ko: "아이콘과 지도 도구",
    group: "행동",
    spec: "icon 24 · target 48 · map tool 40 circle / 48 target",
    props: "label 필수 · icon · selected · onClick",
    contract:
      "같은 Lucide 자산을 사용합니다. 지도 도구는 이름을 병기하고 선택을 모양과 색으로 구별합니다.",
  },
  {
    id: "field",
    name: "Field",
    ko: "입력 필드",
    group: "입력",
    spec: "48h · body 16/24 · label 16/24/600 · gap 8",
    props: "label · hint · error · required · multiline · disabled · readOnly",
    contract:
      "영구 라벨과 필수 표기. 오류와 설명을 필드에 연결하고, 오류가 나도 입력을 보존합니다.",
  },
  {
    id: "search",
    name: "SearchField",
    ko: "검색 입력",
    group: "입력",
    spec: "48h · icon 24 · gap 8 · clear target 48",
    props: "value · onChange · onClear · label",
    contract:
      "지우기와 탐색 취소는 별개의 행동입니다. 계곡 결과와 시설 결과는 다른 목적지로 연결합니다.",
  },
  {
    id: "chip",
    name: "Chip / Segmented",
    ko: "선택과 필터",
    group: "입력",
    spec: "visual 34 / target 44 · label 14/24/500 · gap 8",
    props: "selected · icon · disabled / options · value · onChange",
    contract:
      "필터는 다중, 구간은 단일 선택입니다. 미확인 값을 조건 충족으로 간주하지 않습니다.",
  },
  {
    id: "switch",
    name: "Switch",
    ko: "켜기와 끄기",
    group: "입력",
    spec: "row ≥56 · track 44×28 · target 48",
    props: "checked · onChange · label · description · disabled",
    contract:
      "라벨 전체로 조작합니다. 체크 상태·disabled·키보드 포커스를 제공합니다.",
  },
  {
    id: "status",
    name: "Badge / Alert",
    ko: "위험·근거·자료 상태",
    group: "피드백",
    spec: "badge 14/20/600 · alert 16/24 + 14/20 · padding 12",
    props: "status · title · action · live",
    contract:
      "위험 단계와 자료 근거는 별도 축입니다. 자료 없음·지연·연결 실패를 구분하고 대피 상태를 가리지 않습니다.",
  },
  {
    id: "cards",
    name: "ValleyCard / FacilityRow",
    ko: "장소와 시설",
    group: "콘텐츠",
    spec: "padding 16 · gap 12 · title 16/24 · meta 14/20",
    props: "name · region · description · rank · onClick / type · valley",
    contract:
      "행 전체가 한 선택 대상입니다. 시설명·부모 계곡·유형을 유지하며 긴 이름은 줄바꿈합니다.",
  },
  {
    id: "metric",
    name: "Card / Metric / Notice",
    ko: "조건과 근거",
    group: "콘텐츠",
    spec: "section padding 16 · metric 14/20 + 16/24 · gap 8",
    props: "label · value · icon / children",
    contract:
      "확인되지 않은 값은 미확인으로 표시합니다. 정보와 출처를 가까이 배치하고 뜻 없는 숫자를 채우지 않습니다.",
  },
  {
    id: "tabs",
    name: "Tabs",
    ko: "정보 탭",
    group: "탐색",
    spec: "target 48 · label 14/20 · indicator 2",
    props: "options · value · onChange · label",
    contract:
      "선택 장소는 그대로 유지합니다. 방향키·Home·End와 탭 포커스로 조작할 수 있습니다.",
  },
  {
    id: "empty",
    name: "EmptyState / Skeleton",
    ko: "빈 상태와 불러오기",
    group: "피드백",
    spec: "padding 32×20 · title 16/24 · body 14/20",
    props: "title · description · action / rows · label",
    contract:
      "0건·자료 없음·실패를 한 메시지로 합치지 않습니다. 다음 행동을 제공하고 로딩은 레이아웃을 유지합니다.",
  },
  {
    id: "time",
    name: "TimePicker",
    ko: "그늘 시간",
    group: "입력",
    spec: "10–18시 · 9단계 · range target 48",
    props: "value · onChange · date · disabled",
    contract:
      "예측임을 명시하고 기준 날짜를 함께 표시합니다. 슬라이더와 이전·다음 버튼은 같은 상태를 변경합니다.",
  },
  {
    id: "dialog",
    name: "Dialog / Toast",
    ko: "확인과 결과 알림",
    group: "피드백",
    spec: "radius 24 · padding 20 · action gap 8",
    props: "open · onClose · title · description · footer / message",
    contract:
      "네이티브 dialog로 포커스를 가두고 닫은 뒤 복원합니다. 이탈 확인의 기본 행동은 계속 쓰기입니다.",
  },
  {
    id: "photo",
    name: "PhotoInput",
    ko: "사진 첨부",
    group: "입력",
    spec: "tile 88 · delete target 48 · max 3",
    props: "value · onChange · error",
    contract:
      "사진 수와 삭제를 제공합니다. 이 구현은 기기 내 미리보기이며 업로드·EXIF 제거는 서버 연결 규칙입니다.",
  },
  {
    id: "sheet",
    name: "MapSheet",
    ko: "지도 바텀시트",
    group: "탐색",
    spec: "peek / half / full · inset 16 · action 48",
    props: "state · onChange · title · subtitle · actions · children",
    contract:
      "시트 단계는 버튼과 손잡이 드래그로 바꿉니다. 선택 해제와 구별하며 내부 스크롤과 안전 영역을 분리합니다.",
  },
];
function Studio() {
  useEffect(() => {
    const update = () => setPage(location.hash.slice(1) || "overview");
    addEventListener("hashchange", update);
    addEventListener("popstate", update);
    return () => {
      removeEventListener("hashchange", update);
      removeEventListener("popstate", update);
    };
  }, []);
  const [page, setPage] = useState(location.hash.slice(1) || "overview"),
    [theme, setTheme] = useState("light"),
    [group, setGroup] = useState("전체"),
    [search, setSearch] = useState(""),
    [risk, setRisk] = useState("unknown"),
    [longText, setLongText] = useState(false),
    [fail, setFail] = useState(false),
    [width, setWidth] = useState(390),
    [toast, setToast] = useState("");
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
  };
  const navigate = (v) => {
    setPage(v);
    history.replaceState(null, "", "#" + v);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const dismiss = useCallback(() => setToast(""), []);
  const [showReport, setShowReport] = useState(false);
  const nav = [
    ["overview", "시스템 개요", "house"],
    ["reference", "레퍼런스 비교", "image"],
    ["foundation", "기준과 토큰", "layers"],
    ["components", "컴포넌트", "square-parking"],
    ["patterns", "화면과 인터랙션", "map"],
    ["handoff", "개발 전달", "copy"],
  ];
  return (
    <div className="mv-system studio">
      <aside className="studio-sidebar">
        <a
          className="studio-brand"
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
        >
          <span className="brand-symbol">
            <Icon name="waves" size={26} />
          </span>
          <span>
            모두밸리<small>DESIGN SYSTEM</small>
          </span>
        </a>
        <div className="version-label">
          <span /> UI Library 1.1
        </div>
        <nav aria-label="디자인 시스템 문서">
          {nav.map(([id, label, icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => navigate(id)}
            >
              <Icon name={icon} size={20} />
              {label}
              {page === id && <Icon name="chevron-right" size={16} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <p>
            덜 헤매고,
            <br />더 오래 즐기는 계곡.
          </p>
          <a href="../kakaomap-reference/index.html#recordings">
            실기기 레퍼런스 <Icon name="chevron-right" size={16} />
          </a>
          <a href="../system/index.html">
            이전 설계 골격 <Icon name="chevron-right" size={16} />
          </a>
        </div>
      </aside>
      <div className="studio-main">
        <header className="studio-top">
          <div className="studio-breadcrumb">
            <span>모두밸리</span>
            <span>/</span>
            <strong>
              {nav.find((n) => n[0] === page)?.[1] || "시스템 개요"}
            </strong>
          </div>
          <div className="studio-top-actions">
            <button className="theme-button" onClick={toggleTheme}>
              <Icon
                name={theme === "light" ? "layers" : "shield-check"}
                size={20}
              />
              {theme === "light" ? "다크 보기" : "라이트 보기"}
            </button>
            <a
              href="design-system-package.zip"
              download
              className="source-download"
            >
              <Icon name="copy" size={16} />
              <span>원본 받기</span>
            </a>
          </div>
        </header>
        <main>
          {page === "reference" && <ReferencePage />}
          {page === "overview" && (
            <>
              <div className="overview-grid">
                <div className="overview-copy">
                  <p className="studio-eyebrow">MODUVALLEY / MOBILE FIRST</p>
                  <h1>
                    명확한 선택.
                    <br />
                    편안한 현장 경험.
                  </h1>
                  <p className="studio-lead">
                    어디로 갈지 고르는 순간부터
                    <br />
                    계곡에서 필요한 정보를 찾는 순간까지.
                  </p>
                  <p className="overview-description">
                    디자인 토큰, 재사용 컴포넌트, 서비스 흐름을
                    <br className="desktop-break" /> 실제로 작동하는 하나의 UI
                    언어로 연결합니다.
                  </p>
                  <div className="mv-inline">
                    <Button
                      onClick={() => navigate("components")}
                      icon="layers"
                    >
                      컴포넌트 살펴보기
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => navigate("patterns")}
                    >
                      흐름 체험
                    </Button>
                  </div>
                  <div className="overview-numbers">
                    <div>
                      <strong>2</strong>
                      <span>검토 가능한 테마</span>
                    </div>
                    <div>
                      <strong>24</strong>
                      <span>공개 UI 컴포넌트</span>
                    </div>
                    <div>
                      <strong>1</strong>
                      <span>공유 토큰 원본</span>
                    </div>
                  </div>
                  <div className="overview-note">
                    <Badge status="success">실제 컴포넌트</Badge>
                    <p>
                      이 페이지와 모바일 예시는 같은 컴포넌트를 사용합니다.
                      이미지 목업을 교체한 화면이 아닙니다.
                    </p>
                  </div>
                </div>
                <div className="overview-preview">
                  <div className="preview-caption">
                    <span>DISCOVER / 선정 전</span>
                    <span>LIVE UI</span>
                  </div>
                  <JourneyPreview onTheme={toggleTheme} />
                </div>
              </div>
              <div className="principle-grid">
                <Card>
                  <span className="principle-number">01</span>
                  <h3>선택 대상이 흔들리지 않게</h3>
                  <p>
                    계곡은 미리보기로, 시설은 해당 시설 지도로. 제목·핀·목적지가
                    같은 대상을 가리킵니다.
                  </p>
                </Card>
                <Card>
                  <span className="principle-number">02</span>
                  <h3>정보의 확실함까지 보여주기</h3>
                  <p>
                    위험 단계, 관측 근거, 자료 상태를 분리합니다. 미확인을
                    안전으로 꾸미지 않습니다.
                  </p>
                </Card>
                <Card>
                  <span className="principle-number">03</span>
                  <h3>작은 화면에서도 편안하게</h3>
                  <p>
                    48px 조작 영역, 충분한 글자 크기, 고정 행동의 여백. 손가락과
                    시선의 흐름을 함께 설계합니다.
                  </p>
                </Card>
              </div>
            </>
          )}
          {page === "foundation" && (
            <>
              <PageTitle
                eyebrow="FOUNDATION"
                title="화면이 달라도 같은 기준."
                description="하나의 JSON 원본에서 라이트·다크 CSS와 전달용 토큰을 생성합니다."
              />
              <section className="doc-section">
                <SectionTitle
                  number="01"
                  title="Semantic color"
                  subtitle="색 이름 대신 역할로 사용합니다. 테마를 바꾸면 모든 컴포넌트가 같이 바뀝니다."
                />
                <div className="color-grid">
                  {Object.entries(tokens.color[theme])
                    .filter(([k]) => k !== "scrim")
                    .map(([k, v]) => (
                      <button
                        className="color-swatch"
                        key={k}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              `--mv-${k}: ${v}`,
                            );
                            setToast("토큰을 복사했습니다.");
                          } catch {
                            setToast(
                              "복사를 지원하지 않는 환경입니다. 원본 토큰을 내려받아주세요.",
                            );
                          }
                        }}
                      >
                        <i style={{ background: v }} />
                        <span>{k}</span>
                        <small>{v}</small>
                      </button>
                    ))}
                </div>
              </section>
              <section className="doc-section">
                <SectionTitle
                  number="02"
                  title="Typography"
                  subtitle="한국어를 읽는 리듬에 맞춘 크기·행간·굵기. 360px에서도 일괄 축소하지 않습니다."
                />
                <div className="type-table">
                  {Object.entries(tokens.type).map(([k, t]) => (
                    <div key={k}>
                      <span>
                        {k}
                        <small>
                          {t.size} / {t.lineHeight} / {t.weight}
                        </small>
                      </span>
                      <p
                        style={{
                          fontSize: t.size,
                          lineHeight: `${t.lineHeight}px`,
                          fontWeight: t.weight,
                        }}
                      >
                        백운계곡에서 보내는 하루
                      </p>
                    </div>
                  ))}
                </div>
              </section>
              <section className="doc-section">
                <SectionTitle
                  number="03"
                  title="Space & anatomy"
                  subtitle="4px 단위의 간격. 컴포넌트의 내부 여백과 컴포넌트 사이 간격을 구별합니다."
                />
                <div className="space-row">
                  {Object.entries(tokens.space).map(([k, v]) => (
                    <div key={k}>
                      <i style={{ width: v }} />
                      <strong>{v}</strong>
                      <small>space-{k}</small>
                    </div>
                  ))}
                </div>
                <div className="anatomy-grid">
                  <Card>
                    <h3>검색 필드</h3>
                    <div className="anatomy-specimen">
                      <SearchDemo />
                    </div>
                    <p>
                      조작 48 · 둥근 면 40 · 아이콘 24
                      <br />
                      아이콘–텍스트 8 · 본문 16/24
                    </p>
                  </Card>
                  <Card>
                    <h3>주요 행동</h3>
                    <div className="anatomy-specimen">
                      <Button
                        icon="navigation"
                        onClick={() => setToast("버튼의 실제 눌림 상태입니다.")}
                      >
                        시설 길찾기
                      </Button>
                    </div>
                    <p>
                      높이 48 · 좌우 12 · radius 8
                      <br />
                      아이콘 20 · 그룹 중앙 정렬
                    </p>
                  </Card>
                  <Card>
                    <h3>선택 카드</h3>
                    <div className="anatomy-specimen">
                      <FacilityRow
                        name="공영주차장"
                        type="주차장"
                        valley="백운계곡"
                        onClick={() =>
                          setToast("시설은 별도 목적지로 연결합니다.")
                        }
                      />
                    </div>
                    <p>
                      카드 내부 16 · 아이콘 타일 40
                      <br />
                      타일–텍스트 12 · 제목–메타 4
                    </p>
                  </Card>
                  <Card>
                    <h3>아이콘 버튼</h3>
                    <div className="anatomy-specimen">
                      <IconButton
                        label="설정 표본"
                        icon="settings-2"
                        onClick={() =>
                          setToast("24px 도형에 48px 조작 영역입니다.")
                        }
                      />
                    </div>
                    <p>
                      도형 24 · 조작 영역 48
                      <br />
                      테두리 포함 중앙 정렬
                    </p>
                  </Card>
                </div>
              </section>
              <section className="doc-section">
                <SectionTitle
                  number="04"
                  title="Motion & layers"
                  subtitle="장소의 맥락을 유지하는 움직임. 움직임 감소 설정에서는 즉시 전환합니다."
                />
                <div className="mv-two">
                  <Card>
                    <h3>120 / 220 / 300ms</h3>
                    <p>눌림 / 시트 / 지도 어댑터 제안값</p>
                    <p className="code-label">cubic-bezier(.2,.8,.2,1)</p>
                  </Card>
                  <Card>
                    <h3>위험 표시가 시트보다 위</h3>
                    <p>지도 → 도구 → 시트 → 위험 → 모달 → 알림</p>
                    <p>
                      안전 관련 배지는 일반 선택 초록과 별도 의미를 가집니다.
                    </p>
                  </Card>
                </div>
              </section>
            </>
          )}
          {page === "components" && (
            <>
              <PageTitle
                eyebrow="COMPONENTS"
                title="가벼운 면과, 분명한 정보 위계."
                description="각 표본을 직접 누르고 입력해보세요. 상태·규격·사용 계약과 코드 인터페이스를 함께 제공합니다."
              />
              <div className="component-controls">
                <SearchField
                  label="컴포넌트 검색"
                  value={search}
                  onChange={setSearch}
                />
                <div className="mv-inline">
                  {["전체", "행동", "입력", "콘텐츠", "탐색", "피드백"].map(
                    (g) => (
                      <Chip
                        key={g}
                        selected={group === g}
                        onClick={() => setGroup(g)}
                      >
                        {g}
                      </Chip>
                    ),
                  )}
                </div>
              </div>
              <div className="component-stories">
                {catalog
                  .filter(
                    (c) =>
                      (group === "전체" || c.group === group) &&
                      (c.name + c.ko)
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  )
                  .map((c, i) => (
                    <article
                      className="story"
                      id={`component-${c.id}`}
                      key={c.id}
                    >
                      <div className="story-title">
                        <span>
                          {String(i + 1).padStart(2, "0")} / {c.group}
                        </span>
                        <h2>
                          {c.name}
                          <small>{c.ko}</small>
                        </h2>
                        <p>{c.spec}</p>
                      </div>
                      <div className="story-demo">
                        <ComponentDemo
                          id={c.id}
                          toast={setToast}
                          openReport={() => setShowReport(true)}
                        />
                      </div>
                      <div className="story-contract">
                        <p>{c.contract}</p>
                        <details>
                          <summary>인터페이스와 구현 위치</summary>
                          <code>{c.props}</code>
                          <p>source/components.jsx · source/components.css</p>
                        </details>
                      </div>
                    </article>
                  ))}
              </div>
              {!catalog.some(
                (c) =>
                  (group === "전체" || c.group === group) &&
                  (c.name + c.ko).toLowerCase().includes(search.toLowerCase()),
              ) && (
                <EmptyState
                  title="일치하는 컴포넌트가 없어요"
                  description="이름이나 범주를 바꿔보세요."
                  action={
                    <Button
                      onClick={() => {
                        setSearch("");
                        setGroup("전체");
                      }}
                    >
                      모두 보기
                    </Button>
                  }
                />
              )}
            </>
          )}
          {page === "patterns" && (
            <>
              <PageTitle
                eyebrow="PATTERNS / LIVE JOURNEY"
                title="실제 조합에서 확인하는 디자인."
                description="계곡·시설 검색, 선정과 해제, 지도 시트, 제보 입력을 같은 컴포넌트로 연결했습니다."
              />
              <div className="pattern-workbench">
                <aside className="pattern-inspector">
                  <Card>
                    <h3>화면 조건</h3>
                    <label className="inspector-label">원본 너비</label>
                    <Segmented
                      label="예시 화면 너비"
                      value={width}
                      onChange={setWidth}
                      options={[
                        { value: 360, label: "360px" },
                        { value: 390, label: "390px" },
                      ]}
                    />
                    <label className="inspector-label" htmlFor="risk-state">
                      강우 상태
                    </label>
                    <select
                      id="risk-state"
                      value={risk}
                      onChange={(e) => setRisk(e.target.value)}
                    >
                      {[
                        ["unknown", "자료 없음"],
                        ["caution", "주의 · 추정"],
                        ["warning", "경보 · 관측"],
                        ["evacuate", "대피"],
                        ["stale", "자료 지연"],
                        ["error", "연결 실패"],
                      ].map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <Switch
                      label="긴 이름 확인"
                      checked={longText}
                      onChange={setLongText}
                      description="줄바꿈과 고정 영역의 겹침"
                    />
                    <Switch
                      label="제보 실패 재현"
                      checked={fail}
                      onChange={setFail}
                      description="실패해도 입력 내용을 보존"
                    />
                  </Card>
                  <Card>
                    <h3>확인할 흐름</h3>
                    <a
                      className="mobile-preview-link"
                      href="preview.html"
                      target="_blank"
                      rel="noreferrer"
                    >
                      모바일 화면만 열기 ↗
                    </a>
                    <ol>
                      <li>‘백운’ 검색 → 계곡 미리보기 → 선정</li>
                      <li>구간 정보 → 시설 → 공영주차장</li>
                      <li>선정 해제 → 검색어 복원</li>
                      <li>제보 작성 → 입력 → 실패 → 내용 유지</li>
                    </ol>
                  </Card>
                  <Notice>
                    실제 지도·경보·길찾기·서버 전송은 어댑터 연결 지점입니다.
                    시연 데이터는 토큰·UI 검토용입니다.
                  </Notice>
                </aside>
                <div className="pattern-device" style={{ maxWidth: width }}>
                  <JourneyPreview
                    risk={risk}
                    longText={longText}
                    failSubmit={fail}
                    onTheme={toggleTheme}
                  />
                </div>
              </div>
            </>
          )}
          {page === "handoff" && (
            <>
              <PageTitle
                eyebrow="DESIGN → ENGINEERING"
                title="개발에 연결할 수 있는 원본."
                description="토큰, 재사용 React UI, 서비스 패턴, 사용 계약을 분리해 전달합니다."
              />
              <div className="handoff-grid">
                <Card>
                  <Icon name="layers" size={28} />
                  <h3>공유 토큰</h3>
                  <p>
                    라이트·다크 의미별 색, 역할별 타입, 간격·모서리·모션·레이어.
                    CSS를 JSON에서 생성합니다.
                  </p>
                  <a href="tokens.json" download>
                    tokens.json 받기 ↗
                  </a>
                </Card>
                <Card>
                  <Icon name="square-parking" size={28} />
                  <h3>React UI 라이브러리</h3>
                  <p>
                    React 18 기반 ESM. 제어형 입력과 콜백으로 제품 상태에
                    연결합니다. React는 외부 의존성입니다.
                  </p>
                  <a href="library/index.js" download>
                    컴포넌트 ESM 받기 ↗
                  </a>
                  <a href="library/index.css" download>
                    컴포넌트 CSS 받기 ↗
                  </a>
                </Card>
                <Card>
                  <Icon name="map" size={28} />
                  <h3>패턴과 계약</h3>
                  <p>
                    선정 전/후, 시설 목적지, 위험 상태, 시트, 제보 실패의 상태
                    보존과 연결 규칙.
                  </p>
                  <a href="IMPLEMENTATION.md">구현 계약 읽기 ↗</a>
                </Card>
                <Card>
                  <Icon name="shield-check" size={28} />
                  <h3>검수와 적용 범위</h3>
                  <p>
                    브라우저에서 확인한 결과와 지도·네이티브·서버 연결 시 필요한
                    검증을 구분합니다.
                  </p>
                  <a href="QA.md">검수 기록 ↗</a>
                </Card>
              </div>
              <Card className="integration-card">
                <h3>제품에 적용하는 방법</h3>
                <pre>
                  <code>{`import { Button, IconProvider } from './library/index.js';\nimport './library/index.css';\n\n<IconProvider baseUrl="/assets/moduvalley/icons">\n  <div className="mv-system" data-theme="light">\n    <Button icon="navigation" onClick={openDirections}>\n      시설 길찾기\n    </Button>\n  </div>\n</IconProvider>`}</code>
                </pre>
                <Notice>
                  디자인 토큰과 사용 계약은 플랫폼 공통입니다. 이 참조 구현은 웹
                  React이며, iOS/Android 네이티브에는 각 플랫폼 UI 및 지도
                  어댑터로 적용합니다.
                </Notice>
              </Card>
              <div className="mv-inline" style={{ marginTop: 24 }}>
                <a
                  className="mv-button mv-button--primary"
                  href="design-system-package.zip"
                  download
                >
                  <Icon name="copy" size={20} />
                  전체 소스·문서 받기
                </a>
                <a
                  className="mv-button mv-button--secondary"
                  href="../kakaomap-reference/index.html#recordings"
                >
                  인터랙션 레퍼런스
                </a>
              </div>
            </>
          )}
        </main>
        <footer className="studio-footer">
          <span>모두밸리 Design System · 1.0</span>
          <span>명확한 선택에서 편안한 현장 경험까지.</span>
        </footer>
      </div>
      <ReportComposer
        open={showReport}
        onClose={() => setShowReport(false)}
        onComplete={() => setToast("시연 제보가 등록되었습니다.")}
      />
      <Toast message={toast} onDismiss={dismiss} />
    </div>
  );
}
function PageTitle({ eyebrow, title, description }) {
  return (
    <div className="page-title">
      <p className="studio-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
function SectionTitle({ number, title, subtitle }) {
  return (
    <div className="section-title">
      <span>{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}
function SearchDemo() {
  const [v, set] = useState("");
  return <SearchField value={v} onChange={set} />;
}
function ComponentDemo({ id, toast, openReport }) {
  const [v, set] = useState(""),
    [chosen, choose] = useState(false),
    [tab, setTab] = useState("segment"),
    [time, setTime] = useState(14),
    [open, setOpen] = useState(false),
    [photos, setPhotos] = useState([]),
    [busy, setBusy] = useState(false);
  if (id === "button")
    return (
      <>
        <div className="mv-inline">
          <Button
            icon="map"
            onClick={() => toast("주요 행동이 실행되었습니다.")}
          >
            이 계곡 선택
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast("보조 행동을 선택했습니다.")}
          >
            구간 정보
          </Button>
          <Button
            variant="ghost"
            onClick={() => toast("텍스트 행동을 선택했습니다.")}
          >
            나중에
          </Button>
          <Button variant="danger" icon="trash-2" onClick={() => setOpen(true)}>
            내용 폐기
          </Button>
        </div>
        <div className="mv-inline">
          <Button disabled>내용 입력 필요</Button>
          <Button loading>등록 중</Button>
          <Button
            loading={busy}
            variant="secondary"
            onClick={() => {
              setBusy(true);
              setTimeout(() => {
                setBusy(false);
                toast("처리가 완료되었습니다.");
              }, 800);
            }}
          >
            처리 상태 체험
          </Button>
        </div>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="내용을 폐기할까요?"
          description="폐기한 내용은 복구할 수 없습니다."
          destructive
          footer={
            <>
              <Button autoFocus onClick={() => setOpen(false)}>
                계속 쓰기
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setOpen(false);
                  toast("내용 폐기 동작을 확인했습니다.");
                }}
              >
                내용 폐기
              </Button>
            </>
          }
        />
      </>
    );
  if (id === "icon")
    return (
      <>
        <div className="mv-inline">
          {["search", "arrow-left", "x", "settings-2", "compass"].map((n) => (
            <IconButton
              key={n}
              icon={n}
              label={`${n} 아이콘 표본`}
              onClick={() => toast("48px 조작 영역입니다.")}
            />
          ))}
        </div>
        <div className="mv-inline">
          <MapTool
            label="그늘"
            icon="tree-pine"
            selected={chosen}
            onClick={() => choose(!chosen)}
          />
          <MapTool
            label="시설"
            icon="square-parking"
            onClick={() => toast("시설 도구")}
          />
          <MapTool
            label="토지"
            icon="layers"
            onClick={() => toast("토지 도구")}
          />
          <MapTool label="제보" icon="message-square" onClick={openReport} />
        </div>
        <Notice>선택된 그늘 도구를 다시 누르면 해제됩니다.</Notice>
      </>
    );
  if (id === "field")
    return (
      <div className="mv-two">
        <Field
          label="계곡 이름"
          value={v}
          onChange={(e) => set(e.target.value)}
          placeholder="이름을 입력하세요"
          hint="입력해도 라벨은 남습니다."
        />
        <Field
          label="제보 내용"
          required
          multiline
          value={v}
          onChange={(e) => set(e.target.value)}
          error={!v ? "내용을 입력해주세요." : undefined}
          hint={v ? "입력값이 두 표본에 공유됩니다." : undefined}
        />
        <Field
          label="확인된 좌표"
          readOnly
          value="37.00000, 127.00000"
          hint="시연용 좌표 · 읽기 전용"
        />
        <Field
          label="연결 대기"
          disabled
          placeholder="현재 사용할 수 없습니다"
        />
      </div>
    );
  if (id === "search")
    return (
      <>
        <SearchField value={v} onChange={set} />
        <Notice>
          {v
            ? `입력: ${v} · 지우기는 검색어만 비웁니다.`
            : "시설과 계곡이 같은 검색창에 나타나도 목적지는 다릅니다."}
        </Notice>
      </>
    );
  if (id === "chip")
    return (
      <>
        <div className="mv-inline">
          <Chip icon="toilet" selected={chosen} onClick={() => choose(!chosen)}>
            화장실
          </Chip>
          <Chip selected={!chosen} onClick={() => choose(!chosen)}>
            주차장
          </Chip>
          <Chip disabled>자료 없음</Chip>
        </div>
        <Segmented
          label="구간 선택 표본"
          value={tab}
          onChange={setTab}
          options={[
            { value: "up", label: "상류" },
            { value: "segment", label: "중류" },
            { value: "down", label: "하류" },
          ]}
        />
      </>
    );
  if (id === "switch")
    return (
      <>
        <Switch
          label="그늘 레이어"
          description="시간별 예상 그늘을 표시합니다."
          checked={chosen}
          onChange={choose}
        />
        <Switch
          label="자료 수신 대기"
          checked={false}
          disabled
          onChange={() => {}}
        />
      </>
    );
  if (id === "status")
    return (
      <>
        <div className="mv-inline">
          {[
            "caution",
            "warning",
            "evacuate",
            "observed",
            "estimated",
            "unknown",
            "stale",
            "error",
          ].map((s) => (
            <Badge key={s} status={s} />
          ))}
        </div>
        <Alert status="caution" title="상류 강우 주의 · 추정">
          인접 우량계 근거 · 관측 시각 별도 표시
        </Alert>
        <Alert status="unknown" title="강우 판단 자료가 없습니다">
          자료 없음은 안전을 뜻하지 않습니다.
        </Alert>
        <Alert
          status="error"
          title="관측 정보 연결 실패"
          action={
            <Button
              variant="secondary"
              onClick={() => toast("재시도 연결 지점입니다.")}
            >
              다시 시도
            </Button>
          }
        >
          마지막 수신 시각과 현재 상태를 구분합니다.
        </Alert>
      </>
    );
  if (id === "cards")
    return (
      <>
        <ValleyCard
          name="백운계곡"
          region="경기 포천"
          rank={1}
          description="주간 순위 시연"
          onClick={() => toast("계곡 → 미리보기")}
        />
        <FacilityRow
          name="공영주차장"
          valley="백운계곡"
          type="주차장"
          onClick={() => toast("시설 → 시설 지도")}
        />
        <ValleyCard
          name="광주 무등산 원효계곡 · 상류 탐방로 연결 구간"
          region="긴 이름 줄바꿈 검토"
          onClick={() => toast("긴 이름도 전체를 읽을 수 있습니다.")}
        />
      </>
    );
  if (id === "metric")
    return (
      <Card>
        <div className="mv-two">
          <Metric icon="waves" label="수심" value="미확인" />
          <Metric icon="square-parking" label="주차장" value="위치 정보 있음" />
        </div>
        <div style={{ marginTop: 24 }}>
          <Notice>공식 출처와 기준일을 항목 가까이 표시합니다.</Notice>
        </div>
      </Card>
    );
  if (id === "tabs")
    return (
      <>
        <Tabs
          label="현장 정보 표본"
          value={tab}
          onChange={setTab}
          options={[
            { value: "segment", label: "구간 정보" },
            { value: "facilities", label: "시설" },
            { value: "reports", label: "제보" },
          ]}
        />
        <div className="tab-example" role="tabpanel">
          {tab === "segment"
            ? "수심·바닥·이용 조건"
            : tab === "facilities"
              ? "선택한 계곡의 주변 시설"
              : "최근 24시간 현장 제보"}
        </div>
      </>
    );
  if (id === "empty")
    return (
      <div className="mv-two">
        <EmptyState
          title="조건에 맞는 계곡이 없어요"
          description="미확인 조건은 충족으로 표시하지 않습니다."
          action={
            <Button variant="secondary" onClick={() => toast("필터 초기화")}>
              필터 초기화
            </Button>
          }
        />
        <Skeleton rows={3} />
      </div>
    );
  if (id === "time") return <TimePicker value={time} onChange={setTime} />;
  if (id === "dialog")
    return (
      <>
        <div className="mv-inline">
          <Button onClick={() => setOpen(true)}>확인 시트 열기</Button>
          <Button
            variant="secondary"
            icon="copy"
            onClick={() => toast("복사 완료 · 피드백 표본")}
          >
            결과 알림 보기
          </Button>
        </div>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="작성을 그만둘까요?"
          description="내용을 폐기하면 작성한 정보가 사라집니다."
          destructive
          footer={
            <>
              <Button autoFocus onClick={() => setOpen(false)}>
                계속 쓰기
              </Button>
              <Button variant="danger" onClick={() => setOpen(false)}>
                내용 폐기
              </Button>
            </>
          }
        />
      </>
    );
  if (id === "photo")
    return (
      <>
        <PhotoInput value={photos} onChange={setPhotos} />
        <Notice>기기 내 미리보기 · 서버 전송 없음</Notice>
      </>
    );
  return (
    <>
      <p className="demo-copy">
        접힘 → 중간 → 전체. 같은 장소의 정보를 확장하며, 선택 해제는 별도
        동작입니다.
      </p>
      <Button
        icon="map"
        onClick={() => {
          history.replaceState(null, "", "#patterns");
          location.reload();
        }}
      >
        실제 지도 시트에서 체험
      </Button>
      <Notice>
        화면과 인터랙션에서 손잡이 드래그 또는 단계 버튼으로 확인할 수 있습니다.
      </Notice>
    </>
  );
}
function Standalone() {
  const [dark, setDark] = useState(false);
  return (
    <div className="mv-system preview-only">
      <JourneyPreview
        risk={new URLSearchParams(location.search).get("risk") || "unknown"}
        longText={new URLSearchParams(location.search).has("long")}
        failSubmit={new URLSearchParams(location.search).has("fail")}
        onTheme={() => {
          document.documentElement.dataset.theme = dark ? "light" : "dark";
          setDark(!dark);
        }}
      />
    </div>
  );
}
createRoot(document.getElementById("root")).render(
  location.pathname.endsWith("/preview.html") ? <Standalone /> : <Studio />,
);
