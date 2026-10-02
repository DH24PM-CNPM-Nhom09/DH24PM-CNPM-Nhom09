"use client";

import { useEffect, useState, type FormEvent } from "react";
import { RequirePermission } from "@/components/admin/AdminShell";
import { Btn, ErrorBox, fieldCls, Label, Notice, PageHeader, Panel, Skeleton, useToast } from "@/components/admin/ui";
import { getPaymentSettings, updatePaymentSettings, type PaymentSettings } from "@/lib/admin/api";
import { errorMessage, fmtMoney } from "@/lib/admin/format";
import { useAsync } from "@/lib/admin/useAsync";

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
  const bankReady = Boolean(form.bankName.trim() && form.accountNo.trim() && form.accountName.trim());

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setFormError("");
    if (!Number.isInteger(form.feeThacSi) || !Number.isInteger(form.feeTienSi) || form.feeThacSi < 0 || form.feeTienSi < 0)
      return setFormError("Lệ phí phải là số tiền hợp lệ (đồng).");
    const parts = [form.bankName, form.accountNo, form.accountName].map((x) => x.trim());
    if (parts.some(Boolean) && !parts.every(Boolean)) return setFormError("Điền đủ ngân hàng, số tài khoản và tên chủ tài khoản (hoặc để trống cả ba).");
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
              <input id="bank" className={fieldCls} value={form.bankName} maxLength={200} placeholder="Tên ngân hàng, chi nhánh" onChange={(e) => set("bankName", e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="acc-no">Số tài khoản</Label>
                <input id="acc-no" inputMode="numeric" className={`${fieldCls} font-mono`} value={form.accountNo} maxLength={40} onChange={(e) => set("accountNo", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="acc-name">Tên chủ tài khoản</Label>
                <input id="acc-name" className={`${fieldCls} uppercase`} value={form.accountName} maxLength={200} onChange={(e) => set("accountName", e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Thí sinh được hướng dẫn ghi nội dung chuyển khoản là <span className="font-mono text-gray-700">&lt;mã hồ sơ&gt; &lt;mã thí sinh&gt;</span>. Cán bộ đối chiếu sao kê theo nội dung này rồi bấm
              “Xác nhận đã thu” trong trang chi tiết hồ sơ.
            </p>
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
