import test from "node:test";
import assert from "node:assert/strict";
import {
  makeBackup,
  parseBackup,
  validateBudgets,
  MAX_BACKUP_BYTES,
} from "../lib/backup";
import { newBudget, totals } from "../lib/budget";
test("backup round-trip preserves months, partial payments and cancelled allocations", () => {
  const b = newBudget(11, 2026, true),
    food = b.expenses.find((e) => e.name === "Food")!;
  food.is_active = false;
  food.payments = [
    {
      id: crypto.randomUUID(),
      expense_id: food.id,
      amount: 1500000,
      paid_at: "2026-11-01",
    },
  ];
  assert.deepEqual(parseBackup(makeBackup([b])), [b]);
  assert.deepEqual(totals(parseBackup(makeBackup([b]))[0]), totals(b));
});
test("reject unrelated files, unsupported versions and empty or oversized backups", () => {
  for (const text of [
    "{}",
    "null",
    '{"format":"pocket-budget","version":2,"budgets":[]}',
    '{"format":"pocket-budget","version":1,"budgets":[]}',
    " ".repeat(MAX_BACKUP_BYTES + 1),
  ])
    assert.throws(() => parseBackup(text));
});
test("reject duplicate months and duplicate record ids", () => {
  const b = newBudget(11, 2026, true);
  assert.throws(() => validateBudgets([b, newBudget(11, 2026)]));
  b.expenses[1].id = b.expenses[0].id;
  assert.throws(() => validateBudgets([b]));
});
test("reject fractional money, wrong ownership and invalid dates", () => {
  for (const mutate of [
    (b: ReturnType<typeof newBudget>) => {
      b.salary = 0.5;
    },
    (b: ReturnType<typeof newBudget>) => {
      b.expenses[0].budget_id = crypto.randomUUID();
    },
    (b: ReturnType<typeof newBudget>) => {
      const e = b.expenses[0];
      e.payments = [
        {
          id: crypto.randomUUID(),
          expense_id: e.id,
          amount: 100,
          paid_at: "2026-02-30",
        },
      ];
    },
  ]) {
    const b = newBudget(11, 2026, true);
    mutate(b);
    assert.throws(() => validateBudgets([b]));
  }
});
test("strip unrelated properties from imported records", () => {
  const b = {
    ...newBudget(11, 2026, true),
    email: "private@example.com",
    token: "do-not-import",
  };
  const cleaned = validateBudgets([b])[0];
  assert.equal("token" in cleaned, false);
  assert.equal("email" in cleaned, false);
});
