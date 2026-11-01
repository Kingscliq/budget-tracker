import { NextResponse, type NextRequest } from "next/server";
import { linkAuthClient, storeSession } from "@/lib/supabase";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code"),
    flowId = request.nextUrl.searchParams.get("sb_flow_id");
  if (code && code.length <= 2048) {
    try {
      const client = await linkAuthClient();
      const { data, error } = await client.auth.exchangeCodeForSession(
        code,
        flowId ? { flowId } : undefined,
      );
      if (!error && data.session) {
        await storeSession(data.session);
        return NextResponse.redirect(new URL("/?sync=verified", request.url));
      }
    } catch {
      /* expired or wrong-browser links are recoverable from Settings */
    }
  }
  return NextResponse.redirect(new URL("/?sync=error", request.url));
}
