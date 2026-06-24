export const btnBase =
  "inline-flex items-center justify-center rounded-xl transition-colors duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 active:opacity-100";

export const btnRadius = {
  pill: "rounded-full",
  soft: "rounded-[0.85rem]",
} as const;

export const buttonSize = {
  xs: {
    iconButton: "h-7 w-7 p-0",
    textButton: "h-7 px-2.5 gap-1 text-xs font-medium whitespace-nowrap",
    icon: 14,
    stroke: 1.75,
  },
  sm: {
    iconButton: "h-8 w-8 p-0",
    textButton: "h-8 px-3 gap-1.5 text-sm font-medium whitespace-nowrap",
    icon: 16,
    stroke: 1.75,
  },
  md: {
    iconButton: "h-9 w-9 p-0",
    textButton: "h-9 px-3.5 gap-1.5 text-sm font-medium whitespace-nowrap",
    icon: 18,
    stroke: 1.85,
  },
  lg: {
    iconButton: "h-10 w-10 p-0",
    textButton: "h-10 px-4 gap-2 text-md font-medium whitespace-nowrap",
    icon: 20,
    stroke: 1.9,
  },
} as const;

export type ButtonSize = keyof typeof buttonSize;

export const btnIcon = (size: ButtonSize = "md") =>
  `${btnBase} ${buttonSize[size].iconButton}`;
export const btnText = (size: ButtonSize = "md") =>
  `${btnBase} ${buttonSize[size].textButton}`;
export const iconPx = (size: ButtonSize = "md") => buttonSize[size].icon;
export const iconStroke = (size: ButtonSize = "md") => buttonSize[size].stroke;

export const iconStrokePx = (px: number) => {
  if (px <= 13) return 1.7;
  if (px <= 16) return 1.75;
  if (px <= 18) return 1.85;
  return 1.9;
};

export const btnState = {
  default: "bg-white text-[var(--color-icon)] border border-black/[0.08]",
  neutral: "bg-white text-[var(--color-icon)]",
  hover: "hover:bg-[var(--color-iconbutton-hover)] hover:text-[var(--color-icon)]",
  active:
    "active:bg-[var(--color-iconbutton-active)] active:text-[var(--color-icon)]",
  selected: "bg-black/[0.08] text-[var(--color-icon)] border-black/[0.16]",
  disabled:
    "disabled:bg-black/[0.03] disabled:text-black/35 disabled:border-black/[0.06] disabled:opacity-45 disabled:pointer-events-none",
} as const;

export const iconFixed = "shrink-0";
