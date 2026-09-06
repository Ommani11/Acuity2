import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getReport } from "@/lib/acuity/api";
import { METRICS, OBSERVER_METRICS, isObserverMetric, localDateIso, type MetricKey } from "@/lib/acuity/metrics";
import {
  REPORT_RANGES,
  addDaysIso,
  formatDayGb,
  higherIsBetter,
  mean,
  metricSeries,
} from "@/lib/acuity/reports";
import type { ReportPayload, ReportRangeDays, UserRole } from "@/lib/acuity/types";
import { LogReview } from "@/components/acuity/log-review";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type ReportsViewProps = {
  role: UserRole;
};

export function ReportsView({ role }: ReportsViewProps) {
  const [range, setRange] = useState<ReportRangeDays>(28);
  const [metric, setMetric] = useState<MetricKey>("mental_acuity");
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const to = localDateIso();
  const from = addDaysIso(to, -(range - 1));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getReport({ data: { from, to } })
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load reports");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const metricOptions = role === "observer" ? OBSERVER_METRICS : METRICS;
  const selected = metricOptions.find((item) => item.key === metric) ?? metricOptions[0];
  const showObserved = isObserverMetric(metric);

  const chartRows = useMemo(() => {
    if (!report) return [];
    return report.days.map((day) => ({
      date: day.logDate,
      label: formatDayGb(day.logDate),
      self: day.self?.[metric] ?? null,
      observed: day.observed?.[metric] ?? null,
    }));
  }, [report, metric]);

  const selfMean = report ? mean(metricSeries(report.days, metric, "self")) : null;
  const observedMean = showObserved && report
    ? mean(metricSeries(report.days, metric, "observed"))
    : null;
  const recent = report ? metricSeries(report.days.slice(-7), metric, report.canSeeSelf ? "self" : "observed") : [];
  const previous = report
    ? metricSeries(report.days.slice(-14, -7), metric, report.canSeeSelf ? "self" : "observed")
    : [];
  const recentMean = mean(recent);
  const previousMean = mean(previous);
  const delta =
    recentMean != null && previousMean != null
      ? Math.round((recentMean - previousMean) * 10) / 10
      : null;
  const improved =
    delta == null ? null : higherIsBetter(metric) ? delta > 0 : delta < 0;

  const hasPoints = chartRows.some(
    (row) => row.self != null || (showObserved && row.observed != null),
  );
  const sideEffects =
    report?.canSeeSelf
      ? report.days.filter((day) => day.sideEffects).map((day) => ({
          date: day.logDate,
          text: day.sideEffects as string,
        }))
      : [];
  const doseChanges = (report?.titrations ?? []).filter(
    (item) => item.startedOn >= from && item.startedOn <= to,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">Patterns</p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">
          Reports
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          {role === "observer"
            ? "Your observations only — you cannot see their self-report."
            : "Your scores over time, with observer averages as a dashed line when they log."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {REPORT_RANGES.map((item) => (
          <Button
            key={item.days}
            type="button"
            size="sm"
            variant={range === item.days ? "default" : "outline"}
            className="min-h-11"
            onClick={() => setRange(item.days)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {metricOptions.map((item) => (
          <Button
            key={item.key}
            type="button"
            size="sm"
            variant={metric === item.key ? "secondary" : "ghost"}
            className="min-h-11"
            onClick={() => setMetric(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{selected?.label}</CardTitle>
            <CardDescription>
              {selected?.hint} Scale of 1 ({selected?.low}) to 5 ({selected?.high}).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasPoints ? (
              <div className="h-56 w-full sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--color-border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      minTickGap={28}
                    />
                    <YAxis
                      domain={[1, 5]}
                      ticks={[1, 2, 3, 4, 5]}
                      width={28}
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "0.75rem",
                        color: "var(--color-foreground)",
                      }}
                      formatter={(value, name) => [
                        value ?? "—",
                        name === "self" ? "You" : "Observers",
                      ]}
                    />
                    {report?.canSeeSelf ? (
                      <Line
                        type="monotone"
                        dataKey="self"
                        name="self"
                        stroke="var(--color-primary)"
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                      />
                    ) : null}
                    {showObserved ? (
                      <Line
                        type="monotone"
                        dataKey="observed"
                        name="observed"
                        stroke="var(--color-foreground)"
                        strokeOpacity={0.45}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        connectNulls={false}
                      />
                    ) : null}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Log a few days and a picture will form here.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm tabular-nums text-muted-foreground">
              {report?.canSeeSelf ? (
                <p>
                  Your average{" "}
                  <span className="font-medium text-foreground">
                    {selfMean ?? "—"}
                  </span>
                </p>
              ) : null}
              {showObserved ? (
                <p>
                  Observer average{" "}
                  <span className="font-medium text-foreground">
                    {observedMean ?? "—"}
                  </span>
                </p>
              ) : null}
              {delta != null ? (
                <p>
                  Last 7 days{" "}
                  <span
                    className={
                      improved
                        ? "font-medium text-primary"
                        : "font-medium text-foreground"
                    }
                  >
                    {delta > 0 ? "+" : ""}
                    {delta}
                  </span>{" "}
                  vs the week before
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      {doseChanges.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Dose changes</CardTitle>
            <CardDescription>Starts that fall in this window.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {doseChanges.map((item) => (
                <li key={item.id} className="flex justify-between gap-3">
                  <span>
                    {item.medicationName} {item.doseMg} mg
                    {item.isActive ? " · current" : ""}
                  </span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {formatDayGb(item.startedOn)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {sideEffects.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Side effects</CardTitle>
            <CardDescription>From your self-reports in this window.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3 text-sm">
              {sideEffects.map((item) => (
                <li key={`${item.date}-${item.text}`}>
                  <p className="text-muted-foreground tabular-nums">
                    {formatDayGb(item.date)}
                  </p>
                  <p>{item.text}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {!loading && report ? (
        <LogReview days={report.days} canSeeSelf={report.canSeeSelf} />
      ) : null}
    </div>
  );
}
