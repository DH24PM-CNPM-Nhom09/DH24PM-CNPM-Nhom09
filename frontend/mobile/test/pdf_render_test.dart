import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:tuyensinh_mobile/models/models.dart';
import 'package:tuyensinh_mobile/services/pdf_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('xuất PDF ra tệp để xem', () async {
    final out = Platform.environment['PDF_OUT'];
    if (out == null) return;
    final l = await PdfService.admissionLetter(const LetterData(
      fullName: 'Nguyễn Văn Đức', dob: '2001-05-12', gender: 'NAM', idNumber: '089201001234',
      applicationCode: 'THS-2026-8480101-00012', degreeLevel: 'THAC_SI', batchName: 'Đợt 2 năm 2026',
      majorName: 'Khoa học máy tính', majorCode: '8480101', total: 8.1, decisionNo: '123/QĐ-ĐHAG',
      decisionDate: '2026-10-10', deadline: '2026-10-30T10:00:00Z', confirmedAt: '2026-10-20T03:00:00Z', studentCode: null));
    File('$out/letter.pdf').writeAsBytesSync(l);
    final b = OpenBatch.fromJson({
      'batchId': 1, 'batchCode': 'THS-2026-D2', 'batchName': 'Tuyển sinh thạc sĩ đợt 2 năm 2026', 'degreeLevel': 'THAC_SI',
      'registrationStartAt': '2026-09-01T00:00:00Z', 'registrationEndAt': '2026-11-30T10:00:00Z', 'examStartAt': '2026-12-10', 'examEndAt': '2026-12-12',
      'legalBasis': 'Thông tư 23/2021/TT-BGDĐT',
      'majors': [
        {'batchMajorId': 1, 'majorCode': '8480101', 'majorName': 'Khoa học máy tính', 'facultyName': 'Khoa Công nghệ thông tin', 'quota': 20,
         'conditions': [{'description': 'Tốt nghiệp đại học ngành phù hợp', 'minGpa': 2.5, 'requiredCertificate': null, 'isMandatory': true}],
         'subjects': [{'subjectName': 'Xét hồ sơ', 'examFormat': 'XET_HO_SO', 'weight': 0.4}, {'subjectName': 'Phỏng vấn chuyên môn', 'examFormat': 'PHONG_VAN', 'weight': 0.6}]},
      ],
    });
    File('$out/conditions.pdf').writeAsBytesSync(await PdfService.conditions(b));
  });
}
