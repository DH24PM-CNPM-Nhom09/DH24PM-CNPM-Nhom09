# Hướng dẫn Docker cho cả nhóm

Tài liệu này giúp mọi thành viên chạy **toàn bộ hệ thống tuyển sinh sau đại học trên máy mình chỉ bằng vài lệnh**, không cần cài XAMPP, Node.js hay MariaDB. Phần cuối dành cho người đưa hệ thống lên máy chủ.

Hệ thống gồm 3 phần, mỗi phần chạy trong một "container":

| Phần | Dockerfile | Cổng trên máy bạn | Ghi chú |
| :--- | :--- | :--- | :--- |
| CSDL MariaDB 10.11 | `docker/db/Dockerfile` (build ở **thư mục gốc**) | 3307 (chỉ máy bạn mở được) | Tự tạo đủ 45 bảng, 13 trigger từ `backend/database` (v3 → v11) ở lần chạy đầu |
| Backend NestJS | `backend/Dockerfile` | 4000 | Kiểm tra sống: `GET /health`; tệp thí sinh tải lên lưu ở `/app/uploads` |
| Frontend Next.js | `frontend/web/Dockerfile` | 3000 | Địa chỉ backend được "đóng" vào lúc build |

Mục lục: [1. Cài Docker](#1-cài-docker-một-lần) · [2. Chạy lần đầu](#2-chạy-hệ-thống-lần-đầu) · [3. Dùng hằng ngày](#3-dùng-hằng-ngày) · [4. Theo vai trò](#4-cách-làm-theo-vai-trò-trong-nhóm) · [5. Lỗi thường gặp](#5-lỗi-thường-gặp) · [6. Quy ước Git](#6-quy-ước-git-của-nhóm) · [7. Biến môi trường](#7-biến-môi-trường) · [8. Đưa lên máy chủ](#8-đưa-lên-máy-chủ--dịch-vụ-đám-mây)

---

## 1. Cài Docker (một lần)

**Windows 10/11 (64-bit):**

1. Mở **PowerShell bằng quyền Administrator**, chạy `wsl --install`, rồi khởi động lại máy. (Đã có WSL thì chạy `wsl --update`.)
2. Tải **Docker Desktop** tại https://www.docker.com/products/docker-desktop/ và cài, giữ nguyên lựa chọn "Use WSL 2".
3. Mở Docker Desktop, đợi góc dưới bên trái báo **Engine running** (màu xanh). Không cần đăng nhập tài khoản Docker.
4. Mở cửa sổ lệnh (PowerShell hoặc Terminal của VS Code) và kiểm tra:
   ```bash
   docker version
   docker compose version
   ```
   Hiện số phiên bản là được.

Máy nên có từ 8 GB RAM. Nếu máy chậm: Docker Desktop → Settings → Resources, để khoảng 4 GB RAM cho Docker.

**macOS:** tải Docker Desktop bản Apple Silicon hoặc Intel đúng với máy, các bước sau giống hệt.

## 2. Chạy hệ thống lần đầu

```bash
git clone https://github.com/DH24PM-CNPM-Nhom09/DH24PM-CNPM-Nhom09.git
cd DH24PM-CNPM-Nhom09
git checkout feature/admin-portal        # nhánh chứa web + backend + Docker (xem mục 6)

copy .env.example .env                   # macOS/Linux: cp .env.example .env
```

Mở file `.env` vừa tạo. **Để demo trên máy mình**, chỉ cần sửa 2 dòng:

```
DEV_AUTH_BYPASS=true
DEMO_LOGIN=true
```

(Mật khẩu CSDL và `JWT_SECRET` để nguyên cũng chạy được trên máy cá nhân. Khi chạy thật thì phải đổi — xem mục 8.)

Sau đó:

```bash
docker compose up -d --build
```

Lần đầu mất khoảng 5–10 phút (tải image và build). Kiểm tra cả 3 phần đã sẵn sàng:

```bash
docker compose ps
```

Cột STATUS của `db` và `backend` phải là **healthy**, `frontend` là **Up**. Nếu backend còn "starting" thì đợi thêm 30 giây.

Nạp dữ liệu (chỉ làm **một lần**, chọn một trong hai):

```bash
docker compose exec backend npm run db:seed:demo   # demo: dữ liệu mẫu, mật khẩu chung Demo@123
docker compose exec backend npm run db:seed        # dùng thật: chỉ tạo quantri@agu.edu.vn / Admin@123 (bắt đổi mật khẩu)
```

Lệnh seed không bao giờ ghi đè: gặp CSDL đã có dữ liệu thì tự dừng, chạy nhầm lần hai cũng không sao.

**Mở trình duyệt:**

| Trang | Địa chỉ | Đăng nhập (sau `db:seed:demo`) |
| :--- | :--- | :--- |
| Cổng thí sinh | http://localhost:3000 | Bấm "Đăng nhập với Google" → vào thí sinh mẫu `thisinh.demo@gmail.com` |
| Cổng cán bộ | http://localhost:3000/admin/login | `canbo@agu.edu.vn` (cán bộ tuyển sinh), `hoidong@agu.edu.vn` (hội đồng), `lanhdao@agu.edu.vn` (lãnh đạo), `quantri@agu.edu.vn` (quản trị) — mật khẩu `Demo@123` |
| API backend | http://localhost:4000/api/v1 | |
| Kiểm tra backend | http://localhost:4000/health | Trả `{"status":"ok","database":"up"...}` là backend và CSDL chạy tốt |

Khi `DEV_AUTH_BYPASS=true` mà chưa cấu hình Gmail, mã xác thực 6 số khi đăng ký thí sinh hiện ngay trên màn hình.

## 3. Dùng hằng ngày

| Muốn làm gì | Lệnh |
| :--- | :--- |
| Bật hệ thống | `docker compose up -d` (hoặc bấm ▶ ở Docker Desktop) |
| Tắt hệ thống (giữ dữ liệu) | `docker compose stop` |
| Xem phần nào đang chạy | `docker compose ps` |
| Xem log backend (Ctrl+C để thoát) | `docker compose logs -f backend` |
| Xem log CSDL / frontend | `docker compose logs -f db` · `docker compose logs -f frontend` |
| Lấy code mới của nhóm | `git pull` → `docker compose up -d --build` → `docker compose exec backend npm run db:update` |
| Chỉ build lại frontend | `docker compose up -d --build frontend` |
| Khởi động lại backend | `docker compose restart backend` |
| Vào dòng lệnh SQL | `docker compose exec db mariadb -u tuyensinh -p admission_db` (mật khẩu là `DB_PASSWORD` trong `.env`) |
| Sao lưu CSDL ra tệp | `docker compose exec db sh -c 'mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" --routines --triggers admission_db' > backup.sql` |
| Kiểm tra backend + CSDL còn sống | Mở http://localhost:4000/health → `{"status":"ok","database":"up"...}` |

`db:update` chỉ **thêm** bảng/cột mới (các tệp migration), không xóa dữ liệu, chạy nhiều lần cũng an toàn.

**Dữ liệu nằm ở đâu?** Trong 2 "volume" của Docker: `db_data` (CSDL) và `uploads` (tệp minh chứng thí sinh tải lên). Tắt máy, `docker compose stop`, `docker compose down` hay build lại đều **không mất** dữ liệu.

> ⚠️ Chỉ lệnh `docker compose down -v` mới xóa sạch dữ liệu (chữ `-v`). Không dùng lệnh này trên máy chạy thật hoặc máy đang giữ dữ liệu demo cần dùng. Chỉ dùng khi muốn làm lại CSDL từ đầu trên máy cá nhân (xem mục 5).

**Xem CSDL bằng giao diện:** dùng HeidiSQL (đi kèm XAMPP), DBeaver hoặc MySQL Workbench, kết nối tới `127.0.0.1`, cổng `3307`, user `tuyensinh`, mật khẩu `DB_PASSWORD`, CSDL `admission_db`. Cổng này chỉ mở cho chính máy bạn, máy khác trong mạng không vào được.

## 4. Cách làm theo vai trò trong nhóm

**Người kiểm thử, viết tài liệu, phân tích nghiệp vụ, thuyết trình:** chạy cả hệ thống như mục 2 là đủ, không cần cài Node.js. Mỗi khi nhóm có code mới: `git pull` rồi `docker compose up -d --build`.

**Người làm frontend** (sửa giao diện, muốn thấy thay đổi ngay khi lưu tệp):

```bash
docker compose up -d db backend          # chỉ chạy CSDL + backend trong Docker
cd frontend/web
copy .env.example .env.local             # đã điền sẵn địa chỉ backend localhost:4000
npm install
npm run dev                              # http://localhost:3000, tự cập nhật khi lưu tệp
```

Nếu frontend trong Docker đang chạy thì tắt trước cho khỏi tranh cổng 3000: `docker compose stop frontend`.

**Người làm backend** (sửa code NestJS):

```bash
docker compose up -d db                  # chỉ chạy CSDL trong Docker
cd backend
copy .env.example .env
```

Trong `backend/.env`, đổi dòng `DATABASE_URL` thành (thay `<DB_PASSWORD>` bằng giá trị trong `.env` ở thư mục gốc):

```
DATABASE_URL="mysql://tuyensinh:<DB_PASSWORD>@127.0.0.1:3307/admission_db"
```

Rồi `npm install` → `npx prisma generate` → `npm run dev` (backend tự chạy lại khi lưu tệp). Ai vẫn quen dùng XAMPP thì cứ giữ `DATABASE_URL` trỏ về XAMPP như trong `backend/README.md`, hai cách dùng song song được.

**Thêm bảng/cột mới vào CSDL:** tạo tệp `backend/database/migration_vNN_<tên>.sql` (chỉ `CREATE`/`ALTER ... ADD`, không xóa), thêm tên tệp vào `backend/prisma/update.ts` và `docker/initdb/01-admission-db.sh`, cập nhật `backend/prisma/schema.prisma`. Trong tệp SQL **không được có dấu `;` bên trong chuỗi hoặc chú thích** (lệnh `db:update` tách câu theo dấu `;`).

**Phân quyền:** ma trận quyền ở `backend/src/common/permissions.ts` và `frontend/web/src/lib/admin/permissions.ts` phải luôn giống nhau. Sửa bên này thì sửa cả bên kia.

## 5. Lỗi thường gặp

| Hiện tượng | Cách xử lý |
| :--- | :--- |
| `Đặt DB_ROOT_PASSWORD trong file .env` / `Đặt JWT_SECRET ...` | Chưa có file `.env` ở thư mục gốc. Chạy `copy .env.example .env`. |
| `error during connect` / `Cannot connect to the Docker daemon` | Docker Desktop chưa mở hoặc chưa "Engine running". Mở rồi đợi 1 phút. |
| `WSL 2 installation is incomplete` | PowerShell (Administrator): `wsl --update`, khởi động lại máy. |
| `port is already allocated` / `address already in use` (3000, 4000, 3307) | Cổng đang bị chương trình khác dùng (thường là `npm run dev` đang chạy). Tắt chương trình đó, hoặc đổi trong `.env`: `FRONTEND_PORT=3001`, `FRONTEND_URL=http://localhost:3001`; với backend: `BACKEND_PORT=4001`, `BACKEND_PUBLIC_URL=http://localhost:4001`. Rồi `docker compose up -d --build`. |
| `backend` mãi không lên **healthy** | `docker compose logs backend` xem dòng lỗi cuối. Hay gặp nhất: CSDL chưa tạo xong ở lần đầu — đợi thêm rồi `docker compose restart backend`. |
| Trang web báo không kết nối được máy chủ | Mở http://localhost:4000/health. Không mở được → xem log backend. Mở được → kiểm tra `BACKEND_PUBLIC_URL` trong `.env` rồi build lại frontend. |
| Sửa code frontend mà giao diện không đổi | Frontend trong Docker là bản đã build: chạy `docker compose up -d --build frontend` (hoặc làm theo cách ở mục 4). |
| Đăng nhập cán bộ báo "Đăng nhập sai quá nhiều lần. Tài khoản tạm khóa..." | Đợi 15 phút, hoặc đăng nhập `quantri@agu.edu.vn` → Tài khoản cán bộ → Cấp lại mật khẩu cho người đó (việc này cũng mở khóa). |
| `Too many requests` khi đăng nhập liên tục để kiểm thử | Tăng `AUTH_RATE_LIMIT` trong `.env` (ví dụ 500) rồi `docker compose up -d`. |
| Lần đầu tạo CSDL bị lỗi giữa chừng (log `db` có `ERROR`) | Trên **máy cá nhân**, làm lại CSDL từ đầu: `docker compose down -v` rồi `docker compose up -d --build` và seed lại. Lệnh này xóa dữ liệu trong Docker — chỉ dùng khi chắc chắn. |
| Hết dung lượng ổ đĩa | Docker Desktop → Troubleshoot → Clean / Purge data, hoặc `docker image prune` (chỉ xóa image cũ không dùng, không đụng dữ liệu). |

Vẫn không được: gửi vào nhóm kết quả của `docker compose ps` và 30 dòng cuối của `docker compose logs backend --tail 30`.

## 6. Quy ước Git của nhóm

- Nhánh `main` hiện đang chứa phần backend do nhóm backend viết riêng, **lịch sử không chung** với nhánh web. Không ai push thẳng vào `main`; mọi thay đổi đi qua Pull Request để cả nhóm xem trước khi gộp.
- Nhánh `feature/admin-portal`: web (cổng thí sinh + cổng cán bộ) + backend NestJS + Docker đang chạy được đầy đủ quy trình xét tuyển thạc sĩ, tiến sĩ.
- Làm phần mới: tạo nhánh riêng từ nhánh đang dùng, ví dụ `git checkout -b feature/<tên-phần>`, xong thì push và mở Pull Request.
- **Không bao giờ** đưa lên GitHub: file `.env`, `backend/.env`, `frontend/web/.env.local`, thư mục `backend/uploads/`, `backend/backups/`, mật khẩu ứng dụng Gmail, khóa Google. Các tệp này đã có trong `.gitignore`; kiểm tra `git status` trước khi commit.

## 7. Biến môi trường

Đặt trong `.env` ở thư mục gốc (compose tự truyền vào container), hoặc ở phần Environment của nơi triển khai:

| Biến | Bắt buộc | Ý nghĩa |
| :--- | :--- | :--- |
| `DB_ROOT_PASSWORD`, `DB_USER`, `DB_PASSWORD` | có | Tài khoản MariaDB. Chỉ dùng chữ và số. |
| `JWT_SECRET` | có | Chuỗi ngẫu nhiên ≥ 32 ký tự để ký phiên đăng nhập |
| `FRONTEND_URL` | | Địa chỉ trình duyệt mở frontend, dùng cho CORS (mặc định `http://localhost:3000`) |
| `BACKEND_PUBLIC_URL` | | Địa chỉ trình duyệt gọi backend (mặc định `http://localhost:4000`), đóng vào frontend lúc build |
| `FRONTEND_PORT`, `BACKEND_PORT`, `DB_PORT` | | Cổng trên máy (mặc định 3000, 4000, 3307) |
| `DEV_AUTH_BYPASS` | | `true` = cho đăng nhập Google giả, hiện mã OTP trên màn hình. **`false` khi dùng thật** |
| `DEMO_LOGIN` | | `true` = hiện khung tài khoản demo ở trang đăng nhập cán bộ. **`false` khi dùng thật** |
| `GOOGLE_CLIENT_ID`, `SMTP_USER`, `SMTP_PASS` | | Đăng nhập Google thật, gửi email thật (để trống thì chưa dùng; cách lấy xem `backend/README.md`) |
| `AUTO_JOB_MINUTES` | | Tác vụ tự động xử lý quá hạn, mặc định 15 phút (0 = tắt) |
| `AUTH_RATE_LIMIT` | | Số lần gọi API đăng nhập mỗi 10 phút / IP, mặc định 60 |

Khi chạy backend ngoài compose thì đặt trực tiếp `DATABASE_URL` (`mysql://<user>:<mật khẩu>@<máy CSDL>:3306/admission_db`) và `CORS_ORIGINS` (địa chỉ frontend). Frontend build bằng tham số `NEXT_PUBLIC_API_BASE_URL=https://<địa chỉ backend>/api/v1`, `NEXT_PUBLIC_DEMO_LOGIN=false`; đổi địa chỉ backend thì phải build lại frontend.

## 8. Đưa lên máy chủ / dịch vụ đám mây

**Máy chủ có Docker (VPS, máy của trường):** làm giống mục 2, nhưng trong `.env`:

- Đổi `DB_ROOT_PASSWORD`, `DB_PASSWORD`, `JWT_SECRET` thành chuỗi ngẫu nhiên của riêng máy chủ.
- `DEV_AUTH_BYPASS=false`, `DEMO_LOGIN=false`.
- `FRONTEND_URL`, `BACKEND_PUBLIC_URL` là tên miền thật có HTTPS (đặt Nginx/Caddy phía trước để cấp HTTPS).
- Chạy `npm run db:seed` (không phải seed demo), đăng nhập `quantri@agu.edu.vn` và đổi mật khẩu ngay.

**Render (không chạy được file docker-compose)** — tạo 3 dịch vụ riêng từ cùng repo:

1. **CSDL** — Private Service, Docker, Dockerfile `docker/db/Dockerfile`, build context là thư mục gốc. Biến: `MARIADB_ROOT_PASSWORD`, `MARIADB_DATABASE=admission_db`, `MARIADB_USER`, `MARIADB_PASSWORD`. **Gắn ổ lưu trữ bền vững vào `/var/lib/mysql`**, nếu không mỗi lần khởi động lại sẽ mất toàn bộ dữ liệu.
2. **Backend** — Web Service, Docker, thư mục `backend`. Health check path `/health`. Biến như mục 7, `DATABASE_URL` trỏ tới tên nội bộ của dịch vụ CSDL. **Gắn ổ lưu trữ bền vững vào `/app/uploads`** (tệp minh chứng của thí sinh).
3. **Frontend** — Web Service, Docker, thư mục `frontend/web`, khai báo `NEXT_PUBLIC_API_BASE_URL` trỏ tới địa chỉ HTTPS của backend (cần có lúc build).

Ổ lưu trữ bền vững thường chỉ có ở gói trả phí; gói miễn phí phù hợp để demo, không phù hợp để chạy thật. Sau khi chạy: `npm run db:seed` một lần trong shell của dịch vụ backend.

**Trước khi dùng thật:** xem mục "Trước khi triển khai thật" trong `backend/README.md` — tắt `DEV_AUTH_BYPASS`, đổi toàn bộ mật khẩu / khóa bí mật, chạy sau HTTPS, sao lưu định kỳ (lệnh sao lưu ở mục 3, chép tệp sao lưu sang nơi khác), rà soát trang Chính sách bảo vệ dữ liệu cá nhân (`/privacy`).
