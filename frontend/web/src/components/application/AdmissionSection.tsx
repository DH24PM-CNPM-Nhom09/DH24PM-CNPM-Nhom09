"use client";

import { useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Alert, errMsg } from "@/components/auth/AuthBits";
import VietQrCode from "@/components/payment/VietQrCode";
import { confirmEnrollment, declineEnrollment, fileScoreAppeal } from "@/lib/api";
import { fmtDateTime, timeLeft } from "@/lib/announcements";
import { fmtMoney } from "@/lib/application";
import type { AdmissionView, FullApplication } from "@/lib/types";

const num = (n: number | null | undefined) => (n === null || n === undefined ? "—" : String(Math.round(n * 100) / 100).replace(".", ","));
const APPEAL_STATUS = { PENDING: "Đang phúc khảo", RESOLVED_CHANGED: "Đã điều chỉnh", RESOLVED_UNCHANGED: "Giữ nguyên" } as const;

/**
 * Giai đoạn sau khi hồ sơ "Đạt" thẩm định: lịch phỏng vấn / trình bày đề cương → điểm & phúc khảo
 * → kết quả xét tuyển → quyết định trúng tuyển & xác nhận nhập học.
 */
export default function AdmissionSection({ app, onChange }: { app: FullApplication; onChange: () => Promise<unknown> }) {
  const a = app.admission;
  if (!a) return null;
  return (
    <>
      {a.enrollment && <EnrollmentCard app={app} e={a.enrollment} onChange={onChange} />}
      {a.result && <ResultCard r={a.result} app={app} />}
      {a.scores && <ScoresCard app={app} s={a.scores} onChange={onChange} />}
      {a.hasInterview && a.interview && !a.scores && <InterviewCard a={a} />}
    </>
  );
}

function InterviewCard({ a }: { a: AdmissionView }) {
  const iv = a.interview!;
  const upcoming = new Date(iv.scheduledAt).getTime() > Date.now();
  return (
    <Card className="mt-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-base font-bold text-gray-900">Lịch {a.interviewLabel.toLowerCase()}</h2>
        <Badge tone={upcoming ? "info" : "gray"}>{upcoming ? `Còn ${timeLeft(iv.scheduledAt)}` : "Đã diễn ra"}</Badge>
      </div>
      <dl className="mt-4 grid gap-3 rounded-input bg-gray-50 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-gray-400">Thời gian</dt>
          <dd className="mt-0.5 font-semibold text-gray-900">{fmtDateTime(iv.scheduledAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-400">Địa điểm / đường dẫn</dt>
          <dd className="mt-0.5 font-semibold text-gray-900 [overflow-wrap:anywhere]">{iv.location}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-gray-400">Tiểu ban</dt>
          <dd className="mt-0.5 font-semibold text-gray-900">{iv.committeeName}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-gray-500">
        Có mặt trước giờ hẹn 15 phút, mang theo CCCD bản gốc{a.interviewLabel.startsWith("Trình bày") ? " và bản in đề cương nghiên cứu" : ""}. Vắng mặt không có lý do chính đáng sẽ không được xét tuyển.
      </p>
    </Card>
  );
}

function ScoresCard({ app, s, onChange }: { app: FullApplication; s: NonNullable<AdmissionView["scores"]>; onChange: () => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const bank = app.payment?.bank;
  const hasBank = Boolean(bank?.bankBin && bank.accountNo && bank.accountName);
  const ap = s.appeal;

  async function send() {
    setBusy(true);
    setErr("");
    try {
      await fileScoreAppeal(picked, reason.trim());
      setDone(true);
      setOpen(false);
      await onChange();
    } catch (e) {
      setErr(errMsg(e, "Không gửi được đơn, vui lòng thử lại."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-base font-bold text-gray-900">Điểm xét tuyển</h2>
        <span className="text-xs text-gray-500">Công bố {fmtDateTime(s.publishedAt)}</span>
      </div>
      <div className="mt-4 overflow-hidden rounded-input border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500">
            <tr>
              <th className="px-4 py-2.5">Hình thức</th>
              <th className="px-4 py-2.5 text-right">Hệ số</th>
              <th className="px-4 py-2.5 text-right">Điểm</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {s.items.map((i) => (
              <tr key={i.subjectId}>
                <td className="px-4 py-2.5 text-gray-800">
                  {i.subjectName}
                  {i.appeal && (
                    <span className="mt-0.5 block text-xs text-gray-500">
                      Phúc khảo: {APPEAL_STATUS[i.appeal.status]}
                      {i.appeal.status === "RESOLVED_CHANGED" && ` (${num(i.appeal.oldScore)} → ${num(i.appeal.newScore)})`}
                      {i.appeal.note && i.appeal.status !== "PENDING" ? ` — ${i.appeal.note}` : ""}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{i.weight}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">{i.absent ? <span className="text-danger">Vắng</span> : num(i.score)}</td>
              </tr>
            ))}
            <tr className="bg-gray-50">
              <td className="px-4 py-2.5 font-bold text-gray-900" colSpan={2}>
                Tổng điểm (thang 10)
              </td>
              <td className="px-4 py-2.5 text-right text-lg font-extrabold tabular-nums text-gray-900">{num(s.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {done && (
        <div className="mt-4">
          <Alert tone="success">Đã gửi đơn phúc khảo. {s.appealFee > 0 ? "Vui lòng nộp lệ phí theo hướng dẫn bên dưới." : ""}</Alert>
        </div>
      )}

      {ap ? (
        <div className="mt-4 rounded-input border border-gray-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-gray-900">Đơn phúc khảo của bạn</p>
            <Badge tone={ap.status === "DA_NOP_PHI" ? "info" : ap.status === "DONG" ? "gray" : "warning"}>
              {ap.status === "DA_NOP_PHI" ? "Đã nộp lệ phí — hội đồng đang xem xét" : ap.status === "DONG" ? "Không được xem xét" : "Chờ nộp lệ phí"}
            </Badge>
          </div>
          <p className="mt-1 text-[13px] italic text-gray-600">“{ap.reason}”</p>
          {ap.status === "CHO_NOP_PHI" && (
            <div className="mt-3 flex flex-col gap-4 rounded-input bg-gray-50 p-4 sm:flex-row sm:items-start">
              {hasBank && bank && (
                <VietQrCode bin={bank.bankBin!} accountNo={bank.accountNo} amount={ap.feeAmount} note={ap.transferContent} size={170} fileName={`ma-qr-phuc-khao-${ap.transferContent}`} caption={`${fmtMoney(ap.feeAmount)} - ${ap.transferContent}`} />
              )}
              <div className="text-sm text-gray-700">
                <p>
                  Lệ phí phúc khảo: <b>{fmtMoney(ap.feeAmount)}</b>
                </p>
                {hasBank && bank ? (
                  <p className="mt-1">
                    Chuyển khoản tới {bank.bankName}, số tài khoản <span className="font-mono font-semibold">{bank.accountNo}</span> ({bank.accountName}), nội dung{" "}
                    <span className="font-mono font-semibold">{ap.transferContent}</span>.
                  </p>
                ) : (
                  <p className="mt-1">Nộp trực tiếp tại Phòng Đào tạo Sau đại học, báo nội dung {ap.transferContent}.</p>
                )}
                <p className="mt-2 text-xs text-gray-500">Đơn chỉ được hội đồng xem xét sau khi Phòng Đào tạo xác nhận đã nhận lệ phí. Không nộp lệ phí trước hạn phúc khảo thì đơn không được xem xét.</p>
              </div>
            </div>
          )}
        </div>
      ) : s.canAppeal ? (
        <div className="mt-4">
          {!open ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] text-gray-600">
                Chưa đồng ý với điểm? Nộp đơn phúc khảo trước <b>{fmtDateTime(s.appealDeadline)}</b> (lệ phí {fmtMoney(s.appealFee)}/hồ sơ).
              </p>
              <Button variant="outline" onClick={() => setOpen(true)}>
                Nộp đơn phúc khảo
              </Button>
            </div>
          ) : (
            <div className="rounded-input border border-gray-200 p-4">
              <p className="text-sm font-bold text-gray-900">Đơn phúc khảo</p>
              <fieldset className="mt-3">
                <legend className="text-[13px] font-semibold text-gray-700">Phần điểm cần phúc khảo</legend>
                <div className="mt-2 space-y-2">
                  {s.items
                    .filter((i) => i.score !== null && !i.absent)
                    .map((i) => (
                      <label key={i.subjectId} className="flex items-center gap-2.5 text-sm text-gray-800">
                        <input type="checkbox" className="h-4 w-4 accent-[#E8734A]" checked={picked.includes(i.subjectId)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, i.subjectId] : p.filter((x) => x !== i.subjectId)))} />
                        {i.subjectName} ({num(i.score)} điểm)
                      </label>
                    ))}
                </div>
              </fieldset>
              <label htmlFor="appeal-reason" className="mt-4 block text-[13px] font-semibold text-gray-700">
                Lý do
              </label>
              <textarea id="appeal-reason" rows={4} maxLength={2000} className="mt-1 w-full rounded-input border border-gray-300 px-3 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Trình bày cụ thể phần bạn cho rằng chưa được đánh giá đúng (ít nhất 20 ký tự)." />
              {err && (
                <div className="mt-3">
                  <Alert tone="error">{err}</Alert>
                </div>
              )}
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Hủy
                </Button>
                <Button loading={busy} disabled={!picked.length || reason.trim().length < 20} onClick={send}>
                  Gửi đơn ({fmtMoney(s.appealFee)})
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        s.appealDeadline &&
        !app.admission?.result && <p className="mt-3 text-xs text-gray-500">Đã hết hạn phúc khảo ({fmtDateTime(s.appealDeadline)}). Kết quả trúng tuyển sẽ được công bố sau khi Hội đồng tuyển sinh xét duyệt.</p>
      )}
    </Card>
  );
}

function ResultCard({ r, app }: { r: NonNullable<AdmissionView["result"]>; app: FullApplication }) {
  const admitted = r.result === "TRUNG_TUYEN";
  const wait = r.result === "DU_BI";
  return (
    <Card className={`mt-5 p-5 sm:p-6 ${admitted ? "border-[#BFE3CB] bg-[#F5FBF7]" : wait ? "border-[#F0D3A6]" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Kết quả xét tuyển</p>
          <p className={`mt-1 text-2xl font-extrabold ${admitted ? "text-[#166534]" : wait ? "text-[#92400E]" : "text-gray-800"}`}>
            {admitted ? (r.promoted ? "Trúng tuyển (gọi từ danh sách dự bị)" : "Trúng tuyển") : wait ? `Dự bị — thứ tự ${r.waitlistRank ?? ""}` : "Không trúng tuyển"}
          </p>
        </div>
        <span className="text-xs text-gray-500">Công bố {fmtDateTime(r.publishedAt)}</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-gray-400">Ngành</dt>
          <dd className="mt-0.5 font-semibold text-gray-900">{app.major.majorName}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-400">Tổng điểm</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-gray-900">{num(r.total)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-400">Điểm chuẩn</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-gray-900">{num(r.benchmark)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-400">Xếp hạng / chỉ tiêu</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-gray-900">
            {r.rank ?? "—"} / {r.quota}
          </dd>
        </div>
      </dl>
      {admitted && !app.admission?.enrollment && <p className="mt-3 text-sm text-gray-700">Quyết định công nhận trúng tuyển và hướng dẫn xác nhận nhập học sẽ được gửi trên cổng này và qua email.</p>}
      {wait && <p className="mt-3 text-sm text-gray-700">Nếu có thí sinh trúng tuyển không nhập học, Nhà trường sẽ gọi bổ sung theo thứ tự dự bị và báo cho bạn qua cổng, email.</p>}
    </Card>
  );
}

function EnrollmentCard({ app, e, onChange }: { app: FullApplication; e: NonNullable<AdmissionView["enrollment"]>; onChange: () => Promise<unknown> }) {
  const [busy, setBusy] = useState<"confirm" | "decline" | null>(null);
  const [err, setErr] = useState("");
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");

  async function run(kind: "confirm" | "decline") {
    setBusy(kind);
    setErr("");
    try {
      if (kind === "confirm") await confirmEnrollment();
      else await declineEnrollment(reason.trim());
      setDeclining(false);
      await onChange();
    } catch (x) {
      setErr(errMsg(x, "Không thực hiện được, vui lòng thử lại."));
    } finally {
      setBusy(null);
    }
  }

  const done = !!e.studentCode;
  const declined = e.status === "TU_CHOI_QUA_HAN";
  return (
    <Card className={`mt-5 p-5 sm:p-6 ${done ? "border-[#BFE3CB]" : declined ? "" : "border-accent/40"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-base font-bold text-gray-900">Quyết định trúng tuyển &amp; nhập học</h2>
        <Badge tone={done ? "success" : declined ? "gray" : e.status === "DA_XAC_NHAN" ? "info" : "warning"}>
          {done ? "Đã nhập học" : declined ? "Không nhập học" : e.status === "DA_XAC_NHAN" ? "Đã xác nhận nhập học" : "Chờ bạn xác nhận"}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-gray-700">
        Quyết định số <b>{e.decisionNo}</b> ngày {e.decisionDate ? e.decisionDate.split("-").reverse().join("/") : ""} công nhận bạn trúng tuyển ngành {app.major.majorName}.
      </p>
      {!declined && (
        <Link href="/application/admission-letter" target="_blank" className="mt-2 inline-block text-[13px] font-semibold text-accent hover:underline">
          In giấy báo trúng tuyển →
        </Link>
      )}

      {e.status === "CHUA_XAC_NHAN" && (
        <div className="mt-4 rounded-input bg-accent-50 p-4">
          {e.canConfirm ? (
            <>
              <p className="text-sm text-gray-800">
                Vui lòng xác nhận nhập học trước <b>{fmtDateTime(e.deadline)}</b> (còn {timeLeft(e.deadline)}). Quá hạn không xác nhận được xem như từ chối nhập học.
              </p>
              {!declining ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button loading={busy === "confirm"} onClick={() => run("confirm")}>
                    Xác nhận nhập học
                  </Button>
                  <Button variant="ghost" onClick={() => setDeclining(true)}>
                    Tôi không nhập học
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-danger">Đã quá hạn xác nhận nhập học ({fmtDateTime(e.deadline)}). Liên hệ Phòng Đào tạo Sau đại học nếu có lý do chính đáng.</p>
          )}
        </div>
      )}

      {e.status === "DA_XAC_NHAN" && !done && (
        <div className="mt-4 rounded-input bg-gray-50 p-4 text-sm text-gray-700">
          <p>
            Bạn đã xác nhận nhập học lúc {fmtDateTime(e.confirmedAt)}. <b>Bước tiếp theo:</b> nộp bản chính (hoặc bản sao chứng thực) văn bằng, bảng điểm, chứng chỉ đã khai trực tuyến tại Phòng Đào tạo Sau đại học để đối chiếu.
          </p>
          <p className="mt-2">
            Bản chính:{" "}
            <b className={e.originals === "VERIFIED" ? "text-[#166534]" : e.originals === "MISSING" ? "text-danger" : "text-gray-900"}>
              {e.originals === "VERIFIED" ? "đã đối chiếu xong — chờ Nhà trường hoàn tất thủ tục" : e.originals === "MISSING" ? "còn thiếu, xem thông báo để nộp bổ sung" : "chưa nộp"}
            </b>
          </p>
          {e.canDecline && !declining && (
            <button type="button" className="mt-3 text-[13px] font-semibold text-gray-500 underline hover:text-gray-700" onClick={() => setDeclining(true)}>
              Tôi muốn thôi, không nhập học
            </button>
          )}
        </div>
      )}

      {declining && (
        <div className="mt-4 rounded-input border border-[#F3C9C9] p-4">
          <p className="text-sm font-bold text-danger">Từ chối nhập học</p>
          <p className="mt-1 text-[13px] text-gray-600">Sau khi từ chối, chỗ của bạn được chuyển cho thí sinh dự bị và không thể hoàn tác.</p>
          <label htmlFor="decline-reason" className="mt-3 block text-[13px] font-semibold text-gray-700">
            Lý do
          </label>
          <textarea id="decline-reason" rows={2} maxLength={500} className="mt-1 w-full rounded-input border border-gray-300 px-3 py-2 text-sm" value={reason} onChange={(x) => setReason(x.target.value)} />
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeclining(false)}>
              Quay lại
            </Button>
            <Button variant="secondary" loading={busy === "decline"} disabled={reason.trim().length < 5} onClick={() => run("decline")}>
              Xác nhận không nhập học
            </Button>
          </div>
        </div>
      )}

      {done && (
        <div className="mt-4 rounded-input bg-[#F5FBF7] p-4 text-sm text-gray-800">
          Bạn đã hoàn tất thủ tục nhập học{e.completedAt ? ` ngày ${fmtDateTime(e.completedAt)}` : ""}. Mã học viên: <span className="font-mono text-base font-bold">{e.studentCode}</span>
        </div>
      )}
      {declined && (
        <p className="mt-3 text-sm text-gray-600">
          Bạn đã từ chối nhập học (hoặc quá hạn xác nhận). Cảm ơn bạn đã quan tâm tuyển sinh sau đại học của Trường. Bạn vẫn có thể{" "}
          <Link href="/application/new" className="font-semibold text-accent hover:underline">
            đăng ký đợt tuyển sinh khác
          </Link>
          .
        </p>
      )}
      {err && (
        <div className="mt-3">
          <Alert tone="error">{err}</Alert>
        </div>
      )}
    </Card>
  );
}
