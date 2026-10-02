"use client";

import { useEffect, useState, type FormEvent } from "react";
import { RequirePermission } from "@/components/admin/AdminShell";
import { Btn, ErrorBox, fieldCls, Label, Notice, PageHeader, Panel, Skeleton, useToast } from "@/components/admin/ui";
import { getPaymentSettings, updatePaymentSettings, type PaymentSettings } from "@/lib/admin/api";
import { errorMessage, fmtMoney } from "@/lib/admin/format";
import { useAsync } from "@/lib/admin/useAsync";
import VietQrCode from "@/components/payment/VietQrCode";
import { BANKS, bankByBin } from "@/lib/vietqr";

/** Cán bộ tuyển sinh cấu hình mức lệ phí và tài khoản nhận chuyển khoản hiển thị cho thí sinh */
function Inner() {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => getPaymentSettings(), []);
  const [form, setForm] = useState<PaymentSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (error) return <ErrorBox message={error} onRetry={() => reload()} />;
  if (loading || !form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const set = <K extends keyof PaymentSettings>(k: K, v: PaymentSettings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const bankReady = Boolean(form.bankBin && form.accountNo.trim() && form.accountName.trim());
  const accountOk = /^[0-9A-Za-z]{4,19}$/.test(form.accountNo.trim());

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setFormError("");
    if (!Number.isInteger(form.feeThacSi) || !Number.isInteger(form.feeTienSi) || form.feeThacSi < 0 || form.feeTienSi < 0)
      return setFormError("Lệ phí phải là số tiền hợp lệ (đồng).");
    const parts = [form.bankBin, form.accountNo, form.accountName].map((x) => x.trim());
    if (parts.some(Boolean) && !parts.every(Boolean)) return setFormError("Chọn ngân hàng và điền đủ số tài khoản, tên chủ tài khoản (hoặc để trống cả ba).");
    if (form.accountNo.trim() && !accountOk) return setFormError("Số tài khoản gồm 4–19 chữ số, không có dấu cách hay gạch ngang.");
    setSaving(true);
    try {
      setForm(await updatePaymentSettings(form));
      toast("Đã lưu cấu hình lệ phí.");
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Lệ phí & thanh toán"
        description="Mức lệ phí xét tuyển và tài khoản nhận chuyển khoản hiển thị cho thí sinh sau khi nộp hồ sơ. Mức lệ phí mới áp dụng cho hồ sơ nộp từ thời điểm lưu; hồ sơ đã nộp giữ nguyên số tiền cũ."
      />
      <form onSubmit={save} className="space-y-5" noValidate>
        <Panel title="Mức lệ phí xét tuyển">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="fee-ths" required>
                Thạc sĩ (đồng)
              </Label>
              <input id="fee-ths" inputMode="numeric" className={fieldCls} value={form.feeThacSi} onChange={(e) => set("feeThacSi", Number(e.target.value.replace(/\D/g, "")) || 0)} />
              <p className="mt-1 text-xs text-gray-500">{fmtMoney(form.feeThacSi)}</p>
            </div>
            <div>
              <Label htmlFor="fee-ts" required>
                Tiến sĩ (đồng)
              </Label>
              <input id="fee-ts" inputMode="numeric" className={fieldCls} value={form.feeTienSi} onChange={(e) => set("feeTienSi", Number(e.target.value.replace(/\D/g, "")) || 0)} />
              <p className="mt-1 text-xs text-gray-500">{fmtMoney(form.feeTienSi)}</p>
            </div>
          </div>
        </Panel>

        <Panel title="Tài khoản nhận chuyển khoản">
          <div className="grid gap-4">
            {!bankReady && (
              <Notice>
                Chưa có tài khoản nhận lệ phí. Thí sinh sẽ được hướng dẫn nộp trực tiếp tại Phòng Đào tạo Sau đại học. Chỉ điền tài khoản chính thức của Trường.
              </Notice>
            )}
            <div>
              <Label htmlFor="bank">Ngân hàng</Label>
              <select
                id="bank"
                className={fieldCls}
                value={form.bankBin}
                onChange={(e) => {
                  const b = bankByBin(e.target.value);
                  setForm((f) => (f ? { ...f, bankBin: b?.bin ?? "", bankName: b ? `${b.short} - ${b.name}` : "" } : f));
                }}
              >
                <option value="">Chọn ngân hàng</option>
                {BANKS.map((b) => (
                  <option key={b.bin} value={b.bin}>
                    {b.short} - {b.name}
                  </option>
                ))}
              </select>
              {!form.bankBin && form.bankName && <p className="mt-1 text-xs text-[#92400E]">Đang lưu “{form.bankName}”. Chọn lại ngân hàng trong danh sách để tạo được mã QR.</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="acc-no">Số tài khoản</Label>
                <input id="acc-no" inputMode="numeric" className={`${fieldCls} font-mono`} value={form.accountNo} maxLength={19} onChange={(e) => set("accountNo", e.target.value.replace(/[\s-]/g, ""))} />
              </div>
              <div>
                <Label htmlFor="acc-name">Tên chủ tài khoản</Label>
                <input id="acc-name" className={`${fieldCls} uppercase`} value={form.accountName} maxLength={200} onChange={(e) => set("accountName", e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Mỗi thí sinh nhận một mã VietQR riêng, đã điền sẵn số tiền và nội dung chuyển khoản là mã hồ sơ bỏ dấu gạch (ví dụ <span className="font-mono text-gray-700">THS2026D2834010100050</span>). Cán bộ đối chiếu sao kê, dán nội dung này vào ô tìm kiếm ở trang Hồ sơ xét tuyển để mở đúng hồ sơ, rồi bấm “Xác nhận đã thu”.
            </p>
            {form.bankBin && accountOk && (
              <div className="flex flex-col items-center gap-3 rounded-input border border-dashed border-gray-300 p-4 sm:flex-row sm:items-start">
                <VietQrCode bin={form.bankBin} accountNo={form.accountNo.trim()} amount={form.feeThacSi} note="THS2026D2834010100001" size={168} fileName="ma-qr-xem-truoc" />
                <div className="text-[13px] text-gray-600">
                  <p className="font-semibold text-gray-900">Xem trước mã QR của thí sinh</p>
                  <p className="mt-1">
                    Ví dụ hồ sơ thạc sĩ: {fmtMoney(form.feeThacSi)}, nội dung “THS2026D2834010100001”. Hãy quét thử bằng app ngân hàng (không cần chuyển) để kiểm tra app hiện đúng tên chủ tài khoản <span className="font-semibold uppercase">{form.accountName || "…"}</span> trước khi lưu.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Panel>

        {formError && <ErrorBox message={formError} />}
        <div className="flex justify-end">
          <Btn type="submit" variant="primary" loading={saving}>
            Lưu cấu hình
          </Btn>
        </div>
      </form>
    </div>
  );
}

export default function PaymentSettingsPage() {
  return (
    <RequirePermission perm="batch:manage">
      <Inner />
    </RequirePermission>
  );
}
