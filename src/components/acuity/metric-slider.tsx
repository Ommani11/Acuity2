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
  if (!metric) return null;
  const display = value ?? 3;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label>{metric.label}</Label>
        <span className="text-sm tabular-nums text-muted-foreground">
          {value == null && optional ? "Skipped" : display}
        </span>
      </div>
      <Slider
        min={1}
        max={5}
        step={1}
        value={[display]}
        onValueChange={(next) => onChange(next[0] ?? 3)}
        aria-label={metric.label}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{metric.low}</span>
        <span>{metric.high}</span>
      </div>
      {optional && (
        <button
          type="button"
          className="self-start text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => onChange(null)}
        >
          Skip this scale
        </button>
      )}
    </div>
  );
}
