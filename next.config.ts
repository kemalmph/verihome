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
    ];
  },
};

export default nextConfig;
