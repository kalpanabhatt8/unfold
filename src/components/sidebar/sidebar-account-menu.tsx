"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { AccountProfileModal } from "@/components/sidebar/account-profile-modal";
import { SendFeedbackModal } from "@/components/sidebar/send-feedback-modal";
import { clearLocalUnfoldData } from "@/lib/clear-local-data";
import { resolvePreferredName } from "@/lib/user-display";

// const SUPPORT_MAILTO =
//   "mailto:hello@unfold.app?subject=Supporting%20Unfold";

const menuItemClassName =
  "flex w-full items-center px-3 py-2 text-left text-sm font-medium leading-snug text-primary opacity-80 transition-colors duration-150 hover:bg-(--sidebar-hover-bg) focus-visible:bg-(--sidebar-hover-bg) focus-visible:outline-none";

const menuItemStyle = {
  fontSize: "var(--text-sm)",
  lineHeight: "var(--text-sm--line-height)",
} as const;

function avatarLetter(source: string | null | undefined): string {
  const word = source?.trim().split(/\s+/)[0];
  const letter = word?.[0];
  return letter ? letter.toLowerCase() : "u";
}

export function SidebarAccountMenu() {
  const clerk = useClerk();
  const { user, isLoaded } = useUser();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const showPhoto = Boolean(isLoaded && user?.hasImage && user.imageUrl);
  const letter = isLoaded
    ? avatarLetter(resolvePreferredName(user) || user?.username)
    : "";

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root || !(event.target instanceof Node)) return;
      if (!root.contains(event.target)) setMenuOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const openAccount = () => {
    closeMenu();
    setProfileOpen(true);
  };

  const openFeedback = () => {
    closeMenu();
    setFeedbackOpen(true);
  };

  const signOut = () => {
    closeMenu();
    clearLocalUnfoldData();
    void clerk.signOut({ redirectUrl: "/" });
  };

  return (
    <>
      <div ref={rootRef} className="relative shrink-0">
        <button
          type="button"
          aria-label="Account menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? menuId : undefined}
          onClick={() => setMenuOpen((prev) => !prev)}
          className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-(--canvas-title-ink) text-[0.8125rem] font-semibold leading-none text-white transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 active:opacity-80"
          style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem" }}
        >
          {showPhoto && user ? (
            <img
              src={user.imageUrl}
              alt=""
              width={28}
              height={28}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            letter || "\u00a0"
          )}
        </button>

        {menuOpen ? (
          <div
            id={menuId}
            role="menu"
            aria-label="Account"
            className="absolute top-full left-0 z-30 mt-1.5 min-w-42 overflow-hidden rounded-sm border border-black/6 bg-white p-2 shadow-[0_0.25rem_1.25rem_rgba(15,15,15,0.10)]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={openAccount}
              className={menuItemClassName}
              style={menuItemStyle}
            >
              My Account
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={openFeedback}
              className={menuItemClassName}
              style={menuItemStyle}
            >
              Send feedback
            </button>
            {/* Buy me a coffee / Support us — re-enable later
            <a
              role="menuitem"
              href={SUPPORT_MAILTO}
              onClick={closeMenu}
              className={menuItemClassName}
              style={menuItemStyle}
            >
              Support us
            </a>
            */}
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className={menuItemClassName}
              style={menuItemStyle}
            >
              Sign out
            </button>
          </div>
        ) : null}
      </div>

      <AccountProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
      <SendFeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </>
  );
}
