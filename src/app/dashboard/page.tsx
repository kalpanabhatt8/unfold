"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PencilRulerIcon } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { BOOK_CONFIG } from "@/components/book-cover-config";
import { btnIcon, btnState, iconFixed, iconPx, iconStroke } from "@/components/ui/button-system";
import { starterBookTemplates } from "@/data/book-templates";
import { coverBackgroundVar } from "@/data/cover-gradients";
import {
  readRecentBooks,
  RECENT_BOOKS_STORAGE_KEY,
  RECENTS_UPDATED_EVENT,
  type RecentBook,
} from "@/lib/recent-books";

const CREATE_NEW_COVER_BG =
  "linear-gradient(to bottom, #EBEDF0 0%, #E3E8EC 100%)";

const Dashboard = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [recentBooks, setRecentBooks] = useState<RecentBook[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return readRecentBooks();
    } catch {
      return [];
    }
  });

  const createDraftId = (prefix: string) =>
    `${prefix}-${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 6)}`;

  const templatesAfterRecents = useMemo(() => {
    const fromRecents = new Set(
      recentBooks
        .map((b) => b.sourceTemplateId)
        .filter(
          (id): id is string =>
            typeof id === "string" && id.length > 0 && id !== "blank",
        ),
    );
    return starterBookTemplates.filter((t) => !fromRecents.has(t.id));
  }, [recentBooks]);

  useEffect(() => {
    if (typeof window === "undefined" || pathname !== "/dashboard") return;

    const loadRecents = () => {
      try {
        const parsed = readRecentBooks();
        setRecentBooks(parsed);
      } catch (error) {
        console.error("Failed to read recents", error);
      }
    };

    loadRecents();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === RECENT_BOOKS_STORAGE_KEY) {
        loadRecents();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(RECENTS_UPDATED_EVENT, loadRecents);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(RECENTS_UPDATED_EVENT, loadRecents);
    };
  }, [pathname]);

  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < minute) return "Just now";
    if (diff < hour) {
      const mins = Math.round(diff / minute);
      return `${mins} min${mins === 1 ? "" : "s"} ago`;
    }
    if (diff < day) {
      const hours = Math.round(diff / hour);
      return `${hours} hr${hours === 1 ? "" : "s"} ago`;
    }
    const days = Math.round(diff / day);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  };

  const handleCreateNewBook = () => {
    const draftId = createDraftId("blank");
    // Create the draft, then immediately take the user into writing.
    // This marks the draft as "canvas opened" so it appears in Recents.
    router.push(`/dashboard/books/${draftId}/canvas?template=blank`);
  };

  const handleTemplateSelect = (templateId: string) => {
    const draftId = createDraftId(templateId);
    router.push(`/dashboard/books/${draftId}/canvas?template=${templateId}`);
  };

  const handleTemplateCoverEdit = (templateId: string) => {
    const draftId = createDraftId(templateId);
    router.push(`/dashboard/books/${draftId}?template=${templateId}&from=dashboard`);
  };

  return (
    <main className="min-h-screen w-full">

    <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 md:px-10 lg:px-16 pt-12 sm:pt-14 md:pt-16 pb-12 md:pb-16">
  
      
    <section className="flex flex-col gap-12 md:gap-20">
          {/* Row 1 — create new */}
          <section className="flex flex-col gap-4">
            {/* <h2 className="text-sm !tracking-[0.1em] uppercase text-ink-soft">
              Create new
            </h2> */}
            <div className="flex flex-wrap items-start gap-12">
              <div
                onClick={handleCreateNewBook}
                className="create-new-notebook !p-0 cursor-pointer"
              >
                <div className={`${BOOK_CONFIG.md.container} book-shadow-div`}>
                  <BookCover
                    size="md"
                    className="h-full w-full"
                    style={{ background: CREATE_NEW_COVER_BG }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Row 2 — recents (front) + starter templates */}
          <section className="flex flex-col gap-4 text-ink">
            <h2 className="text-sm uppercase !tracking-[0.1em] text-ink-soft">
              Starter library
            </h2>

            <div className="flex flex-wrap items-start gap-10">
              {recentBooks.map((book) => (
                <div key={`recent-${book.id}`} className="flex flex-col">
                  <div className="group flex flex-col items-center gap-2">
                    <div className="relative">
                      <div
                        onClick={() =>
                          router.push(`/dashboard/books/${book.id}/canvas`)
                        }
                        className={`${BOOK_CONFIG.md.container} book-shadow-div relative cursor-pointer`}
                      >
                        <BookCover
                          size="md"
                          variant={book.coverImage ? "image" : "solid"}
                          title={book.title}
                          // subtitle={book.subtitle || undefined}
                          coverImageUrl={book.coverImage ?? undefined}
                          className="h-full w-full"
                          style={{
                            background:
                              book.background || coverBackgroundVar("g1"),
                          }}
                        />
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            router.push(
                              `/dashboard/books/${book.id}?from=dashboard`
                            );
                          }}
                          aria-label={`Edit cover of ${book.title}`}
                          title="Edit cover"
                          className={`absolute right-2 bottom-2 z-10 opacity-0 backdrop-blur-md transition-[opacity] duration-200 ease-out focus-visible:opacity-100 group-hover:opacity-100 ${btnIcon("sm")} ${btnState.default} ${btnState.hover} ${btnState.active}`}
                        >
                          <PencilRulerIcon strokeWidth={iconStroke("sm")} size={iconPx("sm")} aria-hidden className={iconFixed} />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] ">
                      {formatRelativeTime(book.updatedAt)}
                    </div>
                  </div>
                </div>
              ))}

              {/* {templatesAfterRecents.map((book) => (
                <div key={`template-${book.id}`} className="flex flex-col">
                  <div className="group flex flex-col items-center gap-2">
                    <div className="relative">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => handleTemplateSelect(book.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleTemplateSelect(book.id);
                          }
                        }}
                        className={`${BOOK_CONFIG.md.container} book-shadow-div relative cursor-pointer`}
                      >
                        <BookCover
                          size="md"
                          variant={book.coverImage ? "image" : "solid"}
                          title={book.title}
                          coverImageUrl={book.coverImage ?? undefined}
                          className="h-full w-full"
                          coverGradient={book.coverGradientId}
                        />
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleTemplateCoverEdit(book.id);
                          }}
                          aria-label={`Edit cover of ${book.title}`}
                          title="Edit cover"
                          className={`absolute right-2 bottom-2 z-10 opacity-0 backdrop-blur-md transition-[opacity] duration-200 ease-out focus-visible:opacity-100 group-hover:opacity-100 ${btnIcon("sm")} ${btnState.default} ${btnState.hover} ${btnState.active}`}
                        >
                          <PencilRulerIcon strokeWidth={iconStroke("sm")} size={iconPx("sm")} aria-hidden className={iconFixed} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))} */}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
};

export default Dashboard;
