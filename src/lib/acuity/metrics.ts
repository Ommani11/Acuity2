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

/** Scales an observer can reasonably judge from the outside. */
export const OBSERVER_METRIC_KEYS = [
  "executive_function",
  "hyperactivity",
  "mental_acuity",
  "focus",
] as const satisfies readonly MetricKey[];

export type ObserverMetricKey = (typeof OBSERVER_METRIC_KEYS)[number];

export const METRICS: {
  key: MetricKey;
  label: string;
  low: string;
  high: string;
  hint: string;
}[] = [
  {
    key: "executive_function",
    label: "Executive function",
    low: "Scattered",
    high: "Organised",
    hint: "Starting, planning, switching, and finishing tasks. 1 is scattered and unfinished; 5 is organised and followed through.",
  },
  {
    key: "hyperactivity",
    label: "Hyperactivity",
    low: "Restless",
    high: "Settled",
    hint: "Restlessness of body or speech — fidgeting, leaving the seat, talking over others. 1 is restless; 5 is settled.",
  },
  {
    key: "mental_acuity",
    label: "Mental acuity",
    low: "Foggy",
    high: "Sharp",
    hint: "How clear and quick thinking felt or appeared. 1 is foggy and slow; 5 is sharp.",
  },
  {
    key: "focus",
    label: "Focus",
    low: "Drifted",
    high: "Held",
    hint: "Holding attention on what mattered, without drifting off. 1 is drifted; 5 is held.",
  },
  {
    key: "mental_noise",
    label: "Mental noise",
    low: "Loud",
    high: "Quiet",
    hint: "How loud the inner chatter or racing thoughts were. Only the person taking medication can rate this. 1 is loud; 5 is quiet.",
  },
  {
    key: "sleep",
    label: "Sleep",
    low: "Broken",
    high: "Restored",
    hint: "How restorative last night’s sleep felt. Only the person taking medication can rate this. 1 is broken; 5 is restored.",
  },
  {
    key: "crash",
    label: "Crash",
    low: "Heavy",
    high: "None",
    hint: "The drop in energy or mood as the dose wore off. Only the person taking medication can rate this. 1 is heavy; 5 is none.",
  },
];

export const OBSERVER_METRICS = METRICS.filter((metric) =>
  (OBSERVER_METRIC_KEYS as readonly string[]).includes(metric.key),
);

export function isObserverMetric(key: MetricKey): boolean {
  return (OBSERVER_METRIC_KEYS as readonly string[]).includes(key);
}

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