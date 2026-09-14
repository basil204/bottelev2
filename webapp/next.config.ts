import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Cho phép truy cập từ IP VPS và Domain bên ngoài mà không bị cảnh báo CORS Dev
  allowedDevOrigins: [
    "admintest.manhit.dev",
    "localhost:8693",
    "127.0.0.1:8693",
    "163.61.110.170:8693",
    "localhost:8692",
    "127.0.0.1:8692",
    "163.61.110.170:8692",
    "localhost:3000",
    "127.0.0.1:3000",
    "163.61.110.170:3000",
    "163.61.110.170"
  ]
};

export default nextConfig;
