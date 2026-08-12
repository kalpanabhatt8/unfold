"use client";

import type { ReactNode } from "react";

type PatternAccordionCollapseProps = {
  isOpen: boolean;
  id: string;
  labelledBy: string;
  children: ReactNode;
};

/** Accordion body — height animation is pure CSS (max-height) to avoid JS race bugs. */
export function PatternAccordionCollapse({
  isOpen,
  id,
  labelledBy,
  children,
}: PatternAccordionCollapseProps) {
  return (
    <div
      id={id}
      className="pattern-accordion__collapse"
      role="region"
      aria-labelledby={labelledBy}
      aria-hidden={!isOpen}
      inert={!isOpen ? true : undefined}
      data-open={isOpen ? "true" : "false"}
    >
      <div className="pattern-accordion__collapse-inner">{children}</div>
    </div>
  );
}
