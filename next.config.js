/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    return [
      {
        source: '/api/grandlyon/:path*',
        destination: 'https://data.grandlyon.com/:path*',
      },
    ]
  },
}

module.exports = nextConfig 