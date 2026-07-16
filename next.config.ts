import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every /dashboard/** route is dynamic (session cookie via proxy.ts +
  // getCurrentManager), so it gets a 0s client router-cache TTL by default —
  // every nav, even back to a page visited seconds ago, re-fetches from the
  // server. 30s lets short back-and-forth navigation reuse the client cache
  // instead of re-running every Supabase query on the page.
  experimental: {
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
