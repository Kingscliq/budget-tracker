import {
  categories,
  validateAmount,
  validateExpense,
  validateMonth,
  type Budget,
} from "./budget";
export const MAX_BACKUP_BYTES = 750_000;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateBudgets(value: unknown): Budget[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 1200 ||
    new TextEncoder().encode(JSON.stringify(value)).length > 650_000
  )
    throw new Error("Choose a valid Pocket backup (up to 750 KB).");
  const ids = new Set<string>(),
    months = new Set<string>();
  const id = (v: unknown) => {
    if (typeof v !== "string" || !uuid.test(v) || ids.has(v))
      throw new Error("The backup contains invalid or duplicate record IDs.");
    ids.add(v);
  };
  for (const b of value) {
    if (!b || typeof b !== "object") throw new Error("Invalid budget.");
    id(b.id);
    validateMonth(b.month, b.year);
    validateAmount(b.salary, true);
    const month = `${b.year}-${b.month}`;
    if (months.has(month)) throw new Error("The backup has duplicate months.");
    months.add(month);
    if (!Array.isArray(b.expenses) || b.expenses.length > 1000)
      throw new Error("Invalid expense list.");
    for (const e of b.expenses) {
      if (!e || typeof e !== "object") throw new Error("Invalid expense.");
      id(e.id);
      if (
        e.budget_id !== b.id ||
        typeof e.is_active !== "boolean" ||
        typeof e.name !== "string" ||
        !categories.includes(e.category)
      )
        throw new Error("Invalid expense.");
      validateExpense(e);
      if (!Array.isArray(e.payments) || e.payments.length > 10000)
        throw new Error("Invalid payments.");
      for (const p of e.payments) {
        if (!p || typeof p !== "object") throw new Error("Invalid payment.");
        id(p.id);
        validateAmount(p.amount);
        if (
          p.expense_id !== e.id ||
          typeof p.paid_at !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(p.paid_at) ||
          Number.isNaN(Date.parse(p.paid_at)) ||
          new Date(p.paid_at).toISOString().slice(0, 10) !== p.paid_at
        )
          throw new Error("Invalid payment date or expense.");
      }
    }
  }
  // Return only the public budget fields, never arbitrary imported properties.
  return value.map((b) => ({
    id: b.id,
    month: b.month,
    year: b.year,
    salary: b.salary,
    expenses: b.expenses.map((e: Budget["expenses"][number]) => ({
      id: e.id,
      budget_id: b.id,
      name: e.name,
      category: e.category,
      expected_amount: e.expected_amount,
      is_active: e.is_active,
      is_recurring: e.is_recurring,
      payments: e.payments.map((p) => ({
        id: p.id,
        expense_id: e.id,
        amount: p.amount,
        paid_at: p.paid_at,
      })),
    })),
  }));
}
export function parseBackup(text: string): Budget[] {
  if (text.length > MAX_BACKUP_BYTES)
    throw new Error("Choose a backup smaller than 750 KB.");
  const data = JSON.parse(text);
  if (data?.format !== "pocket-budget" || data?.version !== 1)
    throw new Error("This is not a supported Pocket backup.");
  return validateBudgets(data.budgets);
}
export function makeBackup(budgets: Budget[]) {
  return JSON.stringify({
    format: "pocket-budget",
    version: 1,
    exportedAt: new Date().toISOString(),
    budgets: validateBudgets(budgets),
  });
}
