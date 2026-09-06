import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: ReactNode;
  role?: "primary" | "observer" | null;
};

export function AppShell({ children, role }: AppShellProps) {
  const { isPending } = useCurrentUserState();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4">
          <Link
            to="/"
            className="font-display text-lg tracking-tight text-foreground"
          >
            Acuity
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {role === "primary" && (
              <>
                <NavLink to="/dashboard">Check-in</NavLink>
                <NavLink to="/reports">Reports</NavLink>
                <NavLink to="/treatment">Treatment</NavLink>
              </>
            )}
            {role === "observer" && (
              <>
                <NavLink to="/observer">Observe</NavLink>
                <NavLink to="/reports">Reports</NavLink>
              </>
            )}
          </nav>
          <div className="min-w-0 shrink-0">
            {isPending ? (
              <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />
            ) : (
              <UserButton />
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}

function NavLink({
  to,
  children,
}: {
  to: "/dashboard" | "/treatment" | "/observer" | "/reports";
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "rounded-md px-3 py-2 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground",
      )}
      activeProps={{
        className: "bg-muted text-foreground",
      }}
    >
      {children}
    </Link>
  );
}
