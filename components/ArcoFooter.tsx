import { appStoreUrl, arcoUrl } from "@/lib/arco";
import { ExternalIcon } from "./icons";

/**
 * "Made by Arco": the quiet home for anyone who wants to look later. "Try Arco for free" goes to arco.app everywhere; the way
 * into the App Store follows the device (html[data-platform] is set by the inline script in the layout): a QR code on desktop,
 * Apple's badge on iPhone and iPad, nothing extra on Android (no Android app).
 */
export function ArcoFooter() {
  return (
    <section className="arco-foot" aria-labelledby="arco-foot-title">
      <div className="txt">
        <span className="label">Made by Arco</span>
        <h2 id="arco-foot-title" className="head">
          The lesson ends. The teaching stays.
        </h2>
        <p className="sub">Arco records your music lessons and turns them into notes you can practise from.</p>
        <div className="cta">
          <a className="app-badge" href={appStoreUrl("footer")} target="_blank" rel="noopener">
            {/* Apple's own badge artwork, as on arco.app */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/app-store-badge.svg" alt="Download on the App Store" width={132} height={44} />
          </a>
          <a className="link-underline" href={arcoUrl("footer")} target="_blank" rel="noopener">
            Try Arco for free <ExternalIcon />
          </a>
        </div>
      </div>
      <a className="qr" href={appStoreUrl("footer")} target="_blank" rel="noopener">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/arco-appstore-qr.svg" alt="QR code for Arco on the App Store" width={104} height={104} />
        <span>Scan with your iPhone</span>
      </a>
    </section>
  );
}
