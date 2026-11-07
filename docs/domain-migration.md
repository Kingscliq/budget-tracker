# Browser budget migration

Pocket's original origin is https://pbt-tracker.vercel.app and the destination is https://budg-tracker.vercel.app.

## Deployment requirement

Both domains must serve the **same Production deployment directly**. Do not configure a Vercel redirect on the old domain: a redirect runs before JavaScript can read that origin's local storage. Keep the old hostname and its TLS certificate active for existing users. Do not delete their source copy or set an automatic migration expiry.

## User flow

- A visit to the old home page checks the existing device budget **before** mounting the dashboard or creating default data.
- If a verified migration receipt matches the source snapshot, subsequent visits go directly to the new origin. A `?recover=1` visit deliberately bypasses the receipt.
- Otherwise the old page opens the new origin's `/migrate` receiver. Where browser pop-up policy requires a gesture, the page displays **Move my budget**. This click is a browser requirement, not an email/account requirement.
- The two windows exchange a bounded, validated budget via `postMessage`, using an exact origin, exact window reference and a random nonce per attempt. Budget contents, account credentials, email addresses and sessions never go in URLs or requests. Only the random nonce is initially in the fragment, then removed. Migration receivers do not load Google Analytics.
- An empty destination imports automatically. An identical destination requires no replacement. A different destination asks the user to choose. No merging or automatic conflict resolution is attempted.
- Before replacing a destination, the old destination is saved as `pocket-previous-device-copy` (downloadable from Settings). The incoming validated snapshot is also saved at `pocket-domain-import-backup-v1`. A concurrent destination edit aborts the move.
- A read-back of the main budget must match before sending success. The source is retained; a failed save rolls back the destination. Quota, validation, connection and storage failures leave a retry/original-app path.
- On success the temporary window closes and the original tab opens the new dashboard. Cloud sessions are not transferred. Replacement pauses destination sync; users can reconnect in Settings, explicitly choosing their desired cloud/device copy. Analytics opt-out and completed onboarding are carried over, without transferring authentication.
- New-domain visitors get a dismissible recovery link. Recovery from a previously visited new domain may need this link because browsers isolate/partition cross-site storage. A bulk server script cannot read device-only budgets.
- `?stay=1` at the old origin is an escape hatch to the original dashboard and its normal Backup & restore controls. Old-origin sign-in callbacks stay there so authentication can finish.

## Local browser verification

Run development with:

```sh
POCKET_MIGRATION_SOURCE_ORIGIN=http://localhost:3100 \
POCKET_MIGRATION_TARGET_ORIGIN=http://127.0.0.1:3100 \
npm run dev -- --port 3100 --hostname :: --webpack
```

The override only accepts two loopback origins and is unavailable on Vercel. To verify a local production build, run `npm run build -- --webpack`, then set the same origins plus `POCKET_MIGRATION_LOCAL_TEST=1` when running `npm run start -- --port 3100 --hostname ::`. Hosted production origins are fixed in `lib/domain-migration.ts`.

Create a disposable source budget at `http://localhost:3100/?stay=1`, then visit its home page. Test empty, identical, and differing destinations; preserve/replace choice; closed/blocked window; reload after import; and the receipt redirect. Use the same browser profile. Never clear or overwrite a real user's storage for testing.

Automated tests cover validated transfer data, notes/currency/payments, destination backups, cloud pause, concurrent destination edits, quota failure, failed read-back rollback and spoofed origins/windows/nonces.

## Limits

Users must revisit on the browser/device with the original saved budget. Clearing that browser's site data cannot be recovered by this flow. No device-only data is migrated remotely or uploaded to a server. Some browsers require the Continue click; a fully invisible cross-origin transfer cannot be guaranteed. If the destination contains different data, a choice is intentionally required.
