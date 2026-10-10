/**
 * Where the repertoire site sends people who want Arco, and how those links are tagged.
 * Text links ("Try Arco for free") go to arco.app; the App Store badge and the QR code go to Arco in the App Store.
 * Placements: a line on every piece page ("piece"), the footer ("footer"), the return-visit card ("peek"); the iOS
 * smart banner in Safari is set up in the page metadata.
 */
export const APP_STORE_ID = "6757969709";
export const APP_STORE_URL = "https://apps.apple.com/us/app/arco-ai/id6757969709";
export const ARCO_URL = "https://arco.app";

export type Placement = "piece" | "footer" | "peek";

/** arco.app, tagged with the placement (arco.app's own analytics sees utm_campaign). */
export const arcoUrl = (from: Placement) =>
  `${ARCO_URL}/?utm_source=repertoire&utm_medium=site&utm_campaign=${from}`;

/** The App Store page with a campaign token (add `pt=<provider token>` from App Store Connect to see it in App Analytics). */
export const appStoreUrl = (from: Placement) => `${APP_STORE_URL}?ct=repertoire-${from}`;

/** Safari on iPhone and iPad draws its own install/open banner from this meta tag; `url` is handed to the app when someone taps OPEN. */
export const smartBanner = (url: string) => ({ "apple-itunes-app": `app-id=${APP_STORE_ID}, app-argument=${url}` });
