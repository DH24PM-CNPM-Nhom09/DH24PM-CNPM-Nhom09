# ============================================================================
# MariaDB đã kèm sẵn cấu trúc CSDL admission_db (v3 + migration v4 → v11).
# Lần đầu khởi động với ổ dữ liệu trống, script trong /docker-entrypoint-initdb.d tự tạo bảng.
# Các file SQL lấy từ backend/database (nguồn duy nhất) qua build context phụ "sqlfiles".
#   docker compose up -d --build        (chạy trong thư mục frontend/)
# hoặc build tay:
#   docker build -f docker/db/Dockerfile --build-context sqlfiles=../backend/database -t tuyensinh-db .
# Cần biến: MARIADB_ROOT_PASSWORD, MARIADB_DATABASE=admission_db, MARIADB_USER, MARIADB_PASSWORD.
# Dữ liệu nằm ở /var/lib/mysql — PHẢI gắn ổ lưu trữ bền vững.
# ============================================================================
FROM mariadb:10.11
COPY --from=sqlfiles *.sql /sql/
COPY docker/initdb/01-admission-db.sh /docker-entrypoint-initdb.d/01-admission-db.sh
# Phòng khi máy Windows lấy code với xuống dòng CRLF: bỏ \r để script chạy được trong Linux
RUN sed -i 's/\r$//' /docker-entrypoint-initdb.d/01-admission-db.sh
CMD ["mariadbd", "--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci", "--default-time-zone=+00:00"]
