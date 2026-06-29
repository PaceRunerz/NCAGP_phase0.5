/** @type {import('next').NextConfig} */
const nextConfig = {    dfbgedf
  async rewrites() { 
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/:path*`, 
      },
    ];
  },
};

module.exports = nextConfig;
