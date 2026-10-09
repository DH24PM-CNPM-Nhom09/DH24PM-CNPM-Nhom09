# Phân hệ Frontend — Web tuyển sinh sau đại học

Web cho Hệ thống Quản lý Tuyển sinh Sau đại học, Trường Đại học An Giang: **cổng thí sinh** và **cổng cán bộ**. Đã đủ quy trình xét tuyển cho cả Thạc sĩ và Tiến sĩ.

Người phụ trách: Nguyễn Phúc Khang (nhánh `frontend`).

| Thư mục | Nội dung |
| :--- | :--- |
| `frontend/web/` | Giao diện Next.js 14 + Tailwind (cổng thí sinh `/`, cổng cán bộ `/admin`) |
| `backend/` (ở thư mục gốc repo) | API NestJS + Prisma mà web gọi tới |
| `backend/database/` | CSDL `admission_db`: bản gốc v3 của nhóm + các migration v4 → v12 (chỉ thêm, không xóa) |
| `frontend/docker/`, `frontend/docker-compose.yml` | Chạy cả CSDL + API + web bằng một lệnh |

## Chạy nhanh bằng Docker

```bash
git clone https://github.com/DH24PM-CNPM-Nhom09/DH24PM-CNPM-Nhom09.git
cd DH24PM-CNPM-Nhom09/frontend
copy .env.example .env          # sửa DEV_AUTH_BYPASS=true, DEMO_LOGIN=true để demo
docker compose up -d --build
docker compose exec backend npm run db:seed:demo
```

Mở http://localhost:3000 (thí sinh) và http://localhost:3000/admin/login (cán bộ, mật khẩu demo `Demo@123`).

## Đọc tự động CCCD / văn bằng (AI)

- **Thí sinh** (bước *Minh chứng* → mục *1. Thông tin cá nhân*): bấm **📷 Chọn ảnh CCCD**, chọn ảnh mặt trước (có mã QR) và mặt sau. Hệ thống đọc mã QR (chính xác tuyệt đối) hoặc nhận dạng chữ tiếng Việt (OCR), hiện số CCCD, ngày cấp, nơi cấp, nơi sinh, nơi thường trú để kiểm tra rồi **Điền vào biểu mẫu**; cảnh báo nếu họ tên, ngày sinh trên thẻ khác hồ sơ.
- **Cán bộ** (chi tiết hồ sơ → bấm tên tệp minh chứng): nút **Đọc tự động** đối chiếu số CCCD, họ tên, ngày sinh, ngày cấp với thông tin thí sinh khai; với văn bằng, chứng chỉ thì tách *Số hiệu* và *Số vào sổ cấp bằng* để tra cứu.
- Ảnh được xử lý ngay trong trình duyệt, không gửi lên máy chủ. Thư viện (jsQR, Tesseract.js, pdf.js) tự tải từ CDN jsDelivr ở lần bấm đầu tiên nên máy cần có mạng. Mã nguồn: `web/src/lib/idcard-parse.ts`, `web/src/lib/idcard-reader.ts`.

Hướng dẫn đầy đủ cho cả nhóm (cài Docker, tài khoản demo, lỗi thường gặp, đưa lên máy chủ): [TRIEN_KHAI_DOCKER.md](TRIEN_KHAI_DOCKER.md).
Chạy không dùng Docker (XAMPP + Node.js): [backend/README.md](../backend/README.md) và [web/ADMIN_README.md](web/ADMIN_README.md).
