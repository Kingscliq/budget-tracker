"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Wallet, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import {
  BUDGET_STORAGE,
  MIGRATION_RECEIPT,
  PROTOCOL,
  MAX_TRANSFER_BYTES,
  readDeviceBudget,
  sameBudget,
  validMessage,
  importDeviceBudget,
} from "@/lib/domain-migration";
import { money, type Budget } from "@/lib/budget";

type Origins = { source: string; target: string };
async function digest(raw: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
function MigrationCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="migration-page">
      <section className="migration-card">
        <Wallet aria-hidden="true" size={32} />
        <p className="migration-brand">POCKET</p>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  );
}

export function DomainMigrationGate({
  children,
  source,
  target,
}: Origins & { children: ReactNode }) {
  const [mode, setMode] = useState<"loading" | "source" | "app">("loading");
  const [recover, setRecover] = useState(false);
  useEffect(() => {
    if (
      location.origin === source &&
      !new URLSearchParams(location.search).has("stay")
    ) {
      // Auth callbacks must finish on their issuing origin before moving budgets.
      if (new URLSearchParams(location.search).has("sync")) setMode("app");
      else setMode("source");
    } else {
      setMode("app");
      if (location.origin === target) {
        try {
          setRecover(localStorage.getItem(MIGRATION_RECEIPT) === null);
        } catch {
          /* App handles storage failure. */
        }
      }
    }
  }, [source, target]);
  if (mode === "source")
    return <MigrationSource source={source} target={target} />;
  if (mode === "loading")
    return (
      <div className="loading">
        <Loader2 className="spin" /> Getting your budget ready…
      </div>
    );
  return (
    <>
      {recover && (
        <aside
          className="migration-banner"
          aria-label="Recover an existing budget"
        >
          <span>Used Pocket at our previous address?</span>
          <a href={`${source}/?recover=1`}>
            Bring your saved budget over <span aria-hidden="true">→</span>
          </a>
          <button
            aria-label="Dismiss budget migration reminder"
            onClick={() => {
              setRecover(false);
              try {
                localStorage.setItem(
                  MIGRATION_RECEIPT,
                  JSON.stringify({ dismissed: true }),
                );
              } catch {
                /* Optional preference. */
              }
            }}
          >
            ×
          </button>
        </aside>
      )}
      {children}
    </>
  );
}

function MigrationSource({ source, target }: Origins) {
  const peer = useRef<Window | null>(null);
  const nonce = useRef("");
  const sentRaw = useRef<string | null>(null);
  const [message, setMessage] = useState(
    "Moving your budget to our new address…",
  );
  const [canRetry, setCanRetry] = useState(false);
  const [finished, setFinished] = useState(false);
  const [fatal, setFatal] = useState(false);
  const attempted = useRef(false);
  const settled = useRef(false);
  const start = () => {
    nonce.current = crypto.randomUUID();
    setCanRetry(false);
    setMessage("Moving your budget to our new address…");
    peer.current = window.open(
      `${target}/migrate#${nonce.current}`,
      "pocket-budget-migration",
    );
    if (!peer.current) {
      setCanRetry(true);
      setMessage(
        "Your saved budget is safe. Continue to move it to our new address.",
      );
    }
  };
  useEffect(() => {
    let active = true;
    const receive = async (event: MessageEvent) => {
      if (!validMessage(event, target, peer.current, nonce.current)) return;
      if (event.data.type === "ready") {
        try {
          const raw = localStorage.getItem(BUDGET_STORAGE);
          if (!readDeviceBudget(raw))
            throw new Error(
              "No saved budget was found in this browser. Use the browser and device where you entered it.",
            );
          sentRaw.current = raw;
          peer.current!.postMessage(
            {
              protocol: PROTOCOL,
              nonce: nonce.current,
              type: "budget",
              raw,
              tourDone: localStorage.getItem("pocket-tour-v1") === "done",
              analyticsOff: localStorage.getItem("pocket-analytics") === "off",
            },
            target,
          );
          setMessage(
            "Moving your budget… If asked, choose which saved copy to keep in the new tab.",
          );
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "We couldn’t read your saved budget.",
          );
          setCanRetry(true);
        }
      }
      if (event.data.type === "saved" && sentRaw.current !== null) {
        settled.current = true;
        const moved = sentRaw.current;
        // Keep the original and only remember a verified, unchanged source snapshot.
        try {
          if (localStorage.getItem(BUDGET_STORAGE) !== moved) {
            setMessage(
              "Your old budget changed during the move. Move it again to include the latest edits.",
            );
            setCanRetry(true);
            return;
          }
          const fingerprint = await digest(moved);
          localStorage.setItem(
            MIGRATION_RECEIPT,
            JSON.stringify({ fingerprint, target }),
          );
        } catch {
          /* A receipt is optional; the destination already verified its save. */
        }
        peer.current?.close();
        setFinished(true);
        location.replace(target);
      }
      if (event.data.type === "kept") {
        settled.current = true;
        peer.current?.close();
        setMessage(
          "Your budget at the new address is unchanged. The original copy is still safe here.",
        );
        setFinished(true);
      }
    };
    window.addEventListener("message", receive);
    const timeout = window.setTimeout(() => {
      if (settled.current) return;
      setCanRetry(true);
      setMessage(
        "If the move hasn’t finished, continue below. Your original budget stays safe.",
      );
    }, 30000);
    async function begin() {
      try {
        const raw = localStorage.getItem(BUDGET_STORAGE);
        if (raw === null) {
          // Never seed a default budget over the source before checking it.
          location.replace(target);
          return;
        }
        readDeviceBudget(raw);
        if (!new URLSearchParams(location.search).has("recover")) {
          const receipt = JSON.parse(
            localStorage.getItem(MIGRATION_RECEIPT) || "null",
          );
          if (
            receipt?.target === target &&
            receipt.fingerprint === (await digest(raw))
          ) {
            if (active) location.replace(target);
            return;
          }
        }
        if (active && !attempted.current) {
          attempted.current = true;
          start();
        }
      } catch (error) {
        if (active) {
          setFatal(true);
          setMessage(
            error instanceof Error
              ? error.message
              : "Your browser couldn’t read its saved budget. Open the original app to make a backup.",
          );
        }
      }
    }
    void begin();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
    };
  }, [source, target]);
  return (
    <MigrationCard
      title={finished ? "Your budget is safe" : "A new home for your budget"}
    >
      <p role="status" aria-live="polite">
        {message}
      </p>
      {canRetry && !fatal && !finished && (
        <Button onClick={start}>Move my budget</Button>
      )}
      {finished && (
        <a className="btn btn-primary" href={target}>
          Open Pocket
        </a>
      )}
      <p className="migration-note">
        Your budget moves directly between these two Pocket addresses. Your
        original copy stays on this device.
      </p>
      <a className="migration-link" href={`${source}/?stay=1`}>
        Stay at the previous address
      </a>
    </MigrationCard>
  );
}

export function MigrationReceiver({ source, target }: Origins) {
  const [message, setMessage] = useState("Connecting to your saved budget…");
  const [incoming, setIncoming] = useState<Budget[] | null>(null);
  const [existing, setExisting] = useState<Budget[] | null>(null);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const expectedRaw = useRef<string | null>(null);
  const sender = useRef<Window | null>(null);
  const nonce = useRef("");
  const sourceOptions = useRef({ tourDone: false, analyticsOff: false });
  const handled = useRef(false);
  function reply(type: string) {
    sender.current?.postMessage(
      { protocol: PROTOCOL, nonce: nonce.current, type },
      source,
    );
  }
  function commit(budgets: Budget[]) {
    try {
      importDeviceBudget(localStorage, budgets, expectedRaw.current);
      // Optional preferences must never turn a verified save into a failure.
      try {
        // Do not broaden tracking consent; carry forward opt-out only.
        if (sourceOptions.current.analyticsOff)
          localStorage.setItem("pocket-analytics", "off");
        if (sourceOptions.current.tourDone)
          localStorage.setItem("pocket-tour-v1", "done");
        localStorage.setItem(
          MIGRATION_RECEIPT,
          JSON.stringify({ imported: true, from: source }),
        );
      } catch {
        /* The verified budget and recovery copies are already saved. */
      }
      setDone(true);
      setMessage("Your budget has moved. You can continue at the new address.");
      reply("saved");
    } catch (error) {
      setFailed(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Your browser couldn’t save the budget. The original copy is safe at the previous address.",
      );
    }
  }
  useEffect(() => {
    const sessionNonce = nonce.current || location.hash.slice(1);
    if (
      location.origin !== target ||
      !window.opener ||
      !/^[0-9a-f-]{36}$/.test(sessionNonce)
    ) {
      setFailed(true);
      setMessage(
        "Start the move from Pocket’s previous address in the browser where your budget is saved.",
      );
      return;
    }
    nonce.current = sessionNonce;
    sender.current = window.opener;
    history.replaceState({}, "", "/migrate");
    const receive = (event: MessageEvent) => {
      if (
        !validMessage(event, source, sender.current, nonce.current) ||
        event.data.type !== "budget" ||
        handled.current
      )
        return;
      handled.current = true;
      try {
        if (
          typeof event.data.raw !== "string" ||
          event.data.raw.length > MAX_TRANSFER_BYTES
        )
          throw new Error(
            "This budget cannot be moved automatically. Use Backup & restore in Settings.",
          );
        const budgets = readDeviceBudget(event.data.raw)!;
        const raw = localStorage.getItem(BUDGET_STORAGE);
        const current = readDeviceBudget(raw);
        expectedRaw.current = raw;
        sourceOptions.current = {
          tourDone: event.data.tourDone === true,
          analyticsOff: event.data.analyticsOff === true,
        };
        setIncoming(budgets);
        setExisting(current);
        if (current && !sameBudget(current, budgets)) {
          setMessage(
            "There’s already a different budget at this address. Choose the copy you want to use. We’ll keep a backup before replacing anything.",
          );
        } else commit(budgets);
      } catch (error) {
        setFailed(true);
        setMessage(
          error instanceof Error
            ? error.message
            : "We couldn’t move this budget. Your original copy is safe.",
        );
      }
    };
    window.addEventListener("message", receive);
    reply("ready");
    const timeout = window.setTimeout(() => {
      if (!handled.current) {
        setFailed(true);
        setMessage(
          "We couldn’t connect to the previous address. Open it again to retry; your original budget is unchanged.",
        );
      }
    }, 30000);
    return () => {
      window.removeEventListener("message", receive);
      window.clearTimeout(timeout);
    };
  }, [source, target]);
  return (
    <MigrationCard
      title={
        done
          ? "Welcome back"
          : existing && incoming
            ? "Choose your budget"
            : "Moving your budget"
      }
    >
      <p role="status" aria-live="polite">
        {message}
      </p>
      {existing && incoming && !done && !failed && (
        <div className="migration-choices">
          <div>
            <strong>Previous address</strong>
            <span>{describe(incoming)}</span>
          </div>
          <div>
            <strong>New address</strong>
            <span>{describe(existing)}</span>
          </div>
          <Button onClick={() => commit(incoming)}>
            Use budget from previous address
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setDone(true);
              setMessage(
                "Your budget at the new address is unchanged. The previous copy stays at the old address.",
              );
              reply("kept");
            }}
          >
            Keep budget at new address
          </Button>
        </div>
      )}
      {done && (
        <a className="btn btn-primary" href="/">
          Open my budget
        </a>
      )}
      {failed && (
        <a className="btn btn-primary" href={`${source}/?recover=1`}>
          Return to previous address
        </a>
      )}
      <p className="migration-note">
        The original stays safe. Email sign-in and cloud sync are managed
        separately in Settings.
      </p>
    </MigrationCard>
  );
}
function describe(budgets: Budget[]) {
  const expenses = budgets.flatMap((b) => b.expenses);
  const payments = expenses.reduce((n, e) => n + e.payments.length, 0);
  const latest = [...budgets].sort(
    (a, b) => b.year - a.year || b.month - a.month,
  )[0];
  const month = new Date(latest.year, latest.month - 1).toLocaleDateString(
    "en",
    { month: "long", year: "numeric" },
  );
  const paid = latest.expenses
    .flatMap((e) => e.payments)
    .reduce((n, p) => n + p.amount, 0);
  return `${budgets.length} month${budgets.length === 1 ? "" : "s"} · ${expenses.length} expenses · ${payments} payment${payments === 1 ? "" : "s"}. ${month}: income ${money(latest.salary, latest.currency)}, paid ${money(paid, latest.currency)}.`;
}
