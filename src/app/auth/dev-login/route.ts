import { NextResponse, type NextRequest } from "next/server";
import { devLoginEmails } from "@/lib/dev-login";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Local-only sign-in without an email, for when Supabase's mail rate limit blocks magic
 * links. Works only in `next dev`, only for addresses in DEV_LOGIN_EMAILS and only for
 * forms posted from this app.
 */
export async function POST(request: NextRequest) {
  const { origin } = request.nextUrl;
  const allowed = devLoginEmails();
  if (allowed.length === 0) return new NextResponse(null, { status: 404 });
  if (request.headers.get("origin") !== origin) return new NextResponse(null, { status: 403 });

  const form = await request.formData().catch(() => null);
  const email = String(form?.get("email") ?? "").trim().toLowerCase();
  if (!allowed.includes(email)) return NextResponse.redirect(`${origin}/login?error=dev`, 303);

  const admin = createAdminClient();
  const supabase = await createClient();
  if (!admin || !supabase) return NextResponse.redirect(`${origin}/login?error=config`, 303);

  // A magic link is created but never sent; its token is verified right here.
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) {
    console.warn(`dev login: link generation failed (${error.code ?? error.status})`);
    return NextResponse.redirect(`${origin}/login?error=link`, 303);
  }
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "email",
  });
  if (verifyError) {
    console.warn(`dev login: verification failed (${verifyError.code ?? verifyError.status})`);
    return NextResponse.redirect(`${origin}/login?error=link`, 303);
  }
  return NextResponse.redirect(`${origin}/interviews`, 303);
}
