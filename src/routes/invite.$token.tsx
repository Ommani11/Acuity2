import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { acceptObserverInvite, previewObserverInvite } from "@/lib/acuity/api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const [status, setStatus] = useState<
    | { kind: "loading" }
    | { kind: "ready"; displayName: string }
    | { kind: "error"; message: string }
    | { kind: "accepted" }
  >({ kind: "loading" });
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    previewObserverInvite({ data: { token } })
      .then((preview) => {
        if (!cancelled) {
          setStatus({ kind: "ready", displayName: preview.displayName });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStatus({
            kind: "error",
            message: error instanceof Error ? error.message : "Invalid invite",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, token]);

  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center px-4">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" search={{ next: `/invite/${token}` }} />;
  }

  async function accept() {
    setAccepting(true);
    try {
      await acceptObserverInvite({ data: { token } });
      setStatus({ kind: "accepted" });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not accept invite",
      });
    } finally {
      setAccepting(false);
    }
  }

  if (status.kind === "accepted") {
    return <Navigate to="/observer" />;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <Link to="/" className="font-display text-2xl tracking-tight">
        Acuity
      </Link>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Observer invite</CardTitle>
          <CardDescription>
            You will record external observations only. You will not see their
            daily self-report.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {status.kind === "loading" && (
            <p className="text-sm text-muted-foreground">Checking invite…</p>
          )}
          {status.kind === "ready" && (
            <>
              <p className="text-sm">
                Join as observer for{" "}
                <span className="font-medium">{status.displayName}</span>?
              </p>
              <Button onClick={accept} disabled={accepting}>
                {accepting ? "Joining…" : "Accept invite"}
              </Button>
            </>
          )}
          {status.kind === "error" && (
            <p className="text-sm text-destructive">{status.message}</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
