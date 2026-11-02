import test from "node:test";
import assert from "node:assert/strict";
import { analyticsConfig, trackEvent } from "../lib/analytics";

test("analytics strips callback credentials and private URL parameters", () => {
  const config = analyticsConfig(
    "https://pbt-tracker.vercel.app/auth/confirm?code=private#token",
    "https://mail.example.com/inbox/private-message?email=private@example.com",
  );
  assert.equal(config.page_location, "https://pbt-tracker.vercel.app/");
  assert.equal(config.page_referrer, "https://mail.example.com");
  assert.equal(config.allow_google_signals, false);
  assert.equal(config.allow_ad_personalization_signals, false);
  assert.equal(JSON.stringify(config).includes("private"), false);
});
test("analytics accepts direct visits and does nothing on the server", () => {
  assert.equal(
    analyticsConfig("https://pbt-tracker.vercel.app", "").page_referrer,
    "",
  );
  assert.doesNotThrow(() => trackEvent("payment_recorded"));
});
