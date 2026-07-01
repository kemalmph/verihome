import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "pub-84ba15b1085f4bbc99d895ebf9493079.r2.dev" },
    ],
  },
};

export default nextConfig;
