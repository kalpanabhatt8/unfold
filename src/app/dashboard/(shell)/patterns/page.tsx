export default function PatternsPage() {
  return (
    <main className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="text-4xl" aria-hidden>
          🧠
        </span>
        <p
          className="text-lg font-medium text-(--canvas-title-ink)"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Patterns page coming soon
        </p>
        <p className="max-w-sm text-sm text-(--text-secondary)">
          We&rsquo;re building a space to reflect on the patterns across your
          journal entries.
        </p>
      </div>
    </main>
  );
}
