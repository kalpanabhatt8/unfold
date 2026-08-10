"use client";

/**
 * TEMPORARY — Pattern pipeline debug page.
 * Open at /dashboard/pattern-debug — delete after the experiment.
 * Locked: local flag + Clerk userId allowlist; hard-denied in production.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import { fetchEntryAnalysisDetailed } from "@/lib/ai/pattern-extraction/client";
import { readAllEntries } from "@/lib/journal-entries";
import { extractionProvenance } from "@/lib/patterns/analysis-freshness";
import { putAnalysis } from "@/lib/patterns/analysis-store";
import { readEntryText } from "@/lib/patterns/entry-text";
import { canUsePatternPipelineDebug } from "@/lib/patterns/pattern-pipeline-debug-access";
import {
  buildEntryPipelineDebugReport,
  buildFullPipelineDebugExport,
  debugStoreCounts,
  type EntryPipelineDebugReport,
  type FullPipelineDebugExport,
} from "@/lib/patterns/pattern-pipeline-debug-report";
import {
  clearPipelineDebug,
  PATTERN_PIPELINE_DEBUG_EVENT,
  putPipelineDebug,
} from "@/lib/patterns/pattern-pipeline-debug-store";
import { ANALYSES_UPDATED_EVENT } from "@/lib/patterns/analysis-store";
import { ENTRIES_UPDATED_EVENT } from "@/lib/journal-entries";

type TabId = "single" | "all";

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details open style={{ marginBottom: 12, border: "1px solid #ccc", padding: 8 }}>
      <summary style={{ fontWeight: 700, cursor: "pointer" }}>{title}</summary>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: 12,
          marginTop: 8,
          background: "#111",
          color: "#d6ffd6",
          padding: 8,
          maxHeight: 420,
          overflow: "auto",
        }}
      >
        {children}
      </pre>
    </details>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 14px",
        border: "1px solid #666",
        borderBottom: active ? "2px solid #fff" : "1px solid #666",
        background: active ? "#335" : "#1a1a1a",
        color: "#fff",
        cursor: "pointer",
        fontWeight: active ? 700 : 400,
      }}
    >
      {children}
    </button>
  );
}

const EMPTY_COUNTS = {
  entries: 0,
  analyses: 0,
  debugCaptures: 0,
  surfaced: 0,
} as const;

export default function PatternDebugClient() {
  const { user, isLoaded } = useUser();
  const allowed = canUsePatternPipelineDebug(user?.id);

  const [tab, setTab] = useState<TabId>("single");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  // localStorage reads must wait until after mount or SSR/client counts diverge.
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    setReady(true);
    // Console helpers only on this allowlisted page (never product routes).
    if (process.env.NODE_ENV === "development") {
      void import("@/lib/patterns/passage-debug");
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const on = () => refresh();
    window.addEventListener(PATTERN_PIPELINE_DEBUG_EVENT, on);
    window.addEventListener(ANALYSES_UPDATED_EVENT, on);
    window.addEventListener(ENTRIES_UPDATED_EVENT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(PATTERN_PIPELINE_DEBUG_EVENT, on);
      window.removeEventListener(ANALYSES_UPDATED_EVENT, on);
      window.removeEventListener(ENTRIES_UPDATED_EVENT, on);
      window.removeEventListener("storage", on);
    };
  }, [allowed, refresh]);

  const entries = useMemo(() => {
    if (!allowed || !ready) return [];
    void tick;
    return readAllEntries().sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  }, [allowed, ready, tick]);

  const counts = useMemo(() => {
    if (!allowed || !ready) return EMPTY_COUNTS;
    void tick;
    return debugStoreCounts();
  }, [allowed, ready, tick]);

  const activeId = selectedId ?? entries[0]?.id ?? null;

  const report: EntryPipelineDebugReport | null = useMemo(() => {
    if (!allowed || !ready) return null;
    void tick;
    if (!activeId) return null;
    const entry = entries.find((e) => e.id === activeId);
    if (!entry) return null;
    return buildEntryPipelineDebugReport(entry);
  }, [allowed, ready, activeId, entries, tick]);

  const allExport: FullPipelineDebugExport | null = useMemo(() => {
    if (!allowed || !ready) return null;
    void tick;
    if (entries.length === 0) return null;
    return buildFullPipelineDebugExport();
  }, [allowed, ready, entries.length, tick]);

  const allJsonText = useMemo(
    () => (allExport ? JSON.stringify(allExport, null, 2) : ""),
    [allExport],
  );

  if (!isLoaded) {
    return (
      <div style={{ padding: 16, fontFamily: "ui-monospace, monospace" }}>
        <p style={{ fontSize: 12 }}>Checking access…</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div style={{ padding: 16, fontFamily: "ui-monospace, monospace" }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>PATTERN DEBUG</h1>
        <p style={{ fontSize: 12, maxWidth: 720 }}>
          Pattern pipeline debug is only available in local development for
          allowlisted accounts with{" "}
          <code>NEXT_PUBLIC_PATTERN_PIPELINE_DEBUG=1</code>. It is never enabled
          in production.
        </p>
      </div>
    );
  }

  const rerunDebug = async (alsoPersist: boolean) => {
    if (!activeId) return;
    const text = readEntryText(activeId);
    if (!text.trim()) {
      setStatus("No text for this entry.");
      return;
    }
    setBusy(true);
    setStatus(alsoPersist ? "Re-running + persisting…" : "Re-running (debug only)…");
    try {
      const detailed = await fetchEntryAnalysisDetailed(text, { debug: true });
      if (detailed.debug) {
        putPipelineDebug({
          entryId: activeId,
          capturedAt: Date.now(),
          source: "manual_rerun",
          extraction: detailed.debug,
          requestFinalAnalysis: detailed.analysis
            ? {
                topics: detailed.analysis.topics,
                patterns: detailed.analysis.patterns,
              }
            : null,
          failureReason: detailed.failureReason,
        });
      }
      if (alsoPersist && detailed.analysis) {
        putAnalysis({
          entryId: activeId,
          ...extractionProvenance(text),
          ...detailed.analysis,
        });
      }
      setStatus(
        detailed.debug
          ? `Captured. patterns=${detailed.analysis?.patterns.length ?? 0}`
          : "No debug payload returned.",
      );
      refresh();
    } catch (e) {
      setStatus(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const rerunAllDebugOnly = async () => {
    if (entries.length === 0) return;
    setBusy(true);
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i]!;
      setStatus(`Re-running all (debug only)… ${i + 1}/${entries.length}`);
      const text = readEntryText(entry.id);
      if (!text.trim()) {
        fail += 1;
        continue;
      }
      try {
        const detailed = await fetchEntryAnalysisDetailed(text, { debug: true });
        if (detailed.debug) {
          putPipelineDebug({
            entryId: entry.id,
            capturedAt: Date.now(),
            source: "manual_rerun",
            extraction: detailed.debug,
            requestFinalAnalysis: detailed.analysis
              ? {
                  topics: detailed.analysis.topics,
                  patterns: detailed.analysis.patterns,
                }
              : null,
            failureReason: detailed.failureReason,
          });
          ok += 1;
        } else {
          fail += 1;
        }
      } catch {
        fail += 1;
      }
    }
    setStatus(`All done. captured=${ok} failed=${fail}`);
    setBusy(false);
    refresh();
  };

  return (
    <div style={{ padding: 16, overflow: "auto", height: "100%", fontFamily: "ui-monospace, monospace" }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>PATTERN DEBUG (temporary)</h1>
      <p style={{ fontSize: 12, marginBottom: 12, maxWidth: 720 }}>
        Inspect entry → raw LLM → parse → validation → arbitration → final analysis →
        aggregation → slots. Raw LLM only exists after a debug capture (dev seal or
        manual re-run below).
      </p>

      <div style={{ display: "flex", gap: 0, marginBottom: 12 }}>
        <TabButton active={tab === "single"} onClick={() => setTab("single")}>
          Single entry
        </TabButton>
        <TabButton active={tab === "all"} onClick={() => setTab("all")}>
          All entries (copy / download)
        </TabButton>
      </div>

      <p style={{ fontSize: 12, marginBottom: 12 }}>
        {ready
          ? `entries=${counts.entries} analyses=${counts.analyses} debugCaptures=${counts.debugCaptures} surfaced=${counts.surfaced}${status ? ` · ${status}` : ""}`
          : "Loading local stores…"}
      </p>

      {tab === "single" ? (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <button
              type="button"
              disabled={busy || !activeId}
              onClick={() =>
                report && downloadJson(`pattern-debug-${activeId}.json`, report)
              }
            >
              Export selected entry
            </button>
            <button
              type="button"
              disabled={busy || !activeId}
              onClick={() => void rerunDebug(false)}
            >
              Re-run extraction (debug only)
            </button>
            <button
              type="button"
              disabled={busy || !activeId}
              onClick={() => void rerunDebug(true)}
            >
              Re-run + overwrite analysis
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                clearPipelineDebug();
                setStatus("Cleared debug captures.");
                refresh();
              }}
            >
              Clear debug captures
            </button>
          </div>

          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ minWidth: 220, maxWidth: 280 }}>
              <strong>Entries</strong>
              <ol style={{ paddingLeft: 18, fontSize: 12 }}>
                {entries.map((e, i) => (
                  <li key={e.id} style={{ marginBottom: 6 }}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(e.id)}
                      style={{
                        textAlign: "left",
                        background: e.id === activeId ? "#335" : "transparent",
                        color: e.id === activeId ? "#fff" : "inherit",
                        border: "1px solid #666",
                        padding: "4px 6px",
                        width: "100%",
                        cursor: "pointer",
                      }}
                    >
                      {i + 1}. {e.title || e.id}
                      {getHasDebug(e.id) ? " [raw]" : ""}
                    </button>
                  </li>
                ))}
              </ol>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {!ready ? (
                <p>Loading…</p>
              ) : !report ? (
                <p>No entries in localStorage for this browser account.</p>
              ) : (
                <>
                  <h2 style={{ fontSize: 16 }}>
                    {report.entry.title}{" "}
                    <span style={{ fontWeight: 400, fontSize: 12 }}>
                      ({report.entry.id})
                    </span>
                  </h2>
                  <Section title="1. Entry text">
                    {JSON.stringify(report.entry, null, 2)}
                  </Section>
                  <Section title="2. Raw LLM">
                    {JSON.stringify(report.rawLLM, null, 2)}
                  </Section>
                  <Section title="3. Parsed extraction">
                    {JSON.stringify(report.parsedExtraction, null, 2)}
                  </Section>
                  <Section title="4. Validation">
                    {JSON.stringify(report.validation, null, 2)}
                  </Section>
                  <Section title="5. Arbitration">
                    {JSON.stringify(report.arbitration, null, 2)}
                  </Section>
                  <Section title="6. Final stored analysis">
                    {JSON.stringify(report.finalAnalysis, null, 2)}
                  </Section>
                  <Section title="7. Aggregation">
                    {JSON.stringify(report.aggregation, null, 2)}
                  </Section>
                  <Section title="8. Moments / Loop / Question">
                    {JSON.stringify(report.generatedSlots, null, 2)}
                  </Section>
                </>
              )}
            </div>
          </div>
        </>
      ) : (
        <div>
          <p style={{ fontSize: 12, marginBottom: 12, maxWidth: 720 }}>
            Everything for every entry in one JSON blob: aggregation overview + each
            entry&apos;s full pipeline sections. Copy or download once — no need to
            open entries one by one.
          </p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <button
              type="button"
              disabled={busy || !allExport}
              onClick={() => {
                if (!allExport) return;
                downloadJson(
                  `pattern-pipeline-debug-ALL-${Date.now()}.json`,
                  allExport,
                );
                setStatus("Downloaded all-entries JSON.");
              }}
            >
              Download all entries JSON
            </button>
            <button
              type="button"
              disabled={busy || !allJsonText}
              onClick={() => {
                void copyText(allJsonText).then((ok) =>
                  setStatus(ok ? "Copied all entries JSON to clipboard." : "Copy failed."),
                );
              }}
            >
              Copy all to clipboard
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void rerunAllDebugOnly()}
            >
              Re-run ALL entries (debug only)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                clearPipelineDebug();
                setStatus("Cleared debug captures.");
                refresh();
              }}
            >
              Clear debug captures
            </button>
          </div>

          {!ready ? (
            <p>Loading…</p>
          ) : !allExport ? (
            <p>No entries in localStorage for this browser account.</p>
          ) : (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: 11,
                background: "#111",
                color: "#d6ffd6",
                padding: 12,
                border: "1px solid #444",
                maxHeight: "70vh",
                overflow: "auto",
              }}
            >
              {allJsonText}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function getHasDebug(entryId: string): boolean {
  try {
    const raw = window.localStorage.getItem("unfold-pattern-pipeline-debug-TEMP");
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Boolean(parsed[entryId]);
  } catch {
    return false;
  }
}
