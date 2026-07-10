/**
 * Cheap, stable content fingerprint (FNV-1a, 32-bit) used to detect when an
 * entry's text has drifted from the text its analysis was generated from.
 * Not cryptographic — collision cost is just one redundant re-analysis.
 */
export const contentHash = (text: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
};
