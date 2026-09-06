import { createFileRoute } from "@tanstack/react-router";
import { ObserverForm } from "@/components/acuity/observer-form";
import { RoleGate } from "@/components/acuity/role-gate";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/observer")({
  component: ObserverPage,
});

function ObserverPage() {
  return (
    <RoleGate allow="observer">
      {(bootstrap) => (
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-sm text-muted-foreground">Observer view</p>
            <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">
              Observation
            </h1>
          </div>
          {bootstrap.subject ? (
            <Card>
              <CardHeader>
                <CardTitle>{bootstrap.subject.displayName}</CardTitle>
                <CardDescription>
                  A stripped-back log of what you noticed. You cannot see their
                  self-report.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ObserverForm
                  subject={bootstrap.subject}
                  titration={bootstrap.activeTitration}
                  initialLog={bootstrap.todayObservation}
                />
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">
              This observer account is not linked to anyone yet.
            </p>
          )}
        </div>
      )}
    </RoleGate>
  );
}
