"""
Chuyển bản dump CSDL admission_db (MariaDB, đã chạy v3 -> mới nhất) thành script cho MySQL 8
(VD Aiven MySQL miễn phí) — dùng cho backend chạy trên Render (npm run start:hosted).

Cách tạo lại admission_db_mysql.sql khi có migration mới:
  1. Dựng MariaDB sạch bằng Docker (frontend/docker-compose.yml, dịch vụ db) để chạy v3 -> mới nhất
  2. mariadb-dump -uroot -p --skip-triggers --skip-add-locks --skip-lock-tables --skip-comments \
       --skip-dump-date --skip-extended-insert --default-character-set=utf8mb4 admission_db > dump.sql
  3. python3 mariadb_to_mysql.py dump.sql admission_db_mysql.sql

Khác biệt được sửa:
  - Bỏ dòng "sandbox mode" mà MySQL không hiểu
  - DEFAULT utc_timestamp()  ->  DEFAULT (UTC_TIMESTAMP())
  - Tên ràng buộc CHECK "CONSTRAINT_1" bị trùng giữa các bảng -> đặt <bảng>_ck_1
  - Chạy lại an toàn: CREATE TABLE IF NOT EXISTS, INSERT IGNORE, bỏ DROP TABLE
Không có trigger / procedure: backend đã làm các việc đó trong code (CSDL miễn phí không cho tạo trigger).
"""
import re
import sys

HEADER = """-- ============================================================================
-- admission_db cho MySQL 8 (Aiven...) — TỰ SINH từ bản MariaDB đầy đủ v3 -> v13 bằng mariadb_to_mysql.py.
-- Không sửa tay. Backend tự chạy file này khi CSDL còn trống (npm run start:hosted, DB_AUTO_INIT=true).
-- Không có trigger/procedure: các ràng buộc tương ứng đã được làm trong code backend.
-- Chạy với FOREIGN_KEY_CHECKS=0 (bảng tạo theo thứ tự chữ cái). Chạy lại nhiều lần vẫn an toàn.
-- ============================================================================
"""

src = open(sys.argv[1], encoding="utf-8").read()
src = re.sub(r"^/\*M!999999.*\n", "", src)
src = src.replace("DEFAULT utc_timestamp()", "DEFAULT (UTC_TIMESTAMP())")
src = src.replace("DEFAULT current_timestamp()", "DEFAULT CURRENT_TIMESTAMP")
src = re.sub(r"^DROP TABLE IF EXISTS .*\n", "", src, flags=re.M)
src = re.sub(r"^CREATE TABLE `", "CREATE TABLE IF NOT EXISTS `", src, flags=re.M)
src = re.sub(r"^INSERT INTO `", "INSERT IGNORE INTO `", src, flags=re.M)
src = re.sub(r"^/\*!40000 ALTER TABLE `\w+` (DIS|EN)ABLE KEYS \*/;\n", "", src, flags=re.M)
out, table = [], None
for line in src.split("\n"):
    m = re.match(r"CREATE TABLE IF NOT EXISTS `(\w+)`", line)
    if m:
        table = m.group(1)
    line = re.sub(r"CONSTRAINT `CONSTRAINT_(\d+)` CHECK", lambda mm: f"CONSTRAINT `{table}_ck_{mm.group(1)}` CHECK", line)
    # Bỏ các lệnh lưu/khôi phục biến phiên của mysqldump (chạy từng câu qua Prisma không cần)
    if re.match(r"/\*!\d+ SET (@OLD_|@@SESSION.SQL_LOG_BIN|SQL_NOTES|TIME_ZONE|CHARACTER_SET|COLLATION|UNIQUE_CHECKS|SQL_MODE|FOREIGN_KEY_CHECKS=@OLD)", line):
        continue
    if re.match(r"/\*!\d+ SET (character_set_client|@saved_cs_client|character_set_client = @saved)", line):
        continue
    out.append(line)
body = "\n".join(out).strip() + "\n"
open(sys.argv[2], "w", encoding="utf-8").write(HEADER + body)
