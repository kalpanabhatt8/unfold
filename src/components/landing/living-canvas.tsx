"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ChevronsLeft, Plus, Search, Signature, Waypoints, X } from "lucide-react";
import { LandingEndCta } from "./landing-chrome";
import { MechanismChain } from "@/components/patterns/mechanism-chain";
import { Tooltip } from "@/components/ui/tooltip";
import {
  CTA,
  LIVE_SCREEN2_CARDS,
  PATTERN,
  TAGLINE,
  WRITE_NATURALLY,
} from "./story";
import {
  btnIconInvisible,
  iconFixed,
  iconPx,
  iconStroke,
} from "@/components/ui/button-system";
import "./landing-concepts.css";

function clamp(n: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function stage(p: number, start: number, end: number) {
  return clamp((p - start) / (end - start));
}

/** Same stamp format as canvas header — e.g. "14 July 2026, 08:12". */
function formatVisitStamp(ts: number): { date: string; time: string } {
  const d = new Date(ts);
  const day = d.getDate();
  const month = d.toLocaleDateString(undefined, { month: "long" });
  const year = d.getFullYear();
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { date: `${day} ${month} ${year}`, time };
}

/** Sealed header — e.g. "🪷 Sealed · 14 Jul 2026". */
function formatSealedStamp(ts: number): string {
  const d = new Date(ts);
  const day = d.getDate();
  const month = d.toLocaleDateString(undefined, { month: "short" });
  const year = d.getFullYear();
  return `🪷 Sealed · ${day} ${month} ${year}`;
}

const SIGNATURE_NAME = "Jamie";
const WORKSPACE_LABEL = `${SIGNATURE_NAME}'s Unfold`;

type PrototypeEntry = {
  id: string;
  title: string;
  preview: string;
  time: string;
  sealed: boolean;
  sealedLabel?: string;
  body: string[];
};

const ENTRIES: PrototypeEntry[] = [
  {
    id: "after-lunch",
    title: "After Lunch",
    preview: "I'll start after lunch.",
    time: "3h",
    sealed: true,
    sealedLabel: "🪷 Sealed · 4 Mar 2026",
    body: [
      "I'll start after lunch.",
      "The draft stayed closed. The afternoon felt lighter without it.",
    ],
  },
  {
    id: "one-more",
    title: "One More Tutorial",
    preview: "Just one more tutorial.",
    time: "1d",
    sealed: true,
    sealedLabel: "🪷 Sealed · 11 Mar 2026",
    body: [
      "Just one more tutorial.",
      "I told myself I needed one more example before I could begin.",
    ],
  },
  {
    id: "tomorrow-instead",
    title: "Tomorrow Instead",
    preview: "Tomorrow feels easier.",
    time: "2d",
    sealed: true,
    sealedLabel: "🪷 Sealed · 18 Mar 2026",
    body: [
      "Tomorrow feels easier.",
      "I closed the file gently, as if that counted as progress.",
    ],
  },
  {
    id: "cleaned",
    title: "Cleaned Everything",
    preview: "I cleaned everything before beginning.",
    time: "4d",
    sealed: true,
    sealedLabel: "🪷 Sealed · 22 Mar 2026",
    body: [
      "I cleaned everything before beginning.",
      "By the time the desk was clear, the evening had already gone.",
    ],
  },
  {
    id: "maybe-tomorrow",
    title: "Maybe Tomorrow",
    preview: "I finally opened my portfolio today.",
    time: "8d",
    sealed: true,
    sealedLabel: "🪷 Sealed · 29 Mar 2026",
    body: [
      "I finally opened my portfolio today.",
      "I stared at the hero section for a while and immediately started changing the spacing. Then the font. Then I looked for inspiration again because nothing felt good enough.",
      "I closed Figma after about forty minutes.",
    ],
  },
];

const CHIP_HOME: { x: number; y: number; rot: number }[] = [
  { x: 18, y: 18, rot: -2.2 },
  { x: 78, y: 16, rot: 1.8 },
  { x: 22, y: 42, rot: 1.1 },
  { x: 76, y: 44, rot: -1.5 },
  { x: 20, y: 68, rot: 0.8 },
  { x: 72, y: 72, rot: -0.9 },
];

const CHIP_SETTLE: { x: number; y: number; rot: number }[] = [
  { x: 26, y: 22, rot: -1.2 },
  { x: 70, y: 20, rot: 1.0 },
  { x: 28, y: 44, rot: 0.8 },
  { x: 72, y: 46, rot: -0.9 },
  { x: 30, y: 68, rot: 0.4 },
  { x: 68, y: 70, rot: -0.5 },
];

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

type ViewOverride = "auto" | "journal" | "pattern" | "write";

export function LivingCanvas() {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [activeEntryId, setActiveEntryId] = useState("maybe-tomorrow");
  const [viewOverride, setViewOverride] = useState<ViewOverride>("auto");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [visitedAt] = useState(() => Date.now());
  const [writeSealed, setWriteSealed] = useState(false);
  const [writeSealedAt, setWriteSealedAt] = useState<number | null>(null);
  const overrideAtProgress = useRef(0);
  const visitStamp = formatVisitStamp(visitedAt);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const el = rootRef.current;
      if (!el) return;
      const total = el.offsetHeight - window.innerHeight;
      const maxScroll = Math.max(total, 0);
      // Don't allow scrolling past the story end — that used to unstick the
      // canvas and leave white body visible below a frame parked too high.
      if (window.scrollY > maxScroll) {
        window.scrollTo(0, maxScroll);
      }
      const y = Math.min(Math.max(window.scrollY, 0), maxScroll);
      const next = reduced ? 1 : clamp(y / Math.max(maxScroll, 1));
      setProgress(next);
      if (
        viewOverride !== "auto" &&
        Math.abs(next - overrideAtProgress.current) > 0.04
      ) {
        setViewOverride("auto");
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: false });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduced, viewOverride]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const rise = stage(progress, 0, 0.18);
  const story = progress < 0.18 ? 0 : stage(progress, 0.18, 1);

  const writeOut = stage(story, 0.14, 0.22);
  const chipsIn = stage(story, 0.22, 0.36);
  const chipsGather = stage(story, 0.38, 0.52);
  const chipsOut = stage(story, 0.52, 0.6);
  const patternIn = stage(story, 0.58, 0.74);
  const reflectIn = stage(story, 0.76, 0.88);
  const ctaIn = stage(story, 0.88, 0.98);

  let writeOpacity = story < 0.22 ? lerp(1, 0, writeOut) : 0;
  let journalOpacity = 0;
  let chipsOpacity = story >= 0.22 && story < 0.62 ? 1 : 0;
  let patternOpacity = story >= 0.56 ? patternIn : 0;
  let showReflect = reflectIn;
  let showCta = ctaIn;
  let patternsActive = patternOpacity > 0.12;
  let showingWrite = writeOpacity > 0.05;

  if (viewOverride === "journal") {
    writeOpacity = 0;
    journalOpacity = 1;
    chipsOpacity = 0;
    patternOpacity = 0;
    patternsActive = false;
    showingWrite = false;
  } else if (viewOverride === "pattern") {
    writeOpacity = 0;
    journalOpacity = 0;
    chipsOpacity = 0;
    patternOpacity = 1;
    showReflect = 1;
    showCta = 1;
    patternsActive = true;
    showingWrite = false;
  } else if (viewOverride === "write") {
    writeOpacity = 1;
    journalOpacity = 0;
    chipsOpacity = 0;
    patternOpacity = 0;
    patternsActive = false;
    showingWrite = true;
    showReflect = 0;
    showCta = 0;
  }

  const frameY = lerp(28, 0, rise);
  const frameScale = lerp(0.94, 1, rise);
  const frameRadius = lerp(20, 16, rise);
  const navOpacity = lerp(1, 0, stage(rise, 0.55, 1));
  const taglineOpacity = lerp(1, 0, stage(rise, 0.05, 0.55));
  const interactive = rise > 0.85;

  const activeEntry =
    ENTRIES.find((e) => e.id === activeEntryId) ?? ENTRIES[ENTRIES.length - 1];
  const filteredEntries = ENTRIES.filter((entry) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      entry.title.toLowerCase().includes(q) ||
      entry.preview.toLowerCase().includes(q)
    );
  });

  const openNewEntry = () => {
    if (!interactive) return;
    setWriteSealed(false);
    setWriteSealedAt(null);
    setViewOverride("write");
    overrideAtProgress.current = progress;
    setSearchOpen(false);
  };

  const openJournal = (entryId: string) => {
    if (!interactive) return;
    setActiveEntryId(entryId);
    setViewOverride("journal");
    overrideAtProgress.current = progress;
    setSearchOpen(false);
  };

  const openPatterns = () => {
    if (!interactive) return;
    setViewOverride("pattern");
    overrideAtProgress.current = progress;
    setSearchOpen(false);
  };

  return (
    <div
      className="lp-root lp-live"
      ref={rootRef}
      style={
        {
          "--frame-scale": frameScale,
          "--frame-y": `${frameY}vh`,
        } as CSSProperties
      }
    >
      <header
        className="lp-live__nav"
        style={{ opacity: navOpacity }}
        data-hidden={navOpacity < 0.05}
        aria-hidden={navOpacity < 0.05}
      >
        <Link href="/" className="lp-live__brand">
          <span className="mr-[0.03em]">U</span>NFOLD
        </Link>
        <div className="lp-live__nav-actions">
          <Link href={CTA.header.signInHref} className="lp-chrome__nav-link">
            {CTA.header.signIn}
          </Link>
          <Link href={CTA.header.primaryHref} className="lp-chrome__cta lp-chrome__cta--lg">
            {CTA.header.primary}
          </Link>
        </div>
      </header>

      <div className="lp-live__scroll">
        <div className="lp-live__stage">
          <div className="lp-live__glow" aria-hidden />

          {/*
            Pink blur lives in its OWN oversized box (sibling of the card).
            filter:blur is always clipped to its transformed ancestor’s border
            box — when that box was the card, moving the card down exposed a
            hard cut under the header. This bloom box is larger so the cut
            (if any) sits outside the soft falloff.
          */}
          <div
            className="lp-live__bloom"
            style={
              {
                "--frame-y": `${frameY}vh`,
                "--frame-scale": frameScale,
              } as CSSProperties
            }
            aria-hidden
          >
            <div className="lp-live__canvas-aura">
              {/* Pre-blurred Figma asset — Safari paints large CSS filter:blur much weaker than Chrome */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="lp-live__canvas-aura-shape"
                src="/Images/canvasShadowHomepage.svg"
                alt=""
                width={1440}
                height={780}
                decoding="async"
              />
            </div>
            <div className="lp-live__canvas-aura-fade" />
          </div>

          <div
            className="lp-live__frame-stack"
            style={
              {
                "--frame-y": `${frameY}vh`,
                "--frame-scale": frameScale,
                "--frame-radius": `${frameRadius / 16}rem`,
              } as CSSProperties
            }
          >
            <p
              className="lp-live__tagline"
              style={{ opacity: taglineOpacity }}
              data-hidden={taglineOpacity < 0.05}
              aria-hidden={taglineOpacity < 0.05}
            >
              {TAGLINE.split("\n").map((line, i, lines) => (
                <span key={i}>
                  {line}
                  {i < lines.length - 1 ? <br /> : null}
                </span>
              ))}
            </p>
            <div className="lp-live__frame">
              <div className="lp-live__desktop" data-interactive={interactive}>
              <aside className="lp-live__sidebar">
                {/* Soft bottom wash behind Patterns — matches real dashboard sidebar. */}
                <div className="lp-live__sidebar-wash" aria-hidden />

                <div className="lp-live__sidebar-top">
                  <p className="lp-live__sidebar-owner">{WORKSPACE_LABEL}</p>
                  <button
                    type="button"
                    className="lp-live__sidebar-icon-btn"
                    aria-label="Collapse sidebar"
                    tabIndex={interactive ? 0 : -1}
                  >
                    <ChevronsLeft size={16} strokeWidth={1.85} aria-hidden />
                  </button>
                </div>

                <section className="lp-live__entries" aria-label="Entries">
                  <div className="lp-live__sidebar-tools">
                    {searchOpen ? (
                      <div className="lp-live__search">
                        <Search size={14} strokeWidth={1.75} aria-hidden />
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setSearchOpen(false);
                              setQuery("");
                            }
                          }}
                          placeholder="Search"
                          aria-label="Search entries"
                          disabled={!interactive}
                        />
                        <button
                          type="button"
                          aria-label="Close search"
                          className="lp-live__sidebar-icon-btn"
                          onClick={() => {
                            setSearchOpen(false);
                            setQuery("");
                          }}
                        >
                          <X size={14} strokeWidth={1.9} aria-hidden />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="lp-live__sidebar-label">
                          Recent entries
                        </span>
                        <div className="lp-live__sidebar-icons">
                          <button
                            type="button"
                            className="lp-live__sidebar-icon-btn"
                            aria-label="Search entries"
                            tabIndex={interactive ? 0 : -1}
                            onClick={() => interactive && setSearchOpen(true)}
                          >
                            <Search size={14} strokeWidth={1.75} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="lp-live__sidebar-icon-btn"
                            aria-label="New entry"
                            tabIndex={interactive ? 0 : -1}
                            onClick={() => openNewEntry()}
                          >
                            <Plus size={14} strokeWidth={1.75} aria-hidden />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="lp-live__entry-scroll">
                    <nav className="lp-live__entry-list" aria-label="Entry list">
                      <ul>
                        {filteredEntries.map((entry) => {
                          const isActive =
                            !showingWrite &&
                            entry.id === activeEntryId &&
                            !patternsActive;
                          return (
                            <li key={entry.id}>
                              <button
                                type="button"
                                className="lp-live__entry"
                                data-active={isActive}
                                data-sealed={entry.sealed}
                                onClick={() => openJournal(entry.id)}
                                disabled={!interactive}
                              >
                                <div className="lp-live__entry-text">
                                  <p className="lp-live__entry-title">
                                    {entry.title}
                                  </p>
                                  <p className="lp-live__entry-preview">
                                    {entry.preview}
                                  </p>
                                </div>
                                <span className="lp-live__entry-time">
                                  {entry.time}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </nav>
                    {/* Soft fade — not a hard divider (real sidebar pattern). */}
                    <div className="lp-live__sidebar-fade" aria-hidden />
                  </div>
                </section>

                <button
                  type="button"
                  className="lp-live__patterns-link"
                  data-active={patternsActive}
                  onClick={openPatterns}
                  disabled={!interactive}
                  aria-label="Patterns, 2 reflections"
                >
                  <Waypoints
                    className="lp-live__patterns-icon"
                    size={16}
                    strokeWidth={1.85}
                    aria-hidden
                  />
                  <span className="lp-live__patterns-text">Patterns</span>
                  <span className="lp-live__patterns-badge">2</span>
                </button>
              </aside>

              <main className="lp-live__canvas">
                <section
                  className="lp-live__layer lp-live__layer--journal lp-live__layer--write"
                  style={{ opacity: writeOpacity }}
                  aria-hidden={writeOpacity < 0.05}
                  data-writing-zone=""
                  data-sealed={writeSealed ? "" : undefined}
                >
                  <div className="lp-live__column">
                    <header className="lp-live__journal-head">
                      <p
                        className={
                          writeSealed
                            ? "lp-live__journal-title header-lg"
                            : "lp-live__journal-title header-lg lp-live__title-placeholder"
                        }
                      >
                        {writeSealed
                          ? WRITE_NATURALLY.sealedTitle
                          : WRITE_NATURALLY.titlePlaceholder}
                      </p>
                      <time className="lp-live__journal-meta">
                        {writeSealed && writeSealedAt
                          ? formatSealedStamp(writeSealedAt)
                          : `${visitStamp.date}, ${visitStamp.time}`}
                      </time>
                    </header>
                    <div className="lp-live__journal-body journal-tiptap">
                      <div className="ProseMirror">
                        {WRITE_NATURALLY.paragraphs.map((para, i) => (
                          <p
                            key={i}
                            className="journal-block lp-live__write-idle"
                          >
                            {para.split("\n").map((line, li, lines) => (
                              <span key={li}>
                                {line}
                                {li < lines.length - 1 ? <br /> : null}
                              </span>
                            ))}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  {writeSealed ? (
                    <p className="lp-live__signature" aria-hidden>
                      {SIGNATURE_NAME}
                    </p>
                  ) : (
                    <div className="lp-live__stamp-btn-wrap">
                      <Tooltip content="Seal entry" bubbleClassName="tooltip-bubble-stamp">
                        <button
                          type="button"
                          className={`lp-live__stamp-btn group shrink-0 cursor-pointer select-none outline-none ${btnIconInvisible("md", "xl")}`}
                          aria-label="Seal entry"
                          onClick={() => {
                            const now = Date.now();
                            setWriteSealedAt(now);
                            setWriteSealed(true);
                          }}
                        >
                          <Signature
                            size={iconPx("md")}
                            strokeWidth={iconStroke("md")}
                            aria-hidden
                            className={iconFixed}
                          />
                        </button>
                      </Tooltip>
                    </div>
                  )}
                </section>

                <section
                  className="lp-live__layer lp-live__layer--journal"
                  style={{ opacity: journalOpacity }}
                  aria-hidden={journalOpacity < 0.05}
                  data-writing-zone={activeEntry.sealed ? "" : undefined}
                  data-sealed={activeEntry.sealed ? "" : undefined}
                >
                  <div className="lp-live__column">
                    <header className="lp-live__journal-head">
                      <h1 className="lp-live__journal-title header-lg">
                        {activeEntry.title}
                      </h1>
                      <time className="lp-live__journal-meta">
                        {activeEntry.sealed
                          ? activeEntry.sealedLabel
                          : "Today · just now"}
                      </time>
                    </header>
                    <div className="lp-live__journal-body journal-tiptap">
                      <div className="ProseMirror">
                        {activeEntry.body.map((para, i) => (
                          <p key={i} className="journal-block">
                            {para}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                  {activeEntry.sealed ? (
                    <p className="lp-live__signature" aria-hidden>
                      {SIGNATURE_NAME}
                    </p>
                  ) : null}
                </section>

                <section
                  className="lp-live__layer lp-live__layer--moments"
                  style={{ opacity: chipsOpacity }}
                  aria-hidden={chipsOpacity < 0.05}
                >
                  <p className="lp-live__moments-label">
                    {PATTERN.evidenceLabel}
                  </p>
                  {LIVE_SCREEN2_CARDS.map((card, i) => {
                    const home = CHIP_HOME[i] ?? CHIP_HOME[0];
                    const settle = CHIP_SETTLE[i] ?? CHIP_SETTLE[0];
                    const delay = i * 0.05;
                    const enter = easeOutCubic(clamp((chipsIn - delay) / 0.38));
                    const gather = easeOutCubic(
                      clamp((chipsGather - delay * 0.25) / 0.6),
                    );
                    const exit = easeOutCubic(
                      clamp((chipsOut - delay * 0.4) / 0.45),
                    );

                    const x = lerp(home.x, settle.x, gather);
                    const y = lerp(home.y, settle.y, gather);
                    const rot = lerp(home.rot, settle.rot, gather);
                    const scale = lerp(1, 0.94, gather) * lerp(1, 0.82, exit);
                    const chipOpacity = enter * lerp(1, 0, exit);

                    if (chipOpacity < 0.02) return null;

                    return (
                      <div
                        key={card.quote}
                        className="lp-live__chip"
                        style={
                          {
                            left: `${x}%`,
                            top: `${y}%`,
                            opacity: chipOpacity,
                            transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${scale}) translateY(${lerp(18, 0, enter) / 16}rem)`,
                            zIndex: 2 + i,
                          } as CSSProperties
                        }
                      >
                        <p className="lp-live__chip-meta">
                          <span className="lp-live__chip-label">
                            {card.entryTitle}
                          </span>
                          <span className="lp-live__chip-sep" aria-hidden>
                            ·
                          </span>
                          <span className="lp-live__chip-date">{card.date}</span>
                        </p>
                        <p className="lp-live__chip-quote">
                          &ldquo;{card.quote}&rdquo;
                        </p>
                      </div>
                    );
                  })}
                </section>

                <section
                  className="lp-live__layer lp-live__layer--pattern"
                  style={{
                    opacity: patternOpacity,
                    transform: `translateY(${lerp(18, 0, patternOpacity) / 16}rem)`,
                  }}
                  aria-hidden={patternOpacity < 0.05}
                >
                  <div className="lp-live__column lp-live__pattern-inner">
                    <h2 className="lp-live__pattern-title header-lg">
                      {PATTERN.title}
                    </h2>
                    <div
                      className="lp-live__loops"
                      style={{
                        opacity:
                          viewOverride === "pattern"
                            ? 1
                            : clamp((patternIn - 0.15) / 0.35),
                      }}
                    >
                      <MechanismChain
                        text={PATTERN.loops.join("\n")}
                        animate={
                          viewOverride === "pattern" || patternIn > 0.35
                        }
                      />
                    </div>

                    <div
                      className="lp-live__pattern-foot"
                      style={{
                        opacity:
                          viewOverride === "pattern" ||
                          showReflect > 0.05 ||
                          showCta > 0.05
                            ? 1
                            : 0,
                        transform: `translateY(${
                          viewOverride === "pattern"
                            ? 0
                            : lerp(12, 0, showReflect) / 16
                        }rem)`,
                      }}
                    >
                      <p
                        className="lp-live__pattern-question header-lg"
                        style={{
                          opacity:
                            viewOverride === "pattern" ? 1 : showReflect,
                        }}
                      >
                        {PATTERN.closingQuestion}
                      </p>
                      <div
                        style={{
                          opacity: viewOverride === "pattern" ? 1 : showCta,
                        }}
                      >
                        <LandingEndCta />
                      </div>
                    </div>
                  </div>
                </section>
              </main>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
