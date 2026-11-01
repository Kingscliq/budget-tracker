import "server-only";
import { createClient } from "@supabase/supabase-js";
export const databaseConfigured = () =>
  !!(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.BUDGET_PRIVATE_ACCESS_CONFIRMED === "true"
  );
export function db() {
  if (!databaseConfigured())
    throw new Error("Database is not configured for private access.");
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
