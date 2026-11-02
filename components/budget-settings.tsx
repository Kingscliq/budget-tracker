"use client";
import { startTransition, useEffect, useRef, useState } from "react";
import * as Switch from "@radix-ui/react-switch";
import {
  Download,
  Upload,
  HardDrive,
  Cloud,
  HelpCircle,
  ArrowRight,
  Check,
  Loader2,
  Mail,
} from "lucide-react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import {
  makeBackup,
  parseBackup,
  validateBudgets,
  MAX_BACKUP_BYTES,
} from "@/lib/backup";
import {
  loadCloud,
  requestSyncCode,
  verifySyncCode,
  type CloudBudget,
} from "@/lib/cloud-client";
import type { Budget } from "@/lib/budget";
import { trackEvent } from "@/lib/analytics";
type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  budgets: Budget[];
  syncAvailable: boolean;
  connected: boolean;
  email: string;
  disabled: boolean;
  onUseCloud: (cloud: CloudBudget) => Promise<void>;
  onUpload: (cloud: CloudBudget) => Promise<void>;
  onDisconnect: () => Promise<void>;
  onRestore: (budgets: Budget[]) => Promise<void>;
  onReplay: () => void;
};
export function downloadBackup(budgets: Budget[], name = "pocket-backup") {
  const url = URL.createObjectURL(
    new Blob([makeBackup(budgets)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  trackEvent("backup_downloaded");
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function BudgetSettings(props: Props) {
  const {
    open,
    onOpenChange,
    budgets,
    syncAvailable,
    connected,
    email,
    disabled,
    onUseCloud,
    onUpload,
    onDisconnect,
    onRestore,
    onReplay,
  } = props;
  const [stage, setStage] = useState<
      "settings" | "email" | "code" | "choose" | "replace" | "restore"
    >("settings"),
    [analyticsAllowed, setAnalyticsAllowed] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [address, setAddress] = useState(""),
    [code, setCode] = useState(""),
    [cloud, setCloud] = useState<CloudBudget | null>(null),
    [restore, setRestore] = useState<Budget[] | null>(null),
    [previous, setPrevious] = useState<Budget[] | null>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      setStage("settings");
      setError("");
      setMessage("");
      setCode("");
      try {
        setAnalyticsAllowed(localStorage.getItem("pocket-analytics") !== "off");
        const saved = localStorage.getItem("pocket-previous-device-copy");
        setPrevious(saved ? validateBudgets(JSON.parse(saved)) : null);
      } catch {
        setPrevious(null);
      }
    }
  }, [open]);
  function run(task: () => Promise<void>) {
    if (busy || disabled) return;
    setBusy(true);
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        await task();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Please try again.");
      } finally {
        setBusy(false);
      }
    });
  }
  async function enable() {
    const saved = await loadCloud();
    if (saved) {
      setCloud(saved);
      setStage("choose");
    } else {
      setStage("email");
    }
  }
  function uploaded() {
    setStage("settings");
    setMessage("Sync is on. Use the same email on your other device.");
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
      title="Make Pocket yours"
      description="Start simple. Back up your budget or take it to another device whenever you’re ready."
    >
      <div className="budget-settings" aria-busy={busy}>
        {error && (
          <p className="settings-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="settings-success" role="status">
            <Check size={15} />
            {message}
          </p>
        )}
        {stage === "settings" && (
          <>
            <section className="settings-device">
              <HardDrive size={20} />
              <div>
                <h3>Saved on this device</h3>
                <p>
                  Your budget works without an account. Clearing this browser’s
                  data removes its saved copy, so keep a backup.
                </p>
              </div>
            </section>
            <section className="settings-section">
              <div className="settings-section-title">
                <div>
                  <h3>
                    <Cloud size={17} /> Sync across devices
                  </h3>
                  <p>
                    {connected
                      ? `Connected as ${email}`
                      : "Optional. Use the same budget on your phone and laptop."}
                  </p>
                </div>
                <Switch.Root
                  className="switch"
                  checked={connected}
                  disabled={busy || disabled || !syncAvailable}
                  aria-label="Sync across devices"
                  onCheckedChange={(value) =>
                    run(async () => {
                      if (value) await enable();
                      else await onDisconnect();
                    })
                  }
                >
                  <Switch.Thumb className="switch-thumb" />
                </Switch.Root>
              </div>
              {connected && (
                <>
                  <p className="settings-hint">
                    Turning sync off keeps this device’s copy. The cloud copy
                    stays in your account.
                  </p>
                  <Button
                    variant="outline"
                    disabled={busy || disabled}
                    onClick={() =>
                      run(async () => {
                        const latest = await loadCloud();
                        if (!latest)
                          throw new Error(
                            "Verify your email again to reconnect.",
                          );
                        setCloud(latest);
                        setStage("choose");
                      })
                    }
                  >
                    Review cloud copy <ArrowRight size={14} />
                  </Button>
                </>
              )}
              {!syncAvailable && (
                <p className="settings-hint">
                  Cloud sync hasn’t been configured for this app yet. Device
                  storage and backups work normally.
                </p>
              )}
            </section>
            <section className="settings-section">
              <h3>Backup & restore</h3>
              <p>
                A backup includes every month, expense and payment. Keep the
                file somewhere safe.
              </p>
              <div className="settings-actions">
                <Button
                  variant="outline"
                  disabled={busy || disabled}
                  onClick={() => {
                    try {
                      downloadBackup(budgets);
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "Could not download backup.",
                      );
                    }
                  }}
                >
                  <Download size={15} /> Download backup
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || disabled}
                  onClick={() => file.current?.click()}
                >
                  <Upload size={15} /> Restore backup
                </Button>
              </div>
              {previous && (
                <button
                  className="settings-link"
                  onClick={() =>
                    downloadBackup(previous, "pocket-previous-device-copy")
                  }
                >
                  Download copy from before the last replacement
                </button>
              )}
              <input
                ref={file}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                aria-label="Choose Pocket backup"
                onChange={(event) => {
                  const input = event.target;
                  const selected = input.files?.[0];
                  if (!selected) return;
                  run(async () => {
                    try {
                      if (selected.size > MAX_BACKUP_BYTES)
                        throw new Error("Choose a backup smaller than 750 KB.");
                      setRestore(parseBackup(await selected.text()));
                      setStage("restore");
                    } finally {
                      input.value = "";
                    }
                  });
                }}
              />
            </section>
            <section className="settings-section">
              <div className="settings-section-title">
                <div>
                  <h3>Usage analytics</h3>
                  <p>
                    Help improve Pocket with Google Analytics visit and feature
                    usage statistics. We never send your budget amounts, expense
                    names, or email. Google uses browser cookies to measure
                    visits.
                  </p>
                </div>
                <Switch.Root
                  className="switch"
                  aria-label="Usage analytics"
                  checked={analyticsAllowed}
                  onCheckedChange={(allowed) => {
                    try {
                      localStorage.setItem(
                        "pocket-analytics",
                        allowed ? "on" : "off",
                      );
                      setAnalyticsAllowed(allowed);
                      // Reload stops the Google tag and its automatic engagement events.
                      location.reload();
                    } catch {
                      setError("Could not save your analytics preference.");
                    }
                  }}
                >
                  <Switch.Thumb className="switch-thumb" />
                </Switch.Root>
              </div>
              <p className="settings-hint">
                This choice applies to this browser. Changing it reloads Pocket;
                your saved budget stays here.
              </p>
            </section>
            <button
              className="settings-replay"
              disabled={busy}
              onClick={onReplay}
            >
              <HelpCircle size={17} /> Show the quick tour again{" "}
              <ArrowRight size={14} />
            </button>
          </>
        )}
        {stage === "email" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await requestSyncCode(address);
                trackEvent("sync_requested");
                setStage("code");
              });
            }}
          >
            <div className="settings-illustration">
              <Mail size={24} />
            </div>
            <h3>One budget. Any device.</h3>
            <p>
              We’ll email you a sign-in link. Your email is only used for
              optional sync. Your budget won’t upload until you verify and
              choose the copy to use.
            </p>
            <label>
              Email address
              <input
                required
                autoFocus
                type="email"
                autoComplete="email"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <div className="dialog-buttons">
              <Button
                variant="outline"
                type="button"
                disabled={busy}
                onClick={() => setStage("settings")}
              >
                Not now
              </Button>
              <Button disabled={busy} type="submit">
                {busy ? <Loader2 size={15} className="spin" /> : null}Send
                sign-in email
              </Button>
            </div>
          </form>
        )}
        {stage === "code" && (
          <div>
            <h3>Check your inbox</h3>
            <p>
              Open the sign-in link sent to <strong>{address}</strong> in this
              same browser. Your budget stays on this device until you choose to
              upload it.
            </p>
            <Button
              className="settings-wide"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const saved = await loadCloud();
                  if (!saved)
                    throw new Error(
                      "Open the email link in this browser first, then try again.",
                    );
                  setCloud(saved);
                  setStage("choose");
                })
              }
            >
              I’ve opened the sign-in link <ArrowRight size={14} />
            </Button>
            <details className="settings-code">
              <summary>My email contains a code instead</summary>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  run(async () => {
                    const saved = await verifySyncCode(address, code.trim());
                    if (!saved)
                      throw new Error("Could not verify this session.");
                    setCloud(saved);
                    setStage("choose");
                  });
                }}
              >
                <label>
                  Sign-in code
                  <input
                    required
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    pattern="[0-9]{6,10}"
                    minLength={6}
                    maxLength={10}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                </label>
                <Button type="submit" disabled={busy}>
                  Verify code
                </Button>
              </form>
            </details>
            <button
              className="settings-link"
              disabled={busy}
              onClick={() => {
                setCode("");
                setStage("email");
              }}
            >
              Change email / resend
            </button>
          </div>
        )}
        {stage === "choose" && cloud && (
          <>
            <h3>
              {cloud.budgets
                ? "Choose your budget copy"
                : "Ready to turn on sync?"}
            </h3>
            <p>
              Verified as <strong>{cloud.email}</strong>.
            </p>
            {cloud.budgets ? (
              <>
                <p>
                  Your account has {cloud.budgets.length} saved{" "}
                  {cloud.budgets.length === 1 ? "month" : "months"}. This device
                  has {budgets.length}. Choose one copy; Pocket won’t merge or
                  overwrite them automatically.
                </p>
                <Button
                  className="settings-wide"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await onUseCloud(cloud);
                      uploaded();
                    })
                  }
                >
                  <Cloud size={15} /> Use saved cloud budget
                </Button>
                <Button
                  className="settings-wide"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setStage("replace")}
                >
                  Use this device’s budget instead
                </Button>
              </>
            ) : (
              <>
                <p>
                  Upload this device’s {budgets.length}{" "}
                  {budgets.length === 1 ? "month" : "months"}, including
                  expenses and payments, to your private Supabase account. You
                  can then open the same budget on your other devices.
                </p>
                <Button
                  className="settings-wide"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await onUpload(cloud);
                      uploaded();
                    })
                  }
                >
                  Turn on sync & upload budget <ArrowRight size={15} />
                </Button>
              </>
            )}
            <button
              disabled={busy}
              className="settings-link"
              onClick={() => setStage("settings")}
            >
              Keep using this device only
            </button>
          </>
        )}
        {stage === "replace" && cloud && (
          <>
            <h3>Replace your cloud budget?</h3>
            <p>
              This device’s budget will replace the copy used by your other
              devices. Download the current cloud copy first if you want to keep
              both.
            </p>
            <Button
              variant="outline"
              className="settings-wide"
              onClick={() => {
                if (cloud.budgets)
                  downloadBackup(
                    cloud.budgets,
                    "pocket-cloud-before-replacement",
                  );
              }}
            >
              Download current cloud copy
            </Button>
            <div className="dialog-buttons">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setStage("choose")}
              >
                Go back
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await onUpload(cloud);
                    uploaded();
                  })
                }
              >
                Replace & sync
              </Button>
            </div>
          </>
        )}
        {stage === "restore" && restore && (
          <>
            <h3>
              Restore {restore.length}{" "}
              {restore.length === 1 ? "month" : "months"}?
            </h3>
            <p>
              This replaces the budget on this device
              {connected ? " and your synced cloud copy" : ""}. A copy of your
              current device budget will be kept here in Settings.
            </p>
            <div className="dialog-buttons">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setRestore(null);
                  setStage("settings");
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await onRestore(restore);
                    setPrevious(budgets);
                    setRestore(null);
                    setStage("settings");
                    setMessage("Backup restored.");
                  })
                }
              >
                Restore this backup
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
