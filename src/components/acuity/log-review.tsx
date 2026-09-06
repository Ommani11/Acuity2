import { METRICS, isObserverMetric, type MetricKey } from "@/lib/acuity/metrics";
import { formatDayGb } from "@/lib/acuity/reports";
import type { ReportDay, ReportObserverEntry } from "@/lib/acuity/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type LogReviewProps = {
  days: ReportDay[];
  canSeeSelf: boolean;
};

export function LogReview({ days, canSeeSelf }: LogReviewProps) {
  const filled = days.filter(
    (day) => day.self || day.observers.length > 0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily logs</CardTitle>
        <CardDescription>
          {canSeeSelf
            ? "Your check-ins and observer notes in this window."
            : "Your observations in this window. Their self-report is not shown."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {filled.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No logs in this window yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filled.map((day) => (
              <li key={day.logDate}>
                <details className="rounded-lg bg-muted/60 px-3 py-2">
                  <summary className="cursor-pointer list-none py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                    <span className="tabular-nums">{formatDayGb(day.logDate)}</span>
                    <span className="ml-2 font-normal text-muted-foreground">
                      {summaryLabel(day, canSeeSelf)}
                    </span>
                  </summary>
                  <div className="flex flex-col gap-4 pb-2 pt-1">
                    {canSeeSelf && day.self ? (
                      <LogBlock
                        title="You"
                        scores={day.self}
                        keys={METRICS.map((metric) => metric.key)}
                        medicationTaken={day.medicationTaken}
                        sideEffects={day.sideEffects}
                        notes={day.selfNotes}
                      />
                    ) : null}
                    {day.observers.map((entry, index) => (
                      <ObserverBlock
                        key={`${day.logDate}-${entry.observerName}-${index}`}
                        entry={entry}
                        title={canSeeSelf ? entry.observerName : "You"}
                      />
                    ))}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function summaryLabel(day: ReportDay, canSeeSelf: boolean): string {
  const parts: string[] = [];
  if (canSeeSelf && day.self) parts.push("you");
  if (day.observers.length === 1) parts.push("1 observer");
  if (day.observers.length > 1) parts.push(`${day.observers.length} observers`);
  if (!canSeeSelf && day.observers.length > 0) return "your observation";
  return parts.join(" · ");
}

function ObserverBlock({
  entry,
  title,
}: {
  entry: ReportObserverEntry;
  title: string;
}) {
  return (
    <LogBlock
      title={title}
      scores={entry.scores}
      keys={METRICS.map((metric) => metric.key).filter(isObserverMetric)}
      notes={entry.notes}
    />
  );
}

function LogBlock({
  title,
  scores,
  keys,
  medicationTaken,
  sideEffects,
  notes,
}: {
  title: string;
  scores: Partial<Record<MetricKey, number | null>>;
  keys: MetricKey[];
  medicationTaken?: boolean | null;
  sideEffects?: string | null;
  notes?: string | null;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-border/70 pt-3">
      <p className="text-sm font-medium">{title}</p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm sm:grid-cols-4">
        {keys.map((key) => {
          const metric = METRICS.find((item) => item.key === key);
          const value = scores[key];
          return (
            <div key={key}>
              <dt className="text-muted-foreground">{metric?.label}</dt>
              <dd className="tabular-nums">{value ?? "—"}</dd>
            </div>
          );
        })}
      </dl>
      {medicationTaken != null ? (
        <p className="text-sm text-muted-foreground">
          Medication {medicationTaken ? "taken" : "not taken"}
        </p>
      ) : null}
      {sideEffects ? (
        <p className="text-sm">
          <span className="text-muted-foreground">Side effects. </span>
          {sideEffects}
        </p>
      ) : null}
      {notes ? (
        <p className="text-sm">
          <span className="text-muted-foreground">Notes. </span>
          {notes}
        </p>
      ) : null}
    </div>
  );
}