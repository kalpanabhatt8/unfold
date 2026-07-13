"use client";

import { JournalSnippet } from "@/components/patterns/journal-snippet";
import type { MechanismStepPresentation } from "@/lib/patterns/discovery-arc";
import { splitMechanismSteps } from "@/lib/patterns/mechanism-steps";

/** Delay between each step in the cascade (ms). */
const CASCADE_MS = 260;

export type MechanismChainProps = {
  text: string;
  /** Structured Loop steps with supporting journal quotes (preferred). */
  steps?: MechanismStepPresentation[];
  /** Stagger each step when the beat is first revealed. */
  animate?: boolean;
  onOpenEntry?: (entryId: string, quoteText?: string) => void;
};

/**
 * Loop as a vertical timeline — each bridge, then the quote(s) that support it.
 *
 *   ● Step 1
 *     "journal quote"
 *   │
 *   ● Step 2
 *     "journal quote"
 */
export function MechanismChain({
  text,
  steps: structuredSteps,
  animate = false,
  onOpenEntry,
}: MechanismChainProps) {
  const steps: MechanismStepPresentation[] =
    structuredSteps && structuredSteps.length > 0
      ? structuredSteps
      : splitMechanismSteps(text).map((step) => ({
          text: step,
          quotes: [],
        }));

  if (steps.length === 0) return null;

  return (
    <ol
      className="discovery-mechanism-chain"
      data-animate={animate ? "true" : "false"}
    >
      {steps.map((step, index) => (
        <li
          key={index}
          className="discovery-mechanism-item"
          style={
            animate ? { animationDelay: `${index * CASCADE_MS}ms` } : undefined
          }
        >
          <div className="discovery-mechanism-step-row">
            <span className="discovery-mechanism-rail" aria-hidden>
              <span className="discovery-mechanism-dot" />
            </span>
            <div className="discovery-mechanism-step-body">
              <p className="discovery-mechanism-step">{step.text}</p>
              {step.quotes.length > 0 && onOpenEntry ? (
                <div className="discovery-mechanism-evidence">
                  {step.quotes.map((quote, qi) => (
                    <JournalSnippet
                      key={`${quote.entryId}-${qi}`}
                      quote={quote}
                      onOpenEntry={onOpenEntry}
                      compact
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          {index < steps.length - 1 ? (
            <div className="discovery-mechanism-gap" aria-hidden>
              <span className="discovery-mechanism-rail">
                <span className="discovery-mechanism-line" />
              </span>
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
