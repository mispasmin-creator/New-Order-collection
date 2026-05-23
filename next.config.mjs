/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.VERCEL ? ".next" : process.env.NODE_ENV === "production" ? ".next-build" : ".next",
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
