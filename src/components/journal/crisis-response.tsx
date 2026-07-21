"use client";

/**
 * Calm post-seal hand-off when an entry is crisis-flagged.
 * Static resources only — no chatbot, dialogue, or "are you okay?" flow.
 * Copy is placeholder until final crisis messaging is provided.
 */

type Helpline = {
  name: string;
  detail: string;
  tel: string;
  display: string;
};

/** Placeholder helplines — replace with final list before launch. */
const HELPLINES: Helpline[] = [
  {
    name: "988 Suicide & Crisis Lifeline",
    detail: "United States — call or text",
    tel: "988",
    display: "988",
  },
  {
    name: "Crisis Text Line",
    detail: "United States — text HOME",
    tel: "741741",
    display: "Text HOME to 741741",
  },
  {
    name: "International Association for Suicide Prevention",
    detail: "Find a local resource",
    tel: "",
    display: "https://www.iasp.info/suicidalthoughts/",
  },
];

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
      <div className="mx-auto flex w-full max-w-md flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h1
            className="text-xl font-medium tracking-tight"
            style={{ lineHeight: 1.35 }}
          >
            {/* TODO: replace with final crisis copy */}
            If you&apos;re going through a hard time, you don&apos;t have to
            hold it alone.
          </h1>
          <p
            className="text-sm opacity-80"
            style={{ lineHeight: 1.55 }}
          >
            {/* TODO: replace with final crisis copy */}
            Your entry is saved. When you&apos;re ready, these resources can
            connect you with people who are trained to help.
          </p>
        </div>

        <ul className="flex flex-col gap-4" role="list">
          {HELPLINES.map((line) => (
            <li key={line.name} className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{line.name}</span>
              <span className="text-xs opacity-60">{line.detail}</span>
              {line.tel ? (
                <a
                  href={`tel:${line.tel}`}
                  className="mt-1 text-sm underline underline-offset-2 opacity-90 hover:opacity-100"
                >
                  {line.display}
                </a>
              ) : (
                <a
                  href={line.display}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 text-sm underline underline-offset-2 opacity-90 hover:opacity-100"
                >
                  Find local help
                </a>
              )}
            </li>
          ))}
        </ul>

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
