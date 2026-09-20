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
    unoptimized: true
  },
  async headers() {
    return [
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
