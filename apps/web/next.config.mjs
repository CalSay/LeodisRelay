/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@relay/contracts", "@relay/platform"],
  typescript: { ignoreBuildErrors: false },
};
export default nextConfig;
