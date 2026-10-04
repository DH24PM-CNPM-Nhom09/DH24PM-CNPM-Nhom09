-- ============================================================================
-- MIGRATION v8 — Khớp Thông báo tuyển sinh thạc sĩ thật của Trường ĐH An Giang
-- Chạy SAU migration_v7_payment_config.sql. KHÔNG xóa dòng hay cột nào:
--   1. Mở rộng danh sách loại minh chứng (thêm đơn đăng ký, sơ yếu lý lịch,
--      lý lịch chuyên môn, ảnh 3x4, CCCD, giấy giới thiệu, giấy ưu tiên,
--      công nhận văn bằng nước ngoài, chứng chỉ AI). Các loại cũ giữ nguyên.
--   2. Thêm cột ngoại ngữ cho hồ sơ (có chứng chỉ / được miễn / đăng ký dự thi).
--   3. Thêm cột chi tiết các khoản lệ phí cho application_payment.
--   4. Thêm cấu hình các khoản lệ phí theo mục 6.4 thông báo.
-- Chạy lại nhiều lần vẫn an toàn. (npm run db:update tự chạy file này.)
-- ============================================================================
SET NAMES utf8mb4;
USE admission_db;

-- 1. Loại minh chứng (đổi ràng buộc CHECK của cột, dữ liệu cũ hợp lệ vì chỉ THÊM giá trị)
ALTER TABLE application_document
    MODIFY document_type VARCHAR(30) NOT NULL
        CHECK (document_type IN ('VAN_BANG','BANG_DIEM','CHUNG_CHI_NGOAI_NGU','DE_CUONG_NCS',
                                  'THU_GIOI_THIEU','CONG_BO_KHOA_HOC','KHAC',
                                  'DON_DANG_KY','SO_YEU_LY_LICH','LY_LICH_CHUYEN_MON','ANH_THE','CCCD',
                                  'GIAY_GIOI_THIEU','GIAY_UU_TIEN','CONG_NHAN_VAN_BANG','CHUNG_CHI_AI'));

-- 2. Ngoại ngữ: CERTIFICATE = có chứng chỉ B1 trở lên; EXEMPT = thuộc diện miễn khác; TEST = đăng ký thi đánh giá năng lực
ALTER TABLE application
    ADD COLUMN IF NOT EXISTS language_option VARCHAR(20) NULL
        CHECK (language_option IS NULL OR language_option IN ('CERTIFICATE','EXEMPT','TEST')),
    ADD COLUMN IF NOT EXISTS language_note VARCHAR(500) NULL;

-- 3. Chi tiết lệ phí (JSON: [{"code":"REGISTRATION","label":"...","amount":100000}, ...])
ALTER TABLE application_payment
    ADD COLUMN IF NOT EXISTS fee_detail TEXT NULL;

-- 4. Các khoản lệ phí (mục 6.4 "Thu tiền dự tuyển" — thông báo tuyển sinh thạc sĩ 2025 đợt 1)
INSERT INTO system_config (config_key, config_value, description) VALUES
    ('FEE_REGISTRATION',       '100000', 'Lệ phí đăng ký dự tuyển (đồng/hồ sơ)'),
    ('FEE_ENGLISH_TEST',       '120000', 'Lệ phí đăng ký thi đánh giá năng lực tiếng Anh (đồng/thí sinh)'),
    ('FEE_SUPPLEMENT_CREDIT',  '490000', 'Học phí học bổ sung kiến thức (đồng/tín chỉ) — ngành gần'),
    ('FEE_APPEAL',             '360000', 'Lệ phí phúc khảo hồ sơ (đồng/hồ sơ)')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- Lệ phí xét tuyển thạc sĩ theo thông báo: 360.000 đ/hồ sơ.
-- Chỉ thay giá trị mẫu cũ 600000 (do bản trước đặt tạm); nếu cán bộ đã tự chỉnh thì giữ nguyên.
UPDATE system_config SET config_value = '360000', description = 'Lệ phí xét tuyển thạc sĩ (đồng/hồ sơ)'
 WHERE config_key = 'APPLICATION_FEE_THAC_SI' AND config_value = '600000';
UPDATE system_config SET description = 'Lệ phí xét tuyển tiến sĩ (đồng/hồ sơ)' WHERE config_key = 'APPLICATION_FEE_TIEN_SI';
