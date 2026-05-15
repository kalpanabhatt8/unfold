/**
 * Pixel offset of the caret inside a `<textarea>`, relative to the element's
 * border box top-left (same origin as stacking `getBoundingClientRect()`).
 *
 * Uses a short-lived off-screen mirror element so layout matches **soft
 * wrapping** — `canvas.measureText` + newline heuristics cannot.
 *
 * @see https://github.com/component/textarea-caret-position (classic approach)
 */

const COPY_STYLE_KEYS: readonly (keyof CSSStyleDeclaration)[] = [
  "boxSizing",
  "direction",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "fontVariant",
  "letterSpacing",
  "textTransform",
  "textAlign",
  "textIndent",
  "lineHeight",
  "whiteSpace",
  "wordSpacing",
  "tabSize",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderTopStyle",
  "borderRightStyle",
  "borderBottomStyle",
  "borderLeftStyle",
];

export function getTextareaCaretOffsetInTextareaPx(
  el: HTMLTextAreaElement,
  position: number
): { left: number; top: number } | null {
  if (typeof document === "undefined" || !document.body) return null;

  const safe = Math.max(0, Math.min(position, el.value.length));
  const taRect = el.getBoundingClientRect();
  if (taRect.width < 2 || taRect.height < 2) return null;

  const div = document.createElement("div");
  try {
    const cs = window.getComputedStyle(el);
    const st = div.style;

    for (const key of COPY_STYLE_KEYS) {
      const val = cs[key];
      if (typeof val === "string" && val.length > 0) {
        Reflect.set(st, key, val);
      }
    }

    st.width = `${el.clientWidth}px`;
    st.height = "auto";
    st.minHeight = `${el.scrollHeight}px`;
    st.overflow = "hidden";
    st.wordWrap = "break-word";
    st.overflowWrap = "break-word";
    st.position = "fixed";
    st.left = "-99999px";
    st.top = "0";
    st.visibility = "hidden";
    st.zIndex = "-1";
    st.pointerEvents = "none";

    const tab =
      cs.getPropertyValue("tab-size") ||
      (cs as unknown as { MozTabSize?: string }).MozTabSize;
    if (tab) st.tabSize = tab;

    div.appendChild(document.createTextNode(el.value.slice(0, safe)));
    const span = document.createElement("span");
    span.textContent = el.value.slice(safe) || "\u200b";
    div.appendChild(span);

    document.body.appendChild(div);

    const spanRect = span.getBoundingClientRect();
    const left = spanRect.left - taRect.left;
    const top = spanRect.top - taRect.top;
    if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
    return { left, top };
  } catch {
    return null;
  } finally {
    div.remove();
  }
}
