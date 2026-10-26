/**
 * The top of a section's list (design/atlas-brand-options.html, option D revised): how many works and composers the
 * section has, and what Atlas is and who made it. The loading skeletons show the same block, so the page does not jump.
 */
export function Ledger({ works, label, composers, intro }: { works: number; label: string; composers: number; intro: string }) {
  return (
    <div className="ledger">
      <div className="stat">
        <b>{works.toLocaleString("en")}</b>
        <span>{label}</span>
      </div>
      <div className="stat">
        <b>{composers.toLocaleString("en")}</b>
        <span>composers</span>
      </div>
      <p className="desc">
        {intro} Created by{" "}
        <a href="https://www.kurganov.org" target="_blank" rel="noopener">
          Daniel Kurganov
        </a>
        .
      </p>
    </div>
  );
}
