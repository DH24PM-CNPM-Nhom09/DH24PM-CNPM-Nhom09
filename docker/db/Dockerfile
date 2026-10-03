# ============================================================================
# MariaDB đã kèm sẵn cấu trúc CSDL admission_db (v3 + migration v4 → v11).
# Lần đầu khởi động với ổ dữ liệu trống, script trong /docker-entrypoint-initdb.d tự tạo bảng.
#   docker build -f docker/db/Dockerfile -t tuyensinh-db .      (chạy ở thư mục gốc repo)
# Cần biến: MARIADB_ROOT_PASSWORD, MARIADB_DATABASE=admission_db, MARIADB_USER, MARIADB_PASSWORD.
# Dữ liệu nằm ở /var/lib/mysql — PHẢI gắn ổ lưu trữ bền vững.
# ============================================================================
FROM mariadb:10.11
COPY backend/database/*.sql /sql/
COPY docker/initdb/01-admission-db.sh /docker-entrypoint-initdb.d/01-admission-db.sh
CMD ["mariadbd", "--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci", "--default-time-zone=+00:00"]
