import React, {
  createContext,
  useContext,
  useId,
  useEffect,
  useRef,
  useState,
} from "react";
import "./tokens.css";
import "./components.css";
const AssetContext = createContext("./icons");
export function IconProvider({ baseUrl, children }) {
  return (
    <AssetContext.Provider value={baseUrl}>{children}</AssetContext.Provider>
  );
}
export function Icon({ name, size = "var(--mv-control-icon)", ...props }) {
  const base = useContext(AssetContext);
  return (
    <span
      {...props}
      className={`mv-icon ${props.className || ""}`}
      aria-hidden="true"
      style={{
        "--mv-icon": `url("${base}/${name}.svg")`,
        width: size,
        height: size,
        ...props.style,
      }}
    />
  );
}
export function Button({
  variant = "primary",
  loading = false,
  icon,
  children,
  className = "",
  disabled,
  ...props
}) {
  return (
    <button
      {...props}
      type={props.type || "button"}
      className={`mv-button mv-button--${variant} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <span className="mv-spinner" aria-hidden="true" />
      ) : (
        icon && <Icon name={icon} size={20} />
      )}
      <span>{children}</span>
    </button>
  );
}
export function IconButton({ label, icon, selected, ...props }) {
  return (
    <button
      {...props}
      type={props.type || "button"}
      className={`mv-icon-button ${selected ? "is-selected" : ""}`}
      aria-label={label}
      aria-pressed={
        typeof selected === "boolean" ? selected : props["aria-pressed"]
      }
    >
      <Icon name={icon} />
    </button>
  );
}
export function Field({
  label,
  hint,
  error,
  required,
  id: givenId,
  multiline = false,
  ...props
}) {
  const uid = useId(),
    id = givenId || uid;
  const Tag = multiline ? "textarea" : "input";
  return (
    <div className="mv-field">
      <label htmlFor={id}>
        {label}
        {required && <span className="mv-required">필수</span>}
      </label>
      <Tag
        {...props}
        id={id}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-help` : undefined}
        className="mv-input"
      />
      {(error || hint) && (
        <p
          id={`${id}-help`}
          className={error ? "mv-field-error" : "mv-field-hint"}
        >
          {error && <Icon name="circle-help" size={16} />} {error || hint}
        </p>
      )}
    </div>
  );
}
export function SearchField({
  value,
  onChange,
  onClear,
  onBack,
  label = "계곡이나 시설 검색",
  ...props
}) {
  const id = useId();
  return (
    <div className="mv-search">
      {onBack ? (
        <IconButton
          label="검색 취소"
          icon="chevron-right"
          style={{ transform: "rotate(180deg)" }}
          onClick={onBack}
        />
      ) : (
        <Icon name="search" size={24} />
      )}
      <label className="mv-sr" htmlFor={id}>
        {label}
      </label>
      <input
        {...props}
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
      />
      {value && (
        <IconButton
          label="검색어 지우기"
          icon="x"
          onClick={onClear || (() => onChange(""))}
        />
      )}
    </div>
  );
}
export function Chip({ selected = false, children, icon, ...props }) {
  return (
    <button
      {...props}
      type="button"
      className={`mv-chip ${selected ? "is-selected" : ""}`}
      aria-pressed={selected}
    >
      {selected ? (
        <Icon name="check" size={16} />
      ) : (
        icon && <Icon name={icon} size={16} />
      )}
      <span>{children}</span>
    </button>
  );
}
export function Segmented({ label, options, value, onChange }) {
  return (
    <div className="mv-segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}) {
  const id = useId();
  return (
    <label
      className={`mv-switch-row ${disabled ? "is-disabled" : ""}`}
      htmlFor={id}
    >
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="mv-switch-track" aria-hidden="true">
        <span />
      </span>
    </label>
  );
}
export const statusConfig = {
  unknown: { tone: "neutral", icon: "circle-help", label: "자료 없음" },
  observed: { tone: "info", icon: "cloud-rain", label: "관측" },
  estimated: { tone: "caution", icon: "cloud-rain", label: "추정" },
  caution: { tone: "caution", icon: "triangle-alert", label: "주의" },
  warning: { tone: "danger", icon: "triangle-alert", label: "경보" },
  evacuate: { tone: "danger", icon: "triangle-alert", label: "대피" },
  stale: { tone: "caution", icon: "clock", label: "자료 지연" },
  error: { tone: "danger", icon: "circle-help", label: "연결 실패" },
  success: { tone: "accent", icon: "check", label: "완료" },
};
export function Badge({ status = "unknown", children }) {
  const s = statusConfig[status] || statusConfig.unknown;
  return (
    <span className={`mv-badge mv-tone--${s.tone}`}>
      <Icon name={s.icon} size={16} />
      {children || s.label}
    </span>
  );
}
export function Alert({
  status = "unknown",
  title,
  children,
  action,
  live = false,
}) {
  const s = statusConfig[status] || statusConfig.unknown;
  return (
    <div
      className={`mv-alert mv-tone--${s.tone}`}
      role={live ? "status" : undefined}
    >
      <Icon name={s.icon} size={20} />
      <div>
        <strong>{title || s.label}</strong>
        {children && <p>{children}</p>}
        {action && <div className="mv-alert-action">{action}</div>}
      </div>
    </div>
  );
}
export function Card({ children, className = "", ...props }) {
  return (
    <article {...props} className={`mv-card ${className}`}>
      {children}
    </article>
  );
}
export function ValleyCard({
  name,
  region,
  rank,
  description,
  selected,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`mv-valley ${selected ? "is-selected" : ""}`}
      onClick={onClick}
    >
      <span className="mv-valley-symbol">
        {rank ? (
          <span className="mv-rank">{String(rank).padStart(2, "0")}</span>
        ) : (
          <Icon name="mountain" size={28} />
        )}
      </span>
      <span className="mv-valley-copy">
        <strong>{name}</strong>
        <span>{region}</span>
        {description && <small>{description}</small>}
      </span>
      <Icon name="chevron-right" size={20} />
    </button>
  );
}
export function FacilityRow({ name, type, valley, onClick }) {
  return (
    <button type="button" className="mv-facility" onClick={onClick}>
      <span className="mv-facility-symbol">
        <Icon name={type === "화장실" ? "toilet" : "square-parking"} />
      </span>
      <span>
        <strong>{name}</strong>
        <small>
          {valley} · {type}
        </small>
      </span>
      <Icon name="chevron-right" size={20} />
    </button>
  );
}
export function Metric({ label, value, icon }) {
  return (
    <div className="mv-metric">
      {icon && <Icon name={icon} size={20} />}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
export function Tabs({ label, options, value, onChange }) {
  const refs = useRef([]);
  return (
    <div className="mv-tabs" role="tablist" aria-label={label}>
      {options.map((o, i) => (
        <button
          type="button"
          key={o.value}
          ref={(el) => (refs.current[i] = el)}
          role="tab"
          aria-selected={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            let next;
            if (e.key === "ArrowRight") next = (i + 1) % options.length;
            if (e.key === "ArrowLeft")
              next = (i + options.length - 1) % options.length;
            if (e.key === "Home") next = 0;
            if (e.key === "End") next = options.length - 1;
            if (next !== undefined) {
              e.preventDefault();
              onChange(options[next].value);
              refs.current[next]?.focus();
            }
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
export function EmptyState({ icon = "search", title, description, action }) {
  return (
    <div className="mv-empty">
      <span>
        <Icon name={icon} size={28} />
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Skeleton({ rows = 3, label = "정보를 불러오는 중" }) {
  return (
    <div className="mv-skeleton" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i}>
          <i />
          <span>
            <b />
            <b />
          </span>
        </div>
      ))}
      <span className="mv-sr">{label}</span>
    </div>
  );
}
export function TimePicker({
  value,
  onChange,
  date = "시연 기준일",
  disabled = false,
}) {
  const id = useId();
  return (
    <div className="mv-time-picker">
      <div>
        <span>
          <Icon name="clock" size={20} /> 예상 그늘
        </span>
        <strong>{value}:00</strong>
      </div>
      <label className="mv-sr" htmlFor={id}>
        그늘 시간
      </label>
      <input
        id={id}
        type="range"
        min="10"
        max="18"
        step="1"
        value={value}
        disabled={disabled}
        aria-valuetext={`${value}시 예상 그늘`}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="mv-time-labels">
        <span>10시</span>
        <span>{date}</span>
        <span>18시</span>
      </div>
      <div className="mv-time-actions">
        <Button
          variant="ghost"
          disabled={disabled || value === 10}
          onClick={() => onChange(value - 1)}
        >
          이전 시간
        </Button>
        <Button
          variant="ghost"
          disabled={disabled || value === 18}
          onClick={() => onChange(value + 1)}
        >
          다음 시간
        </Button>
      </div>
    </div>
  );
}
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  description,
  destructive = false,
}) {
  const ref = useRef(null),
    uid = useId();
  useEffect(() => {
    const d = ref.current;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="mv-dialog"
      role={destructive ? "alertdialog" : "dialog"}
      aria-labelledby={`${uid}-title`}
      aria-describedby={description ? `${uid}-desc` : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = e.target.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <header>
        <h2 id={`${uid}-title`}>{title}</h2>
        <IconButton label="대화상자 닫기" icon="x" onClick={onClose} />
      </header>
      {description && (
        <p id={`${uid}-desc`} className="mv-dialog-description">
          {description}
        </p>
      )}
      <div className="mv-dialog-content">{children}</div>
      {footer && <footer>{footer}</footer>}
    </dialog>
  );
}
export function Toast({ message, onDismiss }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [message, onDismiss]);
  return message ? (
    <div className="mv-toast" role="status">
      <Icon name="check" size={20} />
      <span>{message}</span>
      <IconButton label="알림 닫기" icon="x" onClick={onDismiss} />
    </div>
  ) : null;
}
export function MapTool({ label, icon, selected = false, ...props }) {
  return (
    <button
      {...props}
      type="button"
      className={`mv-map-tool ${selected ? "is-selected" : ""}`}
      aria-pressed={selected}
      aria-label={label}
      title={label}
    >
      <Icon name={icon} />
      <span>{label}</span>
      {selected && <span className="mv-selected-dot" aria-hidden="true" />}
    </button>
  );
}
export function MapSheet({
  state,
  onChange,
  title,
  subtitle,
  children,
  actions,
  topInset = 180,
}) {
  const start = useRef(null);
  return (
    <section
      className={`mv-map-sheet mv-map-sheet--${state}`}
      style={{ "--mv-sheet-top": `${topInset}px` }}
      aria-label="선택 장소 정보"
    >
      <div
        className="mv-sheet-handle"
        onPointerDown={(e) => {
          start.current = e.clientY;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={(e) => {
          if (start.current === null) return;
          const delta = e.clientY - start.current;
          const states = ["peek", "half", "full"],
            i = states.indexOf(state);
          if (Math.abs(delta) > 24)
            onChange(
              states[Math.max(0, Math.min(2, i + (delta < 0 ? 1 : -1)))],
            );
          start.current = null;
        }}
        onPointerCancel={() => (start.current = null)}
      >
        <span />
      </div>
      <header>
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <IconButton
          label={state === "peek" ? "정보 펼치기" : "지도 크게 보기"}
          icon={state === "peek" ? "plus" : "minus"}
          onClick={() => onChange(state === "peek" ? "half" : "peek")}
        />
      </header>
      {state !== "peek" && (
        <>
          <div className="mv-sheet-snap">
            <button
              type="button"
              onClick={() => onChange(state === "full" ? "half" : "full")}
            >
              {state === "full" ? "중간 크기로" : "전체 정보 보기"}
            </button>
          </div>
          <div className="mv-sheet-content">{children}</div>
        </>
      )}
      <footer>{actions}</footer>
    </section>
  );
}
export function PhotoInput({ value, onChange, error }) {
  const ref = useRef(null),
    urls = useRef([]);
  useEffect(() => {
    const next = value.map((p) => p.url);
    urls.current
      .filter((u) => !next.includes(u))
      .forEach((u) => URL.revokeObjectURL(u));
    urls.current = next;
  }, [value]);
  useEffect(
    () => () => urls.current.forEach((u) => URL.revokeObjectURL(u)),
    [],
  );
  return (
    <div className="mv-field">
      <label>
        사진 <span className="mv-optional">선택 · 최대 3장</span>
      </label>
      <div className="mv-photo-list">
        {value.map((p, i) => (
          <div className="mv-photo" key={p.url}>
            <img src={p.url} alt={`첨부 사진 ${i + 1}`} />
            <IconButton
              label={`사진 ${i + 1} 삭제`}
              icon="x"
              onClick={() => onChange(value.filter((_, j) => i !== j))}
            />
          </div>
        ))}
        {value.length < 3 && (
          <button
            type="button"
            className="mv-photo-add"
            aria-label={`사진 추가 · ${value.length}/3`}
            onClick={() => ref.current.click()}
          >
            <Icon name="camera" />
            <span>{value.length}/3</span>
          </button>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        className="mv-sr"
        tabIndex={-1}
        onChange={(e) => {
          const selected = [...e.target.files]
            .filter((f) => f.type.startsWith("image/"))
            .slice(0, 3 - value.length);
          onChange([
            ...value,
            ...selected.map((f) => ({
              name: f.name,
              file: f,
              url: URL.createObjectURL(f),
            })),
          ]);
          e.target.value = "";
        }}
      />
      {error && <p className="mv-field-error">{error}</p>}
    </div>
  );
}
export function Notice({ children }) {
  return (
    <p className="mv-notice">
      <Icon name="info" size={16} />
      <span>{children}</span>
    </p>
  );
}
