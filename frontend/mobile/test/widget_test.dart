import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tuyensinh_mobile/main.dart';
import 'package:tuyensinh_mobile/models/models.dart';
import 'package:tuyensinh_mobile/services/api_client.dart';
import 'package:tuyensinh_mobile/services/pdf_service.dart';
import 'package:tuyensinh_mobile/utils/cccd.dart';
import 'package:tuyensinh_mobile/utils/format.dart';
import 'package:tuyensinh_mobile/utils/vietqr.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Chưa đăng nhập: mở màn hình Đăng nhập', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await api.load();
    await tester.pumpWidget(const TuyenSinhApp());
    await tester.pumpAndSettle();
    expect(find.text('Đăng nhập'), findsWidgets);
    expect(find.text('Tạo tài khoản thí sinh'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  group('VietQR — khớp đúng chuỗi do bản web tạo', () {
    test('có số tiền và nội dung', () {
      expect(
        vietQrPayload(bin: '970405', accountNo: '6703 2050 12345', amount: 460000, note: 'THS-2026-8480101-00012 Nguyễn Văn Đức'),
        '00020101021238570010A00000072701270006970405011367032050123450208QRIBFTTA530370454064600005802VN'
        '62290825THS2026848010100012 Nguye6304ABD1',
      );
    });
    test('không số tiền', () {
      expect(vietQrPayload(bin: '970436', accountNo: '0011004', note: ''),
          '00020101021138510010A00000072701210006970436010700110040208QRIBFTTA53037045802VN6304A57A');
    });
    test('bỏ dấu nội dung chuyển khoản', () {
      expect(cleanTransferNote('Lệ phí Đức ĐẶNG 2026'), 'Le phi Duc DANG 2026');
    });
  });

  group('Đọc QR CCCD', () {
    test('đủ trường', () {
      final f = parseCccdQr('089201001234|352123456|Nguyễn Văn An|12052001|Nam|Số 1, P. Mỹ Xuyên, Long Xuyên, An Giang|15082021')!;
      expect(f.idNumber, '089201001234');
      expect(f.oldIdNumber, '352123456');
      expect(f.dob, '2001-05-12');
      expect(f.gender, 'NAM');
      expect(f.idIssueDate, '2021-08-15');
    });
    test('nữ, không có CMND cũ', () {
      final f = parseCccdQr('089301009999||Trần Thị Bé|01012000|Nữ|An Giang|29022024')!;
      expect(f.gender, 'NU');
      expect(f.oldIdNumber, isNull);
      expect(f.idIssueDate, '2024-02-29');
    });
    test('không phải CCCD', () {
      expect(parseCccdQr('https://example.com'), isNull);
      expect(toIsoDate('31022020'), isNull);
    });
  });

  group('Định dạng', () {
    test('tiền, điểm, ngày giờ VN', () {
      expect(fmtMoney(1100000), '1.100.000 đ');
      expect(fmtMoney(0), '0 đ');
      expect(fmtScore(7.25), '7,25');
      expect(fmtScore(8), '8');
      expect(fmtDate('2026-10-21'), '21/10/2026');
      expect(fmtDateTime('2026-10-21T01:30:00.000Z'), '08:30 21/10/2026');
      expect(foldVi('Nguyễn Văn Đức'), 'NGUYEN VAN DUC');
    });
  });

  test('Đọc JSON hồ sơ đầy đủ (GET /applications/me/full)', () {
    final a = FullApplication.fromJson({
      'applicationId': 12,
      'applicationCode': 'THS-2026-8480101-00012',
      'reviewStatus': 'APPROVED',
      'admissionStatus': 'ADMITTED',
      'createdAt': '2026-09-01T00:00:00Z',
      'submittedAt': '2026-09-02T00:00:00Z',
      'degreeLevel': 'THAC_SI',
      'batch': {'batchId': 1, 'batchCode': 'THS-2026', 'batchName': 'Đợt 2026', 'status': 'OPEN', 'registrationEndAt': '2026-12-01T00:00:00Z', 'examStartAt': null},
      'major': {'batchMajorId': 3, 'majorCode': '8480101', 'majorName': 'Khoa học máy tính', 'facultyName': 'CNTT'},
      'education': {'degreeLevel': 'DAI_HOC', 'institutionName': 'ĐH An Giang', 'majorName': 'CNTT', 'graduationYear': 2024, 'gpa': 3.2, 'gpaScale': 4},
      'proposal': null,
      'documents': [
        {'documentId': 5, 'documentType': 'CCCD', 'fileName': 'cccd.pdf', 'fileSizeKb': 300, 'verifyStatus': 'VALID'}
      ],
      'requiredDocuments': ['CCCD', 'VAN_BANG'],
      'optionalDocuments': ['KHAC'],
      'missingDocuments': ['VAN_BANG'],
      'language': {'option': 'TEST', 'note': null, 'requiredLevel': 'bậc 3/6 (B1)'},
      'englishTest': null,
      'payment': {
        'amount': 580000,
        'status': 'PENDING',
        'method': 'BANK_TRANSFER',
        'receiptNo': null,
        'paidAt': null,
        'transferContent': 'THS20268480101',
        'bank': {'bankBin': '970405', 'bankName': 'Agribank', 'accountNo': '123', 'accountName': 'TRUONG DH AN GIANG'}
      },
      'supplement': null,
      'history': [
        {'status': 'SUBMITTED', 'at': '2026-09-02T00:00:00Z', 'by': 'CANDIDATE', 'reason': null}
      ],
      'canEdit': false,
      'fee': 580000,
      'feeItems': [
        {'code': 'REGISTRATION', 'label': 'Lệ phí', 'amount': 100000}
      ],
      'otherFees': {'supplementCredit': 490000, 'appeal': 360000, 'englishTest': 120000},
      'admission': {
        'interviewLabel': 'Phỏng vấn',
        'hasInterview': true,
        'interview': null,
        'scores': {
          'publishedAt': '2026-10-01T00:00:00Z',
          'items': [
            {'subjectId': 1, 'subjectName': 'Xét hồ sơ', 'weight': 0.6, 'score': 8.5, 'absent': false, 'appeal': null}
          ],
          'total': 8.1,
          'appealDeadline': null,
          'canAppeal': false,
          'appealFee': 360000,
          'appeal': null
        },
        'result': {'result': 'TRUNG_TUYEN', 'label': 'Trúng tuyển', 'rank': 2, 'total': 8.1, 'benchmark': 6.5, 'quota': 10, 'waitlistRank': null, 'promoted': false, 'publishedAt': '2026-10-05T00:00:00Z'},
        'enrollment': {'decisionNo': '123/QĐ-ĐHAG', 'decisionDate': '2026-10-10', 'signedAt': '2026-10-10T00:00:00Z', 'status': 'CHUA_XAC_NHAN', 'deadline': '2026-10-30T00:00:00Z', 'confirmedAt': null, 'canConfirm': true, 'canDecline': true, 'originals': null, 'studentCode': null, 'completedAt': null}
      },
      'declined': false,
      'declarationConfirmedAt': '2026-09-01T00:00:00Z',
    });
    expect(a.payment!.bank.bankBin, '970405');
    expect(a.admission!.enrollment!.canConfirm, isTrue);
    expect(a.admission!.scores!.items.single.weight, 0.6);
    expect(a.docsOf('CCCD').single.verifyStatus, 'VALID');
    expect(a.englishTestFee, 120000);
  });

  test('Tạo được PDF giấy báo (có dấu tiếng Việt)', () async {
    final bytes = await PdfService.admissionLetter(const LetterData(
      fullName: 'Nguyễn Văn Đức',
      dob: '2001-05-12',
      gender: 'NAM',
      idNumber: '089201001234',
      applicationCode: 'THS-2026-8480101-00012',
      degreeLevel: 'THAC_SI',
      batchName: 'Đợt 2 năm 2026',
      majorName: 'Khoa học máy tính',
      majorCode: '8480101',
      total: 8.1,
      decisionNo: '123/QĐ-ĐHAG',
      decisionDate: '2026-10-10',
      deadline: '2026-10-30T10:00:00Z',
      confirmedAt: null,
      studentCode: null,
    ));
    expect(bytes.length, greaterThan(10000));
    expect(String.fromCharCodes(bytes.take(4)), '%PDF');
  });
}
