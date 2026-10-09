// ============================================================================
// Tách thông tin từ CCCD / văn bằng (thuần xử lý chuỗi, không phụ thuộc trình duyệt).
// Dùng cho tính năng "Đọc tự động": kết quả chỉ là GỢI Ý, người dùng luôn kiểm tra lại.
// ============================================================================

export interface IdCardFields {
  idNumber?: string;
  oldIdNumber?: string;
  fullName?: string;
  dob?: string; // yyyy-mm-dd
  gender?: "NAM" | "NU";
  permanentAddress?: string;
  birthplace?: string;
  idIssueDate?: string; // yyyy-mm-dd
  idIssuePlace?: string;
}

const ISSUE_PLACES: { re: RegExp; label: string }[] = [
  { re: /QU[ẢA]N\s*L[ÝY]\s*H[ÀA]NH\s*CH[ÍI]NH/i, label: "Cục Cảnh sát quản lý hành chính về trật tự xã hội" },
  { re: /C[ƯU]\s*TR[ÚU]/i, label: "Cục Cảnh sát đăng ký quản lý cư trú và dữ liệu quốc gia về dân cư" },
  { re: /B[ỘO]\s*C[ÔO]NG\s*AN/i, label: "Bộ Công an" },
];

/** ddmmyyyy hoặc dd/mm/yyyy (dd-mm-yyyy, dd.mm.yyyy) -> yyyy-mm-dd; sai ngày thì trả undefined */
export function toIsoDate(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const m = s.trim().match(/^(\d{1,2})[/\-. ]?(\d{1,2})[/\-. ]?(\d{4})$/);
  if (!m) return undefined;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (y < 1900 || y > 2100 || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return undefined;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Mã QR trên CCCD gắn chip (mặt trước, góc trên bên phải):
 *   số CCCD | số CMND cũ | họ tên | ngày sinh ddmmyyyy | giới tính | nơi thường trú | ngày cấp ddmmyyyy
 * Đọc từ QR là chính xác tuyệt đối nên ưu tiên hơn đọc chữ.
 */
export function parseCccdQr(text: string): IdCardFields | null {
  const parts = text.split("|").map((x) => x.trim());
  if (parts.length < 6 || !/^\d{12}$/.test(parts[0])) return null;
  const g = (parts[4] ?? "").toLowerCase();
  return {
    idNumber: parts[0],
    oldIdNumber: /^\d{9}$/.test(parts[1] ?? "") ? parts[1] : undefined,
    fullName: parts[2] || undefined,
    dob: toIsoDate(parts[3]),
    gender: g.startsWith("nam") ? "NAM" : g.startsWith("n") ? "NU" : undefined,
    permanentAddress: parts[5] || undefined,
    idIssueDate: toIsoDate(parts[6]),
  };
}

/** Bỏ dấu, viết hoa, gộp khoảng trắng — để so tên trên giấy tờ với tên trong hồ sơ */
export function foldVi(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tìm các số 12 chữ số (số định danh), kể cả khi OCR tách thành nhóm có khoảng trắng */
export function findIdNumbers(text: string): string[] {
  const found = new Set<string>();
  const joined = text.replace(/(\d)[ \t]+(?=\d)/g, "$1");
  for (const m of joined.matchAll(/(?<!\d)(\d{12})(?!\d)/g)) found.add(m[1]);
  return [...found];
}

function findDates(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/(?<!\d)(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4})(?!\d)/g)) {
    const iso = toIsoDate(`${m[1]}/${m[2]}/${m[3]}`);
    if (iso) out.push(iso);
  }
  return out;
}

/** Lấy phần chữ sau một nhãn (VD "Nơi thường trú:") tới hết dòng, nối thêm 1 dòng sau nếu dòng đó không phải nhãn khác */
function valueAfter(lines: string[], label: RegExp): string | undefined {
  const i = lines.findIndex((l) => label.test(l));
  if (i < 0) return undefined;
  let v = lines[i].replace(label, "").replace(/^[\s:/.\-]*(Place of [a-z ]+)?[\s:/.\-]*/i, "").trim();
  const next = lines[i + 1]?.trim();
  if (next && !/:|^(C[óo] gi[áa] tr[ịi]|Date|Ng[àa]y|Qu[êe] qu[áa]n|N[ơo]i|Gi[ớo]i t[íi]nh|Qu[ốo]c t[ịi]ch)/i.test(next) && next.length > 3) v = `${v} ${next}`.trim();
  v = v.replace(/\s+/g, " ").replace(/[|_~]+/g, "").trim();
  return v.length >= 3 ? v : undefined;
}

/** Đọc chữ (OCR) mặt trước / mặt sau CCCD -> các trường đoán được */
export function parseCccdText(text: string): IdCardFields {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const upper = foldVi(text);
  const out: IdCardFields = {};
  const ids = findIdNumbers(text);
  if (ids.length) out.idNumber = ids[0];

  const isBack = /CUC TRUONG|CUC CANH SAT|BO CONG AN|DAC DIEM NHAN DANG|NGON TRO|IDVNM/.test(upper);
  const dates = findDates(text);
  if (isBack) {
    // Mặt sau: "Ngày, tháng, năm / Date, month, year: 12/03/2022" là ngày cấp
    const issueLine = lines.find((l) => /Ng[àa]y\s*,?\s*th[áa]ng\s*,?\s*n[ăa]m|Date\s*,?\s*month/i.test(l) && findDates(l).length);
    out.idIssueDate = issueLine ? findDates(issueLine)[0] : dates[0];
    for (const p of ISSUE_PLACES) {
      if (p.re.test(text) || p.re.test(upper)) {
        out.idIssuePlace = p.label;
        break;
      }
    }
    const bp = valueAfter(lines, /N[ơo]i\s*đ[ăa]ng\s*k[ýy]\s*khai\s*sinh/i);
    if (bp) out.birthplace = bp;
    const pr = valueAfter(lines, /N[ơo]i\s*c[ưu]\s*tr[úu]/i);
    if (pr) out.permanentAddress = pr;
  } else {
    const pr = valueAfter(lines, /N[ơo]i\s*th[ưu][ờo]ng\s*tr[úu]/i);
    if (pr) out.permanentAddress = pr;
    const dobLine = lines.find((l) => /Ng[àa]y\s*sinh|Date of birth/i.test(l) && findDates(l).length);
    if (dobLine) out.dob = findDates(dobLine)[0];
    const nameIdx = lines.findIndex((l) => /H[ọo]\s*(v[àa]\s*)?t[êe]n|Full name/i.test(l));
    if (nameIdx >= 0) {
      const sameLine = lines[nameIdx].replace(/.*(Full name|t[êe]n)[\s:/]*/i, "").trim();
      const cand = sameLine.length >= 4 ? sameLine : lines[nameIdx + 1] ?? "";
      if (/^[A-ZÀ-Ỹ\s]{4,}$/u.test(cand.trim())) out.fullName = cand.trim();
    }
    if (/Gi[ớo]i\s*t[íi]nh[^\n]*N[ữu]\b/i.test(text)) out.gender = "NU";
    else if (/Gi[ớo]i\s*t[íi]nh[^\n]*Nam\b/i.test(text)) out.gender = "NAM";
  }
  return out;
}

export interface DocumentFindings {
  idNumbers: string[];
  diplomaNo?: string;
  registryNo?: string;
  nameFound: boolean;
}

/** Văn bằng / chứng chỉ / CCCD do thí sinh nộp: tìm số định danh, số hiệu, số vào sổ, họ tên */
export function findInDocument(text: string, fullName: string): DocumentFindings {
  const pick = (re: RegExp) => text.match(re)?.[1]?.replace(/[.,;]+$/, "").trim();
  const name = foldVi(fullName);
  return {
    idNumbers: findIdNumbers(text),
    diplomaNo: pick(/S[ốo]\s*hi[ệe]u\s*(?:v[ăa]n\s*b[ằa]ng)?\s*[:.]?\s*([\p{Lu}\d][\p{Lu}\d/\-.]{3,})/iu),
    registryNo: pick(/S[ốo]\s*v[àa]o\s*s[ổo]\s*(?:c[ấa]p\s*(?:v[ăa]n\s*)?b[ằa]ng)?\s*[:.]?\s*([\p{Lu}\d][\p{Lu}\d/\-.]{1,})/iu),
    nameFound: name.length > 3 && foldVi(text).includes(name),
  };
}
