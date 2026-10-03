# Backend — Cầu nối Frontend (Candidate API)

Backend NestJS **khớp 100% contract** của nhánh `Frontend`:

- `frontend/web/src/lib/api.ts`
- `frontend/web/src/lib/types.ts`

## API đã implement

| Frontend hàm | Method + Path | Auth |
|--------------|---------------|------|
| `loginWithGoogle` | `POST /api/v1/auth/google` | Public |
| `requestPasswordResetOtp` | `POST /api/v1/auth/forgot-password` | Public |
| `resetPassword` | `POST /api/v1/auth/reset-password` | Public |
| `getMyProfile` | `GET /api/v1/candidates/me` | Bearer |
| `updateMyProfile` | `PATCH /api/v1/candidates/me` | Bearer |
| `getMyApplication` | `GET /api/v1/applications/me` | Bearer |
| `getMyDocuments` | `GET /api/v1/applications/me/documents` | Bearer |
| `uploadDocument` | `POST /api/v1/applications/:id/documents` | Bearer + multipart |
| `getMySupervisorRequest` | `GET /api/v1/applications/me/supervisor-request` | Bearer |
| `submitComplaint` | `POST /api/v1/complaints` | Bearer |
| Health | `GET /health` | Public |

## Đã sửa so với Backend cũ

1. **OTP** — lưu `otp_code_hash`, verify đúng mã từ client  
2. **Auth** — `forgot-password` / `reset-password` đúng body Frontend  
3. **Profile** — `GET/PATCH /candidates/me` lấy identity từ JWT  
4. **Application** — `/applications/me` trả **1 object** + enum map đúng `types.ts`  
5. **Upload** — multipart `file` + `documentType`, giới hạn 5MB  
6. **Supervisor / Complaint** — đủ endpoint Frontend gọi  
7. **Lỗi** — `{ error_code, message, detail? }`  
8. **Health** — `/health` ngoài prefix `/api/v1`  

## Chạy local

```bash
cp .env.example .env
# Sửa DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID

# Chạy SQL bổ sung cột (nếu DB đã có sẵn)
mysql -u ... admission_db < prisma/migration_frontend_bridge.sql

npm install
npx prisma generate
npx prisma db push   # hoặc migrate
npm run start:dev
```

## Bật Frontend thật

Trong `frontend/web`:

1. `.env.local`:
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
```

2. `src/lib/api.ts`:
```ts
const USE_MOCK = false;
```

3. Token: Backend trả `{ accessToken }` → Frontend lưu `localStorage.access_token`.

## Dev không có Google OAuth

`NODE_ENV=development` cho phép `idToken = "dev:email@example.com"` để test login.

OTP khi `OTP_DEV_LOG=true` sẽ in ra console server.
