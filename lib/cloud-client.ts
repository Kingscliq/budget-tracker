import * as actions from "@/app/actions";
export type { CloudBudget } from "@/app/actions";
function unwrap<T>(
  result: { ok: true; data: T } | { ok: false; error: string },
): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
export async function loadCloud() {
  return unwrap(await actions.loadCloud());
}
export async function requestSyncCode(email: string) {
  return unwrap(await actions.requestSyncCode(email));
}
export async function verifySyncCode(email: string, code: string) {
  return unwrap(await actions.verifySyncCode(email, code));
}
export async function saveCloud(
  budgets: import("./budget").Budget[],
  revision: number | null,
) {
  return unwrap(await actions.saveCloud(budgets, revision));
}
export async function disconnectSync() {
  return unwrap(await actions.disconnectSync());
}
