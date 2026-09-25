-- ============================================================================
-- MIGRATION v4 — Vá lỗi cú pháp "ON UPDATE UTC_TIMESTAMP()" và lỗi logic
--                mất total_score khi chưa có dòng application_ranking
-- Người thực hiện : Lâm Hoài An (QA / Security & Data Specialist)
-- Áp dụng trên    : admission_db (v3 -> v3.1)
-- Bối cảnh        :
--   (1) admission_db_v3.sql bản gốc dùng
--       "DEFAULT UTC_TIMESTAMP() ON UPDATE UTC_TIMESTAMP()" cho
--       admission_batch.updated_at và system_config.updated_at. MariaDB CHỈ
--       chấp nhận họ CURRENT_TIMESTAMP cho mệnh đề ON UPDATE tự động, nên câu
--       CREATE TABLE admission_batch báo lỗi cú pháp ngay từ bảng ĐẦU TIÊN,
--       khiến toàn bộ admission_db_v3.sql gốc không tạo được bảng nào (đã
--       kiểm chứng bằng cách chạy thật trên MariaDB 10.11).
--   (2) sp_recalc_application_total_score chỉ UPDATE application_ranking. Nếu
--       exam_score được nhập trước khi có dòng application_ranking cho hồ sơ
--       đó, UPDATE khớp 0 dòng -> total_score coi như mất, không tự phục hồi
--       trừ khi có phúc khảo sau này (đã kiểm chứng bằng dữ liệu thật).
--
--   Nếu bạn khởi tạo CSDL từ bản admission_db_v3.sql ĐÃ ĐƯỢC VÁ kèm theo cùng
--   migration này thì KHÔNG cần chạy file này nữa — 2 fix dưới đây đã nằm sẵn
--   trong file gốc. File migration này chỉ dành cho môi trường đã có sẵn một
--   bản admission_db từ trước (vd: đã tự sửa tay lỗi (1) để chạy được, hoặc
--   phục hồi từ bản backup cũ) và cần áp dụng thêm 2 fix logic ở trên.
-- ============================================================================

USE admission_db;

-- ----------------------------------------------------------------------------
-- Fix 1: Bỏ "ON UPDATE UTC_TIMESTAMP()" (sai cú pháp) khỏi định nghĩa cột,
-- thay bằng trigger BEFORE UPDATE tự set giờ UTC — không phụ thuộc time_zone
-- cấu hình ở server/session như khi dùng "ON UPDATE CURRENT_TIMESTAMP".
-- ----------------------------------------------------------------------------
ALTER TABLE admission_batch
    MODIFY COLUMN updated_at DATETIME NOT NULL DEFAULT UTC_TIMESTAMP();

ALTER TABLE system_config
    MODIFY COLUMN updated_at DATETIME NOT NULL DEFAULT UTC_TIMESTAMP();

DROP TRIGGER IF EXISTS trg_admission_batch_updated_at;
DROP TRIGGER IF EXISTS trg_system_config_updated_at;

DELIMITER $$

CREATE TRIGGER trg_admission_batch_updated_at
BEFORE UPDATE ON admission_batch
FOR EACH ROW
BEGIN
    SET NEW.updated_at = UTC_TIMESTAMP();
END$$

CREATE TRIGGER trg_system_config_updated_at
BEFORE UPDATE ON system_config
FOR EACH ROW
BEGIN
    SET NEW.updated_at = UTC_TIMESTAMP();
END$$

DELIMITER ;

-- ----------------------------------------------------------------------------
-- Fix 2: sp_recalc_application_total_score đổi từ UPDATE-only sang
-- INSERT ... ON DUPLICATE KEY UPDATE để luôn tự tạo dòng application_ranking
-- nếu chưa có, thay vì âm thầm bỏ qua.
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_recalc_application_total_score;

DELIMITER $$

CREATE PROCEDURE sp_recalc_application_total_score(IN p_application_id BIGINT UNSIGNED)
BEGIN
    -- rank_order = 1 chỉ là giá trị khởi tạo tạm (cột có CHECK > 0, không
    -- nhận NULL/0); giá trị thật do bước "Xếp hạng thí sinh" (UC-TT-02) gán
    -- lại sau khi so sánh toàn bộ ứng viên cùng batch_major. Mệnh đề
    -- ON DUPLICATE KEY UPDATE chỉ đụng total_score nên không ghi đè rank_order
    -- đã được xếp trước đó.
    INSERT INTO application_ranking (application_id, total_score, rank_order)
    VALUES (
        p_application_id,
        (SELECT COALESCE(SUM(es.score * s.weight), 0)
         FROM exam_score es
         JOIN exam_subject s ON s.subject_id = es.subject_id
         WHERE es.application_id = p_application_id),
        1
    )
    ON DUPLICATE KEY UPDATE
        total_score = VALUES(total_score);
END$$

DELIMITER ;

-- ----------------------------------------------------------------------------
-- Fix 3 (vệ sinh, không đổi hành vi): thêm IF NOT EXISTS cho CREATE INDEX để
-- migration này chạy được nhiều lần / nối tiếp admission_db_v3.sql mà không
-- báo lỗi "Duplicate key name" như bản migration_v3_GD3.sql gốc từng bị.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);

-- ----------------------------------------------------------------------------
-- Backfill 1 lần: với các hồ sơ đã có exam_score nhưng total_score đang sai
-- do lỗi (2) ở trên (dòng application_ranking được tạo sau, hoặc chưa từng
-- được tạo), tính lại total_score đúng thực tế ngay sau khi áp dụng migration.
-- Dùng INSERT ... SELECT ... GROUP BY để xử lý theo tập hợp, không cần cursor.
-- ----------------------------------------------------------------------------
INSERT INTO application_ranking (application_id, total_score, rank_order)
SELECT es.application_id,
       SUM(es.score * s.weight) AS total_score,
       1
FROM exam_score es
JOIN exam_subject s ON s.subject_id = es.subject_id
GROUP BY es.application_id
ON DUPLICATE KEY UPDATE
    total_score = VALUES(total_score);

-- ============================================================================
-- HẾT MIGRATION v4 — 2 ALTER TABLE + 2 CREATE TRIGGER + 1 thay thế PROCEDURE
-- + 1 CREATE INDEX (idempotent) + 1 backfill dữ liệu chạy 1 lần được áp dụng.
-- ============================================================================
