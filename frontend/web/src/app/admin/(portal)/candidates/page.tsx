"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminShell";
import { IconDownload, IconSearch } from "@/components/admin/Icons";
import { Btn, EmptyState, ErrorBox, fieldCls, Label, LoadingRows, Modal, Notice, PageHeader, Pagination, ReviewBadge, Skeleton, useToast } from "@/components/admin/ui";
import {
  exportCandidateAccounts,
  getCandidateAccount,
  listCandidateAccounts,
  lockCandidateAccount,
  unlockCandidateAccount,
  type CandidateAccountQuery,
  type CandidateAccountRow,
  type CandidateAccountStatus,
} from "@/lib/admin/api";
import { DEGREE_LABEL, errorMessage, fmtDate, fmtDateTime } from "@/lib/admin/format";
import { useAsync } from "@/lib/admin/useAsync";

const STATUS: Record<CandidateAccountStatus, { label: string; cls: string }> = {
  ACTIVE: { label: "Hoạt động", cls: "bg-[#EAF7EE] text-[#166534]" },
  PENDING_VERIFY: { label: "Chưa xác thực email", cls: "bg-[#FEF3E2] text-[#92400E]" },
  LOCKED: { label: "Bị khóa", cls: "bg-[#FDECEC] text-[#B91C1C]" },
};
const TABS: { key: CandidateAccountStatus | ""; label: string }[] = [
  { key: "", label: "Tất cả" },
  { key: "ACTIVE", label: "Hoạt động" },
  { key: "PENDING_VERIFY", label: "Chưa xác thực email" },
  { key: "LOCKED", label: "Bị khóa" },
];
const GENDER: Record<string, string> = { NAM: "Nam", NU: "Nữ", KHAC: "Khác" };
const COMPLAINT_STATUS: Record<string, string> = { PENDING: "Chờ xử lý", PROCESSING: "Đang xử lý", RESOLVED: "Đã xử lý", REJECTED: "Từ chối" };
const LOCK_PRESETS = [
  "Khai thông tin cá nhân không trung thực.",
  "Tài khoản đăng ký trùng (một người nhiều tài khoản).",
  "Có dấu hiệu bị người khác sử dụng trái phép, khóa để bảo vệ thí sinh.",
];

function StatusPill({ status }: { status: CandidateAccountStatus }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[status].cls}`}>{STATUS[status].label}</span>;
}

function AppCell({ r }: { r: CandidateAccountRow }) {
  if (!r.application) return <span className="text-gray-400">Chưa tạo hồ sơ</span>;
  return (
    <span className="flex flex-col items-start gap-1">
      <span className="whitespace-nowrap font-mono text-[12.5px] text-gray-700">{r.application.applicationCode}</span>
      {r.application.reviewStatus === "DRAFT" ? <span className="text-xs text-gray-500">Nháp, chưa nộp</span> : <ReviewBadge status={r.application.reviewStatus} />}
    </span>
  );
}

function CandidatesInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const query: CandidateAccountQuery = {
    q: sp.get("q") ?? "",
    status: (sp.get("status") as CandidateAccountStatus) || "",
    profile: (sp.get("profile") as CandidateAccountQuery["profile"]) || "",
    application: (sp.get("application") as CandidateAccountQuery["application"]) || "",
    sort: (sp.get("sort") as CandidateAccountQuery["sort"]) || "newest",
    page: Number(sp.get("page") ?? 1),
    pageSize: 20,
  };
  const [search, setSearch] = useState(query.q ?? "");
  const [openId, setOpenId] = useState<number | null>(sp.get("id") ? Number(sp.get("id")) : null);
  const [exporting, setExporting] = useState(false);

  function update(patch: Record<string, string | number | undefined>, resetPage = true) {
    const next = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => (v === undefined || v === "" ? next.delete(k) : next.set(k, String(v))));
    if (resetPage) next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== (query.q ?? "")) update({ q: search.trim() });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const key = sp.toString();
  const { data, error, loading, reload } = useAsync(() => listCandidateAccounts(query), [key]);

  async function doExport() {
    setExporting(true);
    try {
      const blob = await exportCandidateAccounts(query);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `danh-sach-thi-sinh-${new Date().toLocaleDateString("sv-SE")}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("Đã tải danh sách. Mở tệp bằng Excel.");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setExporting(false);
    }
  }

  const filtered = Boolean(query.q || query.status || query.profile || query.application);

  return (
    <>
      <PageHeader
        title="Tài khoản thí sinh"
        description="Những người đã đăng ký tài khoản trên cổng thí sinh, thông tin cá nhân và hồ sơ của họ. Bấm vào một dòng để xem chi tiết."
        actions={
          <Btn onClick={doExport} loading={exporting}>
            <IconDownload size={16} /> Xuất Excel (CSV)
          </Btn>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
        <label className="relative block">
          <span className="sr-only">Tìm thí sinh</span>
          <IconSearch size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={`${fieldCls} pl-9`} placeholder="Họ tên, email, điện thoại, CCCD hoặc mã hồ sơ" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label>
          <span className="sr-only">Hồ sơ cá nhân</span>
          <select className={fieldCls} value={query.profile} onChange={(e) => update({ profile: e.target.value })}>
            <option value="">Hồ sơ cá nhân: tất cả</option>
            <option value="done">Đã khai hồ sơ cá nhân</option>
            <option value="missing">Chưa khai hồ sơ cá nhân</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Hồ sơ xét tuyển</span>
          <select className={fieldCls} value={query.application} onChange={(e) => update({ application: e.target.value })}>
            <option value="">Hồ sơ xét tuyển: tất cả</option>
            <option value="yes">Đã nộp hồ sơ</option>
            <option value="no">Chưa nộp hồ sơ</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Sắp xếp</span>
          <select className={fieldCls} value={query.sort} onChange={(e) => update({ sort: e.target.value })}>
            <option value="newest">Đăng ký mới nhất trước</option>
            <option value="oldest">Đăng ký lâu nhất trước</option>
          </select>
        </label>
      </div>

      <div className="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="flex w-max gap-1.5" role="tablist" aria-label="Lọc theo trạng thái tài khoản">
          {TABS.map((t) => {
            const active = (query.status ?? "") === t.key;
            const count = data ? data.counts[t.key || "ALL"] : null;
            return (
              <button
                key={t.key || "all"}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => update({ status: t.key })}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${
                  active ? "border-navy-800 bg-navy-800 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900"
                }`}
              >
                {t.label}
                {count !== null && <span className={`tabular-nums ${active ? "text-white/70" : "text-gray-400"}`}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {error && <ErrorBox message={error} onRetry={() => reload()} />}

      <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
        {loading && !data ? (
          <LoadingRows />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title={filtered ? "Không có tài khoản phù hợp" : "Chưa có thí sinh nào đăng ký"}>
            {filtered ? (
              <button
                type="button"
                className="font-semibold text-accent hover:underline"
                onClick={() => {
                  setSearch("");
                  router.replace(pathname);
                }}
              >
                Xóa bộ lọc
              </button>
            ) : (
              "Thí sinh đăng ký trên cổng thí sinh sẽ xuất hiện ở đây."
            )}
          </EmptyState>
        ) : (
          <>
            <div className={`hidden overflow-x-auto md:block ${loading ? "opacity-60" : ""}`}>
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Thí sinh</th>
                    <th className="px-4 py-3">Điện thoại</th>
                    <th className="px-4 py-3">CCCD</th>
                    <th className="px-4 py-3">Đăng ký lúc</th>
                    <th className="px-4 py-3">Hồ sơ xét tuyển</th>
                    <th className="px-4 py-3">Tài khoản</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.items.map((r) => (
                    <tr key={r.accountId} className="cursor-pointer hover:bg-gray-50" onClick={() => setOpenId(r.accountId)}>
                      <td className="px-4 py-3">
                        <button type="button" className="text-left" onClick={() => setOpenId(r.accountId)}>
                          <span className={`block font-semibold ${r.fullName ? "text-gray-900" : "italic text-gray-400"}`}>{r.fullName ?? "Chưa khai hồ sơ cá nhân"}</span>
                          <span className="block text-xs text-gray-500">{r.email ?? "—"}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-700">{r.phoneNumber ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-[12.5px] text-gray-600">{r.idNumberMasked ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{fmtDateTime(r.createdAt)}</td>
                      <td className="px-4 py-3">
                        <AppCell r={r} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex flex-col items-start gap-1">
                          <StatusPill status={r.status} />
                          {r.tempLockedUntil && <span className="text-xs text-[#92400E]">Khóa tạm do sai mật khẩu</span>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className={`divide-y divide-gray-100 md:hidden ${loading ? "opacity-60" : ""}`}>
              {data.items.map((r) => (
                <li key={r.accountId}>
                  <button type="button" className="flex w-full flex-col gap-1.5 px-4 py-3.5 text-left hover:bg-gray-50" onClick={() => setOpenId(r.accountId)}>
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className={`block font-semibold ${r.fullName ? "text-gray-900" : "italic text-gray-400"}`}>{r.fullName ?? "Chưa khai hồ sơ cá nhân"}</span>
                        <span className="block truncate text-xs text-gray-500">{r.email}</span>
                      </span>
                      <StatusPill status={r.status} />
                    </span>
                    <span className="text-xs text-gray-500">
                      {r.phoneNumber ?? "—"} · đăng ký {fmtDate(r.createdAt)}
                    </span>
                    <AppCell r={r} />
                  </button>
                </li>
              ))}
            </ul>

            <div className="border-t border-gray-100 px-4 py-3">
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(p) => update({ page: p }, false)} unit="tài khoản" />
            </div>
          </>
        )}
      </div>

      {openId !== null && <CandidateDetail accountId={openId} onClose={() => setOpenId(null)} onChanged={() => reload(true)} />}
    </>
  );
}

function Info({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-900 [overflow-wrap:anywhere]">{children ?? "—"}</dd>
    </div>
  );
}

function CandidateDetail({ accountId, onClose, onChanged }: { accountId: number; onClose: () => void; onChanged: () => void }) {
  const { can } = useAdmin();
  const toast = useToast();
  const canManage = can("candidate:manage");
  const canSeeApp = can("application:view");
  const { data, error, loading, reload } = useAsync(() => getCandidateAccount(accountId), [accountId]);
  const [mode, setMode] = useState<"view" | "lock">("view");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setFormError("");
    try {
      await fn();
      toast(done);
      setMode("view");
      setReason("");
      reload(true);
      onChanged();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const acc = data?.account;
  const title = data ? data.profile?.fullName ?? data.account.email ?? "Thí sinh" : "Thông tin thí sinh";

  const footer =
    !data || !canManage ? (
      <Btn onClick={onClose}>Đóng</Btn>
    ) : mode === "lock" ? (
      <>
        <Btn onClick={() => setMode("view")}>Hủy</Btn>
        <Btn variant="danger" loading={busy} onClick={() => run(() => lockCandidateAccount(accountId, reason), "Đã khóa tài khoản. Đã gửi thông báo cho thí sinh.")}>
          Khóa tài khoản
        </Btn>
      </>
    ) : (
      <>
        <Btn onClick={onClose}>Đóng</Btn>
        {acc?.status === "LOCKED" ? (
          <Btn variant="success" loading={busy} onClick={() => run(() => unlockCandidateAccount(accountId), "Đã mở khóa tài khoản.")}>
            Mở khóa
          </Btn>
        ) : (
          <>
            {acc?.tempLockedUntil && (
              <Btn variant="warning" loading={busy} onClick={() => run(() => unlockCandidateAccount(accountId), "Đã gỡ khóa tạm.")}>
                Gỡ khóa tạm
              </Btn>
            )}
            <Btn
              variant="danger"
              onClick={() => {
                setFormError("");
                setMode("lock");
              }}
            >
              Khóa tài khoản
            </Btn>
          </>
        )}
      </>
    );

  return (
    <Modal open onClose={onClose} title={title} description={acc?.email ?? undefined} width="max-w-3xl" footer={footer}>
      {error ? (
        <ErrorBox message={error} onRetry={() => reload()} />
      ) : loading || !data || !acc ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-32" />
        </div>
      ) : mode === "lock" ? (
        <div className="grid gap-3">
          <Notice>
            Thí sinh sẽ không đăng nhập được (cả bằng mật khẩu lẫn Google) và nhận thông báo kèm lý do. Hồ sơ đã nộp vẫn được giữ nguyên để cán bộ tiếp tục xử lý.
          </Notice>
          <div>
            <Label htmlFor="lock-reason" required>
              Lý do khóa
            </Label>
            <textarea id="lock-reason" rows={3} className={fieldCls} value={reason} maxLength={400} onChange={(e) => setReason(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {LOCK_PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => setReason(p)} className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:border-gray-300 hover:text-gray-900">
                  {p}
                </button>
              ))}
            </div>
          </div>
          {formError && <ErrorBox message={formError} />}
        </div>
      ) : (
        <div className="grid gap-5">
          {acc.status === "LOCKED" && <Notice>Tài khoản đang bị khóa. Thí sinh không đăng nhập được.</Notice>}
          {acc.tempLockedUntil && <Notice>Đang bị khóa tạm đến {fmtDateTime(acc.tempLockedUntil)} do đăng nhập sai mật khẩu nhiều lần.</Notice>}

          <section>
            <h3 className="mb-2 text-sm font-bold text-gray-900">Tài khoản</h3>
            <dl className="grid gap-3 rounded-input bg-gray-50 p-4 sm:grid-cols-3">
              <Info label="Trạng thái">
                <StatusPill status={acc.status} />
              </Info>
              <Info label="Email">
                {acc.email}
                <span className={`ml-1.5 whitespace-nowrap text-xs font-semibold ${acc.emailVerified ? "text-[#166534]" : "text-[#92400E]"}`}>{acc.emailVerified ? "đã xác thực" : "chưa xác thực"}</span>
              </Info>
              <Info label="Điện thoại">{acc.phoneNumber}</Info>
              <Info label="Đăng ký lúc">{fmtDateTime(acc.createdAt)}</Info>
              <Info label="Cách đăng nhập">{acc.hasPassword ? "Email/SĐT + mật khẩu" : "Chỉ Google"}</Info>
            </dl>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-bold text-gray-900">Thông tin cá nhân</h3>
            {data.profile ? (
              <dl className="grid gap-3 rounded-input border border-gray-200 p-4 sm:grid-cols-3">
                <Info label="Họ và tên">{data.profile.fullName}</Info>
                <Info label="Ngày sinh">{fmtDate(data.profile.dob)}</Info>
                <Info label="Giới tính">{data.profile.gender ? GENDER[data.profile.gender] : null}</Info>
                <Info label="Số CCCD">{data.profile.idNumber && <span className="font-mono">{data.profile.idNumber}</span>}</Info>
                <Info label="Quốc tịch">{data.profile.nationality}</Info>
                <Info label="Địa chỉ liên hệ" wide>
                  {data.profile.address}
                </Info>
              </dl>
            ) : (
              <p className="rounded-input border border-dashed border-gray-300 p-4 text-sm text-gray-500">Thí sinh chưa khai hồ sơ cá nhân (thường gặp khi mới đăng nhập Google lần đầu).</p>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-bold text-gray-900">Hồ sơ xét tuyển ({data.applications.length})</h3>
            {data.applications.length === 0 ? (
              <p className="text-sm text-gray-500">Chưa tạo hồ sơ nào.</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-input border border-gray-200">
                {data.applications.map((x) => {
                  const linkable = canSeeApp && x.reviewStatus !== "DRAFT" && !x.isCancelled;
                  const code = <span className="font-mono text-[13px] font-semibold">{x.applicationCode}</span>;
                  return (
                    <li key={x.applicationId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <span className="min-w-0">
                        {linkable ? (
                          <Link href={`/admin/applications/${x.applicationId}`} className="text-navy-800 hover:underline">
                            {code}
                          </Link>
                        ) : (
                          code
                        )}
                        <span className="block text-xs text-gray-500">
                          {x.majorName} ({DEGREE_LABEL[x.degreeLevel] ?? x.degreeLevel}) · {x.batchName}
                          {x.submittedAt ? ` · nộp ${fmtDate(x.submittedAt)}` : ` · tạo ${fmtDate(x.createdAt)}`}
                          {x.paymentStatus && ` · lệ phí ${x.paymentStatus === "SUCCESS" ? "đã nộp" : "chưa nộp"}`}
                        </span>
                      </span>
                      {x.isCancelled ? (
                        <span className="text-xs font-semibold text-gray-400">Đã hủy</span>
                      ) : x.reviewStatus === "DRAFT" ? (
                        <span className="text-xs font-semibold text-gray-500">Nháp, chưa nộp</span>
                      ) : (
                        <ReviewBadge status={x.reviewStatus} />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {data.complaints.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-bold text-gray-900">Khiếu nại đã gửi ({data.complaints.length})</h3>
              <ul className="space-y-1 text-sm text-gray-700">
                {data.complaints.map((c) => (
                  <li key={c.complaintId}>
                    {fmtDate(c.createdAt)} · {COMPLAINT_STATUS[c.status] ?? c.status}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.lockHistory.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-bold text-gray-900">Lịch sử khóa / mở khóa</h3>
              <ul className="space-y-2 text-[13px] text-gray-700">
                {data.lockHistory.map((h, i) => (
                  <li key={i}>
                    <span className="font-semibold">{h.action === "CANDIDATE_LOCK" ? "Khóa" : "Mở khóa"}</span> · {fmtDateTime(h.at)} · {h.by}
                    {h.detail && <span className="block text-xs text-gray-500">{h.detail}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {formError && <ErrorBox message={formError} />}
        </div>
      )}
    </Modal>
  );
}

export default function CandidatesPage() {
  return (
    <RequirePermission perm="candidate:view">
      <Suspense fallback={null}>
        <CandidatesInner />
      </Suspense>
    </RequirePermission>
  );
}
