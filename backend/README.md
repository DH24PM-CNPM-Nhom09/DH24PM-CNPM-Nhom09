# Backend — Hệ thống Quản lý Tuyển sinh Sau đại học

NestJS 10 + Prisma 6 + MariaDB, viết bám CSDL `admission_db` v3 của nhóm, kèm `migration_v4_backend.sql` (chỉ thêm, không xóa gì).
Phục vụ cả hai phân hệ: **Quản lý** (`/admin` trên web) và **Thí sinh**.

Đã chạy thử toàn bộ trên **MariaDB 10.4.32**, đúng bản đi kèm XAMPP 8.x.

```
backend/
  database/        admission_db_v3.sql (bản gốc của nhóm) + migration_v4_backend.sql
  prisma/          schema.prisma (sinh từ CSDL bằng prisma db pull), seed.ts, demo/
  src/
    common/        xác thực JWT + phân quyền, lỗi chuẩn, state machine, nhật ký
    modules/auth       M1 — đăng nhập cán bộ / thí sinh, OTP quên mật khẩu
    modules/admin      M2, M3, M4, M5 (phúc khảo), M8 — API phân hệ Quản lý
    modules/candidate  API phân hệ Thí sinh
  uploads/         tệp minh chứng thí sinh nộp (không đưa lên git)
```

---

## Cài đặt lần đầu (Windows)

### Bước 1 — Cài XAMPP để có MariaDB

1. Tải XAMPP cho Windows tại https://www.apachefriends.org (bản 8.x), cài mặc định vào `C:\xampp`.
2. Mở **XAMPP Control Panel**, bấm **Start** ở dòng **MySQL** (thực chất là MariaDB). Thấy nền xanh và cổng `3306` là được.
   Không cần bật Apache, trừ khi muốn dùng phpMyAdmin.

> Nếu máy đã có MySQL/MariaDB khác chiếm cổng 3306, tắt nó đi hoặc đổi cổng trong `DATABASE_URL`.

### Bước 2 — Tạo CSDL

Mở PowerShell **trong thư mục `backend`**, chạy lần lượt 2 lệnh:

```powershell
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 -e "source database/admission_db_v3.sql"
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 -e "source database/migration_v4_backend.sql"
```

Kiểm tra: CSDL `admission_db` có **42 bảng** (40 bảng gốc + `application_education` + `complaint`).

Có thể làm bằng phpMyAdmin thay cho 2 lệnh trên: bật Apache, mở http://localhost/phpmyadmin, vào tab **Import**, chọn file v3 rồi bấm **Import**; làm lại với file v4.
Bắt buộc dùng `--default-character-set=utf8mb4` (phpMyAdmin mặc định đã đúng). Thiếu nó, tiếng Việt trong CSDL sẽ bị lỗi font.

### Bước 3 — Chạy backend

Cần Node.js 18.18 trở lên (kiểm tra bằng `node -v`).

```powershell
copy .env.example .env      # XAMPP mặc định: root, không mật khẩu -> giữ nguyên DATABASE_URL
npm install
npx prisma generate
npm run db:seed:demo        # nạp dữ liệu mẫu (65 hồ sơ, 4 đợt, phúc khảo...) — chỉ chạy được trên CSDL trống
npm run dev                 # chạy ở http://localhost:4000
```

Mở http://localhost:4000/health. Thấy `{"status":"ok","database":"up"}` là backend đã nối được CSDL.

Không muốn dữ liệu mẫu thì chạy `npm run db:seed` thay cho `db:seed:demo`. Lệnh này chỉ tạo 1 tài khoản quản trị: `quantri@agu.edu.vn` / `Admin@123`.

### Bước 4 — Cho frontend gọi backend thật

Tạo file `frontend/web/.env.local` với nội dung:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_ADMIN_USE_MOCK=false
NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_DEMO_LOGIN=true
```

Sau đó tắt rồi chạy lại `npm run dev` ở frontend (Next.js chỉ đọc `.env.local` lúc khởi động). Xóa file này đi là frontend quay về dữ liệu mẫu trong trình duyệt.

### Tài khoản demo (sau `db:seed:demo`, mật khẩu chung `Demo@123`)

| Cổng | Email | Vai trò |
|---|---|---|
| http://localhost:3000/admin/login | canbo@agu.edu.vn | Cán bộ tuyển sinh |
| | hoidong@agu.edu.vn | Hội đồng tuyển sinh |
| | lanhdao@agu.edu.vn | Lãnh đạo khoa/viện |
| | quantri@agu.edu.vn | Quản trị hệ thống |
| http://localhost:3000/login | bấm "Đăng nhập với Google" | Thí sinh demo `thisinh.demo@gmail.com`, có 1 hồ sơ đang chờ bổ sung |

Đăng nhập Google của thí sinh chạy ở **chế độ phát triển** (`DEV_AUTH_BYPASS=true`): frontend đang gửi token giả `mock-google-id-token`, backend coi đó là tài khoản thí sinh demo.
Muốn dùng Google thật: tạo OAuth Client ID ở Google Cloud Console, điền `GOOGLE_CLIENT_ID`, đặt `DEV_AUTH_BYPASS=false`, và cho frontend gửi `id_token` thật (chỗ `TODO` trong `src/app/login/page.tsx`).

---

## Quy tắc nghiệp vụ backend đang chặn

- **Phân quyền**: mỗi API khai báo `@RequirePermission(...)` theo ma trận trong `src/common/permissions.ts`. Ma trận này giống hệt bản ở frontend. Vai trò được đọc lại từ CSDL ở mọi request, nên khóa tài khoản hay đổi vai trò có hiệu lực ngay.
- **Thẩm định hồ sơ**: tuân theo state machine trong `src/common/review-rules.ts`, đúng sơ đồ M4.
  - Chỉ cập nhật khi trạng thái hồ sơ vẫn đúng như lúc kiểm tra, nên 2 cán bộ bấm cùng lúc thì 1 người nhận lỗi `STALE_STATUS`.
  - Mỗi lần chuyển trạng thái: điền người làm và lý do vào dòng lịch sử mà trigger #9 tạo ra (không sinh dòng trùng), ghi `application_review`, `audit_log`, và gửi `notification` cho thí sinh.
- **Đợt tuyển sinh**: chỉ được mở khi mọi ngành đã được lãnh đạo duyệt và tổng trọng số môn thi bằng 100%. Chỉ sửa được khi đợt còn ở trạng thái nháp; sửa xong phải duyệt lại. Không chuyển sang xét kết quả khi còn hồ sơ chưa kết luận.
- **Minh chứng**:
  - Chỉ nhận PDF, JPG, PNG, có kiểm tra chữ ký đầu tệp; tối đa 5MB mỗi tệp.
  - Lưu kèm SHA-256. Tổng 30MB mỗi hồ sơ do trigger của CSDL chặn, và thông báo của trigger được trả nguyên văn.
  - Nộp lại khi được yêu cầu bổ sung sẽ thay tệp không hợp lệ.
- **Phúc khảo**: đổi điểm thì trigger #3 sửa `exam_score` và trigger #4 tự tính lại `application_ranking`.
- **Đăng nhập thí sinh bằng mật khẩu**: sai 5 lần thì khóa 15 phút (chỉnh trong `system_config`). OTP quên mật khẩu được băm bcrypt, hết hạn sau 5 phút, mỗi lần chỉ 1 mã còn hiệu lực.
- **Lỗi**: luôn trả về `{ error_code, message }` bằng tiếng Việt.

## Danh sách API (tiền tố `/api/v1`)

| Method | Path | Quyền |
|---|---|---|
| POST | `/auth/staff/login`, `/auth/staff/google` | công khai |
| GET | `/auth/staff/me` | cán bộ |
| POST | `/auth/google`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password` | công khai (thí sinh) |
| GET | `/admin/lookups`, `/admin/dashboard` | dashboard:view |
| GET | `/admin/applications`, `/admin/applications/:id`, `/admin/application-documents/:id/file` | application:view |
| PATCH | `/applications/:id/review` | application:review |
| PATCH | `/admin/application-documents/:id/verify` | application:review |
| POST | `/admin/applications/bulk-start-review` | application:review |
| GET | `/admission-batches`, `/admission-batches/:id` | batch:view |
| POST/PATCH/PUT | `/admission-batches`, `/admission-batches/:id/status`, `/admission-batches/:id/majors`, `/admission-batch-majors/:id` | batch:manage |
| PATCH | `/admission-batch-majors/:id/approve` | batch:approve |
| GET / POST | `/score-appeals`, `/score-appeals/:id/resolve` | appeal:view / appeal:resolve |
| GET/POST/PUT/PATCH | `/staff-accounts`, `/staff-accounts/:id/roles`, `/staff-accounts/:id/status` | account:manage |
| GET | `/audit-logs` | audit:view |
| GET/PATCH | `/candidates/me` | thí sinh |
| GET | `/applications/me`, `/applications/me/documents`, `/applications/me/supervisor-request`, `/notifications/me` | thí sinh |
| POST | `/applications/:id/documents` (multipart: `file`, `documentType`), `/applications/me/supplement`, `/complaints` | thí sinh |
| GET | `/health` (ngoài tiền tố) | công khai |

## Lệnh hữu ích

| Lệnh | Việc làm |
|---|---|
| `npm run dev` | Chạy và tự khởi động lại khi sửa code |
| `npm run build` rồi `npm start` | Chạy bản build |
| `npm run typecheck` | Kiểm tra kiểu TypeScript |
| `npm run db:pull` rồi `npm run prisma:generate` | Khi CSDL đổi cấu trúc: cập nhật `schema.prisma` từ CSDL |

## Chưa làm

- **M5 (phần còn lại):** xếp phòng thi, số báo danh, lịch phỏng vấn, nhập điểm.
- **M6:** điểm chuẩn, xếp hạng, danh sách dự bị, công bố kết quả 2 cấp duyệt.
- **M7:** quyết định trúng tuyển, xác nhận nhập học, nộp bản chính.
- **Gửi email/SMS thật:** thông báo kênh EMAIL hiện nằm ở trạng thái `PENDING` trong bảng `notification`.
- **Màn hình cán bộ xử lý khiếu nại chung:** bảng `complaint` đã có và thí sinh gửi được.
