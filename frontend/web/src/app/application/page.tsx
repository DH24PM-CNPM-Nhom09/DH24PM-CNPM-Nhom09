"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Badge, { reviewStatusLabel, reviewStatusTone } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Input";
import { getMyApplication, getMyDocuments, uploadDocument } from "@/lib/api";
import type { Application, ApplicationDocument, DocumentType } from "@/lib/types";

const docTypeLabel: Record<DocumentType, string> = {
  VAN_BANG: "Văn bằng",
  BANG_DIEM: "Bảng điểm",
  CHUNG_CHI_NGOAI_NGU: "Chứng chỉ ngoại ngữ",
  DE_CUONG_NCS: "Đề cương nghiên cứu sinh",
  THU_GIOI_THIEU: "Thư giới thiệu",
  CONG_BO_KHOA_HOC: "Công bố khoa học",
  KHAC: "Khác",
};

const verifyLabel: Record<ApplicationDocument["verifyStatus"], { text: string; tone: "success" | "warning" | "gray" }> = {
  VALID: { text: "Hợp lệ", tone: "success" },
  PENDING: { text: "Đang kiểm tra", tone: "warning" },
  INVALID: { text: "Không hợp lệ", tone: "gray" },
};

export default function ApplicationStatusPage() {
  const [app, setApp] = useState<Application | null>(null);
  const [docs, setDocs] = useState<ApplicationDocument[]>([]);
  const [docType, setDocType] = useState<DocumentType>("VAN_BANG");
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getMyApplication().then(setApp);
    getMyDocuments().then(setDocs);
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !app) return;
    setUploadError("");
    setUploading(true);
    try {
      await uploadDocument(app.applicationId, file, docType);
      const fresh = await getMyDocuments();
      setDocs(fresh);
    } catch (err: any) {
      setUploadError(err?.message ?? "Tải file thất bại.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[900px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Hồ sơ xét tuyển</h1>
            <p className="mt-1 text-sm text-gray-500">
              {app?.applicationCode ? `Mã hồ sơ: ${app.applicationCode}` : "Đang tải..."}
            </p>
          </div>
          {app && (
            <Badge tone={reviewStatusTone(app.reviewStatus)}>{reviewStatusLabel[app.reviewStatus]}</Badge>
          )}
        </div>

        {app?.reviewStatus === "NEEDS_SUPPLEMENT" && (
          <div className="mt-4 rounded-input bg-warning-50 px-4 py-3 text-[13px] font-medium text-warning">
            Hồ sơ cần bổ sung thêm giấy tờ. Vui lòng tải lên các tài liệu còn thiếu bên dưới. Giới
            hạn dung lượng: tối đa 5MB/file, tổng tối đa 30MB/hồ sơ.
          </div>
        )}

        <Card className="mt-6 p-6">
          <h2 className="text-base font-bold text-gray-900">Tài liệu đã nộp</h2>
          <div className="mt-4 flex flex-col gap-3">
            {docs.map((d) => (
              <div
                key={d.documentId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-input border border-gray-200 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{d.fileName}</p>
                  <p className="text-xs text-gray-500">
                    {docTypeLabel[d.documentType]} · {(d.fileSizeKb / 1024).toFixed(1)} MB
                  </p>
                </div>
                <Badge tone={verifyLabel[d.verifyStatus].tone}>{verifyLabel[d.verifyStatus].text}</Badge>
              </div>
            ))}
            {docs.length === 0 && (
              <p className="text-sm text-gray-400">Chưa có tài liệu nào được tải lên.</p>
            )}
          </div>

          <div className="mt-6 border-t border-gray-100 pt-5">
            <h3 className="text-sm font-bold text-gray-900">Tải lên tài liệu mới</h3>
            {uploadError && (
              <div className="mt-3 rounded-input bg-danger-50 px-4 py-3 text-[13px] font-medium text-danger">
                {uploadError}
              </div>
            )}
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full sm:w-64">
                <Select
                  label="Loại tài liệu"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as DocumentType)}
                >
                  {Object.entries(docTypeLabel).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-input border-[1.5px] border-accent bg-white px-7 py-[15px] text-[15px] font-bold text-accent transition-colors hover:bg-accent-50">
                {uploading && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
                )}
                Chọn file
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                  disabled={uploading}
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-gray-400">Định dạng PDF/JPG/PNG, tối đa 5MB mỗi file.</p>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
