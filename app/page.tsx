import { DomainMigrationGate } from "@/components/domain-migration";
import { migrationOrigins } from "@/lib/migration-config";
import Dashboard from "@/components/dashboard";
import { syncConfigured } from "@/lib/supabase";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <DomainMigrationGate {...migrationOrigins()}>
      <Dashboard syncAvailable={syncConfigured()} />
    </DomainMigrationGate>
  );
}
