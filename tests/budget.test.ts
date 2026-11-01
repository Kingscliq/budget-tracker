import test from "node:test";
import assert from "node:assert/strict";
import {
  actual,
  newBudget,
  planned,
  status,
  totals,
  validateAmount,
  validateExpense,
} from "../lib/budget";
const foodBudget = () => {
  const b = newBudget(11, 2026, true);
  const e = b.expenses.find((e) => e.name === "Food")!;
  return { b, e };
};
test("default budget separates planned consumption, savings, forex and cash", () => {
  const b = newBudget(11, 2026, true),
    t = totals(b);
  assert.equal(t.expected, 35900000);
  assert.equal(t.savings, 10000000);
  assert.equal(t.forex, 5000000);
  assert.equal(t.budgetRemaining, 9100000);
  assert.equal(t.cashRemaining, 60000000);
  assert.equal(t.spent, 0);
  assert.equal(t.pending, 35900000);
});
test("multiple partial payments sum without changing the planned total", () => {
  const { b, e } = foodBudget();
  e.payments = [
    { id: "1", expense_id: e.id, amount: 1500000, paid_at: "2026-11-01" },
    { id: "2", expense_id: e.id, amount: 1000000, paid_at: "2026-11-02" },
  ];
  assert.equal(actual(e), 2500000);
  assert.equal(status(e), "Partially paid");
  assert.equal(totals(b).pending, 33400000);
  assert.equal(totals(b).cashRemaining, 57500000);
  assert.equal(totals(b).budgetRemaining, 9100000);
});
test("cancel frees only unpaid planned money; existing cash movements remain", () => {
  const { b, e } = foodBudget();
  e.payments = [
    { id: "1", expense_id: e.id, amount: 2500000, paid_at: "2026-11-01" },
  ];
  e.is_active = false;
  assert.equal(planned(e), 2500000);
  assert.equal(status(e), "Cancelled");
  assert.equal(totals(b).budgetRemaining, 14100000);
  assert.equal(totals(b).cashRemaining, 57500000);
  assert.equal(totals(b).cancelled, 5000000);
  e.is_active = true;
  assert.equal(totals(b).budgetRemaining, 9100000);
  assert.equal(status(e), "Partially paid");
});
test("cancel unpaid X frees its complete allocation", () => {
  const b = newBudget(11, 2026, true);
  b.expenses.find((e) => e.name === "X")!.is_active = false;
  assert.equal(totals(b).budgetRemaining, 9900000);
  assert.equal(totals(b).cashRemaining, 60000000);
});
test("savings deposits reduce cash without counting as consumption", () => {
  const b = newBudget(11, 2026, true);
  const e = b.expenses.find((e) => e.category === "Savings")!;
  e.payments = [
    { id: "1", expense_id: e.id, amount: 10000000, paid_at: "2026-11-01" },
  ];
  assert.equal(totals(b).savingsActual, 10000000);
  assert.equal(totals(b).spent, 0);
  assert.equal(totals(b).cashRemaining, 50000000);
  assert.equal(status(e), "Paid");
});
test("overspending increases total committed funds and reduces budget remaining", () => {
  const { b, e } = foodBudget();
  e.payments = [
    { id: "1", expense_id: e.id, amount: 8000000, paid_at: "2026-11-01" },
  ];
  assert.equal(status(e), "Paid");
  assert.equal(totals(b).budgetRemaining, 8600000);
  assert.equal(totals(b).pending, 28400000);
  e.is_active = false;
  assert.equal(totals(b).budgetRemaining, 8600000);
});
test("salary scenario exposes an overcommitted plan", () => {
  const b = newBudget(11, 2026, true);
  b.salary = 50000000;
  assert.equal(totals(b).budgetRemaining, -900000);
});
test("reject fractional kobo, negative, unsafe and invalid expense inputs", () => {
  for (const n of [-1, 0, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER])
    assert.throws(() => validateAmount(n));
  assert.doesNotThrow(() => validateAmount(0, true));
  assert.throws(() =>
    validateExpense({
      name: " ",
      category: "Other",
      expected_amount: 100,
      is_recurring: true,
    }),
  );
});
