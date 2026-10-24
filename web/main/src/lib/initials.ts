/**
 * Up to two letters for a name, from the words that start with a letter:
 * "Ayesha Siddiqui" is "AS", "Cashews 250g" is "CA", not "C2".
 */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter((word) => /^\p{L}/u.test(word));
  const letters =
    words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? name.trim()).slice(0, 2);
  return letters.toUpperCase();
}

/**
 * Soft tile colours, picked by name so the same customer or product keeps
 * the same colour on every screen and every visit — people learn "the
 * green one" faster than they read. Each pair is >= 4.5:1 in both themes.
 */
const SWATCHES = [
  "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-200",
  "bg-teal-100 text-teal-800 dark:bg-teal-400/15 dark:text-teal-200",
  "bg-orange-100 text-orange-800 dark:bg-orange-400/15 dark:text-orange-200",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-400/15 dark:text-indigo-200",
];

export function swatchFor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return SWATCHES[Math.abs(hash) % SWATCHES.length];
}
