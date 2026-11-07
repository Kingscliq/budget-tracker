import "server-only";
import { NEW_ORIGIN, OLD_ORIGIN } from "./domain-migration";

export function migrationOrigins() {
  // Local two-origin testing only. Hosted deployments always use fixed origins.
  if (
    !process.env.VERCEL &&
    (process.env.NODE_ENV === "development" ||
      process.env.POCKET_MIGRATION_LOCAL_TEST === "1")
  ) {
    const source = process.env.POCKET_MIGRATION_SOURCE_ORIGIN;
    const target = process.env.POCKET_MIGRATION_TARGET_ORIGIN;
    const local = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
    if (
      source &&
      target &&
      local.test(source) &&
      local.test(target) &&
      source !== target
    )
      return { source, target };
  }
  return { source: OLD_ORIGIN, target: NEW_ORIGIN };
}
