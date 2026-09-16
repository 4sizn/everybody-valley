import * as React from "react";
export type IconName =
  | "search"
  | "arrow-left"
  | "x"
  | "chevron-right"
  | "check"
  | "house"
  | "map"
  | "settings-2"
  | "mountain"
  | "waves"
  | "tree-pine"
  | "cloud-rain"
  | "triangle-alert"
  | "circle-help"
  | "square-parking"
  | "toilet"
  | "tent"
  | "banknote"
  | "navigation"
  | "layers"
  | "compass"
  | "plus"
  | "minus"
  | "locate-fixed"
  | "message-square"
  | "camera"
  | "image"
  | "trash-2"
  | "copy"
  | "phone"
  | "info"
  | "shield-check"
  | "clock"
  | "calendar-days";
export type Status =
  | "unknown"
  | "observed"
  | "estimated"
  | "caution"
  | "warning"
  | "evacuate"
  | "stale"
  | "error"
  | "success";
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  icon?: IconName;
};
export function IconProvider(props: {
  baseUrl: string;
  children: React.ReactNode;
}): React.JSX.Element;
export function Icon(
  props: React.HTMLAttributes<HTMLSpanElement> & {
    name: IconName;
    size?: number;
  },
): React.JSX.Element;
export function Button(props: ButtonProps): React.JSX.Element;
export function IconButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    icon: IconName;
    selected?: boolean;
  },
): React.JSX.Element;
export function Field(
  props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
    label: string;
    hint?: string;
    error?: string;
    multiline?: boolean;
    onChange?: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => void;
  },
): React.JSX.Element;
export function SearchField(
  props: Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange"
  > & {
    value: string;
    onChange: (value: string) => void;
    onClear?: () => void;
    onBack?: () => void;
    label?: string;
  },
): React.JSX.Element;
export function Chip(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    selected?: boolean;
    icon?: IconName;
  },
): React.JSX.Element;
export function Segmented<T extends string | number>(props: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}): React.JSX.Element;
export function Switch(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}): React.JSX.Element;
export function Badge(props: {
  status?: Status;
  children?: React.ReactNode;
}): React.JSX.Element;
export function Alert(props: {
  status?: Status;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  live?: boolean;
}): React.JSX.Element;
export const statusConfig: Record<
  Status,
  { tone: string; icon: IconName; label: string }
>;
export function Card(
  props: React.HTMLAttributes<HTMLElement>,
): React.JSX.Element;
export function ValleyCard(props: {
  name: string;
  region: string;
  rank?: number | null;
  description?: string;
  selected?: boolean;
  onClick: () => void;
}): React.JSX.Element;
export function FacilityRow(props: {
  name: string;
  type: string;
  valley: string;
  onClick: () => void;
}): React.JSX.Element;
export function Metric(props: {
  label: string;
  value: string;
  icon?: IconName;
}): React.JSX.Element;
export function Tabs(props: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}): React.JSX.Element;
export function EmptyState(props: {
  icon?: IconName;
  title: string;
  description: string;
  action?: React.ReactNode;
}): React.JSX.Element;
export function Skeleton(props: {
  rows?: number;
  label?: string;
}): React.JSX.Element;
export function TimePicker(props: {
  value: number;
  onChange: (hour: number) => void;
  date?: string;
  disabled?: boolean;
}): React.JSX.Element;
export function Dialog(props: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  description?: React.ReactNode;
  destructive?: boolean;
}): React.JSX.Element;
export function Toast(props: {
  message: string;
  onDismiss: () => void;
}): React.JSX.Element | null;
export function MapTool(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    icon: IconName;
    selected?: boolean;
  },
): React.JSX.Element;
export function MapSheet(props: {
  state: "peek" | "half" | "full";
  onChange: (state: "peek" | "half" | "full") => void;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  children?: React.ReactNode;
  actions: React.ReactNode;
  topInset?: number;
}): React.JSX.Element;
export type LocalPhoto = { name: string; url: string; file?: File };
export function PhotoInput(props: {
  value: LocalPhoto[];
  onChange: (photos: LocalPhoto[]) => void;
  error?: string;
}): React.JSX.Element;
export function Notice(props: { children: React.ReactNode }): React.JSX.Element;
