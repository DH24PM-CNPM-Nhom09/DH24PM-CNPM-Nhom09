# Phân hệ Frontend — Web tuyển sinh sau đại học

Web cho Hệ thống Quản lý Tuyển sinh Sau đại học, Trường Đại học An Giang: **cổng thí sinh** và **cổng cán bộ**. Đã đủ quy trình xét tuyển cho cả Thạc sĩ và Tiến sĩ.

Người phụ trách: Nguyễn Phúc Khang (nhánh `frontend`).

| Thư mục | Nội dung |
| :--- | :--- |
| `web/` | Giao diện Next.js 14 + Tailwind (cổng thí sinh `/`, cổng cán bộ `/admin`) |
| `backend/` | API NestJS + Prisma mà web gọi tới (tách riêng với thư mục `backend/` ở ngoài của nhóm backend) |
| `backend/database/` | CSDL `admission_db`: bản gốc v3 của nhóm + các migration v4 → v11 (chỉ thêm, không xóa) |
| `docker/`, `docker-compose.yml` | Chạy cả CSDL + API + web bằng một lệnh |

## Chạy nhanh bằng Docker

```bash
git clone -b frontend https://github.com/DH24PM-CNPM-Nhom09/DH24PM-CNPM-Nhom09.git
cd DH24PM-CNPM-Nhom09/frontend
copy .env.example .env          # sửa DEV_AUTH_BYPASS=true, DEMO_LOGIN=true để demo
docker compose up -d --build
docker compose exec backend npm run db:seed:demo
```

Mở http://localhost:3000 (thí sinh) và http://localhost:3000/admin/login (cán bộ, mật khẩu demo `Demo@123`).

Hướng dẫn đầy đủ cho cả nhóm (cài Docker, tài khoản demo, lỗi thường gặp, đưa lên máy chủ): [TRIEN_KHAI_DOCKER.md](TRIEN_KHAI_DOCKER.md).
Chạy không dùng Docker (XAMPP + Node.js): [backend/README.md](backend/README.md) và [web/ADMIN_README.md](web/ADMIN_README.md).
