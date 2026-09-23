"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Badge, { admissionStatusLabel, admissionStatusTone, reviewStatusLabel, reviewStatusTone } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { getMyApplication, getMyProfile } from "@/lib/api";
import type { Application, Candidate } from "@/lib/types";

export default function DashboardPage() {
  const [app, setApp] = useState<Application | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMyApplication(), getMyProfile()]).then(([a, c]) => {
      setApp(a);
      setCandidate(c);
      setLoading(false);
    });
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
        ) : app ? (
          <Card className="mt-6 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Mã hồ sơ
                </p>
                <p className="mt-1 text-lg font-extrabold text-gray-900">{app.applicationCode}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {app.majorName} · {app.degreeLevel === "TIEN_SI" ? "Tiến sĩ" : "Thạc sĩ"} ·{" "}
                  {app.batchName}
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

            {app.reviewStatus === "NEEDS_SUPPLEMENT" && (
              <div className="mt-4 rounded-input bg-warning-50 px-4 py-3 text-[13px] font-medium text-warning">
                Hồ sơ của bạn cần bổ sung thêm giấy tờ. Vui lòng kiểm tra chi tiết trong mục Hồ sơ
                xét tuyển.
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/application">
                <Button variant="primary">Xem chi tiết hồ sơ</Button>
              </Link>
              {app.admissionStatus === "ADMITTED" && (
                <Link href="/admission-confirm">
                  <Button variant="secondary">Xác nhận nhập học</Button>
                </Link>
              )}
              <Link href="/complaint">
                <Button variant="outline">Gửi khiếu nại / phúc khảo</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <Card className="mt-6 p-8 text-center">
            <p className="text-sm text-gray-500">Bạn chưa tạo hồ sơ xét tuyển nào.</p>
            <Link href="/application/new">
              <Button className="mt-4">Tạo hồ sơ xét tuyển</Button>
            </Link>
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
              {app ? admissionStatusLabel[app.admissionStatus] : "—"}
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
      </div>
    </AppLayout>
  );
}
