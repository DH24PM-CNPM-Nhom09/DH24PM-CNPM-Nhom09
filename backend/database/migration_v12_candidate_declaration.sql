-- ============================================================================
-- MIGRATION v12 — Thí sinh khai thông tin cá nhân theo CCCD khi làm hồ sơ
-- Thêm ngày cấp, nơi cấp CCCD, nơi sinh, dân tộc, nơi thường trú cho bảng candidate
-- và thời điểm thí sinh tích ô cam kết thông tin khai là đúng sự thật cho bảng application.
-- Chạy SAU migration_v11_privacy.sql. CHỈ THÊM cột, chạy lại nhiều lần vẫn an toàn.
-- ============================================================================
SET NAMES utf8mb4;
USE admission_db;

ALTER TABLE candidate
    ADD COLUMN IF NOT EXISTS id_issue_date DATE NULL COMMENT 'Ngày cấp CCCD',
    ADD COLUMN IF NOT EXISTS id_issue_place VARCHAR(255) NULL COMMENT 'Nơi cấp CCCD (ghi ở mặt sau thẻ)',
    ADD COLUMN IF NOT EXISTS birthplace VARCHAR(255) NULL COMMENT 'Nơi sinh (tỉnh, thành phố)',
    ADD COLUMN IF NOT EXISTS ethnicity VARCHAR(50) NULL COMMENT 'Dân tộc',
    ADD COLUMN IF NOT EXISTS permanent_address TEXT NULL COMMENT 'Nơi thường trú theo CCCD';

ALTER TABLE application
    ADD COLUMN IF NOT EXISTS declaration_confirmed_at DATETIME NULL COMMENT 'Lúc thí sinh cam kết thông tin khai và minh chứng là đúng sự thật (UTC)';
