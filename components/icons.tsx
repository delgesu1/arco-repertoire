/** "Opens elsewhere" arrow. Drawn as SVG because iOS renders the ↗ character as an emoji. */
export function ExternalIcon() {
  return (
    <svg className="ext" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3.5 8.5l5-5M4.5 3.5h4v4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MinimizeIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 6.5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
