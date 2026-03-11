import type { NextConfig } from "next"

const nextConfig: NextConfig = {
    experimental: {
        cpus: 1,
        webpackMemoryOptimizations: true,
    },
}

export default nextConfig
