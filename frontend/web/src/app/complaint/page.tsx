"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { errMsg } from "@/components/auth/AuthBits";
import { getMyComplaints, getMyFullApplication, submitComplaint, type MyComplaint } from "@/lib/api";
import { fmtDateTime } from "@/lib/announcements";

const complaintTypes = [
  { value: "KHIEU_NAI_KET_QUA", label: "Khiếu nại kết quả xét tuyển" },
  { value: "KHIEU_NAI_HO_SO", label: "Khiếu nại xử lý hồ sơ" },
  { value: "PHUC_KHAO_DIEM", label: "Phúc khảo kết quả thi đánh giá năng lực tiếng Anh" },
  { value: "KHAC", label: "Khác" },
];
const STATUS = {
  PENDING: { label: "Đã gửi", tone: "warning" as const },
  IN_PROGRESS: { label: "Đang xử lý", tone: "info" as const },
  RESOLVED: { label: "Đã giải quyết", tone: "success" as const },
  REJECTED: { label: "Không chấp nhận", tone: "gray" as const },
};

export default function ComplaintPage() {
  const [type, setType] = useState(complaintTypes[0].value);
  const [applicationCode, setApplicationCode] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [mine, setMine] = useState<MyComplaint[] | null>(null);

  const loadMine = useCallback(() => getMyComplaints().then(setMine).catch(() => setMine([])), []);
  useEffect(() => {
    loadMine();
    // Điền sẵn mã hồ sơ hiện tại của thí sinh
    getMyFullApplication()
      .then((a) => a && a.reviewStatus !== "DRAFT" && setApplicationCode((c) => c || a.applicationCode))
      .catch(() => undefined);
  }, [loadMine]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await submitComplaint({ type, applicationCode: applicationCode.trim(), content: content.trim() });
      setDone(true);
      setContent("");
      await loadMine();
    } catch (err) {
      setError(errMsg(err, "Gửi yêu cầu thất bại."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[760px]">
        <h1 className="text-2xl font-extrabold text-gray-900">Khiếu nại / Phúc khảo</h1>
        <p className="mt-1 text-sm text-gray-500">Gửi khiếu nại về kết quả xét tuyển, quá trình xử lý hồ sơ hoặc kết quả thi đánh giá năng lực tiếng Anh. Câu trả lời được gửi qua cổng và email.</p>
        <div className="mt-4 rounded-input bg-info-50 px-4 py-3 text-[13px] text-[#1D4ED8]">
          Phúc khảo <b>điểm xét tuyển</b> (hồ sơ, phỏng vấn, trình bày đề cương) nộp tại trang{" "}
          <Link href="/application" className="font-semibold underline">
            Hồ sơ xét tuyển
          </Link>
          , mục “Điểm xét tuyển”, trong thời hạn phúc khảo sau khi công bố điểm.
        </div>

        <Card className="mt-5 p-6">
          {done ? (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-50 text-3xl text-success">✓</div>
              <p className="mt-4 text-base font-bold text-gray-900">Đã gửi yêu cầu</p>
              <p className="mt-1 text-sm text-gray-500">Theo dõi trạng thái và câu trả lời ở danh sách bên dưới.</p>
              <Button className="mt-6" onClick={() => setDone(false)} variant="outline">
                Gửi yêu cầu khác
              </Button>
            </div>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              {error && <div className="rounded-input bg-danger-50 px-4 py-3 text-[13px] font-medium text-danger">{error}</div>}
              <Select label="Loại yêu cầu" required value={type} onChange={(e) => setType(e.target.value)}>
                {complaintTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
              <Input label="Mã hồ sơ" placeholder="Ví dụ THS-2026-D2-8480101-00012" value={applicationCode} onChange={(e) => setApplicationCode(e.target.value)} />
              <Textarea label="Nội dung" required placeholder="Trình bày cụ thể sự việc, thời điểm và đề nghị của bạn (ít nhất 20 ký tự)." value={content} onChange={(e) => setContent(e.target.value)} />
              <Button type="submit" loading={loading} disabled={content.trim().length < 20} className="mt-2 self-start">
                Gửi yêu cầu
              </Button>
            </form>
          )}
        </Card>

        <h2 className="mt-8 text-lg font-bold text-gray-900">Yêu cầu đã gửi</h2>
        {mine === null ? (
          <div className="mt-3 h-24 animate-pulse rounded-card bg-gray-100" />
        ) : mine.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Bạn chưa gửi yêu cầu nào.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {mine.map((m) => (
              <li key={m.complaintId}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{m.typeLabel}</p>
                      <p className="text-xs text-gray-500">
                        Gửi {fmtDateTime(m.createdAt)}
                        {m.applicationCode ? ` · hồ sơ ${m.applicationCode}` : ""}
                      </p>
                    </div>
                    <Badge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{m.content}</p>
                  {m.response && (
                    <div className="mt-3 rounded-input bg-gray-50 p-3 text-sm text-gray-800">
                      <p className="text-xs font-semibold text-gray-500">Trả lời của Phòng Đào tạo Sau đại học · {fmtDateTime(m.resolvedAt)}</p>
                      <p className="mt-1 whitespace-pre-line">{m.response}</p>
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}
