/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produces a self-contained .next/standalone build (its own minimal
  // node_modules) so the Docker image doesn't need the full node_modules
  // tree copied in.
  output: "standalone",
};

module.exports = nextConfig;
