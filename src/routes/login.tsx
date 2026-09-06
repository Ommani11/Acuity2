import { createFileRoute, Link, Navigate, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

type LoginSearch = { next?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  component: Login,
});

function Login() {
  const { next } = useSearch({ from: "/login" });
  const { user, isPending } = useCurrentUserState();
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  const callbackURL = safeNext ?? "/dashboard";

  if (!isPending && user) {
    const inviteToken = safeNext?.startsWith("/invite/")
      ? safeNext.slice("/invite/".length).split("/")[0]
      : "";
    if (inviteToken) {
      return <Navigate to="/invite/$token" params={{ token: inviteToken }} />;
    }
    return <Navigate to="/dashboard" />;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <Link to="/" className="font-display text-2xl tracking-tight">
        Acuity
      </Link>
      <h1 className="mt-8 font-display text-3xl font-medium tracking-tight">
        Sign in
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Use Google to keep your daily log, or to join as an invited observer.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        {authEnabled ? (
          GROK_PROVIDERS.map((provider) => (
            <Button
              key={provider.providerId}
              type="button"
              variant={provider.idp === "google" ? "default" : "outline"}
              size="lg"
              className="w-full"
              onClick={() => signIn(provider.providerId, { callbackURL })}
            >
              Continue with {provider.label}
            </Button>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Sign-in is disabled.</p>
        )}
      </div>
    </main>
  );
}
