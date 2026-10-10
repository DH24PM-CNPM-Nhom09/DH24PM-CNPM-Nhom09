#!/bin/bash
# Khởi tạo CSDL lần đầu (chỉ chạy khi volume dữ liệu MariaDB còn trống):
# chạy lần lượt file gốc v3 rồi các migration v4 → v12 theo đúng thứ tự.
set -e
cd /sql
for f in admission_db_v3.sql \
         migration_v4_backend.sql \
         migration_v5_announcement.sql \
         migration_v6_staff_security.sql \
         migration_v7_payment_config.sql \
         migration_v8_real_notice.sql \
         migration_v9_english_test.sql \
         migration_v10_admission_results.sql \
         migration_v11_privacy.sql \
         migration_v12_candidate_declaration.sql; do
  echo "[initdb] $f"
  mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" --default-character-set=utf8mb4 < "$f"
done
echo "[initdb] Xong. Tạo tài khoản quản trị: docker compose exec backend npm run db:seed"
