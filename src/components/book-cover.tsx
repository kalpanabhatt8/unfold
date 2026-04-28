import React, { useMemo } from "react";
import Image from "next/image";
import clsx from "clsx";
import type { CoverGradientId } from "@/data/cover-gradients";
import {
  coverBackgroundVar,
  coverGradientIdFromBackground,
} from "@/data/cover-gradients";

type BookCoverVariant = "solid" | "image";

type BookCoverBaseProps = {
  variant?: BookCoverVariant;
  title?: string;
  subtitle?: string;
  coverImageUrl?: string | null;
  titleColor?: string;
  subtitleColor?: string;
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
  variant = "solid",
  title,
  subtitle,
  coverImageUrl,
  titleColor,
  subtitleColor,
  className,
  coverGradient,
  style,
  ...rest
}: BookCoverProps) {
  const resolvedGradient =
    coverGradient ??
    coverGradientIdFromBackground(
      style && typeof (style as React.CSSProperties).background === "string"
        ? ((style as React.CSSProperties).background as string)
        : undefined
    );

  const coverStyle = useMemo((): React.CSSProperties | undefined => {
    if (resolvedGradient) {
      const { background: _drop, ...restStyle } = (style ?? {}) as React.CSSProperties;
      const nextStyle: React.CSSProperties = {
        ...restStyle,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
      (nextStyle as Record<string, string>)["--book-cover-bg"] =
        coverBackgroundVar(resolvedGradient);
      return nextStyle;
    }
    if (style?.background) {
      return { ...style, backgroundSize: "cover", backgroundPosition: "center" };
    }
    return style;
  }, [resolvedGradient, style]);

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
              style={titleColor ? { color: titleColor } : undefined}
            >
              {title}
            </h3>
            {subtitle ? (
              <p
                className="book-cover__subtitle"
                style={subtitleColor ? { color: subtitleColor } : undefined}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {/* <div className="trapezoid-bar" aria-hidden /> */}
        {/* <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <clipPath id="bookPageClip" clipPathUnits="objectBoundingBox">
            <path
              d="
              M0,0.2
              L0.9,0.2
              Q1,-0.05 1,0.5
              Q1,1.05 0.94,1
              L0.04,1
              Z"
            />
          </clipPath>
        </defs>
      </svg> */}
      </div>
    </>
  );
}

export type { BookCoverVariant, BookCoverProps };
