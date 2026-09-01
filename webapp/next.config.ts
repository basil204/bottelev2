import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Cho phép truy cập từ IP VPS và Domain bên ngoài mà không bị cảnh báo CORS Dev
  allowedDevOrigins: [
    "localhost:3000",
    "127.0.0.1:3000",
    "163.61.110.170:3000",
    "163.61.110.170"
  ]
};

export default nextConfig;
