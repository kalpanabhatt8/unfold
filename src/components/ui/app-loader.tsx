"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import "./app-loader.css";

type AppLoaderProps = {
  /** Optional content under the spinner (e.g. Clerk captcha on SSO). */
  children?: ReactNode;
};

/**
 * Full-viewport, Notion-style waiting state - small centered spinner, no copy.
 * Use while auth resolves or the app hands off to the dashboard.
 *
 * When a visible Clerk/Turnstile captcha mounts into children, the spinner
 * hides so the challenge stands alone.
 */
export function AppLoader({ children }: AppLoaderProps) {
  const stackRef = useRef<HTMLDivElement>(null);
  const [captchaVisible, setCaptchaVisible] = useState(false);

  useEffect(() => {
    const root = stackRef.current;
    if (!root) return;

    const captcha = root.querySelector("#clerk-captcha");
    if (!captcha) {
      setCaptchaVisible(false);
      return;
    }

    const update = () => {
      const rect = captcha.getBoundingClientRect();
      // Interactive Turnstile is a wide checkbox card; invisible stays ~0.
      setCaptchaVisible(rect.height > 40 && rect.width > 120);
    };

    update();
    const resize = new ResizeObserver(update);
    resize.observe(captcha);
    const mutate = new MutationObserver(update);
    mutate.observe(captcha, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    // Turnstile often sizes itself after mount without a reliable resize event.
    const poll = window.setInterval(update, 200);

    return () => {
      resize.disconnect();
      mutate.disconnect();
      window.clearInterval(poll);
    };
  }, [children]);

  return (
    <div className="app-loader" role="status" aria-live="polite" aria-busy="true">
      <div
        ref={stackRef}
        className={`app-loader__stack${captchaVisible ? " app-loader__stack--captcha" : ""}`}
      >
        {!captchaVisible ? (
          <span className="app-loader__spinner" aria-hidden />
        ) : null}
        {children}
      </div>
      <span className="app-loader__label">Loading</span>
    </div>
  );
}
