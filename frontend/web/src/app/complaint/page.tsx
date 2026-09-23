"use client";

import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { submitComplaint } from "@/lib/api";

const complaintTypes = [
  { value: "PHUC_KHAO_DIEM", label: "Phúc khảo điểm" },
  { value: "KHIEU_NAI_KET_QUA", label: "Khiếu nại kết quả xét tuyển" },
  { value: "KHIEU_NAI_HO_SO", label: "Khiếu nại xử lý hồ sơ" },
  { value: "KHAC", label: "Khác" },
];

export default function ComplaintPage() {
  const [type, setType] = useState(complaintTypes[0].value);
  const [applicationCode, setApplicationCode] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await submitComplaint({ type, applicationCode, content });
      setDone(true);
    } catch (err: any) {
      setError(err?.message ?? "Gửi yêu cầu thất bại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[700px]">
        <h1 className="text-2xl font-extrabold text-gray-900">Khiếu nại / Phúc khảo</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gửi yêu cầu phúc khảo điểm hoặc khiếu nại liên quan đến quá trình xét tuyển.
        </p>

        <Card className="mt-6 p-6">
          {done ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-50 text-3xl text-success">
                ✓
              </div>
              <p className="mt-4 text-base font-bold text-gray-900">Đã gửi yêu cầu thành công</p>
              <p className="mt-1 text-sm text-gray-500">
                Chúng tôi sẽ phản hồi qua email trong vòng 5-7 ngày làm việc.
              </p>
              <Button className="mt-6" onClick={() => setDone(false)} variant="outline">
                Gửi yêu cầu khác
              </Button>
            </div>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-input bg-danger-50 px-4 py-3 text-[13px] font-medium text-danger">
                  {error}
                </div>
              )}
              <Select label="Loại yêu cầu" required value={type} onChange={(e) => setType(e.target.value)}>
                {complaintTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
              <Input
                label="Mã hồ sơ"
                required
                placeholder="HS2027-00458"
                value={applicationCode}
                onChange={(e) => setApplicationCode(e.target.value)}
              />
              <Textarea
                label="Nội dung"
                required
                placeholder="Mô tả chi tiết nội dung khiếu nại / phúc khảo..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <Button type="submit" loading={loading} className="mt-2 self-start">
                Gửi yêu cầu
              </Button>
            </form>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
