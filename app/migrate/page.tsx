import { MigrationReceiver } from "@/components/domain-migration";
import { migrationOrigins } from "@/lib/migration-config";
export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export const dynamic = "force-dynamic";
export default function Page() {
  return <MigrationReceiver {...migrationOrigins()} />;
}
