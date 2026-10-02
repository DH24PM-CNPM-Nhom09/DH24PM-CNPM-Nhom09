"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { RequirePermission, useAdmin } from "@/components/admin/AdminShell";
import { IconAlert, IconCheck, IconChevronLeft, IconClock, IconFile } from "@/components/admin/Icons";
import { Btn, DocBadge, ErrorBox, fieldCls, Label, Modal, Notice, Panel, ReviewBadge, Skeleton, useToast } from "@/components/admin/ui";
import { confirmPayment, fetchDocumentFile, getApplication, reviewApplication, simulateCandidateSupplement, USE_MOCK, verifyDocument, type ApplicationDetail } from "@/lib/admin/api";
import { DEGREE_LABEL, DOCUMENT_LABEL, errorMessage, fmtDate, fmtDateTime, fmtMoney, fmtSize, PAYMENT_METHOD_LABEL, relativeDays, toLocalInput } from "@/lib/admin/format";
import { activeSupplement, blockReason, isSupplementOverdue, type ReviewAction } from "@/lib/admin/stateMachine";
import type { AdminDocument, ReviewStatus } from "@/lib/admin/types";
import { useAsync } from "@/lib/admin/useAsync";

const REJECT_PRESETS = [
  "Ngành tốt nghiệp không thuộc danh mục ngành phù hợp hoặc ngành gần.",
  "Chưa đáp ứng điều kiện ngoại ngữ theo quy định của đợt tuyển sinh.",
  "Điểm trung bình tích lũy thấp hơn mức tối thiểu của ngành.",
  "Phát hiện minh chứng không trung thực khi đối chiếu bản gốc.",
];
const INVALID_PRESETS = [
  "Bản scan bị mờ, không đọc được nội dung.",
  "Thiếu trang hoặc thiếu chữ ký, con dấu.",
  "Thông tin trên giấy tờ không khớp với CCCD.",
  "Giấy tờ đã hết hạn sử dụng.",
];

type Dialog =
  | { kind: "start" }
  | { kind: "approve" }
  | { kind: "reject" }
  | { kind: "supplement" }
  | { kind: "expired" }
  | { kind: "payment" }
  | { kind: "invalid"; doc: AdminDocument }
  | { kind: "preview"; doc: AdminDocument }
  | null;

function eventTitle(from: ReviewStatus | null, to: ReviewStatus) {
  if (to === "SUBMITTED") return "Thí sinh nộp hồ sơ";
  if (to === "UNDER_REVIEW") return from === "NEEDS_SUPPLEMENT" ? "Thí sinh nộp bổ sung" : "Tiếp nhận thẩm định";
  if (to === "NEEDS_SUPPLEMENT") return "Yêu cầu bổ sung";
  if (to === "APPROVED") return "Kết luận đạt thẩm định";
  if (to === "REJECTED") return "Kết luận không đạt";
  return "Cập nhật hồ sơ";
}

/** Xem tệp minh chứng: tải bằng fetch kèm token rồi hiển thị (PDF trong khung, ảnh trực tiếp) */
function DocPreview({ doc }: { doc: AdminDocument }) {
  const [url, setUrl] = useState<string | null>(null);
  const [type, setType] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    if (USE_MOCK) return;
    let objectUrl: string | null = null;
    fetchDocumentFile(doc.documentId)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setType(blob.type);
        setUrl(objectUrl);
      })
      .catch((e) => setErr(errorMessage(e, "Không tải được tệp.")));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.documentId]);

  if (url && type.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={doc.fileName} className="max-h-[70vh] w-full rounded-input border border-gray-200 object-contain" />;
  }
  if (url) return <iframe src={url} title={doc.fileName} className="h-[65vh] w-full rounded-input border border-gray-200" />;
  return (
    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center rounded-input border border-gray-200 bg-gray-50 text-center">
      <IconFile size={40} className="text-gray-300" />
      <p className="mt-3 text-sm font-semibold text-gray-600">{doc.fileName}</p>
      <p className="mt-1 max-w-sm px-6 text-xs text-gray-500">
        {USE_MOCK ? "Dữ liệu mẫu trong trình duyệt không có tệp thật. Khi chạy với backend, tệp hiển thị tại đây." : err || "Đang tải tệp…"}
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-900 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function Route({ d }: { d: ApplicationDetail }) {
  const a = d.application;
  const at = (s: ReviewStatus) => [...a.history].reverse().find((h) => h.newStatus === s);
  const hadSupplement = a.supplements.length > 0;
  const sup = activeSupplement(a);
  const overdue = isSupplementOverdue(a);
  const concluded = a.reviewStatus === "APPROVED" || a.reviewStatus === "REJECTED";

  type Step = { title: string; sub: string; state: "done" | "current" | "todo" | "warn" | "bad" };
  const steps: Step[] = [
    { title: "Thí sinh nộp hồ sơ", sub: fmtDateTime(a.submittedAt), state: "done" },
    {
      title: "Tiếp nhận thẩm định",
      sub: at("UNDER_REVIEW") ? `${fmtDate(at("UNDER_REVIEW")!.changedAt)}, ${d.staffNames[a.assignedStaffId ?? 0] ?? ""}` : "Chưa có người phụ trách",
      state: a.reviewStatus === "SUBMITTED" ? "current" : "done",
    },
  ];
  if (hadSupplement) {
    steps.push({
      title: sup ? (overdue ? "Quá hạn bổ sung" : "Chờ thí sinh bổ sung") : "Đã yêu cầu bổ sung",
      sub: sup ? `Hạn ${fmtDateTime(sup.deadline)}` : `${a.supplements.length} lần, đã phản hồi`,
      state: sup ? (overdue ? "warn" : "current") : "done",
    });
  }
  steps.push({
    title: a.reviewStatus === "APPROVED" ? "Đạt thẩm định" : a.reviewStatus === "REJECTED" ? "Không đạt" : "Kết luận thẩm định",
    sub: concluded ? fmtDateTime(at(a.reviewStatus)?.changedAt) : a.reviewStatus === "UNDER_REVIEW" ? "Đang kiểm tra minh chứng" : "Chưa đến bước này",
    state: a.reviewStatus === "APPROVED" ? "done" : a.reviewStatus === "REJECTED" ? "bad" : a.reviewStatus === "UNDER_REVIEW" ? "current" : "todo",
  });

  const dot = {
    done: "border-[#1F8A4C] bg-[#1F8A4C] text-white",
    current: "border-navy-800 bg-white text-navy-800 ring-4 ring-navy-50",
    todo: "border-gray-300 bg-white text-gray-400",
    warn: "border-[#D98A1E] bg-[#D98A1E] text-white ring-4 ring-[#FEF3E2]",
    bad: "border-[#C43B3B] bg-[#C43B3B] text-white",
  };

  return (
    <ol className="grid gap-4 rounded-card border border-gray-200 bg-white p-5 sm:grid-cols-2 lg:flex lg:gap-0" aria-label="Lộ trình hồ sơ">
      {steps.map((s, i) => (
        <li key={s.title} className="relative flex flex-1 items-start gap-3 lg:pr-4">
          {i < steps.length - 1 && <span className="absolute left-[38px] right-2 top-[15px] hidden h-0.5 bg-gray-200 lg:block" aria-hidden="true" />}
          <span className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${dot[s.state]}`}>
            {s.state === "done" ? <IconCheck size={15} /> : s.state === "warn" || s.state === "bad" ? <IconAlert size={14} /> : i + 1}
          </span>
          <span className="relative z-[1] min-w-0 bg-white pr-2">
            <span className={`block text-[13.5px] font-semibold ${s.state === "todo" ? "text-gray-400" : "text-gray-900"}`}>{s.title}</span>
            <span className="block text-xs text-gray-500">{s.sub}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function DetailInner() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { can } = useAdmin();
  const toast = useToast();
  const canReview = can("application:review");
  const { data, error, loading, reload } = useAsync(() => getApplication(id), [id]);

  const [dialog, setDialog] = useState<Dialog>(null);
  const [text, setText] = useState("");
  const [deadline, setDeadline] = useState("");
  const [txn, setTxn] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [docBusy, setDocBusy] = useState<number | null>(null);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-20" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <Skeleton className="h-96" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }
  if (error || !data) return <ErrorBox message={error ?? "Không tìm thấy hồ sơ."} onRetry={() => reload()} />;

  const a = data.application;
  const c = a.candidate;
  const sup = activeSupplement(a);
  const overdue = isSupplementOverdue(a);
  const minGpa = data.batchMajor.conditions.find((x) => x.minGpa !== null)?.minGpa ?? null;
  const editableDocs = canReview && a.reviewStatus === "UNDER_REVIEW";
  const validCount = a.documents.filter((d) => d.verifyStatus === "VALID").length;
  const lastDecision = [...a.history].reverse().find((h) => h.newStatus === a.reviewStatus);

  function open(d: Dialog) {
    setFormError("");
    setDialog(d);
    if (d?.kind === "supplement") {
      const invalid = a.documents.filter((x) => x.verifyStatus === "INVALID");
      setText(
        invalid.length
          ? invalid.map((x) => `- ${DOCUMENT_LABEL[x.documentType]} (${x.fileName}): ${x.invalidReason}`).join("\n")
          : "",
      );
      const dl = new Date(Date.now() + 7 * 86_400_000);
      dl.setHours(17, 0, 0, 0);
      setDeadline(toLocalInput(dl));
    } else {
      setText("");
      setTxn("");
    }
  }

  async function act(action: ReviewAction, payload: Parameters<typeof reviewApplication>[2] = {}, done = "") {
    setBusy(true);
    setFormError("");
    try {
      const res = await reviewApplication(id, action, payload);
      setDialog(null);
      toast(`${done}${res.notified ? " Đã gửi thông báo cho thí sinh." : ""}`);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function markDoc(doc: AdminDocument, status: "VALID" | "INVALID", reason?: string) {
    setDocBusy(doc.documentId);
    setFormError("");
    try {
      await verifyDocument(id, doc.documentId, status, reason);
      if (status === "INVALID") setDialog(null);
    } catch (e) {
      if (status === "INVALID") setFormError(errorMessage(e));
      else toast(errorMessage(e), "error");
    } finally {
      setDocBusy(null);
    }
  }

  const approveBlock = blockReason(a, "APPROVE");

  // Lệ phí + lịch sử: cột phải trên máy tính, cuối trang trên điện thoại
  const sidePanels = (
    <>
      <Panel
        title="Lệ phí xét tuyển"
        action={
          canReview && a.payment && a.payment.gatewayStatus !== "SUCCESS" ? (
            <Btn size="sm" variant="success" onClick={() => open({ kind: "payment" })}>
              <IconCheck size={14} /> Xác nhận đã thu
            </Btn>
          ) : undefined
        }
      >
        {a.payment ? (
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Số tiền">{fmtMoney(a.payment.amount)}</Field>
            <Field label="Trạng thái">
              {a.payment.gatewayStatus === "SUCCESS" ? <span className="text-[#166534]">Đã nộp</span> : <span className="text-[#92400E]">Chờ thanh toán</span>}
            </Field>
            <Field label="Phương thức">{PAYMENT_METHOD_LABEL[a.payment.paymentMethod]}</Field>
            {a.payment.gatewayStatus === "SUCCESS" ? (
              <Field label="Ngày nộp">{fmtDate(a.payment.paidAt)}</Field>
            ) : (
              <Field label="Mã giao dịch">
                <span className="font-mono text-[13px]">{a.payment.transactionCode ?? "—"}</span>
              </Field>
            )}
            {a.payment.gatewayStatus === "SUCCESS" && (
              <>
                <Field label="Số biên lai">{a.payment.receiptNo ?? "—"}</Field>
                <Field label="Mã giao dịch">
                  <span className="font-mono text-[13px]">{a.payment.transactionCode ?? "—"}</span>
                </Field>
              </>
            )}
            {a.payment.transferContent && a.payment.gatewayStatus !== "SUCCESS" && (
              <div className="col-span-2">
                <Field label="Nội dung chuyển khoản cần đối chiếu">
                  <span className="break-all font-mono text-[13px]">{a.payment.transferContent}</span>
                </Field>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-gray-500">Thí sinh chưa phát sinh giao dịch lệ phí nào.</p>
        )}
      </Panel>

      <Panel title="Lịch sử xử lý" bodyClass="px-5 py-4">
        <ol className="relative ml-1.5 space-y-4 border-l-2 border-gray-200 pl-5">
          {[...a.history].reverse().map((h) => (
            <li key={h.historyId} className="relative">
              <span className="absolute -left-[28px] top-1 h-3 w-3 rounded-full border-2 border-white bg-navy-700" aria-hidden="true" />
              <p className="text-[13.5px] font-semibold text-gray-900">{eventTitle(h.oldStatus, h.newStatus)}</p>
              <p className="mt-1 text-xs text-gray-500">
                {fmtDateTime(h.changedAt)},{" "}
                {h.changedByType === "CANDIDATE" ? "thí sinh" : h.changedByType === "SYSTEM" ? "hệ thống" : data.staffNames[h.changedByStaffId ?? 0] ?? "cán bộ"}
              </p>
              {h.reason && <p className="mt-1 whitespace-pre-line text-[13px] text-gray-700">{h.reason}</p>}
            </li>
          ))}
        </ol>
      </Panel>
    </>
  );

  return (
    <>
      <Link href="/admin/applications" className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-gray-500 hover:text-gray-900">
        <IconChevronLeft size={16} /> Hồ sơ xét tuyển
      </Link>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-[24px] font-bold leading-tight text-gray-900 md:text-[28px]">{c.fullName}</h1>
          <p className="mt-1 text-sm text-gray-500">
            <span className="font-mono text-gray-700">{a.applicationCode}</span>
            <span className="mx-2 text-gray-300">|</span>
            {DEGREE_LABEL[data.major.degreeLevel]} {data.major.majorName}, {data.batch.batchName}
          </p>
        </div>
        <ReviewBadge status={a.reviewStatus} />
      </div>

      <Route d={data} />

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        {/* Cột trái */}
        <div className="space-y-5">
          <Panel
            title="Minh chứng"
            action={
              <span className="text-[13px] text-gray-500">
                <span className="font-semibold text-gray-900">{validCount}</span>/{a.documents.length} hợp lệ
              </span>
            }
            bodyClass="p-0"
          >
            {a.reviewStatus === "SUBMITTED" && canReview && (
              <div className="border-b border-gray-100 px-5 py-3">
                <Notice tone="blue">Tiếp nhận hồ sơ để bắt đầu kiểm tra từng minh chứng.</Notice>
              </div>
            )}
            <ul className="divide-y divide-gray-100">
              {a.documents.map((doc) => (
                <li key={doc.documentId} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                      <IconFile size={18} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{DOCUMENT_LABEL[doc.documentType]}</span>
                        <DocBadge status={doc.verifyStatus} />
                      </div>
                      <button type="button" onClick={() => open({ kind: "preview", doc })} className="mt-0.5 max-w-full truncate text-left text-[13px] text-navy-700 underline-offset-2 hover:underline">
                        {doc.fileName}
                      </button>
                      <p className="text-xs text-gray-400">
                        {fmtSize(doc.fileSizeKb)}, tải lên {fmtDateTime(doc.uploadedAt)}
                      </p>
                      {doc.invalidReason && <p className="mt-1.5 text-[13px] text-[#B91C1C]">Lý do: {doc.invalidReason}</p>}
                    </div>
                  </div>
                  {editableDocs && (
                    <div className="flex shrink-0 gap-2 pl-12 sm:pl-0">
                      <Btn size="sm" variant={doc.verifyStatus === "VALID" ? "success" : "outline"} loading={docBusy === doc.documentId} onClick={() => markDoc(doc, "VALID")} aria-pressed={doc.verifyStatus === "VALID"}>
                        <IconCheck size={15} /> Hợp lệ
                      </Btn>
                      <Btn size="sm" variant={doc.verifyStatus === "INVALID" ? "danger" : "outline"} onClick={() => open({ kind: "invalid", doc })} aria-pressed={doc.verifyStatus === "INVALID"}>
                        Không hợp lệ
                      </Btn>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Thông tin thí sinh">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Ngày sinh">{fmtDate(c.dob)}</Field>
              <Field label="Giới tính">{c.gender === "NU" ? "Nữ" : c.gender === "NAM" ? "Nam" : c.gender === "KHAC" ? "Khác" : "—"}</Field>
              <Field label="Số CCCD">{c.idNumber ?? "—"}</Field>
              <Field label="Email">{c.email ?? "—"}</Field>
              <Field label="Điện thoại">{c.phoneNumber ?? "—"}</Field>
              <Field label="Địa chỉ">{c.address ?? "—"}</Field>
            </dl>
            <h3 className="mb-3 mt-6 border-t border-gray-100 pt-5 text-sm font-bold text-gray-900">Học vấn kê khai</h3>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Cơ sở đào tạo">{c.graduatedFrom ?? "Chưa kê khai"}</Field>
              <Field label="Ngành tốt nghiệp">{c.graduatedMajor ?? "—"}</Field>
              <Field label="Năm tốt nghiệp">{c.graduationYear ?? "—"}</Field>
              <Field label="Điểm trung bình tích lũy">
                {c.gpa === null ? (
                  "—"
                ) : (
                  <>
                    <span className="tabular-nums">{c.gpa.toFixed(2).replace(".", ",")}</span> / {c.gpaScale ?? 4}
                    {minGpa !== null && (c.gpaScale ?? 4) === 4 && (
                      <span className={`ml-2 text-xs font-semibold ${c.gpa >= minGpa ? "text-[#166534]" : "text-[#B91C1C]"}`}>
                        {c.gpa >= minGpa ? "đạt" : "chưa đạt"} mức tối thiểu {minGpa.toFixed(2).replace(".", ",")}
                      </span>
                    )}
                  </>
                )}
              </Field>
            </dl>
          </Panel>

          <Panel title="Điều kiện dự tuyển của ngành">
            <ul className="space-y-3">
              {data.batchMajor.conditions.map((cond) => (
                <li key={cond.conditionId} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-navy-700" aria-hidden="true" />
                  <span className="text-gray-700">
                    {cond.description}
                    {cond.requiredCertificate && <span className="text-gray-500"> Yêu cầu: {cond.requiredCertificate}.</span>}
                  </span>
                </li>
              ))}
              {data.batchMajor.conditions.length === 0 && <li className="text-sm text-gray-500">Ngành chưa khai báo điều kiện riêng.</li>}
            </ul>
          </Panel>
          <div className="space-y-5 lg:hidden">{sidePanels}</div>
        </div>

        {/* Cột phải */}
        <div className="order-first space-y-5 lg:sticky lg:top-6 lg:order-none">
          <Panel title="Kết luận thẩm định">
            {!canReview && (
              <Notice tone="blue">Bạn đang xem hồ sơ với quyền chỉ đọc. Việc thẩm định do cán bộ tuyển sinh thực hiện.</Notice>
            )}

            {canReview && a.reviewStatus === "SUBMITTED" && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">Hồ sơ nộp {relativeDays(a.submittedAt)}, chưa có cán bộ phụ trách.</p>
                <Btn variant="navy" className="w-full" onClick={() => open({ kind: "start" })}>
                  Tiếp nhận thẩm định
                </Btn>
              </div>
            )}

            {canReview && a.reviewStatus === "UNDER_REVIEW" && (
              <div className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    {a.payment?.gatewayStatus === "SUCCESS" ? <IconCheck size={16} className="text-[#15803D]" /> : <IconAlert size={16} className="text-[#B45309]" />}
                    Lệ phí xét tuyển {a.payment?.gatewayStatus === "SUCCESS" ? "đã thanh toán" : "chưa thanh toán"}
                  </li>
                  <li className="flex items-center gap-2">
                    {validCount === a.documents.length ? <IconCheck size={16} className="text-[#15803D]" /> : <IconClock size={16} className="text-gray-400" />}
                    {validCount}/{a.documents.length} minh chứng hợp lệ
                  </li>
                </ul>
                <div>
                  <Btn variant="success" className="w-full" disabled={!!approveBlock} onClick={() => open({ kind: "approve" })}>
                    Đạt thẩm định
                  </Btn>
                  {approveBlock && <p className="mt-1.5 text-xs text-gray-500">{approveBlock}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Btn variant="warning" onClick={() => open({ kind: "supplement" })}>
                    Yêu cầu bổ sung
                  </Btn>
                  <Btn variant="danger" onClick={() => open({ kind: "reject" })}>
                    Không đạt
                  </Btn>
                </div>
              </div>
            )}

            {a.reviewStatus === "NEEDS_SUPPLEMENT" && sup && (
              <div className="space-y-3">
                <Notice tone={overdue ? "amber" : "blue"}>
                  <p className="font-semibold">{overdue ? `Đã quá hạn bổ sung (${relativeDays(sup.deadline)})` : `Chờ thí sinh bổ sung, ${relativeDays(sup.deadline)}`}</p>
                  <p className="mt-1">Hạn: {fmtDateTime(sup.deadline)}</p>
                </Notice>
                <div className="rounded-input bg-gray-50 px-3.5 py-3 text-[13px] leading-relaxed text-gray-700">
                  <p className="mb-1 text-xs font-semibold text-gray-500">Nội dung đã gửi thí sinh</p>
                  <p className="whitespace-pre-line">{sup.content}</p>
                </div>
                {canReview && overdue && (
                  <Btn variant="danger" className="w-full" onClick={() => open({ kind: "expired" })}>
                    Kết luận không đạt do quá hạn
                  </Btn>
                )}
                {canReview && USE_MOCK && (
                  <button
                    type="button"
                    className="w-full rounded-input border border-dashed border-gray-300 px-3 py-2 text-xs font-semibold text-gray-500 hover:border-gray-400 hover:text-gray-700"
                    onClick={async () => {
                      await simulateCandidateSupplement(id);
                      toast("Thí sinh đã nộp bổ sung, hồ sơ quay lại bước thẩm định.", "info");
                    }}
                  >
                    Giả lập: thí sinh đã nộp bổ sung (chỉ có ở dữ liệu mẫu)
                  </button>
                )}
              </div>
            )}

            {(a.reviewStatus === "APPROVED" || a.reviewStatus === "REJECTED") && (
              <div className="space-y-2 text-sm">
                <p className={`font-semibold ${a.reviewStatus === "APPROVED" ? "text-[#166534]" : "text-[#B91C1C]"}`}>
                  {a.reviewStatus === "APPROVED" ? "Hồ sơ đủ điều kiện dự tuyển." : "Hồ sơ không đạt thẩm định."}
                </p>
                {lastDecision?.reason && lastDecision.reason !== "Hồ sơ đủ điều kiện dự tuyển." && <p className="text-gray-600">{lastDecision.reason}</p>}
                <p className="text-xs text-gray-500">
                  {fmtDateTime(lastDecision?.changedAt)}
                  {lastDecision?.changedByStaffId ? `, ${data.staffNames[lastDecision.changedByStaffId]}` : ""}. Kết luận đã chốt; thay đổi phải qua quy trình khiếu nại.
                </p>
              </div>
            )}
          </Panel>

          <div className="hidden space-y-5 lg:block">{sidePanels}</div>
        </div>
      </div>

      {/* ------------------------------------------------ Hộp thoại */}
      <Modal
        open={dialog?.kind === "start"}
        onClose={() => setDialog(null)}
        title="Tiếp nhận hồ sơ này?"
        description="Bạn sẽ là cán bộ phụ trách thẩm định. Thí sinh nhận được thông báo hồ sơ đang được xử lý."
        footer={
          <>
            <Btn onClick={() => setDialog(null)}>Hủy</Btn>
            <Btn variant="navy" loading={busy} onClick={() => act("START_REVIEW", {}, "Đã tiếp nhận hồ sơ.")}>
              Tiếp nhận
            </Btn>
          </>
        }
      >
        {formError && <ErrorBox message={formError} />}
      </Modal>

      <Modal
        open={dialog?.kind === "approve"}
        onClose={() => setDialog(null)}
        title="Xác nhận hồ sơ đạt thẩm định"
        description={`${c.fullName} sẽ đủ điều kiện dự thi/xét tuyển ngành ${data.major.majorName}. Kết luận này không sửa trực tiếp được sau khi lưu.`}
        footer={
          <>
            <Btn onClick={() => setDialog(null)}>Xem lại</Btn>
            <Btn variant="success" loading={busy} onClick={() => act("APPROVE", { reason: text || "Hồ sơ đủ điều kiện dự tuyển." }, "Đã kết luận hồ sơ đạt.")}>
              Xác nhận đạt
            </Btn>
          </>
        }
      >
        <Label htmlFor="approve-note">Ghi chú (không bắt buộc)</Label>
        <textarea id="approve-note" rows={3} className={fieldCls} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ví dụ: đã đối chiếu bản gốc văn bằng tại phòng." />
        {formError && <div className="mt-3"><ErrorBox message={formError} /></div>}
      </Modal>

      <Modal
        open={dialog?.kind === "reject"}
        onClose={() => setDialog(null)}
        title="Kết luận hồ sơ không đạt"
        description="Lý do sẽ được gửi nguyên văn cho thí sinh và lưu vào lịch sử hồ sơ."
        footer={
          <>
            <Btn onClick={() => setDialog(null)}>Hủy</Btn>
            <Btn variant="danger" loading={busy} disabled={text.trim().length < 10} onClick={() => act("REJECT", { reason: text }, "Đã kết luận hồ sơ không đạt.")}>
              Xác nhận không đạt
            </Btn>
          </>
        }
      >
        <div className="mb-3 flex flex-wrap gap-1.5">
          {REJECT_PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => setText(p)} className="rounded-full border border-gray-200 px-3 py-1.5 text-left text-xs text-gray-600 hover:border-gray-400">
              {p}
            </button>
          ))}
        </div>
        <Label htmlFor="reject-reason" required>
          Lý do không đạt
        </Label>
        <textarea id="reject-reason" rows={4} className={fieldCls} value={text} onChange={(e) => setText(e.target.value)} placeholder="Nêu rõ điều kiện nào chưa đáp ứng, căn cứ quy định nào." />
        <p className="mt-1 text-xs text-gray-400">Tối thiểu 10 ký tự.</p>
        {formError && <div className="mt-3"><ErrorBox message={formError} /></div>}
      </Modal>

      <Modal
        open={dialog?.kind === "supplement"}
        onClose={() => setDialog(null)}
        title="Yêu cầu thí sinh bổ sung"
        description="Thí sinh nhận email và thông báo trên cổng. Hết hạn mà chưa bổ sung, hồ sơ có thể bị kết luận không đạt."
        footer={
          <>
            <Btn onClick={() => setDialog(null)}>Hủy</Btn>
            <Btn variant="navy" loading={busy} disabled={text.trim().length < 10 || !deadline} onClick={() => act("REQUEST_SUPPLEMENT", { supplementContent: text, deadline: new Date(deadline).toISOString() }, "Đã gửi yêu cầu bổ sung.")}>
              Gửi yêu cầu
            </Btn>
          </>
        }
      >
        <Label htmlFor="sup-content" required>
          Giấy tờ cần bổ sung
        </Label>
        <textarea id="sup-content" rows={5} className={fieldCls} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ví dụ: Nộp lại bảng điểm toàn khóa có đủ chữ ký và con dấu." />
        {a.documents.every((d) => d.verifyStatus !== "INVALID") && (
          <p className="mt-1 text-xs text-gray-500">Mẹo: đánh dấu minh chứng “Không hợp lệ” trước, nội dung sẽ tự điền.</p>
        )}
        <div className="mt-4">
          <Label htmlFor="sup-deadline" required>
            Hạn bổ sung
          </Label>
          <input id="sup-deadline" type="datetime-local" className={fieldCls} value={deadline} min={toLocalInput(new Date())} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        {formError && <div className="mt-3"><ErrorBox message={formError} /></div>}
      </Modal>

      <Modal
        open={dialog?.kind === "payment"}
        onClose={() => setDialog(null)}
        title="Xác nhận đã thu lệ phí?"
        description={
          a.payment
            ? `Đối chiếu sao kê: khoản ${fmtMoney(a.payment.amount)} có nội dung “${a.payment.transferContent ?? a.applicationCode}”. Sau khi xác nhận, thí sinh nhận được thông báo và hồ sơ đủ điều kiện kết luận đạt.`
            : undefined
        }
        footer={
          <>
            <Btn onClick={() => setDialog(null)}>Hủy</Btn>
            <Btn
              variant="success"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setFormError("");
                try {
                  await confirmPayment(id, { receiptNo: text.trim(), transactionCode: txn.trim() });
                  setDialog(null);
                  toast("Đã xác nhận thu lệ phí. Đã gửi thông báo cho thí sinh.");
                } catch (e) {
                  setFormError(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Xác nhận đã thu
            </Btn>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pay-receipt">Số biên lai</Label>
            <input id="pay-receipt" className={fieldCls} value={text} maxLength={50} placeholder="VD: BL-2026-0001" onChange={(e) => setText(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pay-txn">Mã giao dịch ngân hàng</Label>
            <input id="pay-txn" className={fieldCls} value={txn} maxLength={100} placeholder="Không bắt buộc" onChange={(e) => setTxn(e.target.value)} />
          </div>
        </div>
        {formError && <div className="mt-3"><ErrorBox message={formError} /></div>}
      </Modal>

      <Modal
        open={dialog?.kind === "expired"}
        onClose={() => setDialog(null)}
        title="Kết luận không đạt do quá hạn bổ sung?"
        description={sup ? `Hạn bổ sung đã kết thúc lúc ${fmtDateTime(sup.deadline)} mà thí sinh chưa nộp.` : undefined}
        footer={
          <>
            <Btn onClick={() => setDialog(null)}>Hủy</Btn>
            <Btn variant="danger" loading={busy} onClick={() => act("REJECT_EXPIRED", {}, "Đã kết luận không đạt do quá hạn bổ sung.")}>
              Xác nhận
            </Btn>
          </>
        }
      >
        {formError && <ErrorBox message={formError} />}
      </Modal>

      <Modal
        open={dialog?.kind === "invalid"}
        onClose={() => setDialog(null)}
        title="Minh chứng không hợp lệ"
        description={dialog?.kind === "invalid" ? `${DOCUMENT_LABEL[dialog.doc.documentType]}: ${dialog.doc.fileName}` : undefined}
        footer={
          <>
            <Btn onClick={() => setDialog(null)}>Hủy</Btn>
            <Btn variant="danger" loading={dialog?.kind === "invalid" && docBusy === dialog.doc.documentId} disabled={!text.trim()} onClick={() => dialog?.kind === "invalid" && markDoc(dialog.doc, "INVALID", text)}>
              Lưu
            </Btn>
          </>
        }
      >
        <div className="mb-3 flex flex-wrap gap-1.5">
          {INVALID_PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => setText(p)} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:border-gray-400">
              {p}
            </button>
          ))}
        </div>
        <Label htmlFor="invalid-reason" required>
          Lý do
        </Label>
        <textarea id="invalid-reason" rows={3} className={fieldCls} value={text} onChange={(e) => setText(e.target.value)} />
        {formError && <div className="mt-3"><ErrorBox message={formError} /></div>}
      </Modal>

      <Modal open={dialog?.kind === "preview"} onClose={() => setDialog(null)} title={dialog?.kind === "preview" ? `${DOCUMENT_LABEL[dialog.doc.documentType]}: ${dialog.doc.fileName}` : ""} width="max-w-3xl">
        {dialog?.kind === "preview" && (
          <div>
            <DocPreview doc={dialog.doc} />
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Dung lượng">{fmtSize(dialog.doc.fileSizeKb)}</Field>
              <Field label="Tải lên lúc">{fmtDateTime(dialog.doc.uploadedAt)}</Field>
              <div className="sm:col-span-2">
                <Field label="Mã băm SHA-256 (đối chiếu tính toàn vẹn)">
                  <span className="break-all font-mono text-xs text-gray-700">{dialog.doc.fileHash}</span>
                </Field>
              </div>
            </dl>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function ApplicationDetailPage() {
  return (
    <RequirePermission perm="application:view">
      <DetailInner />
    </RequirePermission>
  );
}
