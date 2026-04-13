"use client";

import Link from "next/link";
import { useTheme } from "@/components/theme/theme-provider";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <main className="min-h-screen w-full pb-24">
      <section className="mx-auto w-full max-w-3xl px-6 pt-16 md:px-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[0.7rem] uppercase tracking-[0.3em] text-ink-soft">
              Settings
            </span>
            <h1 className="text-3xl font-semibold text-ink-strong">Appearance</h1>
            <p className="text-sm text-ink-muted">
              Choose a calm theme for distraction-free journaling.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-full border border-border-subtle px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft transition hover:border-border-emphasis hover:text-ink"
          >
            Back
          </Link>
        </div>

        <section className="mt-8 rounded-2xl border border-border-subtle bg-surface-base p-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
            Theme Mode
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`rounded-xl border px-4 py-4 text-left transition ${
                theme === "light"
                  ? "border-border-emphasis bg-surface-raised text-ink"
                  : "border-border-subtle bg-surface-base text-ink-soft hover:border-border-emphasis"
              }`}
              aria-pressed={theme === "light"}
            >
              <p className="text-sm font-semibold uppercase tracking-[0.12em]">Light</p>
              <p className="mt-1 text-xs text-ink-muted">Bright neutral canvas</p>
            </button>

            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`rounded-xl border px-4 py-4 text-left transition ${
                theme === "dark"
                  ? "border-border-emphasis bg-surface-raised text-ink"
                  : "border-border-subtle bg-surface-base text-ink-soft hover:border-border-emphasis"
              }`}
              aria-pressed={theme === "dark"}
            >
              <p className="text-sm font-semibold uppercase tracking-[0.12em]">Dark</p>
              <p className="mt-1 text-xs text-ink-muted">Low-glare neutral canvas</p>
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
