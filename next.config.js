/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/grandlyon/:path*',
        destination: 'https://data.grandlyon.com/:path*',
      },
    ]
  },
  webpack: (config) => {
    // Supprimer l'avertissement de dépréciation
    config.ignoreWarnings = [
      { module: /node_modules\/@react-google-maps\/api/ }
    ];
    return config;
  }
}

module.exports = nextConfig 