// src/design-system/components.jsx
import React, {
  createContext,
  useContext,
  useId,
  useEffect,
  useRef,
  useState
} from "react";
var AssetContext = createContext("./icons");
function IconProvider({ baseUrl, children }) {
  return /* @__PURE__ */ React.createElement(AssetContext.Provider, { value: baseUrl }, children);
}
function Icon({ name, size = "var(--mv-control-icon)", ...props }) {
  const base = useContext(AssetContext);
  return /* @__PURE__ */ React.createElement(
    "span",
    {
      ...props,
      className: `mv-icon ${props.className || ""}`,
      "aria-hidden": "true",
      style: {
        "--mv-icon": `url("${base}/${name}.svg")`,
        width: size,
        height: size,
        ...props.style
      }
    }
  );
}
function Button({
  variant = "primary",
  loading = false,
  icon,
  children,
  className = "",
  disabled,
  ...props
}) {
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      ...props,
      type: props.type || "button",
      className: `mv-button mv-button--${variant} ${className}`,
      disabled: disabled || loading,
      "aria-busy": loading || void 0
    },
    loading ? /* @__PURE__ */ React.createElement("span", { className: "mv-spinner", "aria-hidden": "true" }) : icon && /* @__PURE__ */ React.createElement(Icon, { name: icon, size: 20 }),
    /* @__PURE__ */ React.createElement("span", null, children)
  );
}
function IconButton({ label, icon, selected, ...props }) {
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      ...props,
      type: props.type || "button",
      className: `mv-icon-button ${selected ? "is-selected" : ""}`,
      "aria-label": label,
      "aria-pressed": typeof selected === "boolean" ? selected : props["aria-pressed"]
    },
    /* @__PURE__ */ React.createElement(Icon, { name: icon })
  );
}
function Field({
  label,
  hint,
  error,
  required,
  id: givenId,
  multiline = false,
  ...props
}) {
  const uid = useId(), id = givenId || uid;
  const Tag = multiline ? "textarea" : "input";
  return /* @__PURE__ */ React.createElement("div", { className: "mv-field" }, /* @__PURE__ */ React.createElement("label", { htmlFor: id }, label, required && /* @__PURE__ */ React.createElement("span", { className: "mv-required" }, "\uD544\uC218")), /* @__PURE__ */ React.createElement(
    Tag,
    {
      ...props,
      id,
      required,
      "aria-invalid": !!error,
      "aria-describedby": error || hint ? `${id}-help` : void 0,
      className: "mv-input"
    }
  ), (error || hint) && /* @__PURE__ */ React.createElement(
    "p",
    {
      id: `${id}-help`,
      className: error ? "mv-field-error" : "mv-field-hint"
    },
    error && /* @__PURE__ */ React.createElement(Icon, { name: "circle-help", size: 16 }),
    " ",
    error || hint
  ));
}
function SearchField({
  value,
  onChange,
  onClear,
  onBack,
  label = "\uACC4\uACE1\uC774\uB098 \uC2DC\uC124 \uAC80\uC0C9",
  ...props
}) {
  const id = useId();
  return /* @__PURE__ */ React.createElement("div", { className: "mv-search" }, onBack ? /* @__PURE__ */ React.createElement(
    IconButton,
    {
      label: "\uAC80\uC0C9 \uCDE8\uC18C",
      icon: "chevron-right",
      style: { transform: "rotate(180deg)" },
      onClick: onBack
    }
  ) : /* @__PURE__ */ React.createElement(Icon, { name: "search", size: 24 }), /* @__PURE__ */ React.createElement("label", { className: "mv-sr", htmlFor: id }, label), /* @__PURE__ */ React.createElement(
    "input",
    {
      ...props,
      id,
      type: "search",
      value,
      onChange: (e) => onChange(e.target.value),
      placeholder: label
    }
  ), value && /* @__PURE__ */ React.createElement(
    IconButton,
    {
      label: "\uAC80\uC0C9\uC5B4 \uC9C0\uC6B0\uAE30",
      icon: "x",
      onClick: onClear || (() => onChange(""))
    }
  ));
}
function Chip({ selected = false, children, icon, ...props }) {
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      ...props,
      type: "button",
      className: `mv-chip ${selected ? "is-selected" : ""}`,
      "aria-pressed": selected
    },
    selected ? /* @__PURE__ */ React.createElement(Icon, { name: "check", size: 16 }) : icon && /* @__PURE__ */ React.createElement(Icon, { name: icon, size: 16 }),
    /* @__PURE__ */ React.createElement("span", null, children)
  );
}
function Segmented({ label, options, value, onChange }) {
  return /* @__PURE__ */ React.createElement("div", { className: "mv-segmented", role: "group", "aria-label": label }, options.map((o) => /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      key: o.value,
      "aria-pressed": value === o.value,
      onClick: () => onChange(o.value)
    },
    o.label
  )));
}
function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false
}) {
  const id = useId();
  return /* @__PURE__ */ React.createElement(
    "label",
    {
      className: `mv-switch-row ${disabled ? "is-disabled" : ""}`,
      htmlFor: id
    },
    /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("strong", null, label), description && /* @__PURE__ */ React.createElement("small", null, description)),
    /* @__PURE__ */ React.createElement(
      "input",
      {
        id,
        type: "checkbox",
        role: "switch",
        checked,
        disabled,
        onChange: (e) => onChange(e.target.checked)
      }
    ),
    /* @__PURE__ */ React.createElement("span", { className: "mv-switch-track", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("span", null))
  );
}
var statusConfig = {
  unknown: { tone: "neutral", icon: "circle-help", label: "\uC790\uB8CC \uC5C6\uC74C" },
  observed: { tone: "info", icon: "cloud-rain", label: "\uAD00\uCE21" },
  estimated: { tone: "caution", icon: "cloud-rain", label: "\uCD94\uC815" },
  caution: { tone: "caution", icon: "triangle-alert", label: "\uC8FC\uC758" },
  warning: { tone: "danger", icon: "triangle-alert", label: "\uACBD\uBCF4" },
  evacuate: { tone: "danger", icon: "triangle-alert", label: "\uB300\uD53C" },
  stale: { tone: "caution", icon: "clock", label: "\uC790\uB8CC \uC9C0\uC5F0" },
  error: { tone: "danger", icon: "circle-help", label: "\uC5F0\uACB0 \uC2E4\uD328" },
  success: { tone: "accent", icon: "check", label: "\uC644\uB8CC" }
};
function Badge({ status = "unknown", children }) {
  const s = statusConfig[status] || statusConfig.unknown;
  return /* @__PURE__ */ React.createElement("span", { className: `mv-badge mv-tone--${s.tone}` }, /* @__PURE__ */ React.createElement(Icon, { name: s.icon, size: 16 }), children || s.label);
}
function Alert({
  status = "unknown",
  title,
  children,
  action,
  live = false
}) {
  const s = statusConfig[status] || statusConfig.unknown;
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      className: `mv-alert mv-tone--${s.tone}`,
      role: live ? "status" : void 0
    },
    /* @__PURE__ */ React.createElement(Icon, { name: s.icon, size: 20 }),
    /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, title || s.label), children && /* @__PURE__ */ React.createElement("p", null, children), action && /* @__PURE__ */ React.createElement("div", { className: "mv-alert-action" }, action))
  );
}
function Card({ children, className = "", ...props }) {
  return /* @__PURE__ */ React.createElement("article", { ...props, className: `mv-card ${className}` }, children);
}
function ValleyCard({
  name,
  region,
  rank,
  description,
  selected,
  accessory,
  onClick
}) {
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: `mv-valley ${selected ? "is-selected" : ""}`,
      onClick
    },
    /* @__PURE__ */ React.createElement("span", { className: "mv-valley-symbol" }, rank ? /* @__PURE__ */ React.createElement("span", { className: "mv-rank" }, String(rank).padStart(2, "0")) : /* @__PURE__ */ React.createElement(Icon, { name: "mountain", size: 28 })),
    /* @__PURE__ */ React.createElement("span", { className: "mv-valley-copy" }, /* @__PURE__ */ React.createElement("strong", null, name), /* @__PURE__ */ React.createElement("span", null, region), description && /* @__PURE__ */ React.createElement("small", null, description)),
    accessory && /* @__PURE__ */ React.createElement("span", { className: "mv-valley-accessory" }, accessory),
    /* @__PURE__ */ React.createElement(Icon, { name: "chevron-right", size: 20 })
  );
}
var FACILITY_ICONS = {
  "\uD654\uC7A5\uC2E4": "toilet",
  "\uC8FC\uCC28\uC7A5": "square-parking",
  "\uC815\uC790\xB7\uC27C\uD130": "house",
  "\uC548\uC804\uC2DC\uC124": "shield-check",
  "\uC9C4\uC785\uB85C": "navigation",
  "\uC5ED\xB7\uC815\uB958\uC7A5": "map",
  "\uC2DD\uB2F9": "banknote",
  "\uCE74\uD398": "banknote",
  "\uB9E4\uC810": "banknote"
};
function FacilityRow({ name, type, valley, onClick }) {
  return /* @__PURE__ */ React.createElement("button", { type: "button", className: "mv-facility", onClick }, /* @__PURE__ */ React.createElement("span", { className: "mv-facility-symbol" }, /* @__PURE__ */ React.createElement(Icon, { name: FACILITY_ICONS[type] ?? "info" })), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("strong", null, name), /* @__PURE__ */ React.createElement("small", null, valley, " \xB7 ", type)), /* @__PURE__ */ React.createElement(Icon, { name: "chevron-right", size: 20 }));
}
function Metric({ label, value, icon }) {
  return /* @__PURE__ */ React.createElement("div", { className: "mv-metric" }, icon ? /* @__PURE__ */ React.createElement(Icon, { name: icon, size: 20 }) : /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true" }), /* @__PURE__ */ React.createElement("span", null, label), /* @__PURE__ */ React.createElement("strong", null, value));
}
function Tabs({ label, options, value, onChange }) {
  const refs = useRef([]);
  return /* @__PURE__ */ React.createElement("div", { className: "mv-tabs", role: "tablist", "aria-label": label }, options.map((o, i) => /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      key: o.value,
      ref: (el) => refs.current[i] = el,
      role: "tab",
      "aria-selected": o.value === value,
      tabIndex: o.value === value ? 0 : -1,
      onClick: () => onChange(o.value),
      onKeyDown: (e) => {
        let next;
        if (e.key === "ArrowRight") next = (i + 1) % options.length;
        if (e.key === "ArrowLeft")
          next = (i + options.length - 1) % options.length;
        if (e.key === "Home") next = 0;
        if (e.key === "End") next = options.length - 1;
        if (next !== void 0) {
          e.preventDefault();
          onChange(options[next].value);
          refs.current[next]?.focus();
        }
      }
    },
    o.label
  )));
}
function EmptyState({ icon = "search", title, description, action }) {
  return /* @__PURE__ */ React.createElement("div", { className: "mv-empty" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement(Icon, { name: icon, size: 28 })), /* @__PURE__ */ React.createElement("strong", null, title), /* @__PURE__ */ React.createElement("p", null, description), action);
}
function Skeleton({ rows = 3, label = "\uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uB294 \uC911" }) {
  return /* @__PURE__ */ React.createElement("div", { className: "mv-skeleton", role: "status", "aria-label": label }, Array.from({ length: rows }, (_, i) => /* @__PURE__ */ React.createElement("div", { key: i }, /* @__PURE__ */ React.createElement("i", null), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null), /* @__PURE__ */ React.createElement("b", null)))), /* @__PURE__ */ React.createElement("span", { className: "mv-sr" }, label));
}
function TimePicker({
  value,
  onChange,
  date = "\uC2DC\uC5F0 \uAE30\uC900\uC77C",
  disabled = false
}) {
  const id = useId();
  return /* @__PURE__ */ React.createElement("div", { className: "mv-time-picker" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement(Icon, { name: "clock", size: 20 }), " \uC608\uC0C1 \uADF8\uB298"), /* @__PURE__ */ React.createElement("strong", null, value, ":00")), /* @__PURE__ */ React.createElement("label", { className: "mv-sr", htmlFor: id }, "\uADF8\uB298 \uC2DC\uAC04"), /* @__PURE__ */ React.createElement(
    "input",
    {
      id,
      type: "range",
      min: "10",
      max: "18",
      step: "1",
      value,
      disabled,
      "aria-valuetext": `${value}\uC2DC \uC608\uC0C1 \uADF8\uB298`,
      onChange: (e) => onChange(Number(e.target.value))
    }
  ), /* @__PURE__ */ React.createElement("div", { className: "mv-time-labels" }, /* @__PURE__ */ React.createElement("span", null, "10\uC2DC"), /* @__PURE__ */ React.createElement("span", null, date), /* @__PURE__ */ React.createElement("span", null, "18\uC2DC")), /* @__PURE__ */ React.createElement("div", { className: "mv-time-actions" }, /* @__PURE__ */ React.createElement(
    Button,
    {
      variant: "ghost",
      disabled: disabled || value === 10,
      onClick: () => onChange(value - 1)
    },
    "\uC774\uC804 \uC2DC\uAC04"
  ), /* @__PURE__ */ React.createElement(
    Button,
    {
      variant: "ghost",
      disabled: disabled || value === 18,
      onClick: () => onChange(value + 1)
    },
    "\uB2E4\uC74C \uC2DC\uAC04"
  )));
}
function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  description,
  destructive = false
}) {
  const ref = useRef(null), uid = useId();
  useEffect(() => {
    const d = ref.current;
    if (open && !d.open) {
      d.showModal();
      d.querySelector("[data-initial-focus]")?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);
  return /* @__PURE__ */ React.createElement(
    "dialog",
    {
      ref,
      className: "mv-dialog",
      role: destructive ? "alertdialog" : "dialog",
      "aria-labelledby": `${uid}-title`,
      "aria-describedby": description ? `${uid}-desc` : void 0,
      onCancel: (e) => {
        e.preventDefault();
        onClose();
      },
      onClick: (e) => {
        if (e.target === ref.current) {
          const r = e.target.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
            onClose();
        }
      }
    },
    /* @__PURE__ */ React.createElement("header", null, /* @__PURE__ */ React.createElement("h2", { id: `${uid}-title` }, title), /* @__PURE__ */ React.createElement(IconButton, { label: "\uB300\uD654\uC0C1\uC790 \uB2EB\uAE30", icon: "x", onClick: onClose })),
    description && /* @__PURE__ */ React.createElement("p", { id: `${uid}-desc`, className: "mv-dialog-description" }, description),
    /* @__PURE__ */ React.createElement("div", { className: "mv-dialog-content" }, children),
    footer && /* @__PURE__ */ React.createElement("footer", null, footer)
  );
}
function Toast({ message, onDismiss }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [message, onDismiss]);
  return message ? /* @__PURE__ */ React.createElement("div", { className: "mv-toast", role: "status" }, /* @__PURE__ */ React.createElement(Icon, { name: "check", size: 20 }), /* @__PURE__ */ React.createElement("span", null, message), /* @__PURE__ */ React.createElement(IconButton, { label: "\uC54C\uB9BC \uB2EB\uAE30", icon: "x", onClick: onDismiss })) : null;
}
function MapTool({ label, icon, selected = false, ...props }) {
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      ...props,
      type: "button",
      className: `mv-map-tool ${selected ? "is-selected" : ""}`,
      "aria-pressed": selected,
      "aria-label": label,
      title: label
    },
    /* @__PURE__ */ React.createElement(Icon, { name: icon }),
    /* @__PURE__ */ React.createElement("span", null, label),
    selected && /* @__PURE__ */ React.createElement("span", { className: "mv-selected-dot", "aria-hidden": "true" })
  );
}
function MapSheet({
  state,
  onChange,
  title,
  subtitle,
  children,
  actions,
  topInset = 180
}) {
  const start = useRef(null);
  return /* @__PURE__ */ React.createElement(
    "section",
    {
      className: `mv-map-sheet mv-map-sheet--${state}`,
      style: { "--mv-sheet-top": `${topInset}px` },
      "aria-label": "\uC120\uD0DD \uC7A5\uC18C \uC815\uBCF4"
    },
    /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "mv-sheet-handle",
        onPointerDown: (e) => {
          start.current = e.clientY;
          e.currentTarget.setPointerCapture(e.pointerId);
        },
        onPointerUp: (e) => {
          if (start.current === null) return;
          const delta = e.clientY - start.current;
          const states = ["peek", "half", "full"], i = states.indexOf(state);
          if (Math.abs(delta) > 24)
            onChange(
              states[Math.max(0, Math.min(2, i + (delta < 0 ? 1 : -1)))]
            );
          start.current = null;
        },
        onPointerCancel: () => start.current = null
      },
      /* @__PURE__ */ React.createElement("span", null)
    ),
    /* @__PURE__ */ React.createElement("header", null, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", null, title), /* @__PURE__ */ React.createElement("p", null, subtitle)), /* @__PURE__ */ React.createElement(
      IconButton,
      {
        label: state === "peek" ? "\uC815\uBCF4 \uD3BC\uCE58\uAE30" : "\uC9C0\uB3C4 \uD06C\uAC8C \uBCF4\uAE30",
        icon: state === "peek" ? "plus" : "minus",
        onClick: () => onChange(state === "peek" ? "half" : "peek")
      }
    )),
    state !== "peek" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "mv-sheet-snap" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => onChange(state === "full" ? "half" : "full")
      },
      state === "full" ? "\uC911\uAC04 \uD06C\uAE30\uB85C" : "\uC804\uCCB4 \uC815\uBCF4 \uBCF4\uAE30"
    )), /* @__PURE__ */ React.createElement("div", { className: "mv-sheet-content" }, children)),
    /* @__PURE__ */ React.createElement("footer", null, actions)
  );
}
function PhotoInput({ value, onChange, error }) {
  const ref = useRef(null), urls = useRef([]);
  useEffect(() => {
    const next = value.map((p) => p.url);
    urls.current.filter((u) => !next.includes(u)).forEach((u) => URL.revokeObjectURL(u));
    urls.current = next;
  }, [value]);
  useEffect(
    () => () => urls.current.forEach((u) => URL.revokeObjectURL(u)),
    []
  );
  return /* @__PURE__ */ React.createElement("div", { className: "mv-field" }, /* @__PURE__ */ React.createElement("label", null, "\uC0AC\uC9C4 ", /* @__PURE__ */ React.createElement("span", { className: "mv-optional" }, "\uC120\uD0DD \xB7 \uCD5C\uB300 3\uC7A5")), /* @__PURE__ */ React.createElement("div", { className: "mv-photo-list" }, value.map((p, i) => /* @__PURE__ */ React.createElement("div", { className: "mv-photo", key: p.url }, /* @__PURE__ */ React.createElement("img", { src: p.url, alt: `\uCCA8\uBD80 \uC0AC\uC9C4 ${i + 1}` }), /* @__PURE__ */ React.createElement(
    IconButton,
    {
      label: `\uC0AC\uC9C4 ${i + 1} \uC0AD\uC81C`,
      icon: "x",
      onClick: () => onChange(value.filter((_, j) => i !== j))
    }
  ))), value.length < 3 && /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "mv-photo-add",
      "aria-label": `\uC0AC\uC9C4 \uCD94\uAC00 \xB7 ${value.length}/3`,
      onClick: () => ref.current.click()
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "camera" }),
    /* @__PURE__ */ React.createElement("span", null, value.length, "/3")
  )), /* @__PURE__ */ React.createElement(
    "input",
    {
      ref,
      type: "file",
      accept: "image/*",
      multiple: true,
      className: "mv-sr",
      tabIndex: -1,
      onChange: (e) => {
        const selected = [...e.target.files].filter((f) => f.type.startsWith("image/")).slice(0, 3 - value.length);
        onChange([
          ...value,
          ...selected.map((f) => ({
            name: f.name,
            file: f,
            url: URL.createObjectURL(f)
          }))
        ]);
        e.target.value = "";
      }
    }
  ), error && /* @__PURE__ */ React.createElement("p", { className: "mv-field-error" }, error));
}
function Notice({ children }) {
  return /* @__PURE__ */ React.createElement("p", { className: "mv-notice" }, /* @__PURE__ */ React.createElement(Icon, { name: "info", size: 16 }), /* @__PURE__ */ React.createElement("span", null, children));
}
export {
  Alert,
  Badge,
  Button,
  Card,
  Chip,
  Dialog,
  EmptyState,
  FacilityRow,
  Field,
  Icon,
  IconButton,
  IconProvider,
  MapSheet,
  MapTool,
  Metric,
  Notice,
  PhotoInput,
  SearchField,
  Segmented,
  Skeleton,
  Switch,
  Tabs,
  TimePicker,
  Toast,
  ValleyCard,
  statusConfig
};
