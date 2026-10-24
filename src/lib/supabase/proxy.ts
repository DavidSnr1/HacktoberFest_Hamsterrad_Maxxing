import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "./env";

const PROTECTED_PREFIXES = ["/character", "/interviews", "/resume", "/profile", "/onboarding"];
const AUTH_ROUTES = ["/login"];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the Supabase session cookie and does optimistic auth redirects.
 * Pages still verify the user server-side; this is only a fast first gate.
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const env = getSupabasePublicEnv();

  let response = NextResponse.next({ request });
  let isSignedIn = false;

  if (env) {
    const supabase = createServerClient(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    });

    // Do not run code between createServerClient and getClaims:
    // it refreshes the session and must see the fresh cookies.
    const { data } = await supabase.auth.getClaims();
    isSignedIn = Boolean(data?.claims);
  }

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Keep refreshed session cookies on the redirect.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (pathname === "/") {
    return redirectTo(isSignedIn ? "/interviews" : "/login");
  }
  if (!isSignedIn && matches(pathname, PROTECTED_PREFIXES)) {
    return redirectTo("/login");
  }
  if (isSignedIn && matches(pathname, AUTH_ROUTES)) {
    return redirectTo("/interviews");
  }

  return response;
}
