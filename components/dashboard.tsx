"use client";
import { startTransition, useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Plus,
  ChevronLeft,
  ChevronRight,
  Wallet,
  LayoutDashboard,
  ReceiptText,
  PiggyBank,
  Globe2,
  Search,
  Check,
  MoreHorizontal,
  Copy,
  Trash2,
  Pencil,
  History,
  X,
  Loader2,
  CheckCircle2,
  Leaf,
  Download,
  Settings,
} from "lucide-react";
import * as Switch from "@radix-ui/react-switch";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import {
  actual,
  categories,
  money as formatMoney,
  compactMoney,
  currencies,
  trendBudgets,
  type Currency,
  newBudget,
  planned,
  status,
  totals,
  validateAmount,
  validateExpense,
  validatePaymentAmount,
  paymentLimit,
  normalizeDescription,
  MAX_DESCRIPTION_LENGTH,
  type Budget,
  type Expense,
  type ExpenseInput,
} from "@/lib/budget";
import {
  loadCloud,
  saveCloud,
  disconnectSync,
  type CloudBudget,
} from "@/lib/cloud-client";
import { validateBudgets, parseBackup, MAX_BACKUP_BYTES } from "@/lib/backup";
import { BudgetSettings } from "./budget-settings";
import { OnboardingTour } from "./onboarding-tour";
import { trackEvent } from "@/lib/analytics";
const STORAGE = "pocket-budget-v1";
const COLORS = [
  "#346655",
  "#8fae98",
  "#c0c9a4",
  "#dfbd87",
  "#98a9c3",
  "#bc9eac",
  "#a7a397",
];
const dateToday = () => new Date().toLocaleDateString("en-CA");
const monthName = (m: number) =>
  new Date(2026, m - 1, 1).toLocaleString("en", { month: "long" });
export default function Dashboard({
  syncAvailable,
}: {
  syncAvailable: boolean;
}) {
  const [budgets, setBudgets] = useState<Budget[]>([]),
    [selected, setSelected] = useState(""),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [connected, setConnected] = useState(false),
    [syncEmail, setSyncEmail] = useState(""),
    [settingsOpen, setSettingsOpen] = useState(false),
    [tourOpen, setTourOpen] = useState(false);
  const revision = useRef<number | null>(null);
  const operation = useRef(false);
  const firstInit = useRef(false);
  const [view, setView] = useState("Overview"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All items");
  const [modal, setModal] = useState<
      "expense" | "payment" | "salary" | "history" | "delete" | null
    >(null),
    [editing, setEditing] = useState<Expense | null>(null);
  const [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [category, setCategory] = useState<ExpenseInput["category"]>("Living"),
    [amount, setAmount] = useState(""),
    [recurring, setRecurring] = useState(true),
    [date, setDate] = useState(dateToday),
    [formError, setFormError] = useState("");
  useEffect(() => {
    if (firstInit.current) return;
    firstInit.current = true;
    startTransition(async () => {
      try {
        const saved = localStorage.getItem(STORAGE),
          now = new Date();
        let list = saved
          ? validateBudgets(JSON.parse(saved))
          : [newBudget(now.getMonth() + 1, now.getFullYear(), true)];
        localStorage.setItem(STORAGE, JSON.stringify(list));
        if (localStorage.getItem("pocket-sync-enabled") === "true") {
          if (localStorage.getItem("pocket-sync-pending") === "true") {
            localStorage.removeItem("pocket-sync-enabled");
            setError(
              "Unsynced changes are safe on this device. Open Settings to resume sync.",
            );
          } else {
            try {
              const cloud = await loadCloud();
              if (cloud?.budgets) {
                list = cloud.budgets;
                localStorage.setItem(STORAGE, JSON.stringify(list));
                revision.current = cloud.revision;
                setConnected(true);
                setSyncEmail(cloud.email);
              } else {
                localStorage.removeItem("pocket-sync-enabled");
                setError("Open Settings to verify your email and resume sync.");
              }
            } catch {
              localStorage.removeItem("pocket-sync-enabled");
              setError(
                "Cloud sync is unavailable. Your device copy is ready to use.",
              );
            }
          }
        }
        setBudgets(list);
        setSelected(
          list.find(
            (b) =>
              b.month === now.getMonth() + 1 && b.year === now.getFullYear(),
          )?.id ?? list.at(-1)!.id,
        );
        setTourOpen(localStorage.getItem("pocket-tour-v1") !== "done");
        const callback = new URLSearchParams(location.search).get("sync");
        if (callback === "verified") {
          setSettingsOpen(true);
          setNotice(
            "Email verified. Turn on sync in Settings to choose your budget.",
          );
        }
        if (callback === "error") {
          setError(
            "That sign-in link expired or was opened in another browser. Request a new email from Settings and open it in the same browser.",
          );
          setSettingsOpen(true);
        }
        if (callback) history.replaceState({}, "", location.pathname);
      } catch {
        setError(
          "Could not read or save this device’s budget. Check browser storage or restore a backup from Settings.",
        );
      } finally {
        setReady(true);
      }
    });
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  const budget = budgets.find((b) => b.id === selected);
  const summary = budget ? totals(budget) : null;
  const currency = budget?.currency ?? "NGN";
  const money = (amount: number) => formatMoney(amount, currency);
  const paymentExpense = budget?.expenses.find(
    (expense) => expense.id === editing?.id,
  );
  const maxPayment = paymentExpense ? paymentLimit(paymentExpense) : 0;
  async function persist(next: Budget[]) {
    const clean = validateBudgets(next);
    // Mark before saving locally so a closed tab cannot silently lose an unsynced edit.
    if (connected) localStorage.setItem("pocket-sync-pending", "true");
    localStorage.setItem(STORAGE, JSON.stringify(clean));
    setBudgets(clean);
    if (connected) {
      try {
        revision.current = await saveCloud(clean, revision.current);
        localStorage.removeItem("pocket-sync-pending");
      } catch (e) {
        localStorage.removeItem("pocket-sync-enabled");
        setConnected(false);
        setError(
          e instanceof Error
            ? e.message
            : "Sync paused. Your changes are saved on this device.",
        );
      }
    }
  }
  async function mutate(local: (items: Budget[]) => Budget[], message: string) {
    if (operation.current) return false;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      await persist(local(budgets));
      setNotice(message);
      return true;
    } catch {
      setError(
        "Could not save on this device. Check browser storage before continuing.",
      );
      return false;
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function useCloud(cloud: CloudBudget) {
    if (!cloud.budgets) throw new Error("No saved cloud budget was found.");
    localStorage.setItem(
      "pocket-previous-device-copy",
      JSON.stringify(budgets),
    );
    localStorage.setItem(STORAGE, JSON.stringify(cloud.budgets));
    localStorage.setItem("pocket-sync-enabled", "true");
    localStorage.removeItem("pocket-sync-pending");
    revision.current = cloud.revision;
    setBudgets(cloud.budgets);
    setSelected(cloud.budgets[0].id);
    setConnected(true);
    setSyncEmail(cloud.email);
    setError("");
    trackEvent("sync_enabled");
    setNotice("Your saved budget is ready on this device");
  }
  async function uploadDevice(cloud: CloudBudget) {
    const nextRevision = await saveCloud(budgets, cloud.revision);
    localStorage.setItem("pocket-sync-enabled", "true");
    localStorage.removeItem("pocket-sync-pending");
    revision.current = nextRevision;
    setConnected(true);
    setSyncEmail(cloud.email);
    setError("");
    trackEvent("sync_enabled");
    setNotice("Sync is on. This device’s budget is now saved to your account.");
  }
  async function stopSync() {
    localStorage.removeItem("pocket-sync-enabled");
    localStorage.removeItem("pocket-sync-pending");
    setConnected(false);
    setSyncEmail("");
    revision.current = null;
    try {
      await disconnectSync();
    } catch {
      setError(
        "Sync is off on this device. Reconnect when online to finish signing out.",
      );
    }
    trackEvent("sync_disabled");
    setNotice("Sync is off. Your budget stays on this device.");
  }
  async function restoreBackup(value: Budget[]) {
    localStorage.setItem(
      "pocket-previous-device-copy",
      JSON.stringify(budgets),
    );
    const ok = await mutate(() => value, "Backup restored");
    if (!ok) throw new Error("Could not restore this backup.");
    setSelected(value[0].id);
    trackEvent("backup_restored");
  }
  function finishTour() {
    setTourOpen(false);
    try {
      localStorage.setItem("pocket-tour-v1", "done");
    } catch {
      /* tour dismissal still works for this visit */
    }
  }
  const changeExpense =
    (id: string, fn: (e: Expense) => Expense) => (items: Budget[]) =>
      items.map((b) =>
        b.id === selected
          ? { ...b, expenses: b.expenses.map((e) => (e.id === id ? fn(e) : e)) }
          : b,
      );
  async function navigate(delta: number) {
    if (!budget || busy) return;
    const d = new Date(budget.year, budget.month - 1 + delta, 1);
    const m = d.getMonth() + 1,
      y = d.getFullYear();
    if (y < 2000 || y > 2100) return;
    const existing = budgets.find((b) => b.month === m && b.year === y);
    if (existing) {
      setSelected(existing.id);
      return;
    }
    const next = newBudget(m, y, false, currency);
    if (await mutate((items) => [...items, next], "Month opened")) {
      setSelected(next.id);
      trackEvent("month_created");
    }
  }

  function openExpense(e?: Expense) {
    setEditing(e ?? null);
    setName(e?.name ?? "");
    setDescription(e?.description ?? "");
    setCategory(e?.category ?? (view === "Savings" ? "Savings" : "Living"));
    setAmount(e ? String(e.expected_amount / 100) : "");
    setRecurring(e?.is_recurring ?? true);
    setFormError("");
    setModal("expense");
  }
  function openPayment(e: Expense) {
    setEditing(e);
    setDescription("");
    setAmount("");
    setDate(dateToday());
    setFormError("");
    setModal("payment");
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!budget) return;
    setFormError("");
    try {
      const kobo = Math.round(Number(amount) * 100);
      if (!amount.trim() || !/^\d+(\.\d{1,2})?$/.test(amount))
        throw new Error("Enter an amount with up to two decimal places.");
      validateAmount(kobo, modal === "salary");
      let ok = false;
      if (modal === "salary")
        ok = await mutate(
          (items) =>
            items.map((b) => (b.id === selected ? { ...b, salary: kobo } : b)),
          "Monthly income updated",
        );
      if (modal === "expense") {
        const input: ExpenseInput = {
          name: name.trim(),
          description: normalizeDescription(description),
          category,
          expected_amount: kobo,
          is_recurring: recurring,
        };
        validateExpense(input);
        const id = editing?.id ?? crypto.randomUUID();
        ok = await mutate(
          (items) =>
            items.map((b) =>
              b.id === selected
                ? {
                    ...b,
                    expenses: editing
                      ? b.expenses.map((e) =>
                          e.id === id ? { ...e, ...input } : e,
                        )
                      : [
                          ...b.expenses,
                          {
                            id,
                            budget_id: selected,
                            ...input,
                            is_active: true,
                            payments: [],
                          },
                        ],
                  }
                : b,
            ),
          editing ? "Expense updated" : "Expense added",
        );
      }
      if (modal === "payment" && editing) {
        if (!paymentExpense)
          throw new Error(
            "This expense could not be found. Reopen the payment form.",
          );
        validatePaymentAmount(kobo, paymentExpense);
        if (!date || Number.isNaN(Date.parse(date)))
          throw new Error("Choose a payment date.");
        const paymentDescription = normalizeDescription(description);
        ok = await mutate(
          changeExpense(editing.id, (e) => ({
            ...e,
            payments: [
              ...e.payments,
              {
                id: crypto.randomUUID(),
                expense_id: e.id,
                amount: kobo,
                paid_at: date,
                description: paymentDescription,
              },
            ],
          })),
          "Payment recorded",
        );
      }
      if (ok) {
        if (modal === "salary") trackEvent("income_updated");
        if (modal === "payment") trackEvent("payment_recorded");
        if (modal === "expense")
          trackEvent(editing ? "expense_updated" : "expense_created");
        setModal(null);
      }
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Please check your inputs.",
      );
    }
  }
  async function copy() {
    if (!budget) return;
    const d = new Date(budget.year, budget.month - 2, 1);
    const previous = budgets.find(
      (b) => b.month === d.getMonth() + 1 && b.year === d.getFullYear(),
    );
    if (!previous) {
      setError("No budget found for the previous month.");
      return;
    }
    if (budget.expenses.length) {
      setError(
        "Copy is available for an empty month, so existing items stay safe.",
      );
      return;
    }
    const copied = await mutate(
      (items) =>
        items.map((b) =>
          b.id === selected
            ? {
                ...b,
                salary: previous.salary,
                expenses: previous.expenses
                  .filter((e) => e.is_recurring && e.is_active)
                  .map((e) => ({
                    ...e,
                    id: crypto.randomUUID(),
                    budget_id: b.id,
                    payments: [],
                  })),
              }
            : b,
        ),
      `Amounts copied unchanged in ${currency}. Payments start at zero.`,
    );
    if (copied) trackEvent("month_copied");
  }
  function exportCSV() {
    if (!budget) return;
    const rows = [
      [
        "Name",
        "Category",
        `Expected ${currency}`,
        `Actual ${currency}`,
        "Status",
        "Recurring",
        "Description",
        "Payment descriptions",
      ],
      ...budget.expenses.map((e) => [
        e.name,
        e.category,
        e.expected_amount / 100,
        actual(e) / 100,
        status(e),
        e.is_recurring ? "Yes" : "No",
        e.description ?? "",
        e.payments
          .filter((p) => p.description)
          .map(
            (p) =>
              `${p.paid_at} (${p.amount / 100} ${currency}): ${p.description}`,
          )
          .join("\n"),
      ]),
    ];
    const blob = new Blob(
      [
        rows
          .map((r) =>
            r.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(","),
          )
          .join("\n"),
      ],
      { type: "text/csv" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pocket-${budget.year}-${budget.month}-${currency}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    trackEvent("csv_exported");
  }
  if (!ready)
    return (
      <div className="loading">
        <Loader2 className="spin" /> Getting your budget ready…
      </div>
    );
  if (!budget || !summary)
    return (
      <div className="loading">
        <Wallet />
        <h1>Let’s get your budget ready</h1>
        <p role="alert">{error || "No budget available."}</p>
        <label className="recovery-backup">
          Restore a Pocket backup
          <input
            type="file"
            accept=".json,application/json"
            aria-label="Restore a Pocket backup"
            onChange={async (event) => {
              try {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > MAX_BACKUP_BYTES)
                  throw new Error("Choose a backup smaller than 750 KB.");
                const list = parseBackup(await file.text());
                localStorage.setItem(STORAGE, JSON.stringify(list));
                setBudgets(list);
                setSelected(list[0].id);
                setError("");
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not restore backup.",
                );
              }
            }}
          />
        </label>
        <Button onClick={() => location.reload()}>Try again</Button>
      </div>
    );
  const rows = budget.expenses
    .filter((e) => (view === "Savings" ? e.category === "Savings" : true))
    .filter((e) =>
      `${e.name} ${e.description ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .filter(
      (e) =>
        filter === "All items" ||
        (filter === "Active"
          ? e.is_active
          : filter === "Cancelled"
            ? !e.is_active
            : status(e) === filter),
    );
  const byCategory = categories.map((c) => ({
    name: c,
    total: budget.expenses
      .filter((e) => e.category === c)
      .reduce((s, e) => s + actual(e), 0),
  }));
  const chartData = [
    {
      name: "Monthly budget",
      Expected: summary.totalExpected / 100,
      Actual: summary.totalActual / 100,
    },
  ];
  const trend = trendBudgets(budgets, budget).map((b) => ({
    name: monthName(b.month).slice(0, 3) + " " + String(b.year).slice(2),
    Spent: totals(b).totalActual / 100,
  }));
  const historyExpense = budget.expenses.find((e) => e.id === editing?.id);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Pocket home">
          <span className="brand-icon">
            <Wallet size={22} />
          </span>
          pocket<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">PERSONAL WORKSPACE</div>
        <nav>
          {[
            ["Overview", LayoutDashboard],
            ["Savings", PiggyBank],
            ["Transactions", History],
          ].map(([label, Icon]) => {
            const I = Icon as typeof Wallet;
            return (
              <button
                aria-label={String(label)}
                aria-pressed={view === label}
                key={String(label)}
                className={`nav-item ${view === label ? "active" : ""}`}
                onClick={() => {
                  if (view !== label) {
                    if (label === "Overview") trackEvent("view_overview");
                    if (label === "Savings") trackEvent("view_savings");
                    if (label === "Transactions")
                      trackEvent("view_transactions");
                  }
                  setView(String(label));
                  setFilter("All items");
                  setSearch("");
                }}
              >
                <I size={19} />
                <span>{String(label)}</span>
                {view === label && <span className="nav-active-dot" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <div className="note-icon">
            <Leaf size={22} />
          </div>
          <h3>Small steps. Big progress.</h3>
          <p>A little intention today makes room for tomorrow.</p>
          <span>
            One month at a time <ArrowRight size={14} />
          </span>
        </div>
        <div className="profile">
          <span className="avatar">M</span>
          <div>
            <strong>My workspace</strong>
            <small>Personal budget</small>
          </div>
          <span className="profile-dot" />
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{view}</strong>
          </div>
          <div className="topbar-actions">
            <span className={`save-state ${busy ? "saving" : ""}`}>
              {busy ? <Loader2 size={14} className="spin" /> : <span />}
              {busy
                ? "Saving…"
                : connected
                  ? "Synced across devices"
                  : "Saved on this device"}
            </span>
            <button
              className="settings-trigger icon-button"
              data-tour="settings"
              aria-label="Settings"
              disabled={busy}
              onClick={() => {
                finishTour();
                trackEvent("settings_opened");
                setSettingsOpen(true);
              }}
            >
              <Settings size={18} />
            </button>
          </div>
        </header>
        <div className="page-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                YOUR MONEY, WITH A LITTLE MORE CLARITY
              </div>
              <h1>
                {view === "Overview"
                  ? "Make room for what matters."
                  : view === "Transactions"
                    ? "Follow the money."
                    : "Invest in your future."}
              </h1>
              <p>
                {view === "Overview"
                  ? "A clear picture of your month. A little more peace of mind."
                  : view === "Transactions"
                    ? "Every recorded payment, all in one place."
                    : "Plan with intention and track your progress."}
              </p>
            </div>
            <div className="month-picker">
              <button
                className="icon-button"
                disabled={busy}
                onClick={() => void navigate(-1)}
                aria-label="Previous month"
              >
                <ChevronLeft size={17} />
              </button>
              <span>
                {monthName(budget.month)} {budget.year}
              </span>
              <button
                className="icon-button"
                disabled={busy}
                onClick={() => void navigate(1)}
                aria-label="Next month"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </section>
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          <section className="income-bar" data-tour="income">
            <div className="income-label">
              <span className="mini-icon">
                <Wallet size={19} />
              </span>
              <div>
                <strong>Monthly income</strong>
                <small>Your starting point for the month</small>
              </div>
            </div>
            <div className="income-options">
              {[500000, 600000].map((n) => (
                <button
                  disabled={busy}
                  key={n}
                  onClick={() =>
                    void mutate(
                      (items) =>
                        items.map((b) =>
                          b.id === selected ? { ...b, salary: n * 100 } : b,
                        ),
                      "Salary scenario updated",
                    )
                  }
                  className={budget.salary === n * 100 ? "selected" : ""}
                >
                  {budget.salary === n * 100 && <Check size={14} />}{" "}
                  {money(n * 100)}
                </button>
              ))}
              <button
                disabled={busy}
                className={
                  ![50000000, 60000000].includes(budget.salary)
                    ? "selected"
                    : ""
                }
                onClick={() => {
                  setAmount(String(budget.salary / 100));
                  setFormError("");
                  setModal("salary");
                }}
              >
                <Pencil size={13} />
                {![50000000, 60000000].includes(budget.salary)
                  ? money(budget.salary)
                  : "Custom amount"}
              </button>
            </div>
            <span className="income-total">
              {money(budget.salary)}
              <small>/ month</small>
            </span>
          </section>
          <section className="summary-grid">
            <div className="stat-card">
              <div className="stat-top">
                Planned expenses{" "}
                <span className="stat-icon">
                  <ReceiptText size={17} />
                </span>
              </div>
              <div className="stat-value">{money(summary.totalExpected)}</div>
              <div className="stat-foot">
                <span className="tiny-dot" />{" "}
                {budget.expenses.filter((e) => e.is_active).length} active
                expense items
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                Actual expenses{" "}
                <span className="stat-icon">
                  <ArrowUpRight size={17} />
                </span>
              </div>
              <div className="stat-value">{money(summary.totalActual)}</div>
              <div className="stat-foot">
                {money(summary.totalPending)} still pending
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                Savings{" "}
                <span className="stat-icon">
                  <PiggyBank size={17} />
                </span>
              </div>
              <div className="stat-value">{money(summary.savings)}</div>
              <div className="stat-foot">
                {money(summary.savingsActual)} contributed so far · included in
                expenses
              </div>
            </div>
            <div className="stat-card featured">
              <div className="stat-top">
                Budget remaining{" "}
                <span className="stat-icon">
                  <Wallet size={17} />
                </span>
              </div>
              <div className="stat-value">{money(summary.budgetRemaining)}</div>
              <div className="stat-foot">
                <span className="tiny-dot" />{" "}
                {summary.budgetRemaining < 0
                  ? "Your plan is over budget"
                  : "Unallocated. Yours to decide."}
              </div>
            </div>
          </section>
          <div className="main-grid">
            <div className="main-column">
              {view === "Transactions" ? (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Payment history</h2>
                      <p>Cash movements recorded for this budget.</p>
                    </div>
                    <span className="count-pill">
                      {budget.expenses.reduce(
                        (s, e) => s + e.payments.length,
                        0,
                      )}{" "}
                      payments
                    </span>
                  </div>
                  <div className="transaction-list">
                    {budget.expenses
                      .flatMap((e) => e.payments.map((p) => ({ e, p })))
                      .sort((a, b) => b.p.paid_at.localeCompare(a.p.paid_at))
                      .map(({ e, p }) => (
                        <div className="transaction" key={p.id}>
                          <span className="expense-icon">
                            <ArrowUpRight size={18} />
                          </span>
                          <div>
                            <strong>{e.name}</strong>
                            <small>
                              {new Date(
                                p.paid_at + "T12:00:00",
                              ).toLocaleDateString("en-GB")}{" "}
                              · {e.category}
                            </small>
                            {p.description && (
                              <p className="entry-description">
                                {p.description}
                              </p>
                            )}
                          </div>
                          <strong>{money(p.amount)}</strong>
                          <button
                            className="icon-button"
                            disabled={busy}
                            aria-label={`Delete ${e.name} payment`}
                            onClick={() =>
                              void mutate(
                                changeExpense(e.id, (x) => ({
                                  ...x,
                                  payments: x.payments.filter(
                                    (v) => v.id !== p.id,
                                  ),
                                })),
                                "Payment removed",
                              )
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    {!budget.expenses.some((e) => e.payments.length > 0) && (
                      <div className="empty-state">
                        <History size={32} />
                        <h3>Your story starts here</h3>
                        <p>
                          Record a payment against any expense to see it here.
                        </p>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setView("Overview");
                            setFilter("All items");
                            setSearch("");
                          }}
                        >
                          Go to overview <ArrowRight size={15} />
                        </Button>
                      </div>
                    )}
                  </div>
                </section>
              ) : (
                <section className="panel expense-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>
                        {view === "Savings" ? "Savings" : "Your monthly plan"}{" "}
                        <span className="count-pill">{rows.length} items</span>
                      </h2>
                      <p>
                        {view === "Savings"
                          ? "Build your reserves, one contribution at a time."
                          : "A place for your money. Adjust as life happens."}
                      </p>
                    </div>
                    <Button
                      data-tour="expenses"
                      disabled={busy}
                      onClick={() => openExpense()}
                    >
                      <Plus size={16} />{" "}
                      {view === "Savings" ? "Add savings" : "Add expense"}
                    </Button>
                  </div>
                  <div className="table-toolbar">
                    <div className="filter-tabs">
                      {["All items", "Active", "Cancelled"].map((f) => (
                        <button
                          key={f}
                          className={filter === f ? "active" : ""}
                          onClick={() => setFilter(f)}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                    <label className="search-box">
                      <Search size={15} />
                      <input
                        aria-label="Search expenses"
                        placeholder="Find an expense…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>EXPENSE</th>
                          <th className="number">PLANNED</th>
                          <th className="number">ACTUAL</th>
                          <th>STATUS</th>
                          <th className="center">ACTIVE</th>
                          <th aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((e) => (
                          <tr
                            key={e.id}
                            className={!e.is_active ? "cancelled-row" : ""}
                          >
                            <td>
                              <div className="expense-name">
                                <span
                                  className={`expense-icon cat-${e.category.toLowerCase()}`}
                                >
                                  {e.category === "Connectivity" ? (
                                    <Globe2 size={17} />
                                  ) : e.category === "Savings" ? (
                                    <PiggyBank size={17} />
                                  ) : e.category === "Forex" ? (
                                    <Globe2 size={17} />
                                  ) : e.category === "Subscriptions" ? (
                                    <ReceiptText size={17} />
                                  ) : (
                                    <Wallet size={17} />
                                  )}
                                </span>
                                <button
                                  className="expense-name-button"
                                  onClick={() => openExpense(e)}
                                  disabled={busy}
                                >
                                  <strong>{e.name}</strong>
                                  <small>
                                    {e.category} <span>·</span>{" "}
                                    {e.is_recurring ? "Recurring" : "One-off"}
                                  </small>
                                  {e.description && (
                                    <span className="entry-description expense-description">
                                      {e.description}
                                    </span>
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="number" data-label="Planned">
                              {money(e.expected_amount)}
                            </td>
                            <td
                              data-label="Actual"
                              className={`number ${actual(e) === 0 ? "muted" : ""}`}
                            >
                              <button
                                className="amount-button"
                                onClick={() => {
                                  setEditing(e);
                                  setModal("history");
                                }}
                                aria-label={`View ${e.name} payments`}
                              >
                                {money(actual(e))}
                              </button>
                            </td>
                            <td data-label="Status">
                              <button
                                disabled={!e.is_active || busy}
                                className={`status status-${status(e).toLowerCase().replaceAll(" ", "-")}`}
                                onClick={() => openPayment(e)}
                                title={
                                  e.is_active
                                    ? "Record a payment"
                                    : "Restore this item to record a payment"
                                }
                              >
                                <span />
                                {status(e)}
                              </button>
                            </td>
                            <td className="center" data-label="Active">
                              <Switch.Root
                                className="switch"
                                checked={e.is_active}
                                disabled={busy}
                                onCheckedChange={(active) =>
                                  void mutate(
                                    changeExpense(e.id, (x) => ({
                                      ...x,
                                      is_active: active,
                                    })),
                                    active
                                      ? "Expense restored"
                                      : "Unpaid allocation freed up",
                                  )
                                }
                                aria-label={`${e.is_active ? "Cancel" : "Restore"} ${e.name}`}
                              >
                                <Switch.Thumb className="switch-thumb" />
                              </Switch.Root>
                            </td>
                            <td>
                              <div className="row-actions">
                                <button
                                  className="icon-button"
                                  title="Record payment"
                                  aria-label={`Record payment for ${e.name}`}
                                  disabled={!e.is_active || busy}
                                  onClick={() => openPayment(e)}
                                >
                                  <Plus size={16} />
                                  <span className="mobile-action-label">
                                    Record payment
                                  </span>
                                </button>
                                <button
                                  className="icon-button delete-action"
                                  aria-label={`Delete ${e.name}`}
                                  disabled={busy}
                                  onClick={() => {
                                    setEditing(e);
                                    setModal("delete");
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!rows.length && (
                      <div className="empty-state">
                        <ReceiptText size={30} />
                        <h3>
                          {search
                            ? "No matching expenses"
                            : "A fresh start for this month"}
                        </h3>
                        <p>
                          {search
                            ? "Try another name."
                            : "Add your first item or copy last month’s recurring plan."}
                        </p>
                        {!search && (
                          <Button
                            variant="outline"
                            onClick={() => openExpense()}
                          >
                            <Plus size={15} /> Add an expense
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="table-footer">
                    <span>
                      <span className="tiny-dot" /> Changes{" "}
                      {connected
                        ? "sync across devices"
                        : "save on this device"}
                    </span>
                    <button
                      disabled={busy || budget.expenses.length > 0}
                      title={
                        budget.expenses.length
                          ? "Open an empty month to copy your plan"
                          : ""
                      }
                      onClick={() => void copy()}
                    >
                      <Copy size={13} /> Copy previous month
                    </button>
                  </div>
                </section>
              )}
              {view === "Overview" && (
                <section className="panel chart-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>The plan & the reality</h2>
                      <p>Expected allocations alongside recorded payments.</p>
                    </div>
                    <div className="chart-legend">
                      <span>
                        <i />
                        Planned
                      </span>
                      <span>
                        <i />
                        Actual
                      </span>
                    </div>
                  </div>
                  <div className="bar-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        barGap={5}
                        margin={{ top: 10, right: 16, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid vertical={false} stroke="#eff0ec" />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#7d8179", fontSize: 11 }}
                        />
                        <YAxis
                          domain={[
                            0,
                            (dataMax: number) => Math.max(100000, dataMax),
                          ]}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#92968f", fontSize: 10 }}
                          tickFormatter={(n) =>
                            compactMoney(Number(n) * 100, currency)
                          }
                        />
                        <Tooltip
                          formatter={(v) => money(Number(v) * 100)}
                          contentStyle={{
                            borderRadius: 10,
                            border: "1px solid #e5e8df",
                            fontSize: 12,
                          }}
                        />
                        <Bar
                          isAnimationActive={false}
                          dataKey="Expected"
                          fill="#dce7db"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={28}
                        />
                        <Bar
                          isAnimationActive={false}
                          dataKey="Actual"
                          fill="#3c7258"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={28}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}
            </div>
            <aside className="right-column">
              <section className="cash-card">
                <div className="cash-label">
                  <span>
                    <Wallet size={16} /> Cash in hand
                  </span>
                  <span className="cash-mark">↗</span>
                </div>
                <div className="cash-value">{money(summary.cashRemaining)}</div>
                <p>
                  Income minus all recorded payments, including savings
                  contributions.
                </p>
                <div className="cash-divider" />
                <div>
                  <span>Savings still to set aside</span>
                  <strong>
                    {money(
                      Math.max(0, summary.savings - summary.savingsActual),
                    )}
                  </strong>
                </div>
              </section>
              <section className="panel allocation-panel" data-tour="savings">
                <div className="panel-heading">
                  <div>
                    <h2>Future you says thanks.</h2>
                    <p>Make progress beyond the everyday.</p>
                  </div>
                  <Leaf size={18} />
                </div>
                {[
                  [
                    "Savings",
                    summary.savings,
                    summary.savingsActual,
                    PiggyBank,
                  ],
                ].map(([label, target, paid, Icon]) => {
                  const I = Icon as typeof Wallet;
                  const percent =
                    Number(target) > 0
                      ? Math.min(100, (Number(paid) / Number(target)) * 100)
                      : 0;
                  return (
                    <div className="allocation-item" key={String(label)}>
                      <div className="allocation-title">
                        <span>
                          <I size={15} />
                          {String(label)}
                        </span>
                        <strong>{Math.round(percent)}%</strong>
                      </div>
                      <div className="progress-track">
                        <div style={{ width: `${percent}%` }} />
                      </div>
                      <div className="allocation-amount">
                        <strong>{money(Number(paid))}</strong>
                        <span>of {money(Number(target))}</span>
                      </div>
                    </div>
                  );
                })}
                <button
                  className="text-link"
                  onClick={() => {
                    setView("Savings");
                    setFilter("All items");
                    setSearch("");
                  }}
                >
                  Manage contributions <ArrowRight size={14} />
                </button>
              </section>
              <section className="panel category-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Where it’s going</h2>
                    <p>Payments by category</p>
                  </div>
                </div>
                {summary.totalActual > 0 ? (
                  <div className="category-list">
                    {byCategory
                      .filter((c) => c.total > 0)
                      .map((c, i) => (
                        <div key={c.name}>
                          <div className="category-line">
                            <span>
                              <i
                                style={{
                                  background: COLORS[i % COLORS.length],
                                }}
                              />
                              {c.name}
                            </span>
                            <strong>{money(c.total)}</strong>
                          </div>
                          <div className="category-track">
                            <span
                              style={{
                                width: `${(c.total / summary.totalActual) * 100}%`,
                                background: COLORS[i % COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="category-empty">
                    <div className="empty-ring">
                      <Leaf size={20} />
                    </div>
                    <strong>A clean slate.</strong>
                    <p>
                      Your spending breakdown will appear
                      <br /> after your first payment.
                    </p>
                  </div>
                )}
              </section>
              <div className="cancelled-note">
                <CheckCircle2 size={16} />
                <span>
                  {money(summary.cancelled)} freed from cancelled items
                </span>
              </div>
            </aside>
          </div>
          {view === "Overview" && (
            <section className="panel trend-panel">
              <div className="panel-heading">
                <div>
                  <h2>Your outgoings over time</h2>
                  <p>
                    Recorded payments across all budget items, including
                    savings. Showing {currency} months only.
                  </p>
                </div>
                <span className="count-pill">
                  {trend.length} {trend.length === 1 ? "month" : "months"}{" "}
                  recorded
                </span>
              </div>
              <div className="trend-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trend}
                    margin={{ top: 15, right: 30, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid vertical={false} stroke="#eff0ec" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#7d8179", fontSize: 11 }}
                    />
                    <YAxis
                      domain={[
                        0,
                        (dataMax: number) => Math.max(100000, dataMax),
                      ]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#92968f", fontSize: 10 }}
                      tickFormatter={(n) =>
                        compactMoney(Number(n) * 100, currency)
                      }
                    />
                    <Tooltip formatter={(v) => money(Number(v) * 100)} />
                    <Line
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="Spent"
                      stroke="#3c7258"
                      strokeWidth={2}
                      dot={{ r: 4, fill: "#3c7258" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
          <footer className="page-footer">
            <span>
              <Leaf size={13} /> A little more intentional, every month.
            </span>
            <button onClick={exportCSV}>
              <Download size={14} /> Export this month
            </button>
          </footer>
        </div>
      </main>
      <BudgetSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        budgets={budgets}
        budget={budget}
        onCurrencyChange={async (nextCurrency: Currency) => {
          const ok = await mutate(
            (items) =>
              items.map((b) =>
                b.id === selected ? { ...b, currency: nextCurrency } : b,
              ),
            `Currency changed to ${nextCurrency}. Amounts are unchanged.`,
          );
          if (!ok) throw new Error("Could not save the currency choice.");
        }}
        syncAvailable={syncAvailable}
        connected={connected}
        email={syncEmail}
        disabled={busy}
        onUseCloud={useCloud}
        onUpload={uploadDevice}
        onDisconnect={stopSync}
        onRestore={restoreBackup}
        onReplay={() => {
          setSettingsOpen(false);
          setView("Overview");
          setTourOpen(true);
        }}
      />
      {tourOpen && !settingsOpen && <OnboardingTour onFinish={finishTour} />}
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {notice}
        </div>
      )}
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setModal(null);
        }}
        title={
          modal === "expense"
            ? editing
              ? "Edit expense"
              : "Add an expense"
            : modal === "salary"
              ? "Set monthly income"
              : modal === "delete"
                ? "Delete this expense?"
                : modal === "history"
                  ? `${editing?.name} payments`
                  : `Record a payment`
        }
        description={
          modal === "expense"
            ? `Give your money a purpose. All amounts are in ${currency}.`
            : modal === "salary"
              ? "Choose the income you want to plan this month around."
              : modal === "delete"
                ? `This will permanently remove ${editing?.name} and all its payment history. Cancel the item instead to keep its history.`
                : modal === "history"
                  ? "Recorded payments determine the actual amount spent."
                  : `${editing?.name} · ${money(editing ? actual(editing) : 0)} paid so far`
        }
      >
        {(modal === "expense" || modal === "payment" || modal === "salary") && (
          <form onSubmit={(event) => void submit(event)}>
            {modal === "expense" && (
              <>
                <label>
                  Expense name
                  <input
                    autoFocus
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Groceries"
                  />
                </label>
                <label>
                  Category
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as ExpenseInput["category"])
                    }
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label>
              {modal === "salary"
                ? "Monthly income"
                : modal === "payment"
                  ? "Payment amount"
                  : "Expected amount"}{" "}
              ({currency} · {currencies[currency].symbol})
              <input
                autoFocus={modal !== "expense"}
                required
                type="number"
                inputMode="decimal"
                min={modal === "salary" ? "0" : "0.01"}
                max={modal === "payment" ? maxPayment / 100 : 1000000000}
                disabled={modal === "payment" && maxPayment === 0}
                aria-describedby={
                  modal === "payment" ? "payment-limit" : undefined
                }
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </label>
            {modal === "payment" && (
              <small id="payment-limit" className="amount-hint">
                {maxPayment > 0
                  ? `Up to ${money(maxPayment)} remaining for this expense.`
                  : "Fully paid. Increase the planned amount to record another payment."}
              </small>
            )}
            {modal === "payment" && (
              <label>
                Payment date
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
            )}
            {(modal === "expense" || modal === "payment") && (
              <label>
                Description (optional)
                <textarea
                  rows={3}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={
                    modal === "expense"
                      ? "e.g. Weekly groceries and household essentials"
                      : "e.g. Vegetables and rice from the market"
                  }
                />
                <small className="description-count">
                  {description.length}/{MAX_DESCRIPTION_LENGTH} characters
                </small>
              </label>
            )}
            {modal === "expense" && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                />{" "}
                Recurring expense
                <small>Include when copying into a new month</small>
              </label>
            )}
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="dialog-buttons">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                Cancel
              </Button>
              <Button
                disabled={busy || (modal === "payment" && maxPayment === 0)}
                type="submit"
              >
                {busy ? (
                  <Loader2 className="spin" size={15} />
                ) : (
                  <Check size={15} />
                )}{" "}
                {modal === "payment" ? "Record payment" : "Save changes"}
              </Button>
            </div>
          </form>
        )}
        {modal === "delete" && (
          <div className="dialog-buttons">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setModal(null)}
            >
              Keep expense
            </Button>
            <Button
              className="danger"
              disabled={busy}
              onClick={async () => {
                if (!editing) return;
                const ok = await mutate(
                  (items) =>
                    items.map((b) =>
                      b.id === selected
                        ? {
                            ...b,
                            expenses: b.expenses.filter(
                              (e) => e.id !== editing.id,
                            ),
                          }
                        : b,
                    ),
                  "Expense deleted",
                );
                if (ok) setModal(null);
              }}
            >
              Delete permanently
            </Button>
          </div>
        )}
        {modal === "history" && (
          <div className="payment-history">
            {historyExpense?.payments.length ? (
              historyExpense.payments.map((p) => (
                <div className="transaction" key={p.id}>
                  <div>
                    <strong>{money(p.amount)}</strong>
                    <small>
                      {new Date(p.paid_at + "T12:00:00").toLocaleDateString(
                        "en-GB",
                      )}
                    </small>
                    {p.description && (
                      <p className="entry-description">{p.description}</p>
                    )}
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Remove payment"
                    disabled={busy}
                    onClick={() =>
                      void mutate(
                        changeExpense(historyExpense.id, (e) => ({
                          ...e,
                          payments: e.payments.filter((x) => x.id !== p.id),
                        })),
                        "Payment removed",
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            ) : (
              <p className="history-empty">No payments yet.</p>
            )}
            {historyExpense?.is_active && (
              <Button
                disabled={busy}
                onClick={() => openPayment(historyExpense)}
              >
                <Plus size={15} /> Record payment
              </Button>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
