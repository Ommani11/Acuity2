import { createFileRoute, Link } from "@tanstack/react-router";
import { DailyCheckInForm } from "@/components/acuity/daily-check-in-form";
import { RoleGate } from "@/components/acuity/role-gate";
import { TitrationForm } from "@/components/acuity/titration-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <RoleGate allow="primary">
      {(bootstrap, reload) => (
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-sm text-muted-foreground">Daily log</p>
            <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">
              Check-in
            </h1>
          </div>

          {!bootstrap.activeTitration ? (
            <Card>
              <CardHeader>
                <CardTitle>Set your medication</CardTitle>
                <CardDescription>
                  Before you can log a day, record the titration you are
                  currently on — name, dose, and how many times you take it
                  daily.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TitrationForm current={null} onSaved={() => reload()} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>How was today?</CardTitle>
                <CardDescription>
                  Seven scales from 1 to 5, then side effects and notes. You
                  can update the same day if it changes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DailyCheckInForm
                  titration={bootstrap.activeTitration}
                  initialLog={bootstrap.todayLog}
                />
              </CardContent>
            </Card>
          )}

          <p className="text-sm text-muted-foreground">
            Need to change dose or invite an observer?{" "}
            <Button asChild variant="link" className="h-auto px-0">
              <Link to="/treatment">Open treatment</Link>
            </Button>
          </p>
        </div>
      )}
    </RoleGate>
  );
}
