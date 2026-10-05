"use client";

import { useEffect, useState } from "react";
import { RequirePermission } from "@/components/admin/AdminShell";
import { IconSearch } from "@/components/admin/Icons";
import { EmptyState, ErrorBox, fieldCls, LoadingRows, PageHeader, Pagination } from "@/components/admin/ui";
import { listAuditLogs } from "@/lib/admin/api";
import { AUDIT_ACTION_LABEL, fmtDateTime } from "@/lib/admin/format";
import { useAsync } from "@/lib/admin/useAsync";

const ACTOR_LABEL: Record<string, string> = { STAFF: "Cán bộ", CANDIDATE: "Thí sinh", SYSTEM: "Hệ thống" };

function AuditInner() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [actorType, setActorType] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, error, loading, reload } = useAsync(() => listAuditLogs({ q, actorType, page, pageSize: 20 }), [q, actorType, page]);

  return (
    <>
      <PageHeader title="Nhật ký hệ thống" description="Mọi thao tác thay đổi dữ liệu đều được ghi lại: ai làm, lúc nào, trên bản ghi nào. Nhật ký chỉ xem, không sửa hoặc xóa được." />

      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px] md:max-w-2xl">
        <label className="relative block">
          <span className="sr-only">Tìm trong nhật ký</span>
          <IconSearch size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={`${fieldCls} pl-9`} placeholder="Mã hồ sơ, mã đợt, hành động…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label>
          <span className="sr-only">Người thực hiện</span>
          <select className={fieldCls} value={actorType} onChange={(e) => { setActorType(e.target.value); setPage(1); }}>
            <option value="">Mọi người thực hiện</option>
            <option value="STAFF">Cán bộ</option>
            <option value="CANDIDATE">Thí sinh</option>
            <option value="SYSTEM">Hệ thống</option>
          </select>
        </label>
      </div>

      {error && <ErrorBox message={error} onRetry={() => reload()} />}

      <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
        {loading && !data ? (
          <LoadingRows />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="Không có bản ghi phù hợp" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                  <tr>
                    <th className="px-5 py-3">Thời điểm</th>
                    <th className="px-5 py-3">Người thực hiện</th>
                    <th className="px-5 py-3">Hành động</th>
                    <th className="px-5 py-3">Chi tiết</th>
                    <th className="px-5 py-3">Bản ghi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.items.map((l) => (
                    <tr key={l.logId} className="align-top">
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums text-gray-500">{fmtDateTime(l.createdAt)}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{l.actorName}</p>
                        <p className="text-xs text-gray-400">{ACTOR_LABEL[l.actorType]}</p>
                      </td>
                      <td className="px-5 py-3 font-semibold text-gray-800">{AUDIT_ACTION_LABEL[l.action] ?? l.action}</td>
                      <td className="max-w-[420px] px-5 py-3 text-gray-600">{l.detail}</td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-gray-400">
                        {l.entityTable}
                        {l.entityId ? `#${l.entityId}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={20} total={data.total} onChange={setPage} unit="bản ghi" />
          </>
        )}
      </div>
    </>
  );
}

export default function AuditLogPage() {
  return (
    <RequirePermission perm="audit:view">
      <AuditInner />
    </RequirePermission>
  );
}
