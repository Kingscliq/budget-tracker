import { validateBudgets } from "./backup";
import type { Budget } from "./budget";

export const OLD_ORIGIN = "https://pbt-tracker.vercel.app";
export const NEW_ORIGIN = "https://budg-tracker.vercel.app";
export const BUDGET_STORAGE = "pocket-budget-v1";
export const MIGRATION_RECEIPT = "pocket-domain-migration-v1";
export const PROTOCOL = "pocket-domain-migration-v1";
export const MAX_TRANSFER_BYTES = 750_000;

type DeviceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function readDeviceBudget(raw: string | null): Budget[] | null {
  if (raw === null) return null;
  if (new TextEncoder().encode(raw).length > MAX_TRANSFER_BYTES)
    throw new Error(
      "This budget is too large to move automatically. Use Backup & restore in Settings.",
    );
  return validateBudgets(JSON.parse(raw));
}
export function sameBudget(left: Budget[] | null, right: Budget[]) {
  return left !== null && JSON.stringify(left) === JSON.stringify(right);
}
export function validMessage(
  event: Pick<MessageEvent, "origin" | "source" | "data">,
  origin: string,
  peer: MessageEventSource | null,
  nonce: string,
) {
  return (
    peer !== null &&
    event.source === peer &&
    event.origin === origin &&
    /^[0-9a-f-]{36}$/.test(nonce) &&
    event.data?.protocol === PROTOCOL &&
    event.data?.nonce === nonce
  );
}

/** Check again at commit time: another tab may have edited the destination. */
export function importDeviceBudget(
  storage: DeviceStorage,
  incoming: Budget[],
  expectedRaw: string | null,
) {
  const clean = validateBudgets(incoming);
  const raw = storage.getItem(BUDGET_STORAGE);
  if (raw !== expectedRaw)
    throw new Error(
      "Your budget changed in another tab. Reload this page before choosing a copy.",
    );
  const before = readDeviceBudget(raw);
  const value = JSON.stringify(clean);
  if (sameBudget(before, clean)) return;
  // Fail before replacing anything if we cannot preserve the existing device copy.
  if (raw !== null)
    storage.setItem("pocket-previous-device-copy", JSON.stringify(before));
  // Keep a second copy even on a new device, before writing the main storage key.
  storage.setItem("pocket-domain-import-backup-v1", value);
  try {
    storage.setItem(BUDGET_STORAGE, value);
    if (storage.getItem(BUDGET_STORAGE) !== value)
      throw new Error("Storage verification failed.");
  } catch (error) {
    if (raw === null) storage.removeItem(BUDGET_STORAGE);
    else storage.setItem(BUDGET_STORAGE, raw);
    throw error;
  }
  // Never automatically attach imported data to an existing cloud session.
  storage.removeItem("pocket-sync-enabled");
  storage.removeItem("pocket-sync-pending");
}
