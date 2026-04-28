export type ElementKind = "text" | "image" | "sticker" | "emoji" | "date";

export type FrameStyle = "none" | "polaroid" | "rounded" | "taped";
export type TextureStyle = "none" | "noise" | "grain" | "paper";
export type ThemeFilter = "none" | "tone3" | "pastel" | "glow";

export type BoardElementBase = {
  id: string;
  kind: ElementKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  z: number;
};

export type TextElement = BoardElementBase & {
  kind: "text";
  text: string;
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
  fontFamily?: string;
  weight?: number;
  italic?: boolean;
};

export type ImageElement = BoardElementBase & {
  kind: "image";
  src: string;
  naturalW?: number;
  naturalH?: number;
  frame?: FrameStyle;
  texture?: TextureStyle;
  filter?: ThemeFilter;
  textureIntensity?: number;
};

export type StickerElement = BoardElementBase & {
  kind: "sticker";
  src: string;
  pack: string;
};

export type EmojiElement = BoardElementBase & {
  kind: "emoji";
  emoji: string;
  fontSize: number;
};

export type DateElement = BoardElementBase & {
  kind: "date";
  label: string;
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
  fontFamily?: string;
  weight?: number;
  italic?: boolean;
};

export type BoardElement =
  | TextElement
  | ImageElement
  | StickerElement
  | EmojiElement
  | DateElement;

export type BackgroundMode =
  | { type: "solid"; bgColor: string }
  | {
      type: "pattern";
      pattern: "dots" | "sparkle" | "grid" | "lined";
      bgColor: string;
      patternColor: string;
      size: number;
    }
  | {
      type: "image";
      src: string;
      fit: "cover" | "contain";
    };

export type BoardState = {
  background: BackgroundMode;
  elements: BoardElement[];
  selectedId?: string | null;
  filter: ThemeFilter;
};
