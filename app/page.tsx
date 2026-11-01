import Dashboard from "@/components/dashboard";
import { databaseConfigured } from "@/lib/supabase";
import { loadBudgets } from "./actions";
export const dynamic = "force-dynamic";
export default async function Page() {
  const connected = databaseConfigured();
  let initial: Awaited<ReturnType<typeof loadBudgets>> = [];
  let error = "";
  if (connected) {
    try {
      initial = await loadBudgets();
    } catch {
      error =
        "Could not connect to Supabase. Check your database configuration and reload.";
    }
  }
  return (
    <Dashboard initial={initial} connected={connected} initialError={error} />
  );
}
