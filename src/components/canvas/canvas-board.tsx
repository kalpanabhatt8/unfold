"use client";
// Font family options by theme (all themes use the full font list)
// Font family options by theme (all themes use the full font list)
const fontsByTheme: Record<Theme, string[]> = {
  neutral: [
    "var(--font-gochi)",
    "var(--font-mali)",
    "var(--font-elsie)",
    "var(--font-indieflower)",
    "var(--font-kaushan)",
    "var(--font-manrope)",
    "var(--font-lato)",
    "var(--font-poppins)",
    "var(--font-space-grotesk)",
    "var(--font-bricolage)",
    "var(--font-patrick-hand)",
    "var(--font-caveat)",
    "var(--font-plaster)",
    "var(--font-hachimarupop)",
    "var(--font-cutefont)",
    "var(--font-bangers)",
    "var(--font-gloria)",
    "var(--font-comicneue)",
    "var(--font-mochiy)",
    "var(--font-kosugimaru)",
    "var(--font-baloo2)",
    "var(--font-yusei)",
    "var(--font-pressstart)",
    "var(--font-minecraftia)",
    "var(--font-caress)",
    "var(--font-vensfolk)",
  ],
  kawaii: [
    "var(--font-gochi)",
    "var(--font-mali)",
    "var(--font-elsie)",
    "var(--font-indieflower)",
    "var(--font-kaushan)",
    "var(--font-manrope)",
    "var(--font-lato)",
    "var(--font-poppins)",
    "var(--font-space-grotesk)",
    "var(--font-bricolage)",
    "var(--font-patrick-hand)",
    "var(--font-caveat)",
    "var(--font-plaster)",
    "var(--font-hachimarupop)",
    "var(--font-cutefont)",
    "var(--font-bangers)",
    "var(--font-gloria)",
    "var(--font-comicneue)",
    "var(--font-mochiy)",
    "var(--font-kosugimaru)",
    "var(--font-baloo2)",
    "var(--font-yusei)",
    "var(--font-pressstart)",
    "var(--font-minecraftia)",
    "var(--font-caress)",
    "var(--font-vensfolk)",
  ],
  retro: [
    "var(--font-gochi)",
    "var(--font-mali)",
    "var(--font-elsie)",
    "var(--font-indieflower)",
    "var(--font-kaushan)",
    "var(--font-manrope)",
    "var(--font-lato)",
    "var(--font-poppins)",
    "var(--font-space-grotesk)",
    "var(--font-bricolage)",
    "var(--font-patrick-hand)",
    "var(--font-caveat)",
    "var(--font-plaster)",
    "var(--font-hachimarupop)",
    "var(--font-cutefont)",
    "var(--font-bangers)",
    "var(--font-gloria)",
    "var(--font-comicneue)",
    "var(--font-mochiy)",
    "var(--font-kosugimaru)",
    "var(--font-baloo2)",
    "var(--font-yusei)",
    "var(--font-pressstart)",
    "var(--font-minecraftia)",
    "var(--font-caress)",
    "var(--font-vensfolk)",
  ],
  anime: [
    "var(--font-gochi)",
    "var(--font-mali)",
    "var(--font-elsie)",
    "var(--font-indieflower)",
    "var(--font-kaushan)",
    "var(--font-manrope)",
    "var(--font-lato)",
    "var(--font-poppins)",
    "var(--font-space-grotesk)",
    "var(--font-bricolage)",
    "var(--font-patrick-hand)",
    "var(--font-caveat)",
    "var(--font-plaster)",
    "var(--font-hachimarupop)",
    "var(--font-cutefont)",
    "var(--font-bangers)",
    "var(--font-gloria)",
    "var(--font-comicneue)",
    "var(--font-mochiy)",
    "var(--font-kosugimaru)",
    "var(--font-baloo2)",
    "var(--font-yusei)",
    "var(--font-pressstart)",
    "var(--font-minecraftia)",
    "var(--font-caress)",
    "var(--font-vensfolk)",
  ],
};

type TextElement = {
  id: string;
  text: string;
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  curve: boolean;
  x: number;
  y: number;
  rotation: number;
  isEditing?: boolean;
};

// StickyNote element type
type StickyNoteElement = {
  id: string;
  text: string;
  color: string;
  fontSize: number;
  bold: boolean;
  x: number;
  y: number;
  rotation: number;
};

// New: Image element type
type ImageElement = {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  frame?: string; // e.g., "polaroid"
  texture?: string; // overlay style string
  opacity?: number;
  zIndex: number;
  flip?: boolean;
  filter?: string;
  dateStamp?: string;
  timeStamp?: string;
};

// Sticker element type
type StickerElement = {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
};

// Audio element type
type AudioElement = {
  id: string;
  src: string;
  title?: string;
  artist?: string;
  x: number;
  y: number;
  zIndex: number;
  playing: boolean;
};
// Theme → icon mapping for the Sticker tool
const stickerIconByTheme: Record<
  Theme,
  React.ComponentType<{ size?: number }>
> = {
  neutral: LucideSmile,
  kawaii: LucideHeart,
  retro: LucideDisc,
  anime: LucideGhost,
};

import React, { useEffect, useState } from "react";
import { themeConfig } from "@/theme/themeConfig";
import { LucideSearch, Zap } from "lucide-react";

type MusicSearchPopupProps = {
  theme: Theme;
  addAudioElement: (src: string, title?: string) => void; // not used anymore, but keep for prop compatibility
  setGlobalAudio: React.Dispatch<
    React.SetStateAction<{
      videoId: string;
      title: string;
      thumbnail?: string;
      channelTitle?: string;
      artist?: string;
    } | null>
  >;
};

const MusicSearchPopup: React.FC<MusicSearchPopupProps> = ({
  theme,
  addAudioElement,
  setGlobalAudio,
}) => {
  const AudioIcon = themeConfig[theme].audioIcon;
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<
    Array<{
      videoId: string;
      title: string;
      thumbnail: string;
      channelTitle: string;
    }>
  >([]);
  const [error, setError] = React.useState<string | null>(null);
  // NEW: Local popup audio cards
  const [, setPopupAudios] = React.useState<
    Array<{
      videoId: string;
      title: string;
      thumbnail: string;
      channelTitle: string;
    }>
  >([]);

  // Styling for popup content
  const contentStyle = {
    width: 320,
    padding: "0.5rem",
    borderRadius: "0.75rem",
    boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
    background: "transparent",
  };

  // Fetch from YouTube Data API
  const doSearch = async (query: string) => {
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const apiKey = process.env.NEXT_PUBLIC_YT_API_KEY;
      if (!apiKey) {
        setError("Missing YouTube API key.");
        setLoading(false);
        return;
      }
      // videoCategoryId=10 (Music), type=video, maxResults=15, safeSearch=strict
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=15&videoCategoryId=10&q=${encodeURIComponent(
        query
      )}&key=${apiKey}&safeSearch=strict`;
      const res = await fetch(url);
      if (!res.ok) {
        let msg = "Failed to fetch from YouTube.";
        try {
          const errData = await res.json();
          if (errData?.error?.message) msg = errData.error.message;
        } catch {}
        setError(msg);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!data.items) {
        setError("No results found.");
        setResults([]);
        setLoading(false);
        return;
      }
      const items = data.items.map((item: any) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        thumbnail:
          item.snippet.thumbnails?.medium?.url ||
          item.snippet.thumbnails?.default?.url ||
          "",
        channelTitle: item.snippet.channelTitle,
      }));
      setResults(items);
      setLoading(false);
    } catch (e: any) {
      setError(e?.message || "Error fetching from YouTube.");
      setLoading(false);
    }
  };

  // Handle Enter key to search
  const handleSearchInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter" && search.trim().length > 0) {
      doSearch(search.trim());
    }
  };

  const themedButtonClass = clsx(
    "rounded px-2 py-1 text-xs font-semibold transition",
    themeConfig[theme].button,
    themeConfig[theme].hover
  );
  const listItemClass = clsx(
    "flex items-center px-2 py-2 rounded transition",
    themeConfig[theme].panel,
    themeConfig[theme].hover
  );

  return (
    <>
      <Popup
        trigger={
          <button
            aria-label="Music"
            className={clsx(
              "ml-2 flex items-center justify-center rounded-full p-3 transition",
              themeConfig[theme].button,
              themeConfig[theme].hover
            )}
            type="button"
          >
            <AudioIcon size={18} />
          </button>
        }
        position="bottom right"
        arrow={false}
        contentStyle={contentStyle}
        open={open}
        onOpen={() => {
          setOpen(true);
          setSearch("");
          setResults([]);
          setError(null);
          setLoading(false);
          setPopupAudios([]); // Optionally clear on open
        }}
        onClose={() => setOpen(false)}
      >
        <div className={clsx("flex flex-col gap-2", themeConfig[theme].panel)}>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              autoFocus
              placeholder="Search YouTube music…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchInputKeyDown}
              className={clsx(
                "rounded px-3 py-1 w-full border border-[var(--color-border-subtle)] bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition",
                themeConfig[theme].panel
              )}
              style={{ fontSize: 15 }}
            />
            <button
              type="button"
              aria-label="Search"
              className={clsx(
                "rounded-full p-2 transition flex items-center justify-center disabled:opacity-60 disabled:pointer-events-none",
                themeConfig[theme].button,
                themeConfig[theme].hover
              )}
              disabled={loading || search.trim().length === 0}
              onClick={() =>
                search.trim().length > 0 && doSearch(search.trim())
              }
              style={{ minWidth: 36 }}
            >
              <LucideSearch size={16} />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {loading && (
              <div className="text-xs text-center opacity-70 py-3">
                Searching…
              </div>
            )}
            {error && (
              <div className="text-xs text-center text-red-500 py-2">
                {error}
              </div>
            )}
            {/* Default curated songs if no search results */}
            {!loading &&
              !error &&
              results.length === 0 &&
              (() => {
                // Hardcoded curated tracks
                const defaultSongs = [
                  {
                    videoId: "jfKfPfyJRdk",
                    title: "lofi hip hop radio - beats to relax/study to",
                    channelTitle: "Lofi Girl",
                    thumbnail:
                      "https://i.ytimg.com/vi/jfKfPfyJRdk/mqdefault.jpg",
                  },
                  {
                    videoId: "DWcJFNfaw9c",
                    title: "Chillhop Radio - jazzy & lofi hip hop beats",
                    channelTitle: "Chillhop Music",
                    thumbnail:
                      "https://i.ytimg.com/vi/DWcJFNfaw9c/mqdefault.jpg",
                  },
                  {
                    videoId: "7NOSDKb0HlU",
                    title: "lofi beats to study/relax to",
                    channelTitle: "ChilledCow",
                    thumbnail:
                      "https://i.ytimg.com/vi/7NOSDKb0HlU/mqdefault.jpg",
                  },
                  {
                    videoId: "n61ULEU7CO0",
                    title: "Best of Lofi Hip Hop 2021",
                    channelTitle: "Lofi Girl",
                    thumbnail:
                      "https://i.ytimg.com/vi/n61ULEU7CO0/mqdefault.jpg",
                  },
                  {
                    videoId: "pVXKoic5vL0",
                    title: "Lost in Midnight Glow",
                    channelTitle: "Dreamy Lofi",
                    thumbnail:
                      "https://i.ytimg.com/vi/pVXKoic5vL0/mqdefault.jpg",
                  },
                  {
                    videoId: "qSqqvhjNet4",
                    title: "Romantic Lofi Mashup",
                    channelTitle: "Lofi Mashups",
                    thumbnail:
                      "https://i.ytimg.com/vi/qSqqvhjNet4/mqdefault.jpg",
                  },
                ];
                return (
                  <div>
                    <div className="text-xs text-center opacity-60 py-2">
                      Try these curated lofi & chill tracks!
                    </div>
                    <ul className="w-full flex flex-col gap-1 max-h-64 overflow-y-auto">
                      {defaultSongs.map((item) => (
                        <li
                          key={item.videoId}
                          className={clsx(listItemClass, "min-h-[54px]")}
                        >
                          <img
                            src={item.thumbnail}
                            alt=""
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 6,
                              objectFit: "cover",
                              marginRight: 10,
                              boxShadow: "0 2px 6px rgba(0,0,0,0.09)",
                              background: "var(--color-surface-overlay)",
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-semibold text-[var(--color-ink-strong)] text-sm">
                              {item.title}
                            </div>
                            <div className="truncate text-xs text-[var(--color-ink-soft)]">
                              {item.channelTitle}
                            </div>
                          </div>
                          <button
                            className={clsx(themedButtonClass, "ml-2")}
                            title="Add this song to your popup playlist"
                            type="button"
                            onClick={() => {
                              setPopupAudios((prev) =>
                                prev.some((aud) => aud.videoId === item.videoId)
                                  ? prev
                                  : [...prev, item]
                              );
                            }}
                          >
                            Add
                          </button>
                          <button
                            className={clsx(themedButtonClass, "ml-2")}
                            title="Play this song"
                            type="button"
                            onClick={() => {
                              setGlobalAudio({
                                videoId: item.videoId,
                                title: item.title,
                                thumbnail: item.thumbnail,
                                channelTitle: item.channelTitle,
                              });
                            }}
                            style={{ marginLeft: 8 }}
                          >
                            ▶ Play
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            {!loading && results.length > 0 && (
              <ul className="w-full flex flex-col gap-1 max-h-64 overflow-y-auto">
                {results.map((item) => (
                  <li
                    key={item.videoId}
                    className={clsx(listItemClass, "min-h-[54px]")}
                  >
                    <img
                      src={item.thumbnail}
                      alt=""
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 6,
                        objectFit: "cover",
                        marginRight: 10,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.09)",
                        background: "var(--color-surface-overlay)",
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-semibold text-[var(--color-ink-strong)] text-sm">
                        {item.title}
                      </div>
                      <div className="truncate text-xs text-[var(--color-ink-soft)]">
                        {item.channelTitle}
                      </div>
                    </div>
                    <button
                      className={clsx(themedButtonClass, "ml-2")}
                      title="Play this song"
                      type="button"
                      onClick={() => {
                        setGlobalAudio({
                          videoId: item.videoId,
                          title: item.title,
                          thumbnail: item.thumbnail,
                          channelTitle: item.channelTitle,
                        });
                      }}
                    >
                      ▶ Play
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="text-xs text-center opacity-60 mt-2">
            Powered by YouTube
          </div>
        </div>
      </Popup>
    </>
  );
};
import dynamic from "next/dynamic";
import {
  LucideImage,
  LucideStars,
  LucideSmile,
  LucideMusic,
  LucideHeart,
  LucideSun,
  LucideMusic4,
  LucideCake,
  LucideRainbow,
  LucideCamera,
  LucideDisc,
  LucideClock,
  LucideBrush,
  LucideSword,
  LucideCloud,
  LucideGhost,
  LucideMusic2,
  LucideMoon,
  LucidePen,
  LucideGamepad,
  RotateCw,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import { HexAlphaColorPicker, HexColorPicker } from "react-colorful";
import { Pattern, getThemeTexturePresets } from "./patterns";

const Popup = dynamic(() => import("reactjs-popup"), { ssr: false });
// import { LucideType } from "";
// (The duplicate MusicSearchPopup definition is removed below.)

export type Theme = "neutral" | "kawaii" | "retro" | "anime";

type CanvasBackgroundState = {
  color?: string;
  image?: string;
  pattern?: Pattern;
  texture?: Pattern;
};

export type CanvasSnapshot = {
  version: number;
  theme: Theme;
  background: CanvasBackgroundState;
  textElements: TextElement[];
  stickyNotes: StickyNoteElement[];
  imageElements: ImageElement[];
  stickerElements: StickerElement[];
  audioElements: AudioElement[];
  globalAudio: {
    videoId: string;
    title: string;
    thumbnail?: string;
    channelTitle?: string;
    artist?: string;
  } | null;
  updatedAt: number;
};

type CanvasSnapshotComparable = Omit<CanvasSnapshot, "updatedAt">;

const SNAPSHOT_VERSION = 1;

const allowedThemes: Theme[] = ["neutral", "kawaii", "retro", "anime"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const coerceBackgroundState = (value: unknown): CanvasBackgroundState => {
  if (!isRecord(value)) return {};
  // Pattern.style is now (theme: Theme) => string
  const coercePattern = (input: unknown): Pattern | undefined => {
    if (typeof input === "string") {
      // Back-compat from earlier snapshots (string URL)
      return { name: "custom", style: () => input };
    }
    if (isRecord(input) && typeof input.style === "string") {
      return {
        name:
          typeof input.name === "string" ? (input.name as string) : "custom",
        style: () => input.style as string,
        color:
          typeof input.color === "string" ? (input.color as string) : undefined,
        blend:
          typeof input.blend === "string" ? (input.blend as string) : undefined,
      };
    }
    return undefined;
  };

  const result: CanvasBackgroundState = {};
  if (typeof value.color === "string") result.color = value.color;
  if (typeof value.image === "string") result.image = value.image;

  const pat = coercePattern((value as any).pattern);
  if (pat) result.pattern = pat;

  const tex = coercePattern((value as any).texture);
  if (tex) result.texture = tex;

  return result;
};

const coerceGlobalAudio = (value: unknown): CanvasSnapshot["globalAudio"] => {
  if (!isRecord(value)) return null;
  const { videoId, title, thumbnail, channelTitle, artist } = value;
  if (typeof videoId !== "string" || typeof title !== "string") return null;
  return {
    videoId,
    title,
    thumbnail: typeof thumbnail === "string" ? thumbnail : undefined,
    channelTitle: typeof channelTitle === "string" ? channelTitle : undefined,
    artist: typeof artist === "string" ? artist : undefined,
  };
};

const arrayOrEmpty = <T,>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

const buildComparablePayload = (data: {
  theme: Theme;
  background: CanvasBackgroundState;
  textElements: TextElement[];
  stickyNotes: StickyNoteElement[];
  imageElements: ImageElement[];
  stickerElements: StickerElement[];
  audioElements: AudioElement[];
  globalAudio: CanvasSnapshot["globalAudio"];
}): CanvasSnapshotComparable => ({
  version: SNAPSHOT_VERSION,
  theme: data.theme,
  background: data.background,
  textElements: data.textElements,
  stickyNotes: data.stickyNotes,
  imageElements: data.imageElements,
  stickerElements: data.stickerElements,
  audioElements: data.audioElements,
  globalAudio: data.globalAudio,
});

const serializeComparable = (payload: CanvasSnapshotComparable) =>
  JSON.stringify(payload);

const normalizeSnapshot = (value: unknown): CanvasSnapshot | null => {
  if (!isRecord(value)) return null;
  const theme =
    typeof value.theme === "string" &&
    allowedThemes.includes(value.theme as Theme)
      ? (value.theme as Theme)
      : "neutral";
  const background = coerceBackgroundState(value.background);
  const textElements = arrayOrEmpty<TextElement>(value.textElements);
  const stickyNotes = arrayOrEmpty<StickyNoteElement>(value.stickyNotes);
  const imageElements = arrayOrEmpty<ImageElement>(value.imageElements);
  const stickerElements = arrayOrEmpty<StickerElement>(value.stickerElements);
  const audioElements = arrayOrEmpty<AudioElement>(value.audioElements);
  const globalAudio = coerceGlobalAudio(value.globalAudio);

  const updatedAt =
    typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
      ? value.updatedAt
      : Date.now();

  return {
    version: SNAPSHOT_VERSION,
    theme,
    background,
    textElements,
    stickyNotes,
    imageElements,
    stickerElements,
    audioElements,
    globalAudio,
    updatedAt,
  };
};

const parseInitialBackground = (value?: string): CanvasBackgroundState => {
  if (!value) return {};
  const trimmed = value.trim();
  if (!trimmed) return {};
  const lower = trimmed.toLowerCase();
  const isImage =
    lower.startsWith("url(") ||
    lower.includes("gradient(") ||
    lower.includes("gradient ");
  if (isImage) {
    return { image: trimmed };
  }
  return { color: trimmed };
};

type CanvasBoardProps = {
  storageKey: string;
  initialBackground?: string;
  onSnapshotChange?: (snapshot: CanvasSnapshot) => void;
  initialSnapshot?: CanvasSnapshot | null;
};

// Only unique, non-background, non-text icons for each theme:
// Ensure LucideImage is always the first tool in each array and no duplicates.
const iconSets = {
  neutral: [
    LucideImage, // image/photo
    LucideStars, // stars
    LucideSmile, // smile/emoji
    LucideMusic, // music/note
    LucidePen, // pen/drawing
  ],
  kawaii: [
    LucideImage, // image/photo
    LucideHeart, // heart
    LucideSun, // sun
    LucideMusic4, // music/note (different from neutral)
    LucideCake, // cake
    LucideRainbow, // rainbow
  ],
  retro: [
    LucideImage, // image/photo
    LucideCamera, // camera
    LucideDisc, // disc/vinyl
    LucideGamepad, // gamepad
    LucideClock, // clock
    LucideBrush, // brush
  ],
  anime: [
    LucideImage, // image/photo
    LucideSword, // sword
    LucideCloud, // cloud
    LucideGhost, // ghost
    LucideMusic2, // music/note
    LucideMoon, // moon
  ],
};

type ThemeSelectorProps = {
  theme: Theme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
};

const ThemeSelector: React.FC<ThemeSelectorProps> = ({ theme, setTheme }) => {
  const [open, setOpen] = React.useState(false);

  // ✅ Labels for themes (for nicer display text)
  const themeLabels: Record<Theme, string> = {
    neutral: "Neutral",
    kawaii: "Kawaii",
    retro: "Retro",
    anime: "Anime",
  };

  // ✅ Array of all themes to loop over
  const themes: Theme[] = ["neutral", "kawaii", "retro", "anime"];

  // ✅ Current theme’s icon
  const CurrentIcon = themeConfig[theme].backgroundIcon;

  return (
    <Popup
      trigger={
        <button
          aria-label="Select theme"
          className={clsx(
            "flex items-center justify-center rounded-full p-3 shadow transition",
            themeConfig[theme].button,
            themeConfig[theme].hover
          )}
        >
          <CurrentIcon size={18} />
        </button>
      }
      position="bottom right"
      closeOnDocumentClick
      arrow={false}
      contentStyle={{
        padding: "0.5rem",
        borderRadius: "0.5rem",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
      }}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
    >
      <div
        className={clsx(
          "flex flex-col gap-2 p-2 rounded-lg",
          themeConfig[theme].panel
        )}
      >
        {themes.map((t) => {
          const OptionIcon = themeConfig[t].backgroundIcon;
          const isActive = theme === t;
          return (
            <button
              key={t}
              onClick={() => {
                setTheme(t);
                setOpen(false);
              }}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded text-left text-sm font-medium transition",
                isActive ? themeConfig[t].button : themeConfig[t].panel,
                !isActive && themeConfig[t].hover
              )}
            >
              <OptionIcon size={16} />
              {themeLabels[t]} {/* 👈 Display nice label */}
            </button>
          );
        })}
      </div>
    </Popup>
  );
};

type BackgroundPopupProps = {
  setBackground: React.Dispatch<React.SetStateAction<CanvasBackgroundState>>;
  background: CanvasBackgroundState;
  theme: Theme;
};
// Accepts onAddImage prop to add image elements instead of setting background image
const BackgroundPopup: React.FC<
  BackgroundPopupProps & { onAddImage?: (src: string) => void }
> = ({ setBackground, background, theme, onAddImage }) => {
  const [open, setOpen] = React.useState(false);
  const BackgroundIcon = themeConfig[theme].backgroundIcon;
  const triggerButtonClass = clsx(
    "flex items-center justify-center rounded-full p-3 transition",
    themeConfig[theme].button,
    themeConfig[theme].hover
  );
  const primaryActionClass = clsx(
    "rounded px-3 py-1 transition",
    themeConfig[theme].button,
    themeConfig[theme].hover
  );
  const neutralActionClass = clsx(
    "rounded px-3 py-1 transition border border-[var(--color-border-subtle)]",
    themeConfig[theme].panel,
    themeConfig[theme].hover
  );
  const tileButtonClass = clsx(
    "w-12 h-12 rounded border-2 border-transparent transition",
    themeConfig[theme].panel,
    themeConfig[theme].hover
  );

  const themePresetColors: Record<Theme, string[]> = {
    neutral: [
      "#ffffff", // pure white
      "#f9fafb", // light gray (backgrounds)
      "#f3f4f6", // neutral soft gray
      "#e5e7eb", // subtle border gray
      "#d1d5db", // medium gray
      "#9ca3af", // neutral gray
      "#6b7280", // slate gray
      "#4b5563", // darker slate
      "#374151", // dark gray
      "#1f2937", // near-black gray
      "#111827", // almost black
    ],
    kawaii: [
      "#FFE4EE", // blush pink
      "#FFD6EC", // soft rose
      "#FFF0F8", // lavender blush
      "#E3F2FD", // baby blue
      "#F0FFF0", // mint cream
      "#FFF9E6", // light peach/vanilla
      "#F3E8FF", // pastel lavender
      "#E6F9F0", // aqua mint
      "#FFFDE7", // pale lemon
      "#FFEBCD", // peach puff light
    ],
    retro: [
      "#FFF4E6", // warm cream base
      "#FFD39A", // faded orange highlight
      "#FFB86C", // vintage orange
      "#E3C29B", // muted beige
      "#C19A6B", // classic brown-tan
      "#A57B5B", // muted cocoa
      "#8B5E3C", // retro deep brown
      "#6E4B3A", // earthy shadow
      "#4A321F", // ink brown
      "#2C1A0E", // darkest retro
    ],
    anime: [
      "#0D0D0D", // base black
      "#181820", // deep gray
      "#232333", // overlay card
      "#FF3B30", // anime red
      "#FF9A8F", // peach-pink accent
      "#FFD700", // star yellow
      "#4ADE80", // neon green highlight
      "#38BDF8", // bright sky blue
      "#C084FC", // violet accent
      "#FFFFFF", // white ink
    ],
  };

  // const themePatternPresets: Record<Theme, Texture[]> = {
  //   neutral: [
  //     {
  //       name: "Paper Grid",
  //       style: "url('https://www.transparenttextures.com/patterns/grid-me.png')",
  //     },
  //     {
  //       name: "Tiny Grid",
  //       style: "url(' https://www.transparenttextures.com/patterns/tiny-grid.png')",
  //     },
  //     {
  //       name: "Tiny Grid",
  //       style: "url('https://www.transparenttextures.com/patterns/3px-tile.png')",
  //     },
  //     {
  //       name: "Tiny Grid",
  //       style: "url(' https://www.transparenttextures.com/patterns/tiny-grid.png')",
  //     },
  //     {
  //       name: "Tiny Grid",
  //       style: "url(' https://www.transparenttextures.com/patterns/tiny-grid.png')",
  //     },

  //   ],
  //   kawaii: [
  //     {
  //       name: "Paint",
  //       style: "url('https://www.transparenttextures.com/patterns/paint.png')",
  //     },
  //     {
  //       name: "Brush",
  //       style: "url('https://www.transparenttextures.com/patterns/brush.png')",
  //     },
  //   ],
  //   retro: [
  //     {
  //       name: "Dark Grid",
  //       style:
  //         "url('https://www.transparenttextures.com/patterns/dark-mosaic.png')",
  //     },
  //     {
  //       name: "Asfalt",
  //       style:
  //         "url('https://www.transparenttextures.com/patterns/asfalt-dark.png')",
  //     },
  //   ],
  //   anime: [
  //     {
  //       name: "Polka Dots",
  //       style:
  //         "url('https://www.transparenttextures.com/patterns/polka-dots.png')",
  //     },
  //     {
  //       name: "Skulls",
  //       style: "url('https://www.transparenttextures.com/patterns/skulls.png')",
  //     },
  //   ],
  // };

  const onColorChange = (color: string) => {
    setBackground((prev) => ({ ...prev, color }));
  };

  const onImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setBackground((prev) => ({ ...prev, image: base64 }));
      };
      reader.readAsDataURL(file);
    }
  };

  const onPatternChange = (pattern?: Pattern) => {
    setBackground((prev) => ({ ...prev, pattern }));
  };

  const onTextureChange = (texture?: Pattern) => {
    setBackground((prev) => ({ ...prev, texture }));
  };

  const resetBackground = () => {
    setBackground({});
    setOpen(false);
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // const onColorChangeBg = (newColor: string) => {
  //   setBackground((prev) => ({ ...prev, color: newColor }));
  // };
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };
  const [showColorPicker, setShowColorPicker] = React.useState(false);
  return (
    // <Popup
    //   trigger={
    //     <button aria-label="Select background" className={triggerButtonClass}>
    //       <BackgroundIcon size={18} />
    //     </button>
    //   }
    //   position="top center"
    //   closeOnDocumentClick
    //   arrow={false}
    //   contentStyle={{
    //     padding: "1rem",
    //     borderRadius: "0.5rem",
    //     boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    //     maxWidth: "280px",
    //   }}
    //   open={open}
    //   onOpen={() => setOpen(true)}
    //   onClose={() => setOpen(false)}
    // >
    //   <div
    //     className={clsx(
    //       "flex flex-col gap-4 p-2 rounded-lg",
    //       themeConfig[theme].panel
    //     )}
    //   >
    //     {/* Solid Color */}
    //     <div>
    //       <p className="text-sm font-semibold mb-1">Solid Color</p>
    //       <div className="flex gap-2 mb-2">
    //         {themePresetColors[theme]?.map((color) => (
    //           <div
    //             key={color}
    //             onClick={() => onColorChange(color)}
    //             className={clsx(
    //               "w-7 h-7 rounded-full cursor-pointer transition-all",
    //               background.color === color
    //                 ? "ring-2 ring-[var(--color-primary)]"
    //                 : "hover:ring-2 hover:ring-[var(--color-border-emphasis)]"
    //             )}
    //             style={{ backgroundColor: color }}
    //             title={color}
    //           />
    //         ))}
    //       </div>
    //       <input
    //         type="color"
    //         value={background.color || "#ffffff"}
    //         onChange={(e) => onColorChange(e.target.value)}
    //         className="w-20 h-8 p-0 border-none cursor-pointer"
    //       />
    //     </div>

    //     {/* Pattern */}
    //     <div>
    //       <p className="text-xs font-medium mb-2 text-[var(--color-ink-soft)] uppercase tracking-wide">
    //         Pattern
    //       </p>
    //       <div className="flex gap-2">
    //         <button
    //           onClick={() => onPatternChange(undefined)}
    //           className={clsx(
    //             tileButtonClass,
    //             "flex items-center justify-center text-xl font-bold",
    //             background.pattern === undefined
    //               ? "border-[var(--color-border-emphasis)]"
    //               : "hover:border-[var(--color-border-emphasis)]",
    //             "text-[var(--color-ink-strong)]"
    //           )}
    //           title="None"
    //         >
    //           ❌
    //         </button>
    //         {themePatternPresets[theme].map(({ name, style }) => (
    //           <button
    //             key={name}
    //             onClick={() => onPatternChange(style)}
    //             className={clsx(
    //               tileButtonClass,
    //               background.pattern === style
    //                 ? "border-[var(--color-border-emphasis)]"
    //                 : "hover:border-[var(--color-border-emphasis)]"
    //             )}
    //             title={name}
    //             style={{
    //               backgroundImage: style,
    //               backgroundSize: "20px 20px",
    //               backgroundRepeat: "repeat",
    //               backgroundPosition: "0 0",
    //             }}
    //           />
    //         ))}
    //       </div>
    //     </div>

    //     {/* Background Image */}
    //     <div>
    //       <p className="text-sm font-semibold mb-1">Background Image</p>
    //       <div className="flex items-center gap-2">
    //         <button
    //           type="button"
    //           onClick={triggerFileInput}
    //           className={primaryActionClass}
    //         >
    //           Upload Image
    //         </button>
    //         <button
    //           type="button"
    //           onClick={() =>
    //             setBackground((prev) => ({ ...prev, image: undefined }))
    //           }
    //           className={neutralActionClass}
    //           title="Remove Image"
    //         >
    //           ❌
    //         </button>
    //       </div>
    //       <input
    //         type="file"
    //         accept="image/*"
    //         onChange={onImageChange}
    //         ref={fileInputRef}
    //         className="hidden"
    //       />
    //     </div>

    //     {/* Texture */}
    //     <div>
    //       <p className="text-sm font-semibold mb-1">Texture</p>
    //       <div className="flex gap-2">
    //         <button
    //           onClick={() => onTextureChange(undefined)}
    //           className={clsx(
    //             neutralActionClass,
    //             "text-xs font-bold",
    //             background.texture === undefined
    //               ? "border-[var(--color-border-emphasis)]"
    //               : "hover:border-[var(--color-border-emphasis)]",
    //             "text-[var(--color-ink-strong)]"
    //           )}
    //           title="None"
    //         >
    //           ❌
    //         </button>
    //         {getThemeTexturePresets[theme].map(({ name, style }) => (
    //           <button
    //             key={name}
    //             onClick={() => onTextureChange(style)}
    //             className={clsx(
    //               neutralActionClass,
    //               "text-xs",
    //               background.texture === style
    //                 ? "border-[var(--color-border-emphasis)]"
    //                 : "hover:border-[var(--color-border-emphasis)]"
    //             )}
    //             title={name}
    //             style={{
    //               backgroundImage: style,
    //               backgroundSize: "auto",
    //               backgroundRepeat: "repeat",
    //             }}
    //           >
    //             {name}
    //           </button>
    //         ))}
    //       </div>
    //     </div>

    //     <button
    //       onClick={resetBackground}
    //       className={clsx("mt-2", primaryActionClass)}
    //     >
    //       Reset Background
    //     </button>
    //   </div>
    // </Popup>
    <Popup
      className="bg-popup"
      trigger={
        <button aria-label="Select background" className={triggerButtonClass}>
          <BackgroundIcon size={18} />
        </button>
      }
      position="top center"
      closeOnDocumentClick
      arrow={false}
      contentStyle={{
        padding: "1.2rem 1.25rem",
        borderRadius: "var(--radius-popup)", // 👈 uses theme token
        background: "var(--popup-bg)",
        backdropFilter: "blur(18px)",
        boxShadow: "var(--popup-shadow)",
        border: "var(--popup-border)",
      }}
      offsetY={20}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
    >
      {/* <div className="!h-6"></div> */}
      <div className={clsx("flex flex-col gap-3 ")}>
        {/* First row: Upload, color swatches, color picker, reset */}
        <div className="flex items-center justify-between">
          {/* Upload Image button */}
          {/* <button
            type="button"
            onClick={triggerFileInput}
            className={clsx(
              "ml-auto p-2 flex items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-ink-soft)] bg-transparent hover:bg-[var(--color-surface-base)] transition"
            )}
            title="Upload Background Image"
          >
            <LucideImage size={18} />
          </button> */}
          {/* Always show upload image button */}
          <button
            type="button"
            onClick={triggerFileInput}
            className={clsx(
              "p-2 flex items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-ink-soft)] bg-transparent hover:bg-[var(--color-surface-base)] transition"
            )}
            title="Upload Background Image"
          >
            <LucideImage size={18} />
          </button>
          {/* Conditionally show remove button if image exists */}
          {background.image && (
            <button
              onClick={() =>
                setBackground((prev) => ({ ...prev, image: undefined }))
              }
              className={clsx(
                "relative w-9 h-9 rounded-full cursor-pointer transition-all mx-0.5 flex items-center justify-center bg-white overflow-hidden",
                "border border-[var(--color-border-subtle)] hover:border-[var(--color-primary)]"
              )}
              title="Remove Background Image"
              type="button"
            >
              <span className="absolute w-[140%] h-[2px] bg-red-500 rotate-45"></span>
            </button>
          )}
          <div className="flex items-center gap-1">
            <input
              type="file"
              accept="image/*"
              onChange={onImageChange}
              ref={fileInputRef}
              className="hidden"
            />
            {/* Color swatches */}
            {themePresetColors[theme]?.map((color) => {
              const selected = background.color === color;
              return (
                <button
                  key={color}
                  onClick={() => onColorChange(color)}
                  className={clsx(
                    "w-9 h-9 rounded-full cursor-pointer transition-all mx-0.5 bg-transparent",
                    selected
                      ? "ring-1 ring-[var(--color-primary)] shadow border border-[var(--color-primary)]"
                      : "border border-[var(--color-border-subtle)] hover:border-[var(--color-primary)]"
                  )}
                  style={{
                    backgroundColor: color,
                  }}
                  title={color}
                  type="button"
                />
              );
            })}
            {/* Color picker trigger */}
            <button
              type="button"
              onClick={() => setShowColorPicker((v) => !v)}
              className={clsx(
                "w-9 h-9 rounded-full flex items-center justify-center transition-all mx-0.5 border-2 border-[var(--color-border-subtle)] bg-gradient-to-br from-pink-400 via-yellow-400 to-blue-400",
                showColorPicker
                  ? "ring-1 ring-[var(--color-primary)] shadow"
                  : "hover:ring-1 hover:ring-[var(--color-border-emphasis)]"
              )}
              style={{
                background:
                  "conic-gradient(red, orange, yellow, lime, cyan, blue, violet, red)",
              }}
              title="Pick a custom color"
            >
              {/* <LucideRainbow size={16} /> */}
            </button>
          </div>
          {/* Reset button at end */}
          <button
            type="button"
            onClick={resetBackground}
            className={clsx(
              "p-2 flex items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[var(--color-ink-soft)] bg-transparent hover:bg-[var(--color-surface-base)] transition"
            )}
            title="Reset background"
          >
            <Zap size={18} />
          </button>
        </div>
        {/* Color picker popover (appear below row if triggered) */}
        {showColorPicker && (
          <div className="flex flex-row items-center gap-2 mb-1">
            <HexAlphaColorPicker
              color={background.color || "#ffffff"}
              onChange={onColorChange}
              style={{ width: 160, height: 80 }}
            />
            <input
              type="text"
              value={background.color || "#ffffff"}
              onChange={(e) => onColorChange(e.target.value)}
              className="w-20 h-8 rounded-md border border-[var(--color-border-subtle)] shadow-sm text-center ml-2"
              spellCheck={false}
              autoComplete="off"
              maxLength={9}
              title="Hex color"
            />
          </div>
        )}
        {/* Second row: texture thumbnails */}
        <div className="flex items-center gap-2 mt-1">
          {/* No Texture option */}

          {/* Texture presets */}
          {/* {getThemeTexturePresets(theme).map((tex) => {
            const selected = background.texture?.name === tex.name;
            return (
              <button
                key={tex.name}
                onClick={() =>
                  setBackground((prev) => ({ ...prev, texture: tex }))
                }
                className={clsx(
                  "w-9 h-9 cursor-pointer transition-all mx-0.5",
                  selected
                    ? "ring-1 ring-[var(--color-primary)] shadow border border-[var(--color-primary)]"
                    : "border border-[var(--color-border-subtle)] hover:border-[var(--color-primary)]"
                )}
                style={{
                  backgroundImage: tex.style,
                  backgroundColor: tex.color || "transparent",
                  backgroundBlendMode: tex.blend || "normal",
                  backgroundSize: "32px 32px",
                }}
                title={tex.name}
                type="button"
              />
            );
          })} */}
          {getThemeTexturePresets(theme).map((tex) => {
            const selected = background.texture?.name === tex.name;
            const bgStyle = tex.style(theme);

            return (
              <button
                key={tex.name}
                onClick={() => {
                  console.log("[CanvasBoard] Texture clicked:", tex.name, tex);
                  setBackground((prev) => ({ ...prev, texture: tex }));
                }}
                className={clsx(
                  "w-9 h-9 cursor-pointer transition-all mx-0.5",
                  selected
                    ? "ring-1 ring-[var(--color-primary)] shadow border border-[var(--color-primary)]"
                    : "border border-[var(--color-border-subtle)] hover:border-[var(--color-primary)]"
                )}
                style={{
                  backgroundImage: bgStyle,
                  backgroundColor: tex.color || "transparent",
                  backgroundBlendMode: tex.blend || "normal",
                  backgroundSize: "32px 32px",
                }}
                title={tex.name}
                type="button"
              />
            );
          })}
          <button
            onClick={() => {
              console.log("[CanvasBoard] Texture cleared");
              setBackground((prev) => ({ ...prev, texture: undefined }));
            }}
            className={clsx(
              "relative w-9 h-9 cursor-pointer transition-all mx-0.5 flex items-center justify-center bg-white overflow-hidden",
              !background.texture
                ? "ring-1 ring-[var(--color-primary)] shadow border border-[var(--color-primary)]"
                : "border border-[var(--color-border-subtle)] hover:border-[var(--color-primary)]"
            )}
            title="No Texture"
            type="button"
          >
            {/* Full diagonal slash */}
            <span className="absolute w-[140%] h-[2px] bg-red-500 rotate-45"></span>
          </button>
        </div>
      </div>
      {/* <div className="!h-10"></div> */}
    </Popup>
    // State for color picker popup in BackgroundPopup
  );
};

type AudioPopupProps = {
  theme: Theme;
  onAddAudio: (src: string, title?: string, artist?: string) => void;
};

const AudioPopup: React.FC<AudioPopupProps> = ({ theme, onAddAudio }) => {
  const [open, setOpen] = React.useState(false);
  // Use the music icon for toolbar trigger and modal
  const MusicIcon = themeConfig[theme].micIcon;
  // Recording state and refs for MediaRecorder
  const [isRecording, setIsRecording] = React.useState(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);

  const handleMicClick = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const url = URL.createObjectURL(blob);
          onAddAudio(url, "Recording");
          stream.getTracks().forEach((t) => t.stop());
        };
        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Microphone access denied:", err);
      }
    } else {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    }
  };

  return (
    <Popup
      trigger={
        <button
          aria-label="Add music"
          className={clsx(
            "flex items-center justify-center rounded-full p-3 transition",
            themeConfig[theme].button,
            themeConfig[theme].hover
          )}
          type="button"
        >
          <MusicIcon size={18} />
        </button>
      }
      position="top center"
      closeOnDocumentClick
      arrow={false}
      contentStyle={{
        padding: "1.25rem",
        borderRadius: "0.75rem",
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(18px)", // 👈 glassy Apple look
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        maxWidth: "320px",
      }}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
    >
      <div
        className={clsx(
          "flex flex-col items-center justify-center gap-3 p-4 rounded-lg",
          themeConfig[theme].panel
        )}
      >
        <button
          type="button"
          onClick={handleMicClick}
          className={clsx(
            "rounded-full w-16 h-16 flex items-center justify-center transition",
            themeConfig[theme].button,
            themeConfig[theme].hover,
            isRecording &&
              "ring-4 ring-[var(--color-primary)] animate-pulse text-[var(--color-ink)]"
          )}
          title={isRecording ? "Stop recording" : "Record audio"}
        >
          {isRecording ? "⏹" : <MusicIcon size={28} />}
        </button>
        <span className="text-sm opacity-80">Record your thoughts</span>
      </div>
    </Popup>
  );
};

const CanvasBoard: React.FC<CanvasBoardProps> = ({
  storageKey,
  initialBackground,
  onSnapshotChange,
  initialSnapshot,
}) => {
  // --- Global floating audio player state ---
  const [globalAudio, setGlobalAudio] = React.useState<{
    videoId: string;
    title: string;
    thumbnail?: string;
    channelTitle?: string;
    artist?: string;
  } | null>(null);
  const [theme, setTheme] = React.useState<Theme>("neutral");
  const [background, setBackground] = React.useState<CanvasBackgroundState>({});
  const [isHydrated, setIsHydrated] = React.useState(false);
  const snapshotComparableRef = React.useRef<string | null>(null);
  const hydratedFromTemplateRef = React.useRef(false);

  // Text elements state
  const [textElements, setTextElements] = React.useState<TextElement[]>([]);
  // Sticky notes state
  const [stickyNotes, setStickyNotes] = React.useState<StickyNoteElement[]>([]);
  const [selectedStickyId, setSelectedStickyId] = React.useState<string | null>(
    null
  );
  // Add a new sticky note at default position
  const addStickyNote = () => {
    const newId = `sticky-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const offset = stickyNotes.length * 30;
    const newEl: StickyNoteElement = {
      id: newId,
      text: "Write something...",
      color: "#fff475", // Google Keep yellow
      fontSize: 18,
      bold: false,
      x: 180 + offset,
      y: 100 + offset,
      rotation: Math.round((Math.random() - 0.5) * 10), // -5 to +5 deg
    };
    setStickyNotes((prev) => [...prev, newEl]);
    setSelectedStickyId(newId);
    setSelectedTextId(null);
    setSelectedImageId(null);
  };

  // Handler for dragging sticky notes
  const handleStickyDragStart = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    id: string
  ) => {
    e.stopPropagation();
    setSelectedStickyId(id);
    setSelectedTextId(null);
    setSelectedImageId(null);

    const el = stickyNotes.find((el) => el.id === id);
    if (!el) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = el.x;
    const origY = el.y;
    const onMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setStickyNotes((prev) =>
        prev.map((elem) =>
          elem.id === id ? { ...elem, x: origX + dx, y: origY + dy } : elem
        )
      );
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Handler to update sticky note by id
  const updateStickyNoteById = (
    id: string,
    updates: Partial<StickyNoteElement>
  ) => {
    setStickyNotes((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...updates } : el))
    );
  };

  // Handler to delete sticky note by id
  const deleteStickyNoteById = (id: string) => {
    setStickyNotes((prev) => prev.filter((el) => el.id !== id));
    if (selectedStickyId === id) setSelectedStickyId(null);
  };
  // Image elements state
  const [imageElements, setImageElements] = React.useState<ImageElement[]>([]);
  // New: Add image element
  const addImageElement = (src: string) => {
    const newId = `img-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    // Default size: 160x160, default x/y center-ish, offset if multiple
    const offset = imageElements.length * 30;
    const now = new Date();
    // Format date as "Aug 8, 2025"
    const dateStr = now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    // Format time as "3:45 PM"
    const timeStr = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const newEl: ImageElement = {
      id: newId,
      src,
      x: 220 + offset,
      y: 120 + offset,
      width: 160,
      height: 160,
      rotation: 0,
      zIndex: 10 + imageElements.length,
      opacity: 1,
      frame: undefined,
      texture: undefined,
      flip: false,
      dateStamp: dateStr,
      timeStamp: timeStr,
    };
    setImageElements((prev) => [...prev, newEl]);
    setSelectedImageId(newId);
  };
  // Image element selection
  const [selectedImageId, setSelectedImageId] = React.useState<string | null>(
    null
  );
  // Handler for dragging image elements
  const handleImageDragStart = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    id: string
  ) => {
    e.stopPropagation();
    setSelectedImageId(id);
    const el = imageElements.find((el) => el.id === id);
    if (!el) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = el.x;
    const origY = el.y;
    const onMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setImageElements((prev) =>
        prev.map((elem) =>
          elem.id === id ? { ...elem, x: origX + dx, y: origY + dy } : elem
        )
      );
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Handler to resize image element (bottom-left handle)
  const handleImageResizeStart = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    id: string
  ) => {
    e.stopPropagation();
    setSelectedImageId(id);
    const el = imageElements.find((el) => el.id === id);
    if (!el) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origWidth = el.width;
    const origHeight = el.height;
    const origX = el.x;
    const origY = el.y;
    const onMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      let newWidth = origWidth - dx;
      let newHeight = origHeight + dy;
      let newX = origX + dx;
      if (newWidth < 32) {
        newX -= 32 - newWidth;
        newWidth = 32;
      }
      if (el.frame === "polaroid") {
        // Enforce 1:1 aspect ratio for polaroid frame
        newHeight = newWidth;
      } else {
        if (newHeight < 32) newHeight = 32;
      }
      setImageElements((prev) =>
        prev.map((elem) =>
          elem.id === id
            ? { ...elem, width: newWidth, height: newHeight, x: newX }
            : elem
        )
      );
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Handler to rotate image element (bottom-right handle)
  const handleImageRotateStart = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    id: string
  ) => {
    e.stopPropagation();
    setSelectedImageId(id);
    const el = imageElements.find((el) => el.id === id);
    if (!el) return;
    const parent = (e.target as HTMLElement).parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const startX = e.clientX;
    const startY = e.clientY;
    const dx = startX - centerX;
    const dy = startY - centerY;
    const initialAngle = Math.atan2(dy, dx) * (180 / Math.PI);
    const startRotation = el.rotation;
    const onMove = (moveEvent: MouseEvent) => {
      const mx = moveEvent.clientX;
      const my = moveEvent.clientY;
      const mdx = mx - centerX;
      const mdy = my - centerY;
      const angle = Math.atan2(mdy, mdx) * (180 / Math.PI);
      let delta = angle - initialAngle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      const newRotation = startRotation + delta;
      setImageElements((prev) =>
        prev.map((elem) =>
          elem.id === id ? { ...elem, rotation: newRotation } : elem
        )
      );
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Handler to update image element by id
  const updateImageElementById = (
    id: string,
    updates: Partial<ImageElement>
  ) => {
    setImageElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...updates } : el))
    );
  };

  // Handler to delete image element by id
  const deleteImageElementById = (id: string) => {
    setImageElements((prev) => prev.filter((el) => el.id !== id));
    if (selectedImageId === id) setSelectedImageId(null);
  };

  // Handler to bring forward/backward (zIndex)
  const changeImageZIndex = (id: string, dir: "up" | "down") => {
    setImageElements((prev) => {
      const idx = prev.findIndex((el) => el.id === id);
      if (idx === -1) return prev;
      let arr = [...prev];
      if (dir === "up" && idx < arr.length - 1) {
        [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      } else if (dir === "down" && idx > 0) {
        [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]];
      }
      // Reassign zIndex
      arr = arr.map((el, z) => ({ ...el, zIndex: 10 + z }));
      return arr;
    });
  };

  // --- Sticker elements state and handlers ---
  const [stickerElements, setStickerElements] = React.useState<
    StickerElement[]
  >([]);
  const [selectedStickerId, setSelectedStickerId] = React.useState<
    string | null
  >(null);

  // Add sticker element (from file or src)
  const addStickerElement = (src: string) => {
    const newId = `sticker-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const offset = stickerElements.length * 30;
    const newEl: StickerElement = {
      id: newId,
      src,
      x: 250 + offset,
      y: 130 + offset,
      width: 100,
      height: 100,
      rotation: 0,
      zIndex: 20 + stickerElements.length,
    };
    setStickerElements((prev) => [...prev, newEl]);
    setSelectedStickerId(newId);
    setSelectedTextId(null);
    setSelectedImageId(null);
    setSelectedStickyId(null);
  };

  // Handler for dragging stickers
  const handleStickerDragStart = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    id: string
  ) => {
    e.stopPropagation();
    setSelectedStickerId(id);
    setSelectedTextId(null);
    setSelectedImageId(null);
    setSelectedStickyId(null);
    const el = stickerElements.find((el) => el.id === id);
    if (!el) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = el.x;
    const origY = el.y;
    const onMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setStickerElements((prev) =>
        prev.map((elem) =>
          elem.id === id ? { ...elem, x: origX + dx, y: origY + dy } : elem
        )
      );
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Handler to resize sticker (bottom-left handle)
  const handleStickerResizeStart = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    id: string
  ) => {
    e.stopPropagation();
    setSelectedStickerId(id);
    setSelectedTextId(null);
    setSelectedImageId(null);
    setSelectedStickyId(null);
    const el = stickerElements.find((el) => el.id === id);
    if (!el) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origWidth = el.width;
    const origHeight = el.height;
    const origX = el.x;
    const origY = el.y;
    const onMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      let newWidth = origWidth - dx;
      let newHeight = origHeight + dy;
      let newX = origX + dx;
      if (newWidth < 32) {
        newX -= 32 - newWidth;
        newWidth = 32;
      }
      if (newHeight < 32) newHeight = 32;
      setStickerElements((prev) =>
        prev.map((elem) =>
          elem.id === id
            ? { ...elem, width: newWidth, height: newHeight, x: newX }
            : elem
        )
      );
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Handler to rotate sticker (bottom-right handle)
  const handleStickerRotateStart = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    id: string
  ) => {
    e.stopPropagation();
    setSelectedStickerId(id);
    setSelectedTextId(null);
    setSelectedImageId(null);
    setSelectedStickyId(null);
    const el = stickerElements.find((el) => el.id === id);
    if (!el) return;
    const parent = (e.target as HTMLElement).parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const startX = e.clientX;
    const startY = e.clientY;
    const dx = startX - centerX;
    const dy = startY - centerY;
    const initialAngle = Math.atan2(dy, dx) * (180 / Math.PI);
    const startRotation = el.rotation;
    const onMove = (moveEvent: MouseEvent) => {
      const mx = moveEvent.clientX;
      const my = moveEvent.clientY;
      const mdx = mx - centerX;
      const mdy = my - centerY;
      const angle = Math.atan2(mdy, mdx) * (180 / Math.PI);
      let delta = angle - initialAngle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      const newRotation = startRotation + delta;
      setStickerElements((prev) =>
        prev.map((elem) =>
          elem.id === id ? { ...elem, rotation: newRotation } : elem
        )
      );
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Handler to update sticker element by id
  const updateStickerElementById = (
    id: string,
    updates: Partial<StickerElement>
  ) => {
    setStickerElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...updates } : el))
    );
  };

  // Handler to delete sticker by id
  const deleteStickerElementById = (id: string) => {
    setStickerElements((prev) => prev.filter((el) => el.id !== id));
    if (selectedStickerId === id) setSelectedStickerId(null);
  };
  // --- Audio elements state and handlers ---
  const [audioElements, setAudioElements] = React.useState<AudioElement[]>([]);
  const [selectedAudioId, setSelectedAudioId] = React.useState<string | null>(
    null
  );

  // Add a new audio element
  const addAudioElement = (src: string, title?: string, artist?: string) => {
    const newId = `audio-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const offset = audioElements.length * 30;
    const newEl: AudioElement = {
      id: newId,
      src,
      title,
      artist,
      x: 300 + offset,
      y: 200 + offset,
      zIndex: 100 + audioElements.length,
      playing: false,
    };
    setAudioElements((prev) => [...prev, newEl]);
    setSelectedAudioId(newId);
    setSelectedTextId(null);
    setSelectedImageId(null);
    setSelectedStickyId(null);
    setSelectedStickerId(null);
  };

  // Handler for dragging audio elements
  const handleAudioDragStart = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    id: string
  ) => {
    e.stopPropagation();
    setSelectedAudioId(id);
    setSelectedTextId(null);
    setSelectedImageId(null);
    setSelectedStickyId(null);
    setSelectedStickerId(null);
    const el = audioElements.find((el) => el.id === id);
    if (!el) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = el.x;
    const origY = el.y;
    const onMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setAudioElements((prev) =>
        prev.map((elem) =>
          elem.id === id ? { ...elem, x: origX + dx, y: origY + dy } : elem
        )
      );
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Toggle play/pause for audio element
  const toggleAudioPlay = (id: string) => {
    setAudioElements((prev) =>
      prev.map((el) => {
        if (el.id === id) {
          // Toggle playing state
          const newPlaying = !el.playing;
          // Play/pause the audio tag
          const audioTag = document.getElementById(
            `audio-${id}`
          ) as HTMLAudioElement | null;
          if (audioTag) {
            if (newPlaying) {
              audioTag.play();
            } else {
              audioTag.pause();
            }
          }
          return { ...el, playing: newPlaying };
        } else {
          // Pause others
          const audioTag = document.getElementById(
            `audio-${el.id}`
          ) as HTMLAudioElement | null;
          if (audioTag) audioTag.pause();
          return { ...el, playing: false };
        }
      })
    );
  };

  // Handler to delete audio element by id
  const deleteAudioElementById = (id: string) => {
    setAudioElements((prev) => prev.filter((el) => el.id !== id));
    if (selectedAudioId === id) setSelectedAudioId(null);
  };

  // Add a new text element at default position
  const addTextElement = () => {
    const defaultFont = fontsByTheme[theme][0];
    const newId = `text-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    // Default position: center-ish, but offset if multiple
    const offset = textElements.length * 30;
    const newEl: TextElement = {
      id: newId,
      text: "New Text",
      fontSize: 32,
      fontFamily: defaultFont,
      bold: false,
      italic: false,
      align: "center",
      curve: false,
      x: 200 + offset,
      y: 150 + offset,
      rotation: 0,
      isEditing: false,
    };
    setTextElements((prev) => [...prev, newEl]);
    setSelectedTextId(newId);
  };

  // Handler for dragging text elements
  const handleDragStart = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    id: string
  ) => {
    e.stopPropagation();
    setSelectedTextId(id);
    const el = textElements.find((el) => el.id === id);
    if (!el) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = el.x;
    const origY = el.y;
    const onMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setTextElements((prev) =>
        prev.map((elem) =>
          elem.id === id ? { ...elem, x: origX + dx, y: origY + dy } : elem
        )
      );
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Handler to rotate text element
  const rotateSelectedText = (delta: number) => {
    if (!selectedTextId) return;
    setTextElements((prev) =>
      prev.map((el) =>
        el.id === selectedTextId ? { ...el, rotation: el.rotation + delta } : el
      )
    );
  };

  // Handler to delete selected text element or by id
  const deleteSelectedText = () => {
    if (!selectedTextId) return;
    setTextElements((prev) => prev.filter((el) => el.id !== selectedTextId));
    setSelectedTextId(null);
  };
  // Handler to delete text element by id
  const deleteTextElementById = (id: string) => {
    setTextElements((prev) => prev.filter((el) => el.id !== id));
    if (selectedTextId === id) setSelectedTextId(null);
  };
  // Handler to clear the entire canvas (all text elements, sticky notes, and background)
  const clearCanvas = () => {
    setTextElements([]);
    setStickyNotes([]);
    setBackground({});
  };
  const [selectedTextId, setSelectedTextId] = React.useState<string | null>(
    null
  );

  const injectedDefaultsRef = React.useRef(false);
  // Preload default YouTube tracks if canvas has none after hydration
  useEffect(() => {
    if (!isHydrated) return;
    if (hydratedFromTemplateRef.current) return;
    if (injectedDefaultsRef.current) return;
    if (audioElements.length > 0) return;

    const defaults = [
      { videoId: "n61ULEU7CO0", title: "Best of Lofi Hip Hop 2021" },
      { videoId: "qSqqvhjNet4", title: "Romantic Lofi Mashup" },
      { videoId: "t8yVk0bm684", title: "1 Hour Hindi Lofi Songs" },
      { videoId: "zzclUJ5oxns", title: "Bolero Lofi Classics" },
      { videoId: "pVXKoic5vL0", title: "Lost in Midnight Glow" },
    ].map(({ videoId, title }, index) => ({
      id: `audio-default-${index}`,
      src: `https://www.youtube.com/embed/${videoId}?autoplay=0`,
      title,
      artist: undefined,
      x: 300 + index * 30,
      y: 200 + index * 30,
      zIndex: 100 + index,
      playing: false,
    }));

    setAudioElements(defaults);
    injectedDefaultsRef.current = true;
    console.debug("[CanvasBoard] Injected default audio tracks", {
      storageKey,
      count: defaults.length,
    });
  }, [audioElements.length, isHydrated, setAudioElements, storageKey]);
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
      console.log("Theme applied:", theme);
    }
  }, [theme]);

useEffect(() => {
  const themePresetColors: Record<Theme, string[]> = {
    neutral: ["#ffffff","#f9fafb","#f3f4f6","#e5e7eb","#d1d5db","#9ca3af","#6b7280","#4b5563","#374151","#1f2937","#111827"],
    kawaii: ["#FFE4EE","#FFD6EC","#FFF0F8","#E3F2FD","#F0FFF0","#FFF9E6","#F3E8FF","#E6F9F0","#FFFDE7","#FFEBCD"],
    retro: ["#FFF4E6","#FFD39A","#FFB86C","#E3C29B","#C19A6B","#A57B5B","#8B5E3C","#6E4B3A","#4A321F","#2C1A0E"],
    anime: ["#0D0D0D","#181820","#232333","#FF3B30","#FF9A8F","#FFD700","#4ADE80","#38BDF8","#C084FC","#FFFFFF"],
  };

  const defaultColor = themePresetColors[theme]?.[0] || "#ffffff";
  const presets = getThemeTexturePresets(theme);
  const defaultTexture = presets[0] ?? undefined;

  console.log("[CanvasBoard] Theme switched → resetting background", {
    theme,
    defaultColor,
    defaultTexture,
  });

  setBackground({
    color: defaultColor,
    texture: defaultTexture,
  });
}, [theme]);
  // Handler to update properties of the selected text element
  const updateSelectedText = (updates: Partial<TextElement>) => {
    setTextElements((prev) =>
      prev.map((el) => (el.id === selectedTextId ? { ...el, ...updates } : el))
    );
  };
  // Handler to update a text element by id
  const updateTextElementById = (id: string, updates: Partial<TextElement>) => {
    setTextElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...updates } : el))
    );
  };

  const CurrentIcons = iconSets[theme];
  const backgroundIconComponent = themeConfig[theme].backgroundIcon;
  const textIconComponent = themeConfig[theme].textIcon;
  const TextIcon = textIconComponent;
  const StickyIcon = themeConfig[theme].stickyIcon;
  const toolbarButtonClass = clsx(
    "flex items-center justify-center rounded-full p-3 transition",
    themeConfig[theme].button,
    themeConfig[theme].hover
  );
  const toolbarSmallButton = clsx(
    "px-2 py-1 rounded text-xs transition",
    themeConfig[theme].button,
    themeConfig[theme].hover
  );
  const toolbarSmallGhost = clsx(
    "px-2 py-1 rounded text-xs transition border border-[var(--color-border-subtle)]",
    themeConfig[theme].panel,
    themeConfig[theme].hover
  );
  const floatingToolbarClass = clsx(
    "absolute left-1/2 -translate-x-1/2 -top-12 z-50 flex gap-2 items-center rounded shadow-lg border border-[var(--color-border-subtle)] p-2",
    themeConfig[theme].panel
  );
  // Exclude both background and text icons for this theme
  const filteredIcons = CurrentIcons.filter(
    (Icon) => Icon !== backgroundIconComponent && Icon !== textIconComponent
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    console.debug("[CanvasBoard] Hydrating snapshot", { storageKey });
    let snapshotToEmit: CanvasSnapshot | null = null;
    let hydratedFromTemplate = false;

    try {
      const raw = window.localStorage.getItem(storageKey);
      console.debug("[CanvasBoard] Loaded raw snapshot", {
        storageKey,
        hasRaw: Boolean(raw),
      });
      if (raw) {
        const parsed = normalizeSnapshot(JSON.parse(raw));
        if (parsed) {
          setTheme(parsed.theme);
          // Preserve any existing texture if parsed.background.texture is missing
          setBackground(prev => ({
            ...prev,
            ...parsed.background,
            texture: parsed.background.texture ?? prev.texture,
          }));
          setTextElements(parsed.textElements);
          setStickyNotes(parsed.stickyNotes);
          setImageElements(parsed.imageElements);
          setStickerElements(parsed.stickerElements);
          setAudioElements(parsed.audioElements);
          setGlobalAudio(parsed.globalAudio);
          const comparable = buildComparablePayload({
            theme: parsed.theme,
            background: parsed.background,
            textElements: parsed.textElements,
            stickyNotes: parsed.stickyNotes,
            imageElements: parsed.imageElements,
            stickerElements: parsed.stickerElements,
            audioElements: parsed.audioElements,
            globalAudio: parsed.globalAudio,
          });
          snapshotComparableRef.current = serializeComparable(comparable);
          snapshotToEmit = parsed;
          console.debug("[CanvasBoard] Restored snapshot", {
            storageKey,
            updatedAt: parsed.updatedAt,
            textCount: parsed.textElements.length,
            stickyCount: parsed.stickyNotes.length,
            imageCount: parsed.imageElements.length,
          });
        }
      }
    } catch (error) {
      console.error("Failed to restore canvas snapshot", error);
    }

    if (!snapshotToEmit && initialSnapshot) {
      try {
        const snapshotClone = normalizeSnapshot(
          JSON.parse(
            JSON.stringify({
              ...initialSnapshot,
              updatedAt: Date.now(),
            })
          )
        );
        if (snapshotClone) {
          setTheme(snapshotClone.theme);
          // Preserve any existing texture if snapshotClone.background.texture is missing
          setBackground(prev => ({
            ...prev,
            ...snapshotClone.background,
            texture: snapshotClone.background.texture ?? prev.texture,
          }));
          setTextElements(snapshotClone.textElements);
          setStickyNotes(snapshotClone.stickyNotes);
          setImageElements(snapshotClone.imageElements);
          setStickerElements(snapshotClone.stickerElements);
          setAudioElements(snapshotClone.audioElements);
          setGlobalAudio(snapshotClone.globalAudio);
          const comparable = buildComparablePayload({
            theme: snapshotClone.theme,
            background: snapshotClone.background,
            textElements: snapshotClone.textElements,
            stickyNotes: snapshotClone.stickyNotes,
            imageElements: snapshotClone.imageElements,
            stickerElements: snapshotClone.stickerElements,
            audioElements: snapshotClone.audioElements,
            globalAudio: snapshotClone.globalAudio,
          });
          snapshotComparableRef.current = serializeComparable(comparable);
          snapshotToEmit = snapshotClone;
          hydratedFromTemplate = true;
          console.debug("[CanvasBoard] Applied initial template snapshot", {
            storageKey,
            updatedAt: snapshotClone.updatedAt,
          });
        }
      } catch (error) {
        console.error("Failed to apply initial snapshot", error);
      }
    }

    if (!snapshotToEmit) {
      const fallbackBackground = parseInitialBackground(initialBackground);
      if (Object.keys(fallbackBackground).length > 0) {
        setBackground(fallbackBackground);
      }
      const comparable = buildComparablePayload({
        theme: "neutral",
        background: fallbackBackground,
        textElements: [],
        stickyNotes: [],
        imageElements: [],
        stickerElements: [],
        audioElements: [],
        globalAudio: null,
      });
      snapshotComparableRef.current = serializeComparable(comparable);
      snapshotToEmit = {
        ...comparable,
        updatedAt: Date.now(),
      };
      console.debug("[CanvasBoard] Using fallback snapshot", {
        storageKey,
        fallbackBackground,
      });
    }

    hydratedFromTemplateRef.current = hydratedFromTemplate;
    setIsHydrated(true);
    if (snapshotToEmit && onSnapshotChange) {
      onSnapshotChange(snapshotToEmit);
    }
  }, [initialBackground, initialSnapshot, onSnapshotChange, storageKey]);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;

    const comparable = buildComparablePayload({
      theme,
      background,
      textElements,
      stickyNotes,
      imageElements,
      stickerElements,
      audioElements,
      globalAudio,
    });

    const serializedComparable = serializeComparable(comparable);
    if (snapshotComparableRef.current === serializedComparable) return;

    const timeout = window.setTimeout(() => {
      const snapshot: CanvasSnapshot = {
        ...comparable,
        updatedAt: Date.now(),
      };
      snapshotComparableRef.current = serializedComparable;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
      } catch (error) {
        console.error("Failed to persist canvas snapshot", error);
      }
      onSnapshotChange?.(snapshot);
      console.debug("[CanvasBoard] Persisted snapshot", {
        storageKey,
        updatedAt: snapshot.updatedAt,
        textCount: snapshot.textElements.length,
        stickyCount: snapshot.stickyNotes.length,
        imageCount: snapshot.imageElements.length,
      });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [
    audioElements,
    background,
    globalAudio,
    imageElements,
    isHydrated,
    onSnapshotChange,
    stickerElements,
    storageKey,
    stickyNotes,
    textElements,
    theme,
  ]);

  // Find the selected text element
  const selectedText = textElements.find((el) => el.id === selectedTextId);
  // Find the selected image element
  const selectedImage = imageElements.find((el) => el.id === selectedImageId);

  // Toolbar buttons
  // Build toolbar buttons, inserting Music tool before Delete/Trash
  const toolbarButtons = [
    // ...other tool buttons...
    // We'll assemble them in the render below.
  ];
  // Duplicate definition of MusicSearchPopup removed.

  return (
    <div
      className={clsx(
        "relative flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center ",
        themeConfig[theme].panel
      )}
      style={{ backgroundColor: "var(--color-background)" }}
      onClick={() => {
        setSelectedTextId(null);
        setSelectedImageId(null);
        setSelectedStickyId(null);
        setSelectedStickerId(null);
        setSelectedAudioId(null);
      }}
    >
      {/* Toolbar group removed */}
      {/* Background layers */}
      {background.color && (
        <div
          className="absolute inset-0 z-0"
          style={{ backgroundColor: background.color }}
        />
      )}
      {/* Background Image Layer */}
      {background.image && (
        <img
          src={background.image}
          alt="Background"
          className="absolute inset-0 z-0 w-full h-full object-cover select-none pointer-events-none"
          style={{
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
      )}
      {/* {background.pattern && (
        <div
          className="absolute inset-0 z-0 opacity-30"
          style={{
            backgroundImage: background.pattern,
            backgroundRepeat: "repeat",
            backgroundSize: "20px 20px",
          }}
        />
      )} */}
      {/* Texture overlay (full background) */}
      {background.texture ? (
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: background.texture.style(theme),
            backgroundColor: background.texture.color || "transparent",
            backgroundBlendMode: background.texture.blend || "normal",
            backgroundRepeat: "repeat",
            backgroundSize: background.texture.size || "auto",
            opacity: background.image ? 0.6 : 1,
          }}
        />
      ) : null}

      {/* Texture color picker (only if tintable) */}
      {background.texture?.tintable && (
        <div className="absolute bottom-16 right-4 flex items-center gap-2 bg-[var(--color-surface-card)] p-2 rounded shadow">
          <input
            type="color"
            value={background.texture.color || "#000000"}
            onChange={(e) =>
              setBackground((prev) => ({
                ...prev,
                texture: { ...prev.texture!, color: e.target.value },
              }))
            }
            className="w-10 h-8 border rounded cursor-pointer"
            title="Change texture color"
          />
          <span className="text-xs opacity-70">Texture color</span>
        </div>
      )}
      <div className="absolute top-4 right-4 flex gap-2">
        <ThemeSelector theme={theme} setTheme={setTheme} />
        <MusicSearchPopup
          theme={theme}
          addAudioElement={addAudioElement}
          setGlobalAudio={setGlobalAudio}
        />
      </div>
      {/* <p className="text-lg font-semibold">Canvas board reset</p>
      <p className="text-sm">
        The interactive canvas is temporarily disabled while we rebuild it.
      </p> */}
      {/* Render image elements (draggable, resizable, rotatable) */}
      <div
        className="relative mt-8 flex flex-col items-center"
        style={{ width: "100%", height: 400 }}
      >
        {/* Render audio elements */}
        {/* (Removed: audio <div> with <iframe> for YouTube. Audio is now only shown in popup playlist.) */}
        {/* Render sticky notes */}
        {stickyNotes.map((el) => {
          const isSelected = el.id === selectedStickyId;
          return (
            <div
              key={el.id}
              className={clsx(
                "absolute select-none transition group",
                isSelected ? "outline-2 outline-yellow-500 z-40" : "z-10"
              )}
              style={{
                left: el.x,
                top: el.y,
                width: 200,
                minHeight: 110,
                transform: `rotate(${el.rotation}deg)`,
                cursor: "move",
                zIndex: isSelected ? 40 : 10,
                boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                borderRadius: 14,
                background: el.color,
                padding: 0,
                userSelect: "none",
                transition: "box-shadow 0.2s, border 0.2s",
              }}
              onMouseDown={(e) => handleStickyDragStart(e, el.id)}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedStickyId(el.id);
                setSelectedTextId(null);
                setSelectedImageId(null);
              }}
            >
              {/* Floating toolbar */}
              {isSelected && (
                <div
                  className={floatingToolbarClass}
                  style={{
                    minWidth: 220,
                    whiteSpace: "nowrap",
                    fontFamily: "Inter, Arial, sans-serif",
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {/* Color picker */}
                  <input
                    type="color"
                    value={el.color}
                    onChange={(e) =>
                      updateStickyNoteById(el.id, { color: e.target.value })
                    }
                    style={{
                      width: 28,
                      height: 28,
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                    }}
                    title="Change color"
                  />
                  {/* Font size */}
                  <label className="flex items-center gap-1 text-xs">
                    Size
                    <input
                      type="number"
                      min={12}
                      max={48}
                      value={el.fontSize}
                      onChange={(e) =>
                        updateStickyNoteById(el.id, {
                          fontSize: Number(e.target.value),
                        })
                      }
                      className="w-10 px-1 py-0.5 border rounded"
                    />
                  </label>
                  {/* Bold */}
                  <button
                    className={clsx(
                      el.bold ? toolbarSmallButton : toolbarSmallGhost,
                      "font-bold"
                    )}
                    onClick={() =>
                      updateStickyNoteById(el.id, { bold: !el.bold })
                    }
                    title="Bold"
                    type="button"
                  >
                    B
                  </button>
                  {/* Rotate */}
                  <button
                    className={toolbarSmallGhost}
                    onClick={() =>
                      updateStickyNoteById(el.id, {
                        rotation: el.rotation + 10,
                      })
                    }
                    title="Rotate +10°"
                    type="button"
                  >
                    <RotateCw size={14} />
                  </button>
                  {/* Insert bullet pointer */}
                  <button
                    className={toolbarSmallGhost}
                    onClick={() => {
                      // Insert bullet at caret or at start if not focused
                      // For simplicity, just prepend "• " to the text
                      if (!el.text.startsWith("• ")) {
                        updateStickyNoteById(el.id, { text: "• " + el.text });
                      } else {
                        updateStickyNoteById(el.id, { text: "• " + el.text });
                      }
                    }}
                    title="Insert bullet"
                    type="button"
                  >
                    •
                  </button>
                  {/* Delete */}
                  <button
                    className={clsx(toolbarSmallButton, "font-semibold")}
                    title="Delete"
                    type="button"
                    onClick={() => deleteStickyNoteById(el.id)}
                  >
                    ✖
                  </button>
                </div>
              )}
              {/* Sticky note textarea */}
              <textarea
                value={el.text}
                onChange={(e) =>
                  updateStickyNoteById(el.id, { text: e.target.value })
                }
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedStickyId(el.id);
                  setSelectedTextId(null);
                  setSelectedImageId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    // Continue bullets if previous line is a bullet
                    e.preventDefault();
                    const textarea = e.currentTarget;
                    const value = textarea.value;
                    const start = textarea.selectionStart ?? 0;
                    const end = textarea.selectionEnd ?? 0;
                    // Find start of current line
                    const before = value.slice(0, start);
                    const after = value.slice(end);
                    // Find the start of the current line
                    const lastLineBreak = before.lastIndexOf("\n");
                    const currentLine =
                      lastLineBreak === -1
                        ? before
                        : before.slice(lastLineBreak + 1);
                    let bullet = "";
                    if (/^\s*• /.test(currentLine)) {
                      bullet = "• ";
                    }
                    // Insert newline and bullet if needed
                    const insert = "\n" + bullet;
                    const newValue = before + insert + after;
                    updateStickyNoteById(el.id, { text: newValue });
                    // Set caret after bullet
                    setTimeout(() => {
                      textarea.selectionStart = textarea.selectionEnd =
                        start + insert.length;
                    }, 0);
                  }
                }}
                className="w-full h-full block bg-transparent resize-none outline-none border-none p-4 rounded"
                style={{
                  fontSize: el.fontSize,
                  fontWeight: el.bold ? "bold" : "normal",
                  color: "#333",
                  minHeight: 70,
                  borderRadius: 14,
                  background: "none",
                  boxShadow: "none",
                  fontFamily: "Inter, Arial, sans-serif",
                  lineHeight: 1.4,
                }}
                spellCheck={false}
              />
            </div>
          );
        })}
        {imageElements
          .slice()
          .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
          .map((el) => {
            const isSelected = el.id === selectedImageId;
            // Texture overlay: use pseudo-element or absolutely positioned div
            return (
              <div
                key={el.id}
                className={clsx(
                  "absolute select-none transition group",
                  isSelected ? "outline-2 outline-blue-500 z-30" : "z-20"
                )}
                style={{
                  left: el.x,
                  top: el.y,
                  width: el.width,
                  height: el.height,
                  transform: `rotate(${el.rotation}deg)${
                    el.flip ? " scaleX(-1)" : ""
                  }`,
                  cursor: "move",
                  userSelect: "none",
                  zIndex: el.zIndex ?? 10,
                }}
                onMouseDown={(e) => handleImageDragStart(e, el.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImageId(el.id);
                  setSelectedTextId(null);
                }}
              >
                {/* Frame wrapper if specified */}
                {el.frame === "polaroid" ? (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      background: "#fff",
                      border: "2px solid #eee",
                      borderRadius: 8,
                      boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
                      padding: "8px 8px 32px 8px",
                      position: "relative",
                      boxSizing: "border-box",
                      overflow: "visible",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        height: "calc(100% - 16px)",
                        display: "block",
                      }}
                    >
                      <img
                        src={el.src}
                        alt=""
                        draggable={false}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: 4,
                          opacity: el.opacity ?? 1,
                          pointerEvents: "none",
                          filter: `${
                            el.texture ? "brightness(0.97) contrast(1.08)" : ""
                          } ${el.filter ?? ""}`,
                          transition: "box-shadow 0.2s",
                          boxShadow: el.texture
                            ? "0 4px 16px rgba(0,0,0,0.12)"
                            : undefined,
                          transform: el.flip ? "scaleX(-1)" : undefined,
                        }}
                      />
                      {/* Texture overlay (now only over img area) */}
                      {el.texture && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            pointerEvents: "none",
                            backgroundImage: el.texture,
                            backgroundBlendMode: "multiply",
                            opacity: el.opacity ?? 1,
                            borderRadius: 4,
                          }}
                        />
                      )}
                    </div>
                    {/* Date + time for polaroid frame */}
                    {(el.dateStamp || el.timeStamp) && (
                      <div
                        style={{
                          position: "absolute",
                          left: "50%",
                          bottom: 6,
                          transform: "translateX(-50%)",
                          background: "transparent",
                          fontSize: "0.85em",
                          color: "#777",
                          textAlign: "center",
                          fontFamily: "inherit",
                          userSelect: "none",
                          opacity: 0.85,
                          pointerEvents: "none",
                        }}
                        aria-disabled="true"
                      >
                        {el.dateStamp}
                        {el.dateStamp && el.timeStamp ? ", " : ""}
                        {el.timeStamp}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      position: "relative",
                    }}
                  >
                    <img
                      src={el.src}
                      alt=""
                      draggable={false}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: 4,
                        opacity: el.opacity ?? 1,
                        pointerEvents: "none",
                        filter: `${
                          el.texture ? "brightness(0.97) contrast(1.08)" : ""
                        } ${el.filter ?? ""}`,
                        transition: "box-shadow 0.2s",
                        boxShadow: el.texture
                          ? "0 4px 16px rgba(0,0,0,0.12)"
                          : undefined,
                        transform: el.flip ? "scaleX(-1)" : undefined,
                      }}
                    />
                    {/* Texture overlay */}
                    {el.texture && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          pointerEvents: "none",
                          backgroundImage: el.texture,
                          backgroundBlendMode: "multiply",
                          opacity: el.opacity ?? 1,
                          borderRadius: 4,
                        }}
                      />
                    )}
                    {/* Only date for non-polaroid images */}
                    {el.dateStamp && (
                      <div
                        style={{
                          position: "absolute",
                          left: "50%",
                          bottom: 4,
                          transform: "translateX(-50%)",
                          background: "transparent",
                          fontSize: "0.85em",
                          color: "#777",
                          textAlign: "center",
                          fontFamily: "inherit",
                          userSelect: "none",
                          opacity: 0.85,
                          pointerEvents: "none",
                        }}
                        aria-disabled="true"
                      >
                        {el.dateStamp}
                      </div>
                    )}
                  </div>
                )}
                {/* Resize handle (bottom-left) */}
                {isSelected && (
                  <div
                    className="absolute z-40 flex items-center justify-center"
                    style={{
                      left: -12,
                      bottom: -12,
                      width: 18,
                      height: 18,
                      cursor: "nwse-resize",
                      pointerEvents: "auto",
                    }}
                    onMouseDown={(e) => handleImageResizeStart(e, el.id)}
                    title="Drag to resize"
                  >
                    <div
                      className="flex h-full w-full items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] shadow transition hover:bg-[var(--color-surface-raised)]"
                      style={{
                        width: 14,
                        height: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                      }}
                    >
                      ↔️
                    </div>
                  </div>
                )}
                {/* Rotate handle (bottom-right) */}
                {isSelected && (
                  <div
                    className="absolute z-40 flex items-center justify-center"
                    style={{
                      right: -12,
                      bottom: -12,
                      width: 18,
                      height: 18,
                      cursor: "grab",
                      pointerEvents: "auto",
                    }}
                    onMouseDown={(e) => handleImageRotateStart(e, el.id)}
                    title="Drag to rotate"
                  >
                    <div
                      className="flex h-full w-full items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] shadow transition hover:bg-[var(--color-surface-raised)]"
                      style={{
                        width: 14,
                        height: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                      }}
                    >
                      <RotateCw
                        size={10}
                        className="text-[var(--color-primary)]"
                      />
                    </div>
                  </div>
                )}
                {/* Popup toolbar for selected image */}
                {isSelected && (
                  <ImagePopupToolbar
                    element={el}
                    updateElement={(updates) =>
                      updateImageElementById(el.id, updates)
                    }
                    deleteElement={() => deleteImageElementById(el.id)}
                    bringForward={() => changeImageZIndex(el.id, "up")}
                    sendBackward={() => changeImageZIndex(el.id, "down")}
                    replaceSrc={(src: string) =>
                      updateImageElementById(el.id, { src })
                    }
                    theme={theme}
                  />
                )}
              </div>
            );
          })}
        {/* Render text elements as draggable/rotatable */}
        {textElements.map((el) => {
          const isSelected = el.id === selectedTextId;
          return (
            <div
              key={el.id}
              className={clsx(
                "absolute select-none transition group",
                isSelected ? "outline-1 outline-blue-500" : ""
              )}
              style={{
                left: el.x,
                top: el.y,
                transform: `rotate(${el.rotation}deg)`,
                fontSize: el.fontSize,
                fontFamily: el.fontFamily,
                fontWeight: el.bold ? "bold" : "normal",
                fontStyle: el.italic ? "italic" : "normal",
                textAlign: el.align,
                display: "inline-block",
                cursor: el.isEditing ? "text" : "move",
                userSelect: el.isEditing ? "text" : "none",
                zIndex: isSelected ? 3 : 2,
                minWidth: 60,
                minHeight: 32,
              }}
              onMouseDown={
                el.isEditing ? undefined : (e) => handleDragStart(e, el.id)
              }
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTextId(el.id);
                setSelectedImageId(null);
                setSelectedStickyId(null);
              }}
              onDoubleClick={() => {
                updateTextElementById(el.id, { isEditing: true });
                setSelectedTextId(el.id);
              }}
            >
              {/* Close (✖) button for selected text element */}
              {isSelected && (
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    deleteTextElementById(el.id);
                  }}
                  className="absolute -top-3 -right-3 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] text-[var(--color-ink)] shadow transition hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-primary)]"
                  title="Delete text"
                  tabIndex={0}
                  style={{ fontSize: 16, lineHeight: 1 }}
                >
                  ✖
                </button>
              )}
              {/* Render input if editing, else render text */}
              {el.isEditing ? (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  autoFocus
                  spellCheck={false}
                  style={{
                    minWidth: 60,
                    minHeight: 32,
                    fontSize: el.fontSize,
                    fontFamily: el.fontFamily,
                    fontWeight: el.bold ? "bold" : "normal",
                    fontStyle: el.italic ? "italic" : "normal",
                    textAlign: el.align,
                    outline: "none",
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    margin: 0,
                    boxShadow: "none",
                    resize: "none",
                    color: "inherit",
                    whiteSpace: "pre-line",
                  }}
                  className="focus:outline-none"
                  onBlur={(e) => {
                    // Save content as plain text with newlines
                    let html = e.currentTarget.innerHTML;
                    html = html
                      .replace(/<div><br><\/div>/g, "\n")
                      .replace(/<div>/g, "\n")
                      .replace(/<\/div>/g, "")
                      .replace(/<br\s*\/?>/gi, "\n");
                    const text = html.replace(/<\/?[^>]+(>|$)/g, "");
                    updateTextElementById(el.id, { text, isEditing: false });
                  }}
                  onInput={(e) => {
                    let html = (e.currentTarget as HTMLDivElement).innerHTML;
                    html = html
                      .replace(/<div><br><\/div>/g, "\n")
                      .replace(/<div>/g, "\n")
                      .replace(/<\/div>/g, "")
                      .replace(/<br\s*\/?>/gi, "\n");
                    const text = html.replace(/<\/?[^>]+(>|$)/g, "");
                    updateTextElementById(el.id, { text });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      // Insert line break
                      document.execCommand("insertLineBreak");
                      // If current text is a bullet list, continue bullet
                      const sel = window.getSelection();
                      if (!sel || !sel.anchorNode) return;
                      // Find the text content up to the caret
                      let node = sel.anchorNode;
                      let offset = sel.anchorOffset;
                      // Find current line text
                      let container = node;
                      while (
                        container &&
                        container.nodeType !== Node.ELEMENT_NODE &&
                        container.parentNode
                      ) {
                        container = container.parentNode;
                      }
                      // Get the line before the caret
                      let textUpToCaret = "";
                      if (
                        node.nodeType === Node.TEXT_NODE &&
                        typeof node.textContent === "string"
                      ) {
                        textUpToCaret = node.textContent.slice(0, offset);
                      }
                      // If the previous line starts with bullet
                      // Instead, get the line before the caret by walking up
                      let prevLine = "";
                      if (sel.anchorNode && sel.anchorNode.parentElement) {
                        // Try to get previous sibling or parent
                        let el = sel.anchorNode.parentElement;
                        // Try to find the previous line's text
                        if (
                          el.previousSibling &&
                          el.previousSibling.textContent
                        ) {
                          prevLine = el.previousSibling.textContent;
                        } else if (el.textContent) {
                          prevLine = el.textContent;
                        }
                      }
                      // Fallback: get the text before caret and last line
                      let text = (e.currentTarget as HTMLDivElement).innerText;
                      let lines = text.split("\n");
                      let caretLineIdx = 0;
                      let caretPos = 0;
                      // Try to get caret's line index
                      if (sel && sel.anchorNode) {
                        // Find caret offset in text
                        let range = sel.getRangeAt(0);
                        let preCaretRange = range.cloneRange();
                        preCaretRange.selectNodeContents(e.currentTarget);
                        preCaretRange.setEnd(
                          range.endContainer,
                          range.endOffset
                        );
                        let preCaretText = preCaretRange.toString();
                        caretPos = preCaretText.length;
                        // Find which line
                        let sum = 0;
                        for (let i = 0; i < lines.length; ++i) {
                          sum += lines[i].length + 1; // +1 for \n
                          if (caretPos < sum) {
                            caretLineIdx = i;
                            break;
                          }
                        }
                        prevLine =
                          caretLineIdx > 0 ? lines[caretLineIdx - 1] : lines[0];
                      }
                      // If previous line or current line starts with bullet, insert bullet
                      let bullet = "";
                      if (
                        (prevLine && /^\s*• /.test(prevLine)) ||
                        (lines[caretLineIdx] &&
                          /^\s*• /.test(lines[caretLineIdx]))
                      ) {
                        bullet = "• ";
                        // Insert bullet at caret
                        setTimeout(() => {
                          document.execCommand("insertText", false, bullet);
                        }, 0);
                      }
                    }
                  }}
                  ref={(node) => {
                    if (node && node.innerText !== el.text) {
                      const html = el.text
                        .split("\n")
                        .map((line, idx, arr) =>
                          idx < arr.length - 1
                            ? line === ""
                              ? "<br>"
                              : `${line}<br>`
                            : line
                        )
                        .join("");
                      node.innerHTML = html;
                    }
                  }}
                />
              ) : (
                el.text
                  .split("\n")
                  .map((line, idx) => <div key={idx}>{line}</div>)
              )}
              {/* Popup toolbar for selected text */}
              {selectedText && selectedText.id === el.id && (
                <div
                  className={clsx(
                    "absolute left-1/2 -translate-x-1/2 -top-16 z-10 flex gap-2 items-center rounded p-2 shadow-lg border border-[var(--color-border-subtle)]",
                    themeConfig[theme].panel
                  )}
                  style={{
                    minWidth: 260,
                    whiteSpace: "nowrap",
                    fontFamily: "Inter, Arial, sans-serif",
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {/* Font size */}
                  <label
                    className="flex items-center gap-1 text-xs"
                    style={{ fontFamily: "Inter, Arial, sans-serif" }}
                  >
                    Size
                    <input
                      type="number"
                      min={8}
                      max={128}
                      value={selectedText.fontSize}
                      onChange={(e) =>
                        updateSelectedText({ fontSize: Number(e.target.value) })
                      }
                      className="w-14 px-1 py-0.5 border rounded"
                      style={{ fontFamily: "Inter, Arial, sans-serif" }}
                    />
                  </label>
                  {/* Font family */}
                  <label
                    className="flex items-center gap-1 text-xs"
                    style={{ fontFamily: "Inter, Arial, sans-serif" }}
                  >
                    Font
                    <select
                      value={selectedText.fontFamily}
                      onChange={(e) =>
                        updateSelectedText({ fontFamily: e.target.value })
                      }
                      className="px-1 py-0.5 border rounded"
                      style={{ fontFamily: "Inter, Arial, sans-serif" }}
                    >
                      {fontsByTheme[theme].map((font) => (
                        <option
                          value={font}
                          key={font}
                          style={{ fontFamily: "Inter, Arial, sans-serif" }}
                        >
                          {font}
                        </option>
                      ))}
                    </select>
                  </label>
                  {/* Bold */}
                  <button
                    className={clsx(
                      selectedText.bold
                        ? toolbarSmallButton
                        : toolbarSmallGhost,
                      "font-bold"
                    )}
                    style={{ fontFamily: "Inter, Arial, sans-serif" }}
                    onClick={() =>
                      updateSelectedText({ bold: !selectedText.bold })
                    }
                    title="Bold"
                    type="button"
                  >
                    B
                  </button>
                  {/* Italic */}
                  <button
                    className={clsx(
                      selectedText.italic
                        ? toolbarSmallButton
                        : toolbarSmallGhost,
                      "italic"
                    )}
                    style={{ fontFamily: "Inter, Arial, sans-serif" }}
                    onClick={() =>
                      updateSelectedText({ italic: !selectedText.italic })
                    }
                    title="Italic"
                    type="button"
                  >
                    I
                  </button>
                  {/* Alignment */}
                  <div
                    className="flex gap-0.5 items-center"
                    style={{ fontFamily: "Inter, Arial, sans-serif" }}
                  >
                    <button
                      className={clsx(
                        selectedText.align === "left"
                          ? toolbarSmallButton
                          : toolbarSmallGhost
                      )}
                      style={{ fontFamily: "Inter, Arial, sans-serif" }}
                      onClick={() => updateSelectedText({ align: "left" })}
                      title="Align left"
                      type="button"
                    >
                      <span style={{ fontFamily: "monospace" }}>L</span>
                    </button>
                    <button
                      className={clsx(
                        selectedText.align === "center"
                          ? toolbarSmallButton
                          : toolbarSmallGhost
                      )}
                      style={{ fontFamily: "Inter, Arial, sans-serif" }}
                      onClick={() => updateSelectedText({ align: "center" })}
                      title="Align center"
                      type="button"
                    >
                      <span style={{ fontFamily: "monospace" }}>C</span>
                    </button>
                    <button
                      className={clsx(
                        selectedText.align === "right"
                          ? toolbarSmallButton
                          : toolbarSmallGhost
                      )}
                      style={{ fontFamily: "Inter, Arial, sans-serif" }}
                      onClick={() => updateSelectedText({ align: "right" })}
                      title="Align right"
                      type="button"
                    >
                      <span style={{ fontFamily: "monospace" }}>R</span>
                    </button>
                  </div>
                  {/* Insert bullet pointer */}
                  <button
                    className={toolbarSmallGhost}
                    onClick={() => {
                      // Insert bullet at caret or at start if not focused
                      // For simplicity, just prepend "• " to the text
                      if (!selectedText.text.startsWith("• ")) {
                        updateSelectedText({ text: "• " + selectedText.text });
                      } else {
                        updateSelectedText({ text: "• " + selectedText.text });
                      }
                    }}
                    title="Insert bullet"
                    type="button"
                  >
                    •
                  </button>
                  {/* Delete */}
                  <button
                    className={clsx(toolbarSmallButton, "font-semibold")}
                    style={{ fontFamily: "Inter, Arial, sans-serif" }}
                    title="Delete"
                    type="button"
                    onClick={deleteSelectedText}
                  >
                    🗑️
                  </button>
                </div>
              )}
              {/* Rotate handle at bottom-left of selected text element */}
              {isSelected && (
                <RotateHandle
                  element={el}
                  updateRotation={(rotation: number) =>
                    updateTextElementById(el.id, { rotation })
                  }
                />
              )}
            </div>
          );
        })}
      </div>
      <div className={clsx("absolute bottom-8 flex gap-3 items-center")}>
        <BackgroundPopup
          theme={theme}
          setBackground={setBackground}
          background={background}
        />
        <button
          className={toolbarButtonClass}
          onClick={addTextElement}
          title="Add text"
          type="button"
        >
          <TextIcon size={18} />
        </button>
        <button
          className={toolbarButtonClass}
          onClick={addStickyNote}
          title="Add sticky note"
          type="button"
        >
          <StickyIcon size={18} />
        </button>
        <StickerSheetButton
          Icon={stickerIconByTheme[theme]}
          theme={theme}
          addStickerElement={addStickerElement}
        />
        {filteredIcons.map((Icon, index) =>
          Icon === LucideImage ? (
            <ImageToolButton
              Icon={Icon}
              theme={theme}
              addImageElement={addImageElement}
              key={index}
            />
          ) : null
        )}
        <AudioPopup theme={theme} onAddAudio={addAudioElement} />
        <button
          className={toolbarButtonClass}
          onClick={clearCanvas}
          title="Clear canvas"
          type="button"
        >
          <Trash2 size={18} />
        </button>
      </div>
      {/* Render sticker elements (draggable, resizable, rotatable, deletable) */}
      {stickerElements
        .slice()
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
        .map((el) => {
          const isSelected = el.id === selectedStickerId;
          return (
            <div
              key={el.id}
              className={clsx(
                "absolute select-none transition group",
                isSelected ? "outline-2 outline-pink-500 z-35" : "z-15"
              )}
              style={{
                left: el.x,
                top: el.y,
                width: el.width,
                height: el.height,
                transform: `rotate(${el.rotation}deg)`,
                cursor: "move",
                userSelect: "none",
                zIndex: el.zIndex ?? 20,
              }}
              onMouseDown={(e) => handleStickerDragStart(e, el.id)}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedStickerId(el.id);
                setSelectedTextId(null);
                setSelectedImageId(null);
                setSelectedStickyId(null);
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  position: "relative",
                }}
              >
                <img
                  src={el.src}
                  alt=""
                  draggable={false}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    borderRadius: 12,
                    opacity: 1,
                    pointerEvents: "none",
                    boxShadow: "0 2px 8px rgba(80,0,80,0.10)",
                  }}
                />
              </div>
              {/* Resize handle (bottom-left) */}
              {isSelected && (
                <div
                  className="absolute z-40 flex items-center justify-center"
                  style={{
                    left: -10,
                    bottom: -10,
                    width: 18,
                    height: 18,
                    cursor: "nwse-resize",
                    pointerEvents: "auto",
                  }}
                  onMouseDown={(e) => handleStickerResizeStart(e, el.id)}
                  title="Drag to resize"
                >
                  <div
                    className="flex h-full w-full items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] shadow transition hover:bg-[var(--color-surface-raised)]"
                    style={{
                      width: 14,
                      height: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                    }}
                  >
                    ↔️
                  </div>
                </div>
              )}
              {/* Rotate handle (bottom-right) */}
              {isSelected && (
                <div
                  className="absolute z-40 flex items-center justify-center"
                  style={{
                    right: -10,
                    bottom: -10,
                    width: 18,
                    height: 18,
                    cursor: "grab",
                    pointerEvents: "auto",
                  }}
                  onMouseDown={(e) => handleStickerRotateStart(e, el.id)}
                  title="Drag to rotate"
                >
                  <div
                    className="flex h-full w-full items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] shadow transition hover:bg-[var(--color-surface-raised)]"
                    style={{
                      width: 14,
                      height: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                    }}
                  >
                    <RotateCw
                      size={10}
                      className="text-[var(--color-primary)]"
                    />
                  </div>
                </div>
              )}
              {/* Delete button */}
              {isSelected && (
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    deleteStickerElementById(el.id);
                  }}
                  className="absolute -top-3 -right-3 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] text-[var(--color-ink)] shadow transition hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-primary)]"
                  title="Delete sticker"
                  tabIndex={0}
                  style={{ fontSize: 16, lineHeight: 1 }}
                >
                  ✖
                </button>
              )}
            </div>
          );
        })}
      {/* Global floating audio player */}
      {/* Floating global YouTube player */}
      {globalAudio && (
        <div
          className={clsx(
            "fixed bottom-4 left-4 z-50 w-64 rounded shadow border border-[var(--color-border-subtle)]",
            themeConfig[theme].panel
          )}
        >
          <div className="flex items-center p-2 gap-2">
            <img
              src={globalAudio.thumbnail}
              className="w-10 h-10 rounded object-cover"
            />
            <div className="flex-1 truncate text-sm text-[var(--color-ink-strong)]">
              {globalAudio.title}
            </div>
            <button
              onClick={() => setGlobalAudio(null)}
              className={clsx(
                "ml-auto rounded-full p-1 transition",
                themeConfig[theme].button,
                themeConfig[theme].hover
              )}
              aria-label="Close"
              type="button"
            >
              ✖
            </button>
          </div>
          <iframe
            id="yt-player"
            src={`https://www.youtube.com/embed/${globalAudio.videoId}?autoplay=1`}
            allow="autoplay; encrypted-media"
            className="hidden"
          />
        </div>
      )}

      {/* {globalAudio && (
  <div className="fixed bottom-4 left-4 z-50 w-72 bg-white rounded shadow-lg overflow-hidden">
    <div className="flex items-center p-2 gap-2">
      <img src={globalAudio.thumbnail} alt="" className="w-10 h-10 rounded" />
      <div className="flex-1 truncate">
        <div className="font-semibold text-sm">{globalAudio.title}</div>
        <div className="text-xs opacity-70">{globalAudio.channelTitle}</div>
      </div>
      <button
        className="text-red-500 text-xs px-2"
        onClick={() => setGlobalAudio(null)}
      >
        ✖
      </button>
    </div>
    <iframe
      src={`https://www.youtube.com/embed/${globalAudio.videoId}?autoplay=1&enablejsapi=1`}
      allow="autoplay; encrypted-media"
      className="w-full h-40"
    />
  </div>
)} */}
    </div>
  );
};

export default CanvasBoard;

// Popup toolbar for selected image element
const textures = [
  {
    name: "Paper",
    style:
      "url('https://www.transparenttextures.com/patterns/back-pattern.png')",
  },
  {
    name: "Noise",
    style:
      "url('https://www.transparenttextures.com/patterns/asfalt-dark.png')",
  },
];

const frames = [
  { name: "None", value: undefined },
  { name: "Polaroid", value: "polaroid" },
];

const ImagePopupToolbar: React.FC<{
  element: ImageElement;
  updateElement: (updates: Partial<ImageElement>) => void;
  deleteElement: () => void;
  bringForward: () => void;
  sendBackward: () => void;
  replaceSrc: (src: string) => void;
  theme: Theme;
}> = ({
  element,
  updateElement,
  deleteElement,
  bringForward,
  sendBackward,
  replaceSrc,
  theme,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const triggerFileInput = () => fileInputRef.current?.click();
  const onReplace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      replaceSrc(url);
    }
  };
  const toolbarContainerClass = clsx(
    "absolute left-1/2 -translate-x-1/2 -top-20 z-50 flex gap-2 items-center rounded p-2 shadow-lg border border-[var(--color-border-subtle)]",
    themeConfig[theme].panel
  );
  const toolbarButtonClass = clsx(
    "px-2 py-1 rounded text-xs transition",
    themeConfig[theme].panel,
    themeConfig[theme].hover
  );
  const toolbarActiveClass = clsx(
    "px-2 py-1 rounded text-xs transition",
    themeConfig[theme].button,
    themeConfig[theme].hover
  );
  return (
    <div
      className={toolbarContainerClass}
      style={{
        minWidth: 250,
        whiteSpace: "nowrap",
        fontFamily: "Inter, Arial, sans-serif",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Texture */}
      <div className="flex gap-1 items-center">
        <span className="text-xs">Texture</span>
        <button
          className={!element.texture ? toolbarActiveClass : toolbarButtonClass}
          onClick={() => updateElement({ texture: undefined })}
          title="No texture"
        >
          None
        </button>
        {textures.map(({ name, style }) => (
          <button
            key={name}
            onClick={() => updateElement({ texture: style })}
            className={
              element.texture === style
                ? toolbarActiveClass
                : toolbarButtonClass
            }
            style={{
              backgroundImage: style,
              backgroundSize: "auto",
              backgroundRepeat: "repeat",
            }}
            title={name}
          >
            {name}
          </button>
        ))}
        {/* Opacity */}
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={element.opacity ?? 1}
          onChange={(e) => updateElement({ opacity: Number(e.target.value) })}
          style={{ width: 48 }}
          title="Texture opacity"
        />
      </div>
      {/* Filter controls */}
      <div className="flex gap-1 items-center">
        <span className="text-xs">Filter</span>
        <button
          className={toolbarButtonClass}
          onClick={() => updateElement({ filter: "none" })}
        >
          None
        </button>
        <button
          className={toolbarButtonClass}
          onClick={() => updateElement({ filter: "grayscale(100%)" })}
        >
          B/W
        </button>
        <button
          className={toolbarButtonClass}
          onClick={() => updateElement({ filter: "sepia(60%)" })}
        >
          Vintage
        </button>
        <button
          className={toolbarButtonClass}
          onClick={() =>
            updateElement({ filter: "contrast(1.5) saturate(1.2)" })
          }
        >
          Pop
        </button>
      </div>
      {/* Frame */}
      <div className="flex gap-1 items-center">
        <span className="text-xs">Frame</span>
        {frames.map(({ name, value }) => (
          <button
            key={name}
            className={
              element.frame === value ? toolbarActiveClass : toolbarButtonClass
            }
            onClick={() => updateElement({ frame: value })}
          >
            {name}
          </button>
        ))}
      </div>
      {/* Replace */}
      <button
        className={toolbarButtonClass}
        title="Replace image"
        type="button"
        onClick={triggerFileInput}
      >
        Replace
      </button>
      <input
        type="file"
        accept="image/*"
        onChange={onReplace}
        ref={fileInputRef}
        className="hidden"
      />
      {/* Delete */}
      <button
        className={toolbarButtonClass}
        title="Delete"
        type="button"
        onClick={deleteElement}
      >
        🗑️
      </button>
      {/* Layer control */}
      {/* <button
        className="px-2 py-1 rounded text-xs bg-gray-100"
        title="Bring forward"
        onClick={bringForward}
      >
        ▲
      </button>
      <button
        className="px-2 py-1 rounded text-xs bg-gray-100"
        title="Send backward"
        onClick={sendBackward}
      >
        ▼
      </button> */}
    </div>
  );
};

// Manual rotate handle for text elements
const RotateHandle: React.FC<{
  element: TextElement;
  updateRotation: (rotation: number) => void;
}> = ({ element, updateRotation }) => {
  // We'll use a ref to track the center and current rotation
  const handleRef = React.useRef<HTMLDivElement>(null);
  // To avoid unnecessary updates, keep initial values in refs
  const initialAngleRef = React.useRef<number>(0);
  const startRotationRef = React.useRef<number>(0);

  // Mouse event handlers
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    // Get the center of the text element on the page
    const parent = handleRef.current?.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    // Mouse position at start
    const startX = e.clientX;
    const startY = e.clientY;
    // Calculate initial angle from center to mouse
    const dx = startX - centerX;
    const dy = startY - centerY;
    initialAngleRef.current = Math.atan2(dy, dx) * (180 / Math.PI);
    startRotationRef.current = element.rotation;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const mx = moveEvent.clientX;
      const my = moveEvent.clientY;
      const mdx = mx - centerX;
      const mdy = my - centerY;
      const angle = Math.atan2(mdy, mdx) * (180 / Math.PI);
      // The difference from initial angle
      let delta = angle - initialAngleRef.current;
      // Snap to -180..180
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      const newRotation = startRotationRef.current + delta;
      updateRotation(newRotation);
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Position: bottom-right, just outside the text element
  return (
    <div
      ref={handleRef}
      className="absolute z-20 flex items-center justify-center"
      style={{
        right: -16, // moved from left to right
        bottom: -10, // just outside
        width: 20,
        height: 20,
        pointerEvents: "auto",
      }}
    >
      <div
        onMouseDown={onMouseDown}
        className="flex h-full w-full items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] shadow transition hover:bg-[var(--color-surface-raised)]"
        style={{
          width: 12,
          height: 12,
          cursor: "grab",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
        }}
        title="Drag to rotate"
      >
        <RotateCw size={10} className="text-[var(--color-primary)]" />
      </div>
    </div>
  );
};

// Dedicated ImageToolButton component for the toolbar
type ImageToolButtonProps = {
  Icon: React.ComponentType<{ size?: number }>;
  theme: Theme;
  addImageElement: (src: string) => void;
};

const ImageToolButton: React.FC<ImageToolButtonProps> = ({
  Icon,
  theme,
  addImageElement,
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const triggerFileInput = () => {
    inputRef.current?.click();
  };
  const buttonClass = clsx(
    "flex items-center justify-center rounded-full p-3 transition",
    themeConfig[theme].button,
    themeConfig[theme].hover
  );
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      addImageElement(url);
    }
  };
  return (
    <>
      <button
        className={buttonClass}
        title="Add image"
        type="button"
        onClick={triggerFileInput}
      >
        <Icon size={18} />
      </button>
      <input
        type="file"
        accept="image/*"
        ref={inputRef}
        className="hidden"
        onChange={handleChange}
      />
    </>
  );
};

// Dedicated StickerToolButton component for the toolbar
type StickerToolButtonProps = {
  Icon: React.ComponentType<{ size?: number }>;
  theme: Theme;
  addStickerElement: (src: string) => void;
};

const StickerToolButton: React.FC<StickerToolButtonProps> = ({
  Icon,
  theme,
  addStickerElement,
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const triggerFileInput = () => {
    inputRef.current?.click();
  };
  const buttonClass = clsx(
    "flex items-center justify-center rounded-full p-3 transition",
    themeConfig[theme].button,
    themeConfig[theme].hover
  );
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      addStickerElement(url);
    }
  };
  return (
    <>
      <button
        className={buttonClass}
        title="Add sticker"
        type="button"
        onClick={triggerFileInput}
      >
        <Icon size={18} />
      </button>
      <input
        type="file"
        accept="image/*"
        ref={inputRef}
        className="hidden"
        onChange={handleChange}
      />
    </>
  );
};
// StickerSheetButton: Custom Sticker popup for bottom toolbar
type StickerSheetButtonProps = {
  Icon: React.ComponentType<{ size?: number }>;
  theme: Theme;
  addStickerElement: (src: string) => void;
};

const StickerSheetButton: React.FC<StickerSheetButtonProps> = ({
  Icon,
  theme,
  addStickerElement,
}) => {
  const [open, setOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const triggerButtonClass = clsx(
    "flex items-center justify-center rounded-full p-3 transition",
    themeConfig[theme].button,
    themeConfig[theme].hover
  );
  const closeButtonClass = clsx(
    "rounded-full p-2 transition",
    themeConfig[theme].panel,
    themeConfig[theme].hover
  );
  const gridButtonClass = clsx(
    "rounded-xl shadow transition border border-[var(--color-border-subtle)] flex items-center justify-center p-2",
    themeConfig[theme].panel,
    themeConfig[theme].hover
  );
  const uploadButtonClass = clsx(
    "rounded px-4 py-2 font-medium transition",
    themeConfig[theme].button,
    themeConfig[theme].hover
  );

  // Placeholder stickers (SVG data URLs)
  const stickers: { name: string; url: string }[] = [
    {
      name: "Star",
      url:
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 72 72'><polygon points='36,8 44,28 66,28 48,42 54,64 36,52 18,64 24,42 6,28 28,28' fill='#FFD600' stroke='#FBC02D' stroke-width='3'/></svg>`
        ),
    },
    {
      name: "Heart",
      url:
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 72 72'><path d='M36 62s-20-13.6-20-28c0-7.2 5.8-13 13-13 4.2 0 8.2 2.2 10.4 5.6C41.8 23.2 45.8 21 50 21c7.2 0 13 5.8 13 13 0 14.4-20 28-20 28z' fill='#F06292' stroke='#AD1457' stroke-width='3'/></svg>`
        ),
    },
    {
      name: "Smile",
      url:
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 72 72'><circle cx='36' cy='36' r='32' fill='#FFF176' stroke='#FBC02D' stroke-width='3'/><circle cx='26' cy='32' r='4' fill='#333'/><circle cx='46' cy='32' r='4' fill='#333'/><path d='M24 44c4 4 16 4 20 0' stroke='#333' stroke-width='3' fill='none' stroke-linecap='round'/></svg>`
        ),
    },
    {
      name: "Flower",
      url:
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 72 72'><circle cx='36' cy='36' r='10' fill='#F06292'/><g><ellipse cx='36' cy='16' rx='8' ry='16' fill='#BA68C8' transform='rotate(0 36 36)'/><ellipse cx='36' cy='16' rx='8' ry='16' fill='#BA68C8' transform='rotate(60 36 36)'/><ellipse cx='36' cy='16' rx='8' ry='16' fill='#BA68C8' transform='rotate(120 36 36)'/><ellipse cx='36' cy='16' rx='8' ry='16' fill='#BA68C8' transform='rotate(180 36 36)'/><ellipse cx='36' cy='16' rx='8' ry='16' fill='#BA68C8' transform='rotate(240 36 36)'/><ellipse cx='36' cy='16' rx='8' ry='16' fill='#BA68C8' transform='rotate(300 36 36)'/></g></svg>`
        ),
    },
    {
      name: "Music Note",
      url:
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 72 72'><ellipse cx='26' cy='60' rx='10' ry='8' fill='#90CAF9'/><rect x='34' y='12' width='8' height='36' fill='#1976D2'/><ellipse cx='38' cy='56' rx='10' ry='8' fill='#90CAF9'/></svg>`
        ),
    },
    {
      name: "Candy",
      url:
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 72 72'><ellipse cx='36' cy='36' rx='16' ry='10' fill='#FFB74D' stroke='#F57C00' stroke-width='3'/><rect x='12' y='30' width='8' height='12' fill='#FFF59D' stroke='#FBC02D' stroke-width='2'/><rect x='52' y='30' width='8' height='12' fill='#FFF59D' stroke='#FBC02D' stroke-width='2'/></svg>`
        ),
    },
  ];

  // Theme icon for header
  const ThemeIcon = stickerIconByTheme[theme];

  // Slide-up effect styles
  const popupStyle: React.CSSProperties = {
    borderRadius: "1rem 1rem 0 0",
    boxShadow: "0 -4px 24px rgba(0,0,0,0.10)",
    padding: "1.25rem 1.25rem 1rem 1.25rem",
    minWidth: 340,
    maxWidth: 420,
    minHeight: 220,
    border: "none",
    position: "fixed",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: 0,
    transition:
      "transform 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s cubic-bezier(0.4,0,0.2,1)",
    zIndex: 100,
  };

  // Open popup handler
  const openPopup = () => setOpen(true);
  const closePopup = () => setOpen(false);

  // Handle sticker upload
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      addStickerElement(url);
      closePopup();
    }
  };

  return (
    <Popup
      trigger={
        <button
          className={triggerButtonClass}
          aria-label="Stickers"
          type="button"
        >
          <Icon size={18} />
        </button>
      }
      position="top center"
      closeOnDocumentClick
      arrow={false}
      contentStyle={{
        ...popupStyle,
        background: undefined,
        // Let panelThemeClass control background
      }}
      open={open}
      onOpen={openPopup}
      onClose={closePopup}
      modal
    >
      <div
        className={clsx(
          "flex flex-col gap-2",
          themeConfig[theme].panel,
          "rounded-t-2xl"
        )}
        style={{
          minHeight: 220,
          minWidth: 340,
          maxWidth: 420,
          padding: "0",
          position: "relative",
          transition: "background 0.2s",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-black/10">
          <div className="flex items-center gap-2">
            <ThemeIcon size={22} />
            <span className="font-semibold text-lg">Stickers</span>
          </div>
          <button
            className={clsx(closeButtonClass, "text-[var(--color-ink-soft)]")}
            aria-label="Close"
            type="button"
            onClick={closePopup}
          >
            <span style={{ fontSize: 18 }}>✖</span>
          </button>
        </div>
        {/* Sticker grid */}
        <div className="px-5 py-4">
          <div className="grid grid-cols-3 gap-4">
            {stickers.map((sticker, idx) => (
              <button
                key={sticker.name}
                type="button"
                className={clsx(
                  gridButtonClass,
                  "hover:border-[var(--color-border-emphasis)]"
                )}
                style={{
                  width: 72,
                  height: 72,
                }}
                title={sticker.name}
                onClick={() => {
                  addStickerElement(sticker.url);
                  closePopup();
                }}
              >
                <img
                  src={sticker.url}
                  alt={sticker.name}
                  style={{
                    width: 56,
                    height: 56,
                    objectFit: "contain",
                    pointerEvents: "none",
                    display: "block",
                  }}
                  draggable={false}
                />
              </button>
            ))}
          </div>
        </div>
        {/* Upload sticker */}
        <div className="px-5 pb-4 flex items-center">
          <button
            className={uploadButtonClass}
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload Sticker
          </button>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </div>
    </Popup>
  );
};
