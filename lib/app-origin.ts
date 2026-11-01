type Environment = {
  APP_URL?: string;
  VERCEL_ENV?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_URL?: string;
};
function origin(value: string, hosted: boolean) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "APP_URL must be an app origin, without a path or credentials.",
    );
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (hosted && (local || url.protocol !== "https:")) return null;
  return url.origin;
}
export function appOrigin(env: Environment): string {
  const hosted =
    env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview";
  if (env.APP_URL) {
    const configured = origin(env.APP_URL.trim(), hosted);
    if (configured) return configured;
  }
  const host =
    env.VERCEL_ENV === "preview"
      ? env.VERCEL_URL
      : env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL;
  if (host) {
    const automatic = origin(`https://${host}`, true);
    if (automatic) return automatic;
  }
  if (hosted)
    throw new Error(
      "The deployed app URL is missing. Set APP_URL to your HTTPS app origin.",
    );
  return "http://127.0.0.1:3000";
}
