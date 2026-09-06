import { createFileRoute } from "@tanstack/react-router";
import { InviteCard } from "@/components/acuity/invite-card";
import { RoleGate } from "@/components/acuity/role-gate";
import { TitrationForm } from "@/components/acuity/titration-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/treatment")({
  component: TreatmentPage,
});

function TreatmentPage() {
  return (
    <RoleGate allow="primary">
      {(bootstrap, reload) => (
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-sm text-muted-foreground">Titration</p>
            <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">
              Treatment
            </h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Active medication</CardTitle>
              <CardDescription>
                Daily logs attach to the profile that is active on that day.
                Starting a new dose archives the previous one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TitrationForm
                current={bootstrap.activeTitration}
                onSaved={() => reload()}
              />
            </CardContent>
          </Card>

          <InviteCard
            observers={bootstrap.observers}
            pendingInvite={bootstrap.pendingInvite}
            onCreated={() => reload()}
          />
        </div>
      )}
    </RoleGate>
  );
}
