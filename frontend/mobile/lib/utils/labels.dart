// Nhãn tiếng Việt dùng chung — khớp bản web (src/lib/application.ts).
import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

const docLabel = <String, String>{
  'DON_DANG_KY': 'Đơn đăng ký dự tuyển',
  'SO_YEU_LY_LICH': 'Sơ yếu lý lịch',
  'LY_LICH_CHUYEN_MON': 'Lý lịch chuyên môn',
  'ANH_THE': 'Ảnh 3x4',
  'VAN_BANG': 'Bằng tốt nghiệp đại học',
  'BANG_DIEM': 'Bảng điểm',
  'CCCD': 'Căn cước công dân',
  'CHUNG_CHI_NGOAI_NGU': 'Chứng chỉ ngoại ngữ',
  'CHUNG_CHI_AI': 'Chứng chỉ AI (trí tuệ nhân tạo)',
  'DE_CUONG_NCS': 'Đề cương nghiên cứu',
  'THU_GIOI_THIEU': 'Thư giới thiệu (nhà khoa học)',
  'GIAY_GIOI_THIEU': 'Giấy giới thiệu của cơ quan / giảng viên',
  'GIAY_UU_TIEN': 'Giấy xác nhận đối tượng ưu tiên',
  'CONG_NHAN_VAN_BANG': 'Công nhận văn bằng nước ngoài',
  'CONG_BO_KHOA_HOC': 'Công bố khoa học',
  'KHAC': 'Giấy tờ khác',
};

const docHint = <String, String>{
  'DON_DANG_KY': 'In đơn từ cổng tuyển sinh trên web, ký tên rồi chụp hoặc scan tải lên.',
  'SO_YEU_LY_LICH': 'Có xác nhận của địa phương hoặc nơi đang công tác.',
  'LY_LICH_CHUYEN_MON': 'Thành tích, kinh nghiệm công tác, dự án đã tham gia… kèm minh chứng (gộp một tệp PDF).',
  'ANH_THE': 'Ảnh chân dung 3x4, nền trắng hoặc xanh, chụp trong 6 tháng gần đây.',
  'VAN_BANG': 'Bản sao y công chứng (trong 6 tháng). Đang chờ bằng thì nộp giấy chứng nhận tốt nghiệp tạm thời.',
  'BANG_DIEM': 'Bản sao y công chứng bảng điểm toàn khóa (trong 6 tháng).',
  'CCCD': 'Bản sao y công chứng căn cước công dân (trong 6 tháng), đủ hai mặt.',
  'CHUNG_CHI_NGOAI_NGU': 'Chứng chỉ được Bộ GD&ĐT / ĐHQG-HCM công nhận, còn hạn 2 năm tính đến ngày đăng ký.',
  'CHUNG_CHI_AI': 'Chứng chỉ, chứng nhận hoàn thành khóa học về trí tuệ nhân tạo (nếu có).',
  'DE_CUONG_NCS': 'Đề cương nghiên cứu theo mẫu của Trường.',
  'THU_GIOI_THIEU': 'Thư giới thiệu của nhà khoa học có chức danh hoặc học vị tiến sĩ.',
  'GIAY_GIOI_THIEU': 'Giấy giới thiệu của cơ quan đang công tác hoặc của giảng viên (nếu có).',
  'GIAY_UU_TIEN': 'Giấy tờ chứng minh thuộc đối tượng ưu tiên (nếu có).',
  'CONG_NHAN_VAN_BANG': 'Bắt buộc nếu văn bằng do cơ sở giáo dục nước ngoài cấp.',
  'CONG_BO_KHOA_HOC': 'Bài báo, báo cáo khoa học đã công bố (nếu có).',
  'KHAC': 'Giấy tờ khác theo yêu cầu của đợt tuyển sinh.',
};

String docName(String type) => docLabel[type] ?? type;

const degreeLabel = {'THAC_SI': 'Thạc sĩ', 'TIEN_SI': 'Tiến sĩ'};
const eduLabel = {'DAI_HOC': 'Đại học', 'THAC_SI': 'Thạc sĩ'};
const genderLabel = {'NAM': 'Nam', 'NU': 'Nữ', 'KHAC': 'Khác'};

const languageOptions = <String, (String, String)>{
  'CERTIFICATE': ('Đã có chứng chỉ ngoại ngữ', 'Chứng chỉ đạt chuẩn đầu vào, còn hạn 2 năm. Tải chứng chỉ ở bước Minh chứng.'),
  'EXEMPT': ('Thuộc diện được miễn', 'Ví dụ có bằng đại học ngành ngôn ngữ nước ngoài, hoặc học đại học ở nước ngoài / bằng ngoại ngữ.'),
  'TEST': ('Đăng ký dự thi đánh giá năng lực tiếng Anh', 'Do Trường ĐH Khoa học Xã hội và Nhân văn (ĐHQG-HCM) tổ chức. Nộp thêm lệ phí thi.'),
};

const exemptReasons = [
  'Có bằng tốt nghiệp đại học trở lên ngành ngôn ngữ nước ngoài',
  'Có bằng tốt nghiệp đại học trở lên do cơ sở nước ngoài cấp hoặc chương trình học bằng ngoại ngữ',
];

const historyLabel = {
  'DRAFT': 'Tạo hồ sơ nháp',
  'SUBMITTED': 'Nộp hồ sơ',
  'UNDER_REVIEW': 'Cán bộ tiếp nhận thẩm định',
  'NEEDS_SUPPLEMENT': 'Yêu cầu bổ sung minh chứng',
  'APPROVED': 'Đạt thẩm định hồ sơ',
  'REJECTED': 'Không đạt thẩm định hồ sơ',
};

const examFormatLabel = {'THI_VIET': 'Thi viết', 'PHONG_VAN': 'Phỏng vấn', 'XET_HO_SO': 'Xét hồ sơ'};

const announcementCategory = {
  'TUYEN_SINH': 'Tuyển sinh',
  'QUY_DINH': 'Quy định - Quy chế',
  'HUONG_DAN': 'Hướng dẫn',
  'KET_QUA': 'Lịch thi - Kết quả',
};

const complaintTypes = <(String, String)>[
  ('KHIEU_NAI_KET_QUA', 'Khiếu nại kết quả xét tuyển'),
  ('KHIEU_NAI_HO_SO', 'Khiếu nại xử lý hồ sơ'),
  ('PHUC_KHAO_DIEM', 'Phúc khảo kết quả thi đánh giá năng lực tiếng Anh'),
  ('KHAC', 'Khác'),
];

/// Màu + chữ cho một trạng thái — (nền, chữ, nhãn)
typedef Tone = (Color, Color, String);

Tone _tone(String kind, String label) => switch (kind) {
      'success' => (AppColors.success50, AppColors.success, label),
      'danger' => (AppColors.danger50, AppColors.danger, label),
      'warning' => (AppColors.warning50, AppColors.warning, label),
      'info' => (AppColors.info50, AppColors.info, label),
      'accent' => (AppColors.accent50, AppColors.accentDark, label),
      _ => (AppColors.gray100, AppColors.gray600, label),
    };

Tone reviewTone(String s) => switch (s) {
      'DRAFT' => _tone('gray', 'Bản nháp'),
      'SUBMITTED' => _tone('info', 'Đã nộp'),
      'UNDER_REVIEW' => _tone('info', 'Đang thẩm định'),
      'NEEDS_SUPPLEMENT' => _tone('warning', 'Cần bổ sung'),
      'APPROVED' => _tone('success', 'Hồ sơ hợp lệ'),
      'REJECTED' => _tone('danger', 'Không đạt'),
      _ => _tone('gray', s),
    };

Tone admissionTone(String s) => switch (s) {
      'WAITLISTED' => _tone('warning', 'Dự bị'),
      'ADMITTED' => _tone('success', 'Trúng tuyển'),
      'CONFIRMED' => _tone('success', 'Đã xác nhận nhập học'),
      'ENROLLED' => _tone('success', 'Đã nhập học'),
      _ => _tone('gray', 'Chưa có kết quả'),
    };

Tone verifyTone(String s) => switch (s) {
      'VALID' => _tone('success', 'Hợp lệ'),
      'INVALID' => _tone('danger', 'Không hợp lệ'),
      _ => _tone('gray', 'Chờ kiểm tra'),
    };

Tone paymentTone(String s) => switch (s) {
      'SUCCESS' => _tone('success', 'Đã thanh toán'),
      'PENDING' => _tone('warning', 'Chờ thanh toán'),
      'FAILED' => _tone('danger', 'Thất bại'),
      'REFUNDED' => _tone('info', 'Đã hoàn tiền'),
      'EXPIRED' => _tone('gray', 'Hết hạn'),
      _ => _tone('gray', 'Đã hủy'),
    };

Tone complaintTone(String s) => switch (s) {
      'IN_PROGRESS' => _tone('info', 'Đang xử lý'),
      'RESOLVED' => _tone('success', 'Đã giải quyết'),
      'REJECTED' => _tone('gray', 'Không chấp nhận'),
      _ => _tone('warning', 'Đã gửi'),
    };

Tone supervisorTone(String s) => switch (s) {
      'ACCEPTED' => _tone('success', 'Đã đồng ý'),
      'REJECTED' => _tone('danger', 'Từ chối'),
      _ => _tone('warning', 'Chờ phản hồi'),
    };

Tone resultTone(String s, String label) => switch (s) {
      'TRUNG_TUYEN' => _tone('success', label),
      'DU_BI' => _tone('warning', label),
      _ => _tone('danger', label),
    };

Tone englishTone(String? s) => switch (s) {
      'PASSED' => _tone('success', 'Đạt'),
      'FAILED' => _tone('danger', 'Không đạt'),
      'ABSENT' => _tone('gray', 'Vắng thi'),
      _ => _tone('info', 'Chờ kết quả'),
    };
