-- ============================================================================
-- Migration v15 — chỉ mục bổ sung (cú pháp MariaDB, dùng cho Docker / XAMPP).
-- Với MySQL 8 (Aiven) và npm run db:update, các chỉ mục này do prisma/ensure-indexes.ts tạo.
--   * Mã học viên (enrollment_completion.transfer_ref) không được trùng: hai cán bộ bấm "Hoàn tất nhập học"
--     cùng lúc trước đây có thể sinh cùng một mã.
--   * Hàng đợi gửi email thông báo: tìm nhanh các thông báo PENDING thay vì quét cả bảng.
-- Chỉ THÊM chỉ mục, không sửa hay xóa dữ liệu. Chạy lại nhiều lần vẫn an toàn.
-- ============================================================================
SET NAMES utf8mb4;
USE admission_db;

CREATE UNIQUE INDEX IF NOT EXISTS uq_completion_transfer_ref ON enrollment_completion (transfer_ref);
CREATE INDEX IF NOT EXISTS idx_notification_queue ON notification (status, channel, notification_id);
