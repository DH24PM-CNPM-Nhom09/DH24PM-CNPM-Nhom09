"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminShell";
import { IconAlert, IconSearch } from "@/components/admin/Icons";
import { Btn, EmptyState, ErrorBox, fieldCls, LoadingRows, Modal, PageHeader, Pagination, ReviewBadge, useToast } from "@/components/admin/ui";
import { bulkStartReview, getLookups, listApplications, type ApplicationQuery } from "@/lib/admin/api";
import { fmtDateTime } from "@/lib/admin/format";
import type { ReviewStatus } from "@/lib/admin/types";
import { useAsync } from "@/lib/admin/useAsync";

const TABS: { key: ApplicationQuery["status"] | ""; label: string; countKey?: ReviewStatus | "ALL" }[] = [
  { key: "", label: "Tất cả", countKey: "ALL" },
  { key: "SUBMITTED", label: "Chờ tiếp nhận", countKey: "SUBMITTED" },
  { key: "UNDER_REVIEW", label: "Đang thẩm định", countKey: "UNDER_REVIEW" },
  { key: "READY", label: "Chờ kết luận" },
  { key: "NEEDS_SUPPLEMENT", label: "Chờ bổ sung", countKey: "NEEDS_SUPPLEMENT" },
  { key: "OVERDUE", label: "Quá hạn bổ sung" },
  { key: "APPROVED", label: "Đạt", countKey: "APPROVED" },
  { key: "REJECTED", label: "Không đạt", countKey: "REJECTED" },
];

function ApplicationsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { can } = useAdmin();
  const toast = useToast();
  const canReview = can("application:review");

  const query: ApplicationQuery = {
    batchId: sp.get("batch") ? Number(sp.get("batch")) : undefined,
    majorId: sp.get("major") ? Number(sp.get("major")) : undefined,
    status: (sp.get("status") as ApplicationQuery["status"]) || undefined,
    q: sp.get("q") ?? "",
    sort: (sp.get("sort") as ApplicationQuery["sort"]) || "submitted_desc",
    page: Number(sp.get("page") ?? 1),
    pageSize: 15,
  };

  const [search, setSearch] = useState(query.q ?? "");
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  function update(patch: Record<string, string | number | undefined>, resetPage = true) {
    const next = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => (v === undefined || v === "" ? next.delete(k) : next.set(k, String(v))));
    if (resetPage) next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  // Tìm kiếm gõ tới đâu lọc tới đó (chờ 300ms để không gọi API liên tục)
  useEffect(() => {
    const t = setTimeout(() => {
      if ((search ?? "") !== (query.q ?? "")) update({ q: search.trim() });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const key = sp.toString();
  const lookups = useAsync(getLookups, []);
  const { data, error, loading, reload } = useAsync(() => listApplications(query), [key]);
  useEffect(() => setSelected([]), [key]);

  const majorsOfBatch = useMemo(() => {
    if (!lookups.data) return [];
    const bms = lookups.data.batchMajors.filter((bm) => !query.batchId || bm.batchId === query.batchId);
    const ids = Array.from(new Set(bms.map((b) => b.majorId)));
    return lookups.data.majors.filter((m) => ids.includes(m.majorId));
  }, [lookups.data, query.batchId]);

  const selectable = data?.items.filter((r) => r.reviewStatus === "SUBMITTED").map((r) => r.applicationId) ?? [];
  const allSelected = selectable.length > 0 && selectable.every((id) => selected.includes(id));

  async function runBulk() {
    setBulkLoading(true);
    try {
      const res = await bulkStartReview(selected);
      toast(`Đã tiếp nhận ${res.done} hồ sơ${res.skipped ? `, bỏ qua ${res.skipped} hồ sơ không còn ở trạng thái chờ` : ""}.`);
      setSelected([]);
      setConfirmBulk(false);
      reload(true);
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Hồ sơ xét tuyển" description="Lọc theo đợt, ngành và trạng thái. Bấm vào mã hồ sơ để kiểm tra minh chứng và ra kết luận thẩm định." />

      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <label className="relative block">
          <span className="sr-only">Tìm hồ sơ</span>
          <IconSearch size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={`${fieldCls} pl-9`} placeholder="Mã hồ sơ, họ tên, email hoặc CCCD" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label>
          <span className="sr-only">Đợt tuyển sinh</span>
          <select className={fieldCls} value={query.batchId ?? ""} onChange={(e) => update({ batch: e.target.value, major: undefined })}>
            <option value="">Tất cả đợt</option>
            {lookups.data?.batches.map((b) => (
              <option key={b.batchId} value={b.batchId}>
                {b.batchCode}: {b.batchName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Ngành</span>
          <select className={fieldCls} value={query.majorId ?? ""} onChange={(e) => update({ major: e.target.value })}>
            <option value="">Tất cả ngành</option>
            {majorsOfBatch.map((m) => (
              <option key={m.majorId} value={m.majorId}>
                {m.majorName} ({m.degreeLevel === "TIEN_SI" ? "TS" : "ThS"})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Sắp xếp</span>
          <select className={fieldCls} value={query.sort} onChange={(e) => update({ sort: e.target.value })}>
            <option value="submitted_desc">Mới nộp trước</option>
            <option value="submitted_asc">Nộp lâu nhất trước</option>
          </select>
        </label>
      </div>

      <div className="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="flex w-max gap-1.5" role="tablist" aria-label="Lọc theo trạng thái">
          {TABS.map((t) => {
            const active = (query.status ?? "") === t.key;
            const count = t.countKey && data ? data.counts[t.countKey] : null;
            return (
              <button
                key={t.key || "all"}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => update({ status: t.key || undefined })}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${
                  active ? "border-navy-800 bg-navy-800 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900"
                }`}
              >
                {t.key === "OVERDUE" && <IconAlert size={14} />}
                {t.label}
                {count !== null && <span className={`tabular-nums ${active ? "text-white/70" : "text-gray-400"}`}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {canReview && selected.length > 0 && (
        <div className="sticky top-16 z-10 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-navy-800 bg-navy-50 px-4 py-3 lg:top-3">
          <span className="text-sm font-semibold text-navy-900">Đã chọn {selected.length} hồ sơ chờ tiếp nhận</span>
          <div className="flex gap-2">
            <Btn size="sm" variant="ghost" onClick={() => setSelected([])}>
              Bỏ chọn
            </Btn>
            <Btn size="sm" variant="navy" onClick={() => setConfirmBulk(true)}>
              Tiếp nhận {selected.length} hồ sơ
            </Btn>
          </div>
        </div>
      )}

      {error && <ErrorBox message={error} onRetry={() => reload()} />}

      <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
        {loading && !data ? (
          <LoadingRows />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="Không có hồ sơ phù hợp">
            {query.q || query.status || query.batchId ? (
              <button type="button" className="font-semibold text-accent hover:underline" onClick={() => { setSearch(""); router.replace(pathname); }}>
                Xóa bộ lọc
              </button>
            ) : (
              "Hồ sơ thí sinh nộp sẽ xuất hiện ở đây."
            )}
          </EmptyState>
        ) : (
          <>
            {/* Bảng — máy tính */}
            <div className={`hidden overflow-x-auto md:block ${loading ? "opacity-60" : ""}`}>
              <table className="w-full min-w-[960px] text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                  <tr>
                    {canReview && (
                      <th className="w-10 py-3 pl-4">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[#1B3A66]"
                          aria-label="Chọn tất cả hồ sơ chờ tiếp nhận trên trang"
                          disabled={selectable.length === 0}
                          checked={allSelected}
                          onChange={(e) => setSelected(e.target.checked ? selectable : [])}
                        />
                      </th>
                    )}
                    <th className="px-4 py-3">Hồ sơ</th>
                    <th className="px-4 py-3">Ngành dự tuyển</th>
                    <th className="px-4 py-3">Nộp lúc</th>
                    <th className="px-4 py-3">Minh chứng</th>
                    <th className="px-4 py-3">Lệ phí</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Phụ trách</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.items.map((r) => (
                    <tr key={r.applicationId} className="align-top hover:bg-gray-50/70">
                      {canReview && (
                        <td className="py-3.5 pl-4">
                          {r.reviewStatus === "SUBMITTED" && (
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-[#1B3A66]"
                              aria-label={`Chọn hồ sơ ${r.applicationCode}`}
                              checked={selected.includes(r.applicationId)}
                              onChange={(e) => setSelected((xs) => (e.target.checked ? [...xs, r.applicationId] : xs.filter((x) => x !== r.applicationId)))}
                            />
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3.5">
                        <Link href={`/admin/applications/${r.applicationId}`} className="font-semibold text-gray-900 hover:text-accent hover:underline">
                          {r.candidateName}
                        </Link>
                        <div className="mt-0.5 font-mono text-[12px] text-gray-500">{r.applicationCode}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-gray-800">{r.majorName}</div>
                        <div className="text-xs text-gray-500">
                          {r.degreeLevel === "TIEN_SI" ? "Tiến sĩ" : "Thạc sĩ"}, đợt {r.batchCode}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 tabular-nums text-gray-600">{fmtDateTime(r.submittedAt)}</td>
                      <td className="px-4 py-3.5">
                        <span className={`tabular-nums ${r.docsValid === r.docsTotal ? "font-semibold text-[#166534]" : "text-gray-600"}`}>
                          {r.docsValid}/{r.docsTotal} hợp lệ
                        </span>
                      </td>
                      <td className="px-4 py-3.5">{r.paid ? <span className="text-gray-600">Đã nộp</span> : <span className="font-semibold text-[#92400E]">Chưa nộp</span>}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <ReviewBadge status={r.reviewStatus} />
                          {r.overdue && <span className="text-xs font-semibold text-[#B91C1C]">Quá hạn bổ sung</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">{r.assignedStaffName ?? <span className="text-gray-400">Chưa phân công</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Thẻ — điện thoại */}
            <ul className="divide-y divide-gray-100 md:hidden">
              {data.items.map((r) => (
                <li key={r.applicationId}>
                  <Link href={`/admin/applications/${r.applicationId}`} className="block px-4 py-3.5 active:bg-gray-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900">{r.candidateName}</p>
                        <p className="truncate font-mono text-[11.5px] text-gray-500">{r.applicationCode}</p>
                      </div>
                      <ReviewBadge status={r.reviewStatus} />
                    </div>
                    <p className="mt-1.5 text-[13px] text-gray-600">
                      {r.majorName}, {r.docsValid}/{r.docsTotal} minh chứng hợp lệ{!r.paid && ", chưa nộp lệ phí"}
                    </p>
                    {r.overdue && <p className="mt-1 text-xs font-semibold text-[#B91C1C]">Quá hạn bổ sung</p>}
                  </Link>
                </li>
              ))}
            </ul>

            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(p) => update({ page: p }, false)} />
          </>
        )}
      </div>

      <Modal
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        title={`Tiếp nhận ${selected.length} hồ sơ?`}
        description="Các hồ sơ sẽ chuyển sang Đang thẩm định, bạn là người phụ trách, và thí sinh nhận được thông báo hồ sơ đã được tiếp nhận."
        footer={
          <>
            <Btn onClick={() => setConfirmBulk(false)}>Hủy</Btn>
            <Btn variant="navy" loading={bulkLoading} onClick={runBulk}>
              Tiếp nhận
            </Btn>
          </>
        }
      />
    </>
  );
}

export default function ApplicationsPage() {
  return (
    <RequirePermission perm="application:view">
      <Suspense fallback={<LoadingRows />}>
        <ApplicationsInner />
      </Suspense>
    </RequirePermission>
  );
}
