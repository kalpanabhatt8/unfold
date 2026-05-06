export type BookCoverSize = "sm" | "md" | "smd" | "lg" | "xl" | "2xl" | "3xl";

type OverlaySizing = {
  groove: { width: string };
  overlayLine: { left: string; width: string };
  content: { marginBottom: string };
};

type TypographySizing = {
  text: {
    titleSize: string;
    subtitleSize: string;
  };
};

type PaddingSizing = {
  padding: {
    left: string;
    right: string;
    top: string;
    bottom: string;
  };
};

type BookSizeConfig = OverlaySizing &
  TypographySizing &
  PaddingSizing & {
  container: string;
};

export const BOOK_CONFIG: Record<BookCoverSize, BookSizeConfig> = {
  sm: {
    container: "w-[8.625rem] h-[12.125rem]",
    padding: { left: "1.1rem", right: "0.42rem", top: "0.74rem", bottom: "0.74rem" },
    groove: { width: "0.52rem" },
    overlayLine: { left: "0.72rem", width: "0.16rem" },
    content: { marginBottom: "1.12rem" },
    text: { titleSize: "0.875rem", subtitleSize: "0.7rem" },
  },
  md: {
    container: "w-[9.5rem] h-[13rem]",
    padding: { left: "1.875rem", right: "0.625rem", top: "1.25rem", bottom: "1.25rem" },
    groove: { width: "0.625rem" },
    overlayLine: { left: "0.875rem", width: "0.1875rem" },
    content: { marginBottom: "1.5rem" },
    text: { titleSize: "1rem", subtitleSize: "0.8rem" },
  },
  smd: {
    container: "w-[10.5rem] h-[15rem]",
    padding: { left: "2.1rem", right: "0.7rem", top: "1.4rem", bottom: "1.4rem" },
    groove: { width: "0.68rem" },
    overlayLine: { left: "0.98rem", width: "0.2rem" },
    content: { marginBottom: "1.68rem" },
    text: { titleSize: "1.05rem", subtitleSize: "0.84rem" },
  },
  lg: {
    container: "w-[14.125rem] h-[19.875rem]",
    padding: { left: "2.8rem", right: "0.95rem", top: "1.9rem", bottom: "1.9rem" },
    groove: { width: "0.8rem" },
    overlayLine: { left: "1.18rem", width: "0.24rem" },
    content: { marginBottom: "2.05rem" },
    text: { titleSize: "1.35rem", subtitleSize: "0.98rem" },
  },
  xl: {
    container: "w-[16.875rem] h-[23.75rem]",
    padding: { left: "3.35rem", right: "1.12rem", top: "2.28rem", bottom: "2.28rem" },
    groove: { width: "0.92rem" },
    overlayLine: { left: "1.36rem", width: "0.275rem" },
    content: { marginBottom: "2.4rem" },
    text: { titleSize: "1.55rem", subtitleSize: "1.1rem" },
  },
  "2xl": {
    container: "w-[19.75rem] h-[27.75rem]",
    padding: { left: "3.95rem", right: "1.32rem", top: "2.66rem", bottom: "2.66rem" },
    groove: { width: "1.04rem" },
    overlayLine: { left: "1.58rem", width: "0.31rem" },
    content: { marginBottom: "2.82rem" },
    text: { titleSize: "1.8rem", subtitleSize: "1.25rem" },
  },
  "3xl": {
    container: "w-[22.5rem] h-[31.625rem]",
    padding: { left: "4.5rem", right: "1.5rem", top: "3.02rem", bottom: "3.02rem" },
    groove: { width: "1.16rem" },
    overlayLine: { left: "1.8rem", width: "0.35rem" },
    content: { marginBottom: "3.2rem" },
    text: { titleSize: "2rem", subtitleSize: "1.35rem" },
  },
};
