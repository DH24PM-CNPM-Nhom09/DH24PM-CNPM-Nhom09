"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Input, Select, Textarea } from "@/components/ui/Input";
import type { Candidate } from "@/lib/types";

/** Nơi cấp in ở mặt sau thẻ (CMND cũ 9 số không dùng được vì hồ sơ yêu cầu số định danh 12 số) */
export const ID_ISSUE_PLACES = [
  "Bộ Công an",
  "Cục Cảnh sát quản lý hành chính về trật tự xã hội",
  "Cục Cảnh sát đăng ký quản lý cư trú và dữ liệu quốc gia về dân cư",
];
export const OTHER_PLACE = "__OTHER__";

export interface DeclForm {
  idNumber: string;
  idIssueDate: string;
  idIssuePlaceChoice: string;
  idIssuePlaceOther: string;
  birthplace: string;
  ethnicity: string;
  phoneNumber: string;
  permanentAddress: string;
  address: string;
  sameAddress: boolean;
}
export type DeclErrors = Partial<Record<keyof DeclForm, string>>;

export function declFromProfile(p: Candidate): DeclForm {
  const place = p.idIssuePlace ?? "";
  const known = ID_ISSUE_PLACES.includes(place);
  return {
    idNumber: p.idNumber ?? "",
    idIssueDate: p.idIssueDate ?? "",
    idIssuePlaceChoice: place ? (known ? place : OTHER_PLACE) : "",
    idIssuePlaceOther: place && !known ? place : "",
    birthplace: p.birthplace ?? "",
    ethnicity: p.ethnicity ?? "Kinh",
    phoneNumber: p.phoneNumber ?? "",
    permanentAddress: p.permanentAddress ?? "",
    address: p.address ?? "",
    sameAddress: !!p.permanentAddress && p.permanentAddress === p.address,
  };
}

export function issuePlace(d: DeclForm) {
  return (d.idIssuePlaceChoice === OTHER_PLACE ? d.idIssuePlaceOther : d.idIssuePlaceChoice).trim().replace(/\s+/g, " ");
}

/** Kiểm tra giống backend (PUT /applications/me/declaration) */
export function validateDecl(d: DeclForm, dob: string): DeclErrors {
  const e: DeclErrors = {};
  const today = new Date().toISOString().slice(0, 10);
  if (!/^\d{12}$/.test(d.idNumber.replace(/\s/g, ""))) e.idNumber = "Số CCCD gồm đúng 12 chữ số.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.idIssueDate)) e.idIssueDate = "Chọn ngày cấp.";
  else if (d.idIssueDate > today) e.idIssueDate = "Ngày cấp không được sau hôm nay.";
  else if (dob && d.idIssueDate < dob) e.idIssueDate = "Ngày cấp không được trước ngày sinh.";
  if (!d.idIssuePlaceChoice) e.idIssuePlaceChoice = "Chọn nơi cấp.";
  else if (d.idIssuePlaceChoice === OTHER_PLACE && d.idIssuePlaceOther.trim().length < 3) e.idIssuePlaceOther = "Ghi nơi cấp đúng như mặt sau thẻ.";
  if (d.birthplace.trim().length < 2) e.birthplace = "Nhập nơi sinh.";
  if (d.ethnicity.trim().length < 2) e.ethnicity = "Nhập dân tộc.";
  if (!/^0\d{9}$/.test(d.phoneNumber.replace(/[\s.]/g, ""))) e.phoneNumber = "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.";
  if (d.permanentAddress.trim().length < 5) e.permanentAddress = "Nhập nơi thường trú như trên CCCD.";
  if (!d.sameAddress && d.address.trim().length < 5) e.address = "Nhập địa chỉ liên hệ.";
  return e;
}

const GENDER_LABEL: Record<string, string> = { NAM: "Nam", NU: "Nữ", KHAC: "Khác" };

function ReadOnly({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-gray-900">{children || "—"}</p>
    </div>
  );
}

/**
 * Khối "Thông tin cá nhân" ở đầu bước Minh chứng: thí sinh khai lại thông tin theo CCCD
 * (giống mẫu khai trên cổng thông tin sinh viên của trường) trước khi tải minh chứng.
 */
export default function DeclarationForm({
  value,
  onChange,
  errors,
  profile,
  disabled,
  autoFill,
}: {
  value: DeclForm;
  onChange: (v: DeclForm) => void;
  errors: DeclErrors;
  profile: Candidate;
  disabled?: boolean;
  autoFill?: ReactNode;
}) {
  const set = <K extends keyof DeclForm>(k: K, v: DeclForm[K]) => onChange({ ...value, [k]: v });
  const dobVi = profile.dob ? profile.dob.split("-").reverse().join("/") : "";

  return (
    <section className="rounded-card border border-gray-200 bg-gray-25 p-4 sm:p-5" aria-labelledby="decl-title">
      <div>
        <h3 id="decl-title" className="text-[15px] font-bold text-gray-900">
          1. Thông tin cá nhân <span className="font-normal text-gray-500">(khai đúng theo Căn cước công dân)</span>
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          Mục có dấu <span className="font-semibold text-danger">*</span> là bắt buộc. Thông tin này in lên đơn đăng ký và dùng để đối chiếu với minh chứng.
        </p>
      </div>
      {autoFill && <div className="mt-4">{autoFill}</div>}

      <div className="mt-4 grid gap-3 rounded-input border border-gray-100 bg-white p-3 sm:grid-cols-3">
        <ReadOnly label="Họ và tên">{profile.fullName}</ReadOnly>
        <ReadOnly label="Ngày sinh">{dobVi}</ReadOnly>
        <ReadOnly label="Giới tính">{GENDER_LABEL[profile.gender ?? ""] ?? ""}</ReadOnly>
        <p className="text-xs text-gray-500 sm:col-span-3">
          Sai họ tên, ngày sinh hoặc giới tính?{" "}
          <Link href="/profile?next=/application/new" className="font-semibold text-accent hover:underline">
            Sửa ở Hồ sơ cá nhân
          </Link>
        </p>
      </div>

      <fieldset disabled={disabled} className="mt-4 grid gap-4 sm:grid-cols-2">
        <Input
          label="Số CC/CCCD"
          required
          inputMode="numeric"
          maxLength={12}
          placeholder="12 chữ số"
          value={value.idNumber}
          onChange={(e) => set("idNumber", e.target.value.replace(/\D/g, "").slice(0, 12))}
          error={errors.idNumber}
        />
        <Input label="Ngày cấp CC/CCCD" required type="date" max={new Date().toISOString().slice(0, 10)} value={value.idIssueDate} onChange={(e) => set("idIssueDate", e.target.value)} error={errors.idIssueDate} />
        <div className="sm:col-span-2">
          <Select
            label="Nơi cấp CC/CCCD"
            required
            value={value.idIssuePlaceChoice}
            onChange={(e) => set("idIssuePlaceChoice", e.target.value)}
            error={errors.idIssuePlaceChoice}
            hint="Xem nơi cấp ở mặt sau Căn cước / Căn cước công dân."
          >
            <option value="">Chọn nơi cấp</option>
            {ID_ISSUE_PLACES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value={OTHER_PLACE}>Khác (tự ghi)</option>
          </Select>
        </div>
        {value.idIssuePlaceChoice === OTHER_PLACE && (
          <div className="sm:col-span-2">
            <Input label="Ghi nơi cấp" required maxLength={255} value={value.idIssuePlaceOther} onChange={(e) => set("idIssuePlaceOther", e.target.value)} error={errors.idIssuePlaceOther} />
          </div>
        )}
        <Input label="Nơi sinh" required maxLength={255} placeholder="VD: An Giang" value={value.birthplace} onChange={(e) => set("birthplace", e.target.value)} error={errors.birthplace} />
        <Input label="Dân tộc" required maxLength={50} value={value.ethnicity} onChange={(e) => set("ethnicity", e.target.value)} error={errors.ethnicity} />
        <Input
          label="Số điện thoại liên hệ khi cần thiết"
          required
          inputMode="tel"
          maxLength={12}
          placeholder="VD: 0912345678"
          value={value.phoneNumber}
          onChange={(e) => set("phoneNumber", e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
          error={errors.phoneNumber}
        />
        <div className="hidden sm:block" />
        <div className="sm:col-span-2">
          <Textarea
            label="Nơi thường trú"
            required
            rows={2}
            className="min-h-[72px]"
            maxLength={1000}
            placeholder="Ghi đúng như mục Nơi thường trú trên CCCD"
            value={value.permanentAddress}
            onChange={(e) => onChange({ ...value, permanentAddress: e.target.value, ...(value.sameAddress ? { address: e.target.value } : {}) })}
            error={errors.permanentAddress}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-2 flex items-center gap-2 text-[13px] text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#E8734A]"
              checked={value.sameAddress}
              onChange={(e) => onChange({ ...value, sameAddress: e.target.checked, ...(e.target.checked ? { address: value.permanentAddress } : {}) })}
            />
            Địa chỉ liên hệ giống nơi thường trú
          </label>
          {!value.sameAddress && (
            <Textarea
              label="Địa chỉ liên hệ (nhận giấy báo, thư từ)"
              required
              rows={2}
              className="min-h-[72px]"
              maxLength={1000}
              value={value.address}
              onChange={(e) => set("address", e.target.value)}
              error={errors.address}
            />
          )}
        </div>
      </fieldset>
    </section>
  );
}
