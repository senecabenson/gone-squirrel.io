/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable all development indicators
  devIndicators: false,

  // Enable standalone output for Docker deployment
  output: "standalone",
};

module.exports = nextConfig;
