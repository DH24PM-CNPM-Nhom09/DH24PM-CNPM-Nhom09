"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Alert, errMsg } from "@/components/auth/AuthBits";
import { getLecturers, getMySupervisors, requestSupervisor } from "@/lib/api";
import { fmtDate } from "@/lib/announcements";
import type { Lecturer, SupervisorOverview, SupervisorRequestItem } from "@/lib/types";

const STATUS: Record<SupervisorRequestItem["status"], { label: string; tone: "success" | "warning" | "danger" }> = {
  PENDING: { label: "Chờ giảng viên phản hồi", tone: "warning" },
  ACCEPTED: { label: "Đồng ý hướng dẫn", tone: "success" },
  REJECTED: { label: "Chưa nhận hướng dẫn", tone: "danger" },
};

function initials(name: string) {
  const parts = name.replace(/^(GS|PGS)?\.?\s*(TS|ThS)?\.?\s*/i, "").trim().split(/\s+/);
  return parts
    .slice(-2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}

export default function SupervisorPage() {
  const [data, setData] = useState<SupervisorOverview | null>(null);
  const [error, setError] = useState("");
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [pick, setPick] = useState("");
  const [q, setQ] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    getMySupervisors()
      .then((d) => {
        setData(d);
        if (d.state === "DOCTORAL" && d.canRequest) getLecturers().then(setLecturers).catch(() => undefined);
      })
      .catch((e) => setError(errMsg(e, "Không tải được thông tin giảng viên hướng dẫn.")));
  }, []);

  const asked = useMemo(() => new Set(data?.state === "DOCTORAL" ? data.requests.map((r) => r.lecturerId) : []), [data]);
  const shown = lecturers.filter((l) => !asked.has(l.lecturerId) && (!q.trim() || `${l.fullName} ${l.facultyName ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())));

  async function send() {
    if (!pick) return setSendError("Chọn một giảng viên.");
    setSending(true);
    setSendError("");
    try {
      setData(await requestSupervisor(Number(pick)));
      setPick("");
      setSent(true);
    } catch (e) {
      setSendError(errMsg(e, "Không gửi được đề nghị, vui lòng thử lại."));
    } finally {
      setSending(false);
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[760px]">
        <h1 className="text-2xl font-extrabold text-gray-900">Giảng viên hướng dẫn</h1>
        <p className="mt-1 text-sm text-gray-500">Nghiên cứu sinh (bậc tiến sĩ) đề nghị giảng viên hướng dẫn và theo dõi phản hồi tại đây.</p>

        {error ? (
          <Card className="mt-6 p-6 text-sm font-medium text-danger">{error}</Card>
        ) : !data ? (
          <div className="mt-6 h-40 animate-pulse rounded-card bg-gray-100" />
        ) : data.state === "NO_APPLICATION" ? (
          <Card className="mt-6 p-8 text-center">
            <p className="text-sm text-gray-600">Bạn chưa có hồ sơ xét tuyển. Nếu dự tuyển tiến sĩ, bạn chọn giảng viên hướng dẫn ở bước “Đề tài nghiên cứu” khi tạo hồ sơ.</p>
            <Link href="/application/new" className="mt-4 inline-block">
              <Button>Tạo hồ sơ xét tuyển</Button>
            </Link>
          </Card>
        ) : data.state === "MASTER" ? (
          <Card className="mt-6 p-6">
            <p className="text-base font-bold text-gray-900">Bậc thạc sĩ không đăng ký giảng viên hướng dẫn khi dự tuyển</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Hồ sơ <span className="font-mono font-semibold">{data.applicationCode}</span> của bạn dự tuyển thạc sĩ ngành {data.majorName}. Giảng viên hướng dẫn luận văn thạc sĩ do Khoa phân công
              trong quá trình học, sau khi bạn trúng tuyển và nhập học. Bạn chưa cần làm gì ở mục này.
            </p>
          </Card>
        ) : data.state === "DRAFT" ? (
          <Card className="mt-6 p-6">
            <p className="text-base font-bold text-gray-900">Hồ sơ tiến sĩ chưa nộp</p>
            <p className="mt-2 text-sm text-gray-600">Chọn giảng viên hướng dẫn dự kiến ở bước “Đề tài nghiên cứu”. Đề nghị được gửi tới giảng viên khi bạn nộp hồ sơ.</p>
            <Link href="/application/new" className="mt-4 inline-block">
              <Button>Tiếp tục hoàn thiện hồ sơ</Button>
            </Link>
          </Card>
        ) : (
          <>
            {sent && (
              <div className="mt-5">
                <Alert tone="success">Đã gửi đề nghị. Phòng Đào tạo Sau đại học sẽ ghi nhận phản hồi của giảng viên; bạn nhận thông báo qua cổng và email.</Alert>
              </div>
            )}

            <Card className="mt-5 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Đề tài nghiên cứu</p>
              <p className="mt-1 text-base font-bold text-gray-900">{data.researchTopic ?? "—"}</p>
              <p className="mt-1 text-sm text-gray-500">
                {data.researchField ? `${data.researchField} · ` : ""}
                {data.majorName} · hồ sơ <span className="font-mono">{data.applicationCode}</span>
              </p>
            </Card>

            {data.requests.length === 0 ? (
              <Card className="mt-4 p-6 text-sm text-gray-600">Bạn chưa đề nghị giảng viên hướng dẫn nào.</Card>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {data.requests.map((r, i) => (
                  <Card key={r.requestId} className={`p-5 ${i > 0 ? "opacity-80" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy-50 text-base font-extrabold text-navy-800">{initials(r.lecturerName)}</div>
                        <div>
                          <p className="font-bold text-gray-900">{r.lecturerName}</p>
                          <p className="text-sm text-gray-500">{r.facultyName}</p>
                        </div>
                      </div>
                      <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                    </div>
                    <p className="mt-3 text-xs text-gray-500">
                      Gửi đề nghị {fmtDate(r.requestedAt)}
                      {r.respondedAt && ` · phản hồi ${fmtDate(r.respondedAt)}`}
                    </p>
                    {r.responseNote && <p className="mt-2 whitespace-pre-line rounded-input bg-gray-50 px-3 py-2 text-sm text-gray-700">{r.responseNote}</p>}
                    {r.status === "PENDING" && (
                      <p className="mt-3 rounded-input bg-info-50 px-3 py-2 text-[13px] text-[#1D4ED8]">
                        Phòng Đào tạo Sau đại học đang liên hệ giảng viên để lấy xác nhận đồng ý hướng dẫn. Bạn sẽ nhận thông báo khi có kết quả.
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {data.canRequest && (
              <Card className="mt-5 p-5 sm:p-6">
                <h2 className="text-base font-bold text-gray-900">{data.requests.length ? "Chọn giảng viên khác" : "Đề nghị giảng viên hướng dẫn"}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Nên trao đổi trước với giảng viên về đề tài. Bạn còn {data.remaining} lần đề nghị; quá số lần này, Phòng Đào tạo Sau đại học sẽ hỗ trợ phân công.
                </p>
                {sendError && (
                  <div className="mt-4">
                    <Alert tone="error">{sendError}</Alert>
                  </div>
                )}
                <input
                  className="mt-4 w-full rounded-input border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                  placeholder="Tìm theo tên giảng viên hoặc khoa"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Tìm giảng viên"
                />
                <div className="mt-3 flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
                  {shown.map((l) => (
                    <label key={l.lecturerId} className={`flex cursor-pointer items-center gap-3 rounded-input border-[1.5px] px-4 py-3 ${pick === String(l.lecturerId) ? "border-accent bg-accent-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <input type="radio" name="lecturer" className="h-4 w-4 accent-[#E8734A]" checked={pick === String(l.lecturerId)} onChange={() => setPick(String(l.lecturerId))} />
                      <span>
                        <span className="block text-sm font-semibold text-gray-900">{l.fullName}</span>
                        <span className="block text-xs text-gray-500">{l.facultyName}</span>
                      </span>
                    </label>
                  ))}
                  {shown.length === 0 && <p className="py-4 text-center text-sm text-gray-400">Không có giảng viên phù hợp.</p>}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button loading={sending} disabled={!pick} onClick={send}>
                    Gửi đề nghị hướng dẫn
                  </Button>
                </div>
              </Card>
            )}

            {!data.canRequest && data.requests.some((r) => r.status === "REJECTED") && !data.requests.some((r) => r.status !== "REJECTED") && (
              <Card className="mt-5 p-5 text-sm text-gray-600">Bạn đã dùng hết số lần đề nghị. Vui lòng liên hệ Phòng Đào tạo Sau đại học để được hỗ trợ phân công giảng viên hướng dẫn.</Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
