/** Only fixed product actions are accepted. Never pass budget or account data. */
export type AnalyticsEvent =
  | "expense_created"
  | "expense_updated"
  | "payment_recorded"
  | "income_updated"
  | "month_created"
  | "month_copied"
  | "csv_exported"
  | "backup_downloaded"
  | "backup_restored"
  | "sync_enabled"
  | "sync_disabled"
  | "sync_requested"
  | "settings_opened"
  | "view_overview"
  | "view_savings"
  | "view_transactions"
  | "tour_completed"
  | "tour_skipped";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    pocketAnalyticsReady?: boolean;
  }
}
export function trackEvent(name: AnalyticsEvent) {
  try {
    if (
      typeof window === "undefined" ||
      !window.pocketAnalyticsReady ||
      localStorage.getItem("pocket-analytics") === "off"
    )
      return;
    window.gtag?.("event", name);
  } catch {
    /* Analytics must never interrupt budgeting. */
  }
}

export function analyticsConfig(origin: string, referrer: string) {
  let referringOrigin = "";
  try {
    referringOrigin = new URL(referrer).origin;
  } catch {
    /* Direct visit. */
  }
  return {
    send_page_view: true,
    page_location: `${new URL(origin).origin}/`,
    page_referrer: referringOrigin,
    page_title: "Pocket — Your monthly budget",
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  };
}
