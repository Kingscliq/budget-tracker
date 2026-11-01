export type Category =
  | "Connectivity"
  | "Subscriptions"
  | "Living"
  | "Transport"
  | "Personal"
  | "Family"
  | "Other"
  | "Savings"
  | "Forex";
export const categories: Category[] = [
  "Connectivity",
  "Subscriptions",
  "Living",
  "Transport",
  "Personal",
  "Family",
  "Other",
  "Savings",
  "Forex",
];
export type Payment = {
  id: string;
  expense_id: string;
  amount: number;
  paid_at: string;
};
export type Expense = {
  id: string;
  budget_id: string;
  name: string;
  category: Category;
  expected_amount: number;
  is_active: boolean;
  is_recurring: boolean;
  payments: Payment[];
};
export type Budget = {
  id: string;
  month: number;
  year: number;
  salary: number;
  expenses: Expense[];
};
export type ExpenseInput = Pick<
  Expense,
  "name" | "category" | "expected_amount" | "is_recurring"
>;
export const money = (kobo: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(kobo / 100);
export const actual = (e: Expense) =>
  e.payments.reduce((sum, p) => sum + p.amount, 0);
export const allocation = (e: Expense) =>
  e.category === "Savings" || e.category === "Forex";
export const planned = (e: Expense) =>
  e.is_active ? Math.max(e.expected_amount, actual(e)) : actual(e);
export const status = (e: Expense) =>
  !e.is_active
    ? "Cancelled"
    : actual(e) >= e.expected_amount
      ? "Paid"
      : actual(e) > 0
        ? "Partially paid"
        : "Pending";
export function totals(b: Budget) {
  const expenses = b.expenses.filter((e) => !allocation(e));
  const sum = (items: Expense[], f: (e: Expense) => number) =>
    items.reduce((s, e) => s + f(e), 0);
  const expected = sum(expenses, planned),
    spent = sum(expenses, actual);
  const savings = sum(
      b.expenses.filter((e) => e.category === "Savings"),
      planned,
    ),
    forex = sum(
      b.expenses.filter((e) => e.category === "Forex"),
      planned,
    );
  return {
    expected,
    spent,
    savings,
    forex,
    savingsActual: sum(
      b.expenses.filter((e) => e.category === "Savings"),
      actual,
    ),
    forexActual: sum(
      b.expenses.filter((e) => e.category === "Forex"),
      actual,
    ),
    pending: sum(expenses, (e) =>
      e.is_active ? Math.max(0, e.expected_amount - actual(e)) : 0,
    ),
    cancelled: sum(b.expenses, (e) =>
      e.is_active ? 0 : Math.max(0, e.expected_amount - actual(e)),
    ),
    budgetRemaining: b.salary - expected - savings - forex,
    cashRemaining: b.salary - sum(b.expenses, actual),
  };
}
const seed: [string, Category, number][] = [
  ["Starlink", "Connectivity", 60000],
  ["Codex", "Subscriptions", 31000],
  ["X", "Subscriptions", 8000],
  ["Mobile data & airtime", "Connectivity", 20000],
  ["Food", "Living", 75000],
  ["Cooking", "Living", 25000],
  ["Transport", "Transport", 40000],
  ["Personal expenses", "Personal", 30000],
  ["Family/support", "Family", 40000],
  ["Unexpected expenses", "Other", 30000],
  ["Savings", "Savings", 100000],
  ["Forex", "Forex", 50000],
];
export function newBudget(
  month: number,
  year: number,
  defaults = false,
): Budget {
  const id = crypto.randomUUID();
  return {
    id,
    month,
    year,
    salary: 60000000,
    expenses: defaults
      ? seed.map(([name, category, amount]) => ({
          id: crypto.randomUUID(),
          budget_id: id,
          name,
          category,
          expected_amount: amount * 100,
          is_active: true,
          is_recurring: true,
          payments: [],
        }))
      : [],
  };
}
export function validateAmount(n: number, zero = false) {
  if (!Number.isSafeInteger(n) || n < (zero ? 0 : 1) || n > 100000000000)
    throw new Error("Enter a valid amount up to ₦1 billion.");
}
export function validateExpense(e: ExpenseInput) {
  if (
    !e.name.trim() ||
    e.name.trim().length > 100 ||
    !categories.includes(e.category) ||
    typeof e.is_recurring !== "boolean"
  )
    throw new Error("Enter a name and valid category.");
  validateAmount(e.expected_amount);
}
export function validateMonth(month: number, year: number) {
  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100
  )
    throw new Error("Choose a month between 2000 and 2100.");
}
