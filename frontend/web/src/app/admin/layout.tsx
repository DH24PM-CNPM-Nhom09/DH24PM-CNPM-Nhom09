import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cổng Quản lý — Tuyển sinh Sau đại học",
  description: "Phân hệ dành cho cán bộ tuyển sinh, hội đồng, lãnh đạo và quản trị hệ thống",
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
