// ============================================================================
// Lớp gọi API — nhóm Backend chỉ cần implement đúng các hàm bên dưới theo
// path /api/v1/... là app chạy được ngay với dữ liệu thật, không cần sửa gì
// thêm ở app. Cùng bộ API với bản web (src/lib/api.ts) — Backend chỉ làm 1 lần
// dùng chung cho cả web và mobile.
//
// Đang chạy ở chế độ MOCK (useMock = true): trả dữ liệu giả để demo/dựng giao
// diện trước khi Backend xong. Khi Backend có API thật, đổi useMock = false và
// điền đúng apiBase bên dưới.
// ============================================================================
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/models.dart';

class ApiService {
  static const bool useMock = true;
  static const String apiBase = 'https://YOUR-BACKEND-URL/api/v1';

  String? _token;

  Future<T> _delay<T>(T data, {int ms = 400}) =>
      Future.delayed(Duration(milliseconds: ms), () => data);

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  Future<dynamic> _request(String path,
      {String method = 'GET', Object? body}) async {
    final uri = Uri.parse('$apiBase$path');
    final res = method == 'POST'
        ? await http.post(uri, headers: _headers, body: jsonEncode(body))
        : method == 'PATCH'
            ? await http.patch(uri, headers: _headers, body: jsonEncode(body))
            : await http.get(uri, headers: _headers);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      final decoded = jsonDecode(res.body);
      throw ApiException(
        decoded['error_code'] ?? 'UNKNOWN',
        decoded['message'] ?? 'Đã có lỗi xảy ra',
      );
    }
    return res.body.isEmpty ? null : jsonDecode(res.body);
  }

  // ---- Auth ----
  Future<void> loginWithGoogle(String googleIdToken) async {
    if (useMock) {
      _token = 'mock-token';
      await _delay(null);
      return;
    }
    final res = await _request('/auth/google',
        method: 'POST', body: {'idToken': googleIdToken});
    _token = res['accessToken'];
  }

  Future<void> requestPasswordResetOtp(String emailOrPhone) async {
    if (useMock) return _delay(null);
    await _request('/auth/forgot-password',
        method: 'POST', body: {'emailOrPhone': emailOrPhone});
  }

  Future<void> resetPassword(
      String emailOrPhone, String otp, String newPassword) async {
    if (useMock) return _delay(null);
    await _request('/auth/reset-password',
        method: 'POST',
        body: {
          'emailOrPhone': emailOrPhone,
          'otp': otp,
          'newPassword': newPassword,
        });
  }

  // ---- Candidate profile ----
  Future<Candidate> getMyProfile() async {
    if (useMock) {
      return _delay(Candidate(
        candidateId: 1,
        fullName: 'Nguyễn Văn A',
        dob: '2001-05-12',
        gender: Gender.nam,
        idNumber: '089201001234',
        address: '123 Trần Hưng Đạo, P. Mỹ Xuyên, Long Xuyên, An Giang',
        email: 'nguyenvana@gmail.com',
        phoneNumber: '0909000456',
      ));
    }
    final r = await _request('/candidates/me');
    return Candidate(
      candidateId: r['candidateId'],
      fullName: r['fullName'],
      dob: r['dob'],
      idNumber: r['idNumber'],
      address: r['address'],
      email: r['email'],
      phoneNumber: r['phoneNumber'],
    );
  }

  Future<void> updateMyProfile(Candidate c) async {
    if (useMock) return _delay(null);
    await _request('/candidates/me', method: 'PATCH', body: {
      'fullName': c.fullName,
      'dob': c.dob,
      'gender': c.gender?.name,
      'idNumber': c.idNumber,
      'address': c.address,
      'email': c.email,
      'phoneNumber': c.phoneNumber,
    });
  }

  // ---- Applications ----
  Future<Application?> getMyApplication() async {
    if (useMock) {
      return _delay(Application(
        applicationId: 1,
        applicationCode: 'HS2027-00458',
        reviewStatus: ReviewStatus.underReview,
        admissionStatus: AdmissionStatus.none,
        batchName: 'Đợt tuyển sinh 2027',
        majorName: 'Khoa học Máy tính',
        degreeLevel: DegreeLevel.tienSi,
        submittedAt: '2026-09-10T08:00:00Z',
      ));
    }
    final r = await _request('/applications/me');
    if (r == null) return null;
    return Application(
      applicationId: r['applicationId'],
      applicationCode: r['applicationCode'],
      reviewStatus: ReviewStatus.values.byName(r['reviewStatus']),
      admissionStatus: AdmissionStatus.values.byName(r['admissionStatus']),
      batchName: r['batchName'],
      majorName: r['majorName'],
      degreeLevel: r['degreeLevel'],
      submittedAt: r['submittedAt'],
    );
  }

  Future<List<ApplicationDocument>> getMyDocuments() async {
    if (useMock) {
      return _delay([
        ApplicationDocument(
            documentId: 1,
            documentType: DocumentType.vanBang,
            fileName: 'van_bang_thac_si.pdf',
            fileSizeKb: 1200,
            verifyStatus: VerifyStatus.valid),
        ApplicationDocument(
            documentId: 2,
            documentType: DocumentType.bangDiem,
            fileName: 'bang_diem.pdf',
            fileSizeKb: 800,
            verifyStatus: VerifyStatus.valid),
        ApplicationDocument(
            documentId: 3,
            documentType: DocumentType.chungChiNgoaiNgu,
            fileName: 'ielts.pdf',
            fileSizeKb: 400,
            verifyStatus: VerifyStatus.pending),
      ]);
    }
    final r = await _request('/applications/me/documents') as List;
    return r
        .map((d) => ApplicationDocument(
              documentId: d['documentId'],
              documentType: DocumentType.values.byName(d['documentType']),
              fileName: d['fileName'],
              fileSizeKb: d['fileSizeKb'],
              verifyStatus: VerifyStatus.values.byName(d['verifyStatus']),
            ))
        .toList();
  }

  // Giới hạn đúng theo admission_db v3: 5MB/file, tổng <= 30MB/hồ sơ
  // (Backend kiểm tra lại lần cuối bằng trigger trg_document_size_limit).
  static const int maxFileKb = 5120;

  Future<void> uploadDocument(
      int applicationId, String fileName, int fileSizeKb, String documentType) async {
    if (fileSizeKb > maxFileKb) {
      throw ApiException('FILE_TOO_LARGE', 'File vượt quá 5MB, vui lòng chọn file khác.');
    }
    if (useMock) return _delay(null);
    // TODO (tích hợp thật): dùng http.MultipartRequest để upload file thật ở đây.
  }

  // ---- GVHD (bậc Tiến sĩ) ----
  Future<SupervisorRequest?> getMySupervisorRequest() async {
    if (useMock) {
      return _delay(SupervisorRequest(
        requestId: 1,
        lecturerName: 'PGS.TS Trần Văn Long',
        facultyName: 'Khoa Công nghệ Thông tin — Trường Đại học An Giang',
        status: SupervisorRequestStatus.pending,
        requestedAt: '2026-09-10T00:00:00Z',
      ));
    }
    final r = await _request('/applications/me/supervisor-request');
    if (r == null) return null;
    return SupervisorRequest(
      requestId: r['requestId'],
      lecturerName: r['lecturerName'],
      facultyName: r['facultyName'],
      status: SupervisorRequestStatus.values.byName(r['status']),
      requestedAt: r['requestedAt'],
    );
  }

  // ---- Khiếu nại / Phúc khảo ----
  Future<void> submitComplaint(
      String type, String applicationCode, String content) async {
    if (useMock) return _delay(null);
    await _request('/complaints', method: 'POST', body: {
      'type': type,
      'applicationCode': applicationCode,
      'content': content,
    });
  }
}

final apiService = ApiService();
