-- ============================================================================
-- MIGRATION v11 — Bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP)
-- Ghi nhận thời điểm thí sinh đồng ý với Chính sách bảo vệ dữ liệu cá nhân khi tạo tài khoản.
-- Chạy SAU migration_v10_admission_results.sql. CHỈ THÊM 1 cột, chạy lại nhiều lần vẫn an toàn.
-- ============================================================================
SET NAMES utf8mb4;
USE admission_db;

ALTER TABLE candidate_account
    ADD COLUMN IF NOT EXISTS privacy_consent_at DATETIME NULL COMMENT 'Lúc thí sinh đồng ý chính sách bảo vệ dữ liệu cá nhân (UTC)';
