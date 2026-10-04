-- ============================================================================
-- XÓA SẠCH DỮ LIỆU 40 BẢNG của admission_db (giữ nguyên cấu trúc bảng, trigger)
-- Dùng để chạy lại seed_dev_data.sql từ đầu.
-- !!! CHỈ CHẠY TRÊN MÁY DEV/TEST. TUYỆT ĐỐI KHÔNG CHẠY TRÊN DB THẬT/DEPLOY. !!!
-- ============================================================================
USE admission_db;
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE audit_log;
TRUNCATE TABLE notification;
TRUNCATE TABLE announcement;
TRUNCATE TABLE enrollment_completion;
TRUNCATE TABLE original_document_submission;
TRUNCATE TABLE enrollment_confirmation;
TRUNCATE TABLE decision_application;
TRUNCATE TABLE admission_decision;
TRUNCATE TABLE admission_result;
TRUNCATE TABLE waitlist;
TRUNCATE TABLE application_ranking;
TRUNCATE TABLE admission_benchmark;
TRUNCATE TABLE score_appeal;
TRUNCATE TABLE exam_score;
TRUNCATE TABLE interview_schedule;
TRUNCATE TABLE exam_assignment;
TRUNCATE TABLE exam_room;
TRUNCATE TABLE application_status_history;
TRUNCATE TABLE supplement_request;
TRUNCATE TABLE application_review;
TRUNCATE TABLE application_payment;
TRUNCATE TABLE supervisor_request;
TRUNCATE TABLE research_proposal;
TRUNCATE TABLE lecturer;
TRUNCATE TABLE application_document;
TRUNCATE TABLE application;
TRUNCATE TABLE candidate;
TRUNCATE TABLE otp_verification;
TRUNCATE TABLE candidate_account;
TRUNCATE TABLE system_config;
TRUNCATE TABLE staff_role;
TRUNCATE TABLE role;
TRUNCATE TABLE staff_account;
TRUNCATE TABLE exam_subject;
TRUNCATE TABLE committee_member;
TRUNCATE TABLE admission_committee;
TRUNCATE TABLE admission_condition;
TRUNCATE TABLE admission_batch_major;
TRUNCATE TABLE admission_major;
TRUNCATE TABLE admission_batch;

SET FOREIGN_KEY_CHECKS = 1;
