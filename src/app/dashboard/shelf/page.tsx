"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ShelfPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return null;
}

/** Shelf page — disabled; original implementation kept below for reference. */
const __shelf_page_disabled = String.raw`
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Bookshelf } from "@/components/bookshelf/bookshelf";
import {
  btnRadius,
  btnState,
  btnText,
  iconFixed,
  iconPx,
  iconStroke,
} from "@/components/ui/button-system";
import {
  readRecentBooks,
  RECENT_BOOKS_STORAGE_KEY,
  RECENTS_UPDATED_EVENT,
  type RecentBook,
} from "@/lib/recent-books";

export default function ShelfPage() {
  const router = useRouter();
  const [books, setBooks] = useState<RecentBook[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return readRecentBooks();
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const load = () => {
      try {
        setBooks(readRecentBooks());
      } catch (error) {
        console.error("Failed to read recents", error);
      }
    };

    load();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === RECENT_BOOKS_STORAGE_KEY) load();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(RECENTS_UPDATED_EVENT, load);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(RECENTS_UPDATED_EVENT, load);
    };
  }, []);

  return (
    <main className="flex min-h-screen w-full flex-col">
      <header className="flex shrink-0 items-center justify-between px-4 py-4 sm:px-6 md:px-10">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className={\`px-3 \${btnRadius.pill} \${btnText("sm")} \${btnState.default} \${btnState.hover} \${btnState.active}\`}
          aria-label="Back to dashboard"
        >
          <ArrowLeft
            strokeWidth={iconStroke("sm")}
            size={iconPx("sm")}
            aria-hidden
            className={iconFixed}
          />
          Back
        </button>
        <h1 className="text-sm uppercase tracking-[0.1em] text-ink-soft">Shelf</h1>
        <span className="w-[72px]" aria-hidden />
      </header>

      <section className="flex min-h-0 flex-1 flex-col justify-end px-4 pt-6 sm:px-6 md:px-10 lg:px-16">
        {books.length === 0 ? (
          <p className="text-center text-sm text-[var(--text-secondary)]">
            No books on your shelf yet.
          </p>
        ) : (
          <Bookshelf
            books={books}
            mapVerticalScroll
            className="px-1"
            onBookClick={(book) => router.push(\`/dashboard/books/\${book.id}/canvas\`)}
          />
        )}
      </section>
    </main>
  );
}
`;

void __shelf_page_disabled;
