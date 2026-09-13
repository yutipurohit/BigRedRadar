import type { NextConfig } from 'next'

const DEV = process.env.NODE_ENV === 'development'
const API = process.env.API_BASE ?? (DEV ? 'http://localhost:3000' : 'https://bigredradar.onrender.com')

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API}/:path*` }]
  },
}

export default nextConfig
