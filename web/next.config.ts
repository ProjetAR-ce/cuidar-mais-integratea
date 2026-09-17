import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fotos de fichas em papel chegam por Server Action (já comprimidas no navegador)
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};

export default nextConfig;
