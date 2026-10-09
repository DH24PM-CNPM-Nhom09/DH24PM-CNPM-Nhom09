# Backend — Hệ thống Quản lý Tuyển sinh Sau đại học

> API NestJS của hệ thống tuyển sinh: web `frontend/web` gọi tới thư mục này. Chạy bằng Docker: xem `frontend/TRIEN_KHAI_DOCKER.md`.

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

Mở PowerShell **trong thư mục `backend`**, chạy lần lượt 9 lệnh (thay `C:\xampp` bằng nơi bạn cài XAMPP, ví dụ `D:\xampp`):

```powershell
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 -e "source database/admission_db_v3.sql"
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 -e "source database/migration_v4_backend.sql"
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 -e "source database/migration_v5_announcement.sql"
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 -e "source database/migration_v6_staff_security.sql"
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 -e "source database/migration_v7_payment_config.sql"
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 -e "source database/migration_v8_real_notice.sql"
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 -e "source database/migration_v9_english_test.sql"
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 -e "source database/migration_v10_admission_results.sql"
C:\xampp\mysql\bin\mysql.exe -u root --default-character-set=utf8mb4 -e "source database/migration_v11_privacy.sql"
```

Kiểm tra: CSDL `admission_db` có **45 bảng** (40 bảng gốc + `application_education` + `complaint` + 2 bảng thi tiếng Anh `english_test_session`, `english_test_registration` + bảng đơn phúc khảo `appeal_request`).

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
> lệnh này chạy migration v5 → v11, sửa lỗi font cột quốc tịch và nạp thông báo mẫu. Chạy lại nhiều lần vẫn an toàn, không xóa gì.

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

1. Tạo CSDL mới, chạy đủ các file SQL v3 → v11, rồi `npm run db:seed` (KHÔNG chạy `db:seed:demo`). Lệnh này chỉ tạo 1 tài khoản quản trị `quantri@agu.edu.vn`, bị bắt đổi mật khẩu ở lần đăng nhập đầu.
2. Quản trị vào **Tài khoản cán bộ** cấp tài khoản cho từng cán bộ bằng email công tác thật (nên chọn chỉ đăng nhập Google).
3. `backend/.env`: `DEV_AUTH_BYPASS=false`, đổi `JWT_SECRET` thành chuỗi ngẫu nhiên dài, điền `GOOGLE_CLIENT_ID`, `SMTP_USER`, `SMTP_PASS`.
4. Frontend `.env.local`: `NEXT_PUBLIC_DEMO_LOGIN=false` (ẩn khung tài khoản demo ở trang đăng nhập cán bộ).
5. Cán bộ tuyển sinh vào **Lệ phí & thanh toán** điền mức lệ phí và tài khoản ngân hàng chính thức của Trường (để trống thì thí sinh được hướng dẫn nộp trực tiếp tại Phòng Đào tạo SĐH).
6. Chạy sau HTTPS (Render, Nginx...). Backend đã tự gửi header an toàn (chống nhúng iframe, chống đoán kiểu tệp, HSTS khi qua HTTPS) và giới hạn số lần gọi API đăng nhập/đăng ký/quên mật khẩu theo IP (`AUTH_RATE_LIMIT`, mặc định 60 lần/10 phút).
7. Thư mục tệp minh chứng (`UPLOAD_DIR`) phải nằm trên ổ lưu trữ bền vững (Render: gắn persistent disk), nếu không mỗi lần triển khai lại sẽ mất tệp thí sinh đã tải lên.
8. Sao lưu định kỳ: `npm run db:backup` tạo `backups/admission_db_<ngày>_<giờ>.sql` (đủ dữ liệu, trigger, thủ tục) và bản sao thư mục tệp minh chứng; chép thư mục `backups/` sang nơi khác. Khôi phục: `mysql -u root admission_db < backups/<tệp>.sql`. Lệnh chỉ tạo bản mới, không xóa bản cũ.
9. Rà soát nội dung trang **Chính sách bảo vệ dữ liệu cá nhân** (`/privacy`, theo Nghị định 13/2023/NĐ-CP) với bộ phận pháp chế của Trường trước khi áp dụng.
10. Đổi lại toàn bộ mật khẩu ứng dụng Gmail, khóa bí mật Google OAuth, `JWT_SECRET` đã từng dùng khi phát triển.

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
- **Nộp hồ sơ (thí sinh)**:
  - Phải đủ hồ sơ cá nhân (họ tên, ngày sinh, giới tính, CCCD, điện thoại, địa chỉ). Mỗi thí sinh chỉ có 1 hồ sơ đang xử lý; không nộp 2 hồ sơ cùng ngành trong 1 đợt.
  - Hồ sơ đi qua bản nháp `DRAFT` (cán bộ không thấy), chỉ tạo/nộp được khi đợt đang mở và còn trong thời gian nhận hồ sơ. Mã hồ sơ dạng `<mã đợt>-<mã ngành>-<số thứ tự 5 chữ số>`.
  - Minh chứng bắt buộc: thạc sĩ cần văn bằng + bảng điểm; tiến sĩ thêm đề cương nghiên cứu + thư giới thiệu và phải khai đề tài. Chọn giảng viên hướng dẫn thì khi nộp hệ thống tạo đề nghị gửi giảng viên.
  - Khi nộp: phát sinh khoản lệ phí `PENDING` theo `APPLICATION_FEE_THAC_SI` / `APPLICATION_FEE_TIEN_SI`, gửi thông báo + email cho thí sinh kèm nội dung chuyển khoản `<mã hồ sơ> <mã thí sinh>`.
- **Hồ sơ theo thông báo tuyển sinh thật (ThS 2025 đợt 1)**: bắt buộc đơn đăng ký (hệ thống in sẵn từ thông tin đã khai, trang `/application/print`), sơ yếu lý lịch, lý lịch chuyên môn, ảnh 3x4, bằng + bảng điểm, CCCD; tiến sĩ thêm đề cương và thư giới thiệu. Giấy tờ "nếu có": giấy giới thiệu, chứng chỉ ngoại ngữ, chứng chỉ AI, giấy ưu tiên, công nhận văn bằng nước ngoài, công bố khoa học.
- **Ngoại ngữ**: thí sinh chọn có chứng chỉ (bắt buộc tải chứng chỉ) / được miễn (ghi lý do) / đăng ký thi đánh giá năng lực (cộng lệ phí thi).
- **Các khoản thu khi nộp hồ sơ**: đăng ký dự tuyển + xét tuyển (+ thi tiếng Anh nếu có), chốt vào `application_payment.fee_detail` lúc nộp; cán bộ chỉnh mức ở trang "Lệ phí & thanh toán".
- **Danh mục ngành**: cán bộ tuyển sinh thêm/sửa ngành; ngành đã mở trong đợt không đổi được mã và bậc, chỉ "ngừng tuyển" (không xóa).
- **Lệ phí**: thí sinh thấy mã VietQR riêng (ngân hàng, số tài khoản, số tiền, nội dung = mã hồ sơ bỏ dấu gạch), tạo ngay trên trình duyệt từ cấu hình `PAYMENT_BANK_BIN`, `PAYMENT_ACCOUNT_NO` — không gọi dịch vụ ngoài. Ô tìm kiếm hồ sơ của cán bộ nhận được cả nội dung chuyển khoản dán từ sao kê. Cán bộ đối chiếu sao kê rồi bấm "Xác nhận đã thu" (ghi số biên lai, mã giao dịch; mã giao dịch không được trùng). Chưa có lệ phí `SUCCESS` thì không kết luận "Đạt" được.
- **Phúc khảo**: thí sinh nộp đơn trên cổng trong hạn phúc khảo (sau khi công bố điểm, `APPEAL_WINDOW_DAYS` ngày, mặc định 7), chọn phần điểm cần phúc khảo, một đơn/hồ sơ, lệ phí `FEE_APPEAL` (360.000 đ/hồ sơ) chuyển khoản qua mã VietQR với nội dung `PK<mã hồ sơ>`. Cán bộ xác nhận đã nhận lệ phí thì hội đồng mới kết luận được; hết hạn mà chưa nộp thì cán bộ "Đóng đơn", điểm giữ nguyên. Đổi điểm thì trigger #3 sửa `exam_score` và trigger #4 tự tính lại `application_ranking`.
- **Xét tuyển theo ngành (M5)** — trang "Tổ chức xét tuyển": chỉ hồ sơ đã "Đạt" thẩm định; đợt phải ở trạng thái "Đóng đăng ký" hoặc "Xét kết quả". (1) Cán bộ lập tiểu ban (≥ 3 người, đúng 1 Chủ tịch và 1 Thư ký). (2) Nếu ngành có hình thức phỏng vấn (thạc sĩ: phỏng vấn chuyên môn; tiến sĩ: trình bày đề cương), "Xếp lịch tự động" chia lượt trong giờ hành chính (7:30–11:30, 13:30–17:00, nghỉ Chủ nhật) và báo từng thí sinh; đổi lịch thì báo lại; in lịch kèm cột điểm cho tiểu ban. (3) Hội đồng / cán bộ (`score:enter`) nhập điểm từng hình thức theo thang của hình thức; phần phỏng vấn chỉ nhập sau giờ hẹn; vắng mặt = 0 điểm và không được trúng tuyển. (4) Cán bộ công bố điểm khi mọi thí sinh đủ điểm và không còn hồ sơ đang thẩm định; sau đó không sửa điểm trực tiếp được nữa.
- **Xét trúng tuyển (M6)** — trang "Xét trúng tuyển": chỉ xếp hạng khi đợt ở "Xét kết quả", đã hết hạn phúc khảo và không còn đơn phúc khảo chờ kết luận. Hội đồng (`result:propose`) nhập điểm chuẩn và xếp hạng: tổng điểm = Σ(điểm × hệ số); ≥ điểm chuẩn và trong chỉ tiêu → Trúng tuyển; ≥ điểm chuẩn ngoài chỉ tiêu → Dự bị (theo thứ tự); dưới điểm chuẩn hoặc vắng → Không trúng tuyển; đồng điểm ưu tiên điểm hình thức có hệ số lớn nhất rồi nộp hồ sơ sớm hơn. Hội đồng thông qua (cấp 1) → Lãnh đạo (`result:approve`, không được là người đã thông qua cấp 1) phê duyệt và công bố, hoặc trả lại kèm lý do. Công bố xong thí sinh mới thấy kết quả (thông báo + email); không xếp hạng lại được.
- **Quyết định trúng tuyển & nhập học (M7)** — trang "Quyết định & nhập học": cán bộ (`decision:manage`) lập dự thảo quyết định gồm mọi thí sinh trúng tuyển đã công bố chưa có quyết định → trình ký → Lãnh đạo (`decision:sign`) ký ban hành hoặc trả lại. Ký xong, thí sinh có `ENROLL_CONFIRM_DAYS` ngày (mặc định 15) để bấm "Xác nhận nhập học" và in giấy báo trúng tuyển. Thí sinh từ chối, hoặc cán bộ bấm "Xử lý quá hạn", thì hồ sơ bị hủy chỗ và hệ thống tự gọi người dự bị kế tiếp (trúng tuyển bổ sung, đưa vào quyết định bổ sung). Thí sinh đã xác nhận nộp bản chính → cán bộ ghi "Đã đối chiếu" (hoặc "Còn thiếu" kèm nội dung báo thí sinh) → "Hoàn tất nhập học" cấp mã học viên `HV-<mã đợt>-0001`.
- **Tiến sĩ**: không kết luận "Đạt" thẩm định được khi chưa có giảng viên hướng dẫn đồng ý.
- **Khiếu nại** (trang "Khiếu nại", quyền `complaint:view` / `complaint:handle`): thí sinh gửi khiếu nại kết quả xét tuyển, xử lý hồ sơ, kết quả thi tiếng Anh hoặc vấn đề khác và xem lại câu trả lời ở cổng thí sinh. Cán bộ tuyển sinh / hội đồng "Tiếp nhận" (Mới gửi → Đang xử lý, báo thí sinh) rồi "Trả lời" (Đã giải quyết / Không chấp nhận, nội dung ≥ 20 ký tự, gửi thông báo + email). Lãnh đạo chỉ xem. Không xóa khiếu nại.
- **Tác vụ tự động** (mặc định 15 phút/lần, `AUTO_JOB_MINUTES`, 0 = tắt): hồ sơ quá hạn bổ sung → Không đạt; thí sinh quá hạn xác nhận nhập học → xem như từ chối và gọi dự bị; đơn phúc khảo chưa nộp phí khi hết hạn → đóng đơn. Nhật ký ghi người thực hiện là SYSTEM. Quản trị đợt có thể chạy ngay bằng `POST /admin/jobs/run`. Lưu ý dữ liệu mẫu có sẵn vài hồ sơ quá hạn bổ sung để demo nút làm tay; muốn giữ để demo thì đặt `AUTO_JOB_MINUTES=0`.
- **Bảo vệ dữ liệu cá nhân**: đăng ký bằng mật khẩu bắt buộc tick đồng ý Chính sách bảo vệ dữ liệu cá nhân (`/privacy`); đăng nhập Google lần đầu có dòng thông báo "tiếp tục là đồng ý". Thời điểm đồng ý lưu ở `candidate_account.privacy_consent_at` (migration v11).
- **Đăng ký thí sinh**: khai họ tên, ngày sinh, email, số điện thoại, mật khẩu (≥ 8 ký tự, có chữ và số). Tài khoản ở trạng thái `PENDING_VERIFY` cho tới khi nhập đúng mã gửi về email; chưa xác thực thì không đăng nhập được. Thông tin đăng ký được ghi luôn vào bảng `candidate` (hồ sơ cá nhân).
- **Mã OTP** (đăng ký và quên mật khẩu): 6 số, chỉ lưu bản băm bcrypt, hết hạn sau 5 phút, mỗi lần chỉ 1 mã còn hiệu lực. Chờ 60 giây giữa 2 lần gửi, tối đa 5 lần/giờ; nhập sai 5 lần thì mã bị hủy.
- **Đăng nhập thí sinh bằng mật khẩu** (email hoặc số điện thoại): sai 5 lần thì khóa 15 phút (chỉnh trong `system_config`).
- **Tài khoản cán bộ**:
  - Mật khẩu tạm (khi quản trị cấp tài khoản hoặc "Cấp lại mật khẩu") bắt buộc phải đổi ở lần đăng nhập đầu; trong lúc đó backend chặn mọi API khác (`PASSWORD_CHANGE_REQUIRED`).
  - Mật khẩu cán bộ: ≥ 8 ký tự, có chữ hoa, chữ thường, chữ số, không chứa tên email.
  - Cán bộ nghỉ việc: "Cho nghỉ việc" chỉ ẩn và vô hiệu tài khoản (deleted_at), KHÔNG xóa dữ liệu, để giữ lịch sử thẩm định và nhật ký; hồ sơ đang phụ trách chưa kết luận được trả về hàng chờ. Có thể "Khôi phục" khi quay lại làm. Không cho nghỉ việc tài khoản Quản trị duy nhất.
  - Đăng nhập sai 5 lần liên tiếp thì khóa tạm 15 phút (cùng cấu hình `LOGIN_MAX_FAILED`, `LOGIN_LOCK_MINUTES` với thí sinh).
- **Tài khoản thí sinh (phía cán bộ)**: cán bộ tuyển sinh và quản trị xem danh sách, thông tin cá nhân, hồ sơ của từng thí sinh và xuất CSV (ghi nhật ký); CCCD trong danh sách chỉ hiện 3 số cuối. Chỉ quản trị được khóa/mở khóa: tài khoản bị khóa không đăng nhập được bằng mật khẩu lẫn Google, phiên đang mở bị chặn ngay, "quên mật khẩu" không mở khóa được; hồ sơ đã nộp giữ nguyên. Không xóa tài khoản thí sinh.
- **Giảng viên hướng dẫn (bậc tiến sĩ)**: NCS chọn GV dự kiến khi nộp hồ sơ → tạo đề nghị chờ phản hồi. Cán bộ tuyển sinh / Hội đồng (quyền `supervisor:manage`) ghi nhận GV đồng ý hoặc từ chối (từ chối bắt buộc ghi lý do), NCS nhận thông báo + email. Bị từ chối thì NCS tự chọn GV khác trên cổng (tối đa 3 đề nghị/hồ sơ, không chọn lại GV đã phản hồi). Bậc thạc sĩ không đăng ký GVHD khi tuyển sinh. Danh mục giảng viên: thêm, sửa, ngừng nhận hướng dẫn (không xóa).
- **Thi đánh giá năng lực tiếng Anh** (quyền `exam:manage`, cán bộ tuyển sinh): chỉ áp dụng cho hồ sơ chọn "Đăng ký dự thi" ở bước Ngoại ngữ (thí sinh có chứng chỉ đủ điều kiện không phải thi), hồ sơ đã nộp và chưa bị từ chối/hủy. Cán bộ tạo phòng thi theo đợt (mã phòng, giờ thi trong tương lai, phòng, địa điểm, sức chứa); "Xếp phòng tự động" chia thí sinh chưa có phòng vào các phòng còn chỗ theo giờ thi, mặc định chỉ xếp người đã thanh toán; số báo danh dạng `<mã đợt>-TA-0001`, cấp một lần và giữ nguyên khi chuyển phòng. Thí sinh nhận thông báo + email, xem lịch và in giấy báo dự thi trên cổng. Chỉ nhập kết quả (Đạt / Không đạt / Vắng, điểm tùy chọn) sau giờ thi; đổi kết quả thì thí sinh được báo lại. Phòng chỉ hủy được khi chưa có ai; đổi giờ/phòng thì báo cho thí sinh trong phòng. Hồ sơ đăng ký dự thi **không duyệt được** khi chưa có kết quả Đạt.
- **Thông báo**: thông báo `PUBLISHED` ai cũng xem được (kể cả chưa đăng nhập); chỉ cán bộ tuyển sinh được soạn, đăng, gỡ. Mọi thao tác ghi nhật ký.
- **Lỗi**: luôn trả về `{ error_code, message }` bằng tiếng Việt.

## Danh sách API (tiền tố `/api/v1`)

| Method | Path | Quyền |
|---|---|---|
| POST | `/auth/staff/login`, `/auth/staff/google` | công khai |
| GET | `/auth/staff/me` | cán bộ |
| GET | `/auth/staff/me/profile` (trang cá nhân: thông tin tài khoản, đăng nhập gần đây, việc của tôi, hoạt động gần đây) | cán bộ |
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
| PATCH | `/admin/applications/:id/payment/confirm` | application:review |
| GET / PUT | `/admin/payment-settings` | application:view / batch:manage |
| GET / POST, PATCH | `/admin/majors`, `/admin/majors/:id` | batch:view / batch:manage |
| GET | `/admission-batches`, `/admission-batches/:id` | batch:view |
| POST/PATCH/PUT | `/admission-batches`, `/admission-batches/:id/status`, `/admission-batches/:id/majors`, `/admission-batch-majors/:id` | batch:manage |
| PATCH | `/admission-batch-majors/:id/approve` | batch:approve |
| GET / POST | `/score-appeals`, `/score-appeals/:id/resolve` | appeal:view / appeal:resolve |
| GET/POST/PUT/PATCH | `/staff-accounts`, `/staff-accounts/:id/roles`, `/staff-accounts/:id` (sửa họ tên), `/staff-accounts/:id/status`, `/staff-accounts/:id/reset-password`, `/staff-accounts/:id/offboard`, `/staff-accounts/:id/restore` | account:manage |
| POST | `/auth/staff/change-password` | cán bộ (kể cả khi đang bị bắt đổi mật khẩu) |
| GET | `/audit-logs` | audit:view |
| GET | `/admin/candidates`, `/admin/candidates/:id`, `/admin/candidates/export` | candidate:view |
| PATCH | `/admin/candidates/:id/lock`, `/admin/candidates/:id/unlock` | candidate:manage |
| GET / PATCH | `/admin/supervisor-requests`, `/admin/supervisor-requests/:id/respond` | supervisor:manage |
| GET / POST / PATCH | `/admin/lecturers`, `/admin/lecturers/:id` | supervisor:manage |
| GET / POST | `/supervisors/me`, `/supervisors/me/request` | thí sinh |
| GET | `/admin/scoring/batches` | exam:manage, score:enter, result:view, decision:manage hoặc decision:sign |
| GET | `/admin/scoring/majors/:id` | exam:manage, score:enter hoặc result:view |
| PUT / POST / PATCH | `/admin/scoring/majors/:id/committee`, `/admin/scoring/majors/:id/interviews/auto`, `/admin/scoring/interviews/:id`, `/admin/scoring/majors/:id/publish-scores` | exam:manage |
| PUT | `/admin/scoring/majors/:id/scores` | score:enter |
| PATCH | `/admin/scoring/appeal-requests/:id/confirm-payment`, `/admin/scoring/appeal-requests/:id/close` | appeal:resolve |
| GET | `/admin/results/majors/:id` | result:view |
| POST | `/admin/results/majors/:id/rank`, `/admin/results/majors/:id/propose` | result:propose |
| POST | `/admin/results/majors/:id/approve`, `/admin/results/majors/:id/return` | result:approve |
| GET | `/admin/decisions/batches/:batchId`, `/admin/decisions/:id` | decision:manage hoặc decision:sign |
| POST / PATCH | `/admin/decisions/batches/:batchId`, `/admin/decisions/:id`, `/admin/decisions/:id/submit`, `/admin/decisions/batches/:batchId/process-overdue`, `/admin/decisions/enrollment/:applicationId/originals`, `/admin/decisions/enrollment/:applicationId/complete` | decision:manage |
| POST | `/admin/decisions/:id/sign`, `/admin/decisions/:id/return` | decision:sign |
| POST | `/applications/me/appeal`, `/applications/me/enrollment/confirm`, `/applications/me/enrollment/decline` | thí sinh |
| GET | `/admin/complaints` | complaint:view |
| PATCH | `/admin/complaints/:id/accept`, `/admin/complaints/:id/respond` | complaint:handle |
| GET | `/complaints/me` | thí sinh |
| POST | `/admin/jobs/run` | batch:manage |
| GET | `/admin/english-test/batches`, `/admin/english-test/batches/:batchId` | exam:manage |
| POST | `/admin/english-test/batches/:batchId/sessions`, `/admin/english-test/batches/:batchId/auto-assign` | exam:manage |
| PATCH / PUT | `/admin/english-test/sessions/:id`, `/admin/english-test/sessions/:id/results`, `/admin/english-test/registrations/:applicationId/move` | exam:manage |
| GET/PATCH | `/candidates/me` | thí sinh |
| GET | `/applications/me`, `/applications/me/documents`, `/applications/me/supervisor-request`, `/notifications/me` | thí sinh |
| PATCH | `/notifications/:id/read`, `/notifications/me/read-all` | thí sinh |
| POST | `/applications/:id/documents` (multipart: `file`, `documentType`), `/applications/me/supplement`, `/complaints` | thí sinh |
| GET | `/applications/me/full`, `/applications/me/checklist`, `/lecturers` | thí sinh |
| POST/PUT/DELETE | `/applications/me/draft`, `/applications/me/language`, `/applications/me/proposal`, `/applications/me/documents/:id`, `/applications/me/submit`, `/applications/me/cancel` | thí sinh |
| GET | `/health` (ngoài tiền tố) | công khai |

## Lệnh hữu ích

| Lệnh | Việc làm |
|---|---|
| `npm run dev` | Chạy và tự khởi động lại khi sửa code |
| `npm run build` rồi `npm start` | Chạy bản build |
| `npm run typecheck` | Kiểm tra kiểu TypeScript |
| `npm run db:backup` | Sao lưu CSDL (kèm trigger, thủ tục) và thư mục tệp minh chứng vào `backups/` — chỉ tạo bản mới |
| `npm run db:update` | Cập nhật CSDL đang có dữ liệu lên bản mới nhất (migration v5–v11, thông báo mẫu) rồi tự chạy `prisma generate` — tắt backend trước khi chạy — chỉ thêm, không xóa |
| `npm run db:pull` rồi `npm run prisma:generate` | Khi CSDL đổi cấu trúc: cập nhật `schema.prisma` từ CSDL |

## Chưa làm

- **Thi viết (hình thức `THI_VIET`)**: nhập điểm được nhưng chưa có xếp phòng thi viết / số báo danh riêng (Trường hiện xét tuyển bằng hồ sơ + phỏng vấn / trình bày đề cương).
- **Gửi SMS:** chưa có; mã xác thực và thông báo chỉ gửi qua email.
- **Danh mục ngành và lệ phí tiến sĩ theo thông báo thật**: cần các trang còn lại của thông báo tuyển sinh để nhập đúng danh sách ngành và mức lệ phí xét tuyển tiến sĩ (hiện để tạm 1.000.000 đ).
