# Thiết kế Chi tiết Backend — Phân hệ Quản lý Tuyển sinh Sau đại học (Giai đoạn 3)

| Mục | Nội dung |
|---|---|
| Nhóm thực hiện | Backend Developers — Lê Phước Hào, Phạm Lư Gia Quân, Phan Minh Trí |
| Nhiệm vụ GĐ3 (theo bảng phân công) | (1) Thiết kế chi tiết từng module; (2) Thiết kế Class Diagram & Sequence Diagram; (3) Xác định thuật toán & Business Logic |
| Công nghệ | NestJS (Clean Architecture / Modular Monolith) + Prisma ORM + MySQL/MariaDB (`admission_db`, v3) |
| Nguồn dữ liệu tham chiếu | `admission_db_v3.sql`, `migration_v3_GD3.sql`, `ERD_PhanHe_TuyenSinh_GD3.md` (Lâm Hoài An — QA/Security & Data) |
| Đối chiếu liên nhóm | Team Lead (DDD tổng), Frontend (API contract, UI), DevOps (biến môi trường, Docker, logging), QA (test case, RBAC) |

> Tài liệu này là **đầu ra chi tiết của nhóm Backend cho GĐ3**, được thiết kế để khớp 100% với 40 bảng / 10 miền nghiệp vụ trong ERD v3 và áp dụng đúng các quyết định trong `migration_v3_GD3.sql`. Mọi tên bảng, khóa chính/ngoại dùng trong tài liệu lấy nguyên văn từ ERD để tránh lệch pha khi nhóm QA đối chiếu.

---

## 0. Mục tiêu & phạm vi

- Chốt **ranh giới module** (module boundary) trong kiến trúc Modular Monolith, mỗi module ánh xạ 1-1 hoặc N-1 với các miền nghiệp vụ trong ERD.
- Thiết kế **Class Diagram** (tầng Domain/Entity + Service) cho từng module — làm cơ sở để 3 backend dev code song song không giẫm chân nhau.
- Thiết kế **Sequence Diagram** cho các luồng nghiệp vụ lõi (đăng ký → nộp hồ sơ → thẩm định → thi/phỏng vấn → xét trúng tuyển → quyết định → nhập học).
- Xác định **thuật toán nghiệp vụ** cần cài đặt tường minh (tính điểm chuẩn, xếp hạng, danh sách dự bị, state machine trạng thái hồ sơ).
- Đề xuất **API contract rút gọn** để nhóm Frontend bám vào dựng UI, và **checklist đối chiếu liên nhóm** để nhóm không lệch nhau khi tích hợp.

---

## 1. Kiến trúc tổng thể & phân chia module

### 1.1 Nguyên tắc chia module

Áp dụng Modular Monolith: mỗi module là 1 thư mục NestJS độc lập (`module + controller + service + repository(Prisma) + dto`), giao tiếp module khác **chỉ qua service interface**, không truy cập trực tiếp Prisma model của module khác (tránh coupling khi tách microservice sau này).

10 miền nghiệp vụ trong ERD được gom thành **8 module code** (một số miền nhỏ gộp chung vì vòng đời nghiệp vụ liền mạch):

| # | Module (code) | Miền ERD tương ứng | Bảng chính |
|---|---|---|---|
| M1 | `auth-account` | Miền 2 + Miền 3 | staff_account, role, staff_role, candidate_account, otp_verification, candidate, system_config |
| M2 | `admission-config` | Miền 1 | admission_batch, admission_major, admission_batch_major, admission_condition, admission_committee, committee_member, exam_subject |
| M3 | `application` | Miền 4 | application, application_document, application_payment, lecturer, research_proposal, supervisor_request |
| M4 | `application-review` | Miền 5 | application_review, supplement_request, application_status_history |
| M5 | `exam` | Miền 6 | exam_room, exam_assignment, interview_schedule, exam_score, score_appeal |
| M6 | `admission-result` | Miền 7 | admission_benchmark, application_ranking, waitlist, admission_result |
| M7 | `decision-enrollment` | Miền 8 | admission_decision, decision_application, enrollment_confirmation, original_document_submission, enrollment_completion |
| M8 | `notification-audit` (cross-cutting, dùng chung) | Miền 9 + 10 | announcement, notification, audit_log |

### 1.2 Phân công 3 thành viên Backend (đề xuất, cần Team Lead chốt trong họp Sprint GĐ3)

Chia theo **vòng đời hồ sơ** để mỗi người làm chủ trọn 1 chuỗi nghiệp vụ, giảm phụ thuộc chéo lúc code:

| Thành viên | Module phụ trách | Lý do phân chia |
|---|---|---|
| **Lê Phước Hào** | M1 (auth-account) + M2 (admission-config) | Nền tảng: tài khoản, phân quyền, cấu hình đợt tuyển sinh — các module khác đều phụ thuộc vào đây, cần code trước tiên. |
| **Phạm Lư Gia Quân** | M3 (application) + M4 (application-review) | Luồng "nộp hồ sơ → thẩm định" là luồng nghiệp vụ dài và nhiều nghiệp vụ phức tạp nhất (đề cương NCS, GVHD, thanh toán). |
| **Phan Minh Trí** | M5 (exam) + M6 (admission-result) + M7 (decision-enrollment) | Luồng "thi/phỏng vấn → xét trúng tuyển → ra quyết định → nhập học" — nhiều thuật toán tính toán (điểm chuẩn, xếp hạng, dự bị). |
| Cả 3 | M8 (notification-audit) | Module dùng chung, viết thành shared service (`NotificationService`, `AuditLogService`) để 3 module còn lại gọi vào (interceptor/event) thay vì code riêng lẻ 3 lần. |

### 1.3 Sơ đồ phụ thuộc module (tầng cao)

```mermaid
graph LR
    M1[auth-account] --> M2[admission-config]
    M1 --> M3[application]
    M2 --> M3
    M3 --> M4[application-review]
    M2 --> M5[exam]
    M3 --> M5
    M4 --> M5
    M5 --> M6[admission-result]
    M6 --> M7[decision-enrollment]
    M3 --> M7
    M3 -.event.-> M8[notification-audit]
    M4 -.event.-> M8
    M5 -.event.-> M8
    M6 -.event.-> M8
    M7 -.event.-> M8
```

Mũi tên nét liền = gọi service trực tiếp (đồng bộ). Mũi tên nét đứt vào M8 = bắn **domain event** (`ApplicationStatusChangedEvent`, `ResultPublishedEvent`, ...) qua EventEmitter nội bộ của NestJS, để M8 tự log/audit/notify mà không làm nghẽn luồng nghiệp vụ chính.

---

## 2. Chi tiết module & Class Diagram

> Quy ước: các Class Diagram dưới đây thể hiện tầng **Domain Entity** (map 1-1 với bảng ERD) + tầng **Service** (business logic). Repository/Prisma layer không vẽ lại vì trùng ERD.

### 2.1 Module M1 — `auth-account` (Lê Phước Hào)

```mermaid
classDiagram
    class StaffAccount {
        +bigint staffAccountId
        +string staffCode
        +string email
        +string passwordHash?  %% nullable theo migration v3
        +string status
        +login(credential)
        +loginWithGoogle(googleToken)
    }
    class Role {
        +bigint roleId
        +string roleCode
        +string roleName
    }
    class StaffRole {
        +bigint staffRoleId
        +bigint staffAccountId
        +bigint roleId
    }
    class CandidateAccount {
        +bigint accountId
        +string username
        +string email
        +string phoneNumber
        +string passwordHash?
        +string status
        +register()
        +verifyOtp(otp)
    }
    class OtpVerification {
        +bigint otpId
        +bigint accountId
        +string purpose
        +datetime expiresAt
        +isExpired() bool
    }
    class Candidate {
        +bigint candidateId
        +bigint accountId
        +string fullName
        +string idNumber
        +updateProfile()
    }
    class AuthService {
        +issueJwt(account)
        +hashPassword(plain)
        +verifyGoogleIdToken(token)
    }
    class RbacGuard {
        +canActivate(context) bool
        +checkPermission(roleCode, action)
    }

    StaffAccount "1" --> "*" StaffRole
    Role "1" --> "*" StaffRole
    CandidateAccount "1" --> "0..1" Candidate
    CandidateAccount "1" --> "*" OtpVerification
    AuthService ..> StaffAccount
    AuthService ..> CandidateAccount
    RbacGuard ..> StaffRole
```

**Business rule / thuật toán chính:**
- **Đăng nhập kép (dual login):** `passwordHash` là `nullable` (đúng migration v3 — hàng 1). Logic: nếu tài khoản có `passwordHash = NULL` → chỉ cho phép `loginWithGoogle()`, chặn `login()` bằng mật khẩu và trả lỗi rõ ràng `ERR_PASSWORD_LOGIN_DISABLED` thay vì lỗi sai mật khẩu chung chung.
- **RBAC không có bảng `permission` chi tiết** (migration v3 — hàng 4, cố tình không thêm bảng): quyền hạn chi tiết theo `role_code` được khai báo **bằng code** dưới dạng ma trận hằng số (`PERMISSION_MATRIX: Record<roleCode, string[]>`) và enforce bằng `RbacGuard` (decorator `@RequirePermission('application:review')`). Nhóm QA sẽ kiểm thử dựa trên ma trận này, không dựa trên schema DB.
- **OTP**: mỗi purpose (`REGISTER`, `RESET_PASSWORD`) chỉ 1 OTP còn hiệu lực tại 1 thời điểm; tạo OTP mới phải vô hiệu OTP cũ cùng `accountId + purpose`.

### 2.2 Module M2 — `admission-config` (Lê Phước Hào)

```mermaid
classDiagram
    class AdmissionBatch {
        +bigint batchId
        +string batchCode
        +string degreeLevel
        +string status
        +datetime deletedAt
        +openBatch()
        +closeBatch()
    }
    class AdmissionMajor {
        +bigint majorId
        +string majorCode
        +string degreeLevel
        +string status
    }
    class AdmissionBatchMajor {
        +bigint batchMajorId
        +bigint batchId
        +bigint majorId
        +int quota
        +decimal benchmarkScore
        +string status
        +checkQuotaAvailable() bool
    }
    class AdmissionCondition {
        +bigint conditionId
        +bigint batchMajorId
        +string conditionCode
        +decimal minGpa
    }
    class AdmissionCommittee {
        +bigint committeeId
        +bigint batchMajorId
        +string committeeName
        +string status
    }
    class ExamSubject {
        +bigint subjectId
        +bigint batchMajorId
        +string examFormat
        +decimal weight
    }
    class AdmissionConfigService {
        +createBatchMajor(dto)
        +validateWeightSum(subjects) bool
    }

    AdmissionBatch "1" --> "*" AdmissionBatchMajor
    AdmissionMajor "1" --> "*" AdmissionBatchMajor
    AdmissionBatchMajor "1" --> "*" AdmissionCondition
    AdmissionBatchMajor "1" --> "*" AdmissionCommittee
    AdmissionBatchMajor "1" --> "*" ExamSubject
    AdmissionConfigService ..> AdmissionBatchMajor
```

**Business rule:**
- `validateWeightSum`: tổng `weight` của các `exam_subject` thuộc cùng `batch_major_id` phải = 1.0 (100%) trước khi cho phép chuyển `admission_batch.status` sang `OPEN`.
- `admission_batch` dùng **soft delete** (`deleted_at`) — mọi query list phải filter `deleted_at IS NULL`; đây là điểm QA cần test kỹ vì dễ sót khi viết Prisma query.

### 2.3 Module M3 — `application` (Phạm Lư Gia Quân)

```mermaid
classDiagram
    class Application {
        +bigint applicationId
        +string applicationCode
        +bigint candidateId
        +bigint batchMajorId
        +string reviewStatus
        +string admissionStatus
        +boolean isCancelled
        +submit()
        +cancel()
    }
    class ApplicationDocument {
        +bigint documentId
        +bigint applicationId
        +string documentType
        +string fileHash
        +int fileSizeKb
        +validateChecksum() bool
    }
    class ResearchProposal {
        +bigint proposalId
        +bigint applicationId
        +bigint documentId
        +bigint preferredLecturerId
        +string researchTopic
    }
    class Lecturer {
        +bigint lecturerId
        +string lecturerCode
        +string email
        +string status
    }
    class SupervisorRequest {
        +bigint requestId
        +bigint proposalId
        +bigint lecturerId
        +string status
        +accept()
        +reject()
    }
    class ApplicationPayment {
        +bigint paymentId
        +bigint applicationId
        +decimal amount
        +string paymentMethod
        +string transactionCode?
        +string gatewayStatus
        +reconcile(gatewayCallback)
    }
    class ApplicationService {
        +createApplication(dto)
        +attachDocument(applicationId, file)
        +generateApplicationCode() string
    }

    Application "1" --> "*" ApplicationDocument
    Application "1" --> "0..1" ResearchProposal
    ApplicationDocument "1" --> "0..*" ResearchProposal : la_file_de_cuong
    Lecturer "1" --> "*" ResearchProposal
    ResearchProposal "1" --> "*" SupervisorRequest
    Lecturer "1" --> "*" SupervisorRequest
    Application "1" --> "*" ApplicationPayment
    ApplicationService ..> Application
```

**Business rule / thuật toán chính:**
- **Sinh `application_code`**: format `<batch_code>-<major_code>-<sequence 5 số>`, sequence tăng dần theo `batch_major_id`, dùng transaction + `SELECT ... FOR UPDATE` để tránh trùng mã khi nhiều thí sinh nộp cùng lúc.
- **`transaction_code` UNIQUE cho phép nhiều NULL** (migration v3 — hàng 6): đây là hành vi chuẩn của MySQL/MariaDB (UNIQUE index bỏ qua NULL). Backend **không cần xử lý gì thêm ở code**, chỉ cần đảm bảo service không tự ý gán chuỗi rỗng `''` thay cho `NULL` (rỗng sẽ vi phạm UNIQUE ngay ở bản ghi thứ 2). Đây là điểm phải note rõ cho QA để không báo nhầm là bug.
- **Validate hồ sơ NCS**: `research_proposal` chỉ được tạo khi `admission_batch_major.degree_level = 'THAC_SI_NCS'` (hoặc tương đương) — kiểm tra chéo với M2.
- **`attachDocument`**: kiểm tra `file_hash` (SHA-256) trùng với minh chứng đã nộp trước đó trong cùng `application_id` → cảnh báo nộp trùng file, không chặn cứng (thí sinh có thể cố ý nộp lại).

### 2.4 Module M4 — `application-review` (Phạm Lư Gia Quân)

```mermaid
classDiagram
    class ApplicationReview {
        +bigint reviewId
        +bigint applicationId
        +bigint reviewerStaffId
        +string reviewResult
        +approve()
        +reject(reason)
    }
    class SupplementRequest {
        +bigint requestId
        +bigint applicationId
        +bigint requestedByStaffId
        +string status
        +resolve()
    }
    class ApplicationStatusHistory {
        +bigint historyId
        +bigint applicationId
        +bigint changedByStaffId
        +string changedByType
        +recordTransition(from, to)
    }
    class ReviewService {
        +reviewApplication(applicationId, result)
        +requestSupplement(applicationId, reason)
    }

    ApplicationReview "many" --> "1" ReviewService
    SupplementRequest "many" --> "1" ReviewService
    ReviewService ..> ApplicationStatusHistory : ghi log mỗi lần đổi trạng thái
```

**Business rule — State Machine `application.review_status`** (thuật toán trọng tâm của module):

```mermaid
stateDiagram-v2
    [*] --> DA_NOP
    DA_NOP --> DANG_THAM_DINH: staff bắt đầu review
    DANG_THAM_DINH --> YEU_CAU_BO_SUNG: reviewer request supplement
    YEU_CAU_BO_SUNG --> DANG_THAM_DINH: candidate bổ sung xong
    DANG_THAM_DINH --> HOP_LE: reviewer approve
    DANG_THAM_DINH --> TU_CHOI: reviewer reject
    HOP_LE --> [*]
    TU_CHOI --> [*]
    YEU_CAU_BO_SUNG --> TU_CHOI: quá hạn bổ sung
```

Mọi transition **bắt buộc** đi qua `ReviewService` (không cho phép update trực tiếp field `review_status` ở tầng khác) và **luôn ghi 1 dòng vào `application_status_history`** — đây là điểm liên kết trực tiếp với module Audit (M8) để đảm bảo truy vết đầy đủ, đáp ứng yêu cầu của QA/Security.

### 2.5 Module M5 — `exam` (Phan Minh Trí)

```mermaid
classDiagram
    class ExamRoom {
        +bigint roomId
        +bigint batchId
        +string roomCode
        +int capacity
    }
    class ExamAssignment {
        +bigint assignmentId
        +bigint applicationId
        +bigint roomId
        +string sbdCode
        +assignRoom()
    }
    class InterviewSchedule {
        +bigint scheduleId
        +bigint applicationId
        +bigint committeeId
        +string status
    }
    class ExamScore {
        +bigint scoreId
        +bigint applicationId
        +bigint subjectId
        +bigint graderStaffId
        +decimal score
        +enterScore(value)
    }
    class ScoreAppeal {
        +bigint appealId
        +bigint scoreId
        +decimal oldScore
        +decimal newScore
        +string status
        +resolveAppeal(newScore)
    }
    class ExamService {
        +generateSbdCode(batchId) string
        +autoAssignRoom(applicationIds, rooms)
        +calculateTotalScore(applicationId) decimal
    }

    ExamRoom "1" --> "*" ExamAssignment
    ExamAssignment "1" --> "1" ExamService
    InterviewSchedule --> ExamService
    ExamScore "1" --> "0..*" ScoreAppeal
    ExamService ..> ExamScore
```

**Thuật toán chính:**
- **`autoAssignRoom`**: bin-packing đơn giản — sắp thí sinh vào phòng theo thứ tự `application_code`, mỗi phòng lấp đầy đến `capacity` rồi mới sang phòng kế; đảm bảo *idempotent* (chạy lại không tạo trùng `exam_assignment`).
- **`calculateTotalScore`**: tổng có trọng số = `Σ (exam_score.score × exam_subject.weight)` theo đúng `weight` đã validate ở M2 (tổng = 1.0).
- **Phúc khảo (`score_appeal`)**: khi `resolveAppeal` cập nhật `new_score`, phải bắn event để M6 (admission-result) tính lại `application_ranking` liên quan — **không** cho phép sửa trực tiếp `exam_score.score` sau khi đã có bản ghi phúc khảo (giữ lịch sử `old_score`/`new_score`).

### 2.6 Module M6 — `admission-result` (Phan Minh Trí)

```mermaid
classDiagram
    class AdmissionBenchmark {
        +bigint benchmarkId
        +bigint batchMajorId
        +bigint decidedByStaffId
        +decimal benchmarkValue
        +decide(value)
    }
    class ApplicationRanking {
        +bigint rankingId
        +bigint applicationId
        +decimal totalScore
        +int rankOrder
    }
    class Waitlist {
        +bigint waitlistId
        +bigint applicationId
        +string status
        +promote()
    }
    class AdmissionResult {
        +bigint resultId
        +bigint applicationId
        +bigint approvedByStaffId
        +bigint approvedByLeaderId
        +string result
        +datetime publishedAt
        +publish()
    }
    class RankingService {
        +buildRanking(batchMajorId)
        +applyBenchmark(batchMajorId)
        +promoteFromWaitlist(quotaGap)
    }

    AdmissionBenchmark "1" --> "1" RankingService
    RankingService ..> ApplicationRanking : tạo/sắp xếp
    RankingService ..> Waitlist : đưa vào dự bị
    RankingService ..> AdmissionResult : công bố kết quả
```

**Thuật toán trọng tâm (đây là phần nghiệp vụ phức tạp nhất, cần review kỹ với Team Lead):**

1. `buildRanking(batchMajorId)`: lấy toàn bộ `application` hợp lệ (đã thi/phỏng vấn xong) thuộc `batch_major_id`, sắp xếp theo `totalScore DESC`, gán `rank_order` tuần tự; **xử lý đồng điểm (tie-break)** theo tiêu chí phụ đã thống nhất với Team Lead (ví dụ: ưu tiên điểm chuyên môn cao hơn → thời điểm nộp hồ sơ sớm hơn).
2. `applyBenchmark(batchMajorId)`: so `total_score` với `admission_benchmark.benchmark_value`:
   - `total_score ≥ benchmark_value` **và** còn trong `quota` (theo `rank_order`) → `admission_result.result = 'TRUNG_TUYEN'`.
   - `total_score ≥ benchmark_value` nhưng **vượt quota** → đưa vào `waitlist` (`status = 'CHO_XET'`).
   - `total_score < benchmark_value` → `admission_result.result = 'KHONG_TRUNG_TUYEN'`.
3. `promoteFromWaitlist(quotaGap)`: khi có thí sinh trúng tuyển hủy nhập học (`enrollment_confirmation` bị hủy), tính `quotaGap` rồi lấy đúng số lượng thí sinh đầu danh sách `waitlist` (theo `rank_order`) để `promote()` → phát sinh `admission_result` mới. Toàn bộ thao tác nằm trong 1 transaction để tránh promote dư quota khi 2 request chạy đồng thời.
4. Toàn bộ 3 hàm trên chỉ được gọi bởi **staff có role `HOI_DONG_TUYEN_SINH` hoặc `LANH_DAO`**, và `publish()` bắt buộc có đủ 2 chữ ký `approved_by_staff_id` + `approved_by_leader_id` trước khi set `published_at` — đúng quy trình xét duyệt 2 cấp trong ERD.

### 2.7 Module M7 — `decision-enrollment` (Phan Minh Trí)

```mermaid
classDiagram
    class AdmissionDecision {
        +bigint decisionId
        +bigint batchId
        +bigint signedByStaffId
        +string decisionNo
        +string status
        +issue()
    }
    class DecisionApplication {
        +bigint detailId
        +bigint decisionId
        +bigint applicationId
    }
    class EnrollmentConfirmation {
        +bigint confirmationId
        +bigint applicationId
        +string status
        +confirm()
        +withdraw()
    }
    class OriginalDocumentSubmission {
        +bigint submissionId
        +bigint applicationId
        +bigint verifiedByStaffId
        +string status
        +verify()
    }
    class EnrollmentCompletion {
        +bigint completionId
        +bigint applicationId
        +bigint completedByStaffId
        +string transferRef
        +complete()
    }
    class DecisionService {
        +issueDecision(batchId, applicationIds)
        +finalizeEnrollment(applicationId)
    }

    AdmissionDecision "1" --> "*" DecisionApplication
    DecisionApplication "many" --> "1" DecisionService
    DecisionService ..> EnrollmentConfirmation
    DecisionService ..> OriginalDocumentSubmission
    DecisionService ..> EnrollmentCompletion
```

**Business rule:**
- `issueDecision`: chỉ nhận `application` có `admission_result.result = 'TRUNG_TUYEN'` **và** chưa thuộc `decision_application` nào khác (tránh 1 hồ sơ nằm trong 2 quyết định).
- `withdraw()` (thí sinh hủy nhập học sau khi đã confirm) **phải** bắn event `EnrollmentWithdrawnEvent` để M6 chạy `promoteFromWaitlist` — đây là điểm tích hợp quan trọng giữa M6 và M7, cần 2 bạn Trí tự khớp trong cùng module không phát sinh vấn đề liên module.
- `finalizeEnrollment`: chỉ chạy sau khi `original_document_submission.status = 'DA_XAC_MINH'`, sinh `transfer_ref` để bàn giao dữ liệu sinh viên sang hệ thống đào tạo (ngoài phạm vi đồ án, chỉ cần sinh mã tham chiếu).

### 2.8 Module M8 — `notification-audit` (dùng chung, 3 dev cùng review)

```mermaid
classDiagram
    class Announcement {
        +bigint announcementId
        +bigint batchId
        +bigint createdByStaffId
        +string status
        +publish()
    }
    class Notification {
        +bigint notificationId
        +string recipientType
        +bigint recipientId
        +string channel
        +string status
        +send()
    }
    class AuditLog {
        +bigint logId
        +string actorType
        +bigint actorId
        +string action
        +string entityTable
    }
    class NotificationService {
        +notify(recipientType, recipientId, template, data)
    }
    class AuditLogService {
        +record(actorType, actorId, action, entityTable, entityId)
    }

    NotificationService ..> Notification : tạo bản ghi + đẩy queue
    AuditLogService ..> AuditLog
    Announcement ..> NotificationService : sinh notification hàng loạt
```

**Business rule (giải quyết đúng migration v3 — hàng 2, polymorphic FK):**
- `notification.recipient_id` và `audit_log.actor_id` **không có FK vật lý** trong DB (thiết kế polymorphic có chủ đích). Toàn vẹn dữ liệu được đảm bảo **ở tầng ứng dụng**:
  - `NotificationService.notify()` bắt buộc validate `recipientType ∈ {'CANDIDATE','STAFF'}` rồi tự query đúng bảng (`candidate_account` hoặc `staff_account`) để xác nhận `recipientId` tồn tại **trước khi** insert — dùng **Prisma middleware** (`$use`) chặn ở tầng client, đúng như comment trong migration.
  - `AuditLogService.record()` áp dụng cùng cơ chế cho `actor_type ∈ {'CANDIDATE','STAFF','SYSTEM'}`.
- `idx_audit_created_at` (migration v3 — hàng 5) đã được tạo sẵn ở DB → Backend cần đảm bảo mọi query lấy log theo khoảng thời gian **dùng đúng cột `created_at`** trong `WHERE`/`ORDER BY` để tận dụng index này (tránh full scan khi audit log phình to).

---

## 3. Sequence Diagram — các luồng nghiệp vụ lõi

### 3.1 Luồng nộp hồ sơ (Candidate nộp hồ sơ + minh chứng)

```mermaid
sequenceDiagram
    actor TS as Thí sinh
    participant FE as Frontend
    participant M1 as auth-account
    participant M3 as application
    participant M8 as notification-audit
    participant DB as MySQL

    TS->>FE: Đăng nhập / đăng ký
    FE->>M1: POST /auth/login
    M1->>DB: Xác thực credential
    M1-->>FE: JWT
    FE->>M3: POST /applications (batchMajorId, hồ sơ)
    M3->>M3: generateApplicationCode()
    M3->>DB: INSERT application
    M3->>DB: INSERT application_document (nhiều file)
    M3-->>M8: emit ApplicationSubmittedEvent
    M8->>DB: INSERT audit_log
    M8->>DB: INSERT notification (xác nhận đã nộp)
    M3-->>FE: 201 Created + applicationCode
```

### 3.2 Luồng thẩm định hồ sơ (Staff review)

```mermaid
sequenceDiagram
    actor CB as Cán bộ tuyển sinh
    participant FE as Frontend
    participant M1 as auth-account (RbacGuard)
    participant M4 as application-review
    participant M8 as notification-audit
    participant DB as MySQL

    CB->>FE: Mở danh sách hồ sơ chờ duyệt
    FE->>M4: GET /applications?status=DA_NOP
    M4->>M1: checkPermission('application:review')
    M1-->>M4: OK
    M4->>DB: SELECT application
    M4-->>FE: Danh sách hồ sơ
    CB->>FE: Duyệt hợp lệ / Yêu cầu bổ sung
    FE->>M4: PATCH /applications/{id}/review
    M4->>DB: UPDATE application.review_status
    M4->>DB: INSERT application_status_history
    M4-->>M8: emit ApplicationStatusChangedEvent
    M8->>DB: INSERT audit_log + notification
    M4-->>FE: 200 OK
```

### 3.3 Luồng chấm điểm & phúc khảo

```mermaid
sequenceDiagram
    actor GK as Giám khảo
    participant M5 as exam
    participant M6 as admission-result
    participant DB as MySQL

    GK->>M5: POST /exam-scores {applicationId, subjectId, score}
    M5->>DB: INSERT exam_score
    Note over GK,M5: Sau công bố điểm, thí sinh khiếu nại
    GK->>M5: POST /score-appeals/{scoreId}/resolve {newScore}
    M5->>DB: UPDATE exam_score (giữ old_score/new_score trong score_appeal)
    M5-->>M6: emit ScoreChangedEvent(applicationId)
    M6->>M6: buildRanking(batchMajorId) [tính lại thứ hạng]
    M6->>DB: UPDATE application_ranking
```

### 3.4 Luồng xét trúng tuyển & công bố kết quả

```mermaid
sequenceDiagram
    actor HD as Hội đồng tuyển sinh
    actor LD as Lãnh đạo (duyệt cấp 2)
    participant M6 as admission-result
    participant M8 as notification-audit
    participant DB as MySQL

    HD->>M6: POST /benchmarks {batchMajorId, value}
    M6->>DB: INSERT admission_benchmark
    HD->>M6: POST /rankings/build {batchMajorId}
    M6->>M6: buildRanking() + applyBenchmark()
    M6->>DB: INSERT application_ranking, waitlist, admission_result(draft)
    HD->>M6: PATCH /admission-results/{id}/approve (cấp 1)
    LD->>M6: PATCH /admission-results/{id}/approve (cấp 2)
    M6->>M6: publish() [chỉ chạy khi đủ 2 chữ ký]
    M6->>DB: UPDATE admission_result SET published_at
    M6-->>M8: emit ResultPublishedEvent
    M8->>DB: INSERT notification (gửi hàng loạt thí sinh)
```

### 3.5 Luồng hủy nhập học → thăng dự bị (waitlist promotion)

```mermaid
sequenceDiagram
    actor TS as Thí sinh trúng tuyển
    participant M7 as decision-enrollment
    participant M6 as admission-result
    participant M8 as notification-audit
    participant DB as MySQL

    TS->>M7: POST /enrollment/{applicationId}/withdraw
    M7->>DB: UPDATE enrollment_confirmation SET status='HUY'
    M7-->>M6: emit EnrollmentWithdrawnEvent(batchMajorId)
    M6->>M6: promoteFromWaitlist(quotaGap=1)
    M6->>DB: UPDATE waitlist SET status='DA_THANG'
    M6->>DB: INSERT admission_result (thí sinh kế tiếp)
    M6-->>M8: emit ResultPublishedEvent
    M8->>DB: INSERT notification (báo tin vui cho thí sinh dự bị)
```

---

## 4. Đối chiếu liên nhóm (Cross-team Alignment Matrix)

Đây là phần **bắt buộc rà lại trong buổi họp GĐ3** để tài liệu Backend khớp với đầu ra các nhóm khác, tránh mỗi nhóm hiểu một kiểu:

| Nhóm | Đầu ra của họ mà Backend phụ thuộc | Đầu ra của Backend mà họ phụ thuộc | Điểm cần đối chiếu |
|---|---|---|---|
| **Team Lead** (Thái Hoàng Minh) | DDD tổng hợp GĐ3 | Nội dung mục 1–4 của tài liệu này để gộp vào DDD | Tên module, mã nghiệp vụ (`TRUNG_TUYEN`, `CHO_XET`...) phải **thống nhất thuật ngữ** trong toàn bộ DDD, không để mỗi phần dùng 1 tên khác nhau. |
| **QA / Security & Data** (Lâm Hoài An) | ERD v3, `migration_v3_GD3.sql` | Danh sách API + validation rule (mục 2, 5) để viết test case | Đối chiếu **6 hàng migration v3** — mục 2.1, 2.2, 2.3, 2.8 của tài liệu này đã xử lý đủ cả 6 hàng chưa (đã tick ở mục 5.3). RBAC không có bảng permission → QA test theo ma trận code, không test theo schema. |
| **Frontend / Mobile** (Châu Minh Tuệ, Nguyễn Phúc Khang) | Wireframe, Design System | API contract rút gọn (mục 6), state machine (mục 2.4) để render đúng trạng thái/nút bấm | Tên trạng thái hiển thị trên UI (`Đã nộp`, `Đang thẩm định`...) phải map đúng 1-1 với `enum` backend trả về, tránh FE tự đặt tên khác. |
| **DevOps / Cloud** (Võ Trường Hải, Nguyễn Thành Luân) | Docker Compose, CI/CD, cấu hình logging/monitoring | Danh sách biến môi trường, endpoint `/health`, format log chuẩn | Backend cam kết expose `GET /health` (đã có healthcheck ở docker-compose theo PR #5) và log JSON có `traceId` để DevOps gắn vào hệ thống monitoring. Biến môi trường cần: `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `OTP_TTL_SECONDS`. |

---

## 5. Danh sách API chính (rút gọn cho Frontend bám vào)

| Method | Endpoint | Module | Mô tả |
|---|---|---|---|
| POST | `/auth/login` | M1 | Đăng nhập bằng mật khẩu (nếu có) |
| POST | `/auth/google` | M1 | Đăng nhập bằng Google |
| POST | `/candidates/register` | M1 | Đăng ký tài khoản thí sinh + gửi OTP |
| GET | `/admission-batches` | M2 | Danh sách đợt tuyển sinh đang mở |
| POST | `/applications` | M3 | Nộp hồ sơ mới |
| POST | `/applications/{id}/documents` | M3 | Đính kèm minh chứng |
| GET | `/applications/{id}` | M3/M4 | Xem chi tiết hồ sơ + trạng thái |
| PATCH | `/applications/{id}/review` | M4 | Cán bộ duyệt/yêu cầu bổ sung |
| POST | `/exam-assignments/auto-assign` | M5 | Xếp phòng thi tự động |
| POST | `/exam-scores` | M5 | Nhập điểm |
| POST | `/score-appeals/{scoreId}/resolve` | M5 | Xử lý phúc khảo |
| POST | `/rankings/build` | M6 | Tính xếp hạng theo điểm chuẩn |
| PATCH | `/admission-results/{id}/approve` | M6 | Duyệt kết quả (2 cấp) |
| POST | `/decisions` | M7 | Ban hành quyết định trúng tuyển |
| POST | `/enrollment/{id}/confirm` | M7 | Xác nhận nhập học |
| POST | `/enrollment/{id}/withdraw` | M7 | Hủy nhập học (kích hoạt thăng dự bị) |
| GET | `/health` | — | Healthcheck cho DevOps |

---

## 6. Checklist hoàn thành GĐ3 — nhóm Backend (Definition of Done)

- [ ] Class Diagram của cả 8 module đã review chéo giữa 3 thành viên (không chỉ tự vẽ module của mình).
- [ ] Sequence Diagram của 5 luồng lõi đã đối chiếu với Frontend để khớp state hiển thị UI.
- [ ] Đã xử lý/ghi chú đủ **6 hàng quyết định** trong `migration_v3_GD3.sql`:
  - Hàng 1 (password_hash nullable) → mục 2.1 ✅
  - Hàng 2 (polymorphic FK) → mục 2.8 ✅
  - Hàng 3 (sửa số trigger trong tài liệu, không phải code) → thông báo cho Team Lead cập nhật DDD, Backend không cần đổi code.
  - Hàng 4 (không thêm bảng permission) → mục 2.1 ✅
  - Hàng 5 (index audit_log) → mục 2.8 ✅
  - Hàng 6 (transaction_code UNIQUE cho phép nhiều NULL) → mục 2.3 ✅
- [ ] Danh sách API (mục 5) đã gửi cho Frontend và DevOps xác nhận.
- [ ] Ma trận phân quyền RBAC (code, không phải bảng DB) đã bàn giao cho QA để viết test case.
- [ ] Thuật toán xếp hạng/điểm chuẩn/waitlist (mục 2.6) đã được Team Lead + đại diện nghiệp vụ (giảng viên hướng dẫn/đề bài) xác nhận đúng quy chế tuyển sinh thực tế trước khi code.
