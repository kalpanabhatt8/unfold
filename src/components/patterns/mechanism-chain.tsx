"use client";

import { Fragment } from "react";
import { splitMechanismSteps } from "@/lib/patterns/mechanism-steps";

/** Delay between each step and arrow in the cascade (ms). */
const CASCADE_MS = 260;

export type MechanismChainProps = {
  text: string;
  /** Stagger step → arrow → step when the beat is first revealed. */
  animate?: boolean;
};

/**
 * Mechanism as a vertical chain of events — each sentence is one step,
 * connected by muted arrows so the user watches the loop unfold.
 */
export function MechanismChain({ text, animate = false }: MechanismChainProps) {
  const steps = splitMechanismSteps(text);
  if (steps.length === 0) return null;

  return (
    <div
      className="discovery-mechanism-chain"
      data-animate={animate ? "true" : "false"}
    >
      {steps.map((step, index) => (
        <Fragment key={index}>
          <p
            className="discovery-mechanism-step"
            style={
              animate
                ? { animationDelay: `${index * 2 * CASCADE_MS}ms` }
                : undefined
            }
          >
            {step}
          </p>
          {index < steps.length - 1 ? (
            <span
              className="discovery-mechanism-arrow px-2"
              aria-hidden
              style={
                animate
                  ? { animationDelay: `${(index * 2 + 1) * CASCADE_MS}ms` }
                  : undefined
              }
            >
              ↓
            </span>
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}
