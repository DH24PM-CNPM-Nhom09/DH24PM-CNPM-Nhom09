# Backend — Hệ thống Quản lý Tuyển sinh Sau đại học

NestJS 10 + Prisma 6 + MariaDB, viết bám CSDL `admission_db` v3 của nhóm, kèm `migration_v4_backend.sql` và `migration_v5_announcement.sql` (chỉ thêm, không xóa gì).
Phục vụ cả hai phân hệ: **Quản lý** (`/admin` trên web) và **Thí sinh**.

Đã chạy thử toàn bộ trên **MariaDB 10.4.32**, đúng bản đi kèm XAMPP 8.x.

```
backend/
  database/        admission_db_v3.sql (bản gốc của nhóm) + migration_v4_backend.sql + migration_v5_announcement.sql
  prisma/          schema.prisma (sinh từ CSDL bằng prisma db pull), seed.ts, demo/
  src/
    common/        xác thực JWT + phân quyền, lỗi chuẩn, state machine, nhật ký, gửi email (SMTP), OTP
    modules/auth       M1 — đăng ký thí sinh + xác thực email bằng OTP, đăng nhập cán bộ / thí sinh, quên mật khẩu
    modules/announcements  Thông báo tuyển sinh / quy định (công khai) + cán bộ soạn, đăng, gỡ
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

Mở PowerShell **trong thư mục `backend`**, chạy lần lượt 4 lệnh (thay `C:\xampp` bằng nơi bạn cài XAMPP, ví dụ `D:\xampp`):

```powershell
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 -e "source database/admission_db_v3.sql"
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 -e "source database/migration_v4_backend.sql"
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 -e "source database/migration_v5_announcement.sql"
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 -e "source database/migration_v6_staff_security.sql"
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

> **Đã cài từ bản trước (CSDL đang có dữ liệu)?** Không cần tạo lại. Chỉ chạy `npm install` rồi `npm run db:update`:
> lệnh này chạy migration v5 + v6, sửa lỗi font cột quốc tịch và nạp thông báo mẫu. Chạy lại nhiều lần vẫn an toàn, không xóa gì.

### Bước 3b — Gửi email thật qua Gmail (mã xác thực, thông báo hồ sơ)

Chưa làm bước này hệ thống vẫn chạy: mã xác thực được in ra cửa sổ backend và hiện trên màn hình đăng ký để thử.
Để gửi mail thật, dùng một tài khoản Gmail làm hộp thư gửi:

1. Bật **Xác minh 2 bước** cho tài khoản Gmail đó: https://myaccount.google.com/signinoptions/twosv
2. Tạo **Mật khẩu ứng dụng** tại https://myaccount.google.com/apppasswords (đặt tên, ví dụ "Tuyen sinh"). Google hiện 1 dãy 16 ký tự.
3. Thêm vào file `.env` của backend:
   ```
   SMTP_USER="tenban@gmail.com"
   SMTP_PASS="abcd efgh ijkl mnop"
   ```
4. Tắt backend (Ctrl+C) và chạy lại `npm run dev`. Cửa sổ backend báo `Đã bật gửi email qua smtp.gmail.com…` là xong.

Lưu ý:
- `SMTP_PASS` là mật khẩu ứng dụng, **không phải** mật khẩu đăng nhập Gmail. Không đưa file `.env` lên GitHub (đã có trong `.gitignore`).
- Thư gửi tới: thí sinh **tự đăng ký và đã nhập đúng mã**. Tài khoản trong dữ liệu mẫu dùng địa chỉ bịa nên không bao giờ nhận mail.
- Thông báo xử lý hồ sơ (tiếp nhận, yêu cầu bổ sung, kết quả…) được gửi email khoảng 20 giây sau thao tác của cán bộ.
- Gmail cá nhân gửi được khoảng 500 thư/ngày, đủ cho demo và thử nghiệm.

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
| http://localhost:3000/register | tự đăng ký bằng Gmail thật | Nhận mã 6 số qua email (hoặc xem trên màn hình nếu chưa cấu hình Gmail) |

### Bước 3c — Đăng nhập Google thật (hiện cửa sổ chọn tài khoản Google)

Chưa cấu hình: nút hiện chữ "(bản demo)" và vào thẳng tài khoản thí sinh mẫu `thisinh.demo@gmail.com`.
Để dùng Google thật (áp dụng cho cả thí sinh và cán bộ):

1. Vào https://console.cloud.google.com, tạo dự án mới (ví dụ "Tuyen sinh SDH").
2. Mở **Google Auth Platform** (APIs & Services > OAuth consent screen), bấm **Get started**: đặt tên ứng dụng, email hỗ trợ, chọn **External**, đồng ý điều khoản.
3. Mục **Audience**: bấm **Publish app** (chỉ dùng quyền cơ bản email/tên nên không cần Google duyệt), hoặc thêm Gmail người thử ở **Test users**.
4. Mục **Clients** > **Create client** > loại **Web application**. Ở **Authorized JavaScript origins** thêm `http://localhost:3000` và `http://localhost`. Bấm **Create**.
5. Chép **Client ID** (dạng `xxxx.apps.googleusercontent.com`) vào `backend/.env`:
   ```
   GOOGLE_CLIENT_ID="xxxx.apps.googleusercontent.com"
   ```
   Không cần Client secret. Frontend tự lấy Client ID từ backend (`GET /public/auth-config`), không phải sửa `.env.local`.
6. Khởi động lại backend. Trang đăng nhập hiện nút Google chuẩn; bấm vào sẽ ra cửa sổ chọn tài khoản.

Thí sinh đăng nhập Google lần đầu sẽ được đưa tới trang Hồ sơ cá nhân (điền sẵn họ tên từ Google) để khai ngày sinh, CCCD… Cán bộ chỉ đăng nhập Google được nếu email Google trùng email công tác đã được cấp tài khoản.
Khi triển khai thật, đặt `DEV_AUTH_BYPASS=false` để tắt hẳn các token giả.

---

## Trước khi triển khai thật (bắt buộc)

1. Tạo CSDL mới, chạy đủ các file SQL v3 → v6, rồi `npm run db:seed` (KHÔNG chạy `db:seed:demo`). Lệnh này chỉ tạo 1 tài khoản quản trị `quantri@agu.edu.vn`, bị bắt đổi mật khẩu ở lần đăng nhập đầu.
2. Quản trị vào **Tài khoản cán bộ** cấp tài khoản cho từng cán bộ bằng email công tác thật (nên chọn chỉ đăng nhập Google).
3. `backend/.env`: `DEV_AUTH_BYPASS=false`, đổi `JWT_SECRET` thành chuỗi ngẫu nhiên dài, điền `GOOGLE_CLIENT_ID`, `SMTP_USER`, `SMTP_PASS`.
4. Frontend `.env.local`: `NEXT_PUBLIC_DEMO_LOGIN=false` (ẩn khung tài khoản demo ở trang đăng nhập cán bộ).

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
- **Đăng ký thí sinh**: khai họ tên, ngày sinh, email, số điện thoại, mật khẩu (≥ 8 ký tự, có chữ và số). Tài khoản ở trạng thái `PENDING_VERIFY` cho tới khi nhập đúng mã gửi về email; chưa xác thực thì không đăng nhập được. Thông tin đăng ký được ghi luôn vào bảng `candidate` (hồ sơ cá nhân).
- **Mã OTP** (đăng ký và quên mật khẩu): 6 số, chỉ lưu bản băm bcrypt, hết hạn sau 5 phút, mỗi lần chỉ 1 mã còn hiệu lực. Chờ 60 giây giữa 2 lần gửi, tối đa 5 lần/giờ; nhập sai 5 lần thì mã bị hủy.
- **Đăng nhập thí sinh bằng mật khẩu** (email hoặc số điện thoại): sai 5 lần thì khóa 15 phút (chỉnh trong `system_config`).
- **Tài khoản cán bộ**:
  - Mật khẩu tạm (khi quản trị cấp tài khoản hoặc "Cấp lại mật khẩu") bắt buộc phải đổi ở lần đăng nhập đầu; trong lúc đó backend chặn mọi API khác (`PASSWORD_CHANGE_REQUIRED`).
  - Mật khẩu cán bộ: ≥ 8 ký tự, có chữ hoa, chữ thường, chữ số, không chứa tên email.
  - Đăng nhập sai 5 lần liên tiếp thì khóa tạm 15 phút (cùng cấu hình `LOGIN_MAX_FAILED`, `LOGIN_LOCK_MINUTES` với thí sinh).
- **Thông báo**: thông báo `PUBLISHED` ai cũng xem được (kể cả chưa đăng nhập); chỉ cán bộ tuyển sinh được soạn, đăng, gỡ. Mọi thao tác ghi nhật ký.
- **Lỗi**: luôn trả về `{ error_code, message }` bằng tiếng Việt.

## Danh sách API (tiền tố `/api/v1`)

| Method | Path | Quyền |
|---|---|---|
| POST | `/auth/staff/login`, `/auth/staff/google` | công khai |
| GET | `/auth/staff/me` | cán bộ |
| POST | `/auth/register`, `/auth/register/verify`, `/auth/register/resend` | công khai (thí sinh) |
| GET | `/public/auth-config` (Google Client ID cho frontend) | công khai |
| POST | `/auth/google`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password` | công khai (thí sinh) |
| GET | `/public/announcements`, `/public/announcements/:id`, `/public/open-batches` | công khai |
| GET/POST/PUT/PATCH | `/admin/announcements`, `/admin/announcements/:id`, `/admin/announcements/:id/status` | announcement:manage |
| GET | `/admin/lookups`, `/admin/dashboard` | dashboard:view |
| GET | `/admin/applications`, `/admin/applications/:id`, `/admin/application-documents/:id/file` | application:view |
| PATCH | `/applications/:id/review` | application:review |
| PATCH | `/admin/application-documents/:id/verify` | application:review |
| POST | `/admin/applications/bulk-start-review` | application:review |
| GET | `/admission-batches`, `/admission-batches/:id` | batch:view |
| POST/PATCH/PUT | `/admission-batches`, `/admission-batches/:id/status`, `/admission-batches/:id/majors`, `/admission-batch-majors/:id` | batch:manage |
| PATCH | `/admission-batch-majors/:id/approve` | batch:approve |
| GET / POST | `/score-appeals`, `/score-appeals/:id/resolve` | appeal:view / appeal:resolve |
| GET/POST/PUT/PATCH | `/staff-accounts`, `/staff-accounts/:id/roles`, `/staff-accounts/:id` (sửa họ tên), `/staff-accounts/:id/status`, `/staff-accounts/:id/reset-password` | account:manage |
| POST | `/auth/staff/change-password` | cán bộ (kể cả khi đang bị bắt đổi mật khẩu) |
| GET | `/audit-logs` | audit:view |
| GET/PATCH | `/candidates/me` | thí sinh |
| GET | `/applications/me`, `/applications/me/documents`, `/applications/me/supervisor-request`, `/notifications/me` | thí sinh |
| PATCH | `/notifications/:id/read`, `/notifications/me/read-all` | thí sinh |
| POST | `/applications/:id/documents` (multipart: `file`, `documentType`), `/applications/me/supplement`, `/complaints` | thí sinh |
| GET | `/health` (ngoài tiền tố) | công khai |

## Lệnh hữu ích

| Lệnh | Việc làm |
|---|---|
| `npm run dev` | Chạy và tự khởi động lại khi sửa code |
| `npm run build` rồi `npm start` | Chạy bản build |
| `npm run typecheck` | Kiểm tra kiểu TypeScript |
| `npm run db:update` | Cập nhật CSDL đang có dữ liệu lên bản mới nhất (migration v5, thông báo mẫu) — chỉ thêm, không xóa |
| `npm run db:pull` rồi `npm run prisma:generate` | Khi CSDL đổi cấu trúc: cập nhật `schema.prisma` từ CSDL |

## Chưa làm

- **M5 (phần còn lại):** xếp phòng thi, số báo danh, lịch phỏng vấn, nhập điểm.
- **M6:** điểm chuẩn, xếp hạng, danh sách dự bị, công bố kết quả 2 cấp duyệt.
- **M7:** quyết định trúng tuyển, xác nhận nhập học, nộp bản chính.
- **Gửi SMS:** chưa có; mã xác thực và thông báo chỉ gửi qua email.
- **Màn hình cán bộ xử lý khiếu nại chung:** bảng `complaint` đã có và thí sinh gửi được.
