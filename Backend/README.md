# Backend – Hệ thống quản lý tuyển sinh sau đại học

Node.js + Express + Prisma (MariaDB, qua provider mysql của Prisma) · Google Login · JWT · phân quyền theo role.

## Chạy local
```bash
cp .env.example .env        # điền DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev
npm test                    # unit test dùng mock Prisma, không cần DB
```

## Cấu trúc
```
src/modules/<auth|applications|payments>/   *.service.js (nghiệp vụ) + *.routes.js (HTTP + validate)
src/middleware/                              auth (JWT, role), errorHandler
prisma/schema.prisma, seed.js
tests/                                       unit + API test (Jest, Supertest)
docs/API.md                                  tài liệu API
```

## Giả định cần đối chiếu với thiết kế GĐ3
- `prisma/schema.prisma` là schema tạm (User, Program, Application, Payment), cần khớp `admission_db_v3.sql`/ERD và do Data duyệt.
- Quy tắc: chỉ thanh toán sau khi nộp hồ sơ; chỉ duyệt `APPROVED` khi đã có giao dịch `PAID`; mỗi thí sinh một hồ sơ cho mỗi ngành; lệ phí lấy từ `APPLICATION_FEE`.
- Xác nhận thanh toán đang là thao tác thủ công của STAFF/ADMIN, chưa tích hợp cổng thanh toán.
