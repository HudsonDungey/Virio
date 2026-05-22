/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  webpack: (config) => {
    // `@metamask/sdk` declares `@react-native-async-storage/async-storage` as an
    // optional peer (React Native only). In a web build the require is unreachable,
    // but webpack still emits a "Module not found" warning that's slow + noisy.
    // Aliasing to `false` tells webpack to skip resolution entirely.
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
};

export default nextConfig;
