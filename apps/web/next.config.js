/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@baari/shared', '@baari/ui'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          {
            key: 'Content-Security-Policy',
            value: process.env.NODE_ENV === 'production'
              ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-ancestors 'none';"
              : "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-ancestors 'none';"
          }
        ]
      }
    ];
  },
  async rewrites() {
    const engineUrl = process.env.ENGINE_URL;
    if (engineUrl) {
      return [
        {
          source: '/engine-api/:path*',
          destination: `${engineUrl}/api/v2/:path*`
        }
      ];
    }
    // Route to internal Next.js API handler when external ENGINE_URL is not set
    return [
      {
        source: '/engine-api/:path*',
        destination: '/api/engine/:path*'
      }
    ];
  }
};

module.exports = nextConfig;
