/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@relay/contracts", "@relay/platform"],
  typescript: { ignoreBuildErrors: false },
  // The dev overlay sits exactly where the action bar lives, which is the part
  // being tested on a phone. Off, so what you see is the interface.
  devIndicators: false,
  // react-pdf ships Node-targeted code that must not be bundled for the browser.
  serverExternalPackages: ["@react-pdf/renderer"],
};
export default nextConfig;
