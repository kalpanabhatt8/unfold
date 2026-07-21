"use client";

/**
 * Calm post-seal hand-off when an entry is crisis-flagged.
 * Generic copy only — no named services, numbers, or region-specific links.
 * No chatbot, dialogue, or "are you okay?" flow.
 */

type CrisisResponseProps = {
  onBackToEntry: () => void;
};

export function CrisisResponse({ onBackToEntry }: CrisisResponseProps) {
  return (
    <div
      className="flex h-full min-h-0 w-full items-center justify-center overflow-y-auto px-6 py-12"
      style={{
        background: "var(--bg, #f7f4ef)",
        color: "var(--fg, #2a2622)",
        fontFamily: "var(--font-body)",
      }}
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h1
            className="text-xl font-medium tracking-tight"
            style={{ lineHeight: 1.35 }}
          >
            If things feel too heavy right now, you don&apos;t have to carry
            this alone.
          </h1>
          <p className="text-sm opacity-80" style={{ lineHeight: 1.55 }}>
            Your writing is saved. Please reach out to someone — a person you
            trust, or a local crisis helpline or mental health service near
            you.
          </p>
        </div>

        <button
          type="button"
          onClick={onBackToEntry}
          className="self-start text-xs opacity-50 transition-opacity hover:opacity-80"
          style={{ fontFamily: "var(--font-body)" }}
        >
          Back to your entry
        </button>
      </div>
    </div>
  );
}
