"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { LandingChrome } from "./landing-chrome";
import { CTA, JOURNAL_ENTRY_A, MOMENTS, PATTERN } from "./story";
import "./landing-concepts.css";

function clamp(n: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, n));
}

function stage(p: number, start: number, end: number) {
  return clamp((p - start) / (end - start));
}

const PLACEMENTS = [
  { id: "j1", type: "journal" as const, left: 180, top: 220, rot: -2.2 },
  { id: "n1", type: "note" as const, left: 620, top: 160, rot: 3.5, moment: 0, tone: "cream" },
  { id: "n2", type: "note" as const, left: 980, top: 280, rot: -1.8, moment: 1, tone: "rose" },
  { id: "sk", type: "sketch" as const, left: 420, top: 520, rot: 4 },
  { id: "n3", type: "note" as const, left: 1180, top: 520, rot: 2.2, moment: 2, tone: "cream" },
  { id: "n4", type: "note" as const, left: 760, top: 640, rot: -3, moment: 3, tone: "rose" },
  { id: "n5", type: "note" as const, left: 1480, top: 360, rot: 1.4, moment: 4, tone: "cream" },
  { id: "pat", type: "pattern" as const, left: 860, top: 380, rot: -1 },
];

export function InfiniteWorkspace() {
  const rootRef = useRef<HTMLDivElement>(null);
  const deskRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [pan, setPan] = useState({ x: 80, y: 40 });
  const drag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const [reduced, setReduced] = useState(false);

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
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      const scrolled = clamp(-rect.top / Math.max(total, 1));
      setProgress(reduced ? 1 : scrolled);

      // Auto-pan the desk as the visitor scrolls through the story.
      if (!drag.current) {
        setPan({
          x: 80 - scrolled * 420,
          y: 40 - scrolled * 180,
        });
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduced]);

  const linkO = stage(progress, 0.2, 0.45);
  const patternO = stage(progress, 0.42, 0.65);
  const endO = stage(progress, 0.72, 0.9);
  const focusIdx = progress < 0.25 ? -1 : progress < 0.55 ? Math.min(4, Math.floor((progress - 0.25) * 16)) : -2;

  const onPointerDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest("a,button")) return;
    deskRef.current?.setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    setPan({
      x: drag.current.px + (e.clientX - drag.current.sx),
      y: drag.current.py + (e.clientY - drag.current.sy),
    });
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div className="lp-root lp-work" ref={rootRef}>
      <LandingChrome variant="cream" />
      <div className="lp-work__scroll">
        <div
          className="lp-work__desk"
          ref={deskRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={
            {
              "--link-o": linkO,
              "--pattern-o": patternO,
              "--end-o": endO,
            } as CSSProperties
          }
        >
          <div
            className="lp-work__world"
            style={
              {
                "--pan-x": `${pan.x}px`,
                "--pan-y": `${pan.y}px`,
              } as CSSProperties
            }
          >
            <div className="lp-work__grid" aria-hidden />

            <svg className="lp-work__links" width="2200" height="1400" aria-hidden>
              <path d="M 700 220 C 780 300, 820 340, 900 420" />
              <path d="M 1080 340 C 1020 380, 980 400, 940 430" />
              <path d="M 1240 560 C 1120 520, 1040 480, 980 450" />
              <path d="M 840 700 C 880 620, 900 540, 940 460" />
              <path d="M 1540 400 C 1320 420, 1100 440, 1020 450" />
              <path d="M 500 560 C 640 520, 780 480, 900 440" />
            </svg>

            {PLACEMENTS.map((item) => {
              if (item.type === "journal") {
                return (
                  <div
                    key={item.id}
                    className="lp-work__item lp-work__journal"
                    style={
                      {
                        left: item.left,
                        top: item.top,
                        "--rot": `${item.rot}deg`,
                      } as CSSProperties
                    }
                    data-dim={focusIdx >= 0}
                  >
                    <h3>{JOURNAL_ENTRY_A.title}</h3>
                    <time>{JOURNAL_ENTRY_A.date}</time>
                    <p>{JOURNAL_ENTRY_A.paragraphs[0]}</p>
                  </div>
                );
              }

              if (item.type === "sketch") {
                return (
                  <div
                    key={item.id}
                    className="lp-work__item lp-work__sketch"
                    style={
                      {
                        left: item.left,
                        top: item.top,
                        "--rot": `${item.rot}deg`,
                      } as CSSProperties
                    }
                    data-dim={focusIdx >= 0}
                    aria-hidden
                  >
                    <svg width="88" height="64" viewBox="0 0 88 64" fill="none">
                      <path
                        d="M8 48 C 22 18, 40 12, 52 28 C 64 44, 72 40, 80 22"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        color="var(--sidebar-ink-soft)"
                      />
                      <circle cx="52" cy="28" r="3" fill="currentColor" color="var(--sidebar-ink-soft)" />
                    </svg>
                  </div>
                );
              }

              if (item.type === "pattern") {
                return (
                  <div
                    key={item.id}
                    className="lp-work__item lp-work__pattern lp-pattern-card"
                    style={{ left: item.left, top: item.top }}
                    data-ready={patternO > 0.55}
                  >
                    <p className="lp-pattern-card__label">{PATTERN.label}</p>
                    <h2 className="lp-pattern-card__title">{PATTERN.title}</h2>
                    <ul className="lp-pattern-card__loops">
                      {PATTERN.loops.map((loop) => (
                        <li key={loop} className="lp-pattern-card__loop">
                          {loop}
                        </li>
                      ))}
                    </ul>
                    {patternO > 0.7 ? (
                      <p
                        className="lp-reflection"
                        style={{ marginTop: "1.5rem", fontSize: "1.2rem", maxWidth: "16ch" }}
                      >
                        {PATTERN.reflection}
                      </p>
                    ) : null}
                  </div>
                );
              }

              const moment = MOMENTS[item.moment ?? 0];
              const dim =
                focusIdx === -2
                  ? false
                  : focusIdx >= 0
                    ? focusIdx !== item.moment
                    : false;

              return (
                <div
                  key={item.id}
                  className={`lp-work__item lp-work__note lp-work__note--${item.tone}`}
                  style={
                    {
                      left: item.left,
                      top: item.top,
                      "--rot": `${item.rot}deg`,
                    } as CSSProperties
                  }
                  data-dim={dim}
                >
                  <p>&ldquo;{moment.quote}&rdquo;</p>
                  <span>
                    {moment.date} · {moment.entryTitle}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="lp-work__hud">
            <p>
              <strong>workspace</strong>
            </p>
            <p>scroll or drag to look around</p>
          </div>

          <div className="lp-work__end" data-ready={endO > 0.5}>
            <div className="lp-end-cta__row" style={{ pointerEvents: "auto" }}>
              <Link href="/dashboard" className="lp-chrome__cta lp-chrome__cta--lg">
                {CTA.primary}
              </Link>
              <Link href="/sign-in" className="lp-chrome__ghost">
                {CTA.secondary}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
