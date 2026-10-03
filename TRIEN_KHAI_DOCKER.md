# Triển khai bằng Docker

Hệ thống gồm 3 phần, mỗi phần một image:

| Phần | Dockerfile | Cổng | Ghi chú |
| :--- | :--- | :--- | :--- |
| CSDL MariaDB 10.11 | `docker/db/Dockerfile` (build ở **thư mục gốc**) | 3306 | Tự tạo đủ 45 bảng, 13 trigger từ `backend/database` (v3 → v11) khi ổ dữ liệu còn trống |
| Backend NestJS | `backend/Dockerfile` | 4000 | Healthcheck `GET /health`; tệp minh chứng lưu ở `/app/uploads` |
| Frontend Next.js | `frontend/web/Dockerfile` | 3000 | `NEXT_PUBLIC_API_BASE_URL` được đóng vào lúc **build** |

## 1. Chạy cả hệ thống trên một máy (docker compose)

```bash
cp .env.example .env          # Windows: copy .env.example .env
# sửa trong .env: DB_ROOT_PASSWORD, DB_PASSWORD, JWT_SECRET (chuỗi ngẫu nhiên ≥ 32 ký tự)
docker compose up -d --build

# Lần đầu, chọn MỘT trong hai:
docker compose exec backend npm run db:seed        # dùng thật: chỉ tạo quantri@agu.edu.vn / Admin@123 (bắt đổi mật khẩu)
docker compose exec backend npm run db:seed:demo   # demo: nạp dữ liệu mẫu, mật khẩu chung Demo@123
```

- Frontend: http://localhost:3000 · Backend: http://localhost:4000/api/v1 · Kiểm tra: http://localhost:4000/health
- Muốn demo đăng nhập Google giả và hiện tài khoản mẫu ở trang cán bộ: đặt `DEV_AUTH_BYPASS=true`, `DEMO_LOGIN=true` trong `.env` rồi `docker compose up -d --build`.
- Dữ liệu nằm trong 2 volume `db_data` (CSDL) và `uploads` (tệp thí sinh). `docker compose down` **không** xóa dữ liệu; chỉ `docker compose down -v` mới xóa — đừng dùng `-v` trên máy thật.
- Cập nhật code mới: `git pull` → `docker compose up -d --build` → `docker compose exec backend npm run db:update` (chạy các migration mới, chỉ thêm, không xóa).
- Seed không bao giờ ghi đè: gặp CSDL đã có dữ liệu thì tự dừng.

## 2. Biến môi trường

Backend (đặt ở `.env` khi dùng compose, hoặc ở phần Environment của nơi triển khai):

| Biến | Bắt buộc | Ý nghĩa |
| :--- | :--- | :--- |
| `DATABASE_URL` | có | `mysql://<user>:<mật khẩu>@<máy CSDL>:3306/admission_db` (compose tự ghép) |
| `JWT_SECRET` | có | chuỗi ngẫu nhiên ≥ 32 ký tự |
| `CORS_ORIGINS` | có | địa chỉ frontend, ví dụ `https://tuyensinh.example.com` (compose lấy từ `FRONTEND_URL`) |
| `DEV_AUTH_BYPASS` | | `false` khi dùng thật |
| `GOOGLE_CLIENT_ID`, `SMTP_USER`, `SMTP_PASS` | | đăng nhập Google, gửi email (để trống thì chưa dùng) |
| `AUTO_JOB_MINUTES` | | tác vụ tự động xử lý quá hạn, mặc định 15 phút (0 = tắt) |
| `AUTH_RATE_LIMIT` | | giới hạn gọi API đăng nhập mỗi 10 phút / IP, mặc định 60 |

Frontend (build arg): `NEXT_PUBLIC_API_BASE_URL=https://<địa chỉ backend>/api/v1`, `NEXT_PUBLIC_DEMO_LOGIN=false`. Đổi địa chỉ backend thì phải build lại frontend.

## 3. Đưa lên dịch vụ đám mây (ví dụ Render)

Render không chạy file docker-compose, nên tạo 3 dịch vụ riêng từ cùng repo:

1. **CSDL** — Private Service, Docker, Dockerfile `docker/db/Dockerfile`, build context là thư mục gốc. Biến: `MARIADB_ROOT_PASSWORD`, `MARIADB_DATABASE=admission_db`, `MARIADB_USER`, `MARIADB_PASSWORD`. **Gắn ổ lưu trữ bền vững vào `/var/lib/mysql`**, nếu không mỗi lần khởi động lại sẽ mất toàn bộ dữ liệu.
2. **Backend** — Web Service, Docker, thư mục `backend`. Health check path `/health`. Biến như mục 2, `DATABASE_URL` trỏ tới tên nội bộ của dịch vụ CSDL. **Gắn ổ lưu trữ bền vững vào `/app/uploads`** (tệp minh chứng của thí sinh).
3. **Frontend** — Web Service, Docker, thư mục `frontend/web`, khai báo `NEXT_PUBLIC_API_BASE_URL` trỏ tới địa chỉ HTTPS của backend (cần có lúc build).

Ổ lưu trữ bền vững thường chỉ có ở gói trả phí; gói miễn phí phù hợp để demo, không phù hợp để chạy thật. Sau khi chạy: `npm run db:seed` một lần trong shell của dịch vụ backend.

## 4. Trước khi dùng thật

Xem mục "Trước khi triển khai thật" trong `backend/README.md`: tắt `DEV_AUTH_BYPASS`, đổi toàn bộ mật khẩu / khóa bí mật, chạy sau HTTPS, sao lưu định kỳ (`npm run db:backup` trên máy có mysqldump, hoặc `docker compose exec db mariadb-dump -uroot -p --routines --triggers admission_db > backup.sql`), rà soát trang Chính sách bảo vệ dữ liệu cá nhân.
