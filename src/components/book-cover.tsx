import React from "react";
import Image from "next/image";
import clsx from "clsx";

type BookCoverVariant = "solid" | "image";

type BookCoverBaseProps = {
  variant?: BookCoverVariant;
  title: string;
  subtitle?: string;
  coverImageUrl?: string | null;
  titleColor?: string;
  subtitleColor?: string;
  className?: string;
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
  style,
  ...rest
}: BookCoverProps) {
  return (
   <>
    <div className={clsx("book-cover-stack", className)} {...rest}>
      <div className="book-cover-backplate" aria-hidden />
      <div className="book-cover-shadow" aria-hidden />

      <div className="book-cover" data-variant={variant} style={style}>
        {coverImageUrl ? (
          <Image
            src={coverImageUrl}
            alt="Cover artwork"
            fill
            className="cover-image"
            unoptimized
          />
        ) : null}

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
