import "server-only";
import { createClient, type Session } from "@supabase/supabase-js";
import { cookies } from "next/headers";
export const syncConfigured = () =>
  !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
export function authClient() {
  if (!syncConfigured())
    throw new Error(
      "Cloud sync is not configured on this server. You can still save on this device.",
    );
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
const accessCookie = "pocket-access",
  refreshCookie = "pocket-refresh";
export async function storeSession(session: Session) {
  const jar = await cookies();
  const options = {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.POCKET_LOCAL_HTTP !== "true",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
  jar.set(accessCookie, session.access_token, options);
  jar.set(refreshCookie, session.refresh_token, options);
}
export async function clearSession() {
  const jar = await cookies();
  jar.delete(accessCookie);
  jar.delete(refreshCookie);
}
export async function identity() {
  const jar = await cookies();
  let token = jar.get(accessCookie)?.value;
  const refresh = jar.get(refreshCookie)?.value;
  if (!token && !refresh) return null;
  const auth = authClient();
  let result = token ? await auth.auth.getUser(token) : null;
  if (!result?.data.user) {
    if (!refresh) return null;
    const { data, error } = await auth.auth.refreshSession({
      refresh_token: refresh,
    });
    if (error || !data.session) return null;
    await storeSession(data.session);
    token = data.session.access_token;
    result = await auth.auth.getUser(token);
  }
  const user = result.data.user;
  if (!user || !user.email || !user.email_confirmed_at) return null;
  // User JWT replaces the privileged Authorization header: all data requests obey RLS.
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  return { user, client, token: token! };
}

export async function linkAuthClient() {
  if (!syncConfigured()) throw new Error("Cloud sync is not configured.");
  const jar = await cookies();
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: {
          getItem: (key) =>
            key.endsWith("code-verifier")
              ? (jar.get(key)?.value ?? null)
              : null,
          setItem: (key, value) => {
            if (key.endsWith("code-verifier"))
              jar.set(key, value, {
                httpOnly: true,
                sameSite: "lax",
                secure:
                  process.env.NODE_ENV === "production" &&
                  process.env.POCKET_LOCAL_HTTP !== "true",
                path: "/",
                maxAge: 60 * 15,
              });
          },
          removeItem: (key) => {
            if (key.endsWith("code-verifier")) jar.delete(key);
          },
        },
      },
    },
  );
}
