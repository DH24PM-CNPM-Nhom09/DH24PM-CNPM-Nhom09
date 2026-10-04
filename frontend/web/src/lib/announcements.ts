// ============================================================================
// Thông báo tuyển sinh / quy định + đợt đang mở đăng ký.
// Dùng chung cho cổng Thí sinh (xem, không cần đăng nhập) và cổng Quản lý (soạn, đăng, gỡ).
//
// Backend thật:
//   GET   /public/announcements?category&q&page&pageSize   (công khai)
//   GET   /public/announcements/{id}                         (công khai)
//   GET   /public/open-batches                               (công khai)
//   GET   /admin/announcements?status&category&q             (announcement:manage)
//   POST  /admin/announcements                               (announcement:manage)
//   PUT   /admin/announcements/{id}                          (announcement:manage)
//   PATCH /admin/announcements/{id}/status                   (announcement:manage)
// Chế độ dữ liệu mẫu: lưu trong localStorage của trình duyệt.
// ============================================================================
import { readSession } from "./admin/session";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";
const PUBLIC_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";
const ADMIN_MOCK = process.env.NEXT_PUBLIC_ADMIN_USE_MOCK !== "false";

export type AnnouncementCategory = "TUYEN_SINH" | "QUY_DINH" | "HUONG_DAN" | "KET_QUA";
export type AnnouncementStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export const CATEGORY_LABEL: Record<AnnouncementCategory, string> = {
  TUYEN_SINH: "Tuyển sinh",
  QUY_DINH: "Quy định - Quy chế",
  HUONG_DAN: "Hướng dẫn",
  KET_QUA: "Lịch thi - Kết quả",
};
export const CATEGORY_TONE: Record<AnnouncementCategory, string> = {
  TUYEN_SINH: "bg-accent-50 text-[#A9441F]",
  QUY_DINH: "bg-navy-50 text-navy-800",
  HUONG_DAN: "bg-[#EAF7EE] text-[#166534]",
  KET_QUA: "bg-[#EAF1FE] text-[#1D4ED8]",
};
export const STATUS_LABEL: Record<AnnouncementStatus, string> = { DRAFT: "Bản nháp", PUBLISHED: "Đang hiển thị", ARCHIVED: "Đã gỡ" };

export interface Announcement {
  announcementId: number;
  title: string;
  category: AnnouncementCategory;
  isPinned: boolean;
  status: AnnouncementStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  batch: { batchId: number; batchName: string } | null;
  createdByName: string | null;
  excerpt: string;
  content?: string;
}

export interface OpenBatch {
  batchId: number;
  batchCode: string;
  batchName: string;
  degreeLevel: "THAC_SI" | "TIEN_SI";
  registrationStartAt: string;
  registrationEndAt: string;
  examStartAt: string | null;
  examEndAt: string | null;
  legalBasis: string | null;
  majors: {
    batchMajorId: number;
    majorCode: string;
    majorName: string;
    facultyName: string | null;
    quota: number;
    conditions: { description: string; minGpa: number | null; requiredCertificate: string | null; isMandatory: boolean }[];
    subjects: { subjectName: string; examFormat: "THI_VIET" | "PHONG_VAN" | "XET_HO_SO"; weight: number | null }[];
  }[];
}

export const EXAM_FORMAT_LABEL: Record<string, string> = { THI_VIET: "Thi viết", PHONG_VAN: "Phỏng vấn", XET_HO_SO: "Xét hồ sơ" };

export interface AnnouncementInput {
  title: string;
  content: string;
  category: AnnouncementCategory;
  batchId: number | null;
  isPinned: boolean;
}

// ---------------------------------------------------------------------------- gọi API
async function call<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      ...options,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    });
  } catch {
    throw { error_code: "NETWORK", message: "Không kết nối được máy chủ. Kiểm tra backend đã chạy chưa." };
  }
  if (!res.ok) throw await res.json().catch(() => ({ error_code: "UNKNOWN", message: "Đã có lỗi xảy ra." }));
  return res.json();
}

// ---------------------------------------------------------------------------- dữ liệu mẫu
const MOCK_KEY = "ts_mock_announcements_v1";
const day = 86_400_000;

function seed(): Announcement[] {
  const now = Date.now();
  const mk = (id: number, title: string, category: AnnouncementCategory, daysAgo: number, content: string, extra: Partial<Announcement> = {}): Announcement => ({
    announcementId: id,
    title,
    category,
    isPinned: false,
    status: "PUBLISHED",
    publishedAt: new Date(now - daysAgo * day).toISOString(),
    createdAt: new Date(now - daysAgo * day).toISOString(),
    updatedAt: null,
    batch: null,
    createdByName: "Nguyễn Thị Thu Hà",
    excerpt: content.replace(/\s+/g, " ").slice(0, 200),
    content,
    ...extra,
  });
  return [
    mk(1, "Thông báo tuyển sinh thạc sĩ đợt 2 năm 2026", "TUYEN_SINH", 45,
      "Trường Đại học An Giang thông báo tuyển sinh thạc sĩ đợt 2 năm 2026.\n\n1. Ngành và chỉ tiêu\n- Khoa học máy tính: 30 chỉ tiêu\n- Quản trị kinh doanh: 40 chỉ tiêu\n- Ngôn ngữ Anh: 25 chỉ tiêu\n\n2. Hình thức nộp hồ sơ\nThí sinh đăng ký tài khoản, khai thông tin và tải minh chứng trên Cổng thông tin tuyển sinh.",
      { isPinned: true, batch: { batchId: 1, batchName: "Tuyển sinh thạc sĩ đợt 2 năm 2026" } }),
    mk(2, "Quy định về tệp minh chứng nộp trực tuyến", "QUY_DINH", 40,
      "- Chỉ nhận tệp PDF, JPG hoặc PNG.\n- Mỗi tệp tối đa 5 MB; tổng dung lượng một hồ sơ tối đa 30 MB.\n- Bản scan phải rõ nét, đủ trang, không chỉnh sửa.", { isPinned: true }),
    mk(3, "Hướng dẫn đăng ký tài khoản và nộp hồ sơ trực tuyến", "HUONG_DAN", 38,
      "Bước 1. Đăng ký tài khoản và nhập mã xác thực gửi về email.\nBước 2. Hoàn thiện hồ sơ cá nhân.\nBước 3. Tạo hồ sơ xét tuyển, tải minh chứng và nộp.\nBước 4. Nộp lệ phí và theo dõi trạng thái."),
    mk(4, "Thông báo tiến độ xét duyệt hồ sơ thạc sĩ đợt 1 năm 2026", "KET_QUA", 6,
      "Đợt 1 năm 2026 đã đóng cổng nhận hồ sơ và đang trong giai đoạn thẩm định. Kết quả sẽ được công bố trên cổng."),
  ];
}

function mockAll(): Announcement[] {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(MOCK_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* bỏ qua */
  }
  const s = seed();
  mockSave(s);
  return s;
}
function mockSave(list: Announcement[]) {
  try {
    localStorage.setItem(MOCK_KEY, JSON.stringify(list));
  } catch {
    /* bỏ qua */
  }
}
const delay = <T,>(v: T, ms = 250) => new Promise<T>((r) => setTimeout(() => r(v), ms));
const sortPublic = (a: Announcement, b: Announcement) =>
  Number(b.isPinned) - Number(a.isPinned) || (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");

function mockOpenBatches(): OpenBatch[] {
  const now = Date.now();
  return [
    {
      batchId: 1,
      batchCode: "THS-2026-D2",
      batchName: "Tuyển sinh thạc sĩ đợt 2 năm 2026",
      degreeLevel: "THAC_SI",
      registrationStartAt: new Date(now - 45 * day).toISOString(),
      registrationEndAt: new Date(now + 14 * day).toISOString(),
      examStartAt: new Date(now + 30 * day).toISOString(),
      examEndAt: new Date(now + 32 * day).toISOString(),
      legalBasis: "Thông tư 53/2026/TT-BGDĐT",
      majors: [
        {
          batchMajorId: 1, majorCode: "8480101", majorName: "Khoa học máy tính", facultyName: "Khoa Công nghệ thông tin", quota: 30,
          conditions: [{ description: "Tốt nghiệp đại học ngành phù hợp.", minGpa: null, requiredCertificate: null, isMandatory: true }],
          subjects: [{ subjectName: "Cơ sở ngành", examFormat: "THI_VIET", weight: 0.5 }, { subjectName: "Phỏng vấn chuyên môn", examFormat: "PHONG_VAN", weight: 0.5 }],
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------- công khai
export async function getAnnouncements(q: { category?: AnnouncementCategory | ""; q?: string; page?: number; pageSize?: number } = {}) {
  const page = q.page ?? 1;
  const pageSize = q.pageSize ?? 20;
  if (PUBLIC_MOCK) {
    let list = mockAll().filter((a) => a.status === "PUBLISHED");
    if (q.category) list = list.filter((a) => a.category === q.category);
    if (q.q?.trim()) list = list.filter((a) => (a.title + " " + (a.content ?? "")).toLowerCase().includes(q.q!.trim().toLowerCase()));
    list.sort(sortPublic);
    return delay({ items: list.slice((page - 1) * pageSize, page * pageSize), total: list.length, page, pageSize });
  }
  const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (q.category) p.set("category", q.category);
  if (q.q?.trim()) p.set("q", q.q.trim());
  return call<{ items: Announcement[]; total: number; page: number; pageSize: number }>(`/public/announcements?${p}`);
}

export async function getAnnouncement(id: number): Promise<Announcement> {
  if (PUBLIC_MOCK) {
    const a = mockAll().find((x) => x.announcementId === id && x.status === "PUBLISHED");
    if (!a) throw { error_code: "NOT_FOUND", message: "Thông báo không tồn tại hoặc đã được gỡ." };
    return delay(a);
  }
  return call<Announcement>(`/public/announcements/${id}`);
}

export async function getOpenBatches(): Promise<OpenBatch[]> {
  if (PUBLIC_MOCK) return delay(mockOpenBatches());
  return call<OpenBatch[]>("/public/open-batches");
}

// ---------------------------------------------------------------------------- cán bộ
const adminToken = () => readSession()?.accessToken ?? null;

export async function adminListAnnouncements(q: { status?: string; category?: string; q?: string } = {}): Promise<Announcement[]> {
  if (ADMIN_MOCK) {
    let list = mockAll();
    if (q.status) list = list.filter((a) => a.status === q.status);
    if (q.category) list = list.filter((a) => a.category === q.category);
    if (q.q?.trim()) list = list.filter((a) => a.title.toLowerCase().includes(q.q!.trim().toLowerCase()));
    return delay([...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }
  const p = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => v && p.set(k, v));
  return call<Announcement[]>(`/admin/announcements?${p}`, {}, adminToken());
}

function validate(input: AnnouncementInput) {
  if (input.title.trim().length < 10) throw { error_code: "VALIDATION", message: "Tiêu đề cần từ 10 đến 255 ký tự." };
  if (input.content.trim().length < 30) throw { error_code: "VALIDATION", message: "Nội dung thông báo cần ít nhất 30 ký tự." };
}

export async function adminCreateAnnouncement(input: AnnouncementInput & { publish: boolean }): Promise<Announcement> {
  if (ADMIN_MOCK) {
    validate(input);
    const list = mockAll();
    const now = new Date().toISOString();
    const a: Announcement = {
      announcementId: Math.max(0, ...list.map((x) => x.announcementId)) + 1,
      title: input.title.trim(),
      content: input.content.trim(),
      excerpt: input.content.trim().replace(/\s+/g, " ").slice(0, 200),
      category: input.category,
      isPinned: input.isPinned,
      status: input.publish ? "PUBLISHED" : "DRAFT",
      publishedAt: input.publish ? now : null,
      createdAt: now,
      updatedAt: null,
      batch: input.batchId ? { batchId: input.batchId, batchName: `Đợt #${input.batchId}` } : null,
      createdByName: readSession()?.staff.fullName ?? null,
    };
    mockSave([a, ...list]);
    return delay(a);
  }
  return call<Announcement>("/admin/announcements", { method: "POST", body: JSON.stringify(input) }, adminToken());
}

export async function adminUpdateAnnouncement(id: number, input: AnnouncementInput): Promise<Announcement> {
  if (ADMIN_MOCK) {
    validate(input);
    const list = mockAll();
    const i = list.findIndex((x) => x.announcementId === id);
    if (i < 0) throw { error_code: "NOT_FOUND", message: "Không tìm thấy thông báo." };
    list[i] = {
      ...list[i],
      title: input.title.trim(),
      content: input.content.trim(),
      excerpt: input.content.trim().replace(/\s+/g, " ").slice(0, 200),
      category: input.category,
      isPinned: input.isPinned,
      batch: input.batchId ? { batchId: input.batchId, batchName: list[i].batch?.batchName ?? `Đợt #${input.batchId}` } : null,
      updatedAt: new Date().toISOString(),
    };
    mockSave(list);
    return delay(list[i]);
  }
  return call<Announcement>(`/admin/announcements/${id}`, { method: "PUT", body: JSON.stringify(input) }, adminToken());
}

export async function adminSetAnnouncementStatus(id: number, status: AnnouncementStatus): Promise<Announcement> {
  if (ADMIN_MOCK) {
    const list = mockAll();
    const i = list.findIndex((x) => x.announcementId === id);
    if (i < 0) throw { error_code: "NOT_FOUND", message: "Không tìm thấy thông báo." };
    list[i] = { ...list[i], status, publishedAt: status === "PUBLISHED" && !list[i].publishedAt ? new Date().toISOString() : list[i].publishedAt, updatedAt: new Date().toISOString() };
    mockSave(list);
    return delay(list[i]);
  }
  return call<Announcement>(`/admin/announcements/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, adminToken());
}

// ---------------------------------------------------------------------------- tiện ích hiển thị
export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}
/** "còn 5 ngày", "còn 3 giờ", "đã hết hạn" */
export function timeLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "đã hết hạn";
  const d = Math.floor(ms / day);
  if (d >= 1) return `còn ${d} ngày`;
  const h = Math.max(1, Math.floor(ms / 3_600_000));
  return `còn ${h} giờ`;
}
