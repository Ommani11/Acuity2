import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/acuity/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { getBootstrap } from "@/lib/acuity/api";
import { localDateIso } from "@/lib/acuity/metrics";
import type { Bootstrap, UserRole } from "@/lib/acuity/types";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

type RoleGateProps = {
  allow: UserRole;
  children: (bootstrap: Bootstrap, reload: () => void) => ReactNode;
};

export function RoleGate({ allow, children }: RoleGateProps) {
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) {
      setBootstrap(null);
      return;
    }
    let cancelled = false;
    setError(null);
    getBootstrap({ data: { today: localDateIso() } })
      .then((data) => {
        if (!cancelled) setBootstrap(data);
      })
      .catch((err) => {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Could not load your profile";
          setError(message === "Unauthorized" ? "Please sign in again" : message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId, tick]);

  if (isPending) {
    return (
      <AppShell>
        <PageSkeleton />
      </AppShell>
    );
  }

  if (!user) return <RedirectToSignIn />;

  if (error) {
    return (
      <AppShell>
        <p className="text-sm text-destructive">{error}</p>
      </AppShell>
    );
  }

  if (!bootstrap) {
    return (
      <AppShell>
        <PageSkeleton />
      </AppShell>
    );
  }

  if (bootstrap.role !== allow) {
    return (
      <Navigate to={bootstrap.role === "observer" ? "/observer" : "/dashboard"} />
    );
  }

  return (
    <AppShell role={bootstrap.role}>
      {children(bootstrap, () => setTick((n) => n + 1))}
    </AppShell>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
