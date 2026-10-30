/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@baari/shared'],
  async rewrites() {
    return [
      {
        source: '/engine-api/:path*',
        destination: `${process.env.ENGINE_URL || 'http://localhost:3000'}/api/v2/:path*`
      }
    ];
  }
};

module.exports = nextConfig;

