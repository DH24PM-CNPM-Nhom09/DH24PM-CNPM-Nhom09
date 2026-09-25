// Các model dữ liệu — đặt tên khớp đúng cột trong admission_db (v3),
// đồng bộ với bản web Next.js để Backend chỉ cần làm 1 bộ API dùng chung.

enum ReviewStatus { draft, submitted, underReview, needsSupplement, approved, rejected }

enum AdmissionStatus { none, waitlisted, admitted, confirmed, enrolled }

enum DocumentType {
  vanBang,
  bangDiem,
  chungChiNgoaiNgu,
  deCuongNcs,
  thuGioiThieu,
  congBoKhoaHoc,
  khac,
}

enum VerifyStatus { pending, valid, invalid }

enum SupervisorRequestStatus { pending, accepted, rejected }

enum DegreeLevel { thacSi, tienSi }

enum Gender { nam, nu, khac }

String reviewStatusLabel(ReviewStatus s) => switch (s) {
      ReviewStatus.draft => 'Nháp',
      ReviewStatus.submitted => 'Đã nộp',
      ReviewStatus.underReview => 'Đang thẩm định',
      ReviewStatus.needsSupplement => 'Chờ bổ sung',
      ReviewStatus.approved => 'Đạt thẩm định',
      ReviewStatus.rejected => 'Không đạt',
    };

String admissionStatusLabel(AdmissionStatus s) => switch (s) {
      AdmissionStatus.none => 'Chưa có kết quả',
      AdmissionStatus.waitlisted => 'Dự bị',
      AdmissionStatus.admitted => 'Trúng tuyển',
      AdmissionStatus.confirmed => 'Đã xác nhận nhập học',
      AdmissionStatus.enrolled => 'Đã nhập học',
    };

String documentTypeLabel(DocumentType t) => switch (t) {
      DocumentType.vanBang => 'Văn bằng',
      DocumentType.bangDiem => 'Bảng điểm',
      DocumentType.chungChiNgoaiNgu => 'Chứng chỉ ngoại ngữ',
      DocumentType.deCuongNcs => 'Đề cương nghiên cứu sinh',
      DocumentType.thuGioiThieu => 'Thư giới thiệu',
      DocumentType.congBoKhoaHoc => 'Công bố khoa học',
      DocumentType.khac => 'Khác',
    };

class Candidate {
  final int candidateId;
  final String fullName;
  final String dob; // yyyy-MM-dd
  final Gender? gender;
  final String? idNumber; // CCCD/CMND
  final String? address;
  final String? email;
  final String? phoneNumber;

  Candidate({
    required this.candidateId,
    required this.fullName,
    required this.dob,
    this.gender,
    this.idNumber,
    this.address,
    this.email,
    this.phoneNumber,
  });

  Candidate copyWith({
    String? fullName,
    String? dob,
    Gender? gender,
    String? idNumber,
    String? address,
    String? email,
    String? phoneNumber,
  }) {
    return Candidate(
      candidateId: candidateId,
      fullName: fullName ?? this.fullName,
      dob: dob ?? this.dob,
      gender: gender ?? this.gender,
      idNumber: idNumber ?? this.idNumber,
      address: address ?? this.address,
      email: email ?? this.email,
      phoneNumber: phoneNumber ?? this.phoneNumber,
    );
  }
}

class Application {
  final int applicationId;
  final String applicationCode;
  final ReviewStatus reviewStatus;
  final AdmissionStatus admissionStatus;
  final String batchName;
  final String majorName;
  final DegreeLevel degreeLevel;
  final String? submittedAt;

  Application({
    required this.applicationId,
    required this.applicationCode,
    required this.reviewStatus,
    required this.admissionStatus,
    required this.batchName,
    required this.majorName,
    required this.degreeLevel,
    this.submittedAt,
  });
}

class ApplicationDocument {
  final int documentId;
  final DocumentType documentType;
  final String fileName;
  final int fileSizeKb;
  final VerifyStatus verifyStatus;

  ApplicationDocument({
    required this.documentId,
    required this.documentType,
    required this.fileName,
    required this.fileSizeKb,
    required this.verifyStatus,
  });
}

class SupervisorRequest {
  final int requestId;
  final String lecturerName;
  final String facultyName;
  final SupervisorRequestStatus status;
  final String requestedAt;

  SupervisorRequest({
    required this.requestId,
    required this.lecturerName,
    required this.facultyName,
    required this.status,
    required this.requestedAt,
  });
}

class ApiException implements Exception {
  final String errorCode;
  final String message;
  ApiException(this.errorCode, this.message);
  @override
  String toString() => message;
}
