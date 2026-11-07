"use client";
import Script from "next/script";
import { useEffect, useState } from "react";
import { analyticsConfig } from "@/lib/analytics";

export function Analytics({ measurementId }: { measurementId: string }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    try {
      // Migration pages never load third-party scripts while handling a budget.
      if (location.pathname.startsWith("/migrate")) return;
      setEnabled(localStorage.getItem("pocket-analytics") !== "off");
    } catch {
      /* Leave analytics off if browser storage is unavailable. */
    }
  }, []);
  if (!enabled) return null;
  return (
    <Script
      id="pocket-google-analytics"
      src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      strategy="afterInteractive"
      onReady={() => {
        if (window.pocketAnalyticsReady) return;
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () {
          window.dataLayer!.push(arguments);
        };
        window.gtag("js", new Date());
        window.gtag(
          "config",
          measurementId,
          analyticsConfig(location.origin, document.referrer),
        );
        window.pocketAnalyticsReady = true;
      }}
    />
  );
}
