import { NextResponse, type NextRequest } from "next/server";
import { verifyMagicLink } from "@/lib/services/portal-auth";

/** Magic link from the sign-in email: starts a session and opens the portal. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const ok = token.length > 20 && (await verifyMagicLink(token));
  const url = new URL(ok ? "/account" : "/account?link=expired", request.url);
  return NextResponse.redirect(url);
}
