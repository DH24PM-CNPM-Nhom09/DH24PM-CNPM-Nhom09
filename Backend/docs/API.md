# API Documentation – Hệ thống quản lý tuyển sinh sau đại học (GĐ4)

Base URL: `/api/v1` · Định dạng: JSON · Xác thực: `Authorization: Bearer <JWT>` (trừ `/auth/google`).

Lỗi trả về dạng: `{ "error": { "code": "...", "message": "...", "details": [...]? } }`

## Vai trò
`CANDIDATE` (thí sinh), `STAFF` (cán bộ), `REVIEWER` (người duyệt), `ADMIN`.

## Auth
| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| POST | `/auth/google` | Công khai | Đổi Google ID token lấy JWT |
| GET | `/auth/me` | Đã đăng nhập | Thông tin người dùng hiện tại |

**POST /auth/google** — Body: `{ "idToken": "<google id token>" }`
→ `200 { "token": "...", "user": { "id", "email", "fullName", "role" } }`
Lỗi: `401 INVALID_GOOGLE_TOKEN`, `401 EMAIL_NOT_VERIFIED`, `400 VALIDATION_ERROR`.
Người dùng mới mặc định role `CANDIDATE`. Cấp role khác do ADMIN chỉnh trong DB.

## Hồ sơ (applications)
| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| POST | `/applications` | CANDIDATE | Tạo hồ sơ nháp cho một ngành |
| GET | `/applications?status=` | Đã đăng nhập | Thí sinh: hồ sơ của mình; cán bộ: tất cả |
| GET | `/applications/:id` | Chủ hồ sơ / cán bộ | Chi tiết hồ sơ |
| POST | `/applications/:id/submit` | Chủ hồ sơ | Nộp hồ sơ (DRAFT → SUBMITTED) |
| POST | `/applications/:id/review` | REVIEWER, ADMIN | Duyệt / từ chối |

**POST /applications** — Body: `{ "programId": 5 }` → `201` hồ sơ (`status: DRAFT`).
Lỗi: `404 PROGRAM_NOT_FOUND`, `409 PROGRAM_CLOSED`, `409 DUPLICATE_APPLICATION`.

**POST /applications/:id/submit** → `200` hồ sơ (`status: SUBMITTED`, có `submittedAt`).
Lỗi: `403 FORBIDDEN`, `404 APPLICATION_NOT_FOUND`, `409 INVALID_STATE`.

**POST /applications/:id/review** — Body: `{ "decision": "UNDER_REVIEW" | "APPROVED" | "REJECTED", "note": "..." }`
→ `200` hồ sơ đã cập nhật. Lỗi: `409 INVALID_STATE`, `409 PAYMENT_REQUIRED` (duyệt khi chưa thanh toán).

Máy trạng thái: `DRAFT → SUBMITTED → (UNDER_REVIEW) → APPROVED | REJECTED`.

## Thanh toán lệ phí (payments)
| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| POST | `/applications/:id/payments` | Chủ hồ sơ | Tạo giao dịch lệ phí (PENDING) |
| POST | `/payments/:id/confirm` | STAFF, ADMIN | Xác nhận đã thanh toán (PENDING → PAID) |

**POST /applications/:id/payments** — Body: `{ "method": "BANK_TRANSFER" | "CARD" | "E_WALLET" }`
→ `201 { id, applicationId, amount, method, status: "PENDING", txnRef }`.
Lỗi: `409 APPLICATION_NOT_SUBMITTED`, `409 PAYMENT_EXISTS`, `403 FORBIDDEN`.

**POST /payments/:id/confirm** → `200` giao dịch (`status: PAID`, có `paidAt`).
Lỗi: `404 PAYMENT_NOT_FOUND`, `409 INVALID_STATE`.

## Khác
`GET /health` → `{ "status": "ok" }`
