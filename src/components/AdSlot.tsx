"use client";

import { useEffect, useRef } from "react";

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
const SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT;

/**
 * One Google AdSense ad. Renders nothing until NEXT_PUBLIC_ADSENSE_CLIENT and
 * NEXT_PUBLIC_ADSENSE_SLOT are set, so the app looks the same without ads.
 */
export function AdSlot() {
  const pushed = useRef(false);
  useEffect(() => {
    if (!CLIENT || !SLOT || pushed.current) return;
    pushed.current = true;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch {
      // An ad blocker or a missing script just means no ad.
    }
  }, []);

  if (!CLIENT || !SLOT) return null;
  return (
    <aside aria-label="Advertisement" className="mt-6 overflow-hidden rounded-2xl bg-card p-3">
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={CLIENT}
        data-ad-slot={SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
