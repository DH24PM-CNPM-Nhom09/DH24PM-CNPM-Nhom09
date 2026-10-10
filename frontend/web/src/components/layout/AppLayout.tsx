"use client";

import BrandMark from "@/components/BrandMark";
import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getMyNotifications, getMyProfile, isLoggedIn } from "@/lib/api";

const navItems = [
  { to: "/dashboard", label: "Tổng quan", short: "Tổng quan", icon: "🏠", mobile: true },
  { to: "/announcements", label: "Thông báo", short: "Thông báo", icon: "🔔", mobile: true },
  { to: "/application", label: "Hồ sơ xét tuyển", short: "Hồ sơ", icon: "📄", mobile: true },
  { to: "/gvhd", label: "Giảng viên hướng dẫn", short: "GVHD", icon: "🎓", mobile: false },
  { to: "/complaint", label: "Khiếu nại / Phúc khảo", short: "Khiếu nại", icon: "✉️", mobile: true },
  { to: "/profile", label: "Hồ sơ cá nhân", short: "Cá nhân", icon: "👤", mobile: true },
];

/** Gọi sau khi đánh dấu đã đọc để số trên menu cập nhật ngay */
export function notifyNotificationsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("ts:notifications-changed"));
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "TS";
  return ((parts.length > 1 ? parts[0][0] : "") + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Khung trang phân hệ Thí sinh.
 * allowGuest: trang xem được khi chưa đăng nhập (Thông báo) — khi đó hiện thanh trên gọn
 * với nút Đăng nhập / Đăng ký thay cho menu.
 */
export default function AppLayout({ children, allowGuest = false }: { children: ReactNode; allowGuest?: boolean }) {
  const [open, setOpen] = useState(false);
  const [guest, setGuest] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [unread, setUnread] = useState(0);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const logged = isLoggedIn();
    setGuest(!logged);
    if (!logged) {
      if (!allowGuest) router.replace(`/login?next=${encodeURIComponent(pathname ?? "/dashboard")}`);
      return;
    }
    getMyProfile()
      .then((p) => setName(p.fullName))
      .catch(() => undefined);
    const loadUnread = () =>
      getMyNotifications()
        .then((list) => setUnread(list.filter((n) => !n.readAt).length))
        .catch(() => undefined);
    loadUnread();
    window.addEventListener("ts:notifications-changed", loadUnread);
    return () => window.removeEventListener("ts:notifications-changed", loadUnread);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLogout() {
    if (typeof window !== "undefined") localStorage.removeItem("access_token");
    router.push("/login");
  }

  const Brand = (
    <Link href={guest ? "/announcements" : "/dashboard"} className="flex items-center gap-2.5">
      <BrandMark size={38} />
      <span className="hidden leading-tight sm:block">
        <span className="block text-sm font-bold text-gray-900">Tuyển Sinh Sau Đại Học</span>
        <span className="block text-[11px] font-medium text-gray-500">Trường Đại học An Giang · ĐHQG-HCM</span>
      </span>
    </Link>
  );

  if (guest === null) return <div className="min-h-screen bg-gray-50" />;

  if (guest) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 md:px-6">
          {Brand}
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-input px-3 py-2 text-[13px] font-semibold text-gray-600 hover:bg-gray-100">
              Đăng nhập
            </Link>
            <Link href="/register" className="rounded-input bg-accent px-4 py-2 text-[13px] font-bold text-white hover:bg-accent-dark">
              Đăng ký
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-[1100px] px-4 py-6 md:px-8 md:py-8">
          {children}
          <footer className="mx-auto mt-10 max-w-[1100px] border-t border-gray-200 pt-4 pb-20 text-center text-xs text-gray-500 md:pb-4">
            Phòng Đào tạo Sau đại học — Trường Đại học An Giang, ĐHQG-HCM ·{" "}
            <Link href="/privacy" className="font-semibold hover:text-accent hover:underline">
              Chính sách bảo vệ dữ liệu cá nhân
            </Link>
          </footer>
        </main>
      </div>
    );
  }

  const Badge = ({ n }: { n: number }) =>
    n > 0 ? (
      <span className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
        {n > 99 ? "99+" : n}
      </span>
    ) : null;

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
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-3 rounded-input px-4 py-3 text-[15px] font-semibold transition-colors ${
                active ? "bg-accent-50 text-accent" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-accent" aria-hidden="true" />}
              <span className="w-6 shrink-0 text-center text-lg leading-none">{item.icon}</span>
              {item.label}
              {item.to === "/announcements" && <Badge n={unread} />}
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
          <button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Mở menu">
            ☰
          </button>
          {Brand}
        </div>

        <div className="flex items-center gap-3">
          <Link href="/announcements?tab=mine" className="relative rounded-full p-2 text-lg hover:bg-gray-100" aria-label={`Thông báo của tôi${unread ? `, ${unread} chưa đọc` : ""}`}>
            🔔
            {unread > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-accent" />}
          </Link>
          <button onClick={handleLogout} className="rounded-input px-3 py-2 text-[13px] font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-700">
            Đăng xuất
          </button>
          <Link
            href="/profile"
            title={name || "Hồ sơ cá nhân"}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-white"
          >
            {initials(name)}
          </Link>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - desktop: sát mép trái, cao hết màn hình */}
        <aside className="sticky top-16 hidden h-[calc(100vh-64px)] w-[272px] shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
          <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-800 text-sm font-bold text-white">{initials(name)}</div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[15px] font-bold text-gray-900">{name || "Thí sinh"}</p>
              <p className="mt-0.5 text-xs text-gray-500">Thí sinh dự tuyển sau đại học</p>
            </div>
          </div>
          <p className="px-6 pb-2 pt-5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Chức năng</p>
          <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3" aria-label="Điều hướng thí sinh">
            <NavLinks />
          </nav>
          <div className="m-3 shrink-0 rounded-card border border-accent/20 bg-accent-50 p-4">
            <p className="text-sm font-bold text-gray-900">Cần hỗ trợ?</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-600">
              Gửi câu hỏi ở mục Khiếu nại / Phúc khảo, hoặc liên hệ Phòng Đào tạo Sau đại học, 18 Ung Văn Khiêm, Long Xuyên.
            </p>
            <Link href="/announcements?category=QUY_DINH" className="mt-2 inline-block text-xs font-bold text-accent hover:underline">
              Xem quy định tuyển sinh →
            </Link>
          </div>
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
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8 xl:px-12">
          <div className="mx-auto max-w-[1100px]">{children}</div>
          <footer className="mx-auto mt-10 max-w-[1100px] border-t border-gray-200 pt-4 pb-20 text-center text-xs text-gray-500 md:pb-4">
            Phòng Đào tạo Sau đại học — Trường Đại học An Giang, ĐHQG-HCM ·{" "}
            <Link href="/privacy" className="font-semibold hover:text-accent hover:underline">
              Chính sách bảo vệ dữ liệu cá nhân
            </Link>
          </footer>
        </main>
      </div>

      {/* Bottom nav - mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-gray-200 bg-white md:hidden">
        {navItems
          .filter((i) => i.mobile)
          .map((item) => {
            const active = pathname === item.to || pathname?.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                href={item.to}
                className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${active ? "text-accent" : "text-gray-400"}`}
              >
                <span className="text-base">{item.icon}</span>
                {item.short}
                {item.to === "/announcements" && unread > 0 && <span className="absolute right-[28%] top-1.5 h-2 w-2 rounded-full bg-accent" />}
              </Link>
            );
          })}
      </nav>
      <div className="h-14 md:hidden" />
    </div>
  );
}
