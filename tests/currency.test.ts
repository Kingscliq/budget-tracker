import test from "node:test";
import assert from "node:assert/strict";
import {
  currencies,
  money,
  compactMoney,
  newBudget,
  totals,
  trendBudgets,
} from "../lib/budget";
import { validateBudgets, makeBackup, parseBackup } from "../lib/backup";

test("existing device, cloud and backup budgets without currency remain NGN", () => {
  const { currency: _currency, ...legacy } = newBudget(11, 2026, true);
  const original = structuredClone(legacy);
  const [loaded] = validateBudgets([legacy]);
  assert.equal(loaded.currency, "NGN");
  assert.equal(
    parseBackup(
      JSON.stringify({
        format: "pocket-budget",
        version: 1,
        budgets: [legacy],
      }),
    )[0].currency,
    "NGN",
  );
  assert.deepEqual(loaded.expenses, original.expenses);
  assert.equal(loaded.salary, original.salary);
  assert.deepEqual(legacy, original);
});

test("every supported currency round-trips through sync validation and backups without conversion", () => {
  const b = newBudget(11, 2026, true);
  const expense = b.expenses[0];
  expense.payments.push({
    id: crypto.randomUUID(),
    expense_id: expense.id,
    amount: 123456,
    paid_at: "2026-11-01",
  });
  const original = structuredClone(b);
  assert.equal(JSON.parse(makeBackup([b])).version, 2);
  for (const currency of Object.keys(
    currencies,
  ) as (keyof typeof currencies)[]) {
    b.currency = currency;
    const [restored] = parseBackup(makeBackup([b]));
    assert.equal(restored.currency, currency);
    assert.equal(restored.salary, original.salary);
    assert.deepEqual(restored.expenses, original.expenses);
    assert.deepEqual(totals(restored), totals(original));
  }
});

test("reject unsupported currency values instead of silently relabelling data", () => {
  for (const currency of [null, "CAD", "usd", "toString", 123, {}]) {
    assert.throws(() =>
      validateBudgets([{ ...newBudget(11, 2026), currency }]),
    );
  }
});

test("format amounts and chart labels in selected currency with two-decimal precision", () => {
  for (const currency of Object.keys(
    currencies,
  ) as (keyof typeof currencies)[]) {
    assert.equal(
      money(123456, currency),
      new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      }).format(1234.56),
    );
    assert.ok(compactMoney(100000, currency).length > 0);
  }
  assert.equal(money(10000), "₦100");
});

test("new months accept the current currency and trend excludes other currencies and future months", () => {
  const naira = newBudget(9, 2026);
  const older = newBudget(10, 2026, false, "USD");
  const current = newBudget(11, 2026, false, older.currency);
  const future = newBudget(12, 2026, false, "USD");
  const all = [future, current, naira, older];
  assert.equal(current.currency, "USD");
  assert.deepEqual(
    trendBudgets(all, current).map((b) => b.id),
    [older.id, current.id],
  );
  assert.deepEqual(all, [future, current, naira, older]);
});
