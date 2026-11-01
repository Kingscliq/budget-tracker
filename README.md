# Pocket — monthly budget tracker

A responsive, single-user budget app using Next.js App Router, strict TypeScript, Tailwind CSS, shadcn-style Radix UI components, Lucide, Recharts and Supabase. No login or separate backend.

## Run locally

Requires Node.js 20.9+ and npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Without database environment variables, the app explicitly uses **demo mode**: data is saved in this browser's localStorage, not Supabase. Demo data is isolated from database data and is not automatically imported when connecting Supabase. Clear site data to reset the demo.

## Connect Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/001_budget.sql` in its SQL editor (or apply with the Supabase CLI).
3. Copy `.env.example` to `.env.local` and fill `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` with your project's URL and server secret/service-role key. These have no `NEXT_PUBLIC_` prefix and the client is protected by `server-only`.
4. Set `BUDGET_PRIVATE_ACCESS_CONFIRMED=true` only when running locally or behind a private access gateway. Restart the server. The indicator will say “Connected to Supabase”.

The app intentionally has no authentication. Database-backed pages AND Server Actions must stay behind the same private access boundary. Keep the development server bound to loopback; do not expose an unprotected production deployment. The flag is an explicit configuration acknowledgement, not an access-control mechanism. Database tables have RLS enabled without browser access policies; mutations use server-only actions. Database errors are logged server-side and shown as generic errors in the UI.

The first database month is seeded atomically with the twelve default allocations and zero payments. Additional months start empty. “Copy previous month” is available on empty months only: it copies income and active recurring allocations, resets payment history and excludes cancelled and one-off items. November 2026 is not hardcoded; the initial month follows the browser's date.

## Money rules

All values are integer kobo (₦1 = 100 kobo). Actual amounts always sum payment records. Inputs accept at most two decimal places and up to ₦1 billion per amount.

- Planned expenses = active consumption allocations (or actual paid if larger) plus retained payments on cancelled items.
- Pending expenses = unpaid portion of active consumption items.
- Savings / forex allocated = active target (or actual paid if larger), plus retained cancelled contributions.
- Budget remaining = income − planned expenses − savings allocated − forex allocated.
- Cash remaining = income − every recorded payment, including savings and forex deposits.
- Cancelling frees only the unpaid allocation, retains actual payments and shows Cancelled. Restoring brings the allocation back. Deleting removes the item and its payment history after confirmation.
- Payments may exceed their target; the plan then grows to cover the actual amount. Paid means actual ≥ expected. Removing an erroneous payment recalculates status and all totals.

At ₦600,000 income, defaults allocate ₦359,000 to consumption, ₦100,000 to savings and ₦50,000 to forex. This leaves ₦91,000 in the budget and ₦600,000 cash before payments. At ₦500,000 the same plan is ₦9,000 over budget.

## Verification and deployment

```sh
npm test
npm run typecheck
npm run build
npm start
```

Tests cover default totals, partial and multiple payments, cancellation/restoration, savings, overspending, salary scenarios and input validation. SQL is supplied for your own Supabase project; it requires integration verification after connection. CSV export includes all monthly allocations and their payment status. Multiple open browser tabs do not live-sync; reload to see changes made elsewhere.

Deploy to a Next.js-compatible host with an external owner-only access gateway and server environment variables. Do not deploy database-backed mode to a public unauthenticated URL. No Supabase account or production hosting is provisioned by this repository.

## Mobile layout

At phone widths (up to 640px), expenses become labeled cards with all actions in view, larger touch targets, full-width search and add controls, and readable form fields. The bottom navigation accounts for device safe areas. Forms scroll within the available viewport; zoom remains enabled. Tablets and desktops retain the expense table.

Responsive QA uses browser viewports at 320, 390, 430, 768 and 1440px, checks document overflow and phone touch targets, and opens the expense and payment forms. These checks emulate viewport sizes; they are not physical iOS/Android device tests.
