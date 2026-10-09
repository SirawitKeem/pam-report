import type { NextConfig } from "next";
const config: NextConfig = { poweredByHeader: false, turbopack: { root: process.cwd() }, devIndicators: false };
export default config;
