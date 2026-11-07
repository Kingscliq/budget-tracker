import test from "node:test";
import assert from "node:assert/strict";
import { newBudget } from "../lib/budget";
import {
  BUDGET_STORAGE,
  PROTOCOL,
  readDeviceBudget,
  importDeviceBudget,
  validMessage,
} from "../lib/domain-migration";
function device(initial: string | null = null) {
  const entries = new Map<string, string>();
  if (initial !== null) entries.set(BUDGET_STORAGE, initial);
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
  };
}
test("migration preserves descriptions, currency and payments, and keeps an import backup", () => {
  const b = newBudget(11, 2026, true);
  b.currency = "USD";
  b.expenses[0].description = "Home internet";
  b.expenses[0].payments = [
    {
      id: crypto.randomUUID(),
      expense_id: b.expenses[0].id,
      amount: 100,
      paid_at: "2026-11-07",
      description: "First part",
    },
  ];
  const source = JSON.stringify([b]);
  const target = device();
  importDeviceBudget(target, readDeviceBudget(source)!, null);
  assert.deepEqual(
    JSON.parse(target.getItem(BUDGET_STORAGE)!),
    JSON.parse(source),
  );
  assert.deepEqual(
    JSON.parse(target.getItem("pocket-domain-import-backup-v1")!),
    JSON.parse(source),
  );
});
test("replacement backs up existing budget and pauses cloud sync", () => {
  const before = JSON.stringify([newBudget(10, 2026)]);
  const target = device(before);
  target.setItem("pocket-sync-enabled", "true");
  target.setItem("pocket-sync-pending", "true");
  importDeviceBudget(target, [newBudget(11, 2026)], before);
  assert.equal(target.getItem("pocket-previous-device-copy"), before);
  assert.equal(target.getItem("pocket-sync-enabled"), null);
  assert.equal(target.getItem("pocket-sync-pending"), null);
});
test("concurrent edits and invalid payloads cannot replace a budget", () => {
  const before = JSON.stringify([newBudget(10, 2026)]);
  const target = device(before);
  assert.throws(
    () => importDeviceBudget(target, [newBudget(11, 2026)], null),
    /changed in another tab/,
  );
  assert.throws(() => importDeviceBudget(target, [], before));
  assert.throws(() => readDeviceBudget("broken"));
  assert.throws(() => readDeviceBudget(" ".repeat(750001)));
  assert.equal(target.getItem(BUDGET_STORAGE), before);
});
test("quota failure while preserving a copy leaves destination untouched", () => {
  const before = JSON.stringify([newBudget(10, 2026)]);
  const target = device(before);
  const write = target.setItem;
  target.setItem = (key, value) => {
    if (key === "pocket-domain-import-backup-v1")
      throw new Error("Quota exceeded");
    write(key, value);
  };
  assert.throws(() =>
    importDeviceBudget(target, [newBudget(11, 2026)], before),
  );
  assert.equal(target.getItem(BUDGET_STORAGE), before);
});
test("failed read-back restores original and never reports a successful import", () => {
  const before = JSON.stringify([newBudget(10, 2026)]);
  const target = device(before);
  const write = target.setItem;
  let failOnce = true;
  target.setItem = (key, value) => {
    if (key === BUDGET_STORAGE && failOnce) {
      failOnce = false;
      return;
    }
    write(key, value);
  };
  assert.throws(
    () => importDeviceBudget(target, [newBudget(11, 2026)], before),
    /verification failed/,
  );
  assert.equal(target.getItem(BUDGET_STORAGE), before);
});
test("messages require the exact peer window, origin, protocol and fresh session nonce", () => {
  const peer = {} as Window;
  const nonce = crypto.randomUUID();
  const event = {
    origin: "https://budg-tracker.vercel.app",
    source: peer,
    data: { protocol: PROTOCOL, nonce },
  };
  assert.equal(validMessage(event, event.origin, peer, nonce), true);
  assert.equal(
    validMessage(
      { ...event, origin: "https://evil.example" },
      event.origin,
      peer,
      nonce,
    ),
    false,
  );
  assert.equal(
    validMessage({ ...event, source: {} as Window }, event.origin, peer, nonce),
    false,
  );
  assert.equal(
    validMessage(event, event.origin, peer, crypto.randomUUID()),
    false,
  );
  assert.equal(
    validMessage(
      { ...event, data: { ...event.data, protocol: "other" } },
      event.origin,
      peer,
      nonce,
    ),
    false,
  );
});
