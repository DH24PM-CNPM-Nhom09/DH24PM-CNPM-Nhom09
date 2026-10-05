/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Docker đặt NEXT_OUTPUT=standalone để đóng gói gọn (node server.js); chạy máy cá nhân giữ nguyên như cũ
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),
};

export default nextConfig;
