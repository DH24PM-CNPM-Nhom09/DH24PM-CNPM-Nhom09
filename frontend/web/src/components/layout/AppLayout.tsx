"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { to: "/dashboard", label: "Tổng quan", icon: "🏠" },
  { to: "/application", label: "Hồ sơ xét tuyển", icon: "📄" },
  { to: "/gvhd", label: "Giảng viên hướng dẫn", icon: "🎓" },
  { to: "/complaint", label: "Khiếu nại / Phúc khảo", icon: "✉️" },
  { to: "/profile", label: "Hồ sơ cá nhân", icon: "👤" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    if (typeof window !== "undefined") localStorage.removeItem("access_token");
    router.push("/login");
  }

  function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <>
        {navItems.map((item) => {
          const active = pathname === item.to || pathname?.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              href={item.to}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-input px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? "bg-accent-50 text-accent"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top header */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 md:px-6">
        <div className="flex items-center gap-3">
          <button
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Mở menu"
          >
            ☰
          </button>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-sm font-extrabold text-white">
              TS
            </div>
            <span className="hidden text-sm font-bold text-gray-900 sm:inline">
              Tuyển Sinh Sau Đại Học
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleLogout}
            className="rounded-input px-3 py-2 text-[13px] font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            Đăng xuất
          </button>
          <div className="h-9 w-9 overflow-hidden rounded-full bg-navy-50">
            <img
              src="https://api.dicebear.com/7.x/initials/svg?seed=Thi+Sinh&backgroundColor=1B3A66"
              alt="avatar"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1280px]">
        {/* Sidebar - desktop */}
        <aside className="sticky top-16 hidden h-[calc(100vh-64px)] w-[240px] shrink-0 border-r border-gray-200 bg-white py-6 md:block">
          <nav className="flex flex-col gap-1 px-3">
            <NavLinks />
          </nav>
        </aside>

        {/* Sidebar - mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-[260px] bg-white py-6 shadow-xl">
              <nav className="flex flex-col gap-1 px-3">
                <NavLinks onNavigate={() => setOpen(false)} />
              </nav>
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>

      {/* Bottom nav - mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-gray-200 bg-white md:hidden">
        {navItems.slice(0, 5).map((item) => {
          const active = pathname === item.to || pathname?.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              href={item.to}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${
                active ? "text-accent" : "text-gray-400"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="h-14 md:hidden" />
    </div>
  );
}
