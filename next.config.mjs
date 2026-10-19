// @ts-check

const SHELL_CACHE_CONTROL = {
  key: "Cache-Control",
  value: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
};

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" }
    ]
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push("node:sqlite");
      }
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" }
        ]
      },
      {
        source: "/api/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Content-Type-Options", value: "nosniff" }
        ]
      },
      {
        source: "/assets/apps/:path*",
        headers: [SHELL_CACHE_CONTROL]
      },
      {
        source: "/assets/icons/:path*",
        headers: [SHELL_CACHE_CONTROL]
      },
      {
        source: "/assets/wallpapers/:path*",
        headers: [SHELL_CACHE_CONTROL]
      },
      {
        source: "/assets/profile/:path*",
        headers: [SHELL_CACHE_CONTROL]
      },
      {
        source: "/intro/:path*",
        headers: [SHELL_CACHE_CONTROL]
      },
      {
        source: "/branding/:path*",
        headers: [SHELL_CACHE_CONTROL]
      },
      {
        source: "/profile/:path*",
        headers: [SHELL_CACHE_CONTROL]
      },
      {
        source: "/favicon.ico",
        headers: [SHELL_CACHE_CONTROL]
      }
    ];
  }
};

export default nextConfig;

