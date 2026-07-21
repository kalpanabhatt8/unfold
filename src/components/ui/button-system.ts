export const btnBase =
  "inline-flex items-center justify-center transition-colors duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 active:opacity-100";

export const btnRadius = {
  pill: "rounded-full",
  soft: "rounded-[0.6rem]",
  xs: "rounded-[0.375rem]",
  sm: "rounded-[0.4375rem]",
  md: "rounded-[0.5rem]",
  lg: "rounded-[0.625rem]",
  xl: "rounded-xl",
} as const;

export type BtnRadius = keyof typeof btnRadius;

export const buttonSize = {
  xs: {
    iconButton: "h-7 w-7 p-0",
    textButton: "h-7 px-2.5 gap-1 !text-xs font-medium whitespace-nowrap",
    icon: 14,
    stroke: 1.75,
    radius: btnRadius.xs,
  },
  sm: {
    iconButton: "h-8 w-8 p-0",
    textButton: "h-8 px-3 gap-1.5 !text-sm font-medium whitespace-nowrap",
    icon: 16,
    stroke: 1.75,
    radius: btnRadius.sm,
  },
  md: {
    iconButton: "h-9 w-9 p-0",
    textButton: "h-9 px-3.5 gap-1.5 !text-sm font-medium whitespace-nowrap",
    icon: 18,
    stroke: 1.85,
    radius: btnRadius.md,
  },
  lg: {
    iconButton: "h-10 w-10 p-0",
    textButton: "h-10 px-4 gap-2 !text-md font-medium whitespace-nowrap",
    icon: 20,
    stroke: 1.9,
    radius: btnRadius.lg,
  },
} as const;

export type ButtonSize = keyof typeof buttonSize;

const resolveRadius = (size: ButtonSize, radius?: BtnRadius) =>
  radius ? btnRadius[radius] : buttonSize[size].radius;

export const btnIcon = (size: ButtonSize = "md", radius?: BtnRadius) =>
  `${btnBase} ${resolveRadius(size, radius)} ${buttonSize[size].iconButton}`;

export const btnText = (size: ButtonSize = "md", radius?: BtnRadius) =>
  `${btnBase} ${resolveRadius(size, radius)} ${buttonSize[size].textButton}`;

export const iconPx = (size: ButtonSize = "md") => buttonSize[size].icon;
export const iconStroke = (size: ButtonSize = "md") => buttonSize[size].stroke;

export const iconStrokePx = (px: number) => {
  if (px <= 13) return 1.7;
  if (px <= 16) return 1.75;
  if (px <= 18) return 1.85;
  return 1.9;
};

export const btnState = {
  default: "bg-white text-(--color-icon) border border-black/[0.08]",
  neutral: "bg-white text-(--color-icon)",
  transparent:
    "bg-transparent text-(--color-icon) border border-transparent",
  hover: "hover:bg-(--color-iconbutton-hover) hover:text-(--color-icon)",
  active:
    "active:bg-(--color-iconbutton-active) active:text-(--color-icon)",
  selected: "bg-black/[0.08] text-(--color-icon) border-black/[0.16]",
  disabled:
    "disabled:bg-black/[0.03] disabled:text-black/35 disabled:border-black/[0.06] disabled:opacity-45 disabled:pointer-events-none",
  destructive:
    "bg-(--button-destructive) text-(--button-destructive-foreground) " +
    "hover:bg-(--button-destructive-hover) active:bg-(--button-destructive-active) " +
    "disabled:opacity-45 disabled:pointer-events-none",
  destructiveSoft:
    "bg-(--button-destructive-soft) text-(--button-destructive-soft-foreground) " +
    "hover:bg-(--button-destructive-soft-hover) active:bg-(--button-destructive-soft-active) " +
    "disabled:opacity-40 disabled:pointer-events-none",
} as const;

export const btnIconTransparent = (size: ButtonSize = "md", radius?: BtnRadius) =>
  `${btnIcon(size, radius)} ${btnState.transparent} ${btnState.hover} ${btnState.active}`;

/** Filled destructive text button (confirm delete, etc.). */
export const btnDestructive = (size: ButtonSize = "sm", radius?: BtnRadius) =>
  `${btnText(size, radius)} ${btnState.destructive}`;

/** Soft destructive text button (delete account, log out of all devices). */
export const btnDestructiveSoft = (size: ButtonSize = "sm", radius?: BtnRadius) =>
  `${btnText(size, radius)} ${btnState.destructiveSoft}`;

export const iconFixed = "shrink-0";
