import type { NextConfig } from "next";

type ProxyBodyLimit = NonNullable<NonNullable<NextConfig["experimental"]>["proxyClientMaxBodySize"]>;

function readProxyClientMaxBodySize(): ProxyBodyLimit {
  const value = process.env.NEXT_PROXY_CLIENT_MAX_BODY_SIZE?.trim();
  if (!value) return "120mb";
  if (!/^\d+(k|m|g|t|p)?b$/i.test(value)) {
    throw new Error("NEXT_PROXY_CLIENT_MAX_BODY_SIZE must use a Next.js size string like 120mb");
  }
  return value as ProxyBodyLimit;
}

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: readProxyClientMaxBodySize(),
  },
};

export default nextConfig;
