-- ============================================================================
-- MIGRATION v6 — Bảo mật tài khoản cán bộ
-- Chạy SAU migration_v5_announcement.sql. CHỈ THÊM cột, không xóa hay đổi gì.
-- Chạy lại nhiều lần vẫn an toàn. (npm run db:update tự chạy file này.)
-- ============================================================================
SET NAMES utf8mb4;
USE admission_db;

ALTER TABLE staff_account
    -- Bắt đổi mật khẩu ở lần đăng nhập tới (tài khoản vừa được cấp / cấp lại mật khẩu tạm)
    ADD COLUMN IF NOT EXISTS must_change_password TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS password_changed_at DATETIME NULL,
    -- Chống dò mật khẩu: sai nhiều lần thì khóa tạm (giống tài khoản thí sinh)
    ADD COLUMN IF NOT EXISTS failed_login_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until DATETIME NULL;
