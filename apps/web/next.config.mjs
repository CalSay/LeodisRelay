/** @type {import('next').NextConfig} */
import { fileURLToPath } from "node:url";

const nextConfig = {
  transpilePackages: ["@relay/contracts", "@relay/platform"],
  typescript: { ignoreBuildErrors: false },
  // The dev overlay sits exactly where the action bar lives, which is the part
  // being tested on a phone. Off, so what you see is the interface.
  devIndicators: false,
  // react-pdf ships Node-targeted code that must not be bundled for the browser.
  // Both must stay external. @relay/documents is compiled by tsc, not by this
  // bundler, because react-pdf's render prop takes a function and a function
  // prop does not survive the server compilation — the page-number element, and
  // the whole footer with it, rendered off the page.
  serverExternalPackages: ["@react-pdf/renderer", "@relay/documents"],
  // The repository is nested below another npm checkout on development
  // machines. Pin tracing here so production images contain this project, not
  // whichever parent directory Next happens to discover first.
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
};
export default nextConfig;
