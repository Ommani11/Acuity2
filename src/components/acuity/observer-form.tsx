import { useState } from "react";
import { toast } from "sonner";
import { MetricSlider } from "@/components/acuity/metric-slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveObserverLog } from "@/lib/acuity/api";
import {
  OBSERVER_METRICS,
  localDateIso,
  type MetricKey,
} from "@/lib/acuity/metrics";
import type { LinkedPerson, ObserverLog, TitrationProfile } from "@/lib/acuity/types";

type ObserverFormProps = {
  subject: LinkedPerson;
  titration: TitrationProfile | null;
  initialLog: ObserverLog | null;
};

export function ObserverForm({
  titration,
  initialLog,
}: ObserverFormProps) {
  const [logDate, setLogDate] = useState(initialLog?.logDate ?? localDateIso());
  const [scores, setScores] = useState<Record<MetricKey, number | null>>({
    executive_function: initialLog?.executiveFunction ?? null,
    hyperactivity: initialLog?.hyperactivity ?? null,
    mental_acuity: initialLog?.mentalAcuity ?? null,
    focus: initialLog?.focus ?? null,
    mental_noise: null,
    sleep: null,
    crash: null,
  });
  const [notes, setNotes] = useState(initialLog?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveObserverLog({
        data: {
          logDate,
          scores: {
            ...scores,
            mental_noise: null,
            sleep: null,
            crash: null,
          },
          notes,
        },
      });
      toast.success("Observation saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (!titration) {
    return (
      <p className="text-sm text-muted-foreground">
        They have not set an active medication yet. You can still wait, then
        record what you notice once they have.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Against {titration.medicationName} {titration.doseMg} mg. Rate only
        what you saw. Mental noise, sleep, and crash are theirs to log — press
        Skip on any remaining scale you did not actually see.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="obs-date">Date</Label>
        <Input
          id="obs-date"
          type="date"
          value={logDate}
          onChange={(event) => setLogDate(event.target.value)}
        />
      </div>
      {OBSERVER_METRICS.map((metric) => (
        <MetricSlider
          key={metric.key}
          metricKey={metric.key}
          value={scores[metric.key]}
          optional
          onChange={(value) =>
            setScores((current) => ({ ...current, [metric.key]: value }))
          }
        />
      ))}
      <div className="flex flex-col gap-2">
        <Label htmlFor="obs-notes">What you noticed</Label>
        <Textarea
          id="obs-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Behaviour, mood, energy — only what you saw"
        />
      </div>
      <Button type="submit" disabled={saving} className="min-h-11 w-full sm:w-auto">
        {saving ? "Saving…" : "Save observation"}
      </Button>
    </form>
  );
}