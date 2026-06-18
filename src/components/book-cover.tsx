import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import type { CoverGradientId } from "@/data/cover-gradients";
import { BOOK_CONFIG, type BookCoverSize } from "@/components/book-cover-config";
import {
  coverBackgroundVar,
  coverGradientIdFromBackground,
} from "@/data/cover-gradients";
import {
  coverOverlayTextStyles,
  estimateBackgroundLuminance,
  sampleCoverImageFromUrl,
} from "@/lib/cover-text-contrast";

type BookCoverVariant = "solid" | "image";

type BookCoverBaseProps = {
  size?: BookCoverSize;
  variant?: BookCoverVariant;
  title?: string;
  /** Muted overlay style when `title` is a display placeholder (e.g. "New book"). */
  titleIsPlaceholder?: boolean;
  subtitle?: string;
  coverImageUrl?: string | null;
  className?: string;
  /**
   * CSS preset from `book.css` (`[data-gradient]`). Prefer over inline
   * `style.background` so `background-size: cover` matches the design reference.
   */
  coverGradient?: CoverGradientId;
};

type BookCoverProps = BookCoverBaseProps &
  React.ComponentPropsWithoutRef<"div">;

export function BookCover({
  size = "md",
  variant = "solid",
  title,
  titleIsPlaceholder = false,
  subtitle,
  coverImageUrl,
  className,
  coverGradient,
  style,
  ...rest
}: BookCoverProps) {
  const sizeConfig = BOOK_CONFIG[size];
  const resolvedGradient =
    coverGradient ??
    coverGradientIdFromBackground(
      style && typeof (style as React.CSSProperties).background === "string"
        ? ((style as React.CSSProperties).background as string)
        : undefined,
    );

  const coverStyle = useMemo((): React.CSSProperties | undefined => {
    const overlayVars = {
      "--book-padding-left": sizeConfig.padding.left,
      "--book-padding-right": sizeConfig.padding.right,
      "--book-padding-top": sizeConfig.padding.top,
      "--book-padding-bottom": sizeConfig.padding.bottom,
      "--book-groove-width": sizeConfig.groove.width,
      "--book-overlay-line-left": sizeConfig.overlayLine.left,
      "--book-overlay-line-width": sizeConfig.overlayLine.width,
      "--book-content-margin-bottom": sizeConfig.content.marginBottom,
      "--book-title-size": sizeConfig.text.titleSize,
      "--book-subtitle-size": sizeConfig.text.subtitleSize,
    } as Record<string, string>;

    if (resolvedGradient) {
      const { background: _drop, ...restStyle } = (style ?? {}) as React.CSSProperties;
      const nextStyle: React.CSSProperties = {
        ...restStyle,
        backgroundSize: "cover",
        backgroundPosition: "center",
        ...(overlayVars as React.CSSProperties),
      };
      (nextStyle as Record<string, string>)["--book-cover-bg"] =
        coverBackgroundVar(resolvedGradient);
      return nextStyle;
    }
    if (style?.background) {
      return {
        ...style,
        backgroundSize: "cover",
        backgroundPosition: "center",
        ...(overlayVars as React.CSSProperties),
      };
    }
    return overlayVars as React.CSSProperties;
  }, [resolvedGradient, sizeConfig, style]);

  const bgString =
    typeof (coverStyle as React.CSSProperties | undefined)?.background === "string"
      ? ((coverStyle as React.CSSProperties).background as string)
      : typeof style?.background === "string"
        ? (style.background as string)
        : undefined;

  const fallbackLum = useMemo(
    () => estimateBackgroundLuminance(bgString, resolvedGradient),
    [bgString, resolvedGradient],
  );

  const [imageRegionLum, setImageRegionLum] = useState<number | null>(null);

  useEffect(() => {
    if (variant !== "image" || !coverImageUrl) {
      setImageRegionLum(null);
      return;
    }
    let cancelled = false;
    void sampleCoverImageFromUrl(coverImageUrl).then((lum) => {
      if (!cancelled) setImageRegionLum(lum);
    });
    return () => {
      cancelled = true;
    };
  }, [variant, coverImageUrl]);

  const effectiveLuminance =
    variant === "image" && imageRegionLum !== null ? imageRegionLum : fallbackLum;

  const textChrome = useMemo(
    () =>
      coverOverlayTextStyles({
        luminance: effectiveLuminance,
        onImage: variant === "image" && Boolean(coverImageUrl),
      }),
    [effectiveLuminance, variant, coverImageUrl],
  );

  return (
    <>
      <div className={clsx("book-cover-stack", className)} {...rest}>
        <div className="book-cover-backplate" aria-hidden />
        <div className="book-cover-shadow" aria-hidden />

        <div
          className="book-cover"
          data-variant={variant}
          data-gradient={resolvedGradient}
          style={coverStyle}
        >
          {coverImageUrl ? (
            <Image
              src={coverImageUrl}
              alt="Cover artwork"
              fill
              className="cover-image"
              unoptimized
            />
          ) : null}
          <div className="book-overlay-groove" />

          <div className="book-overlay-line" />

          <div className="book-cover__content">
            <h3
              className="book-cover__title"
              style={titleIsPlaceholder ? textChrome.hint : textChrome.title}
            >
              {title}
            </h3>
            {/* Subtitle temporarily hidden on book cover
            {subtitle ? (
              <p className="book-cover__subtitle" style={textChrome.subtitle}>
                {subtitle}
              </p>
            ) : null}
            */}
          </div>
        </div>
      </div>
    </>
  );
}

export type { BookCoverVariant, BookCoverProps };
