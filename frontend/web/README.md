# Cổng Tuyển Sinh Sau Đại Học — Frontend Web (Thí sinh)

Frontend **Next.js** cho vai trò **Thí sinh** trong Hệ thống Quản lý Tuyển sinh Sau đại học —
Trường Đại học An Giang. (Bản Next.js theo đúng phân công của leader — bản trước dùng Vite đã
được thay thế bởi bản này.)

## Công nghệ

- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS (đúng Design System trong tài liệu "Thiết kế giao diện người dùng")
- PWA cơ bản (manifest.json + service worker) cho bản mobile web

## Vị trí đặt trong repo nhóm

Theo README của nhóm, code Frontend web đặt trong nhánh **`Frontend`**, thư mục **`frontend/`**
của repo: `https://github.com/haidpm235414/DH24PM-CNPM-Nhom09/tree/Frontend/frontend`.

Toàn bộ nội dung thư mục `tuyensinh-web-next/` này (trừ `node_modules`, `.next`) copy vào đúng
thư mục `frontend/` đó trên nhánh `Frontend` rồi commit + push / tạo Pull Request.

## Bắt đầu

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`. App khởi động ở chế độ **MOCK DATA** — toàn bộ màn hình chạy được
ngay, có dữ liệu giả, không cần chờ Backend.

## Cấu trúc thư mục

```
src/
  app/                 Định tuyến theo file (App Router của Next.js)
    login/, register/, forgot-password/   Nhóm màn hình xác thực
    dashboard/, application/, application/new/,
    gvhd/, complaint/, profile/, admission-confirm/   Nhóm màn hình sau đăng nhập
    layout.tsx          Layout gốc (font, PWA manifest)
    page.tsx            Trang chủ, tự chuyển hướng sang /login
  components/
    ui/                 Button, Input, Card, Badge, OtpInput
    layout/             AuthLayout, AppLayout (khung có sidebar)
  lib/
    types.ts            Kiểu dữ liệu khớp đúng schema admission_db (v3)
    api.ts               Lớp gọi API — đang MOCK, xem hướng dẫn bên dưới để nối Backend thật
```

## Bàn giao cho nhóm Backend

Toàn bộ lời gọi API của Frontend đã được định nghĩa sẵn trong **`src/lib/api.ts`**. Nhóm Backend
chỉ cần implement đúng endpoint theo path đã khai báo (`/api/v1/...`), đúng format dữ liệu trong
**`src/lib/types.ts`**, là Frontend chạy được với dữ liệu thật ngay lập tức.

### Danh sách API cần Backend cung cấp

| Hàm trong `api.ts`         | Method | Path                                      |
|-----------------------------|--------|--------------------------------------------|
| `loginWithGoogle`            | POST   | `/auth/google`                             |
| `requestPasswordResetOtp`    | POST   | `/auth/forgot-password`                    |
| `resetPassword`              | POST   | `/auth/reset-password`                     |
| `getMyProfile`               | GET    | `/candidates/me`                           |
| `updateMyProfile`            | PATCH  | `/candidates/me`                           |
| `getMyApplication`           | GET    | `/applications/me`                         |
| `getMyDocuments`             | GET    | `/applications/me/documents`               |
| `uploadDocument`             | POST   | `/applications/{id}/documents` (multipart) |
| `getMySupervisorRequest`     | GET    | `/applications/me/supervisor-request`      |
| `submitComplaint`            | POST   | `/complaints`                              |

### Chuyển từ MOCK sang API thật

1. Mở `src/lib/api.ts`, đổi `const USE_MOCK = true;` thành `false`.
2. Copy `.env.example` thành `.env.local`, điền `NEXT_PUBLIC_API_BASE_URL` trỏ tới Backend thật.
3. Backend trả lỗi đúng format chuẩn đã thống nhất: `{ error_code, message, detail }`.
4. Token đăng nhập lưu ở `localStorage` (`access_token`), tự động gắn header
   `Authorization: Bearer ...`. Backend luôn lấy `candidate_id` từ token, không nhận từ input.

### Quy tắc nghiệp vụ quan trọng đã code cứng (khớp `admission_db` v3)

- 2 trục trạng thái độc lập: `reviewStatus` và `admissionStatus` (không gộp chung 1 enum).
- Giới hạn file: tối đa 5MB/file (Frontend chặn sớm ở `uploadDocument()`).
- `document_type` gồm 7 giá trị chuẩn theo DB.
- Luồng GVHD (`PENDING/ACCEPTED/REJECTED`) chỉ áp dụng bậc Tiến sĩ.
- Đăng nhập chính bằng Google OAuth2.

## Build & Deploy

```bash
npm run build
npm run start
```

Deploy lên Render dạng **Web Service** (Next.js cần server Node chạy, không phải Static Site
thuần như bản Vite trước).

## Thiết kế

Màu sắc, font (Be Vietnam Pro), bo góc khớp đúng tài liệu **"Thiết kế giao diện người dùng.docx"
(v2.1)** và **"UI Mockup.pdf"** — 21 màn hình gốc của nhóm.
