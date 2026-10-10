# DH24PM-CNPM-Nhom09
## 👥 Danh Sách Thành Viên & Phân Công Vai Trò

Dưới đây là danh sách thành viên tham gia dự án và vai trò đảm nhiệm:

| STT | Họ và Tên | Vai Trò | Nhiệm Vụ Chính | Liên Hệ |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Thái Hoàng Minh** | Team Lead | Chịu trách nhiệm quản lý backlog, làm cầu nối trao đổi với Giảng viên và các nhóm khác, điều phối tiến độ công việc và phân chia task trong Sprint. | minh_dpm235451@student.agu.edu.vn / [Tài liệu](https://github.com/DH24PM-CNPM-Nhom09/DH24PM-CNPM-Nhom09/tree/main/docs) |
| 2 | **Châu Minh Tuệ** |  Frontend / Mobile Developers | Chịu trách nhiệm xây dựng giao diện người dùng web (Next.js) đảm bảo đồng bộ UI/UX theo Design System chung. | tue_dpm235494@student.agu.edu.vn / [Frontend](https://github.com/DH24PM-CNPM-Nhom09/DH24PM-CNPM-Nhom09/tree/main/frontend) |
| 3 | **Nguyễn Phúc Khang** | Frontend / Mobile Developers | Chịu trách nhiệm xây dựng giao diện người dùng ứng dụng di động (Flutter)  | khang_dpm235429@student.agu.edu.vn / [Frontend](https://github.com/DH24PM-CNPM-Nhom09/DH24PM-CNPM-Nhom09/tree/main/frontend) |
| 4 | **Lê Phước Hào**| Backend Developers | Chịu trách nhiệm xây dựng API, xử lý nghiệp vụ cốt lõi (Business Logic) bằng NestJS hoặc Spring Boot theo kiến trúc Clean Architecture / Modular Monolith. | hao_dpm235507@student.agu.edu.vn / [Backend](https://github.com/DH24PM-CNPM-Nhom09/DH24PM-CNPM-Nhom09/tree/main/backend) |
| 5 | **Phạm Lư Gia Quân** | Backend Developers | Chịu trách nhiệm xây dựng API, xử lý nghiệp vụ cốt lõi (Business Logic) bằng NestJS hoặc Spring Boot theo kiến trúc Clean Architecture / Modular Monolith. | quan_dpm235470@student.agu.edu.vn / [Backend](https://github.com/DH24PM-CNPM-Nhom09/DH24PM-CNPM-Nhom09/tree/main/backend) |
| 6 | **Phan Minh Trí** | Backend Developers | Chịu trách nhiệm xây dựng API, xử lý nghiệp vụ cốt lõi (Business Logic) bằng NestJS hoặc Spring Boot theo kiến trúc Clean Architecture / Modular Monolith. | tri_dpm235489@student.agu.edu.vn / [Backend](https://github.com/DH24PM-CNPM-Nhom09/DH24PM-CNPM-Nhom09/tree/main/backend) |
| 7 | **Võ Trường Hải** | DevOps / Cloud Engineer | Chịu trách nhiệm cấu hình hạ tầng, thiết lập quy trình CI/CD (GitHub Actions), container hóa dịch vụ với Docker và quản lý môi trường triển khai. | hai_dpm235414@student.agu.edu.vn / [DevOps-Infrastructure](https://github.com/DH24PM-CNPM-Nhom09/DH24PM-CNPM-Nhom09/tree/main/devops) |
| 8 | **Nguyễn Thành Luân** | DevOps / Cloud Engineer | Chịu trách nhiệm cấu hình hạ tầng, thiết lập quy trình CI/CD (GitHub Actions), container hóa dịch vụ với Docker và quản lý môi trường triển khai. | luan_dpm235445@student.agu.edu.vn / [DevOps-Infrastructure](https://github.com/DH24PM-CNPM-Nhom09/DH24PM-CNPM-Nhom09/tree/main/devops) |
| 9 | **Lâm Hoài An** | QA / Security & Data Specialist | Chịu trách nhiệm viết Unit/Integration Tests, kiểm tra bảo mật, chuẩn hóa dữ liệu, thiết lập cơ sở dữ liệu (MariaDB) và kiểm soát chất lượng mã nguồn trước khi tạo Pull Request. | an_dpm235402@student.agu.edu.vn / [QA-Testing](https://github.com/DH24PM-CNPM-Nhom09/DH24PM-CNPM-Nhom09/tree/main/qa) |
---

## 🔗 Liên Kết Đến Các Phân Hệ (Repository Links)

Dự án được chia thành các phân hệ mã nguồn độc lập. Vui lòng truy cập theo các đường dẫn dưới đây để xem chi tiết mã nguồn của từng bộ phận:

*   🌐 **Phân hệ Frontend:** [Frontend](https://github.com/DH24PM-CNPM-Nhom09/DH24PM-CNPM-Nhom09/tree/main/frontend)
*   ⚙️ **Phân hệ Backend:** [Backend](https://github.com/DH24PM-CNPM-Nhom09/DH24PM-CNPM-Nhom09/tree/main/backend)
*   ☁️ **Cấu hình DevOps:** [DevOps-Infrastructure](https://github.com/DH24PM-CNPM-Nhom09/DH24PM-CNPM-Nhom09/tree/main/devops)
*   🛡️ **Kịch bản Kiểm thử QA:** [QA-Testing](https://github.com/DH24PM-CNPM-Nhom09/DH24PM-CNPM-Nhom09/tree/main/qa)

## 🚀 Chạy hệ thống

```bash
git clone https://github.com/DH24PM-CNPM-Nhom09/DH24PM-CNPM-Nhom09.git
cd DH24PM-CNPM-Nhom09/frontend
copy .env.example .env            # macOS/Linux: cp .env.example .env
docker compose up -d --build
docker compose exec backend npm run db:seed:demo
```

Mở http://localhost:3000 (cổng thí sinh) và http://localhost:3000/admin/login (cổng cán bộ). Hướng dẫn đầy đủ: [frontend/TRIEN_KHAI_DOCKER.md](frontend/TRIEN_KHAI_DOCKER.md).
