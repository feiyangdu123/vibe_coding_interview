/** @type {import('next').NextConfig} */
const internalApiBaseUrl = (process.env.INTERNAL_API_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '')

const nextConfig = {
  transpilePackages: ['@vibe/database', '@vibe/shared-types'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${internalApiBaseUrl}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
