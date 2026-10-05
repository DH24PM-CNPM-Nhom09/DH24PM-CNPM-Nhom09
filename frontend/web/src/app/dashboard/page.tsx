"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Badge, { admissionStatusLabel, admissionStatusTone, reviewStatusLabel, reviewStatusTone } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { getMyFullApplication, getMyProfile } from "@/lib/api";
import { CATEGORY_LABEL, CATEGORY_TONE, fmtDate, getAnnouncements, type Announcement } from "@/lib/announcements";
import { DOC_LABEL, fmtMoney } from "@/lib/application";
import type { Candidate, FullApplication } from "@/lib/types";

export default function DashboardPage() {
  const [app, setApp] = useState<FullApplication | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [news, setNews] = useState<Announcement[] | null>(null);

  useEffect(() => {
    Promise.all([getMyFullApplication(), getMyProfile()])
      .then(([a, c]) => {
        setApp(a);
        setCandidate(c);
      })
      .catch((e: any) =>
        setError(e?.message ?? "Không tải được dữ liệu. Kiểm tra backend (cổng 4000) đã chạy chưa."),
      )
      .finally(() => setLoading(false));
    getAnnouncements({ pageSize: 4 })
      .then((r) => setNews(r.items))
      .catch(() => setNews([]));
  }, []);

  return (
    <AppLayout>
      <div className="mx-auto max-w-[900px]">
        <h1 className="text-2xl font-extrabold text-gray-900">
          Xin chào, {candidate?.fullName ?? "..."} 👋
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Đây là tổng quan hồ sơ xét tuyển sau đại học của bạn.
        </p>

        {loading ? (
          <div className="mt-6 h-40 animate-pulse rounded-card bg-gray-100" />
        ) : error ? (
          <Card className="mt-6 p-6 text-sm font-medium text-danger">{error}</Card>
        ) : app ? (
          <Card className="mt-6 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Mã hồ sơ
                </p>
                <p className="mt-1 text-lg font-extrabold text-gray-900">{app.applicationCode}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {app.major.majorName} · {app.degreeLevel === "TIEN_SI" ? "Tiến sĩ" : "Thạc sĩ"} ·{" "}
                  {app.batch.batchName}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge tone={reviewStatusTone(app.reviewStatus)}>
                  {reviewStatusLabel[app.reviewStatus]}
                </Badge>
                <Badge tone={admissionStatusTone(app.admissionStatus)}>
                  {admissionStatusLabel[app.admissionStatus]}
                </Badge>
              </div>
            </div>

            {app.reviewStatus === "DRAFT" && (
              <div className="mt-4 rounded-input bg-gray-50 px-4 py-3 text-[13px] font-medium text-gray-700">
                Hồ sơ đang ở dạng nháp, chưa được nộp. Hạn nộp: {new Date(app.batch.registrationEndAt).toLocaleString("vi-VN")}.
                {app.missingDocuments.length > 0 && ` Còn thiếu: ${app.missingDocuments.map((t) => DOC_LABEL[t]).join(", ")}.`}
              </div>
            )}
            {app.reviewStatus !== "DRAFT" && app.payment && app.payment.status !== "SUCCESS" && (
              <div className="mt-4 rounded-input bg-warning-50 px-4 py-3 text-[13px] font-medium text-[#92400E]">
                Bạn chưa nộp lệ phí xét tuyển {fmtMoney(app.payment.amount)}. Xem hướng dẫn chuyển khoản trong mục Hồ sơ xét tuyển.
              </div>
            )}
            {app.reviewStatus === "NEEDS_SUPPLEMENT" && (
              <div className="mt-4 rounded-input bg-warning-50 px-4 py-3 text-[13px] font-medium text-warning">
                Hồ sơ của bạn cần bổ sung thêm giấy tờ. Vui lòng kiểm tra chi tiết trong mục Hồ sơ
                xét tuyển.
              </div>
            )}

            <AdmissionNotice app={app} />

            <div className="mt-5 flex flex-wrap gap-3">
              {app.reviewStatus === "DRAFT" ? (
                <Link href="/application/new">
                  <Button variant="primary">Tiếp tục hoàn thiện hồ sơ</Button>
                </Link>
              ) : (
                <Link href="/application">
                  <Button variant="primary">Xem chi tiết hồ sơ</Button>
                </Link>
              )}
              {app.admission?.enrollment?.canConfirm && (
                <Link href="/application">
                  <Button variant="secondary">Xác nhận nhập học</Button>
                </Link>
              )}
              {app.reviewStatus !== "DRAFT" && (
                <Link href="/complaint">
                  <Button variant="outline">Gửi khiếu nại / phúc khảo</Button>
                </Link>
              )}
            </div>
          </Card>
        ) : (
          <Card className="mt-6 p-8 text-center">
            <p className="text-sm text-gray-500">Bạn chưa tạo hồ sơ xét tuyển nào.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link href="/announcements?tab=batches">
                <Button variant="outline">Xem các đợt đang mở</Button>
              </Link>
              <Link href="/application/new">
                <Button>Tạo hồ sơ xét tuyển</Button>
              </Link>
            </div>
          </Card>
        )}

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Hồ sơ</p>
            <p className="mt-2 text-2xl font-extrabold text-gray-900">
              {app ? reviewStatusLabel[app.reviewStatus] : "—"}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Kết quả xét tuyển
            </p>
            <p className="mt-2 text-2xl font-extrabold text-gray-900">
              {app ? (app.declined ? "Không nhập học" : app.admission?.result && app.admissionStatus === "NONE" ? app.admission.result.label : admissionStatusLabel[app.admissionStatus]) : "—"}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              GVHD (bậc Tiến sĩ)
            </p>
            <Link href="/gvhd" className="mt-2 block text-sm font-semibold text-accent hover:underline">
              Xem trạng thái →
            </Link>
          </Card>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">Thông báo mới</h2>
            <Link href="/announcements" className="text-[13px] font-semibold text-accent hover:underline">
              Xem tất cả →
            </Link>
          </div>
          <Card className="mt-3 divide-y divide-gray-100">
            {news === null ? (
              <div className="h-40 animate-pulse bg-gray-50" />
            ) : news.length === 0 ? (
              <p className="p-5 text-sm text-gray-500">Chưa có thông báo nào.</p>
            ) : (
              news.map((a) => (
                <Link key={a.announcementId} href={`/announcements/${a.announcementId}`} className="flex flex-col gap-1 px-5 py-3.5 hover:bg-gray-50 sm:flex-row sm:items-center sm:gap-3">
                  <span className={`w-fit shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${CATEGORY_TONE[a.category]}`}>{CATEGORY_LABEL[a.category]}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">{a.title}</span>
                  <span className="shrink-0 text-xs text-gray-400">{fmtDate(a.publishedAt)}</span>
                </Link>
              ))
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

/** Việc cần làm ở giai đoạn xét tuyển → nhập học (lịch, phúc khảo, kết quả, xác nhận) */
function AdmissionNotice({ app }: { app: FullApplication }) {
  const a = app.admission;
  if (!a || app.declined) return null;
  const vn = (iso: string | null) => (iso ? new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }) : "");
  let text: string | null = null;
  let tone = "bg-info-50 text-[#1D4ED8]";
  const e = a.enrollment;
  if (e?.studentCode) {
    text = `Bạn đã hoàn tất nhập học. Mã học viên: ${e.studentCode}.`;
    tone = "bg-success-50 text-[#166534]";
  } else if (e?.canConfirm) {
    text = `Bạn đã trúng tuyển (Quyết định ${e.decisionNo}). Hãy xác nhận nhập học trước ${vn(e.deadline)}.`;
    tone = "bg-warning-50 text-[#92400E]";
  } else if (e?.status === "DA_XAC_NHAN") {
    text = "Bạn đã xác nhận nhập học. Nộp bản chính hồ sơ tại Phòng Đào tạo Sau đại học để hoàn tất thủ tục.";
  } else if (a.result) {
    text = a.result.result === "TRUNG_TUYEN" ? "Chúc mừng, bạn đã trúng tuyển! Quyết định công nhận trúng tuyển sẽ được gửi trên cổng." : a.result.result === "DU_BI" ? `Bạn có tên trong danh sách dự bị, thứ tự ${a.result.waitlistRank ?? ""}.` : "Kết quả xét tuyển đã được công bố.";
    if (a.result.result === "TRUNG_TUYEN") tone = "bg-success-50 text-[#166534]";
  } else if (a.scores) {
    text = a.scores.canAppeal ? `Điểm xét tuyển đã công bố (tổng ${a.scores.total ?? "—"}). Hạn phúc khảo: ${vn(a.scores.appealDeadline)}.` : `Điểm xét tuyển đã công bố (tổng ${a.scores.total ?? "—"}). Chờ công bố kết quả trúng tuyển.`;
  } else if (a.interview && new Date(a.interview.scheduledAt).getTime() > Date.now()) {
    text = `Lịch ${a.interviewLabel.toLowerCase()}: ${vn(a.interview.scheduledAt)}${a.interview.location ? `, ${a.interview.location}` : ""}.`;
  }
  if (!text) return null;
  return <div className={`mt-4 rounded-input px-4 py-3 text-[13px] font-medium ${tone}`}>{text}</div>;
}
