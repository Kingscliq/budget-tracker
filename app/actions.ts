"use server";
import {
  authClient,
  linkAuthClient,
  clearSession,
  identity,
  storeSession,
  syncConfigured,
} from "@/lib/supabase";
import { appOrigin } from "@/lib/app-origin";
import { validateBudgets } from "@/lib/backup";
import type { Budget } from "@/lib/budget";
export type CloudBudget = {
  email: string;
  budgets: Budget[] | null;
  revision: number | null;
};
function failure(error: { code?: string; message: string } | null) {
  if (error) {
    console.error("Pocket sync:", error.code);
    throw new Error(
      error.code === "42P01" || error.code === "PGRST205"
        ? "Cloud sync needs its database migration. Your budget is safe on this device."
        : "Could not sync. Your budget is safe on this device. Please try again.",
    );
  }
}
async function requestSyncCodeImpl(email: string) {
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !/^\S+@\S+\.\S+$/.test(email.trim())
  )
    throw new Error("Enter a valid email address.");
  const { error } = await (
    await linkAuthClient()
  ).auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${appOrigin({ APP_URL: process.env.APP_URL, VERCEL_ENV: process.env.VERCEL_ENV, VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL, VERCEL_URL: process.env.VERCEL_URL })}/auth/confirm`,
    },
  });
  if (error)
    throw new Error(
      "Could not send a sign-in email. Please wait a minute and try again.",
    );
}
async function verifySyncCodeImpl(email: string, token: string) {
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    typeof token !== "string" ||
    !/^\d{6,10}$/.test(token)
  )
    throw new Error("Enter the code from your email.");
  const { data, error } = await authClient().auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token,
    type: "email",
  });
  if (error || !data.session)
    throw new Error("That code is invalid or expired. Request a new one.");
  await storeSession(data.session);
  return loadCloudImpl();
}
async function loadCloudImpl(): Promise<CloudBudget | null> {
  if (!syncConfigured()) return null;
  const auth = await identity();
  if (!auth) return null;
  const { data, error } = await auth.client
    .from("budget_workspaces")
    .select("budget_data,revision")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  failure(error);
  return {
    email: auth.user.email!,
    budgets: data ? validateBudgets(data.budget_data) : null,
    revision: data?.revision ?? null,
  };
}
async function saveCloudImpl(
  value: Budget[],
  expectedRevision: number | null,
): Promise<number> {
  const budgets = validateBudgets(value);
  if (
    expectedRevision !== null &&
    (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)
  )
    throw new Error("Invalid sync version.");
  const auth = await identity();
  if (!auth)
    throw new Error(
      "Please verify your email again to resume sync. Your budget is still on this device.",
    );
  if (expectedRevision === null) {
    const { error } = await auth.client
      .from("budget_workspaces")
      .insert({ user_id: auth.user.id, budget_data: budgets, revision: 1 });
    if (error?.code === "23505")
      throw new Error(
        "Another device saved a budget. Open Settings to choose the latest cloud copy or keep this device’s version.",
      );
    failure(error);
    return 1;
  }
  const next = expectedRevision + 1;
  const { data, error } = await auth.client
    .from("budget_workspaces")
    .update({
      budget_data: budgets,
      revision: next,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", auth.user.id)
    .eq("revision", expectedRevision)
    .select("revision")
    .maybeSingle();
  failure(error);
  if (!data)
    throw new Error(
      "Another device has newer changes. Your edits are safe here. Open Settings to choose which copy to use.",
    );
  return next;
}
async function disconnectSyncImpl() {
  try {
    const auth = await identity();
    if (auth) await authClient().auth.admin.signOut(auth.token, "local");
  } finally {
    await clearSession();
  }
}

// Expected failures are serialized explicitly so production builds retain useful messages.
type Result<T> = { ok: true; data: T } | { ok: false; error: string };
async function respond<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Could not complete sync. Your device copy is safe.",
    };
  }
}
export async function requestSyncCode(email: string) {
  return respond(() => requestSyncCodeImpl(email));
}
export async function verifySyncCode(email: string, token: string) {
  return respond(() => verifySyncCodeImpl(email, token));
}
export async function loadCloud() {
  return respond(loadCloudImpl);
}
export async function saveCloud(budgets: Budget[], revision: number | null) {
  return respond(() => saveCloudImpl(budgets, revision));
}
export async function disconnectSync() {
  return respond(disconnectSyncImpl);
}
