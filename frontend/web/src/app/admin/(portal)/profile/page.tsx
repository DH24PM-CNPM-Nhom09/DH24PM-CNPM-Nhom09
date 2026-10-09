"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { initials, useAdmin } from "@/components/admin/AdminShell";
import { IconClock, IconKey, IconLogout, IconShield } from "@/components/admin/Icons";
import { Btn, EmptyState, ErrorBox, PageHeader, Panel, Skeleton, StaffStatusBadge, Tag } from "@/components/admin/ui";
import { getMyStaffProfile, staffLogout } from "@/lib/admin/api";
import { AUDIT_ACTION_LABEL, fmtDateTime } from "@/lib/admin/format";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/admin/permissions";
import { useAsync } from "@/lib/admin/useAsync";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium text-gray-900">{children}</dd>
    </div>
  );
}

function Stat({ value, label, href }: { value: number; label: string; href?: string }) {
  const body = (
    <>
      <p className="text-[28px] font-bold leading-none tabular-nums text-gray-900">{value}</p>
      <p className="mt-2 text-sm text-gray-500">{label}</p>
    </>
  );
  return href ? (
    <Link href={href} className="rounded-card border border-gray-200 bg-white p-5 transition-colors hover:border-gray-300 hover:bg-gray-50">
      {body}
    </Link>
  ) : (
    <div className="rounded-card border border-gray-200 bg-white p-5">{body}</div>
  );
}

/** Trang cá nhân của cán bộ đang đăng nhập (mở bằng cách bấm vào khung tên ở góc dưới menu) */
export default function StaffProfilePage() {
  const { staff, can } = useAdmin();
  const router = useRouter();
  const { data, error, loading, reload } = useAsync(() => getMyStaffProfile(), [staff.staffAccountId]);
  const me = data?.staff ?? staff;

  function logout() {
    staffLogout();
    router.replace("/admin/login");
  }

  return (
    <>
      <PageHeader
        title="Trang cá nhân"
        description="Thông tin tài khoản cán bộ bạn đang dùng. Muốn đổi họ tên, email hoặc vai trò, liên hệ Quản trị hệ thống."
        actions={
          <>
            <Link href="/admin/change-password" className="inline-flex h-11 items-center gap-2 rounded-input border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:border-gray-400 hover:bg-gray-50">
              <IconKey size={17} /> Đổi mật khẩu
            </Link>
            <Btn variant="danger" onClick={logout}>
              <IconLogout size={17} /> Đăng xuất
            </Btn>
          </>
        }
      />

      {error && <ErrorBox message={error} onRetry={() => reload()} />}

      {/* Thẻ tóm tắt */}
      <section className="mb-6 flex flex-col gap-5 rounded-card border border-gray-200 bg-white p-6 sm:flex-row sm:items-center">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-navy-800 text-2xl font-bold text-white">{initials(me.fullName)}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">{me.fullName}</h2>
            <StaffStatusBadge status={me.status} />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {me.email} · Mã cán bộ <span className="font-mono text-gray-700">{me.staffCode}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {me.roles.map((r) => (
              <Tag key={r} tone="navy">
                {ROLE_LABEL[r]}
              </Tag>
            ))}
          </div>
        </div>
      </section>

      {/* Việc của tôi */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {loading && !data ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-[104px] rounded-card" />)
        ) : (
          <>
            <Stat value={data?.stats.underReview ?? 0} label="Hồ sơ tôi đang thẩm định" href={can("application:view") ? "/admin/applications?status=UNDER_REVIEW" : undefined} />
            <Stat value={data?.stats.reviewsDone ?? 0} label="Lượt thẩm định / kết luận đã thực hiện" />
            <Stat value={data?.stats.actionsLast30Days ?? 0} label="Thao tác trong 30 ngày qua" />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title="Thông tin tài khoản" bodyClass="px-5 py-1">
            <dl className="divide-y divide-gray-100">
              <InfoRow label="Họ và tên">{me.fullName}</InfoRow>
              <InfoRow label="Email công tác">{me.email}</InfoRow>
              <InfoRow label="Mã cán bộ">
                <span className="font-mono">{me.staffCode}</span>
              </InfoRow>
              <InfoRow label="Trạng thái">
                <StaffStatusBadge status={me.status} />
              </InfoRow>
              <InfoRow label="Cách đăng nhập">{me.hasPassword ? "Mật khẩu hoặc Google" : "Chỉ đăng nhập bằng Google"}</InfoRow>
              <InfoRow label="Đổi mật khẩu gần nhất">{data?.passwordChangedAt ? fmtDateTime(data.passwordChangedAt) : "Chưa đổi lần nào"}</InfoRow>
            </dl>
          </Panel>

          <Panel title="Vai trò và phạm vi công việc">
            <ul className="space-y-4">
              {me.roles.map((r) => (
                <li key={r} className="flex gap-3">
                  <span className="mt-0.5 text-navy-800">
                    <IconShield size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{ROLE_LABEL[r]}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-gray-600">{ROLE_DESCRIPTION[r]}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Đăng nhập gần đây" bodyClass="px-5 py-2">
            {loading && !data ? (
              <Skeleton className="my-3 h-24" />
            ) : !data?.recentLogins.length ? (
              <p className="py-4 text-sm text-gray-500">Chưa có lần đăng nhập nào được ghi lại.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {data.recentLogins.map((l, i) => (
                  <li key={i} className="flex items-center gap-3 py-3 text-sm">
                    <span className="text-gray-400">
                      <IconClock size={16} />
                    </span>
                    <span className="tabular-nums text-gray-900">{fmtDateTime(l.at)}</span>
                    <span className="text-gray-500">{l.detail}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="border-t border-gray-100 py-3 text-xs text-gray-500">Thấy lần đăng nhập lạ? Đổi mật khẩu ngay và báo Quản trị hệ thống.</p>
          </Panel>

          <Panel
            title="Hoạt động gần đây của tôi"
            action={
              can("audit:view") ? (
                <Link href="/admin/audit-log" className="text-sm font-semibold text-accent hover:underline">
                  Xem nhật ký
                </Link>
              ) : undefined
            }
            bodyClass="px-5 py-1"
          >
            {loading && !data ? (
              <Skeleton className="my-3 h-40" />
            ) : !data?.recentActivity.length ? (
              <EmptyState title="Chưa có thao tác nào">Các việc bạn làm trên hệ thống (thẩm định, cập nhật đợt, nhập điểm…) sẽ hiện ở đây.</EmptyState>
            ) : (
              <ul className="divide-y divide-gray-100">
                {data.recentActivity.map((l) => (
                  <li key={l.logId} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-900">{AUDIT_ACTION_LABEL[l.action] ?? l.action}</p>
                      <span className="shrink-0 text-xs tabular-nums text-gray-400">{fmtDateTime(l.createdAt)}</span>
                    </div>
                    {l.detail && <p className="mt-0.5 text-sm text-gray-600">{l.detail}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
