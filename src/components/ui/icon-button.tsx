"use client";

import clsx from "clsx";
import { forwardRef } from "react";
import {
  btnIconChrome,
  iconFixed,
  iconPx,
  iconStroke,
  type ButtonSize,
  type BtnRadius,
} from "@/components/ui/button-system";

export type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ButtonSize;
  radius?: BtnRadius;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { size = "sm", radius, className, type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={clsx(btnIconChrome(size, radius), className)}
        {...props}
      />
    );
  },
);

export { iconFixed, iconPx, iconStroke };
