# Pocket — monthly budget tracker

A device-first budget app using Next.js App Router, TypeScript, Tailwind, Radix UI, Lucide, Recharts and optional Supabase sync. Start immediately without an account, email or database connection.

## Run locally

Requires Node.js 20.9+ and npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Budgets save to this browser's localStorage, even when Supabase environment variables exist. No budget data is sent to the server until the visitor explicitly enables sync and verifies their email. The first visit includes a short, dismissible four-step tooltip tour; replay it from Settings.

On hosts where filesystem events are unavailable:

```sh
WATCHPACK_POLLING=true npm run dev -- --webpack
```

Use the same origin consistently: `localhost` and `127.0.0.1` have different browser storage. Clearing site data or using a different browser removes access to that device copy. Settings includes full JSON backup and restore; the CSV report is not a restorable backup. If browser storage is unavailable, Pocket reports the save error rather than claiming changes were saved.

## Optional sync setup

1. Create a Supabase project and enable Email authentication. No anonymous sign-in is required.
2. Apply `supabase/migrations/002_optional_sync.sql`. It can run independently; migration 001 is only for the original legacy shared workspace and is no longer used by the app.
3. Copy `.env.example` to `.env.local`; set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to a server secret/service-role key. Never use a `NEXT_PUBLIC_` prefix. The privileged key stays behind `server-only` imports.
4. Set `APP_URL` to the app's exact origin (locally `http://127.0.0.1:3000`, production `https://pbt-tracker.vercel.app`). On Vercel, the app also detects the production domain automatically when `APP_URL` is absent or still points to localhost; preview deployments use their preview domain when no valid explicit origin is set. In Supabase Authentication → URL Configuration set Site URL to that origin and add its `/auth/confirm` URL to the redirect allowlist. Email uses the default sign-in link; a server-side PKCE callback exchanges it for a session. Request and open the link in the same browser. Configure custom SMTP for production delivery outside the project team; Supabase's default sender restricts recipients and rate-limits delivery. No email template changes are required.
5. Optionally, a custom SMTP email template can include `{{ .Token }}` instead of a link. The UI supports 6–10 digit code entry too.
6. Restart the app. Email entry appears only after the visitor enables Settings → Sync across devices. Verifying a link opens Settings; the visitor still explicitly chooses whether to upload a device budget or load the cloud copy.

Verification alone never uploads a budget. Users explicitly choose “Turn on sync & upload budget” for a new account, or choose a copy if a cloud budget already exists. Loading a cloud copy preserves the previous device copy in Settings. Replacing an existing cloud copy requires a separate confirmation and offers a backup download. Switching sync off keeps both the device copy and the cloud copy, signs out this device's session, and revokes no other devices.

Each verified account owns one `budget_workspaces` row, containing a versioned JSON snapshot of all its months. Server Actions validate the data, verify the user's session against Supabase Auth, and use the user's JWT for database access. Row-level security restricts reads/inserts/updates to `auth.uid() = user_id`; there is no anonymous table access. Session credentials are in HttpOnly, SameSite cookies; production HTTPS cookies are Secure. `POCKET_LOCAL_HTTP=true` is only for a local production-build test over HTTP.

Changes save on-device first. A failed upload or revision conflict pauses sync and preserves the unsynced edits. Settings lets users choose the cloud copy or explicitly replace it with the device copy. Newer cloud data is never silently overwritten. Reopening a synced device loads the cloud copy only when there are no pending local edits. Other active devices see updates on reload or through Settings → Review cloud copy; this is not live collaboration or automatic merging. Multiple tabs sharing the same browser storage should not edit concurrently.

## Existing shared data

The former `budgets`, `expenses` and `payments` tables are left untouched and are no longer queried by the app. Their service-only access remains unchanged. They are never exposed or assigned to a new visitor. Existing browser budgets remain in `pocket-budget-v1`. To carry old shared data forward, export it privately as a Pocket-format backup and restore it on the owner's device before opting into sync.

## Money rules

All values are integer minor units (100 per unit of each supported currency); actual amounts always sum recorded payments.

- Planned consumption = active allocations (or actual paid if larger), plus retained payments on cancelled items.
- Pending consumption = unpaid portion of active consumption items.
- Savings / forex = active targets (or actual paid if larger), plus retained cancelled contributions.
- Budget remaining = income − planned consumption − savings − forex.
- Cash remaining = income − every payment, including savings and forex deposits.
- Cancelling frees only unpaid allocations. Restoring reinstates them. Deleting removes the item and payments after confirmation.

The initial ₦600,000 salary plan allocates ₦359,000 to consumption, ₦100,000 to savings and ₦50,000 to forex. It leaves ₦91,000 in the budget and ₦600,000 cash before payments. At ₦500,000, the same plan is ₦9,000 over budget. Additional months start empty; copying the previous month includes active recurring items without payments.

## Checks

```sh
npm test
npm run build
npm run typecheck
```

Tests cover financial totals and partial payments, cancellation/restoration, savings, overspending, backup round-trips, malformed records, invalid ownership references, duplicate months/IDs and invalid dates. Validate the deployed email delivery flow with an email address you control. Browser QA uses emulated viewport sizes, not physical iOS/Android devices.

## Mobile and deployment

Phone expenses use labeled cards, 44px touch targets and readable inputs. Bottom navigation respects device safe areas. Dialogs and the tour fit small viewports; keyboard zoom remains enabled. Tablets and desktop retain the table.

Deploy to a Next.js-compatible host. Local-only mode needs no Supabase configuration. Optional sync needs the migration, server-side environment variables, Email auth and working SMTP delivery. The owner-private deployment gate used by the legacy single-workspace app is no longer needed for the authenticated sync architecture.

## Savings in the main budget

Overview includes every allocation, including Savings and existing optional Forex items. The displayed planned/actual expense totals and payment charts include savings contributions. Savings has a separate detail view and progress card, showing only the Savings category as a breakdown of the total. Savings is never subtracted twice: budget remaining is income minus all planned allocations, and cash remaining is income minus all recorded payments. Internal consumption-only totals remain available separately.

## Product analytics

Optional GA4 tracks visits and fixed product actions without requiring a Pocket account. Set `GA_MEASUREMENT_ID` to your web stream’s `G-…` ID in Vercel Production and redeploy. Analytics loads only when `VERCEL_ENV=production`; local and preview traffic is excluded. Disable enhanced measurement in the GA4 web stream: Pocket sends explicit events instead of automatically capturing forms, search text, or links.

Events include `expense_created`, `expense_updated`, `payment_recorded`, `income_updated`, `month_created`, `month_copied`, `csv_exported`, `backup_downloaded`, `backup_restored`, `sync_requested`, `sync_enabled`, `sync_disabled`, `settings_opened`, `view_overview`, `view_savings`, `view_transactions`, `tour_completed`, and `tour_skipped`. Save events fire after successful local persistence. No amounts, expense names, categories, dates, budget IDs, emails, or auth tokens are attached. Page URLs are reduced to the app origin and referrers to their origin. Google Signals and ad personalization are disabled. No session replay is installed.

Users can disable analytics for their browser in Settings → Usage analytics. Changing the preference reloads Pocket; disabled browsers do not load the Google tag. GA4 uses browser cookies, so visitors are browser-based estimates rather than identified people across devices. Ad blockers may prevent measurement. Use GA4 Realtime to verify incoming activity and Reports → Engagement → Events for feature usage after processing.


## Monthly currencies

Settings → Currency for this month supports NGN, USD, GBP, EUR, and GHS. Each month stores its own currency; existing records and version 1 backups without a currency load as NGN. Changing currency never converts or rescales income, expenses, or recorded payments. New months inherit the selected month’s currency. Copying a previous month keeps the destination currency and copies the numeric amounts unchanged.

Dashboard amounts, form labels, chart ticks/tooltips, payment history, and CSV headers use the selected month’s currency. Trends include only months in that currency. JSON backups use version 2 to preserve currency and prevent older clients from silently importing foreign-currency amounts as NGN; version 1 backups remain readable. Supabase snapshots preserve currency via the existing JSON schema, so no database migration is required.
