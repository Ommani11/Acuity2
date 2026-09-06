import { useState } from "react";
import { toast } from "sonner";
import { MetricSlider } from "@/components/acuity/metric-slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveDailyLog } from "@/lib/acuity/api";
import { METRICS, localDateIso } from "@/lib/acuity/metrics";
import type { DailyLog, TitrationProfile } from "@/lib/acuity/types";

type DailyCheckInFormProps = {
  titration: TitrationProfile;
  initialLog: DailyLog | null;
};

export function DailyCheckInForm({
  titration,
  initialLog,
}: DailyCheckInFormProps) {
  const [logDate, setLogDate] = useState(initialLog?.logDate ?? localDateIso());
  const [scores, setScores] = useState({
    executive_function: initialLog?.executiveFunction ?? 3,
    hyperactivity: initialLog?.hyperactivity ?? 3,
    mental_acuity: initialLog?.mentalAcuity ?? 3,
    focus: initialLog?.focus ?? 3,
    mental_noise: initialLog?.mentalNoise ?? 3,
    sleep: initialLog?.sleep ?? 3,
    crash: initialLog?.crash ?? 3,
  });
  const [medicationTaken, setMedicationTaken] = useState(
    initialLog?.medicationTaken ?? false,
  );
  const [sideEffects, setSideEffects] = useState(initialLog?.sideEffects ?? "");
  const [notes, setNotes] = useState(initialLog?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveDailyLog({
        data: {
          logDate,
          executiveFunction: scores.executive_function,
          hyperactivity: scores.hyperactivity,
          mentalAcuity: scores.mental_acuity,
          focus: scores.focus,
          mentalNoise: scores.mental_noise,
          sleep: scores.sleep,
          crash: scores.crash,
          medicationTaken,
          sideEffects,
          notes,
        },
      });
      toast.success("Check-in saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Logging against {titration.medicationName} {titration.doseMg} mg,
        {titration.dailyFrequency === 1
          ? " once daily"
          : ` ${titration.dailyFrequency} times daily`}
        .
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="log-date">Date</Label>
        <Input
          id="log-date"
          type="date"
          value={logDate}
          onChange={(event) => setLogDate(event.target.value)}
        />
      </div>
      {METRICS.map((metric) => (
        <MetricSlider
          key={metric.key}
          metricKey={metric.key}
          value={scores[metric.key]}
          onChange={(value) =>
            setScores((current) => ({
              ...current,
              [metric.key]: value ?? 3,
            }))
          }
        />
      ))}
      <div className="flex items-center justify-between gap-3 rounded-md bg-muted/70 px-3 py-3">
        <Label htmlFor="medication-taken">Medication taken</Label>
        <Switch
          id="medication-taken"
          checked={medicationTaken}
          onCheckedChange={setMedicationTaken}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="side-effects">Side effects</Label>
        <Textarea
          id="side-effects"
          value={sideEffects}
          onChange={(event) => setSideEffects(event.target.value)}
          placeholder="Appetite, sleep, mood, anything else"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Anything you want to remember about this day"
        />
      </div>
      <Button type="submit" disabled={saving} className="min-h-11 w-full sm:w-auto">
        {saving ? "Saving…" : "Save check-in"}
      </Button>
    </form>
  );
}
