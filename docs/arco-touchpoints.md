# Arco touchpoints on the repertoire site

Four quiet ways to put Arco (arco.app, "The lesson ends. The teaching stays.") in front of visitors, shipped 2026-10-10.
Principle: pitch Arco where the visitor has just chosen a piece, because Arco begins after that choice (the lessons on it);
never block the page, never interrupt search or the Ask panel.

| # | Placement | Where | When | Code |
|---|---|---|---|---|
| 2 | A line on the piece page | under the links of every piece page and piece sheet | always | `components/ArcoLine.tsx` (used by `PieceDetail`) |
| 4 | Footer "Made by Arco" | footer of every page | always | `components/ArcoFooter.tsx` |
| 5 | Return-visit card | one slim line, bottom left | second visit (after 15 s) or the third piece opened in a session | `components/ArcoPeek.tsx` |
| 6 | iOS Smart App Banner | top of Safari on iPhone and iPad | on arrival, until dismissed | `smartBanner()` in `lib/arco.ts`, used by `app/page.tsx` and the piece page metadata |

## Wording and links (Daniel's rules, 2026-10-10)
- Every text link reads **"Try Arco for free"** and goes to **arco.app** (never to a "start" page, and no "free on the web" wording).
- The **App Store badge** (iPhone/iPad footer) and the **QR code** (desktop footer) go to **Arco in the App Store**.
- Piece line: the five étude sets with individual studies (Kreutzer, Rode, Dont, Fiorillo, Gaviniès) read "Your teacher's comments on Kreutzer No. 2, kept in Arco."; every other piece reads "Working on this with a teacher? Arco turns the lesson into notes you can practise from."
- Footer: "The lesson ends. The teaching stays." and one sentence on what Arco does. No quote and no platform fine print.
- Return-visit card: "Teaching or learning violin? Arco turns every lesson into notes." + "Try Arco for free".
- All links live in `lib/arco.ts` (`arcoUrl`, `appStoreUrl`); change a destination there.

## Behaviour
- **Footer:** `html[data-platform]` (`desktop` | `ios` | `android`) is set by the inline script in `app/layout.tsx` (iPad counts as `ios` through `maxTouchPoints`). Desktop shows the QR code, iPhone/iPad show Apple's badge (the same SVG as arco.app), Android shows only the text link (Arco has no Android app).
- **Return-visit card:** never on a first visit, never on iPhone/iPad (the banner does that job), never while the Ask panel or a piece sheet is open, one dismissal silences it for 30 days, a click for good. State lives in `localStorage["arco-peek-v1"]` and `sessionStorage` (`arco-peek-counted`, `arco-peek-seen`); no cookies, no personal data. `?promo=peek` shows it for review.
- **Smart banner:** `<meta name="apple-itunes-app" content="app-id=6757969709, app-argument=<page url>">` on the home page and piece pages only. Safari shows VIEW (not installed) or OPEN (installed) and passes `app-argument` to the app.

## Measuring
- Text links carry `utm_source=repertoire&utm_medium=site&utm_campaign=<piece|footer|peek>` (arco.app's own analytics sees them).
- App Store links carry `ct=repertoire-footer`; add `pt=<provider token>` from App Store Connect → App Analytics → Campaigns (in `appStoreUrl()`) to see installs per placement. The QR code in `public/brand/arco-appstore-qr.svg` encodes the plain App Store URL; regenerate it when a campaign token is added.
- Not built, on purpose: a header link and a note in the Ask panel (a prototype of both is on the local branch `arco-promo-mockups`, commit 2d20503). A first version had a `/get-arco` redirect (iPhone to the App Store, others to arco.app/start); it was removed the same day in favour of direct links.
