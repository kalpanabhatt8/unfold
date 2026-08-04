"use client";

/**
 * Parked with the landing "See an example →" / in-canvas pattern preview.
 * Restore together with living-canvas + story SEE_EXAMPLE / EXAMPLE_PATTERN.
 */
export function ExamplePatternCard() {
  return null;
}

/*
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DiscoveryCanvas } from "@/components/patterns/discovery-canvas";
import type { DiscoveryArc } from "@/lib/patterns/discovery-arc";
import { getInitialRevealIndex } from "@/lib/patterns/discovery-arc";
import type { QuoteRef } from "@/lib/patterns/evidence-signals";
import {
  btnIconChrome,
  iconFixed,
  iconPx,
  iconStroke,
} from "@/components/ui/button-system";
import { EXAMPLE_PATTERN } from "./story";

const DEMO_ANCHOR_TS = new Date(2026, 6, 23, 12, 0, 0).getTime();

function buildExampleArc(): DiscoveryArc {
  const visible: QuoteRef[] = EXAMPLE_PATTERN.moments.map((moment, i) => ({
    entryId: `demo-moment-${i}`,
    entryTitle: moment.entryTitle,
    text: moment.quote,
    confidence: 1,
    anchorTs: DEMO_ANCHOR_TS,
  }));

  return {
    phases: ["headline", "evidence", "mechanism", "reflection"],
    headline: {
      title: EXAMPLE_PATTERN.title,
      orienting: EXAMPLE_PATTERN.factLine,
    },
    evidence: { visible, overflow: [] },
    mechanism: { text: EXAMPLE_PATTERN.loops.join("\n") },
    reflection: {
      question: EXAMPLE_PATTERN.closingQuestion,
      quote: null,
    },
  };
}

export function ExamplePatternCardActive() {
  const arc = useMemo(() => buildExampleArc(), []);
  const [expanded, setExpanded] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(() =>
    getInitialRevealIndex(arc),
  );
  const [revealKey, setRevealKey] = useState(0);

  const toggle = () => {
    setExpanded((open) => {
      const next = !open;
      if (next) {
        setPhaseIndex(getInitialRevealIndex(arc));
        setRevealKey((k) => k + 1);
      }
      return next;
    });
  };

  return (
    <ul
      className="pattern-accordion lp-live__example-accordion"
      aria-label="Example pattern"
    >
      <li
        className="pattern-accordion__item"
        data-expanded={expanded ? "true" : "false"}
      >
        <button
          type="button"
          className="pattern-accordion__row"
          aria-expanded={expanded}
          aria-controls={expanded ? "lp-example-pattern-panel" : undefined}
          id="lp-example-pattern-row"
          onClick={toggle}
        >
          <span className="pattern-accordion__row-main">
            <span className="pattern-accordion__row-title">
              {EXAMPLE_PATTERN.title}
            </span>
            <span className="pattern-accordion__row-fact">
              {EXAMPLE_PATTERN.factLine}
            </span>
          </span>
          <span
            className={`pattern-accordion__row-chevron shrink-0 ${btnIconChrome("xs")}`}
            aria-hidden
          >
            {expanded ? (
              <ChevronUp
                size={iconPx("xs")}
                strokeWidth={iconStroke("xs")}
                className={iconFixed}
              />
            ) : (
              <ChevronDown
                size={iconPx("xs")}
                strokeWidth={iconStroke("xs")}
                className={iconFixed}
              />
            )}
          </span>
        </button>

        {expanded ? (
          <div
            id="lp-example-pattern-panel"
            className="pattern-accordion__panel"
            role="region"
            aria-labelledby="lp-example-pattern-row"
          >
            <div className="pattern-accordion__panel-scroll">
              <DiscoveryCanvas
                arc={arc}
                phaseIndex={phaseIndex}
                revealKey={`landing-example-${revealKey}`}
                ctaReady
                compactHeadline
                onContinue={() => setPhaseIndex((i) => i + 1)}
                onOpenEntry={() => {}}
              />
            </div>
          </div>
        ) : null}
      </li>
    </ul>
  );
}
*/
