import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "pub-84ba15b1085f4bbc99d895ebf9493079.r2.dev" },
    ],
  },

  async redirects() {
    return [
      /**
       * The coworking pages moved from /admin/coworking to /site.
       *
       * Permanent, so browsers and search engines stop asking, but the old
       * links keep working — the same reasoning as accepting a uuid where a
       * slug now goes. A URL that has been sent to someone is a promise, and
       * tidying the route is not a reason to break it.
       *
       * :path* catches everything below, so
       * /admin/coworking/coco-lokalima/calendar?week=2026-11-16 arrives
       * intact, query string included.
       */
      {
        source: "/admin/coworking",
        destination: "/site",
        permanent: true,
      },
      {
        source: "/admin/coworking/:path*",
        destination: "/site/:path*",
        permanent: true,
      },
      /**
       * The customer area moved from /dashboard to /account (28 Nov 2026).
       * Same reasoning as above: links already sent in emails, bookmarks and
       * chats keep working, path and query intact
       * (/dashboard/receipts/abc?x=1 → /account/receipts/abc?x=1), and 308
       * keeps the method.
       *
       * Not an open redirect: the destination is always a path under
       * /account on this origin. /dashboard//evil.com becomes
       * /account//evil.com and /dashboard/\evil.com becomes
       * /account/\evil.com — both start with "/account", so no browser reads
       * them as another host. Never write a destination that starts with
       * ":path" itself; that is the shape that turns //evil.com into a
       * protocol-relative URL. scripts/test-account-redirect.js checks it.
       *
       * Redirects run before src/proxy.ts (Next.js execution order), so a
       * signed-out visitor is redirected first and then sent to sign in by
       * the proxy's /account rule.
       */
      {
        source: "/dashboard",
        destination: "/account",
        permanent: true,
      },
      {
        source: "/dashboard/:path*",
        destination: "/account/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
