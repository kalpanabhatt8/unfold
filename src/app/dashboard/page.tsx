"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PencilRulerIcon } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { starterBookTemplates } from "@/data/book-templates";
import { coverBackgroundVar } from "@/data/cover-gradients";
import {
  readRecentBooks,
  RECENT_BOOKS_STORAGE_KEY,
  type RecentBook,
} from "@/lib/recent-books";

/* ✅ SIZE SYSTEM */
type BookSize = "sm" | "md" | "smd" | "lg" | "xl" | "2xl" | "3xl";

const BOOK_SIZES: Record<BookSize, string> = {
  sm: "w-[8.625rem] h-[12.125rem]",
  md: "w-[9.5rem] h-[13rem]",
  smd: "w-[10.5rem] h-[15rem]",
  lg: "w-[14.125rem] h-[19.875rem]",
  xl: "w-[16.875rem] h-[23.75rem]",
  "2xl": "w-[19.75rem] h-[27.75rem]",
  "3xl": "w-[22.5rem] h-[31.625rem]",
};

const CREATE_NEW_COVER_BG =
  "linear-gradient(to bottom, #EBEDF0 0%, #E3E8EC 100%)";

const Dashboard = () => {
  const router = useRouter();
  const [recentBooks, setRecentBooks] = useState<RecentBook[]>([]);

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
    if (typeof window === "undefined") return;

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
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

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
    router.push(`/dashboard/books/${draftId}?template=blank`);
  };

  const handleTemplateSelect = (templateId: string) => {
    const draftId = createDraftId(templateId);
    router.push(`/dashboard/books/${draftId}/canvas?template=${templateId}`);
  };

  return (
    <main className="min-h-screen w-full">

    <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 md:px-10 lg:px-16 pt-12 sm:pt-14 md:pt-16 pb-12 md:pb-16">
  
      
    <section className="flex flex-col gap-12 md:gap-20">
          {/* Row 1 — create new */}
          <section className="flex flex-col gap-4">
            {/* <h2 className="text-[0.75rem] !tracking-[0.1em] uppercase text-ink-soft">
              Create new
            </h2> */}
            <div className="flex flex-wrap items-start gap-12">
              <div
                onClick={handleCreateNewBook}
                className="create-new-notebook !p-0 cursor-pointer"
              >
                <div className={`${BOOK_SIZES.md} book-shadow-div`}>
                  <BookCover
                    className="h-full w-full"
                    style={{ background: CREATE_NEW_COVER_BG }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Row 2 — recents (front) + starter templates */}
          <section className="flex flex-col gap-4 text-ink">
            <h2 className="text-[0.75rem] uppercase !tracking-[0.1em] text-ink-soft">
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
                        className={`${BOOK_SIZES.md} book-shadow-div relative cursor-pointer`}
                      >
                        <BookCover
                          variant={book.coverImage ? "image" : "solid"}
                          title={book.title}
                          // subtitle={book.subtitle || undefined}
                          coverImageUrl={book.coverImage ?? undefined}
                          titleColor={book.titleColor ?? undefined}
                          // subtitleColor={book.subtitleColor ?? undefined}
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
                          className="absolute right-2 bottom-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-icon)]/65 opacity-0 backdrop-blur-md transition-[opacity,background-color,color] duration-200 ease-out hover:bg-[var(--color-iconbutton)] hover:text-[var(--color-icon)] focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black/30 focus-visible:outline-offset-2 group-hover:opacity-100"
                        >
                          <PencilRulerIcon strokeWidth={1.85} size={18} aria-hidden />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] ">
                      {formatRelativeTime(book.updatedAt)}
                    </div>
                  </div>
                </div>
              ))}

              {templatesAfterRecents.map((book) => (
                <button
                  key={`template-${book.id}`}
                  type="button"
                  onClick={() => handleTemplateSelect(book.id)}
                  className="book-tilted-hover"
                >
                  <div className={`${BOOK_SIZES.md} book-shadow-div`}>
                    <BookCover
                      variant={book.coverImage ? "image" : "solid"}
                      title={book.title}
                      // subtitle={book.subtitle}
                      coverImageUrl={book.coverImage ?? undefined}
                      className="h-full w-full"
                      coverGradient={book.coverGradientId}
                    />
                  </div>
                </button>
              ))}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
};

export default Dashboard;
