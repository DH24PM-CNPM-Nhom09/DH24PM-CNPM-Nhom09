// Các hàm gọi API của cổng thí sinh — cùng đường dẫn với bản web (src/lib/api.ts),
// backend NestJS dùng chung cho cả web và mobile.
import '../models/models.dart';
import 'api_client.dart';

Map<String, dynamic> _map(dynamic v) => v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
List<Map<String, dynamic>> _list(dynamic v) =>
    v is List ? v.map((e) => Map<String, dynamic>.from(e as Map)).toList() : <Map<String, dynamic>>[];

class ApiService {
  // ------------------------------------------------------------ đăng nhập / đăng ký
  Future<void> login(String emailOrPhone, String password) async {
    final res = _map(await api.post('/auth/login', {'emailOrPhone': emailOrPhone.trim(), 'password': password}));
    await api.saveToken(res['accessToken'].toString());
  }

  Future<OtpSent> register({
    required String fullName,
    required String dob,
    required String email,
    required String phoneNumber,
    required String password,
  }) async {
    final res = await api.post('/auth/register', {
      'fullName': fullName,
      'dob': dob,
      'email': email,
      'phoneNumber': phoneNumber,
      'password': password,
      'agreePrivacy': true,
    });
    return OtpSent.fromJson(_map(res));
  }

  Future<void> verifyRegistration(String email, String otp) async {
    final res = _map(await api.post('/auth/register/verify', {'email': email, 'otp': otp}));
    await api.saveToken(res['accessToken'].toString());
  }

  Future<OtpSent> resendRegistrationOtp(String email) async =>
      OtpSent.fromJson(_map(await api.post('/auth/register/resend', {'email': email})));

  Future<OtpSent> requestPasswordReset(String emailOrPhone) async =>
      OtpSent.fromJson(_map(await api.post('/auth/forgot-password', {'emailOrPhone': emailOrPhone.trim()})));

  Future<void> resetPassword(String emailOrPhone, String otp, String newPassword) =>
      api.post('/auth/reset-password', {'emailOrPhone': emailOrPhone.trim(), 'otp': otp, 'newPassword': newPassword});

  Future<void> logout() => api.clearToken();

  // ------------------------------------------------------------ thông tin cá nhân
  Future<Candidate> getProfile() async => Candidate.fromJson(_map(await api.get('/candidates/me')));

  Future<void> updateProfile(Map<String, dynamic> data) => api.patch('/candidates/me', data);

  // ------------------------------------------------------------ hồ sơ xét tuyển
  /// Hồ sơ hiện tại (kể cả bản nháp); null = chưa có hồ sơ
  Future<FullApplication?> getFullApplication() async {
    final res = await api.get('/applications/me/full');
    return res is Map ? FullApplication.fromJson(_map(res)) : null;
  }

  Future<List<OpenBatch>> getOpenBatches() async =>
      _list(await api.get('/public/open-batches')).map(OpenBatch.fromJson).toList();

  Future<List<Lecturer>> getLecturers() async =>
      _list(await api.get('/lecturers')).map(Lecturer.fromJson).toList();

  /// Bước chọn ngành + quá trình đào tạo: tạo nháp lần đầu, các lần sau cập nhật
  Future<FullApplication> saveDraft({required int batchMajorId, required Map<String, dynamic> education}) async =>
      FullApplication.fromJson(
          _map(await api.post('/applications/me/draft', {'batchMajorId': batchMajorId, 'education': education})));

  Future<FullApplication> saveLanguage(String option, String note) async =>
      FullApplication.fromJson(_map(await api.put('/applications/me/language', {'option': option, 'note': note})));

  Future<FullApplication> saveDeclaration(Map<String, dynamic> payload) async =>
      FullApplication.fromJson(_map(await api.put('/applications/me/declaration', payload)));

  Future<FullApplication> saveProposal({
    required String researchTopic,
    required String researchField,
    int? preferredLecturerId,
  }) async =>
      FullApplication.fromJson(_map(await api.put('/applications/me/proposal', {
        'researchTopic': researchTopic,
        'researchField': researchField,
        'preferredLecturerId': preferredLecturerId,
      })));

  /// Tải 1 minh chứng; trả về duplicateWarning nếu trùng nội dung tệp đã nộp
  Future<bool> uploadDocument({
    required int applicationId,
    required String documentType,
    required List<int> bytes,
    required String fileName,
    required String mimeType,
  }) async {
    final res = _map(await api.upload(
      '/applications/$applicationId/documents',
      bytes: bytes,
      fileName: fileName,
      mimeType: mimeType,
      fields: {'documentType': documentType},
    ));
    return res['duplicateWarning'] == true;
  }

  Future<void> deleteDocument(int documentId) => api.delete('/applications/me/documents/$documentId');

  Future<void> submitApplication() => api.post('/applications/me/submit', {'agree': true});

  Future<void> cancelDraft() => api.post('/applications/me/cancel');

  /// Báo đã nộp lại đủ minh chứng được yêu cầu bổ sung
  Future<void> submitSupplement() => api.post('/applications/me/supplement');

  // ------------------------------------------------------------ xét tuyển & nhập học
  Future<void> fileScoreAppeal(List<int> subjectIds, String reason) =>
      api.post('/applications/me/appeal', {'subjectIds': subjectIds, 'reason': reason});

  Future<void> confirmEnrollment() => api.post('/applications/me/enrollment/confirm');

  Future<void> declineEnrollment(String reason) =>
      api.post('/applications/me/enrollment/decline', {'reason': reason});

  // ------------------------------------------------------------ thông báo
  Future<List<CandidateNotification>> getNotifications() async =>
      _list(await api.get('/notifications/me')).map(CandidateNotification.fromJson).toList();

  Future<void> markNotificationRead(int id) => api.patch('/notifications/$id/read');

  Future<void> markAllNotificationsRead() => api.patch('/notifications/me/read-all');

  Future<List<Announcement>> getAnnouncements({String? category, int page = 1, int pageSize = 20}) async {
    final q = <String>['page=$page', 'pageSize=$pageSize', if (category != null && category.isNotEmpty) 'category=$category'];
    final res = _map(await api.get('/public/announcements?${q.join('&')}'));
    return _list(res['items']).map(Announcement.fromJson).toList();
  }

  Future<Announcement> getAnnouncement(int id) async =>
      Announcement.fromJson(_map(await api.get('/public/announcements/$id')));

  // ------------------------------------------------------------ khiếu nại
  Future<List<Complaint>> getComplaints() async =>
      _list(await api.get('/complaints/me')).map(Complaint.fromJson).toList();

  Future<void> submitComplaint({required String type, required String applicationCode, required String content}) =>
      api.post('/complaints', {'type': type, 'applicationCode': applicationCode, 'content': content});

  // ------------------------------------------------------------ giảng viên hướng dẫn (tiến sĩ)
  Future<SupervisorOverview> getSupervisors() async =>
      SupervisorOverview.fromJson(_map(await api.get('/supervisors/me')));

  Future<SupervisorOverview> requestSupervisor(int lecturerId) async =>
      SupervisorOverview.fromJson(_map(await api.post('/supervisors/me/request', {'lecturerId': lecturerId})));
}

final apiService = ApiService();
