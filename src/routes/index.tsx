import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { METRICS } from "@/lib/acuity/metrics";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-10 sm:py-16">
      <header className="flex items-center justify-between">
        <span className="font-display text-xl tracking-tight">Acuity</span>
        <AuthAction size="sm" signedOutLabel="Sign in" signedInLabel="Open log" />
      </header>

      <section className="stagger-in mt-16 flex flex-col gap-6 sm:mt-24">
        <div className="acuity-mark" aria-hidden="true" />
        <h1 className="max-w-xl font-display text-4xl font-medium tracking-tight sm:text-5xl">
          See the day clearly.
        </h1>
        <p className="max-w-lg text-base text-muted-foreground sm:text-lg">
          A quiet daily log for ADHD medication. You rate how the day felt.
          Observers you invite record the behaviour they actually saw.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <AuthAction
            size="lg"
            signedOutLabel="Start a log"
            signedInLabel="Continue to check-in"
          />
        </div>
      </section>

      <section className="mt-16 grid gap-3 sm:grid-cols-2">
        {METRICS.map((metric) => (
          <div
            key={metric.key}
            className="rounded-lg bg-card px-4 py-3 shadow-[var(--shadow-border)]"
          >
            <p className="text-sm font-medium">{metric.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {metric.low} → {metric.high}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-12 rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
        <h2 className="font-display text-2xl font-medium">Two views, one record</h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium">You</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Log executive function, hyperactivity, mental acuity, focus,
              mental noise, sleep, and crash — plus side effects and notes —
              against the medication you are titrating.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Your observers</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Invite several people — partner, parent, clinician. Each signs
              in with Google and gets a stripped-back form. They cannot read
              your self-report.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function AuthAction({
  size,
  signedOutLabel,
  signedInLabel,
}: {
  size: "sm" | "lg";
  signedOutLabel: string;
  signedInLabel: string;
}) {
  const { sessionUser } = useRouteContext({ from: "__root__" });
  const { user, isPending } = useCurrentUserState();
  const signedIn = isPending ? Boolean(sessionUser) : Boolean(user);

  return (
    <Button
      asChild
      size={size}
      variant={size === "sm" && !signedIn ? "outline" : "default"}
    >
      <Link to={signedIn ? "/dashboard" : "/login"}>
        {signedIn ? signedInLabel : signedOutLabel}
      </Link>
    </Button>
  );
}
