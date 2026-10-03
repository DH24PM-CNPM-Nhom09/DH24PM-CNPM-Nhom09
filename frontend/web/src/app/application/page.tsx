"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import Badge, { admissionStatusLabel, admissionStatusTone, reviewStatusLabel, reviewStatusTone } from "@/components/ui/Badge";
import { Alert, errMsg } from "@/components/auth/AuthBits";
import DocSlot from "@/components/application/DocSlot";
import VietQrCode from "@/components/payment/VietQrCode";
import { getMyFullApplication, submitSupplement, uploadDocument } from "@/lib/api";
import { fmtDate, fmtDateTime, timeLeft } from "@/lib/announcements";
import { checkFile, DEGREE_LABEL, DOC_LABEL, EDU_LABEL, fmtMoney, fmtSize, HISTORY_LABEL, LANGUAGE_OPTION_TEXT, VERIFY_LABEL } from "@/lib/application";
import type { ApplicationDocument, DocumentType, FullApplication } from "@/lib/types";

const SUPERVISOR_LABEL = { PENDING: "Chờ giảng viên phản hồi", ACCEPTED: "Giảng viên đã nhận hướng dẫn", REJECTED: "Giảng viên từ chối" } as const;

function StatusInner() {
  const params = useSearchParams();
  const [app, setApp] = useState<FullApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [info, setInfo] = useState(params.get("submitted") ? "submitted" : "");
  const [uploading, setUploading] = useState<DocumentType | null>(null);
  const [docErrors, setDocErrors] = useState<Partial<Record<DocumentType, string>>>({});
  const [extraType, setExtraType] = useState<DocumentType>("KHAC");
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    return getMyFullApplication()
      .then((a) => {
        setApp(a);
        setError("");
      })
      .catch((e) => setError(errMsg(e, "Không tải được hồ sơ. Kiểm tra kết nối rồi thử lại.")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const invalidDocs = useMemo(() => app?.documents.filter((d) => d.verifyStatus === "INVALID") ?? [], [app]);

  async function reupload(type: DocumentType, file: File) {
    if (!app) return;
    setUploading(type);
    setDocErrors((d) => ({ ...d, [type]: undefined }));
    try {
      await uploadDocument(app.applicationId, file, type);
      await load();
    } catch (e) {
      setDocErrors((d) => ({ ...d, [type]: errMsg(e, "Tải tệp thất bại, vui lòng thử lại.") }));
    } finally {
      setUploading(null);
    }
  }

  async function finishSupplement() {
    setSending(true);
    setActionError("");
    try {
      await submitSupplement();
      setInfo("supplement");
      await load();
    } catch (e) {
      setActionError(errMsg(e, "Không gửi được, vui lòng thử lại."));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="mt-6 h-72 animate-pulse rounded-card bg-gray-100" />
      </Shell>
    );
  }
  if (error) {
    return (
      <Shell>
        <Card className="mt-6 p-6 text-sm font-medium text-danger">{error}</Card>
      </Shell>
    );
  }
  if (!app) {
    return (
      <Shell>
        <Card className="mt-6 p-8 text-center">
          <p className="text-base font-bold text-gray-900">Bạn chưa có hồ sơ xét tuyển</p>
          <p className="mt-2 text-sm text-gray-500">Chọn đợt tuyển sinh đang mở và nộp hồ sơ trực tuyến.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/announcements?tab=batches">
              <Button variant="outline">Xem các đợt đang mở</Button>
            </Link>
            <Link href="/application/new">
              <Button>Tạo hồ sơ xét tuyển</Button>
            </Link>
          </div>
        </Card>
      </Shell>
    );
  }

  if (app.reviewStatus === "DRAFT") {
    return (
      <Shell code={app.applicationCode} badges={<Badge tone="gray">Nháp, chưa nộp</Badge>}>
        <Card className="mt-6 p-6">
          <p className="text-base font-bold text-gray-900">Hồ sơ chưa được nộp</p>
          <p className="mt-1 text-sm text-gray-600">
            {app.major.majorName} · {app.batch.batchName}. Hạn nộp {fmtDateTime(app.batch.registrationEndAt)} ({timeLeft(app.batch.registrationEndAt)}).
          </p>
          {app.missingDocuments.length > 0 && <p className="mt-2 text-sm text-gray-600">Còn thiếu: {app.missingDocuments.map((t) => DOC_LABEL[t]).join(", ")}.</p>}
          <Link href="/application/new" className="mt-5 inline-block">
            <Button>Tiếp tục hoàn thiện hồ sơ</Button>
          </Link>
        </Card>
      </Shell>
    );
  }

  const paid = app.payment?.status === "SUCCESS";
  const lastReason = [...app.history].reverse().find((h) => h.status === app.reviewStatus)?.reason ?? null;
  const bank = app.payment?.bank;
  const hasBank = Boolean(bank?.bankName && bank.accountNo && bank.accountName);

  return (
    <Shell
      code={app.applicationCode}
      badges={
        <>
          <Badge tone={reviewStatusTone(app.reviewStatus)}>{reviewStatusLabel[app.reviewStatus]}</Badge>
          {app.admissionStatus !== "NONE" && <Badge tone={admissionStatusTone(app.admissionStatus)}>{admissionStatusLabel[app.admissionStatus]}</Badge>}
        </>
      }
    >
      {info === "submitted" && (
        <div className="mt-5">
          <Alert tone="success">
            Đã nộp hồ sơ thành công. Thông báo xác nhận đã được gửi về email của bạn.{!paid && " Bước tiếp theo: nộp lệ phí xét tuyển theo hướng dẫn bên dưới."}
          </Alert>
        </div>
      )}
      {info === "supplement" && (
        <div className="mt-5">
          <Alert tone="success">Đã gửi minh chứng bổ sung. Cán bộ sẽ tiếp tục thẩm định hồ sơ của bạn.</Alert>
        </div>
      )}

      <Progress app={app} />

      {/* Yêu cầu bổ sung */}
      {app.reviewStatus === "NEEDS_SUPPLEMENT" && (
        <Card className="mt-5 border-[#F0D3A6] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-base font-bold text-gray-900">Cán bộ yêu cầu bổ sung hồ sơ</h2>
            {app.supplement && (
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${new Date(app.supplement.deadline) < new Date() ? "bg-danger-50 text-danger" : "bg-warning-50 text-[#92400E]"}`}>
                Hạn {fmtDateTime(app.supplement.deadline)} · {timeLeft(app.supplement.deadline)}
              </span>
            )}
          </div>
          {app.supplement && <p className="mt-3 whitespace-pre-line rounded-input bg-gray-50 px-4 py-3 text-sm text-gray-700">{app.supplement.content}</p>}

          {invalidDocs.length > 0 && (
            <>
              <h3 className="mt-5 text-sm font-bold text-gray-900">Minh chứng cần nộp lại</h3>
              <div className="mt-3 flex flex-col gap-3">
                {Array.from(new Set(invalidDocs.map((d) => d.documentType))).map((t) => (
                  <DocSlot
                    key={t}
                    type={t}
                    required
                    docs={app.documents.filter((d) => d.documentType === t)}
                    showVerify
                    uploadLabel="Nộp lại tệp"
                    busy={uploading === t}
                    error={docErrors[t]}
                    onUpload={(f) => reupload(t, f)}
                    onError={(m) => setDocErrors((d) => ({ ...d, [t]: m }))}
                  />
                ))}
              </div>
            </>
          )}

          <div className="mt-5 flex flex-col gap-3 rounded-input bg-gray-50 p-3 sm:flex-row sm:items-end">
            <div className="sm:w-64">
              <Select label="Nộp thêm giấy tờ theo yêu cầu" value={extraType} onChange={(e) => setExtraType(e.target.value as DocumentType)}>
                {(Object.keys(DOC_LABEL) as DocumentType[]).map((t) => (
                  <option key={t} value={t}>
                    {DOC_LABEL[t]}
                  </option>
                ))}
              </Select>
            </div>
            <FilePicker busy={uploading === extraType} onPick={(f) => reupload(extraType, f)} onError={(m) => setDocErrors((d) => ({ ...d, [extraType]: m }))} />
          </div>
          {docErrors[extraType] && !invalidDocs.some((d) => d.documentType === extraType) && <p className="mt-2 text-xs font-medium text-danger">{docErrors[extraType]}</p>}

          {actionError && (
            <div className="mt-4">
              <Alert tone="error">{actionError}</Alert>
            </div>
          )}
          <div className="mt-5 flex flex-col items-start gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              {invalidDocs.length ? `Còn ${invalidDocs.length} minh chứng chưa nộp lại.` : "Đã nộp lại đủ minh chứng không hợp lệ."} Bấm gửi khi đã bổ sung xong.
            </p>
            <Button loading={sending} disabled={invalidDocs.length > 0 || uploading !== null} onClick={finishSupplement}>
              Gửi bổ sung
            </Button>
          </div>
        </Card>
      )}

      {/* Kết luận */}
      {app.reviewStatus === "REJECTED" && (
        <Card className="mt-5 border-[#F3C9C9] p-5">
          <p className="text-base font-bold text-danger">Hồ sơ không đạt thẩm định</p>
          {lastReason && <p className="mt-2 whitespace-pre-line text-sm text-gray-700">Lý do: {lastReason}</p>}
          <p className="mt-3 text-sm text-gray-600">
            Nếu chưa đồng ý với kết quả, bạn có thể{" "}
            <Link href="/complaint" className="font-semibold text-accent hover:underline">
              gửi khiếu nại
            </Link>
            .
          </p>
        </Card>
      )}
      {app.reviewStatus === "APPROVED" && (
        <Card className="mt-5 border-[#BFE3CB] p-5">
          <p className="text-base font-bold text-[#166534]">Hồ sơ đạt thẩm định</p>
          <p className="mt-2 text-sm text-gray-700">
            Bạn đủ điều kiện dự thi/xét tuyển{app.batch.examStartAt ? `, dự kiến từ ngày ${fmtDate(app.batch.examStartAt)}` : ""}. Lịch cụ thể sẽ được thông báo qua cổng và email.
          </p>
        </Card>
      )}

      {/* Lệ phí */}
      {app.payment && (
        <Card className="mt-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-base font-bold text-gray-900">Lệ phí dự tuyển</h2>
            <Badge tone={paid ? "success" : "warning"}>{paid ? "Đã nộp" : "Chờ nộp"}</Badge>
          </div>
          {paid ? (
            <p className="mt-3 text-sm text-gray-700">
              Đã nhận {fmtMoney(app.payment.amount)}
              {app.payment.paidAt && ` ngày ${fmtDate(app.payment.paidAt)}`}
              {app.payment.receiptNo && `, biên lai số ${app.payment.receiptNo}`}.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-gray-600">
                Số tiền: <span className="text-lg font-extrabold text-gray-900">{fmtMoney(app.payment.amount)}</span>
              </p>
              {app.feeItems.length > 1 && (
                <p className="mt-1 text-xs text-gray-500">Gồm: {app.feeItems.map((f) => `${f.label.replace(/^Lệ phí /, "")} ${fmtMoney(f.amount)}`).join(" + ")}</p>
              )}
              {hasBank && bank ? (
                <div className="mt-4 flex flex-col gap-5 rounded-input bg-gray-50 p-4 sm:flex-row sm:items-start">
                  {bank.bankBin && (
                    <div className="flex shrink-0 flex-col items-center gap-1 self-center sm:self-start">
                      <VietQrCode
                        bin={bank.bankBin}
                        accountNo={bank.accountNo}
                        amount={app.payment.amount}
                        note={app.payment.transferContent}
                        size={200}
                        fileName={`ma-qr-le-phi-${app.payment.transferContent}`}
                        caption={`${fmtMoney(app.payment.amount)} - ${app.payment.transferContent}`}
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {bank.bankBin && (
                      <p className="mb-3 text-[13px] text-gray-700">
                        <span className="font-semibold">Cách nhanh nhất:</span> mở app ngân hàng bất kỳ, chọn <span className="font-semibold">Quét QR</span> và quét mã QR này. Số tài khoản, số tiền và nội dung đã được điền sẵn. Dùng điện thoại xem trang này thì bấm “Tải ảnh mã QR”, rồi trong app chọn quét từ ảnh.
                      </p>
                    )}
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <Row label="Ngân hàng">{bank.bankName}</Row>
                      <Row label="Chủ tài khoản">{bank.accountName}</Row>
                      <Row label="Số tài khoản" copy={bank.accountNo} mono>
                        {bank.accountNo}
                      </Row>
                      <Row label="Nội dung chuyển khoản" copy={app.payment.transferContent} mono>
                        {app.payment.transferContent}
                      </Row>
                    </dl>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-input bg-gray-50 p-4 text-sm text-gray-700">
                  Nộp lệ phí trực tiếp tại Phòng Đào tạo Sau đại học, Trường Đại học An Giang (ĐHQG-HCM), và báo mã hồ sơ{" "}
                  <span className="font-mono font-semibold">{app.applicationCode}</span>. Thông tin tài khoản nhận chuyển khoản sẽ được cập nhật tại đây khi Nhà trường công bố.
                </div>
              )}
              <p className="mt-3 text-xs text-gray-500">
                Nếu chuyển khoản thủ công, ghi đúng nội dung chuyển khoản để Phòng Đào tạo đối chiếu. Trạng thái sẽ chuyển sang “Đã nộp” sau khi cán bộ xác nhận (thường trong 1–2 ngày làm việc). Hồ sơ chỉ được kết luận đạt khi đã nộp lệ phí.
              </p>
            </>
          )}
        </Card>
      )}

      {/* Thông tin đăng ký */}
      <Card className="mt-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-gray-900">Thông tin đăng ký</h2>
          <Link href="/application/print" target="_blank" className="text-[13px] font-semibold text-accent hover:underline">
            In đơn đăng ký dự tuyển
          </Link>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <Row label="Đợt tuyển sinh">{app.batch.batchName}</Row>
          <Row label="Ngành dự tuyển">
            {app.major.majorName} ({DEGREE_LABEL[app.degreeLevel]})
          </Row>
          <Row label="Ngày nộp">{fmtDateTime(app.submittedAt)}</Row>
          {app.language.option && (
            <Row label="Ngoại ngữ">
              {LANGUAGE_OPTION_TEXT[app.language.option].title}
              {app.language.note && <span className="block text-xs font-medium text-gray-500">{app.language.note}</span>}
            </Row>
          )}
          {app.education && (
            <Row label="Tốt nghiệp">
              {EDU_LABEL[app.education.degreeLevel]} {app.education.majorName}, {app.education.institutionName} ({app.education.graduationYear}), điểm TB {app.education.gpa ?? "—"}/{app.education.gpaScale}
            </Row>
          )}
          {app.proposal && (
            <>
              <Row label="Đề tài nghiên cứu">{app.proposal.researchTopic}</Row>
              <Row label="Giảng viên hướng dẫn">
                {app.proposal.lecturerName ? (
                  <>
                    {app.proposal.lecturerName}
                    {app.proposal.supervisorStatus && <span className="block text-xs font-medium text-gray-500">{SUPERVISOR_LABEL[app.proposal.supervisorStatus]}</span>}
                  </>
                ) : (
                  "Hội đồng phân công sau"
                )}
              </Row>
            </>
          )}
        </dl>
      </Card>

      {/* Minh chứng */}
      <Card className="mt-5 p-5 sm:p-6">
        <h2 className="text-base font-bold text-gray-900">Minh chứng đã nộp</h2>
        <ul className="mt-4 flex flex-col gap-2">
          {app.documents.map((d) => (
            <DocRow key={d.documentId} d={d} />
          ))}
          {app.documents.length === 0 && <li className="text-sm text-gray-400">Chưa có minh chứng nào.</li>}
        </ul>
      </Card>

      {/* Lịch sử */}
      <Card className="mt-5 p-5 sm:p-6">
        <h2 className="text-base font-bold text-gray-900">Lịch sử xử lý</h2>
        <ol className="relative ml-1.5 mt-4 space-y-4 border-l-2 border-gray-200 pl-5">
          {[...app.history].reverse().map((h, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[28px] top-1 h-3 w-3 rounded-full border-2 border-white bg-navy-700" aria-hidden="true" />
              <p className="text-sm font-semibold text-gray-900">{h.status === "UNDER_REVIEW" && h.by === "CANDIDATE" ? "Nộp bổ sung minh chứng" : HISTORY_LABEL[h.status]}</p>
              <p className="text-xs text-gray-500">{fmtDateTime(h.at)}</p>
              {h.reason && h.by === "STAFF" && <p className="mt-1 whitespace-pre-line text-[13px] text-gray-600">{h.reason}</p>}
            </li>
          ))}
          <li className="relative">
            <span className="absolute -left-[28px] top-1 h-3 w-3 rounded-full border-2 border-white bg-gray-300" aria-hidden="true" />
            <p className="text-sm font-semibold text-gray-900">Tạo hồ sơ</p>
            <p className="text-xs text-gray-500">{fmtDateTime(app.createdAt)}</p>
          </li>
        </ol>
      </Card>
    </Shell>
  );
}

/** Thanh tiến độ: nộp hồ sơ → lệ phí → thẩm định → kết luận */
function Progress({ app }: { app: FullApplication }) {
  const paid = app.payment?.status === "SUCCESS";
  const s = app.reviewStatus;
  type St = "done" | "current" | "warn" | "bad" | "todo";
  const steps: { title: string; sub: string; state: St }[] = [
    { title: "Nộp hồ sơ", sub: fmtDate(app.submittedAt), state: "done" },
    { title: "Nộp lệ phí", sub: paid ? fmtDate(app.payment?.paidAt) : "Chờ xác nhận", state: paid ? "done" : "warn" },
    {
      title: "Thẩm định hồ sơ",
      sub: s === "SUBMITTED" ? "Chờ cán bộ tiếp nhận" : s === "UNDER_REVIEW" ? "Đang kiểm tra minh chứng" : s === "NEEDS_SUPPLEMENT" ? "Cần bổ sung" : "Đã xong",
      state: s === "NEEDS_SUPPLEMENT" ? "warn" : s === "APPROVED" || s === "REJECTED" ? "done" : "current",
    },
    {
      title: s === "APPROVED" ? "Đạt" : s === "REJECTED" ? "Không đạt" : "Kết luận",
      sub: s === "APPROVED" || s === "REJECTED" ? "Đã có kết luận" : "Chưa đến bước này",
      state: s === "APPROVED" ? "done" : s === "REJECTED" ? "bad" : "todo",
    },
  ];
  const dot: Record<St, string> = {
    done: "bg-success text-white",
    current: "border-2 border-navy-800 bg-white text-navy-800",
    warn: "bg-[#D98A1E] text-white",
    bad: "bg-danger text-white",
    todo: "bg-gray-100 text-gray-400",
  };
  return (
    <ol className="mt-6 grid grid-cols-2 gap-4 rounded-card border border-gray-200 bg-white p-4 sm:flex sm:gap-0" aria-label="Tiến độ hồ sơ">
      {steps.map((x, i) => (
        <li key={x.title} className="flex flex-1 items-start gap-2.5 sm:pr-3">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${dot[x.state]}`}>{x.state === "done" ? "✓" : x.state === "warn" || x.state === "bad" ? "!" : i + 1}</span>
          <span className="min-w-0">
            <span className={`block text-[13px] font-bold ${x.state === "todo" ? "text-gray-400" : "text-gray-900"}`}>{x.title}</span>
            <span className="block text-xs text-gray-500">{x.sub}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function DocRow({ d }: { d: ApplicationDocument }) {
  const v = VERIFY_LABEL[d.verifyStatus];
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-input border border-gray-200 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900">{d.fileName}</p>
        <p className="text-xs text-gray-500">
          {DOC_LABEL[d.documentType]} · {fmtSize(d.fileSizeKb)}
        </p>
        {d.verifyStatus === "INVALID" && d.verifyNote && <p className="mt-1 text-xs font-medium text-danger">Lý do: {d.verifyNote}</p>}
      </div>
      <Badge tone={v.tone}>{v.text}</Badge>
    </li>
  );
}

function Row({ label, children, copy, mono }: { label: string; children: React.ReactNode; copy?: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className={`mt-0.5 flex flex-wrap items-center gap-2 font-semibold text-gray-900 ${mono ? "font-mono text-[13px]" : ""}`}>
        <span className={mono ? "break-all" : "[overflow-wrap:anywhere]"}>{children}</span>
        {copy && (
          <button
            type="button"
            className="rounded border border-gray-300 bg-white px-2 py-0.5 font-sans text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
            onClick={() => {
              navigator.clipboard?.writeText(copy).then(
                () => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                },
                () => undefined,
              );
            }}
          >
            {copied ? "Đã chép" : "Sao chép"}
          </button>
        )}
      </dd>
    </div>
  );
}

function FilePicker({ busy, onPick, onError }: { busy: boolean; onPick: (f: File) => void; onError: (m: string) => void }) {
  return (
    <label className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-input border-[1.5px] border-accent bg-white px-5 py-[11px] text-[13px] font-bold text-accent hover:bg-accent-50 ${busy ? "pointer-events-none opacity-60" : ""}`}>
      {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />}
      {busy ? "Đang tải lên…" : "Chọn tệp"}
      <input
        type="file"
        className="sr-only"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const problem = checkFile(f);
          if (problem) return onError(problem);
          onPick(f);
        }}
      />
    </label>
  );
}

function Shell({ children, code, badges }: { children: React.ReactNode; code?: string; badges?: React.ReactNode }) {
  return (
    <AppLayout>
      <div className="mx-auto max-w-[900px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Hồ sơ xét tuyển</h1>
            {code && <p className="mt-1 text-sm text-gray-500">Mã hồ sơ: <span className="font-mono font-semibold text-gray-700">{code}</span></p>}
          </div>
          {badges && <div className="flex flex-wrap gap-2">{badges}</div>}
        </div>
        {children}
      </div>
    </AppLayout>
  );
}

export default function ApplicationStatusPage() {
  return (
    <Suspense fallback={null}>
      <StatusInner />
    </Suspense>
  );
}
