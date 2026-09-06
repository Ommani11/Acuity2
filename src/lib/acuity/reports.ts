import { METRIC_KEYS, type MetricKey } from "./metrics";
import type { DailyLog, ObserverLog, ReportDay } from "./types";

export const REPORT_RANGES: { days: 7 | 14 | 28 | 90; label: string }[] = [
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
  { days: 28, label: "28 days" },
  { days: 90, label: "90 days" },
];

/** Higher scores are better on these scales; the rest improve as they fall. */
export function higherIsBetter(key: MetricKey): boolean {
  return (
    key === "executive_function" ||
    key === "mental_acuity" ||
    key === "focus" ||
    key === "sleep"
  );
}

export function scoresFromDaily(log: DailyLog): Record<MetricKey, number> {
  return {
    executive_function: log.executiveFunction,
    hyperactivity: log.hyperactivity,
    mental_acuity: log.mentalAcuity,
    focus: log.focus,
    mental_noise: log.mentalNoise,
    sleep: log.sleep,
    crash: log.crash,
  };
}

export function scoresFromObserver(
  log: ObserverLog,
): Record<MetricKey, number | null> {
  return {
    executive_function: log.executiveFunction,
    hyperactivity: log.hyperactivity,
    mental_acuity: log.mentalAcuity,
    focus: log.focus,
    mental_noise: log.mentalNoise,
    sleep: log.sleep,
    crash: log.crash,
  };
}

export function averageScores(
  rows: Array<Record<MetricKey, number | null>>,
): Record<MetricKey, number | null> | null {
  if (rows.length === 0) return null;
  const out = {} as Record<MetricKey, number | null>;
  let any = false;
  for (const key of METRIC_KEYS) {
    const values = rows
      .map((row) => row[key])
      .filter((value): value is number => value != null);
    if (values.length === 0) {
      out[key] = null;
    } else {
      any = true;
      out[key] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
    }
  }
  return any ? out : null;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export function metricSeries(days: ReportDay[], key: MetricKey, source: "self" | "observed"): number[] {
  const values: number[] = [];
  for (const day of days) {
    const block = source === "self" ? day.self : day.observed;
    const value = block?.[key];
    if (typeof value === "number") values.push(value);
  }
  return values;
}

export function formatDayGb(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function addDaysIso(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const utc = Date.UTC(year, (month ?? 1) - 1, (day ?? 1) + days);
  const next = new Date(utc);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function eachIsoDate(from: string, to: string): string[] {
  const out: string[] = [];
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard < 400) {
    out.push(cursor);
    cursor = addDaysIso(cursor, 1);
    guard += 1;
  }
  return out;
}
