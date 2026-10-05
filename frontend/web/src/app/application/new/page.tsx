"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Alert, errMsg } from "@/components/auth/AuthBits";
import DocSlot from "@/components/application/DocSlot";
import {
  cancelMyDraft,
  deleteMyDocument,
  getLecturers,
  getMyFullApplication,
  getMyProfile,
  saveApplicationDraft,
  saveLanguageChoice,
  saveResearchProposal,
  submitMyApplication,
  uploadDraftDocument,
} from "@/lib/api";
import { getOpenBatches, fmtDate, fmtDateTime, timeLeft, type OpenBatch } from "@/lib/announcements";
import { checkFile, DEGREE_LABEL, DOC_LABEL, EDU_LABEL, EXEMPT_REASONS, fmtMoney, fmtSize, LANGUAGE_OPTION_TEXT } from "@/lib/application";
import type { ApplicationDocument, Candidate, DocumentType, EducationInput, FullApplication, LanguageOption, Lecturer } from "@/lib/types";

/** Các mục hồ sơ cá nhân bắt buộc trước khi nộp — khớp kiểm tra ở backend */
const PROFILE_FIELDS: { key: keyof Candidate; label: string }[] = [
  { key: "fullName", label: "họ tên" },
  { key: "dob", label: "ngày sinh" },
  { key: "gender", label: "giới tính" },
  { key: "idNumber", label: "số CCCD" },
  { key: "phoneNumber", label: "số điện thoại" },
  { key: "address", label: "địa chỉ liên hệ" },
];
const GENDER_LABEL: Record<string, string> = { NAM: "Nam", NU: "Nữ", KHAC: "Khác" };

type StepKey = "major" | "education" | "language" | "documents" | "research" | "review";
const STEP_LABEL: Record<StepKey, string> = {
  major: "Đợt & ngành",
  education: "Quá trình đào tạo",
  language: "Ngoại ngữ",
  documents: "Minh chứng",
  research: "Đề tài nghiên cứu",
  review: "Xác nhận & nộp",
};

interface EduForm {
  degreeLevel: EducationInput["degreeLevel"];
  institutionName: string;
  majorName: string;
  graduationYear: string;
  gpa: string;
  gpaScale: "4" | "10";
}
const EMPTY_EDU: EduForm = { degreeLevel: "DAI_HOC", institutionName: "", majorName: "", graduationYear: "", gpa: "", gpaScale: "4" };

function WizardInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [profile, setProfile] = useState<Candidate | null>(null);
  const [batches, setBatches] = useState<OpenBatch[]>([]);
  const [app, setApp] = useState<FullApplication | null>(null);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);

  const [step, setStep] = useState<StepKey>("major");
  const [batchId, setBatchId] = useState<number | null>(null);
  const [batchMajorId, setBatchMajorId] = useState<number | null>(null);
  const [edu, setEdu] = useState<EduForm>(EMPTY_EDU);
  const [eduErrors, setEduErrors] = useState<Partial<Record<keyof EduForm, string>>>({});
  const [proposal, setProposal] = useState({ researchTopic: "", researchField: "", preferredLecturerId: "" });
  const [proposalError, setProposalError] = useState("");
  const [lang, setLang] = useState<{ option: LanguageOption | ""; note: string }>({ option: "", note: "" });
  const [langError, setLangError] = useState("");
  const [agree, setAgree] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState<DocumentType | null>(null);
  const [docErrors, setDocErrors] = useState<Partial<Record<DocumentType, string>>>({});
  const [optionalType, setOptionalType] = useState<DocumentType>("CHUNG_CHI_NGOAI_NGU");
  const [confirmCancel, setConfirmCancel] = useState(false);

  // ------------------------------------------------------------------ tải dữ liệu ban đầu
  useEffect(() => {
    Promise.all([getMyProfile(), getMyFullApplication(), getOpenBatches()])
      .then(([p, a, b]) => {
        setProfile(p);
        setBatches(b);
        // Hồ sơ đã từ chối nhập học không chặn việc đăng ký đợt mới
        setApp(a && a.declined ? null : a);
        if (a && a.reviewStatus === "DRAFT") {
          setBatchId(a.batch.batchId);
          setBatchMajorId(a.major.batchMajorId);
          if (a.education)
            setEdu({
              degreeLevel: a.education.degreeLevel,
              institutionName: a.education.institutionName,
              majorName: a.education.majorName,
              graduationYear: String(a.education.graduationYear),
              gpa: a.education.gpa === null ? "" : String(a.education.gpa),
              gpaScale: a.education.gpaScale === 10 ? "10" : "4",
            });
          if (a.language?.option) setLang({ option: a.language.option, note: a.language.note ?? "" });
          if (a.proposal)
            setProposal({
              researchTopic: a.proposal.researchTopic,
              researchField: a.proposal.researchField ?? "",
              preferredLecturerId: a.proposal.preferredLecturerId ? String(a.proposal.preferredLecturerId) : "",
            });
          // Mở lại đúng bước còn dang dở
          setStep(!a.language?.option ? "language" : a.missingDocuments.length ? "documents" : a.degreeLevel === "TIEN_SI" && !a.proposal ? "research" : "review");
        } else {
          const want = Number(params.get("batch"));
          const pick = b.find((x) => x.batchId === want) ?? (b.length === 1 ? b[0] : null);
          if (pick) setBatchId(pick.batchId);
        }
      })
      .catch((e) => setLoadError(errMsg(e, "Không tải được dữ liệu. Kiểm tra kết nối rồi tải lại trang.")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const batch = batches.find((b) => b.batchId === batchId) ?? null;
  const major = batch?.majors.find((m) => m.batchMajorId === batchMajorId) ?? null;
  const degree = batch?.degreeLevel ?? app?.degreeLevel ?? "THAC_SI";
  const steps: StepKey[] = degree === "TIEN_SI" ? ["major", "education", "language", "documents", "research", "review"] : ["major", "education", "language", "documents", "review"];
  const stepIndex = steps.indexOf(step);
  const minGpa = major?.conditions.find((c) => c.minGpa !== null)?.minGpa ?? null;
  const missingProfile = profile ? PROFILE_FIELDS.filter((f) => !String(profile[f.key] ?? "").trim()).map((f) => f.label) : [];

  useEffect(() => {
    if (degree === "TIEN_SI" && lecturers.length === 0) getLecturers().then(setLecturers).catch(() => undefined);
    if (degree === "THAC_SI" && edu.degreeLevel !== "DAI_HOC") setEdu((e) => ({ ...e, degreeLevel: "DAI_HOC" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [degree]);

  const docsByType = useMemo(() => {
    const m: Partial<Record<DocumentType, ApplicationDocument[]>> = {};
    app?.documents.forEach((d) => (m[d.documentType] ??= []).push(d));
    return m;
  }, [app]);

  function go(next: StepKey) {
    setError("");
    setNotice("");
    setStep(next);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function refresh() {
    const a = await getMyFullApplication();
    setApp(a);
    return a;
  }

  // ------------------------------------------------------------------ bước 2: lưu nháp
  function validateEdu(): EducationInput | null {
    const e: Partial<Record<keyof EduForm, string>> = {};
    const year = Number(edu.graduationYear);
    const scale = Number(edu.gpaScale) as 4 | 10;
    const gpa = Number(edu.gpa.replace(",", "."));
    const thisYear = new Date().getFullYear();
    if (edu.institutionName.trim().length < 3) e.institutionName = "Nhập tên trường đã tốt nghiệp.";
    if (edu.majorName.trim().length < 2) e.majorName = "Nhập ngành đã tốt nghiệp.";
    if (!Number.isInteger(year) || year < 1960 || year > thisYear) e.graduationYear = `Năm tốt nghiệp từ 1960 đến ${thisYear}.`;
    if (!edu.gpa.trim() || !Number.isFinite(gpa) || gpa < 0 || gpa > scale) e.gpa = `Điểm trung bình từ 0 đến ${scale}.`;
    setEduErrors(e);
    if (Object.keys(e).length) return null;
    return {
      degreeLevel: degree === "THAC_SI" ? "DAI_HOC" : edu.degreeLevel,
      institutionName: edu.institutionName.trim().replace(/\s+/g, " "),
      majorName: edu.majorName.trim().replace(/\s+/g, " "),
      graduationYear: year,
      gpa: Math.round(gpa * 100) / 100,
      gpaScale: scale,
    };
  }

  async function saveEducation() {
    if (!batch || !major) return go("major");
    const education = validateEdu();
    if (!education) return;
    setBusy(true);
    setError("");
    try {
      const a = await saveApplicationDraft(
        { batchMajorId: major.batchMajorId, education },
        {
          degreeLevel: batch.degreeLevel,
          batch: { batchId: batch.batchId, batchCode: batch.batchCode, batchName: batch.batchName, status: "OPEN", registrationEndAt: batch.registrationEndAt, examStartAt: batch.examStartAt },
          major: { batchMajorId: major.batchMajorId, majorCode: major.majorCode, majorName: major.majorName, facultyName: major.facultyName },
        },
      );
      setApp(a);
      go(a.language?.option ? "documents" : "language");
    } catch (e) {
      setError(errMsg(e, "Không lưu được hồ sơ nháp, vui lòng thử lại."));
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------------------ ngoại ngữ
  async function saveLanguage() {
    if (!lang.option) return setLangError("Chọn một trong ba trường hợp.");
    if (lang.option === "EXEMPT" && lang.note.trim().length < 5) return setLangError("Ghi rõ lý do được miễn.");
    setLangError("");
    setBusy(true);
    setError("");
    try {
      const a = await saveLanguageChoice(lang.option, lang.note.trim());
      setApp(a);
      go("documents");
    } catch (e) {
      setError(errMsg(e, "Không lưu được thông tin ngoại ngữ."));
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------------------ bước 3: minh chứng
  async function upload(type: DocumentType, file: File) {
    if (!app) return;
    setUploading(type);
    setDocErrors((d) => ({ ...d, [type]: undefined }));
    setNotice("");
    try {
      const res = await uploadDraftDocument(app.applicationId, file, type);
      await refresh();
      if (res?.duplicateWarning) setNotice(`Tệp “${file.name}” trùng nội dung với một tệp bạn đã nộp. Kiểm tra lại nếu chọn nhầm.`);
    } catch (e) {
      setDocErrors((d) => ({ ...d, [type]: errMsg(e, "Tải tệp thất bại, vui lòng thử lại.") }));
    } finally {
      setUploading(null);
    }
  }

  async function removeDoc(doc: ApplicationDocument) {
    setError("");
    try {
      await deleteMyDocument(doc.documentId);
      await refresh();
    } catch (e) {
      setError(errMsg(e, "Không xóa được tệp."));
    }
  }

  // ------------------------------------------------------------------ bước 4 (tiến sĩ): đề tài
  async function saveResearch() {
    const topic = proposal.researchTopic.trim().replace(/\s+/g, " ");
    if (topic.length < 10) return setProposalError("Tên đề tài cần ít nhất 10 ký tự.");
    if (topic.length > 500) return setProposalError("Tên đề tài tối đa 500 ký tự.");
    setProposalError("");
    setBusy(true);
    setError("");
    try {
      const a = await saveResearchProposal({
        researchTopic: topic,
        researchField: proposal.researchField.trim(),
        preferredLecturerId: proposal.preferredLecturerId ? Number(proposal.preferredLecturerId) : null,
      });
      setApp(a);
      go("review");
    } catch (e) {
      setError(errMsg(e, "Không lưu được thông tin nghiên cứu."));
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------------------ nộp / hủy
  async function submit() {
    if (!agree) return setError("Bạn cần xác nhận cam kết trước khi nộp hồ sơ.");
    setBusy(true);
    setError("");
    try {
      await submitMyApplication();
      router.replace("/application?submitted=1");
    } catch (e) {
      setError(errMsg(e, "Nộp hồ sơ thất bại, vui lòng thử lại."));
      refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function cancelDraft() {
    setBusy(true);
    setError("");
    try {
      await cancelMyDraft();
      setApp(null);
      setEdu(EMPTY_EDU);
      setProposal({ researchTopic: "", researchField: "", preferredLecturerId: "" });
      setBatchMajorId(null);
      setConfirmCancel(false);
      setAgree(false);
      go("major");
      setNotice("Đã hủy bản nháp. Bạn có thể tạo hồ sơ mới.");
    } catch (e) {
      setError(errMsg(e, "Không hủy được bản nháp."));
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------------------ các trạng thái chặn
  if (loading) {
    return (
      <Shell>
        <div className="mt-6 h-96 animate-pulse rounded-card bg-gray-100" />
      </Shell>
    );
  }
  if (loadError) {
    return (
      <Shell>
        <Card className="mt-6 p-6 text-sm font-medium text-danger">{loadError}</Card>
      </Shell>
    );
  }
  if (app && app.reviewStatus !== "DRAFT") {
    return (
      <Shell>
        <Card className="mt-6 p-8 text-center">
          <p className="text-base font-bold text-gray-900">Bạn đã nộp hồ sơ {app.applicationCode}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            Mỗi thí sinh xử lý một hồ sơ tại một thời điểm. Theo dõi tiến độ thẩm định, lệ phí và yêu cầu bổ sung trong trang hồ sơ.
          </p>
          <Link href="/application" className="mt-5 inline-block">
            <Button>Xem hồ sơ của tôi</Button>
          </Link>
        </Card>
      </Shell>
    );
  }
  if (missingProfile.length) {
    return (
      <Shell>
        <Card className="mt-6 p-6 sm:p-8">
          <p className="text-base font-bold text-gray-900">Hoàn thiện hồ sơ cá nhân trước</p>
          <p className="mt-2 text-sm text-gray-600">
            Hồ sơ xét tuyển dùng thông tin cá nhân của bạn. Còn thiếu: <span className="font-semibold text-gray-900">{missingProfile.join(", ")}</span>.
          </p>
          <Link href="/profile?next=/application/new" className="mt-5 inline-block">
            <Button>Cập nhật hồ sơ cá nhân</Button>
          </Link>
        </Card>
      </Shell>
    );
  }
  if (!app && batches.length === 0) {
    return (
      <Shell>
        <Card className="mt-6 p-8 text-center">
          <p className="text-base font-bold text-gray-900">Hiện chưa có đợt tuyển sinh nào nhận hồ sơ</p>
          <p className="mt-2 text-sm text-gray-500">Theo dõi mục Thông báo để biết lịch mở đợt tiếp theo.</p>
          <Link href="/announcements" className="mt-5 inline-block">
            <Button variant="outline">Xem thông báo</Button>
          </Link>
        </Card>
      </Shell>
    );
  }

  const expired = Boolean(app && !app.canEdit);
  const optionalList: DocumentType[] = app?.optionalDocuments ?? [];
  const freeOptional = optionalList.filter((t) => !(docsByType[t]?.length ?? 0));
  const optType = freeOptional.includes(optionalType) ? optionalType : freeOptional[0];
  const reachable = (s: StepKey) => s === "major" || s === "education" || Boolean(app);

  // ------------------------------------------------------------------ giao diện chính
  return (
    <Shell code={app?.applicationCode}>
      {/* Thanh bước */}
      <ol className="mt-6 flex items-center" aria-label="Các bước tạo hồ sơ">
        {steps.map((s, i) => {
          const state = i < stepIndex ? "done" : i === stepIndex ? "current" : "todo";
          return (
            <li key={s} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                disabled={!reachable(s) || i > stepIndex + 1 || busy}
                onClick={() => go(s)}
                className="flex flex-col items-center gap-1.5 disabled:cursor-default"
                aria-current={state === "current" ? "step" : undefined}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                    state === "current" ? "bg-accent text-white" : state === "done" ? "bg-success text-white" : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {state === "done" ? "✓" : i + 1}
                </span>
                <span className={`hidden text-[11px] font-semibold sm:block ${state === "current" ? "text-gray-900" : "text-gray-400"}`}>{STEP_LABEL[s]}</span>
              </button>
              {i < steps.length - 1 && <span className={`mx-2 h-[2px] flex-1 ${i < stepIndex ? "bg-success" : "bg-gray-100"}`} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm font-semibold text-gray-700 sm:hidden">
        Bước {stepIndex + 1}/{steps.length}: {STEP_LABEL[step]}
      </p>

      {expired && (
        <div className="mt-5">
          <Alert tone="warning">Đợt tuyển sinh của bản nháp này đã hết hạn nhận hồ sơ nên không nộp được. Bạn có thể hủy bản nháp và chọn đợt khác đang mở.</Alert>
        </div>
      )}

      <Card className="mt-5 p-5 sm:p-6">
        {error && <Alert tone="error">{error}</Alert>}
        {notice && <Alert tone="info">{notice}</Alert>}

        {/* ---------------- Bước: đợt & ngành */}
        {step === "major" && (
          <div className="flex flex-col gap-6">
            <fieldset>
              <legend className="text-base font-bold text-gray-900">Chọn đợt tuyển sinh</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {batches.map((b) => {
                  const active = b.batchId === batchId;
                  return (
                    <label key={b.batchId} className={`cursor-pointer rounded-input border-[1.5px] p-4 transition-colors ${active ? "border-accent bg-accent-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <input
                        type="radio"
                        name="batch"
                        className="sr-only"
                        checked={active}
                        onChange={() => {
                          setBatchId(b.batchId);
                          if (!b.majors.some((m) => m.batchMajorId === batchMajorId)) setBatchMajorId(null);
                        }}
                      />
                      <span className="text-xs font-bold uppercase tracking-wide text-navy-800">{DEGREE_LABEL[b.degreeLevel]}</span>
                      <span className="mt-1 block text-[15px] font-bold text-gray-900">{b.batchName}</span>
                      <span className="mt-1 block text-xs text-gray-500">
                        Hạn nộp {fmtDateTime(b.registrationEndAt)} · <span className="font-semibold text-accent">{timeLeft(b.registrationEndAt)}</span>
                      </span>
                    </label>
                  );
                })}
                {app && !batches.some((b) => b.batchId === app.batch.batchId) && (
                  <p className="text-sm text-gray-500 sm:col-span-2">
                    Bản nháp đang thuộc {app.batch.batchName} (đã đóng nhận hồ sơ).
                  </p>
                )}
              </div>
            </fieldset>

            {batch && (
              <fieldset>
                <legend className="text-base font-bold text-gray-900">Chọn ngành đăng ký</legend>
                <div className="mt-3 flex flex-col gap-3">
                  {batch.majors.map((m) => {
                    const active = m.batchMajorId === batchMajorId;
                    return (
                      <label key={m.batchMajorId} className={`cursor-pointer rounded-input border-[1.5px] p-4 transition-colors ${active ? "border-accent bg-accent-50" : "border-gray-200 hover:border-gray-300"}`}>
                        <span className="flex items-start gap-3">
                          <input type="radio" name="major" className="mt-1 h-4 w-4 shrink-0 accent-[#E8734A]" checked={active} onChange={() => setBatchMajorId(m.batchMajorId)} />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="text-[15px] font-bold text-gray-900">{m.majorName}</span>
                              <span className="text-xs font-semibold text-navy-800">{m.quota} chỉ tiêu</span>
                            </span>
                            <span className="block text-xs text-gray-500">
                              Mã {m.majorCode}
                              {m.facultyName && ` · ${m.facultyName}`}
                            </span>
                            {m.conditions.length > 0 && (
                              <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-gray-600">
                                {m.conditions.map((c, i) => (
                                  <li key={i}>
                                    {c.description}
                                    {c.minGpa !== null && ` (điểm TB tối thiểu ${c.minGpa})`}
                                    {c.requiredCertificate && ` — ${c.requiredCertificate}`}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </div>
        )}

        {/* ---------------- Bước: quá trình đào tạo */}
        {step === "education" && (
          <div>
            <h2 className="text-base font-bold text-gray-900">Quá trình đào tạo</h2>
            <p className="mt-1 text-sm text-gray-500">
              Khai văn bằng cao nhất dùng để dự tuyển {major ? `ngành ${major.majorName}` : ""}. Thông tin phải khớp với văn bằng và bảng điểm bạn tải lên ở bước sau.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Trình độ đã tốt nghiệp"
                required
                value={degree === "THAC_SI" ? "DAI_HOC" : edu.degreeLevel}
                disabled={degree === "THAC_SI"}
                onChange={(e) => setEdu({ ...edu, degreeLevel: e.target.value as EduForm["degreeLevel"] })}
                hint={degree === "THAC_SI" ? "Dự tuyển thạc sĩ: khai bằng tốt nghiệp đại học." : undefined}
              >
                <option value="DAI_HOC">{EDU_LABEL.DAI_HOC}</option>
                {degree === "TIEN_SI" && <option value="THAC_SI">{EDU_LABEL.THAC_SI}</option>}
              </Select>
              <Input
                label="Năm tốt nghiệp"
                required
                inputMode="numeric"
                maxLength={4}
                placeholder="VD: 2020"
                value={edu.graduationYear}
                onChange={(e) => setEdu({ ...edu, graduationYear: e.target.value.replace(/\D/g, "") })}
                error={eduErrors.graduationYear}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Cơ sở đào tạo"
                  required
                  placeholder="VD: Trường Đại học An Giang"
                  value={edu.institutionName}
                  onChange={(e) => setEdu({ ...edu, institutionName: e.target.value })}
                  error={eduErrors.institutionName}
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Ngành đã tốt nghiệp"
                  required
                  placeholder="Ghi đúng như trên văn bằng"
                  value={edu.majorName}
                  onChange={(e) => setEdu({ ...edu, majorName: e.target.value })}
                  error={eduErrors.majorName}
                />
              </div>
              <Select label="Thang điểm" required value={edu.gpaScale} onChange={(e) => setEdu({ ...edu, gpaScale: e.target.value as EduForm["gpaScale"] })}>
                <option value="4">Thang 4</option>
                <option value="10">Thang 10</option>
              </Select>
              <Input
                label="Điểm trung bình tích lũy"
                required
                inputMode="decimal"
                placeholder={edu.gpaScale === "4" ? "VD: 3.12" : "VD: 7.85"}
                value={edu.gpa}
                onChange={(e) => setEdu({ ...edu, gpa: e.target.value.replace(/[^\d.,]/g, "") })}
                error={eduErrors.gpa}
                hint={minGpa !== null ? `Ngành yêu cầu điểm TB tối thiểu ${minGpa} (thang 4).` : undefined}
              />
            </div>
            {minGpa !== null && edu.gpaScale === "4" && edu.gpa && Number(edu.gpa.replace(",", ".")) < minGpa && (
              <div className="mt-4">
                <Alert tone="warning">
                  Điểm trung bình {edu.gpa} thấp hơn mức tối thiểu {minGpa} của ngành. Bạn vẫn có thể nộp, nhưng hồ sơ có thể không đạt khi thẩm định.
                </Alert>
              </div>
            )}
          </div>
        )}

        {/* ---------------- Bước: ngoại ngữ */}
        {step === "language" && app && (
          <div>
            <h2 className="text-base font-bold text-gray-900">Năng lực ngoại ngữ</h2>
            <p className="mt-1 text-sm text-gray-500">
              Chuẩn đầu vào: ngoại ngữ {app.language.requiredLevel} theo Khung năng lực ngoại ngữ 6 bậc dùng cho Việt Nam. Chọn trường hợp của bạn.
            </p>
            <fieldset className="mt-5 flex flex-col gap-3">
              <legend className="sr-only">Trường hợp ngoại ngữ</legend>
              {(Object.keys(LANGUAGE_OPTION_TEXT) as LanguageOption[]).map((k) => {
                const active = lang.option === k;
                return (
                  <label key={k} className={`cursor-pointer rounded-input border-[1.5px] p-4 transition-colors ${active ? "border-accent bg-accent-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <span className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="language"
                        className="mt-1 h-4 w-4 shrink-0 accent-[#E8734A]"
                        checked={active}
                        onChange={() => {
                          setLang((l) => ({ ...l, option: k }));
                          setLangError("");
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block text-[15px] font-bold text-gray-900">{LANGUAGE_OPTION_TEXT[k].title}</span>
                        <span className="mt-0.5 block text-[13px] text-gray-600">{LANGUAGE_OPTION_TEXT[k].desc}</span>
                        {k === "TEST" && <span className="mt-1 block text-[13px] font-semibold text-accent">Lệ phí thi: {fmtMoney(app.otherFees.englishTest)} (cộng vào khoản nộp khi nộp hồ sơ)</span>}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            {lang.option === "EXEMPT" && (
              <div className="mt-4">
                <Textarea
                  label="Lý do được miễn"
                  required
                  rows={2}
                  maxLength={500}
                  value={lang.note}
                  onChange={(e) => setLang((l) => ({ ...l, note: e.target.value }))}
                  hint="Ghi rõ, ví dụ: bằng đại học ngành Ngôn ngữ Anh, Trường Đại học An Giang, năm 2019. Tải văn bằng làm minh chứng ở bước sau."
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {EXEMPT_REASONS.map((r) => (
                    <button key={r} type="button" onClick={() => setLang((l) => ({ ...l, note: r }))} className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:border-gray-300 hover:text-gray-900">
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {langError && <p className="mt-3 text-sm font-medium text-danger">{langError}</p>}
          </div>
        )}

        {/* ---------------- Bước: minh chứng */}
        {step === "documents" && app && (
          <div>
            <h2 className="text-base font-bold text-gray-900">Tải minh chứng</h2>
            <p className="mt-1 text-sm text-gray-500">Tệp PDF, JPG hoặc PNG, tối đa 5MB mỗi tệp, tổng tối đa 30MB. Bản scan cần rõ nét, đủ trang, có dấu và chữ ký.</p>
            <div className="mt-4 flex flex-col gap-2 rounded-input bg-navy-50 px-4 py-3 text-[13px] text-navy-800 sm:flex-row sm:items-center sm:justify-between">
              <span>
                <span className="font-semibold">Đơn đăng ký dự tuyển</span> được điền sẵn từ thông tin bạn đã khai. In ra, ký tên, chụp lại rồi tải lên mục bên dưới.
              </span>
              <Link href="/application/print" target="_blank" className="shrink-0 rounded-input bg-navy-800 px-4 py-2 text-center text-[13px] font-bold text-white hover:bg-navy-900">
                In đơn đăng ký
              </Link>
            </div>
            <div className="mt-5 flex flex-col gap-3">
              {app.requiredDocuments.map((t) => (
                <DocSlot
                  key={t}
                  type={t}
                  required
                  docs={docsByType[t] ?? []}
                  busy={uploading === t}
                  error={docErrors[t]}
                  canDelete={app.canEdit}
                  onUpload={(f) => upload(t, f)}
                  onDelete={removeDoc}
                  onError={(m) => setDocErrors((d) => ({ ...d, [t]: m }))}
                />
              ))}
            </div>

            <h3 className="mt-7 text-sm font-bold text-gray-900">Giấy tờ nếu có</h3>
            <p className="mt-1 text-xs text-gray-500">Giấy giới thiệu, chứng chỉ AI, giấy ưu tiên, công nhận văn bằng nước ngoài, công bố khoa học… giúp hội đồng xét đầy đủ hơn.</p>
            <div className="mt-3 flex flex-col gap-3">
              {optionalList.filter((t) => (docsByType[t]?.length ?? 0) > 0).map((t) => (
                <DocSlot
                  key={t}
                  type={t}
                  docs={docsByType[t] ?? []}
                  busy={uploading === t}
                  error={docErrors[t]}
                  canDelete={app.canEdit}
                  onUpload={(f) => upload(t, f)}
                  onDelete={removeDoc}
                  onError={(m) => setDocErrors((d) => ({ ...d, [t]: m }))}
                />
              ))}
              {optType && (
                <div className="flex flex-col gap-3 rounded-input bg-gray-50 p-3 sm:flex-row sm:items-end">
                  <div className="sm:w-64">
                    <Select label="Loại giấy tờ" value={optType} onChange={(e) => setOptionalType(e.target.value as DocumentType)}>
                      {freeOptional.map((t) => (
                        <option key={t} value={t}>
                          {DOC_LABEL[t]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <OptionalPicker busy={uploading === optType} onPick={(f) => upload(optType, f)} onError={(m) => setDocErrors((d) => ({ ...d, [optType]: m }))} />
                </div>
              )}
              {optType && docErrors[optType] && <p className="text-xs font-medium text-danger">{docErrors[optType]}</p>}
            </div>
          </div>
        )}

        {/* ---------------- Bước: đề tài nghiên cứu (tiến sĩ) */}
        {step === "research" && app && (
          <div>
            <h2 className="text-base font-bold text-gray-900">Đề tài nghiên cứu</h2>
            <p className="mt-1 text-sm text-gray-500">
              Khai tên đề tài theo đề cương đã tải lên. Nếu chọn giảng viên hướng dẫn mong muốn, hệ thống gửi đề nghị tới giảng viên khi bạn nộp hồ sơ.
            </p>
            {!(docsByType.DE_CUONG_NCS?.length ?? 0) ? (
              <div className="mt-5">
                <Alert tone="warning">
                  Hãy tải tệp Đề cương nghiên cứu ở bước Minh chứng trước.{" "}
                  <button type="button" className="font-bold underline" onClick={() => go("documents")}>
                    Quay lại bước Minh chứng
                  </button>
                </Alert>
              </div>
            ) : (
              <div className="mt-5 grid gap-4">
                <Textarea
                  label="Tên đề tài dự kiến"
                  required
                  rows={3}
                  maxLength={500}
                  value={proposal.researchTopic}
                  onChange={(e) => setProposal({ ...proposal, researchTopic: e.target.value })}
                  error={proposalError}
                  hint={`${proposal.researchTopic.trim().length}/500 ký tự`}
                />
                <Input label="Lĩnh vực nghiên cứu" placeholder="VD: Khoa học dữ liệu" maxLength={255} value={proposal.researchField} onChange={(e) => setProposal({ ...proposal, researchField: e.target.value })} />
                <Select
                  label="Giảng viên hướng dẫn mong muốn"
                  value={proposal.preferredLecturerId}
                  onChange={(e) => setProposal({ ...proposal, preferredLecturerId: e.target.value })}
                  hint="Không bắt buộc. Chưa chọn thì Hội đồng sẽ phân công sau."
                >
                  <option value="">Chưa chọn</option>
                  {lecturers.map((l) => (
                    <option key={l.lecturerId} value={l.lecturerId}>
                      {l.fullName}
                      {l.facultyName ? ` — ${l.facultyName}` : ""}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
        )}

        {/* ---------------- Bước: xác nhận & nộp */}
        {step === "review" && app && profile && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-base font-bold text-gray-900">Kiểm tra lại trước khi nộp</h2>
              <p className="mt-1 text-sm text-gray-500">Sau khi nộp, bạn không sửa được hồ sơ, trừ khi cán bộ yêu cầu bổ sung minh chứng.</p>
            </div>

            <Summary title="Thông tin cá nhân" edit={<Link href="/profile?next=/application/new" className="text-[13px] font-semibold text-accent hover:underline">Sửa</Link>}>
              <Item label="Họ và tên">{profile.fullName}</Item>
              <Item label="Ngày sinh">{fmtDate(profile.dob)}</Item>
              <Item label="Giới tính">{GENDER_LABEL[profile.gender ?? ""] ?? "—"}</Item>
              <Item label="Số CCCD">{profile.idNumber}</Item>
              <Item label="Điện thoại">{profile.phoneNumber}</Item>
              <Item label="Email">{profile.email}</Item>
              <Item label="Địa chỉ" wide>
                {profile.address}
              </Item>
            </Summary>

            <Summary title="Đăng ký dự tuyển" edit={app.canEdit ? <EditBtn onClick={() => go("major")} /> : null}>
              <Item label="Đợt tuyển sinh" wide>
                {app.batch.batchName}
              </Item>
              <Item label="Ngành">{app.major.majorName}</Item>
              <Item label="Bậc">{DEGREE_LABEL[app.degreeLevel]}</Item>
            </Summary>

            {app.education && (
              <Summary title="Quá trình đào tạo" edit={app.canEdit ? <EditBtn onClick={() => go("education")} /> : null}>
                <Item label="Trình độ">{EDU_LABEL[app.education.degreeLevel]}</Item>
                <Item label="Năm tốt nghiệp">{app.education.graduationYear}</Item>
                <Item label="Cơ sở đào tạo" wide>
                  {app.education.institutionName}
                </Item>
                <Item label="Ngành">{app.education.majorName}</Item>
                <Item label="Điểm TB">
                  {app.education.gpa ?? "—"} / {app.education.gpaScale}
                </Item>
              </Summary>
            )}

            <Summary title="Ngoại ngữ" edit={app.canEdit ? <EditBtn onClick={() => go("language")} /> : null}>
              {app.language.option ? (
                <>
                  <Item label="Trường hợp" wide>
                    {LANGUAGE_OPTION_TEXT[app.language.option].title}
                  </Item>
                  {app.language.note && (
                    <Item label="Lý do miễn" wide>
                      {app.language.note}
                    </Item>
                  )}
                </>
              ) : (
                <p className="text-sm font-semibold text-danger sm:col-span-2">Chưa khai thông tin ngoại ngữ.</p>
              )}
            </Summary>

            <Summary title={`Minh chứng (${app.documents.length} tệp)`} edit={app.canEdit ? <EditBtn onClick={() => go("documents")} /> : null}>
              <ul className="flex flex-col gap-1.5 sm:col-span-2">
                {app.documents.map((d) => (
                  <li key={d.documentId} className="flex justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-gray-800">
                      <span className="font-semibold">{DOC_LABEL[d.documentType]}:</span> {d.fileName}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">{fmtSize(d.fileSizeKb)}</span>
                  </li>
                ))}
                {app.missingDocuments.map((t) => (
                  <li key={t} className="text-sm font-semibold text-danger">
                    Thiếu: {DOC_LABEL[t]}
                  </li>
                ))}
              </ul>
            </Summary>

            {app.degreeLevel === "TIEN_SI" && (
              <Summary title="Đề tài nghiên cứu" edit={app.canEdit ? <EditBtn onClick={() => go("research")} /> : null}>
                {app.proposal ? (
                  <>
                    <Item label="Tên đề tài" wide>
                      {app.proposal.researchTopic}
                    </Item>
                    <Item label="Lĩnh vực">{app.proposal.researchField || "—"}</Item>
                    <Item label="GVHD mong muốn">{app.proposal.lecturerName ?? "Chưa chọn"}</Item>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-danger sm:col-span-2">Chưa khai đề tài nghiên cứu.</p>
                )}
              </Summary>
            )}

            <div className="rounded-input bg-navy-50 px-4 py-3 text-sm text-navy-800">
              <p className="font-semibold">Các khoản nộp khi nộp hồ sơ</p>
              <ul className="mt-2 space-y-1">
                {app.feeItems.map((f) => (
                  <li key={f.code} className="flex justify-between gap-3">
                    <span>{f.label}</span>
                    <span className="tabular-nums">{fmtMoney(f.amount)}</span>
                  </li>
                ))}
                <li className="flex justify-between gap-3 border-t border-navy-800/15 pt-1 font-bold">
                  <span>Tổng cộng</span>
                  <span className="tabular-nums">{fmtMoney(app.fee)}</span>
                </li>
              </ul>
              <p className="mt-2 text-xs">
                Sau khi nộp, trang hồ sơ hiện mã QR chuyển khoản. Hồ sơ chỉ được kết luận đạt khi đã nộp lệ phí. Nếu tốt nghiệp ngành gần, bạn có thể phải học bổ sung kiến thức ({fmtMoney(app.otherFees.supplementCredit)}/tín chỉ); phúc khảo hồ sơ {fmtMoney(app.otherFees.appeal)}/hồ sơ.
              </p>
            </div>

            <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-gray-700">
              <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#E8734A]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>
                Tôi cam kết thông tin khai và minh chứng nộp kèm là đúng sự thật, đã đọc{" "}
                <Link href="/announcements?category=QUY_DINH" target="_blank" className="font-semibold text-accent hover:underline">
                  quy định tuyển sinh
                </Link>{" "}
                và chịu trách nhiệm nếu có sai lệch.
              </span>
            </label>
          </div>
        )}

        {/* ---------------- Điều hướng */}
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" disabled={stepIndex === 0 || busy} onClick={() => go(steps[stepIndex - 1])}>
            ← Quay lại
          </Button>
          {step === "major" && (
            <Button disabled={!major} onClick={() => go("education")}>
              Tiếp tục
            </Button>
          )}
          {step === "education" && (
            <Button loading={busy} disabled={expired} onClick={saveEducation}>
              Lưu và tiếp tục
            </Button>
          )}
          {step === "language" && (
            <Button loading={busy} disabled={expired} onClick={saveLanguage}>
              Lưu và tiếp tục
            </Button>
          )}
          {step === "documents" && app && (
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <Button disabled={app.missingDocuments.length > 0 || uploading !== null} onClick={() => go(steps[stepIndex + 1])}>
                Tiếp tục
              </Button>
              {app.missingDocuments.length > 0 && <span className="text-xs text-gray-500">Còn thiếu: {app.missingDocuments.map((t) => DOC_LABEL[t]).join(", ")}</span>}
            </div>
          )}
          {step === "research" && (
            <Button loading={busy} disabled={!(docsByType.DE_CUONG_NCS?.length ?? 0) || expired} onClick={saveResearch}>
              Lưu và tiếp tục
            </Button>
          )}
          {step === "review" && app && (
            <Button loading={busy} disabled={!agree || expired || !app.language.option || app.missingDocuments.length > 0 || (app.degreeLevel === "TIEN_SI" && !app.proposal)} onClick={submit}>
              Nộp hồ sơ
            </Button>
          )}
        </div>
      </Card>

      {/* Hủy bản nháp */}
      {app && (
        <div className="mt-4 text-center">
          {confirmCancel ? (
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-input border border-gray-200 bg-white p-4">
              <p className="text-sm text-gray-700">Hủy bản nháp {app.applicationCode}? Các tệp đã tải lên của bản nháp này sẽ không dùng được nữa.</p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setConfirmCancel(false)} disabled={busy}>
                  Không
                </Button>
                <Button variant="outline" loading={busy} onClick={cancelDraft}>
                  Hủy bản nháp
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              Hồ sơ được lưu nháp tự động sau mỗi bước, bạn có thể quay lại hoàn thiện sau.{" "}
              <button type="button" className="font-semibold text-gray-500 underline hover:text-danger" onClick={() => setConfirmCancel(true)}>
                Hủy bản nháp
              </button>
            </p>
          )}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children, code }: { children: React.ReactNode; code?: string }) {
  return (
    <AppLayout>
      <div className="mx-auto max-w-[760px]">
        <h1 className="text-2xl font-extrabold text-gray-900">Tạo hồ sơ xét tuyển</h1>
        <p className="mt-1 text-sm text-gray-500">{code ? `Bản nháp ${code}` : "Hoàn thành từng bước, hồ sơ được lưu nháp để bạn quay lại sau."}</p>
        {children}
      </div>
    </AppLayout>
  );
}

function Summary({ title, edit, children }: { title: string; edit?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-input border border-gray-200 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {edit}
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Item({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="text-sm font-semibold text-gray-900">{children || "—"}</dd>
    </div>
  );
}

function EditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-[13px] font-semibold text-accent hover:underline">
      Sửa
    </button>
  );
}

function OptionalPicker({ busy, onPick, onError }: { busy: boolean; onPick: (f: File) => void; onError: (m: string) => void }) {
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

export default function WizardPage() {
  return (
    <Suspense fallback={null}>
      <WizardInner />
    </Suspense>
  );
}
