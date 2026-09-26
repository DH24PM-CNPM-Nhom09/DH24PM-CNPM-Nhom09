-- CreateTable
CREATE TABLE `admission_batch` (
    `batch_id` BIGINT NOT NULL AUTO_INCREMENT,
    `batch_code` VARCHAR(50) NOT NULL,
    `degree_level` VARCHAR(30) NOT NULL,
    `status` VARCHAR(30) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admission_batch_batch_code_key`(`batch_code`),
    PRIMARY KEY (`batch_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admission_major` (
    `major_id` BIGINT NOT NULL AUTO_INCREMENT,
    `major_code` VARCHAR(50) NOT NULL,
    `degree_level` VARCHAR(30) NOT NULL,
    `status` VARCHAR(30) NOT NULL,

    UNIQUE INDEX `admission_major_major_code_key`(`major_code`),
    PRIMARY KEY (`major_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admission_batch_major` (
    `batch_major_id` BIGINT NOT NULL AUTO_INCREMENT,
    `batch_id` BIGINT NOT NULL,
    `major_id` BIGINT NOT NULL,
    `quota` INTEGER NOT NULL,
    `benchmark_score` DECIMAL(5, 2) NULL,
    `status` VARCHAR(30) NOT NULL,

    PRIMARY KEY (`batch_major_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admission_condition` (
    `condition_id` BIGINT NOT NULL AUTO_INCREMENT,
    `batch_major_id` BIGINT NOT NULL,
    `condition_code` VARCHAR(50) NOT NULL,
    `min_gpa` DECIMAL(3, 2) NULL,

    PRIMARY KEY (`condition_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admission_committee` (
    `committee_id` BIGINT NOT NULL AUTO_INCREMENT,
    `batch_major_id` BIGINT NOT NULL,
    `committee_name` VARCHAR(150) NOT NULL,
    `status` VARCHAR(30) NOT NULL,

    PRIMARY KEY (`committee_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `committee_member` (
    `member_id` BIGINT NOT NULL AUTO_INCREMENT,
    `committee_id` BIGINT NOT NULL,
    `role_in_committee` VARCHAR(50) NOT NULL,

    PRIMARY KEY (`member_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_subject` (
    `subject_id` BIGINT NOT NULL AUTO_INCREMENT,
    `batch_major_id` BIGINT NOT NULL,
    `exam_format` VARCHAR(30) NOT NULL,
    `weight` DECIMAL(3, 2) NOT NULL,

    PRIMARY KEY (`subject_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff_account` (
    `staff_account_id` BIGINT NOT NULL AUTO_INCREMENT,
    `staff_code` VARCHAR(50) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `status` VARCHAR(30) NOT NULL,

    UNIQUE INDEX `staff_account_staff_code_key`(`staff_code`),
    UNIQUE INDEX `staff_account_email_key`(`email`),
    PRIMARY KEY (`staff_account_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role` (
    `role_id` BIGINT NOT NULL AUTO_INCREMENT,
    `role_code` VARCHAR(50) NOT NULL,
    `role_name` VARCHAR(100) NOT NULL,

    UNIQUE INDEX `role_role_code_key`(`role_code`),
    PRIMARY KEY (`role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff_role` (
    `staff_role_id` BIGINT NOT NULL AUTO_INCREMENT,
    `staff_account_id` BIGINT NOT NULL,
    `role_id` BIGINT NOT NULL,

    PRIMARY KEY (`staff_role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_config` (
    `config_key` VARCHAR(100) NOT NULL,
    `config_value` TEXT NOT NULL,

    PRIMARY KEY (`config_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `candidate_account` (
    `account_id` BIGINT NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `phone_number` VARCHAR(20) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `status` VARCHAR(30) NOT NULL,

    UNIQUE INDEX `candidate_account_username_key`(`username`),
    UNIQUE INDEX `candidate_account_email_key`(`email`),
    UNIQUE INDEX `candidate_account_phone_number_key`(`phone_number`),
    PRIMARY KEY (`account_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `otp_verification` (
    `otp_id` BIGINT NOT NULL AUTO_INCREMENT,
    `account_id` BIGINT NOT NULL,
    `purpose` VARCHAR(30) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`otp_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `candidate` (
    `candidate_id` BIGINT NOT NULL AUTO_INCREMENT,
    `account_id` BIGINT NOT NULL,
    `full_name` VARCHAR(150) NOT NULL,
    `id_number` VARCHAR(20) NOT NULL,

    UNIQUE INDEX `candidate_account_id_key`(`account_id`),
    UNIQUE INDEX `candidate_id_number_key`(`id_number`),
    PRIMARY KEY (`candidate_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application` (
    `application_id` BIGINT NOT NULL AUTO_INCREMENT,
    `application_code` VARCHAR(50) NOT NULL,
    `candidate_id` BIGINT NOT NULL,
    `batch_major_id` BIGINT NOT NULL,
    `review_status` VARCHAR(30) NOT NULL DEFAULT 'DA_NOP',
    `admission_status` VARCHAR(30) NULL,
    `is_cancelled` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `application_application_code_key`(`application_code`),
    PRIMARY KEY (`application_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_document` (
    `document_id` BIGINT NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT NOT NULL,
    `document_type` VARCHAR(50) NOT NULL,
    `file_hash` VARCHAR(64) NOT NULL,
    `file_size_kb` INTEGER NOT NULL,

    PRIMARY KEY (`document_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lecturer` (
    `lecturer_id` BIGINT NOT NULL AUTO_INCREMENT,
    `lecturer_code` VARCHAR(50) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `status` VARCHAR(30) NOT NULL,

    UNIQUE INDEX `lecturer_lecturer_code_key`(`lecturer_code`),
    UNIQUE INDEX `lecturer_email_key`(`email`),
    PRIMARY KEY (`lecturer_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `research_proposal` (
    `proposal_id` BIGINT NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT NOT NULL,
    `document_id` BIGINT NOT NULL,
    `preferred_lecturer_id` BIGINT NOT NULL,
    `research_topic` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `research_proposal_application_id_key`(`application_id`),
    PRIMARY KEY (`proposal_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supervisor_request` (
    `request_id` BIGINT NOT NULL AUTO_INCREMENT,
    `proposal_id` BIGINT NOT NULL,
    `lecturer_id` BIGINT NOT NULL,
    `status` VARCHAR(30) NOT NULL,

    PRIMARY KEY (`request_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_payment` (
    `payment_id` BIGINT NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `payment_method` VARCHAR(30) NOT NULL,
    `transaction_code` VARCHAR(100) NULL,
    `gateway_status` VARCHAR(30) NOT NULL,

    UNIQUE INDEX `application_payment_transaction_code_key`(`transaction_code`),
    PRIMARY KEY (`payment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_review` (
    `review_id` BIGINT NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT NOT NULL,
    `reviewer_staff_id` BIGINT NOT NULL,
    `review_result` VARCHAR(30) NOT NULL,

    PRIMARY KEY (`review_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplement_request` (
    `request_id` BIGINT NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT NOT NULL,
    `requested_by_staff_id` BIGINT NOT NULL,
    `status` VARCHAR(30) NOT NULL,

    PRIMARY KEY (`request_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_status_history` (
    `history_id` BIGINT NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT NOT NULL,
    `changed_by_staff_id` BIGINT NULL,
    `changed_by_type` VARCHAR(30) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `application_status_history_created_at_idx`(`created_at`),
    PRIMARY KEY (`history_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_room` (
    `room_id` BIGINT NOT NULL AUTO_INCREMENT,
    `batch_id` BIGINT NOT NULL,
    `room_code` VARCHAR(30) NOT NULL,
    `capacity` INTEGER NOT NULL,

    PRIMARY KEY (`room_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_assignment` (
    `assignment_id` BIGINT NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT NOT NULL,
    `room_id` BIGINT NOT NULL,
    `sbd_code` VARCHAR(30) NOT NULL,

    UNIQUE INDEX `exam_assignment_application_id_key`(`application_id`),
    UNIQUE INDEX `exam_assignment_sbd_code_key`(`sbd_code`),
    PRIMARY KEY (`assignment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `interview_schedule` (
    `schedule_id` BIGINT NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT NOT NULL,
    `committee_id` BIGINT NOT NULL,
    `status` VARCHAR(30) NOT NULL,

    PRIMARY KEY (`schedule_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_score` (
    `score_id` BIGINT NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT NOT NULL,
    `subject_id` BIGINT NOT NULL,
    `grader_staff_id` BIGINT NOT NULL,
    `score` DECIMAL(5, 2) NOT NULL,

    PRIMARY KEY (`score_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `score_appeal` (
    `appeal_id` BIGINT NOT NULL AUTO_INCREMENT,
    `score_id` BIGINT NOT NULL,
    `old_score` DECIMAL(5, 2) NOT NULL,
    `new_score` DECIMAL(5, 2) NULL,
    `status` VARCHAR(30) NOT NULL,

    PRIMARY KEY (`appeal_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admission_benchmark` (
    `benchmark_id` BIGINT NOT NULL AUTO_INCREMENT,
    `batch_major_id` BIGINT NOT NULL,
    `decided_by_staff_id` BIGINT NOT NULL,
    `benchmark_value` DECIMAL(5, 2) NOT NULL,

    UNIQUE INDEX `admission_benchmark_batch_major_id_key`(`batch_major_id`),
    PRIMARY KEY (`benchmark_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_ranking` (
    `ranking_id` BIGINT NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT NOT NULL,
    `total_score` DECIMAL(5, 2) NOT NULL,
    `rank_order` INTEGER NOT NULL,

    UNIQUE INDEX `application_ranking_application_id_key`(`application_id`),
    PRIMARY KEY (`ranking_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `waitlist` (
    `waitlist_id` BIGINT NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT NOT NULL,
    `status` VARCHAR(30) NOT NULL,

    UNIQUE INDEX `waitlist_application_id_key`(`application_id`),
    PRIMARY KEY (`waitlist_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admission_result` (
    `result_id` BIGINT NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT NOT NULL,
    `approved_by_staff_id` BIGINT NULL,
    `approved_by_leader_id` BIGINT NULL,
    `result` VARCHAR(30) NOT NULL,
    `published_at` DATETIME(3) NULL,

    UNIQUE INDEX `admission_result_application_id_key`(`application_id`),
    PRIMARY KEY (`result_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admission_decision` (
    `decision_id` BIGINT NOT NULL AUTO_INCREMENT,
    `batch_id` BIGINT NOT NULL,
    `signed_by_staff_id` BIGINT NOT NULL,
    `decision_no` VARCHAR(50) NOT NULL,
    `status` VARCHAR(30) NOT NULL,

    UNIQUE INDEX `admission_decision_decision_no_key`(`decision_no`),
    PRIMARY KEY (`decision_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `decision_application` (
    `detail_id` BIGINT NOT NULL AUTO_INCREMENT,
    `decision_id` BIGINT NOT NULL,
    `application_id` BIGINT NOT NULL,

    PRIMARY KEY (`detail_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enrollment_confirmation` (
    `confirmation_id` BIGINT NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT NOT NULL,
    `status` VARCHAR(30) NOT NULL,

    UNIQUE INDEX `enrollment_confirmation_application_id_key`(`application_id`),
    PRIMARY KEY (`confirmation_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `original_document_submission` (
    `submission_id` BIGINT NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT NOT NULL,
    `verified_by_staff_id` BIGINT NULL,
    `status` VARCHAR(30) NOT NULL,

    UNIQUE INDEX `original_document_submission_application_id_key`(`application_id`),
    PRIMARY KEY (`submission_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enrollment_completion` (
    `completion_id` BIGINT NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT NOT NULL,
    `completed_by_staff_id` BIGINT NOT NULL,
    `transfer_ref` VARCHAR(100) NOT NULL,

    UNIQUE INDEX `enrollment_completion_application_id_key`(`application_id`),
    PRIMARY KEY (`completion_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcement` (
    `announcement_id` BIGINT NOT NULL AUTO_INCREMENT,
    `batch_id` BIGINT NOT NULL,
    `created_by_staff_id` BIGINT NOT NULL,
    `status` VARCHAR(30) NOT NULL,

    PRIMARY KEY (`announcement_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification` (
    `notification_id` BIGINT NOT NULL AUTO_INCREMENT,
    `recipient_type` VARCHAR(20) NOT NULL,
    `recipient_id` BIGINT NOT NULL,
    `channel` VARCHAR(20) NOT NULL,
    `status` VARCHAR(30) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`notification_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_log` (
    `log_id` BIGINT NOT NULL AUTO_INCREMENT,
    `actor_type` VARCHAR(20) NOT NULL,
    `actor_id` BIGINT NULL,
    `action` VARCHAR(100) NOT NULL,
    `entity_table` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_audit_created_at`(`created_at`),
    PRIMARY KEY (`log_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `admission_batch_major` ADD CONSTRAINT `admission_batch_major_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `admission_batch`(`batch_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admission_batch_major` ADD CONSTRAINT `admission_batch_major_major_id_fkey` FOREIGN KEY (`major_id`) REFERENCES `admission_major`(`major_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admission_condition` ADD CONSTRAINT `admission_condition_batch_major_id_fkey` FOREIGN KEY (`batch_major_id`) REFERENCES `admission_batch_major`(`batch_major_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admission_committee` ADD CONSTRAINT `admission_committee_batch_major_id_fkey` FOREIGN KEY (`batch_major_id`) REFERENCES `admission_batch_major`(`batch_major_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `committee_member` ADD CONSTRAINT `committee_member_committee_id_fkey` FOREIGN KEY (`committee_id`) REFERENCES `admission_committee`(`committee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_subject` ADD CONSTRAINT `exam_subject_batch_major_id_fkey` FOREIGN KEY (`batch_major_id`) REFERENCES `admission_batch_major`(`batch_major_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_role` ADD CONSTRAINT `staff_role_staff_account_id_fkey` FOREIGN KEY (`staff_account_id`) REFERENCES `staff_account`(`staff_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_role` ADD CONSTRAINT `staff_role_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `role`(`role_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `otp_verification` ADD CONSTRAINT `otp_verification_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `candidate_account`(`account_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `candidate` ADD CONSTRAINT `candidate_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `candidate_account`(`account_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application` ADD CONSTRAINT `application_candidate_id_fkey` FOREIGN KEY (`candidate_id`) REFERENCES `candidate`(`candidate_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application` ADD CONSTRAINT `application_batch_major_id_fkey` FOREIGN KEY (`batch_major_id`) REFERENCES `admission_batch_major`(`batch_major_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_document` ADD CONSTRAINT `application_document_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`application_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `research_proposal` ADD CONSTRAINT `research_proposal_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`application_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `research_proposal` ADD CONSTRAINT `research_proposal_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `application_document`(`document_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `research_proposal` ADD CONSTRAINT `research_proposal_preferred_lecturer_id_fkey` FOREIGN KEY (`preferred_lecturer_id`) REFERENCES `lecturer`(`lecturer_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supervisor_request` ADD CONSTRAINT `supervisor_request_proposal_id_fkey` FOREIGN KEY (`proposal_id`) REFERENCES `research_proposal`(`proposal_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supervisor_request` ADD CONSTRAINT `supervisor_request_lecturer_id_fkey` FOREIGN KEY (`lecturer_id`) REFERENCES `lecturer`(`lecturer_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_payment` ADD CONSTRAINT `application_payment_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`application_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_review` ADD CONSTRAINT `application_review_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`application_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_review` ADD CONSTRAINT `application_review_reviewer_staff_id_fkey` FOREIGN KEY (`reviewer_staff_id`) REFERENCES `staff_account`(`staff_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplement_request` ADD CONSTRAINT `supplement_request_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`application_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplement_request` ADD CONSTRAINT `supplement_request_requested_by_staff_id_fkey` FOREIGN KEY (`requested_by_staff_id`) REFERENCES `staff_account`(`staff_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_status_history` ADD CONSTRAINT `application_status_history_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`application_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_status_history` ADD CONSTRAINT `application_status_history_changed_by_staff_id_fkey` FOREIGN KEY (`changed_by_staff_id`) REFERENCES `staff_account`(`staff_account_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_room` ADD CONSTRAINT `exam_room_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `admission_batch`(`batch_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_assignment` ADD CONSTRAINT `exam_assignment_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`application_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_assignment` ADD CONSTRAINT `exam_assignment_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `exam_room`(`room_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview_schedule` ADD CONSTRAINT `interview_schedule_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`application_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interview_schedule` ADD CONSTRAINT `interview_schedule_committee_id_fkey` FOREIGN KEY (`committee_id`) REFERENCES `admission_committee`(`committee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_score` ADD CONSTRAINT `exam_score_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`application_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_score` ADD CONSTRAINT `exam_score_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `exam_subject`(`subject_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_score` ADD CONSTRAINT `exam_score_grader_staff_id_fkey` FOREIGN KEY (`grader_staff_id`) REFERENCES `staff_account`(`staff_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `score_appeal` ADD CONSTRAINT `score_appeal_score_id_fkey` FOREIGN KEY (`score_id`) REFERENCES `exam_score`(`score_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admission_benchmark` ADD CONSTRAINT `admission_benchmark_batch_major_id_fkey` FOREIGN KEY (`batch_major_id`) REFERENCES `admission_batch_major`(`batch_major_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admission_benchmark` ADD CONSTRAINT `admission_benchmark_decided_by_staff_id_fkey` FOREIGN KEY (`decided_by_staff_id`) REFERENCES `staff_account`(`staff_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_ranking` ADD CONSTRAINT `application_ranking_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`application_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `waitlist` ADD CONSTRAINT `waitlist_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`application_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admission_result` ADD CONSTRAINT `admission_result_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`application_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admission_result` ADD CONSTRAINT `admission_result_approved_by_staff_id_fkey` FOREIGN KEY (`approved_by_staff_id`) REFERENCES `staff_account`(`staff_account_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admission_result` ADD CONSTRAINT `admission_result_approved_by_leader_id_fkey` FOREIGN KEY (`approved_by_leader_id`) REFERENCES `staff_account`(`staff_account_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admission_decision` ADD CONSTRAINT `admission_decision_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `admission_batch`(`batch_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admission_decision` ADD CONSTRAINT `admission_decision_signed_by_staff_id_fkey` FOREIGN KEY (`signed_by_staff_id`) REFERENCES `staff_account`(`staff_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `decision_application` ADD CONSTRAINT `decision_application_decision_id_fkey` FOREIGN KEY (`decision_id`) REFERENCES `admission_decision`(`decision_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `decision_application` ADD CONSTRAINT `decision_application_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`application_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_confirmation` ADD CONSTRAINT `enrollment_confirmation_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`application_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `original_document_submission` ADD CONSTRAINT `original_document_submission_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`application_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `original_document_submission` ADD CONSTRAINT `original_document_submission_verified_by_staff_id_fkey` FOREIGN KEY (`verified_by_staff_id`) REFERENCES `staff_account`(`staff_account_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_completion` ADD CONSTRAINT `enrollment_completion_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `application`(`application_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_completion` ADD CONSTRAINT `enrollment_completion_completed_by_staff_id_fkey` FOREIGN KEY (`completed_by_staff_id`) REFERENCES `staff_account`(`staff_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcement` ADD CONSTRAINT `announcement_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `admission_batch`(`batch_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcement` ADD CONSTRAINT `announcement_created_by_staff_id_fkey` FOREIGN KEY (`created_by_staff_id`) REFERENCES `staff_account`(`staff_account_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
