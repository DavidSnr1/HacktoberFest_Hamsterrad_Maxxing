import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Completes the magic-link sign-in and redirects into the app. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/login?error=config`);
  }

  // PKCE flow (default): the link carries a one-time code.
  const code = searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/interviews`);
    // Code only, no personal data. Typical: link opened in another browser (PKCE verifier missing).
    console.warn(`auth callback: code exchange failed (${error.code ?? error.status})`);
  }

  // Token-hash flow: used if the email template links here directly.
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${origin}/interviews`);
    console.warn(`auth callback: token verification failed (${error.code ?? error.status})`);
  }

  // Already signed in, e.g. the link was opened a second time: no need for an error.
  const { data } = await supabase.auth.getClaims();
  if (data) return NextResponse.redirect(`${origin}/interviews`);

  return NextResponse.redirect(`${origin}/login?error=link`);
}
