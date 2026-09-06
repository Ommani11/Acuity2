import { useId, useState } from "react";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { MetricKey } from "@/lib/acuity/metrics";
import { METRICS } from "@/lib/acuity/metrics";

type MetricSliderProps = {
  metricKey: MetricKey;
  value: number | null;
  onChange: (value: number | null) => void;
  optional?: boolean;
};

export function MetricSlider({
  metricKey,
  value,
  onChange,
  optional = false,
}: MetricSliderProps) {
  const metric = METRICS.find((item) => item.key === metricKey);
  const hintId = useId();
  const [showHint, setShowHint] = useState(false);
  if (!metric) return null;
  const display = value ?? 3;
  const skipped = optional && value == null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <Label>{metric.label}</Label>
          <button
            type="button"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-expanded={showHint}
            aria-controls={hintId}
            onClick={() => setShowHint((open) => !open)}
          >
            <CircleHelp className="size-4" aria-hidden="true" />
            <span className="sr-only">What {metric.label.toLowerCase()} measures</span>
          </button>
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">
          {skipped ? "Skipped" : display}
        </span>
      </div>
      {showHint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {metric.hint}
        </p>
      ) : (
        <span id={hintId} className="sr-only">
          {metric.hint}
        </span>
      )}
      <Slider
        min={1}
        max={5}
        step={1}
        value={[display]}
        onValueChange={(next) => onChange(next[0] ?? 3)}
        aria-label={metric.label}
        aria-describedby={hintId}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{metric.low} (1)</span>
        <span>{metric.high} (5)</span>
      </div>
      {optional ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => onChange(null)}
          disabled={skipped}
        >
          {skipped ? "Skipped" : "Skip"}
        </Button>
      ) : null}
    </div>
  );
}