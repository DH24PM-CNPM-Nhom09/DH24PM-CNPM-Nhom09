# Hướng dẫn dựng Database (MariaDB + Docker) trên Windows

Tài liệu cho giai đoạn 4 — hạng mục "Implement database".
Người viết: Lâm Hoài An (nhóm Data).

Mục tiêu: dựng CSDL `admission_db` trên máy cá nhân bằng Docker, nạp đủ 9 file SQL, chạy seed và bật backend để kiểm tra. Cách này dùng cho **môi trường phát triển trên máy cá nhân**, không dùng cho deploy thật.

## 1. Tổng quan

| Thành phần | Chi tiết |
|---|---|
| CSDL | MariaDB 11 (chạy trong Docker) |
| Tên CSDL | `admission_db` |
| Nguồn cấu trúc bảng | File SQL trong `backend/database/`: `admission_db_v3.sql`, rồi `migration_v4` đến `migration_v11` |
| ORM | Prisma 6, `backend/prisma/schema.prisma` sinh từ CSDL bằng `prisma db pull` |
| Quy ước | Cấu trúc bảng thay đổi bằng **file SQL migration mới**, không sửa tay trong DB. Sau đó chạy `npm run db:pull` và `npm run prisma:generate` để cập nhật schema Prisma |

Lưu ý: nhóm không dùng `prisma migrate`. Nguồn sự thật của cấu trúc bảng là các file SQL.

## 2. Chuẩn bị

Cần cài sẵn:
- **Git**
- **Node.js** từ bản 18.18 trở lên (kiểm tra: `node -v`)
- **Docker Desktop**, và phải **mở lên, chờ hiện "Engine running"** trước khi chạy lệnh Docker

Lấy code:
```
git clone https://github.com/DH24PM-CNPM-Nhom09/DH24PM-CNPM-Nhom09.git
cd DH24PM-CNPM-Nhom09
```

## 3. Dựng MariaDB bằng Docker

Chạy một lần:
```
docker run --name admission-mariadb -e MARIADB_ROOT_PASSWORD=root -e MARIADB_DATABASE=admission_db -p 3306:3306 -d mariadb:11
```

Kiểm tra đã chạy: `docker ps`, và `docker logs admission-mariadb --tail 5` phải thấy `ready for connections`.

Những lần sau (tắt máy, mở lại), chỉ cần bật lại container:
```
docker start admission-mariadb
```

> Mật khẩu `root` chỉ dùng trên máy cá nhân. Không dùng cho server thật.

**Muốn dùng docker-compose của DevOps thay vì lệnh trên:** file `devops/docker-compose.yml` có sẵn service `mariadb` (user `admission_user`, mật khẩu trong file). Dùng cách nào cũng được, nhưng đừng chạy cả hai cùng lúc vì cùng chiếm cổng 3306. Nếu dùng compose, thay `DATABASE_URL` bên dưới theo user và mật khẩu trong file đó.

## 4. Nạp các file SQL

Mở CMD, vào thư mục `backend` rồi chạy **một lệnh duy nhất** (phải nằm trên một dòng):
```
cd backend
for %f in (admission_db_v3 migration_v4_backend migration_v5_announcement migration_v6_staff_security migration_v7_payment_config migration_v8_real_notice migration_v9_english_test migration_v10_admission_results migration_v11_privacy) do docker exec -i admission-mariadb mariadb -uroot -proot --default-character-set=utf8mb4 < database\%f.sql
```

Lưu ý:
- Thứ tự v3, v4, ..., v11 là **bắt buộc**.
- `--default-character-set=utf8mb4` là **bắt buộc**, thiếu thì tiếng Việt bị lỗi font.
- Chạy thành công thì **không in gì**. Có lỗi sẽ hiện chữ `ERROR`.
- Dùng CMD hoặc Git Bash. Dấu `<` không chạy trong PowerShell.
- Chỉ nạp **một lần** trên DB trống. Nạp lại lần hai sẽ báo lỗi "đã tồn tại" (xem mục 8 để làm lại từ đầu).

Kiểm tra kết quả (theo README backend phải có **45 bảng**):
```
docker exec -it admission-mariadb mariadb -uroot -proot admission_db -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='admission_db' AND table_type='BASE TABLE';"
```

## 5. Cấu hình backend

Trong thư mục `backend`:
```
copy .env.example .env
notepad .env
```

Sửa dòng `DATABASE_URL` cho khớp mật khẩu container (file mẫu viết cho XAMPP, root không mật khẩu):
```
DATABASE_URL="mysql://root:root@localhost:3306/admission_db"
```

Cấu trúc: `mysql://TÊN_USER:MẬT_KHẨU@MÁY:CỔNG/TÊN_DB`.

Các biến khác giữ nguyên khi chạy local. File `.env` đã nằm trong `.gitignore`: **không commit `.env`**.

## 6. Chạy backend và seed dữ liệu

```
npm install
npx prisma generate
npm run db:seed:demo
npm run dev
```

| Lệnh | Việc làm |
|---|---|
| `npm run db:seed:demo` | Nạp dữ liệu mẫu (khoảng 65 hồ sơ, 4 đợt, phúc khảo...). **Chỉ chạy được trên DB trống** |
| `npm run db:seed` | Chỉ tạo 1 tài khoản quản trị `quantri@agu.edu.vn` (dùng khi chuẩn bị deploy thật, không dùng dữ liệu mẫu) |
| `npm run dev` | Chạy backend ở http://localhost:4000, tự khởi động lại khi sửa code |

Cửa sổ chạy `npm run dev` sẽ đứng yên ở dòng log cuối. Đó là bình thường. **Không đóng cửa sổ đó**; mở cửa sổ CMD mới cho các lệnh khác. Muốn tắt thì nhấn Ctrl+C.

Kiểm tra: mở http://localhost:4000/health, thấy `{"status":"ok","database":"up"}` là backend đã nối được CSDL.

Tài khoản demo (sau `db:seed:demo`, mật khẩu chung `Demo@123`): `canbo@agu.edu.vn`, `hoidong@agu.edu.vn`, `lanhdao@agu.edu.vn`, `quantri@agu.edu.vn`. **Chỉ dùng cho môi trường phát triển.**

Mặc định có tác vụ tự động chạy mỗi 15 phút, có thể chuyển một số hồ sơ demo sang "Không đạt" do quá hạn. Muốn giữ nguyên dữ liệu demo, đặt `AUTO_JOB_MINUTES=0` trong `.env` rồi chạy lại backend.

## 7. Xem dữ liệu

Cách nhanh nhất là Prisma Studio (mở cửa sổ CMD mới, vào thư mục `backend`):
```
npx prisma studio
```
Mở http://localhost:5555 để xem, lọc từng bảng. Kiểm tra tiếng Việt hiển thị đúng, không có ký tự kiểu `Ã¡`.

Hoặc vào thẳng MariaDB:
```
docker exec -it admission-mariadb mariadb -uroot -proot admission_db
```
Gõ `SHOW TABLES;` để xem danh sách bảng, `exit` để thoát.

## 8. Làm lại DB từ đầu

Dùng khi nạp SQL bị lỗi giữa chừng hoặc muốn có DB sạch:
```
docker exec -i admission-mariadb mariadb -uroot -proot -e "DROP DATABASE IF EXISTS admission_db; CREATE DATABASE admission_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```
Sau đó làm lại từ mục 4. Lệnh này **xóa toàn bộ dữ liệu**.

Xóa hẳn container (và toàn bộ dữ liệu trong đó):
```
docker rm -f admission-mariadb
```

## 9. Khi cấu trúc bảng thay đổi

1. Viết file SQL mới, đặt tên tiếp theo trong `backend/database/` (ví dụ `migration_v12_ten_thay_doi.sql`). Chỉ **thêm**, không xóa dữ liệu cũ.
2. Chạy file đó trên DB của bạn để thử.
3. Cập nhật schema Prisma:
   ```
   npm run db:pull
   npm run prisma:generate
   ```
4. Cập nhật danh sách file trong hướng dẫn này và README backend.
5. Tạo Pull Request, nhờ Team Lead review. Không merge vào `main` khi chưa review.

Với DB đang có dữ liệu (không muốn tạo lại), tắt backend rồi chạy `npm run db:update`: lệnh này chạy migration v5 đến v11 an toàn và tự `prisma generate`.

## 10. Sao lưu

```
npm run db:backup
```
Tạo `backups/admission_db_<ngày>_<giờ>.sql` (gồm dữ liệu, trigger, thủ tục) và bản sao thư mục tệp minh chứng. Khôi phục:
```
docker exec -i admission-mariadb mariadb -uroot -proot --default-character-set=utf8mb4 admission_db < backups\<tên_file>.sql
```

## 11. Lỗi thường gặp

| Triệu chứng | Nguyên nhân và cách xử lý |
|---|---|
| `failed to connect to the docker API ... dockerDesktopLinuxEngine` | Docker Desktop chưa chạy. Mở Docker Desktop, chờ "Engine running" rồi chạy lại |
| `port is already allocated` hoặc backend không nối được | Cổng 3306 đang bị chiếm (XAMPP, MySQL cài sẵn, hoặc container khác). Tắt cái đang chiếm, hoặc đổi cổng: `-p 3307:3306` và sửa `DATABASE_URL` thành cổng 3307 |
| `Access denied for user 'root'` khi backend chạy | `DATABASE_URL` trong `.env` sai mật khẩu. Phải là `root:root` nếu dùng lệnh ở mục 3 |
| `Unknown database 'admission_db'` | Chưa nạp SQL, hoặc container tạo thiếu `MARIADB_DATABASE`. Làm lại mục 8 rồi mục 4 |
| Tiếng Việt bị lỗi font (`Ã¡`, `?`) | Nạp SQL thiếu `--default-character-set=utf8mb4`. Làm lại mục 8 rồi mục 4 |
| Nạp SQL báo `already exists` | Đã nạp rồi. Muốn nạp lại phải làm mục 8 trước |
| `db:seed:demo` báo DB không trống | Seed demo chỉ chạy được trên DB trống. Làm mục 8 rồi nạp lại SQL và seed |
| `npm run dev` báo thiếu module hoặc Prisma client | Chạy `npm install` rồi `npx prisma generate` |
| Docker chạy chậm, hoặc báo thiếu RAM | Đóng bớt ứng dụng nặng; Docker Desktop cần khoảng 4GB RAM |

## 12. Lưu ý bảo mật

- Mật khẩu `root`, tài khoản `Demo@123` và `DEV_AUTH_BYPASS=true` **chỉ dành cho dev**.
- Không commit file `.env`. Chỉ commit `.env.example` (giá trị giả).
- Trước khi deploy thật: tạo DB mới, nạp SQL v3 đến v11, chạy `npm run db:seed` (không phải `db:seed:demo`), đặt `DEV_AUTH_BYPASS=false`, đổi `JWT_SECRET` thành chuỗi ngẫu nhiên dài, đổi mật khẩu DB. Chi tiết xem mục "Trước khi triển khai thật" trong `backend/README.md`.
- Render không có MariaDB quản lý sẵn nhưng chạy được: deploy image `mariadb:11` bằng Docker runtime (nên để dạng private service, backend gọi qua mạng nội bộ) và **bắt buộc gắn persistent disk** (mount `/var/lib/mysql`) để không mất dữ liệu khi deploy lại hoặc khởi động lại. Persistent disk chỉ gắn được cho dịch vụ trả phí.
- Không dùng chức năng restore snapshot của disk để khôi phục DB tự dựng trên Render. Dùng `npm run db:backup` làm bản sao lưu chính (xem mục 10).
