-- ============================================================================
-- MIGRATION v5 — Thông báo tuyển sinh / quy định cho cổng Thí sinh
-- Chạy SAU admission_db_v3.sql và migration_v4_backend.sql.
-- CHỈ THÊM, không xóa hay đổi kiểu cột nào. Chạy lại nhiều lần vẫn an toàn.
-- (Có thể chạy bằng: npm run db:update — lệnh này chạy file này và nạp thông báo mẫu.)
-- ============================================================================
SET NAMES utf8mb4;
USE admission_db;

-- Phân loại thông báo để thí sinh lọc: tuyển sinh, quy định - quy chế, hướng dẫn, kết quả
ALTER TABLE announcement
    ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'TUYEN_SINH'
        CHECK (category IN ('TUYEN_SINH','QUY_DINH','HUONG_DAN','KET_QUA')),
    ADD COLUMN IF NOT EXISTS is_pinned TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Ghim lên đầu danh sách',
    ADD COLUMN IF NOT EXISTS updated_at DATETIME NULL;

CREATE INDEX IF NOT EXISTS idx_announcement_status_published ON announcement (status, published_at);
