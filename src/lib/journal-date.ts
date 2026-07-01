/** Entry date for journal heading — e.g. "28 June 2026, 22:58". */
export function formatJournalEntryDate(ts: number): { date: string; time: string } {
  const d = new Date(ts);
  const day = d.getDate();
  const month = d.toLocaleDateString(undefined, { month: "long" });
  const year = d.getFullYear();
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return {
    date: `${day} ${month} ${year}`,
    time,
  };
}

/** Sealed stamp — e.g. "🌻 Sealed · 26 Jun 2026". */
export function formatJournalSealedStamp(ts: number): string {
  const d = new Date(ts);
  const day = d.getDate();
  const month = d.toLocaleDateString(undefined, { month: "short" });
  const year = d.getFullYear();
  return `🌻 Sealed · ${day} ${month} ${year}`;
}
