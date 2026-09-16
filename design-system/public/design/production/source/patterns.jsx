import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Icon,
  Button,
  IconButton,
  SearchField,
  Chip,
  Badge,
  Alert,
  Card,
  ValleyCard,
  FacilityRow,
  Metric,
  Tabs,
  EmptyState,
  TimePicker,
  Dialog,
  Toast,
  MapTool,
  MapSheet,
  PhotoInput,
  Field,
  Notice,
} from "./components.jsx";
import {
  valleys,
  facilities,
  filterOptions,
  searchPlaces,
  validateReport,
} from "./model.js";
const reportTypes = [
  "불법 사유지",
  "쓰레기",
  "긴급 신고",
  "계곡 새정보",
  "미아찾기",
  "물건찾기",
];
export function ReportComposer({
  open,
  onClose,
  onComplete,
  fail = false,
  risk = "unknown",
}) {
  const [body, setBody] = useState(""),
    [type, setType] = useState("쓰레기"),
    [photos, setPhotos] = useState([]),
    [location, setLocation] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [locationDialog, setLocationDialog] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const reset = () => {
    setBody("");
    setPhotos([]);
    setLocation(false);
    setError("");
  };
  const requestClose = () => {
    if (busy) return;
    if (body || photos.length || location) setConfirm(true);
    else onClose();
  };
  const submit = () => {
    const problem = validateReport({ body });
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    timer.current = setTimeout(() => {
      setBusy(false);
      if (fail) setError("전송하지 못했어요. 작성한 내용은 그대로 보관됩니다.");
      else {
        onComplete({ body, type, location });
        reset();
        onClose();
      }
    }, 700);
  };
  return (
    <>
      <Dialog
        open={open}
        onClose={requestClose}
        title="현장 제보 작성"
        description="선택한 계곡의 현재 상황을 알려주세요."
        footer={
          <>
            <Button variant="secondary" onClick={requestClose} disabled={busy}>
              취소
            </Button>
            <Button loading={busy} onClick={submit}>
              {busy ? "등록 중" : "제보 등록"}
            </Button>
          </>
        }
      >
        {["warning", "evacuate"].includes(risk) && (
          <Alert status={risk} title={weatherCopy[risk][0]}>
            {weatherCopy[risk][1]}
          </Alert>
        )}
        <div className="mv-field">
          <label>
            유형 <span className="mv-required">필수</span>
          </label>
          <div className="report-types">
            {reportTypes.map((t) => (
              <Chip key={t} selected={type === t} onClick={() => setType(t)}>
                {t}
              </Chip>
            ))}
          </div>
        </div>
        <Field
          label="내용"
          required
          multiline
          value={body}
          maxLength={500}
          onChange={(e) => {
            setBody(e.target.value);
            setError("");
          }}
          placeholder="어디에서 어떤 상황을 보셨나요?"
          hint={`${body.length} / 500자`}
          error={error}
          disabled={busy}
        />
        <PhotoInput value={photos} onChange={setPhotos} />
        <Button
          variant="secondary"
          icon="locate-fixed"
          onClick={() => setLocationDialog(true)}
        >
          {location ? "공개 위치 수정" : "공개할 위치 지정"}
        </Button>
        {location && (
          <Badge status="success">제보 위치 지정됨 · 시연 좌표</Badge>
        )}
        <Notice>
          사진과 직접 지정한 위치가 제보에 공개됩니다. 이 화면에서는 서버로
          전송하지 않습니다.
        </Notice>
      </Dialog>
      <Dialog
        open={locationDialog}
        onClose={() => setLocationDialog(false)}
        title="공개 위치 확인"
        description="지도 지점을 지정하는 화면의 디자인 예시입니다."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setLocationDialog(false)}
            >
              취소
            </Button>
            <Button
              onClick={() => {
                setLocation(true);
                setLocationDialog(false);
              }}
            >
              이 위치 사용
            </Button>
          </>
        }
      >
        <div className="location-example">
          <img src="map-reference.svg" alt="위치 지정용 지도 도식" />
          <Icon name="locate-fixed" size={32} />
        </div>
        <Notice>37.00000, 127.00000 · 위치 시연 값</Notice>
      </Dialog>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="작성을 그만둘까요?"
        description="내용을 폐기하면 작성한 정보가 사라집니다."
        destructive
        footer={
          <>
            <Button autoFocus onClick={() => setConfirm(false)}>
              계속 쓰기
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirm(false);
                reset();
                onClose();
              }}
            >
              내용 폐기
            </Button>
          </>
        }
      />
    </>
  );
}
const weatherCopy = {
  unknown: ["강우 판단 자료가 없습니다", "자료 없음은 안전을 뜻하지 않습니다."],
  caution: ["상류 강우 주의 · 추정", "인접 관측 기준 · 단계 표시 시연"],
  warning: ["상류 강우 경보 · 관측", "공식 안내를 확인하세요 · 시연"],
  evacuate: [
    "대피 안내를 확인하세요",
    "현장 통제와 공식 지침을 우선하세요 · 시연",
  ],
  stale: [
    "관측 자료가 지연되고 있어요",
    "마지막 수신 시각을 확인하세요 · 시연",
  ],
  error: [
    "관측 정보를 불러오지 못했어요",
    "연결 상태를 확인하고 다시 시도해주세요.",
  ],
};
export function JourneyPreview({
  risk = "unknown",
  longText = false,
  failSubmit = false,
  onTheme,
}) {
  const [segment, setSegment] = useState("중류"),
    [safeTop, setSafeTop] = useState(180);
  const mapTop = useRef(null);
  const [query, setQuery] = useState(""),
    [filters, setFilters] = useState([]),
    [candidate, setCandidate] = useState(null),
    [selected, setSelected] = useState(null),
    [sheet, setSheet] = useState("peek"),
    [tab, setTab] = useState("segment"),
    [shade, setShade] = useState(false),
    [land, setLand] = useState(false),
    [time, setTime] = useState(14),
    [report, setReport] = useState(false),
    [reports, setReports] = useState([]),
    [info, setInfo] = useState(null),
    [toast, setToast] = useState("");
  const dismiss = useCallback(() => setToast(""), []);
  const list = searchPlaces(query, filters);
  const selectedValley = selected
    ? selected.kind === "facility"
      ? valleys.find((v) => v.id === selected.valleyId)
      : selected
    : null;
  const valleyName = (v) =>
    longText ? `${v.name} · 상류 탐방로 연결 구간` : v.name;
  const pick = (item) => {
    if (item.kind === "facility") {
      setSelected(item);
      setSheet("peek");
    } else setCandidate(item);
  };
  const closeSelection = () => {
    setSelected(null);
    setCandidate(null);
    setShade(false);
    setLand(false);
    setSheet("peek");
  };
  const [weatherTitle, weatherDetail] =
    weatherCopy[risk] || weatherCopy.unknown;
  useEffect(() => {
    const el = mapTop.current;
    if (!el) return;
    const measure = () => setSafeTop(el.offsetTop + el.offsetHeight + 12);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [selected, risk, longText]);
  return (
    <div
      className={`journey-app ${selected ? "journey-app--map" : ""} ${longText ? "stress-long" : ""} ${query && !selected && !candidate ? "journey-app--search" : ""}`}
      data-testid="journey"
    >
      <div className="journey-demo-label">
        <span>모바일 적용 예시</span>
        <span>데이터·지도 시연</span>
      </div>
      {!selected && !candidate && (
        <>
          <header className="app-home-header">
            <div>
              <span className="app-wordmark">
                모두밸리
                <span className="wordmark-dot" />
              </span>
              <p>계곡을 더 잘 즐기는 방법</p>
            </div>
            <IconButton label="테마 전환" icon="settings-2" onClick={onTheme} />
          </header>
          <div className="app-search">
            <SearchField
              value={query}
              onChange={setQuery}
              onBack={query ? () => setQuery("") : undefined}
            />
          </div>
          <div className="app-scroll">
            {query ? (
              <>
                <div className="app-section-heading">
                  <h3>
                    검색 결과 <span>{list.length}</span>
                  </h3>
                  <Button variant="ghost" onClick={() => setQuery("")}>
                    취소
                  </Button>
                </div>
                <Notice>검색 중에는 조건 필터를 적용하지 않습니다.</Notice>
                <div className="app-list">
                  {list.map((v) =>
                    v.kind === "valley" ? (
                      <ValleyCard
                        key={v.id}
                        name={valleyName(v)}
                        region={v.region}
                        description="계곡 미리보기"
                        onClick={() => pick(v)}
                      />
                    ) : (
                      <FacilityRow
                        key={v.id}
                        name={v.name}
                        type={v.type}
                        valley="백운계곡"
                        onClick={() => pick(v)}
                      />
                    ),
                  )}
                </div>
                {!list.length && (
                  <EmptyState
                    title="검색 결과가 없어요"
                    description="계곡 이름이나 시설 이름을 바꿔보세요."
                    action={
                      <Button variant="secondary" onClick={() => setQuery("")}>
                        검색어 지우기
                      </Button>
                    }
                  />
                )}
              </>
            ) : (
              <>
                <div className="weekly-card">
                  <div className="weekly-tag">
                    <Icon name="calendar-days" size={16} /> 이번 주 안내
                  </div>
                  <h2>이번 주, 방문 전 확인하세요</h2>
                  <p>현장 통제 · 이용 구간 · 기상 안내</p>
                  <button
                    onClick={() => setInfo("이번 주 안내")}
                    className="weekly-link"
                  >
                    방문 전 확인사항 <Icon name="chevron-right" size={20} />
                  </button>
                  <Icon name="shield-check" size={52} />
                </div>
                <div className="app-section-heading">
                  <h3>어떤 계곡을 찾으세요?</h3>
                </div>
                <div className="app-chip-scroll">
                  {filterOptions.map((f) => (
                    <Chip
                      key={f.value}
                      icon={f.icon}
                      selected={filters.includes(f.value)}
                      onClick={() =>
                        setFilters(
                          filters.includes(f.value)
                            ? filters.filter((x) => x !== f.value)
                            : [...filters, f.value],
                        )
                      }
                    >
                      {f.label}
                    </Chip>
                  ))}
                </div>
                <div className="app-section-heading">
                  <h3>
                    {filters.length ? "조건에 맞는 계곡" : "이번 주 관심 계곡"}
                  </h3>
                  <span>
                    {filters.length ? `${list.length}곳` : "예시 순위"}
                  </span>
                </div>
                {!!filters.length && (
                  <Notice>미확인 조건은 결과에서 제외됩니다.</Notice>
                )}
                <div className="app-list">
                  {list.map((v, i) => (
                    <ValleyCard
                      key={v.id}
                      name={valleyName(v)}
                      region={v.region}
                      rank={filters.length ? null : i + 1}
                      description={v.description}
                      onClick={() => pick(v)}
                    />
                  ))}
                </div>
                {!list.length && (
                  <EmptyState
                    title="조건에 맞는 계곡이 없어요"
                    description="선택한 조건을 줄여보세요. 미확인 값은 충족으로 세지 않습니다."
                    action={
                      <Button
                        variant="secondary"
                        onClick={() => setFilters([])}
                      >
                        필터 초기화
                      </Button>
                    }
                  />
                )}
                <button
                  className="safety-row"
                  onClick={() => setInfo("계곡 이용 안전 안내")}
                >
                  <Icon name="shield-check" />
                  <span>
                    <strong>안전한 물놀이의 시작</strong>
                    <small>계곡 이용 전 확인사항</small>
                  </span>
                  <Icon name="chevron-right" size={20} />
                </button>
              </>
            )}
          </div>
          <nav className="app-bottom-nav" aria-label="탐색 메뉴">
            <button
              aria-current="page"
              onClick={() => {
                setQuery("");
                setFilters([]);
              }}
            >
              <Icon name="house" />
              <span>홈</span>
            </button>
            <button
              onClick={() =>
                document
                  .querySelector('[data-testid="journey"] input[type="search"]')
                  ?.focus()
              }
            >
              <Icon name="map" />
              <span>계곡 찾기</span>
            </button>
            <button onClick={() => setInfo("표시 설정")}>
              <Icon name="settings-2" />
              <span>설정</span>
            </button>
          </nav>
        </>
      )}
      {candidate && !selected && (
        <>
          <header className="app-page-header">
            <IconButton
              label="검색으로 돌아가기"
              icon="arrow-left"
              onClick={() => setCandidate(null)}
            />
            <h3>계곡 미리보기</h3>
          </header>
          <div className="app-scroll candidate-body">
            <Badge status="unknown">이용 정보 확인 필요</Badge>
            <h2>{valleyName(candidate)}</h2>
            <p>{candidate.region} · 계곡 구간 안내</p>
            <Card>
              <h3>방문 전 확인할 정보</h3>
              <div className="app-metrics">
                <Metric label="수심" value="미확인" icon="waves" />
                <Metric label="입장료" value="미확인" icon="banknote" />
                <Metric
                  label="주차장"
                  value={candidate.parking ? "위치 정보 있음" : "미확인"}
                  icon="square-parking"
                />
                <Metric label="야영" value="공식 안내 확인" icon="tent" />
              </div>
            </Card>
            <div>
              <h3>이용 구간</h3>
              <div className="mv-inline" style={{ marginTop: 12 }}>
                {["상류", "중류", "하류"].map((s) => (
                  <Chip
                    selected={s === segment}
                    key={s}
                    onClick={() => setSegment(s)}
                  >
                    {s}
                  </Chip>
                ))}
              </div>
            </div>
            <Alert title="자료의 출처를 확인하세요">
              정보마다 기준일과 적용 구간이 다를 수 있습니다.
            </Alert>
          </div>
          <div className="app-fixed-action">
            <Button
              onClick={() => {
                setSelected({ ...candidate, kind: "valley" });
                setCandidate(null);
              }}
              icon="map"
            >
              이 계곡 선택
            </Button>
          </div>
        </>
      )}
      {selected && (
        <>
          <div className="app-map">
            <img
              src="map-reference.svg"
              alt="디자인 검토용 계곡 지도 도식"
              className="map-base"
            />
            {shade && (
              <img
                src="map-shade.svg"
                alt="예상 그늘 도식"
                className="shade-overlay"
                style={{ opacity: 0.5 + (time - 10) * 0.06 }}
              />
            )}
            {land && (
              <img
                src="map-land.svg"
                alt="토지소유 경계 도식"
                className="land-map-overlay"
              />
            )}
            <div
              className={`app-pin ${sheet === "half" ? "app-pin--raised" : ""}`}
            >
              <Icon
                name={
                  selected.kind === "facility"
                    ? selected.type === "화장실"
                      ? "toilet"
                      : "square-parking"
                    : "waves"
                }
              />
              <span>
                {selected.kind === "facility" ? selected.name : segment}
              </span>
            </div>
          </div>
          <div className="app-map-top" ref={mapTop}>
            <div className="map-place-header">
              <IconButton
                label="선정 해제하고 탐색으로"
                icon="chevron-right"
                style={{ transform: "rotate(180deg)" }}
                onClick={closeSelection}
              />
              <div>
                <strong>
                  {selected.kind === "facility"
                    ? selected.name
                    : valleyName(selectedValley)}
                </strong>
              </div>
              <IconButton label="선정 해제" icon="x" onClick={closeSelection} />
            </div>
            <Alert status={risk} title={weatherTitle}>
              {weatherDetail}
            </Alert>
          </div>
          <div
            className="app-map-tools"
            style={{
              top: safeTop + 12,
              display: sheet === "full" ? "none" : undefined,
            }}
          >
            <MapTool
              label="그늘"
              icon="tree-pine"
              selected={shade}
              onClick={() => setShade(!shade)}
            />
            <MapTool
              label="시설"
              icon="square-parking"
              selected={tab === "facilities" && sheet !== "peek"}
              onClick={() => {
                setTab("facilities");
                setSheet("half");
              }}
            />
            <MapTool
              label="토지"
              icon="layers"
              selected={land}
              onClick={() => setLand(!land)}
            />
            <MapTool
              label="제보"
              icon="message-square"
              onClick={() => {
                setTab("reports");
                setSheet("half");
              }}
            />
          </div>
          {shade && sheet === "peek" && (
            <div className="map-time">
              <TimePicker value={time} onChange={setTime} />
            </div>
          )}
          {land && sheet === "peek" && (
            <div className="map-land-notice">
              <Notice>소유구분은 출입 허가를 뜻하지 않습니다.</Notice>
            </div>
          )}
          <MapSheet
            topInset={safeTop}
            state={sheet}
            onChange={setSheet}
            title={
              selected.kind === "facility"
                ? selected.name
                : valleyName(selectedValley)
            }
            subtitle={
              selected.kind === "facility"
                ? `${selectedValley.name} · ${selected.type}`
                : `${segment} · 구간별 이용 정보`
            }
            actions={
              risk === "evacuate" ? (
                <Button
                  variant="danger"
                  icon="triangle-alert"
                  onClick={() => setInfo("대피 안내 확인")}
                >
                  대피 안내 확인
                </Button>
              ) : selected.kind === "facility" ? (
                <>
                  <Button
                    icon="navigation"
                    onClick={() => setInfo(`${selected.name} 길찾기`)}
                  >
                    길찾기
                  </Button>
                  <Button
                    variant="secondary"
                    icon="map"
                    onClick={() =>
                      setSelected({ ...selectedValley, kind: "valley" })
                    }
                  >
                    계곡 지도
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    icon="tree-pine"
                    onClick={() => {
                      setShade(!shade);
                      setSheet("peek");
                    }}
                  >
                    그늘 {shade ? "끄기" : "확인"}
                  </Button>
                  <Button
                    variant="secondary"
                    icon="info"
                    onClick={() => setSheet(sheet === "peek" ? "half" : "peek")}
                  >
                    {sheet === "peek" ? "구간 정보" : "지도 크게"}
                  </Button>
                </>
              )
            }
          >
            <Tabs
              label="현장 정보 종류"
              options={[
                { value: "segment", label: "구간 정보" },
                { value: "facilities", label: "주변 시설" },
                { value: "reports", label: "현장 제보" },
              ]}
              value={tab}
              onChange={setTab}
            />
            {tab === "segment" ? (
              <>
                <div className="app-metrics">
                  <Metric label="수심" value="미확인" icon="waves" />
                  <Metric label="이용 요금" value="미확인" icon="banknote" />
                </div>
                <Notice>각 정보의 공식 출처와 기준일을 확인하세요.</Notice>
                <SwitchRow shade={shade} setShade={setShade} />
                <Button
                  variant="secondary"
                  icon="message-square"
                  onClick={() => setReport(true)}
                >
                  현장 제보 작성
                </Button>
              </>
            ) : tab === "facilities" ? (
              <>
                {facilities
                  .filter((f) => f.valleyId === selectedValley.id)
                  .map((f) => (
                    <FacilityRow
                      key={f.id}
                      name={f.name}
                      type={f.type}
                      valley={selectedValley.name}
                      onClick={() => {
                        setSelected({ ...f, kind: "facility" });
                        setSheet("peek");
                      }}
                    />
                  ))}
                {!facilities.some((f) => f.valleyId === selectedValley.id) && (
                  <EmptyState
                    title="등록된 시설 정보가 없어요"
                    description="시설 유무를 확인할 자료가 없습니다."
                  />
                )}
              </>
            ) : (
              <>
                <Notice>최근 24시간 · 사용자 제보</Notice>
                {reports.length ? (
                  reports.map((r, i) => (
                    <Card key={i}>
                      <Badge status="success">방금 등록 · 시연</Badge>
                      <h3 style={{ marginTop: 12 }}>{r.type}</h3>
                      <p className="report-body">{r.body}</p>
                    </Card>
                  ))
                ) : (
                  <EmptyState
                    icon="message-square"
                    title="아직 올라온 제보가 없어요"
                    description="지금 현장의 상황을 알려주세요."
                  />
                )}
                <Button icon="message-square" onClick={() => setReport(true)}>
                  제보 작성
                </Button>
              </>
            )}
          </MapSheet>
        </>
      )}
      <ReportComposer
        open={report}
        risk={risk}
        fail={failSubmit}
        onClose={() => setReport(false)}
        onComplete={(r) => {
          setReports([r, ...reports]);
          setTab("reports");
          setSheet("full");
          setToast("시연 제보가 등록되었습니다.");
        }}
      />
      <Dialog
        open={!!info}
        onClose={() => setInfo(null)}
        title={info || ""}
        footer={<Button onClick={() => setInfo(null)}>닫기</Button>}
      >
        {info?.includes("길찾기") ? (
          <>
            <Icon name="navigation" size={32} />
            <p>
              목적지: <strong>{selected?.name}</strong>
            </p>
            <Notice>
              외부 지도 앱으로 해당 시설 좌표를 전달하는 연결 지점입니다. 디자인
              시연에서는 앱을 실행하지 않습니다.
            </Notice>
          </>
        ) : info === "표시 설정" ? (
          <>
            <p>눈이 편한 테마를 선택하세요.</p>
            <Button variant="secondary" onClick={onTheme}>
              라이트 / 다크 전환
            </Button>
          </>
        ) : (
          <>
            <Alert title="방문 전 공식 안내 확인">
              현장 통제와 이용 가능한 구간을 먼저 확인하세요.
            </Alert>
            <Notice>
              안전 안내의 최종 내용은 공식 출처에 따라 검수하며, 디자인 예시가
              실제 위험 판단을 제공하지 않습니다.
            </Notice>
          </>
        )}
      </Dialog>
      <Toast message={toast} onDismiss={dismiss} />
    </div>
  );
}
function SwitchRow({ shade, setShade }) {
  return (
    <button className="safety-row" onClick={() => setShade(!shade)}>
      <Icon name="tree-pine" />
      <span>
        <strong>시간별 그늘</strong>
        <small>
          {shade ? "켜짐 · 시각 선택 가능" : "계산된 예상 그늘 확인"}
        </small>
      </span>
      <Badge status={shade ? "success" : "unknown"}>
        {shade ? "켜짐" : "꺼짐"}
      </Badge>
    </button>
  );
}
