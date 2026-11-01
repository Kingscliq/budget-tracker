import test from "node:test";
import assert from "node:assert/strict";
import { appOrigin } from "../lib/app-origin";
test("local development keeps its local callback", () => {
  assert.equal(appOrigin({}), "http://127.0.0.1:3000");
  assert.equal(
    appOrigin({ APP_URL: "http://localhost:3000/" }),
    "http://localhost:3000",
  );
});
test("Vercel production selects the stable public domain", () => {
  assert.equal(
    appOrigin({
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "pbt-tracker.vercel.app",
      VERCEL_URL: "pbt-tracker-123.vercel.app",
    }),
    "https://pbt-tracker.vercel.app",
  );
});
test("a local APP_URL cannot send hosted users back to localhost", () => {
  assert.equal(
    appOrigin({
      APP_URL: "http://127.0.0.1:3000",
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "pbt-tracker.vercel.app",
    }),
    "https://pbt-tracker.vercel.app",
  );
});
test("a valid explicit custom domain takes precedence", () => {
  assert.equal(
    appOrigin({
      APP_URL: "https://budget.example.com/",
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "pbt-tracker.vercel.app",
    }),
    "https://budget.example.com",
  );
});
test("preview deployments use their own origin and hosted apps fail closed without one", () => {
  assert.equal(
    appOrigin({
      VERCEL_ENV: "preview",
      VERCEL_URL: "preview.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "pbt-tracker.vercel.app",
    }),
    "https://preview.vercel.app",
  );
  assert.throws(() => appOrigin({ VERCEL_ENV: "production" }));
});
test("reject credentials, non-web schemes and callback paths in APP_URL", () => {
  for (const url of [
    "javascript:alert(1)",
    "https://user:secret@example.com",
    "https://example.com/auth/confirm",
    "https://example.com?next=evil",
  ])
    assert.throws(() => appOrigin({ APP_URL: url }));
});
