"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";

const steps = [
  { id: 1, label: "Thông tin cá nhân" },
  { id: 2, label: "Ngành & đợt tuyển sinh" },
  { id: 3, label: "Tải hồ sơ" },
  { id: 4, label: "Xác nhận & nộp" },
];

interface WizardData {
  fullName: string;
  dob: string;
  idNumber: string;
  degreeLevel: "THAC_SI" | "TIEN_SI";
  majorName: string;
  batchName: string;
  note: string;
  files: string[];
}

export default function WizardPage() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<WizardData>({
    fullName: "",
    dob: "",
    idNumber: "",
    degreeLevel: "THAC_SI",
    majorName: "",
    batchName: "Đợt tuyển sinh 2027",
    note: "",
    files: [],
  });
  const router = useRouter();

  function set<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const names = Array.from(e.target.files ?? []).map((f) => f.name);
    setData((d) => ({ ...d, files: [...d.files, ...names] }));
    e.target.value = "";
  }

  async function handleSubmit() {
    setSubmitting(true);
    // TODO (Backend): POST /applications với dữ liệu wizard này khi tích hợp thật.
    await new Promise((r) => setTimeout(r, 700));
    setSubmitting(false);
    router.push("/dashboard");
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[760px]">
        <h1 className="text-2xl font-extrabold text-gray-900">Tạo hồ sơ xét tuyển</h1>

        {/* Stepper */}
        <div className="mt-6 flex items-center">
          {steps.map((s, i) => (
            <div key={s.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                    step === s.id
                      ? "bg-accent text-white"
                      : step > s.id
                      ? "bg-success text-white"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {step > s.id ? "✓" : s.id}
                </div>
                <span
                  className={`hidden text-[11px] font-semibold sm:block ${
                    step === s.id ? "text-gray-900" : "text-gray-400"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`mx-2 h-[2px] flex-1 ${step > s.id ? "bg-success" : "bg-gray-100"}`} />
              )}
            </div>
          ))}
        </div>

        <Card className="mt-6 p-6">
          {step === 1 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input label="Họ và tên" required value={data.fullName} onChange={(e) => set("fullName", e.target.value)} />
              </div>
              <Input label="Ngày sinh" type="date" required value={data.dob} onChange={(e) => set("dob", e.target.value)} />
              <Input label="Số CCCD/CMND" required value={data.idNumber} onChange={(e) => set("idNumber", e.target.value)} />
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Bậc đào tạo"
                required
                value={data.degreeLevel}
                onChange={(e) => set("degreeLevel", e.target.value as WizardData["degreeLevel"])}
              >
                <option value="THAC_SI">Thạc sĩ</option>
                <option value="TIEN_SI">Tiến sĩ</option>
              </Select>
              <Select label="Đợt tuyển sinh" required value={data.batchName} onChange={(e) => set("batchName", e.target.value)}>
                <option>Đợt tuyển sinh 2027</option>
                <option>Đợt tuyển sinh 2027 (bổ sung)</option>
              </Select>
              <div className="sm:col-span-2">
                <Input
                  label="Ngành đăng ký"
                  required
                  placeholder="VD: Khoa học Máy tính"
                  value={data.majorName}
                  onChange={(e) => set("majorName", e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Textarea
                  label="Ghi chú thêm (không bắt buộc)"
                  hint="Ví dụ: nguyện vọng hướng nghiên cứu, hoàn cảnh đặc biệt cần lưu ý..."
                  value={data.note}
                  onChange={(e) => set("note", e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-input border-2 border-dashed border-gray-300 bg-gray-25 px-6 py-10 text-center hover:border-accent">
                <span className="text-3xl">📎</span>
                <span className="text-sm font-semibold text-gray-700">
                  Nhấn để chọn file hoặc kéo thả vào đây
                </span>
                <span className="text-xs text-gray-400">PDF/JPG/PNG, tối đa 5MB mỗi file, tổng tối đa 30MB</span>
                <input type="file" multiple className="hidden" onChange={handleFileSelect} accept=".pdf,.jpg,.jpeg,.png" />
              </label>

              {data.files.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  {data.files.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-input border border-gray-200 px-4 py-2.5 text-sm"
                    >
                      <span className="truncate text-gray-700">{f}</span>
                      <button
                        type="button"
                        onClick={() => setData((d) => ({ ...d, files: d.files.filter((_, idx) => idx !== i) }))}
                        className="text-gray-400 hover:text-danger"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-4">
              <div className="rounded-input bg-gray-50 p-4">
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-gray-400">Họ và tên</dt>
                    <dd className="font-semibold text-gray-900">{data.fullName || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Ngày sinh</dt>
                    <dd className="font-semibold text-gray-900">{data.dob || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Bậc đào tạo</dt>
                    <dd className="font-semibold text-gray-900">
                      {data.degreeLevel === "TIEN_SI" ? "Tiến sĩ" : "Thạc sĩ"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Ngành đăng ký</dt>
                    <dd className="font-semibold text-gray-900">{data.majorName || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Đợt tuyển sinh</dt>
                    <dd className="font-semibold text-gray-900">{data.batchName}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Số tài liệu đính kèm</dt>
                    <dd className="font-semibold text-gray-900">{data.files.length} file</dd>
                  </div>
                </dl>
              </div>
              <p className="text-xs text-gray-400">
                Bằng việc nộp hồ sơ, bạn xác nhận toàn bộ thông tin cung cấp là chính xác và chịu
                trách nhiệm về tính trung thực của hồ sơ.
              </p>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-5">
            <Button variant="ghost" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
              ← Quay lại
            </Button>
            {step < 4 ? (
              <Button onClick={() => setStep((s) => s + 1)}>Tiếp tục</Button>
            ) : (
              <Button onClick={handleSubmit} loading={submitting}>
                Nộp hồ sơ
              </Button>
            )}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
