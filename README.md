# Backend — Phân hệ Quản lý Tuyển sinh Sau đại học (Khởi tạo mã nguồn GĐ3)

Đây là **mã nguồn khởi tạo (scaffold)** cho nhóm Backend, được sinh ra đúng theo tài liệu thiết kế
`Backend_ThietKeChiTiet_GD3.md` (8 module, Class Diagram, Sequence Diagram, thuật toán nghiệp vụ).
Mục tiêu: 3 bạn Backend có sườn code chạy được ngay, thay vì bắt đầu từ số 0.

## 1. Công nghệ

- **NestJS 10** (Clean Architecture / Modular Monolith) + TypeScript
- **Prisma ORM** + MySQL/MariaDB (`admission_db`)
- JWT (đăng nhập staff bằng mật khẩu) + Google OAuth2 (đăng nhập Google)
- `@nestjs/event-emitter` để giao tiếp bất đồng bộ giữa các module (domain event)

## 2. Cấu trúc thư mục

```
backend/
├── prisma/schema.prisma        # Toàn bộ 40 bảng theo ERD v3
├── src/
│   ├── main.ts, app.module.ts
│   ├── health/                 # GET /health cho DevOps
│   ├── common/                 # Hạ tầng dùng chung (Prisma, Guard, RBAC, Event, Filter)
│   └── modules/
│       ├── auth-account/       # M1 - Lê Phước Hào
│       ├── admission-config/   # M2 - Lê Phước Hào
│       ├── application/        # M3 - Phạm Lư Gia Quân
│       ├── application-review/ # M4 - Phạm Lư Gia Quân
│       ├── exam/                       # M5 - Phan Minh Trí
│       ├── admission-result/           # M6 - Phan Minh Trí
│       ├── decision-enrollment/        # M7 - Phan Minh Trí
│       └── notification-audit/         # M8 - dùng chung (audit_log, notification)
```

Mỗi module bám sát đúng Class Diagram / Sequence Diagram / thuật toán đã mô tả trong
`Backend_ThietKeChiTiet_GD3.md` — nên đọc song song 2 tài liệu khi code tiếp.

## 3. Cài đặt & chạy thử

```bash
cp .env.example .env          # rồi điền DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID thật
npm install
npx prisma migrate dev --name init     # tạo schema trong DB theo prisma/schema.prisma
npm run start:dev
# API chạy tại http://localhost:3000/api/v1, healthcheck tại /api/v1/health
```

## 4. Việc CẦN LÀM TIẾP (chưa hoàn thiện trong scaffold này)

- [ ] **Đối chiếu `prisma/schema.prisma` với `admission_db_v3.sql` thật** — schema ở đây dựng lại từ
      `ERD_PhanHe_TuyenSinh_GD3.md` (bản tóm tắt, không phải dump DB), có thể thiếu vài cột phụ
      (ví dụ `created_at`/`updated_at` ở một số bảng, cột lưu mã OTP trong `otp_verification`...).
      Cách nhanh nhất: nhờ QA (Lâm Hoài An) cung cấp DB thật rồi chạy `npx prisma db pull`.
- [ ] Bổ sung unit test (Jest) cho các thuật toán quan trọng: `buildRanking`, `applyBenchmark`,
      `promoteFromWaitlist`, state machine trong `ApplicationReviewService`.
- [ ] Thêm `RegisterCandidateDto`/OTP thật gửi qua email/SMS (hiện `NotificationService` mới tạo
      bản ghi `notification`, chưa gọi provider gửi email/SMS thật).
- [ ] Rà lại **tiêu chí tie-break khi đồng điểm** trong `AdmissionResultService.buildRanking()` —
      hiện đang tạm sắp theo `applicationId`, cần thống nhất với Team Lead / quy chế tuyển sinh thật.
- [ ] Mỗi thành viên bổ sung unit test + Swagger decorator (`@nestjs/swagger`) cho module mình phụ trách.

## 5. Cách đưa lên Repository của nhóm đồ án

Repo chính (`DH24PM-CNPM-Nhom09/DH24PM-CNPM-Nhom09`) chỉ chứa tài liệu; code Backend nằm ở nhánh
`Backend` trên fork của Võ Trường Hải
(`https://github.com/haidpm235414/DH24PM-CNPM-Nhom09/tree/Backend/src`). Gợi ý quy trình:

```bash
# 1. Clone fork và checkout đúng nhánh Backend
git clone https://github.com/haidpm235414/DH24PM-CNPM-Nhom09.git
cd DH24PM-CNPM-Nhom09
git checkout Backend

# 2. Copy toàn bộ nội dung thư mục backend/ (giải nén từ file .zip) vào đúng
#    vị trí mà README chính đang trỏ tới, ví dụ thư mục src/ ở gốc nhánh Backend
#    (điều chỉnh lại path cho khớp với những gì nhóm đã thống nhất)

# 3. Commit theo từng module do đúng người phụ trách push, để lịch sử commit
#    phản ánh đúng ai làm module nào (phục vụ chấm điểm cá nhân)
git add .
git commit -m "feat(auth-account): khoi tao module dang nhap + dang ky (M1)"
git push origin Backend

# 4. Mở Pull Request Backend -> main để Team Lead / QA review, KHÔNG merge thẳng
```

**Lưu ý quan trọng:** vì 3 bạn cùng code trên 1 nhánh `Backend`, nên **mỗi bạn nên tạo nhánh con**
từ `Backend` (ví dụ `Backend-hao`, `Backend-quan`, `Backend-tri`), code xong module của mình rồi mở
PR gộp vào `Backend` — tránh 3 người push thẳng cùng lúc gây conflict trên các file dùng chung
(`app.module.ts`, `prisma/schema.prisma`, `common/`).
