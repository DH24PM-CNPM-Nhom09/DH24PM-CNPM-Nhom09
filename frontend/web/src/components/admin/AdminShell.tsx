"use client";

import BrandMark from "@/components/BrandMark";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { refreshStaff, resetMockData, staffLogout, USE_MOCK } from "@/lib/admin/api";
import { can as canRoles, ROLE_LABEL, type Permission } from "@/lib/admin/permissions";
import { useStaffSession, writeSession } from "@/lib/admin/session";
import { getDb } from "@/lib/admin/store";
import type { StaffAccount } from "@/lib/admin/types";
import { IconAlert, IconAward, IconBook, IconCalendar, IconChevronRight, IconClipboard, IconStamp, IconTable, IconDashboard, IconFolder, IconGraduation, IconIdCard, IconKey, IconList, IconLogout, IconMegaphone, IconMenu, IconRefresh, IconScale, IconShield, IconUsers, IconWallet, IconX } from "./Icons";
import { Btn, Modal, ToastProvider, useToast } from "./ui";

interface AdminCtx {
  staff: StaffAccount;
  can: (p: Permission) => boolean;
}
const Ctx = createContext<AdminCtx | null>(null);

export function useAdmin(): AdminCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdmin phải dùng bên trong AdminShell");
  return v;
}

type NavIcon = (p: { size?: number }) => JSX.Element;
const NAV: { href: string; label: string; perm: Permission | Permission[]; icon: NavIcon }[] = [
  { href: "/admin", label: "Tổng quan", perm: "dashboard:view", icon: IconDashboard },
  { href: "/admin/applications", label: "Hồ sơ xét tuyển", perm: "application:view", icon: IconFolder },
  { href: "/admin/candidates", label: "Tài khoản thí sinh", perm: "candidate:view", icon: IconIdCard },
  { href: "/admin/supervisors", label: "Giảng viên hướng dẫn", perm: "supervisor:manage", icon: IconGraduation },
  { href: "/admin/english-test", label: "Thi tiếng Anh", perm: "exam:manage", icon: IconClipboard },
  { href: "/admin/scoring", label: "Tổ chức xét tuyển", perm: ["exam:manage", "score:enter"], icon: IconTable },
  { href: "/admin/results", label: "Xét trúng tuyển", perm: "result:view", icon: IconAward },
  { href: "/admin/decisions", label: "Quyết định & nhập học", perm: ["decision:manage", "decision:sign"], icon: IconStamp },
  { href: "/admin/batches", label: "Đợt tuyển sinh", perm: "batch:view", icon: IconCalendar },
  { href: "/admin/majors", label: "Danh mục ngành", perm: "batch:view", icon: IconBook },
  { href: "/admin/appeals", label: "Phúc khảo", perm: "appeal:view", icon: IconScale },
  { href: "/admin/complaints", label: "Khiếu nại", perm: "complaint:view", icon: IconAlert },
  { href: "/admin/announcements", label: "Thông báo", perm: "announcement:manage", icon: IconMegaphone },
  { href: "/admin/payment-settings", label: "Lệ phí & thanh toán", perm: "batch:manage", icon: IconWallet },
  { href: "/admin/accounts", label: "Tài khoản cán bộ", perm: "account:manage", icon: IconUsers },
  { href: "/admin/audit-log", label: "Nhật ký hệ thống", perm: "audit:view", icon: IconList },
];

/**
 * Menu chia nhóm: bấm tên nhóm để xổ ra / thu gọn các mục bên trong.
 * Nhóm chứa trang đang mở luôn được mở sẵn. Nhóm chỉ còn 1 mục (do phân quyền) thì hiện thẳng mục đó.
 */
const NAV_GROUPS: { key: string; label: string; icon: NavIcon; hrefs: string[] }[] = [
  { key: "home", label: "Tổng quan", icon: IconDashboard, hrefs: ["/admin"] },
  { key: "hoso", label: "Hồ sơ & thí sinh", icon: IconFolder, hrefs: ["/admin/applications", "/admin/candidates", "/admin/supervisors"] },
  { key: "xettuyen", label: "Xét tuyển", icon: IconAward, hrefs: ["/admin/english-test", "/admin/scoring", "/admin/results", "/admin/decisions"] },
  { key: "phuckhao", label: "Phúc khảo & khiếu nại", icon: IconScale, hrefs: ["/admin/appeals", "/admin/complaints"] },
  { key: "cauhinh", label: "Cấu hình tuyển sinh", icon: IconCalendar, hrefs: ["/admin/batches", "/admin/majors", "/admin/payment-settings", "/admin/announcements"] },
  { key: "hethong", label: "Quản trị hệ thống", icon: IconShield, hrefs: ["/admin/accounts", "/admin/audit-log"] },
];
const NAV_OPEN_KEY = "admin_nav_open";

export function initials(name: string) {
  const parts = name.replace(/^(PGS\.TS|TS\.|ThS\.)\s*/, "").trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ShellInner>{children}</ShellInner>
    </ToastProvider>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const session = useStaffSession();
  const router = useRouter();
  const pathname = usePathname() ?? "/admin";
  const [drawer, setDrawer] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(NAV_OPEN_KEY) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const toast = useToast();

  // Chưa đăng nhập -> về trang đăng nhập cán bộ, nhớ trang đang mở
  useEffect(() => {
    if (session === null) router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
    // Đang dùng mật khẩu tạm -> bắt đổi mật khẩu trước khi làm việc
    else if (session?.staff.mustChangePassword) router.replace("/admin/change-password");
  }, [session, router, pathname]);

  // Backend thật: mỗi lần chuyển trang đọc lại vai trò (lỗi 401 sẽ tự đăng xuất)
  useEffect(() => {
    if (USE_MOCK || !session) return;
    refreshStaff().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, session?.accessToken]);

  // Mock: đồng bộ vai trò / trạng thái mới nhất (Admin vừa đổi quyền hoặc khóa)
  useEffect(() => {
    if (!USE_MOCK || !session) return;
    const fresh = getDb().staff.find((s) => s.staffAccountId === session.staff.staffAccountId);
    if (!fresh || fresh.status !== "ACTIVE") {
      writeSession(null);
      return;
    }
    if (fresh.roles.join() !== session.staff.roles.join() || fresh.fullName !== session.staff.fullName) {
      writeSession({ ...session, staff: structuredClone(fresh) });
    }
  }, [session, pathname]);

  useEffect(() => setDrawer(false), [pathname]);

  // Mở sẵn nhóm chứa trang đang xem
  useEffect(() => {
    const g = NAV_GROUPS.find((x) => x.hrefs.some((h) => (h === "/admin" ? pathname === "/admin" : pathname.startsWith(h))));
    if (g && !openGroups.includes(g.key)) setOpenGroups((o) => [...o, g.key]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    try {
      window.localStorage.setItem(NAV_OPEN_KEY, JSON.stringify(openGroups));
    } catch {
      /* trình duyệt chặn lưu trữ: chỉ không nhớ được nhóm đang mở */
    }
  }, [openGroups]);

  const ctx = useMemo<AdminCtx | null>(
    () => (session ? { staff: session.staff, can: (p: Permission) => canRoles(session.staff.roles, p) } : null),
    [session],
  );

  if (!ctx || session?.staff.mustChangePassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50" aria-busy="true">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-navy-800 border-t-transparent" />
      </div>
    );
  }

  const items = NAV.filter((n) => (Array.isArray(n.perm) ? n.perm.some((p) => ctx.can(p)) : ctx.can(n.perm)));
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  function logout() {
    staffLogout();
    router.replace("/admin/login");
  }

  function navLink({ href, label, icon: Icon }: (typeof items)[number], nested: boolean) {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex shrink-0 items-center gap-3 rounded-input font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
          nested ? "px-2.5 py-2 text-[13px]" : "px-3 py-2.5 text-sm"
        } ${active ? "bg-white text-navy-900" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
      >
        <span className={active ? "text-accent" : ""}>
          <Icon size={nested ? 16 : 18} />
        </span>
        {label}
      </Link>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-navy-900 text-white">
      <div className="flex shrink-0 items-center gap-3 px-5 pb-5 pt-6">
        <BrandMark size={40} onDark />
        <div className="leading-tight">
          <p className="text-sm font-bold">Cổng Quản lý</p>
          <p className="text-xs text-white/60">Tuyển sinh Sau đại học</p>
        </div>
      </div>
      <nav className="admin-nav-scroll flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-2" aria-label="Điều hướng quản lý">
        {NAV_GROUPS.map((g) => {
          const groupItems = g.hrefs.map((h) => items.find((i) => i.href === h)).filter((i): i is (typeof items)[number] => !!i);
          if (groupItems.length === 0) return null;
          // Nhóm chỉ còn 1 mục -> hiện thẳng mục đó, không cần xổ
          if (groupItems.length === 1) return navLink(groupItems[0], false);
          const open = openGroups.includes(g.key);
          const hasActive = groupItems.some((i) => isActive(i.href));
          const GroupIcon = g.icon;
          return (
            <div key={g.key} className="shrink-0">
              <button
                type="button"
                onClick={() => setOpenGroups((o) => (o.includes(g.key) ? o.filter((k) => k !== g.key) : [...o, g.key]))}
                aria-expanded={open}
                aria-controls={`nav-group-${g.key}`}
                className={`flex w-full items-center gap-3 rounded-input px-3 py-2.5 text-left text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  hasActive && !open ? "bg-white/10 text-white" : "text-white/85 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className={hasActive ? "text-accent" : ""}>
                  <GroupIcon size={18} />
                </span>
                <span className="flex-1">{g.label}</span>
                <span className={`text-white/50 transition-transform duration-200 ${open ? "rotate-90" : ""}`} aria-hidden="true">
                  <IconChevronRight size={16} />
                </span>
              </button>
              {open && (
                <div id={`nav-group-${g.key}`} className="mb-1 ml-[22px] mt-0.5 flex flex-col gap-0.5 border-l border-white/15 pl-2">
                  {groupItems.map((i) => navLink(i, true))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {USE_MOCK && (
        <div className="mx-3 mb-3 shrink-0 rounded-input border border-white/10 px-3 py-2.5 text-xs text-white/60">
          Đang chạy dữ liệu mẫu.{" "}
          <button type="button" onClick={() => setResetOpen(true)} className="inline-flex items-center gap-1 font-semibold text-white/90 underline-offset-2 hover:underline">
            <IconRefresh size={12} /> Khôi phục
          </button>
        </div>
      )}

      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-1">
          <Link
            href="/admin/profile"
            aria-current={pathname === "/admin/profile" ? "page" : undefined}
            title="Trang cá nhân"
            className={`flex min-w-0 flex-1 items-center gap-3 rounded-input px-2 py-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
              pathname === "/admin/profile" ? "bg-white/15" : "hover:bg-white/10"
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold">{initials(ctx.staff.fullName)}</div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-semibold">{ctx.staff.fullName}</p>
              <p className="truncate text-xs text-white/60">{ctx.staff.roles.map((r) => ROLE_LABEL[r]).join(", ")}</p>
            </div>
          </Link>
          <Link href="/admin/change-password" className="rounded-md p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Đổi mật khẩu" title="Đổi mật khẩu">
            <IconKey size={17} />
          </Link>
          <button type="button" onClick={logout} className="rounded-md p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Đăng xuất" title="Đăng xuất">
            <IconLogout size={17} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <Ctx.Provider value={ctx}>
      <div className="min-h-screen bg-gray-50">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] lg:block">{sidebar}</aside>

        {drawer && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-navy-900/50" onClick={() => setDrawer(false)} aria-hidden="true" />
            <div className="absolute inset-y-0 left-0 w-[272px] shadow-2xl">
              {sidebar}
              <button type="button" onClick={() => setDrawer(false)} className="absolute right-3 top-6 rounded-md p-2 text-white/70 hover:bg-white/10" aria-label="Đóng menu">
                <IconX size={18} />
              </button>
            </div>
          </div>
        )}

        <div className="lg:pl-[272px]">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/95 px-4 backdrop-blur lg:hidden">
            <button type="button" onClick={() => setDrawer(true)} className="rounded-md p-2 text-gray-600 hover:bg-gray-100" aria-label="Mở menu">
              <IconMenu size={20} />
            </button>
            <span className="text-sm font-bold text-gray-900">Cổng Quản lý Tuyển sinh</span>
            <Link
              href="/admin/profile"
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-white"
              aria-label="Trang cá nhân"
              title="Trang cá nhân"
            >
              {initials(ctx.staff.fullName)}
            </Link>
          </header>
          <main className="mx-auto w-full max-w-[1320px] px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Khôi phục dữ liệu mẫu?"
        description="Mọi thao tác duyệt, phân quyền, cấu hình đã làm trên máy này sẽ được đưa về trạng thái ban đầu. Chỉ ảnh hưởng chế độ dữ liệu mẫu."
        footer={
          <>
            <Btn onClick={() => setResetOpen(false)}>Giữ nguyên</Btn>
            <Btn
              variant="navy"
              onClick={async () => {
                await resetMockData();
                setResetOpen(false);
                toast("Đã khôi phục dữ liệu mẫu.", "info");
              }}
            >
              Khôi phục dữ liệu
            </Btn>
          </>
        }
      />
    </Ctx.Provider>
  );
}

/** Bọc nội dung trang: không đủ quyền -> hiện thông báo 403 thay vì trang trắng */
export function RequirePermission({ perm, children }: { perm: Permission | Permission[]; children: ReactNode }) {
  const { can, staff } = useAdmin();
  if (Array.isArray(perm) ? perm.some((p) => can(p)) : can(perm)) return <>{children}</>;
  return (
    <div className="mx-auto mt-16 max-w-md rounded-card border border-gray-200 bg-white p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-navy-50 text-navy-800">
        <IconShield size={22} />
      </div>
      <h1 className="text-lg font-bold text-gray-900">Bạn không có quyền xem trang này</h1>
      <p className="mt-2 text-sm text-gray-500">
        Vai trò hiện tại ({staff.roles.map((r) => ROLE_LABEL[r]).join(", ")}) không bao gồm chức năng này. Liên hệ quản trị hệ thống nếu bạn cần được cấp quyền.
      </p>
      <Link href="/admin" className="mt-5 inline-block text-sm font-semibold text-accent hover:underline">
        Về trang tổng quan
      </Link>
    </div>
  );
}
