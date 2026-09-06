export const METRIC_KEYS = [
  "executive_function",
  "hyperactivity",
  "mental_acuity",
  "focus",
  "mental_noise",
  "sleep",
  "crash",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export const METRICS: {
  key: MetricKey;
  label: string;
  low: string;
  high: string;
}[] = [
  {
    key: "executive_function",
    label: "Executive function",
    low: "Scattered",
    high: "Organised",
  },
  {
    key: "hyperactivity",
    label: "Hyperactivity",
    low: "Restless",
    high: "Settled",
  },
  {
    key: "mental_acuity",
    label: "Mental acuity",
    low: "Foggy",
    high: "Sharp",
  },
  {
    key: "focus",
    label: "Focus",
    low: "Drifted",
    high: "Held",
  },
  {
    key: "mental_noise",
    label: "Mental noise",
    low: "Loud",
    high: "Quiet",
  },
  {
    key: "sleep",
    label: "Sleep",
    low: "Broken",
    high: "Restored",
  },
  {
    key: "crash",
    label: "Crash",
    low: "Heavy",
    high: "None",
  },
];

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function localDateIso(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localDateIso(date);
}
