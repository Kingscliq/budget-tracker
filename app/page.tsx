import Dashboard from "@/components/dashboard";
import { syncConfigured } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export default function Page() {
  return <Dashboard syncAvailable={syncConfigured()} />;
}
