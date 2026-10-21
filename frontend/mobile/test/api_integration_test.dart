// Kiểm thử tích hợp với backend THẬT (chỉ chạy khi có biến môi trường API_BASE_TEST), ví dụ:
//   API_BASE_TEST=http://localhost:4000/api/v1 flutter test test/api_integration_test.dart
// Backend chạy ở chế độ thử (DEV_AUTH_BYPASS=true, chưa cấu hình gửi email) nên mã OTP trả về trong phản hồi,
// KHÔNG gửi email thật tới địa chỉ thử nghiệm.
import 'dart:io';
import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tuyensinh_mobile/services/api_client.dart';
import 'package:tuyensinh_mobile/services/api_service.dart';

// PDF 1 trang tối thiểu hợp lệ
const _pdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n';

void main() {
  final base = Platform.environment['API_BASE_TEST'];
  if (base == null) {
    test('bỏ qua (chưa đặt API_BASE_TEST)', () {});
    return;
  }

  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    await api.load();
    await api.setApiBase(base);
  });

  test('Thí sinh mới: đăng ký → xác thực → làm hồ sơ → nộp → lệ phí', () async {
    final s = apiService;
    final n = Random().nextInt(900000) + 100000;
    final email = 'mobile.test$n@example.test';
    final phone = '09${n.toString().padLeft(8, '0')}';

    final sent = await s.register(fullName: 'Lê Thị Kiểm Thử', dob: '2000-02-03', email: email, phoneNumber: phone, password: 'Thu12345');
    expect(sent.devOtp, isNotNull, reason: 'Backend thử nghiệm phải trả devOtp (không gửi email)');
    await s.verifyRegistration(email, sent.devOtp!);
    expect(api.isLoggedIn, isTrue);

    final p = await s.getProfile();
    expect(p.fullName, 'Lê Thị Kiểm Thử');
    expect(await s.getFullApplication(), isNull);

    final batches = await s.getOpenBatches();
    final batch = batches.firstWhere((b) => b.degreeLevel == 'THAC_SI');
    final major = batch.majors.first;

    var a = await s.saveDraft(batchMajorId: major.batchMajorId, education: {
      'degreeLevel': 'DAI_HOC',
      'institutionName': 'Trường Đại học An Giang',
      'majorName': 'Công nghệ thông tin',
      'graduationYear': 2023,
      'gpa': 3.4,
      'gpaScale': 4,
    });
    expect(a.isDraft, isTrue);
    expect(a.major.batchMajorId, major.batchMajorId);

    a = await s.saveLanguage('TEST', '');
    expect(a.language.option, 'TEST');
    expect(a.feeItems.any((f) => f.code == 'ENGLISH_TEST'), isTrue);

    // Giới tính bắt buộc trước khi nộp
    await s.updateProfile({'gender': 'NU'});

    a = await s.saveDeclaration({
      'idNumber': '0893${n.toString().padLeft(8, '0')}',
      'idIssueDate': '2021-08-15',
      'idIssuePlace': 'Cục Cảnh sát quản lý hành chính về trật tự xã hội',
      'birthplace': 'An Giang',
      'ethnicity': 'Kinh',
      'phoneNumber': phone,
      'permanentAddress': 'Số 18 Ung Văn Khiêm, Long Xuyên, An Giang',
      'address': 'Số 18 Ung Văn Khiêm, Long Xuyên, An Giang',
      'confirm': true,
    });
    expect(a.declarationConfirmedAt, isNotNull);

    // Tải đủ minh chứng bắt buộc (PDF mẫu, mỗi tệp khác nội dung để tránh cảnh báo trùng)
    for (final t in a.requiredDocuments) {
      final dup = await s.uploadDocument(
        applicationId: a.applicationId,
        documentType: t,
        bytes: '$_pdf% $t\n'.codeUnits,
        fileName: '${t.toLowerCase()}.pdf',
        mimeType: 'application/pdf',
      );
      expect(dup, isFalse);
    }
    a = (await s.getFullApplication())!;
    expect(a.missingDocuments, isEmpty);

    // Tải ảnh PNG cho minh chứng không bắt buộc rồi xóa
    final png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...List.filled(64, 0)];
    await s.uploadDocument(applicationId: a.applicationId, documentType: 'KHAC', bytes: png, fileName: 'khac.png', mimeType: 'image/png');
    a = (await s.getFullApplication())!;
    final extra = a.docsOf('KHAC').single;
    await s.deleteDocument(extra.documentId);
    a = (await s.getFullApplication())!;
    expect(a.docsOf('KHAC'), isEmpty);

    // Tệp sai định dạng bị từ chối với thông báo tiếng Việt
    await expectLater(
      s.uploadDocument(applicationId: a.applicationId, documentType: 'KHAC', bytes: 'xin chao'.codeUnits, fileName: 'a.pdf', mimeType: 'application/pdf'),
      throwsA(isA<ApiException>()),
    );

    await s.submitApplication();
    a = (await s.getFullApplication())!;
    expect(a.reviewStatus, 'SUBMITTED');
    expect(a.payment, isNotNull);
    expect(a.payment!.amount, a.fee);
    expect(a.payment!.transferContent, isNotEmpty);

    final notes = await s.getNotifications();
    expect(notes, isNotEmpty);
    await s.markAllNotificationsRead();
    expect((await s.getNotifications()).every((x) => x.isRead), isTrue);

    await s.submitComplaint(type: 'KHAC', applicationCode: a.applicationCode, content: 'Kiểm thử gửi khiếu nại từ ứng dụng di động (tự động).');
    final mine = await s.getComplaints();
    expect(mine.first.applicationCode, a.applicationCode);

    final sup = await s.getSupervisors();
    expect(sup.state, 'MASTER');

    await s.logout();
    expect(api.isLoggedIn, isFalse);
    await s.login(email, 'Thu12345');
    expect(api.isLoggedIn, isTrue);
  });

  test('Sai mật khẩu → thông báo lỗi tiếng Việt', () async {
    await apiService.logout();
    try {
      await apiService.login('khongtontai@example.test', 'Sai12345');
      fail('phải lỗi');
    } on ApiException catch (e) {
      expect(e.code, 'INVALID_CREDENTIALS');
      expect(e.message, contains('không đúng'));
    }
  });

  test('Thông báo công khai + đợt đang mở (không cần đăng nhập)', () async {
    await apiService.logout();
    final list = await apiService.getAnnouncements();
    expect(list, isNotEmpty);
    final one = await apiService.getAnnouncement(list.first.announcementId);
    expect(one.content, isNotNull);
    final b = await apiService.getOpenBatches();
    expect(b.first.majors.first.subjects, isNotEmpty);
  });

  test('Thí sinh đã trúng tuyển: điểm, kết quả, quyết định, phúc khảo, xác nhận nhập học', () async {
    final email = Platform.environment['ADMITTED_EMAIL'];
    if (email == null) return;
    await apiService.login(email, 'Demo@123');
    var a = (await apiService.getFullApplication())!;
    final ad = a.admission!;
    expect(ad.scores!.items.length, 2);
    expect(ad.result!.result, 'TRUNG_TUYEN');
    expect(ad.enrollment!.canConfirm, isTrue);

    await apiService.fileScoreAppeal([ad.scores!.items.first.subjectId], 'Em đề nghị chấm lại phần đánh giá hồ sơ học thuật vì có minh chứng bổ sung.');
    a = (await apiService.getFullApplication())!;
    expect(a.admission!.scores!.appeal!.status, 'CHO_NOP_PHI');

    await apiService.confirmEnrollment();
    a = (await apiService.getFullApplication())!;
    expect(a.admission!.enrollment!.status, 'DA_XAC_NHAN');
  });

  test('Thí sinh cần bổ sung: tải lại minh chứng và gửi lại', () async {
    final email = Platform.environment['SUPPLEMENT_EMAIL'];
    if (email == null) return;
    await apiService.login(email, 'Demo@123');
    var a = (await apiService.getFullApplication())!;
    expect(a.reviewStatus, 'NEEDS_SUPPLEMENT');
    expect(a.supplement, isNotNull);
    final type = a.documents.where((d) => d.verifyStatus == 'INVALID').map((d) => d.documentType).firstOrNull ??
        a.requiredDocuments.first;
    await apiService.uploadDocument(
        applicationId: a.applicationId, documentType: type, bytes: '$_pdf% bo sung\n'.codeUnits, fileName: 'bo-sung.pdf', mimeType: 'application/pdf');
    await apiService.submitSupplement();
    a = (await apiService.getFullApplication())!;
    expect(a.reviewStatus, 'UNDER_REVIEW');
  });
}
