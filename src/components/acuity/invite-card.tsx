import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createObserverInvite } from "@/lib/acuity/api";
import { MAX_OBSERVERS, type LinkedPerson, type PendingInvite } from "@/lib/acuity/types";

type InviteCardProps = {
  observers: LinkedPerson[];
  pendingInvite: PendingInvite | null;
  onCreated: (invite: PendingInvite) => void;
};

export function InviteCard({
  observers,
  pendingInvite,
  onCreated,
}: InviteCardProps) {
  const [invite, setInvite] = useState(pendingInvite);
  const [working, setWorking] = useState(false);
  const atCap = observers.length >= MAX_OBSERVERS;

  const url =
    typeof window !== "undefined" && invite
      ? `${window.location.origin}/invite/${invite.token}`
      : invite
        ? `/invite/${invite.token}`
        : "";

  async function createInvite() {
    setWorking(true);
    try {
      const next = await createObserverInvite();
      setInvite(next);
      onCreated(next);
      toast.success("Invite link ready");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create invite");
    } finally {
      setWorking(false);
    }
  }

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy — select the link instead");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Observers</CardTitle>
        <CardDescription>
          Invite a partner, parent, or clinician. Each person logs what they
          notice, independently. They will not see your self-report.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {observers.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {observers.map((person) => (
              <li
                key={person.userId}
                className="flex items-center justify-between gap-3 rounded-md bg-muted/70 px-3 py-2"
              >
                <span className="min-w-0 truncate text-sm font-medium">
                  {person.displayName}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  Linked
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No observers yet. Create a link and send it to each person you want
            watching this titration.
          </p>
        )}

        {atCap ? (
          <p className="text-sm text-muted-foreground">
            You have reached the limit of {MAX_OBSERVERS} observers.
          </p>
        ) : (
          <>
            {invite && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input readOnly value={url} aria-label="Invite link" />
                <Button type="button" variant="secondary" onClick={copyLink}>
                  Copy link
                </Button>
              </div>
            )}
            <Button
              type="button"
              variant={invite || observers.length > 0 ? "outline" : "default"}
              onClick={createInvite}
              disabled={working}
              className="min-h-11 w-full sm:w-auto"
            >
              {working
                ? "Creating…"
                : invite
                  ? "Create a new link"
                  : observers.length > 0
                    ? "Invite another observer"
                    : "Create invite link"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
