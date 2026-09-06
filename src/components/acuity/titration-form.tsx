import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveTitrationProfile } from "@/lib/acuity/api";
import type { TitrationProfile } from "@/lib/acuity/types";

type TitrationFormProps = {
  current: TitrationProfile | null;
  onSaved: () => void;
};

export function TitrationForm({ current, onSaved }: TitrationFormProps) {
  const [medicationName, setMedicationName] = useState(
    current?.medicationName ?? "",
  );
  const [doseMg, setDoseMg] = useState(current ? String(current.doseMg) : "");
  const [dailyFrequency, setDailyFrequency] = useState(
    current ? String(current.dailyFrequency) : "1",
  );
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveTitrationProfile({
        data: {
          medicationName,
          doseMg: Number(doseMg),
          dailyFrequency: Number(dailyFrequency),
        },
      });
      toast.success(current ? "New dose started" : "Medication saved");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {current && (
        <p className="text-sm text-muted-foreground">
          Current: {current.medicationName} {current.doseMg} mg,{" "}
          {current.dailyFrequency} daily. Saving starts a new profile and
          archives this one.
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="med-name">Medication</Label>
        <Input
          id="med-name"
          value={medicationName}
          onChange={(event) => setMedicationName(event.target.value)}
          placeholder="e.g. lisdexamfetamine"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="dose">Dose (mg)</Label>
          <Input
            id="dose"
            type="number"
            min={0.1}
            step="0.1"
            value={doseMg}
            onChange={(event) => setDoseMg(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="freq">Times per day</Label>
          <Input
            id="freq"
            type="number"
            min={0.5}
            step="0.5"
            value={dailyFrequency}
            onChange={(event) => setDailyFrequency(event.target.value)}
          />
        </div>
      </div>
      <Button type="submit" disabled={saving} className="min-h-11 w-full sm:w-auto">
        {saving ? "Saving…" : current ? "Start this dose" : "Save medication"}
      </Button>
    </form>
  );
}
