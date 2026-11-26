import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * /site holds the coworking operator pages. They are staff-only, like /admin,
 * and were under it until the URLs were shortened — so it belongs here too.
 * Leaving it out would not have opened the data (every page and every action
 * calls requirePermission), but a signed-out visitor would have met an error
 * instead of the login page.
 */
// This proxy only asks "signed in?". It cannot ask "is staff?": staff_roles has
// no policy for anon/authenticated (service-role only) and the proxy holds the
// anon key. The role check is the /admin and /site layouts (any staff role may
// enter); each page and action then enforces its own permission.
const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/site"];

/** Prefixes whose visitors belong at the staff login, not the public one. */
const STAFF_PREFIXES = ["/admin", "/site"];

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — do not remove this call
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAdminLogin = pathname === "/admin-login";

  if (isProtected && !isAdminLogin && !user) {
    const redirectUrl = request.nextUrl.clone();
    if (STAFF_PREFIXES.some((p) => pathname.startsWith(p))) {
      redirectUrl.pathname = "/admin-login";
    } else {
      redirectUrl.pathname = "/";
      redirectUrl.searchParams.set("login", "1");
    }
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
