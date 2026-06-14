/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() { afg
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
