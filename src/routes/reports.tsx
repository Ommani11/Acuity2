import { createFileRoute } from "@tanstack/react-router";
import { ReportsView } from "@/components/acuity/reports-view";
import { RoleGate } from "@/components/acuity/role-gate";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <RoleGate allow={["primary", "observer"]}>
      {(bootstrap) => <ReportsView role={bootstrap.role} />}
    </RoleGate>
  );
}
