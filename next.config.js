/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/agendar',
        destination: '/app/agendar',
        permanent: true,
      },
    ]
  },
}
module.exports = nextConfig
