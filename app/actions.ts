"use server";
import { db } from "@/lib/supabase";
import {
  validateAmount,
  validateExpense,
  validateMonth,
  type Budget,
  type ExpenseInput,
} from "@/lib/budget";
function check(error: { message: string } | null) {
  if (error) {
    console.error("Budget database:", error.message);
    throw new Error("Could not save your budget. Please try again.");
  }
}
export async function loadBudgets(): Promise<Budget[]> {
  const client = db();
  const { data, error } = await client
    .from("budgets")
    .select("*,expenses(*,payments(*))")
    .order("year")
    .order("month");
  check(error);
  return (data ?? []) as Budget[];
}
export async function createMonth(month: number, year: number, seed = false) {
  validateMonth(month, year);
  const client = db();
  // The database function atomically creates and seeds only the first workspace budget.
  const { error } = await client.rpc("create_budget_month", {
    p_month: month,
    p_year: year,
    p_seed: seed,
  });
  check(error);
  return loadBudgets();
}
export async function setSalary(id: string, salary: number) {
  validateAmount(salary, true);
  const { error } = await db().from("budgets").update({ salary }).eq("id", id);
  check(error);
}
export async function saveExpense(
  budgetId: string,
  id: string | null,
  input: ExpenseInput,
) {
  validateExpense(input);
  const value = { ...input, name: input.name.trim() };
  const q = id
    ? db().from("expenses").update(value).eq("id", id).eq("budget_id", budgetId)
    : db()
        .from("expenses")
        .insert({ ...value, budget_id: budgetId });
  const { error } = await q;
  check(error);
}
export async function toggleExpense(id: string, active: boolean) {
  if (typeof active !== "boolean") throw new Error("Invalid status.");
  const { error } = await db()
    .from("expenses")
    .update({ is_active: active })
    .eq("id", id);
  check(error);
}
export async function deleteExpense(id: string) {
  const { error } = await db().from("expenses").delete().eq("id", id);
  check(error);
}
export async function recordPayment(id: string, amount: number, date: string) {
  validateAmount(amount);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))
    throw new Error("Choose a valid payment date.");
  const { error } = await db().rpc("record_budget_payment", {
    p_expense_id: id,
    p_amount: amount,
    p_paid_at: date,
  });
  check(error);
}
export async function removePayment(id: string) {
  const { error } = await db().from("payments").delete().eq("id", id);
  check(error);
}
export async function copyPrevious(id: string) {
  const { error } = await db().rpc("copy_previous_budget", { target_id: id });
  check(error);
}
