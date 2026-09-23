"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { getMySupervisorRequest } from "@/lib/api";
import type { SupervisorRequest } from "@/lib/types";

const statusMeta: Record<SupervisorRequest["status"], { label: string; tone: "success" | "warning" | "danger" }> = {
  PENDING: { label: "Đang chờ phản hồi", tone: "warning" },
  ACCEPTED: { label: "Đã chấp nhận hướng dẫn", tone: "success" },
  REJECTED: { label: "Đã từ chối", tone: "danger" },
};

export default function GVHDStatusPage() {
  const [req, setReq] = useState<SupervisorRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMySupervisorRequest()
      .then(setReq)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <div className="mx-auto max-w-[700px]">
        <h1 className="text-2xl font-extrabold text-gray-900">Giảng viên hướng dẫn</h1>
        <p className="mt-1 text-sm text-gray-500">
          Áp dụng cho bậc Tiến sĩ — theo dõi trạng thái yêu cầu đăng ký GVHD.
        </p>

        {loading ? (
          <div className="mt-6 h-40 animate-pulse rounded-card bg-gray-100" />
        ) : req ? (
          <Card className="mt-6 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-navy-50 text-xl font-extrabold text-navy-800">
                  {req.lecturerName
                    .split(" ")
                    .slice(-2)
                    .map((s) => s[0])
                    .join("")}
                </div>
                <div>
                  <p className="text-base font-bold text-gray-900">{req.lecturerName}</p>
                  <p className="text-sm text-gray-500">{req.facultyName}</p>
                </div>
              </div>
              <Badge tone={statusMeta[req.status].tone}>{statusMeta[req.status].label}</Badge>
            </div>

            <div className="mt-5 border-t border-gray-100 pt-4 text-sm text-gray-500">
              Ngày gửi yêu cầu: {new Date(req.requestedAt).toLocaleDateString("vi-VN")}
            </div>

            {req.status === "PENDING" && (
              <div className="mt-4 rounded-input bg-info-50 px-4 py-3 text-[13px] font-medium text-info">
                Yêu cầu của bạn đang chờ giảng viên hướng dẫn phản hồi. Bạn sẽ nhận được thông báo
                ngay khi có kết quả.
              </div>
            )}
            {req.status === "REJECTED" && (
              <div className="mt-4 rounded-input bg-danger-50 px-4 py-3 text-[13px] font-medium text-danger">
                Giảng viên đã từ chối yêu cầu hướng dẫn này. Vui lòng liên hệ Phòng Đào tạo Sau đại
                học để được hỗ trợ chọn GVHD khác.
              </div>
            )}
          </Card>
        ) : (
          <Card className="mt-6 p-8 text-center text-sm text-gray-500">
            Bạn chưa gửi yêu cầu đăng ký giảng viên hướng dẫn nào.
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
