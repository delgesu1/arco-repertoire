/**
 * Where the repertoire site sends people who want Arco, and how those links are tagged.
 * Placements: a line on every piece page ("piece"), the footer ("footer"), the return-visit card ("peek"),
 * and the iOS smart banner in Safari ("banner", set up in the page metadata).
 */
export const APP_STORE_ID = "6757969709";
export const APP_STORE_URL = "https://apps.apple.com/us/app/arco-ai/id6757969709";
export const ARCO_START_URL = "https://arco.app/start";

export type Placement = "piece" | "footer" | "peek" | "banner" | "site";

/** The free web start page, tagged with the placement. */
export const arcoWebUrl = (from: Placement) =>
  `${ARCO_START_URL}?utm_source=repertoire&utm_medium=site&utm_campaign=${from}`;

/** The App Store page with a campaign token (add `pt=<provider token>` from App Store Connect to see it in App Analytics). */
export const appStoreUrl = (from: Placement) => `${APP_STORE_URL}?ct=repertoire-${from}`;

/** Safari on iPhone and iPad draws its own install/open banner from this meta tag; `url` is handed to the app when someone taps OPEN. */
export const smartBanner = (url: string) => ({ "apple-itunes-app": `app-id=${APP_STORE_ID}, app-argument=${url}` });

/** One smart link for links that cannot know the device: iPhone and iPad go to the App Store, everyone else to the web page. */
export const arcoLink = (from: Placement) => `/get-arco?from=${from}`;
