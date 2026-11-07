import test from "node:test";
import assert from "node:assert/strict";
import {
  newBudget,
  normalizeDescription,
  MAX_DESCRIPTION_LENGTH,
  totals,
  validateExpense,
} from "../lib/budget";
import { validateBudgets, makeBackup, parseBackup } from "../lib/backup";

test("expense and payment descriptions survive sync validation and backup round-trips", () => {
  const budget = newBudget(11, 2026, true);
  const expense = budget.expenses[0];
  expense.description = "Monthly connection\nUsed for work & study";
  expense.payments.push({
    id: crypto.randomUUID(),
    expense_id: expense.id,
    amount: 125050,
    paid_at: "2026-11-07",
    description: 'First instalment — "November"',
  });
  const expected = structuredClone(budget);
  assert.deepEqual(validateBudgets([budget]), [expected]);
  assert.deepEqual(parseBackup(makeBackup([budget])), [expected]);
  assert.deepEqual(
    totals(parseBackup(makeBackup([budget]))[0]),
    totals(expected),
  );
});

test("legacy backups and snapshots can omit descriptions", () => {
  const budget = newBudget(11, 2026, true);
  for (const version of [1, 2]) {
    assert.deepEqual(
      parseBackup(
        JSON.stringify({ format: "pocket-budget", version, budgets: [budget] }),
      ),
      [budget],
    );
  }
  assert.deepEqual(validateBudgets([budget]), [budget]);
});

test("description normalization trims edges, preserves paragraphs, and clears blank text", () => {
  assert.equal(
    normalizeDescription("  Market run\nRice and vegetables  "),
    "Market run\nRice and vegetables",
  );
  assert.equal(normalizeDescription(" \n "), undefined);
  assert.equal(normalizeDescription(undefined), undefined);
  const budget = newBudget(11, 2026, true);
  const expense = budget.expenses[0];
  expense.description = "";
  const clean = validateBudgets([budget])[0];
  assert.equal("description" in clean.expenses[0], false);
});

test("invalid or oversized description values are rejected on both record types", () => {
  for (const value of [
    null,
    42,
    {},
    [],
    "x".repeat(MAX_DESCRIPTION_LENGTH + 1),
  ]) {
    const budget = newBudget(11, 2026, true);
    const expense = budget.expenses[0];
    assert.throws(() =>
      validateExpense({
        ...expense,
        description: value,
      } as unknown as typeof expense),
    );
    assert.throws(() =>
      validateBudgets([
        { ...budget, expenses: [{ ...expense, description: value }] },
      ]),
    );
    assert.throws(() =>
      validateBudgets([
        {
          ...budget,
          expenses: [
            {
              ...expense,
              payments: [
                {
                  id: crypto.randomUUID(),
                  expense_id: expense.id,
                  amount: 100,
                  paid_at: "2026-11-07",
                  description: value,
                },
              ],
            },
          ],
        },
      ]),
    );
  }
  assert.equal(
    normalizeDescription("x".repeat(MAX_DESCRIPTION_LENGTH))?.length,
    MAX_DESCRIPTION_LENGTH,
  );
});

test("payment entry limits reflect partial payments, paid items, and cancellation", async () => {
  const { paymentLimit, validatePaymentAmount } = await import("../lib/budget");
  const expense = newBudget(11, 2026, true).expenses[0];
  expense.expected_amount = 10050;
  expense.payments.push({
    id: crypto.randomUUID(),
    expense_id: expense.id,
    amount: 1250,
    paid_at: "2026-11-07",
  });
  assert.equal(paymentLimit(expense), 8800);
  assert.doesNotThrow(() => validatePaymentAmount(8800, expense));
  assert.throws(() => validatePaymentAmount(8801, expense));
  assert.throws(() => validatePaymentAmount(0, expense));
  expense.is_active = false;
  assert.equal(paymentLimit(expense), 0);
  assert.throws(() => validatePaymentAmount(1, expense));
  expense.is_active = true;
  expense.payments[0].amount = 10050;
  assert.equal(paymentLimit(expense), 0);
  assert.throws(() => validatePaymentAmount(1, expense));
});
