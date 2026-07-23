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

/** Semantic button types: primary · secondary · destructive · invisible */
export const btnType = {
  primary:
    "bg-(--button-primary) text-(--button-primary-foreground) " +
    "hover:bg-(--button-primary-hover) active:bg-(--button-primary-active) " +
    "disabled:opacity-45 disabled:pointer-events-none",
  secondary:
    "bg-(--surface-raised) text-secondary border border-(--popover-border) " +
    "hover:bg-(--surface-chrome-hover) " +
    "disabled:opacity-50 disabled:pointer-events-none",
  destructive:
    "bg-(--button-destructive-soft) text-(--button-destructive-soft-foreground) " +
    "hover:bg-(--button-destructive-soft-hover) active:bg-(--button-destructive-soft-active) " +
    "disabled:opacity-40 disabled:pointer-events-none",
  invisible:
    "bg-transparent text-(--color-icon) border border-transparent " +
    "hover:bg-(--color-iconbutton-hover) hover:text-(--color-icon) " +
    "active:bg-(--color-iconbutton-active) active:text-(--color-icon)",
} as const;

export type BtnType = keyof typeof btnType;

/** Solid fill for irreversible confirms (pairs with destructive type). */
export const btnTypeDestructiveSolid =
  "bg-(--button-destructive) text-(--button-destructive-foreground) " +
  "hover:bg-(--button-destructive-hover) active:bg-(--button-destructive-active) " +
  "disabled:opacity-45 disabled:pointer-events-none";

/** Low-level chrome for icon buttons that compose their own look. */
export const btnState = {
  default: "bg-white text-(--color-icon) border border-black/[0.08]",
  neutral: "bg-white text-(--color-icon)",
  hover: "hover:bg-(--color-iconbutton-hover) hover:text-(--color-icon)",
  active:
    "active:bg-(--color-iconbutton-active) active:text-(--color-icon)",
  selected: "bg-black/[0.08] text-(--color-icon) border-black/[0.16]",
  disabled:
    "disabled:bg-black/[0.03] disabled:text-black/35 disabled:border-black/[0.06] disabled:opacity-45 disabled:pointer-events-none",
} as const;

export const btnPrimary = (size: ButtonSize = "sm", radius?: BtnRadius) =>
  `${btnText(size, radius)} ${btnType.primary}`;

export const btnSecondary = (size: ButtonSize = "xs", radius?: BtnRadius) =>
  `${btnText(size, radius)} ${btnType.secondary}`;

export const btnDestructive = (size: ButtonSize = "sm", radius?: BtnRadius) =>
  `${btnText(size, radius)} ${btnType.destructive}`;

export const btnDestructiveSolid = (size: ButtonSize = "sm", radius?: BtnRadius) =>
  `${btnText(size, radius)} ${btnTypeDestructiveSolid}`;

export const btnInvisible = (size: ButtonSize = "md", radius?: BtnRadius) =>
  `${btnText(size, radius)} ${btnType.invisible}`;

/** Icon-only chrome — matches modal close buttons (Send feedback, Account). */
export const btnIconChromeType =
  "bg-transparent text-(--sidebar-ink-soft) border border-transparent " +
  "hover:bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] hover:text-(--sidebar-ink) " +
  "active:bg-[color-mix(in_srgb,var(--text-primary)_9%,transparent)] active:text-(--sidebar-ink)";

export const btnIconChrome = (size: ButtonSize = "sm", radius?: BtnRadius) => {
  const radiusClass = radius ? btnRadius[radius] : "rounded-md";
  return `${btnBase} ${buttonSize[size].iconButton} ${radiusClass} ${btnIconChromeType}`;
};

export const btnIconInvisible = btnIconChrome;

/** @deprecated Prefer `btnIconChrome`. */
export const btnIconTransparent = btnIconChrome;

export const iconFixed = "shrink-0";
