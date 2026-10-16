/** Names and addresses shared by the data builds (scripts/build-data.ts, scripts/build-chamber.ts), so a composer's slug is the same in both. */
export const fold = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/ł/g, "l").replace(/ø/g, "o");
export const slugify = (s: string, max = 80) =>
  fold(s)
    .toLowerCase()
    .replace(/['’"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max)
    .replace(/-$/, "");

export const firstLast = (name: string) => {
  const i = name.indexOf(", ");
  return i < 0 ? name : `${name.slice(i + 2)} ${name.slice(0, i)}`;
};
export const surname = (name: string) => name.split(", ")[0];
