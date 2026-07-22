"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useSession, useUser } from "@clerk/nextjs";
import type { SessionWithActivitiesResource } from "@clerk/types";
import { Laptop, Smartphone, X } from "lucide-react";
import {
  btnDestructive,
  btnDestructiveSolid,
  btnSecondary,
} from "@/components/ui/button-system";
import {
  preferredNameMetadata,
  resolvePreferredName,
} from "@/lib/user-display";
import { clearLocalUnfoldData } from "@/lib/clear-local-data";
import { cacheStampDisplayName } from "@/lib/stamp-display-name";

const EXPORT_MAILTO =
  "mailto:hello@unfold.app?subject=Export%20my%20Unfold%20data&body=Please%20send%20a%20copy%20of%20my%20Unfold%20data.";

const copyStyle = {
  fontSize: "var(--text-sm)",
  lineHeight: "var(--text-sm--line-height)",
  fontFamily: "var(--font-body)",
} as const;

const pageTitleStyle = {
  fontFamily: "var(--font-heading)",
} as const;

const PANEL_HEIGHT = "min(44rem, calc(100svh - 2rem))";

function avatarLetter(source: string | null | undefined): string {
  const word = source?.trim().split(/\s+/)[0];
  const letter = word?.[0];
  return letter ? letter.toLowerCase() : "u";
}

function PreferredNameField({
  value,
  onSave,
}: {
  value: string;
  onSave: (next: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!savingRef.current) setDraft(value);
  }, [value]);

  const save = async () => {
    const next = draft.trim();
    if (savingRef.current) return;
    if (next === value.trim()) {
      setError(null);
      return;
    }

    savingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await onSave(next);
    } catch (err) {
      setDraft(value);
      const clerkMessage =
        err &&
        typeof err === "object" &&
        "errors" in err &&
        Array.isArray((err as { errors: Array<{ longMessage?: string; message?: string }> }).errors)
          ? (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0]
              ?.longMessage ||
            (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0]
              ?.message
          : null;
      setError(clerkMessage || "Couldn’t save. Try again.");
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  };

  return (
    <label className="flex min-w-0 max-w-56 flex-col gap-1">
      <span
        className="text-(--sidebar-ink-soft) text-2xs"
        style={{ fontSize: "var(--text-2xs)" }}
      >
        Preferred name
      </span>
      <input
        type="text"
        value={draft}
        readOnly={busy}
        spellCheck={false}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setDraft(value);
            setError(null);
            event.currentTarget.blur();
          }
        }}
        className="w-full rounded-sm border border-(--sidebar-border) bg-(--surface-raised) px-2.5 py-0.75 text-primary outline-none transition-colors focus:border-(--canvas-title-ink) focus-visible:ring-2 focus-visible:ring-black/10 read-only:opacity-60"
        style={copyStyle}
        aria-invalid={error ? true : undefined}
        aria-busy={busy || undefined}
      />
      {error ? (
        <p
          className="text-(--button-destructive-soft-foreground)"
          style={{ fontSize: "var(--text-2xs)", fontFamily: "var(--font-body)" }}
        >
          {error}
        </p>
      ) : null}
    </label>
  );
}

function formatSessionWhen(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isRecentActivity(date: Date) {
  return Date.now() - date.getTime() < 2 * 60 * 1000;
}

function sessionDeviceName(session: SessionWithActivitiesResource) {
  const activity = session.latestActivity;
  return (
    activity.browserName ||
    activity.deviceType ||
    (activity.isMobile ? "Mobile" : "Desktop")
  );
}

function sessionLocation(session: SessionWithActivitiesResource) {
  const activity = session.latestActivity;
  const place = [activity.city, activity.country].filter(Boolean).join(", ");
  return place || "Unknown location";
}

function isMobileSession(session: SessionWithActivitiesResource) {
  const activity = session.latestActivity;
  if (typeof activity.isMobile === "boolean") return activity.isMobile;
  const hint = `${activity.deviceType ?? ""} ${activity.browserName ?? ""}`.toLowerCase();
  return /mobile|phone|iphone|android|ipad|tablet/.test(hint);
}

const DEVICES_PAGE_SIZE = 4;

function LastLoginsSection({
  user,
}: {
  user: {
    id: string;
    lastSignInAt: Date | null;
    getSessions: () => Promise<SessionWithActivitiesResource[]>;
  };
}) {
  const { session: currentSession } = useSession();
  const [sessions, setSessions] = useState<SessionWithActivitiesResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(DEVICES_PAGE_SIZE);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setVisibleCount(DEVICES_PAGE_SIZE);
    void user
      .getSessions()
      .then((list) => {
        if (cancelled) return;
        const sorted = [...list].sort((a, b) => {
          const aCurrent = a.id === currentSession?.id ? 1 : 0;
          const bCurrent = b.id === currentSession?.id ? 1 : 0;
          if (aCurrent !== bCurrent) return bCurrent - aCurrent;
          return b.lastActiveAt.getTime() - a.lastActiveAt.getTime();
        });
        setSessions(sorted);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, currentSession?.id]);

  const otherSessions = sessions.filter(
    (session) => session.id !== currentSession?.id,
  );
  const visibleSessions = sessions.slice(0, visibleCount);
  const hiddenCount = Math.max(0, sessions.length - visibleCount);

  const revoke = async (session: SessionWithActivitiesResource) => {
    if (session.id === currentSession?.id || revokingId || revokingAll) return;
    setRevokingId(session.id);
    try {
      await session.revoke();
      setSessions((prev) => prev.filter((item) => item.id !== session.id));
    } catch {
      // keep row; user can retry
    } finally {
      setRevokingId(null);
    }
  };

  const revokeAllOthers = async () => {
    if (revokingAll || otherSessions.length === 0) return;
    setRevokingAll(true);
    const remaining: SessionWithActivitiesResource[] = [];
    for (const session of otherSessions) {
      try {
        await session.revoke();
      } catch {
        remaining.push(session);
      }
    }
    setSessions((prev) =>
      prev.filter(
        (session) =>
          session.id === currentSession?.id ||
          remaining.some((item) => item.id === session.id),
      ),
    );
    setRevokingAll(false);
  };

  return (
    <section className="flex flex-col gap-4 pt-2">
      <div className="border-b border-(--popover-border) pb-3">
        <h2 className="font-medium text-primary" style={copyStyle}>
          Devices
        </h2>
      </div>

      <div className="flex items-start justify-between gap-3 border-b border-(--popover-border) pb-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-secondary text-sm">
            Log out of all devices
          </p>
          <p
            className="text-(--sidebar-ink-soft)"
            style={{ fontSize: "var(--text-xs)" }}
          >
            Log out of active sessions on all your devices, other than this one.
          </p>
        </div>
        <button
          type="button"
          disabled={revokingAll || otherSessions.length === 0}
          onClick={() => void revokeAllOthers()}
          className={`shrink-0 ${btnDestructive("xs")} text-tertiary!`}
        >
          {revokingAll ? "Logging out…" : "Log out of all devices"}
        </button>
      </div>

      {loading ? (
        <p className="text-(--sidebar-ink-soft)" style={copyStyle}>
          Loading devices…
        </p>
      ) : sessions.length === 0 ? (
        <p className="text-(--sidebar-ink-soft)" style={copyStyle}>
          No recent devices found.
        </p>
      ) : (
        <div className="flex flex-col">
          <div
            className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_auto] gap-2 pb-2 text-(--sidebar-ink-soft)"
            style={{ fontSize: "var(--text-xs)" }}
          >
            <span>Device</span>
            <span>Last active</span>
            <span>Location</span>
            <span className="w-16" aria-hidden />
          </div>

          <ul className="flex flex-col">
            {visibleSessions.map((session) => {
              const isCurrent = session.id === currentSession?.id;
              const DeviceIcon = isMobileSession(session) ? Smartphone : Laptop;
              return (
                <li
                  key={session.id}
                  className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_auto] items-center gap-2 border-t border-(--popover-border) py-2.5"
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <DeviceIcon
                      size={14}
                      strokeWidth={1.75}
                      aria-hidden
                      className="mt-0.5 shrink-0 text-(--sidebar-icon)"
                    />
                    <div className="min-w-0">
                      <p
                        className="truncate text-secondary"
                        style={{ fontSize: "var(--text-xs)", lineHeight: "1.4" }}
                      >
                        {sessionDeviceName(session)}
                      </p>
                      {isCurrent ? (
                        <p
                          className="text-2xs text-(--canvas-title-ink)"
                        >
                          This device
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <p
                    className="truncate text-(--sidebar-ink-soft)"
                    style={{ fontSize: "var(--text-xs)" }}
                  >
                    {isCurrent || isRecentActivity(session.lastActiveAt)
                      ? "Now"
                      : formatSessionWhen(session.lastActiveAt)}
                  </p>

                  <p
                    className="min-w-0 truncate text-(--sidebar-ink-soft)"
                    style={{ fontSize: "var(--text-xs)" }}
                    title={sessionLocation(session)}
                  >
                    {sessionLocation(session)}
                  </p>

                  <div className="flex w-16 justify-end">
                    {!isCurrent ? (
                      <button
                        type="button"
                        disabled={revokingId === session.id || revokingAll}
                        onClick={() => void revoke(session)}
                        className={btnSecondary("xs")}
                      >
                        {revokingId === session.id ? "…" : "Log out"}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() =>
                setVisibleCount((count) => count + DEVICES_PAGE_SIZE)
              }
              className="mt-2 self-start text-(--sidebar-ink-soft) transition-colors hover:text-(--sidebar-ink)"
              style={{ fontSize: "var(--text-xs)" }}
            >
              ↓ Load {hiddenCount} more device{hiddenCount === 1 ? "" : "s"}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}

function AccountPanelView() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <p className="text-(--sidebar-ink-soft)" style={copyStyle}>
        Loading…
      </p>
    );
  }

  if (!user) {
    return (
      <p className="text-(--sidebar-ink-soft)" style={copyStyle}>
        Sign in to view your account.
      </p>
    );
  }

  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses?.[0]?.emailAddress ??
    "";
  const name = resolvePreferredName(user);
  const showPhoto = Boolean(user.hasImage && user.imageUrl);
  const letter = avatarLetter(name || user.username);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5 md:pt-4">
          <h1
            className="text-lg font-semibold tracking-tight text-primary"
            style={pageTitleStyle}
          >
            Account
          </h1>
          <p className="text-(--sidebar-ink-soft)" style={copyStyle}>
            Manage your profile, login information, and devices
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="border-b border-(--sidebar-border) pb-3">
            <h2 className="font-medium text-primary" style={copyStyle}>
              Profile
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-(--canvas-title-ink) text-lg font-semibold text-white"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {showPhoto ? (
                <img
                  src={user.imageUrl}
                  alt=""
                  width={56}
                  height={56}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                letter
              )}
            </div>
            <div className="min-w-0">
              <PreferredNameField
                value={name}
                onSave={async (next) => {
                  // Name attrs aren't enabled on this Clerk instance for client
                  // updates — store preferred name in writable unsafeMetadata.
                  await user.update({
                    unsafeMetadata: preferredNameMetadata(
                      user.unsafeMetadata,
                      next,
                    ),
                  });
                  cacheStampDisplayName(next);
                }}
              />
              <p className="mt-1.5 truncate text-xs text-(--sidebar-ink-soft)">
                {email || "No email on file"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <LastLoginsSection user={user} />
      <SupportSection />
      <LegalFooter />
    </div>
  );
}

function LegalFooter() {
  return (
    <p
      className="text-(--sidebar-ink-soft)"
      style={{ fontSize: "var(--text-xs)" }}
    >
      Read our{" "}
      <a
        href="/privacy"
        target="_blank"
        rel="noreferrer"
        className="text-(--canvas-title-ink) underline-offset-2 hover:underline"
      >
        Privacy policy
      </a>{" "}
      and{" "}
      <a
        href="/terms"
        target="_blank"
        rel="noreferrer"
        className="text-(--canvas-title-ink) underline-offset-2 hover:underline"
      >
        Terms of use
      </a>
      .
    </p>
  );
}

function SupportSection() {
  const { user } = useUser();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = Boolean(user?.deleteSelfEnabled);

  const deleteAccount = async () => {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      clearLocalUnfoldData();
      await user.delete();
      router.replace("/");
    } catch {
      setBusy(false);
      setError("Couldn’t delete the account. Try again in a moment.");
    }
  };

  return (
    <section className="flex flex-col gap-5">
      <div className="border-b border-(--popover-border) pb-3">
        <h2 className="font-medium text-primary" style={copyStyle}>
          Support
        </h2>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-secondary text-xs" style={copyStyle}>
            Request data export
          </h3>
          <p className="mt-1 text-(--sidebar-ink-soft) text-xs">
            Automated export isn’t in the product yet. Email us and we’ll send a
            copy of the personal data we control.
          </p>
        </div>
        <a href={EXPORT_MAILTO} className={`shrink-0 ${btnSecondary("xs")}`}>
          Request data
        </a>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-secondary text-xs" style={copyStyle}>
            Delete my account
          </h3>
          <p className="mt-1 text-(--sidebar-ink-soft) text-xs">
            Permanently delete your account. You’ll no longer be able to access
            your journal or synced data.
          </p>
          {!canDelete ? (
            <p className="mt-2 text-(--sidebar-ink-soft)" style={copyStyle}>
              Account deletion isn’t enabled for this account yet. Contact{" "}
              <a
                href="mailto:hello@unfold.app"
                className="text-(--canvas-title-ink) underline-offset-2 hover:underline"
              >
                hello@unfold.app
              </a>
              .
            </p>
          ) : null}
          {error ? (
            <p
              className="mt-2 text-(--button-destructive-soft-foreground)"
              style={copyStyle}
            >
              {error}
            </p>
          ) : null}
        </div>

        {canDelete && !confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={`shrink-0 ${btnDestructive("xs")}`}
          >
            Delete my account
          </button>
        ) : null}
      </div>

      {canDelete && confirming ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-(--button-destructive-border) bg-(--button-destructive-soft)/60 p-3">
          <p
            className="text-(--button-destructive-soft-foreground)"
            style={copyStyle}
          >
            Are you sure? This can’t be undone.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void deleteAccount()}
              className={btnDestructiveSolid("sm")}
            >
              {busy ? "Deleting…" : "Yes, delete forever"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
              className="inline-flex items-center rounded-md border border-black/10 bg-white px-3 py-2 font-medium text-primary transition-colors hover:bg-(--sidebar-hover-bg) disabled:opacity-50"
              style={copyStyle}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

type AccountProfileModalProps = {
  open: boolean;
  onClose: () => void;
};

export function AccountProfileModal({ open, onClose }: AccountProfileModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-10000 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close account"
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--text-primary)_28%,transparent)]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Account"
        className="relative z-10 flex w-full max-w-2xl overflow-hidden rounded-xl border border-(--sidebar-border) bg-(--surface-canvas) shadow-[0_1.25rem_3rem_-1rem_rgba(15,15,15,0.28)]"
        style={{ height: PANEL_HEIGHT, fontFamily: "var(--font-body)" }}
      >
        <div className="relative flex min-w-0 flex-1 flex-col pt-5 pb-5">
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-md text-(--sidebar-ink-soft) transition-colors hover:bg-(--sidebar-hover-bg) hover:text-(--sidebar-ink) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
          >
            <X size={16} strokeWidth={1.85} aria-hidden />
          </button>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pr-12">
            <AccountPanelView />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
