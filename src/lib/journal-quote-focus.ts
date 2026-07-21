import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import "@/lib/storage-namespace";

const STORAGE_PREFIX = "unfold-journal-quote:";

/** Stash a quote so the journal page can highlight it after navigation. */
export const stashJournalQuoteFocus = (
  entryId: string,
  quote: string,
): void => {
  const trimmed = quote.trim();
  if (!trimmed) return;
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${entryId}`, trimmed);
  } catch {
    /* private mode / quota */
  }
};

/** Read and clear a stashed quote for this entry (one-shot). */
export const takeJournalQuoteFocus = (entryId: string): string | null => {
  try {
    const key = `${STORAGE_PREFIX}${entryId}`;
    const value = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return value?.trim() ? value.trim() : null;
  } catch {
    return null;
  }
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeWs = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

type FlatInline = {
  text: string;
  /** Doc position of each character in `text`. */
  indexToPos: number[];
};

const flattenInline = (
  block: ProseMirrorNode,
  contentStart: number,
): FlatInline => {
  let text = "";
  const indexToPos: number[] = [];

  block.forEach((child, offset) => {
    const abs = contentStart + offset;
    if (child.isText && child.text) {
      for (let i = 0; i < child.text.length; i++) {
        indexToPos.push(abs + i);
        text += child.text[i];
      }
      return;
    }
    if (child.type.name === "hardBreak") {
      indexToPos.push(abs);
      text += "\n";
    }
  });

  return { text, indexToPos };
};

const findInFlat = (
  flat: FlatInline,
  needle: string,
): { from: number; to: number } | null => {
  if (!needle || flat.text.length === 0) return null;

  const exact = flat.text.indexOf(needle);
  if (exact >= 0) {
    const end = exact + needle.length;
    return {
      from: flat.indexToPos[exact]!,
      to: flat.indexToPos[end - 1]! + 1,
    };
  }

  const normalized = normalizeWs(needle);
  if (!normalized) return null;

  const parts = normalized.split(" ").map(escapeRegExp);
  const re = new RegExp(parts.join("\\s+"));
  const match = re.exec(flat.text);
  if (!match || match.index === undefined) return null;

  const start = match.index;
  const end = start + match[0].length;
  return {
    from: flat.indexToPos[start]!,
    to: flat.indexToPos[end - 1]! + 1,
  };
};

/**
 * Locate a journal quote inside a TipTap doc.
 * Prefers a single block match (typical for passage excerpts).
 */
export const findQuoteRange = (
  doc: ProseMirrorNode,
  quote: string,
): { from: number; to: number } | null => {
  const needle = quote.trim();
  if (!needle) return null;

  let found: { from: number; to: number } | null = null;

  doc.descendants((node, pos) => {
    if (found || node.type.name !== "journalBlock") return;
    found = findInFlat(flattenInline(node, pos + 1), needle);
  });

  return found;
};
