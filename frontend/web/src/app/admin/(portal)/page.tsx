"use client";

import Link from "next/link";
import { useAdmin } from "@/components/admin/AdminShell";
import { IconChevronRight } from "@/components/admin/Icons";
import { ErrorBox, PageHeader, Panel, REVIEW_LABEL, Skeleton } from "@/components/admin/ui";
import { getDashboard } from "@/lib/admin/api";
import { AUDIT_ACTION_LABEL, fmtDateTime } from "@/lib/admin/format";
import type { ReviewStatus } from "@/lib/admin/types";
import { useAsync } from "@/lib/admin/useAsync";

// Màu trạng thái — giữ đúng như nhãn trạng thái trong danh sách hồ sơ
const STATUS_ORDER: ReviewStatus[] = ["SUBMITTED", "UNDER_REVIEW", "NEEDS_SUPPLEMENT", "APPROVED", "REJECTED"];
const STATUS_FILL: Record<ReviewStatus, string> = {
  DRAFT: "#9AA4B2",
  SUBMITTED: "#3B6FD8",
  UNDER_REVIEW: "#1B3A66",
  NEEDS_SUPPLEMENT: "#D98A1E",
  APPROVED: "#1F8A4C",
  REJECTED: "#C43B3B",
};

export default function AdminDashboardPage() {
  const { staff, can } = useAdmin();
  const { data, error, loading, reload } = useAsync(getDashboard, []);
  const firstName = staff.fullName.split(" ").slice(-1)[0];

  const queue: { count: number; text: string; hint?: string; href: string; urgent?: boolean }[] = [];
  if (data) {
    if (can("application:review")) {
      queue.push(
        {
          count: data.overdueSupplements,
          text: "hồ sơ đã quá hạn bổ sung",
          hint: "Cần kết luận không đạt hoặc liên hệ thí sinh",
          href: "/admin/applications?status=OVERDUE",
          urgent: true,
        },
        {
          count: data.statusCounts.SUBMITTED,
          text: "hồ sơ mới chờ tiếp nhận",
          hint: data.waitingOldestDays !== null ? `Hồ sơ chờ lâu nhất đã ${data.waitingOldestDays} ngày` : undefined,
          href: "/admin/applications?status=SUBMITTED&sort=submitted_asc",
          urgent: (data.waitingOldestDays ?? 0) >= 5,
        },
        {
          count: data.readyToConclude,
          text: "hồ sơ đã kiểm đủ minh chứng, chờ kết luận",
          href: "/admin/applications?status=READY",
        },
        {
          count: data.myUnderReview,
          text: "hồ sơ bạn đang thẩm định",
          href: "/admin/applications?status=UNDER_REVIEW",
        },
      );
    }
    if (can("appeal:resolve")) queue.push({ count: data.pendingAppeals, text: "đơn phúc khảo chờ hội đồng xử lý", href: "/admin/appeals" });
    if (can("batch:approve")) queue.push({ count: data.configuringMajors, text: "ngành chờ phê duyệt chỉ tiêu", href: "/admin/batches", urgent: true });
    if (can("account:manage")) queue.push({ count: data.lockedAccounts, text: "tài khoản cán bộ đang bị khóa", href: "/admin/accounts" });
    if (can("complaint:handle")) queue.push({ count: data.openComplaints ?? 0, text: "khiếu nại của thí sinh cần trả lời", href: "/admin/complaints", urgent: true });
    if (can("appeal:resolve")) queue.push({ count: data.appealFeesPending ?? 0, text: "đơn phúc khảo chờ xác nhận lệ phí", href: "/admin/appeals" });
    if (can("result:approve")) queue.push({ count: data.resultsAwaitingApproval ?? 0, text: "ngành có kết quả xét tuyển chờ phê duyệt", href: "/admin/results", urgent: true });
    if (can("decision:sign")) queue.push({ count: data.decisionsToSign ?? 0, text: "quyết định trúng tuyển chờ ký", href: "/admin/decisions", urgent: true });
    if (can("decision:manage")) queue.push({ count: data.enrollmentsPending ?? 0, text: "thí sinh đã xác nhận nhập học, chờ đối chiếu bản chính / hoàn tất", href: "/admin/decisions" });
  }
  const todo = queue.filter((q) => q.count > 0);

  const total = data ? STATUS_ORDER.reduce((s, k) => s + data.statusCounts[k], 0) : 0;

  return (
    <>
      <PageHeader title={`Xin chào, ${firstName}`} description="Những việc cần xử lý hôm nay trên các đợt tuyển sinh đang mở." />

      {error && <ErrorBox message={error} onRetry={() => reload()} />}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel title="Việc cần làm" bodyClass="p-0">
          {loading && !data ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : todo.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-500">Không còn việc tồn đọng. Mọi hồ sơ đều đã được xử lý đúng hạn.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {todo.map((q) => (
                <li key={q.text}>
                  <Link href={q.href} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none">
                    <span
                      className={`flex h-12 min-w-12 items-center justify-center rounded-xl px-2 text-xl font-extrabold tabular-nums ${
                        q.urgent ? "bg-accent-50 text-[#A9441F]" : "bg-navy-50 text-navy-800"
                      }`}
                    >
                      {q.count}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-gray-900">{q.text.charAt(0).toUpperCase() + q.text.slice(1)}</span>
                      {q.hint && <span className="mt-0.5 block text-[13px] text-gray-500">{q.hint}</span>}
                    </span>
                    <IconChevronRight size={18} className="shrink-0 text-gray-300 transition-colors group-hover:text-gray-500" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {can("application:view") && (
          <Panel title="Tình trạng thẩm định" action={<span className="text-[13px] text-gray-500">{total.toLocaleString("vi-VN")} hồ sơ đã nộp</span>}>
            {!data ? (
              <Skeleton className="h-40" />
            ) : (
              <>
                <div className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full bg-gray-100" role="img" aria-label="Tỉ lệ hồ sơ theo trạng thái thẩm định">
                  {STATUS_ORDER.filter((k) => data.statusCounts[k] > 0).map((k) => (
                    <div key={k} title={`${REVIEW_LABEL[k]}: ${data.statusCounts[k]}`} style={{ width: `${(data.statusCounts[k] / Math.max(1, total)) * 100}%`, background: STATUS_FILL[k] }} />
                  ))}
                </div>
                <table className="mt-4 w-full text-sm">
                  <caption className="sr-only">Số hồ sơ theo trạng thái</caption>
                  <tbody>
                    {STATUS_ORDER.map((k) => (
                      <tr key={k} className="border-b border-gray-100 last:border-0">
                        <td className="py-2">
                          <Link href={`/admin/applications?status=${k}`} className="inline-flex items-center gap-2.5 text-gray-700 hover:text-gray-900 hover:underline">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_FILL[k] }} aria-hidden="true" />
                            {REVIEW_LABEL[k]}
                          </Link>
                        </td>
                        <td className="py-2 text-right font-semibold tabular-nums text-gray-900">{data.statusCounts[k]}</td>
                        <td className="w-14 py-2 text-right tabular-nums text-gray-500">{total ? Math.round((data.statusCounts[k] / total) * 100) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </Panel>
        )}
      </div>

      {can("application:view") && data && data.progress.length > 0 && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {data.progress.map((b) => (
            <Panel key={b.batchCode} title={<h2 className="text-[15px] font-bold text-gray-900">{b.batchName}</h2>} action={<span className="text-xs font-semibold text-gray-400">{b.batchCode}</span>}>
              <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 whitespace-nowrap text-xs text-gray-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_FILL.APPROVED }} /> Đạt thẩm định
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#9DB1CF]" /> Đã nộp, chưa kết luận đạt
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-px bg-gray-500" /> Chỉ tiêu
                </span>
              </div>
              <ul className="space-y-4">
                {b.rows.map((r) => {
                  const scale = Math.max(r.quota, r.submitted, 1);
                  return (
                    <li key={r.batchMajorId}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium text-gray-800">{r.majorName}</span>
                        <span className="tabular-nums text-gray-500">
                          <span className="font-semibold text-gray-900">{r.submitted}</span> hồ sơ / {r.quota} chỉ tiêu
                        </span>
                      </div>
                      <div className="relative h-2.5 rounded-full bg-gray-100" title={`${r.approved} đạt, ${r.submitted} đã nộp, chỉ tiêu ${r.quota}`}>
                        <div className="absolute inset-y-0 left-0 flex gap-[2px] overflow-hidden rounded-full" style={{ width: `${(r.submitted / scale) * 100}%` }}>
                          <div style={{ width: `${r.submitted ? (r.approved / r.submitted) * 100 : 0}%`, background: STATUS_FILL.APPROVED }} />
                          <div className="flex-1 bg-[#9DB1CF]" />
                        </div>
                        <div className="absolute -bottom-1 -top-1 w-0.5 rounded bg-gray-500" style={{ left: `calc(${(r.quota / scale) * 100}% - 1px)` }} aria-hidden="true" />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ))}
        </div>
      )}

      {data && data.recent.length > 0 && (
        <Panel className="mt-5" title="Hoạt động gần đây" action={<Link href="/admin/audit-log" className="text-[13px] font-semibold text-accent hover:underline">Xem nhật ký</Link>} bodyClass="p-0">
          <ul className="divide-y divide-gray-100">
            {data.recent.map((l) => (
              <li key={l.logId} className="flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
                <span className="w-36 shrink-0 text-xs tabular-nums text-gray-400">{fmtDateTime(l.createdAt)}</span>
                <span className="text-sm font-semibold text-gray-800">{AUDIT_ACTION_LABEL[l.action] ?? l.action}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-gray-500">{l.detail}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
