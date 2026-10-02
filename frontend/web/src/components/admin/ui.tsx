"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { AppealStatus, BatchMajorStatus, BatchStatus, ReviewStatus, StaffStatus, VerifyStatus } from "@/lib/admin/types";
import { IconAlert, IconCheck, IconChevronLeft, IconChevronRight, IconClock, IconX } from "./Icons";

// ---------------------------------------------------------------------------
// Nút bấm gọn cho màn hình nghiệp vụ (Button của phân hệ thí sinh to hơn,
// hợp với form đăng ký; ở đây cán bộ thao tác dày nên cần cỡ nhỏ hơn).
// ---------------------------------------------------------------------------
type BtnVariant = "primary" | "navy" | "outline" | "ghost" | "danger" | "success" | "warning";
const btnVariants: Record<BtnVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-dark",
  navy: "bg-navy-800 text-white hover:bg-navy-900",
  outline: "border border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50",
  ghost: "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
  danger: "border border-[#F3C9C9] bg-white text-[#B91C1C] hover:bg-danger-50",
  success: "bg-[#15803D] text-white hover:bg-[#166534]",
  warning: "border border-[#F0D3A6] bg-[#FEF3E2] text-[#92400E] hover:bg-[#FCE7C4]",
};

export function Btn({
  variant = "outline",
  size = "md",
  loading,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md"; loading?: boolean }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-input font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${
        size === "sm" ? "h-9 px-3 text-[13px]" : "h-11 px-4 text-sm"
      } ${btnVariants[variant]} ${className}`}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Nhãn trạng thái — mỗi trạng thái 1 màu riêng, kèm chữ (không dùng màu đơn độc)
// Màu chữ đã đậm hơn token gốc để đạt tương phản 4.5:1 trên nền nhạt.
// ---------------------------------------------------------------------------
const tone = {
  gray: "bg-gray-100 text-gray-600",
  blue: "bg-[#EAF1FE] text-[#1D4ED8]",
  navy: "bg-navy-50 text-navy-800",
  amber: "bg-[#FEF3E2] text-[#92400E]",
  green: "bg-[#EAF7EE] text-[#166534]",
  red: "bg-[#FDECEC] text-[#B91C1C]",
  orange: "bg-accent-50 text-[#A9441F]",
};
type Tone = keyof typeof tone;

function Pill({ t, children }: { t: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${tone[t]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  DRAFT: "Nháp",
  SUBMITTED: "Chờ tiếp nhận",
  UNDER_REVIEW: "Đang thẩm định",
  NEEDS_SUPPLEMENT: "Chờ bổ sung",
  APPROVED: "Đạt thẩm định",
  REJECTED: "Không đạt",
};
const REVIEW_TONE: Record<ReviewStatus, Tone> = {
  DRAFT: "gray",
  SUBMITTED: "blue",
  UNDER_REVIEW: "navy",
  NEEDS_SUPPLEMENT: "amber",
  APPROVED: "green",
  REJECTED: "red",
};
export function ReviewBadge({ status }: { status: ReviewStatus }) {
  return <Pill t={REVIEW_TONE[status]}>{REVIEW_LABEL[status]}</Pill>;
}

export const BATCH_LABEL: Record<BatchStatus, string> = {
  DRAFT: "Nháp",
  OPEN: "Đang mở đăng ký",
  CLOSED: "Đã đóng đăng ký",
  IN_REVIEW: "Đang xét kết quả",
  COMPLETED: "Đã hoàn tất",
  CANCELLED: "Đã hủy",
};
const BATCH_TONE: Record<BatchStatus, Tone> = { DRAFT: "gray", OPEN: "green", CLOSED: "amber", IN_REVIEW: "navy", COMPLETED: "blue", CANCELLED: "red" };
export function BatchBadge({ status }: { status: BatchStatus }) {
  return <Pill t={BATCH_TONE[status]}>{BATCH_LABEL[status]}</Pill>;
}

const BM_LABEL: Record<BatchMajorStatus, string> = { CONFIGURING: "Chờ phê duyệt", APPROVED: "Đã phê duyệt", OPEN: "Đang tuyển", CLOSED: "Đã đóng" };
const BM_TONE: Record<BatchMajorStatus, Tone> = { CONFIGURING: "amber", APPROVED: "blue", OPEN: "green", CLOSED: "gray" };
export function BatchMajorBadge({ status }: { status: BatchMajorStatus }) {
  return <Pill t={BM_TONE[status]}>{BM_LABEL[status]}</Pill>;
}

export function DocBadge({ status }: { status: VerifyStatus }) {
  if (status === "VALID") return <Pill t="green">Hợp lệ</Pill>;
  if (status === "INVALID") return <Pill t="red">Không hợp lệ</Pill>;
  return <Pill t="gray">Chưa kiểm tra</Pill>;
}

export function AppealBadge({ status }: { status: AppealStatus }) {
  if (status === "PENDING") return <Pill t="amber">Chờ xử lý</Pill>;
  if (status === "RESOLVED_CHANGED") return <Pill t="green">Đã điều chỉnh điểm</Pill>;
  return <Pill t="gray">Giữ nguyên điểm</Pill>;
}

export function StaffStatusBadge({ status }: { status: StaffStatus }) {
  if (status === "ACTIVE") return <Pill t="green">Đang hoạt động</Pill>;
  if (status === "LOCKED") return <Pill t="red">Đã khóa</Pill>;
  return <Pill t="gray">Vô hiệu</Pill>;
}

// ---------------------------------------------------------------------------
// Khung trang
// ---------------------------------------------------------------------------
export function PageHeader({ title, description, actions, back }: { title: string; description?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="text-[22px] font-bold leading-tight text-gray-900 md:text-[26px]">{title}</h1>
        {description && <div className="mt-1.5 max-w-[68ch] text-sm text-gray-500">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className = "", bodyClass = "p-5" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={`rounded-card border border-gray-200 bg-white ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
          {typeof title === "string" ? <h2 className="text-[15px] font-bold text-gray-900">{title}</h2> : title}
          {action}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <p className="text-[15px] font-semibold text-gray-700">{title}</p>
      {children && <div className="mt-1.5 max-w-sm text-sm text-gray-500">{children}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-card border border-[#F3C9C9] bg-danger-50 px-4 py-3.5 text-sm text-[#991B1B]">
      <IconAlert size={18} className="mt-0.5 shrink-0" />
      <div className="flex-1">{message}</div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2">
          Thử lại
        </button>
      )}
    </div>
  );
}

export function Notice({ tone: t = "amber", children }: { tone?: "amber" | "blue" | "green"; children: ReactNode }) {
  const cls = {
    amber: "border-[#F0D3A6] bg-[#FEF8EC] text-[#7C3A0A]",
    blue: "border-[#C9DAFB] bg-[#F3F7FE] text-[#1E3A8A]",
    green: "border-[#BFE3CB] bg-[#F1FAF4] text-[#14532D]",
  }[t];
  const Icon = t === "green" ? IconCheck : t === "blue" ? IconClock : IconAlert;
  return (
    <div className={`flex items-start gap-2.5 rounded-input border px-3.5 py-3 text-[13px] leading-relaxed ${cls}`}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-100 motion-reduce:animate-none ${className}`} />;
}

export function LoadingRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5" aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onChange, unit = "hồ sơ" }: { page: number; pageSize: number; total: number; onChange: (p: number) => void; unit?: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const nums: (number | "…")[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 px-5 py-3 text-[13px] text-gray-500 sm:flex-row">
      <span>
        {from}–{to} trên {total.toLocaleString("vi-VN")} {unit}
      </span>
      <nav className="flex items-center gap-1" aria-label="Phân trang">
        <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100 disabled:opacity-40" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Trang trước">
          <IconChevronLeft size={16} />
        </button>
        {nums.map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className="px-1">…</span>
          ) : (
            <button
              type="button"
              key={n}
              onClick={() => onChange(n)}
              aria-current={n === page ? "page" : undefined}
              className={`h-8 min-w-8 rounded-md px-2 font-semibold ${n === page ? "bg-navy-800 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {n}
            </button>
          ),
        )}
        <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100 disabled:opacity-40" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Trang sau">
          <IconChevronRight size={16} />
        </button>
      </nav>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hộp thoại (focus vào ô đầu tiên, Esc để đóng, trả focus khi đóng)
// ---------------------------------------------------------------------------
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  // Chỉ chạy khi mở/đóng — không phụ thuộc onClose để không giật focus khi đang gõ
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const el = ref.current?.querySelector<HTMLElement>("textarea, input, select, button:not([data-close])");
      el?.focus();
    }, 20);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-navy-900/45" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex max-h-[92vh] w-full ${width} flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-gray-900">
              {title}
            </h2>
            {description && <div className="mt-1 text-sm text-gray-500">{description}</div>}
          </div>
          <button type="button" data-close onClick={onClose} className="-mr-2 rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Đóng">
            <IconX size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-3">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-6 py-4 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thông báo nhanh (toast)
// ---------------------------------------------------------------------------
type Toast = { id: number; message: string; tone: "success" | "error" | "info" };
const ToastCtx = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, t: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((xs) => [...xs, { id, message, tone: t }]);
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:pr-6" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
              t.tone === "error" ? "bg-[#7F1D1D] text-white" : t.tone === "info" ? "bg-navy-800 text-white" : "bg-[#14532D] text-white"
            }`}
          >
            {t.tone === "error" ? <IconAlert size={17} className="mt-0.5 shrink-0" /> : <IconCheck size={17} className="mt-0.5 shrink-0" />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

// ---------------------------------------------------------------------------
// Ô nhập liệu gọn
// ---------------------------------------------------------------------------
export const fieldCls =
  "w-full rounded-input border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-accent focus:ring-2 focus:ring-accent/20";

export function Label({ children, htmlFor, required }: { children: ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-gray-700">
      {children}
      {required && <span className="text-danger"> *</span>}
    </label>
  );
}
