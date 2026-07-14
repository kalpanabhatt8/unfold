"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { LandingChrome, LandingEndCta } from "./landing-chrome";
import {
  JOURNAL_ENTRY_A,
  JOURNAL_ENTRY_B,
  MOMENTS,
  PATTERN,
} from "./story";
import "./landing-concepts.css";

function useInView<T extends HTMLElement = HTMLElement>(threshold = 0.35) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref: ref as RefObject<T>, inView };
}

export function ReadingJourney() {
  const entryA = useInView<HTMLElement>(0.4);
  const entryB = useInView<HTMLElement>(0.4);
  const bridge = useInView<HTMLElement>(0.45);
  const reveal = useInView<HTMLElement>(0.3);
  const [marksOn, setMarksOn] = useState(false);

  useEffect(() => {
    if (bridge.inView) {
      const t = window.setTimeout(() => setMarksOn(true), 400);
      return () => window.clearTimeout(t);
    }
  }, [bridge.inView]);

  const m1 = MOMENTS[0];
  const m3 = MOMENTS[2];

  return (
    <div className="lp-root lp-read">
      <LandingChrome variant="rose" />
      <div className="lp-read__rail">
        <section
          className="lp-read__chapter"
          ref={entryA.ref}
          data-in={entryA.inView}
        >
          <h1 className="lp-read__entry-title">{JOURNAL_ENTRY_A.title}</h1>
          <p className="lp-read__entry-date">{JOURNAL_ENTRY_A.date}</p>
          <div className="lp-read__prose">
            {JOURNAL_ENTRY_A.paragraphs.map((p, i) => (
              <p key={i} data-mark={i === 0}>
                {i === 0 ? (
                  <>
                    Sat down to write the proposal.{" "}
                    <span className="lp-read__mark" data-on={marksOn}>
                      Cleared the desk first.
                    </span>{" "}
                    Then the desktop. Then the downloads folder.
                  </>
                ) : (
                  p
                )}
              </p>
            ))}
          </div>
        </section>

        <div className="lp-read__gap" aria-hidden>
          14 days later
        </div>

        <section
          className="lp-read__chapter"
          ref={entryB.ref}
          data-in={entryB.inView}
        >
          <h1 className="lp-read__entry-title">{JOURNAL_ENTRY_B.title}</h1>
          <p className="lp-read__entry-date">{JOURNAL_ENTRY_B.date}</p>
          <div className="lp-read__prose">
            {JOURNAL_ENTRY_B.paragraphs.map((p, i) => (
              <p key={i} data-mark={i === 1}>
                {i === 1 ? (
                  <>
                    <span className="lp-read__mark" data-on={marksOn}>
                      Almost done, really. Just need to reorganize the folders
                    </span>{" "}
                    so I can find the research.
                  </>
                ) : (
                  p
                )}
              </p>
            ))}
          </div>
        </section>

        <section
          className="lp-read__bridge"
          ref={bridge.ref}
          data-linked={bridge.inView}
        >
          <p className="lp-pattern-card__label" style={{ marginBottom: 0 }}>
            {PATTERN.evidenceLabel}
          </p>
          <div className="lp-read__pair">
            <div className="lp-snippet lp-snippet--lit" style={{ maxWidth: "100%" }}>
              <p className="lp-snippet__quote">&ldquo;{m1.quote}&rdquo;</p>
              <p className="lp-snippet__meta">
                {m1.date} · {m1.dayPart} · {m1.entryTitle}
              </p>
            </div>
            <p className="lp-read__pair-gap">14 days later</p>
            <div className="lp-snippet lp-snippet--lit" style={{ maxWidth: "100%" }}>
              <p className="lp-snippet__quote">&ldquo;{m3.quote}&rdquo;</p>
              <p className="lp-snippet__meta">
                {m3.date} · {m3.dayPart} · {m3.entryTitle}
              </p>
            </div>
          </div>
          <svg
            className="lp-read__connect"
            viewBox="0 0 400 40"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path
              className="lp-read__connect-line"
              d="M 40 8 C 140 8, 160 32, 200 32 C 240 32, 260 8, 360 8"
            />
          </svg>
        </section>

        <section
          className="lp-read__reveal"
          ref={reveal.ref}
          data-in={reveal.inView}
        >
          <div>
            <p className="lp-pattern-card__label">{PATTERN.label}</p>
            <h2 className="lp-pattern-card__title" style={{ fontSize: "clamp(1.6rem, 3.2vw, 2.1rem)" }}>
              {PATTERN.title}
            </h2>
          </div>

          <ol className="lp-read__mech">
            {PATTERN.loops.map((loop, i) => (
              <li key={loop} className="lp-read__mech-item">
                <span className="lp-read__mech-rail" aria-hidden>
                  <span className="lp-read__mech-dot" />
                  {i < PATTERN.loops.length - 1 ? (
                    <span className="lp-read__mech-line" />
                  ) : null}
                </span>
                <p className="lp-read__mech-text">{loop}</p>
              </li>
            ))}
          </ol>

          <p className="lp-reflection">{PATTERN.reflection}</p>
          <LandingEndCta />
        </section>
      </div>
    </div>
  );
}
