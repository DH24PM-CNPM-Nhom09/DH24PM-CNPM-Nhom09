"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Badge, { admissionStatusLabel, admissionStatusTone } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { getMyApplication } from "@/lib/api";
import type { Application } from "@/lib/types";

export default function AdmissionConfirmPage() {
  const [app, setApp] = useState<Application | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyApplication()
      .then(setApp)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <div className="mx-auto max-w-[700px]">
        <h1 className="text-2xl font-extrabold text-gray-900">Xác nhận nhập học</h1>
        <p className="mt-1 text-sm text-gray-500">
          Xác nhận nhập học chính thức sau khi có kết quả trúng tuyển.
        </p>

        {loading ? (
          <div className="mt-6 h-52 animate-pulse rounded-card bg-gray-100" />
        ) : app ? (
          <Card className="mt-6 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{app.applicationCode}</p>
                <p className="mt-1 text-base font-bold text-gray-900">
                  {app.majorName} · {app.degreeLevel === "TIEN_SI" ? "Tiến sĩ" : "Thạc sĩ"}
                </p>
              </div>
              <Badge tone={admissionStatusTone(app.admissionStatus)}>
                {admissionStatusLabel[app.admissionStatus]}
              </Badge>
            </div>

            {app.admissionStatus === "ADMITTED" && !confirmed && (
              <div className="mt-6 border-t border-gray-100 pt-5">
                <p className="text-sm text-gray-600">
                  Chúc mừng bạn đã trúng tuyển! Vui lòng xác nhận nhập học trước thời hạn quy định
                  của trường để giữ chỗ.
                </p>
                <Button className="mt-4" onClick={() => setConfirmed(true)}>
                  Xác nhận nhập học ngay
                </Button>
              </div>
            )}

            {(confirmed || app.admissionStatus === "CONFIRMED" || app.admissionStatus === "ENROLLED") && (
              <div className="mt-6 rounded-input bg-success-50 px-4 py-3 text-[13px] font-medium text-success">
                Bạn đã xác nhận nhập học thành công. Vui lòng theo dõi email để nhận hướng dẫn nhập
                học chi tiết.
              </div>
            )}

            {app.admissionStatus === "NONE" && (
              <div className="mt-6 rounded-input bg-gray-50 px-4 py-3 text-[13px] font-medium text-gray-500">
                Hồ sơ của bạn chưa có kết quả xét tuyển. Vui lòng quay lại sau.
              </div>
            )}
            {app.admissionStatus === "WAITLISTED" && (
              <div className="mt-6 rounded-input bg-warning-50 px-4 py-3 text-[13px] font-medium text-warning">
                Bạn đang ở danh sách dự bị. Chúng tôi sẽ thông báo nếu có chỉ tiêu bổ sung.
              </div>
            )}
          </Card>
        ) : (
          <Card className="mt-6 p-8 text-center text-sm text-gray-500">
            Không tìm thấy hồ sơ xét tuyển.
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
