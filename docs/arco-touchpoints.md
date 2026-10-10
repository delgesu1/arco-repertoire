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

## Behaviour
- **Piece line:** the five étude sets with individual studies (Kreutzer, Rode, Dont, Fiorillo, Gaviniès) read "Your teacher's comments on Kreutzer No. 2, kept in Arco."; every other piece reads "Working on this with a teacher? Arco turns the lesson into notes you can practise from."
- **Footer:** the way into the app follows the device. `html[data-platform]` (`desktop` | `ios` | `android`) is set by the inline script in `app/layout.tsx` (iPad counts as `ios` through `maxTouchPoints`). Desktop shows a QR code to the App Store page, iPhone/iPad show Apple's badge (the same SVG as arco.app), Android shows only "Start free on the web" (Arco has no Android app). The founder line is Daniel's.
- **Return-visit card:** never on a first visit, never on iPhone/iPad (the banner does that job), never while the Ask panel or a piece sheet is open, one dismissal silences it for 30 days, a click for good. State lives in `localStorage["arco-peek-v1"]` and `sessionStorage` (`arco-peek-counted`, `arco-peek-seen`); no cookies, no personal data. `?promo=peek` shows it for review.
- **Smart banner:** `<meta name="apple-itunes-app" content="app-id=6757969709, app-argument=<page url>">` on the home page and piece pages only. Safari shows VIEW (not installed) or OPEN (installed) and passes `app-argument` to the app.

## Links and measuring
- `/get-arco?from=<piece|footer|peek|banner>` (`app/get-arco/route.ts`) is the one smart link: iPhone/iPad → the App Store page, everyone else → `https://arco.app/start`. It is `no-store`, `noindex` and disallowed in `robots.txt`. Change the destination there, in one place.
- Web links carry `utm_source=repertoire&utm_medium=site&utm_campaign=<placement>` (arco.app's own analytics sees them). App Store links carry `ct=repertoire-<placement>`; add `pt=<provider token>` from App Store Connect → App Analytics → Campaigns (in `appStoreUrl()` in `lib/arco.ts`) to see installs per placement.
- Not built, on purpose: a header link and a note in the Ask panel (a prototype of both is on the local branch `arco-promo-mockups`, commit 2d20503).

## Checked before shipping
Type check, lint, unit tests and a production build; the smart link with desktop, iPhone and Android user agents (302 to the right place); the banner meta tag on home and piece pages and not on others; the card on a first visit (absent), second visit (after 15 s), third piece (hidden while the sheet is open, shown when it closes), dismissal (30 days) and on iPhone (never); the footer on desktop, iPhone and Android.
