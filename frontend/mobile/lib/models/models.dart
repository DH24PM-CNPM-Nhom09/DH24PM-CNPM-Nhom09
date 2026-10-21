// Kiểu dữ liệu khớp đúng JSON backend trả về (giống src/lib/types.ts của bản web),
// để web và mobile dùng chung một bộ API.

// ---------------------------------------------------------------- tiện ích đọc JSON
Map<String, dynamic> _m(dynamic v) => v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
List<dynamic> _l(dynamic v) => v is List ? v : const [];
String _s(dynamic v, [String d = '']) => v == null ? d : v.toString();
String? _sn(dynamic v) => v?.toString();
int _i(dynamic v, [int d = 0]) => v is num ? v.toInt() : int.tryParse(_s(v)) ?? d;
int? _in(dynamic v) => v == null ? null : (v is num ? v.toInt() : int.tryParse(v.toString()));
double? _dn(dynamic v) => v == null ? null : (v is num ? v.toDouble() : double.tryParse(v.toString()));
bool _b(dynamic v) => v == true;
List<String> _ls(dynamic v) => _l(v).map((e) => e.toString()).toList();

// ---------------------------------------------------------------- thí sinh
class Candidate {
  final int? candidateId;
  final String fullName;
  final String dob; // yyyy-mm-dd
  final String? gender; // NAM | NU | KHAC
  final String? idNumber;
  final String? address;
  final String? email;
  final String? phoneNumber;
  final String nationality;
  final String? idIssueDate;
  final String? idIssuePlace;
  final String? birthplace;
  final String? ethnicity;
  final String? permanentAddress;
  final String? accountCreatedAt;
  final bool hasPassword;

  Candidate.fromJson(Map<String, dynamic> j)
      : candidateId = _in(j['candidateId']),
        fullName = _s(j['fullName']),
        dob = _s(j['dob']),
        gender = _sn(j['gender']),
        idNumber = _sn(j['idNumber']),
        address = _sn(j['address']),
        email = _sn(j['email']),
        phoneNumber = _sn(j['phoneNumber']),
        nationality = _s(j['nationality'], 'Việt Nam'),
        idIssueDate = _sn(j['idIssueDate']),
        idIssuePlace = _sn(j['idIssuePlace']),
        birthplace = _sn(j['birthplace']),
        ethnicity = _sn(j['ethnicity']),
        permanentAddress = _sn(j['permanentAddress']),
        accountCreatedAt = _sn(j['accountCreatedAt']),
        hasPassword = _b(j['hasPassword']);
}

class OtpSent {
  final String? email;
  final bool emailSent;
  final int expiresInMinutes;
  final int resendAfterSeconds;
  final String? devOtp;

  OtpSent.fromJson(Map<String, dynamic> j)
      : email = _sn(j['email']),
        emailSent = j['emailSent'] != false,
        expiresInMinutes = _i(j['expiresInMinutes'], 5),
        resendAfterSeconds = _i(j['resendAfterSeconds'], 60),
        devOtp = _sn(j['devOtp']);
}

// ---------------------------------------------------------------- hồ sơ xét tuyển
class AppDocument {
  final int documentId;
  final String documentType;
  final String fileName;
  final int fileSizeKb;
  final String verifyStatus; // PENDING | VALID | INVALID
  final String? verifyNote;
  final String? uploadedAt;

  AppDocument.fromJson(Map<String, dynamic> j)
      : documentId = _i(j['documentId']),
        documentType = _s(j['documentType']),
        fileName = _s(j['fileName']),
        fileSizeKb = _i(j['fileSizeKb']),
        verifyStatus = _s(j['verifyStatus'], 'PENDING'),
        verifyNote = _sn(j['verifyNote']),
        uploadedAt = _sn(j['uploadedAt']);
}

class BatchRef {
  final int batchId;
  final String batchCode;
  final String batchName;
  final String status;
  final String? registrationEndAt;
  final String? examStartAt;

  BatchRef.fromJson(Map<String, dynamic> j)
      : batchId = _i(j['batchId']),
        batchCode = _s(j['batchCode']),
        batchName = _s(j['batchName']),
        status = _s(j['status']),
        registrationEndAt = _sn(j['registrationEndAt']),
        examStartAt = _sn(j['examStartAt']);
}

class MajorRef {
  final int batchMajorId;
  final String majorCode;
  final String majorName;
  final String? facultyName;

  MajorRef.fromJson(Map<String, dynamic> j)
      : batchMajorId = _i(j['batchMajorId']),
        majorCode = _s(j['majorCode']),
        majorName = _s(j['majorName']),
        facultyName = _sn(j['facultyName']);
}

class Education {
  final String degreeLevel; // DAI_HOC | THAC_SI
  final String institutionName;
  final String majorName;
  final int graduationYear;
  final double? gpa;
  final int gpaScale;

  Education.fromJson(Map<String, dynamic> j)
      : degreeLevel = _s(j['degreeLevel'], 'DAI_HOC'),
        institutionName = _s(j['institutionName']),
        majorName = _s(j['majorName']),
        graduationYear = _i(j['graduationYear']),
        gpa = _dn(j['gpa']),
        gpaScale = _i(j['gpaScale'], 4);
}

class Proposal {
  final String researchTopic;
  final String? researchField;
  final int? preferredLecturerId;
  final String? lecturerName;
  final String? supervisorStatus;

  Proposal.fromJson(Map<String, dynamic> j)
      : researchTopic = _s(j['researchTopic']),
        researchField = _sn(j['researchField']),
        preferredLecturerId = _in(j['preferredLecturerId']),
        lecturerName = _sn(j['lecturerName']),
        supervisorStatus = _sn(j['supervisorStatus']);
}

class LanguageInfo {
  final String? option; // CERTIFICATE | EXEMPT | TEST
  final String? note;
  final String requiredLevel;

  LanguageInfo.fromJson(Map<String, dynamic> j)
      : option = _sn(j['option']),
        note = _sn(j['note']),
        requiredLevel = _s(j['requiredLevel']);
}

class EnglishTest {
  final String? candidateNumber;
  final int? seatNo;
  final String? sessionCode;
  final String? testAt;
  final String? room;
  final String? location;
  final String? note;
  final String? result; // PENDING | PASSED | FAILED | ABSENT
  final double? score;

  EnglishTest.fromJson(Map<String, dynamic> j)
      : candidateNumber = _sn(j['candidateNumber']),
        seatNo = _in(j['seatNo']),
        sessionCode = _sn(j['sessionCode']),
        testAt = _sn(j['testAt']),
        room = _sn(j['room']),
        location = _sn(j['location']),
        note = _sn(j['note']),
        result = _sn(j['result']),
        score = _dn(j['score']);
}

class BankInfo {
  final String? bankBin;
  final String bankName;
  final String accountNo;
  final String accountName;

  BankInfo.fromJson(Map<String, dynamic> j)
      : bankBin = _sn(j['bankBin']),
        bankName = _s(j['bankName']),
        accountNo = _s(j['accountNo']),
        accountName = _s(j['accountName']);
}

class Payment {
  final double amount;
  final String status; // PENDING | SUCCESS | FAILED | REFUNDED | CANCELLED | EXPIRED
  final String method;
  final String? receiptNo;
  final String? paidAt;
  final String transferContent;
  final BankInfo bank;

  Payment.fromJson(Map<String, dynamic> j)
      : amount = _dn(j['amount']) ?? 0,
        status = _s(j['status'], 'PENDING'),
        method = _s(j['method']),
        receiptNo = _sn(j['receiptNo']),
        paidAt = _sn(j['paidAt']),
        transferContent = _s(j['transferContent']),
        bank = BankInfo.fromJson(_m(j['bank']));
}

class FeeItem {
  final String code;
  final String label;
  final double amount;

  FeeItem.fromJson(Map<String, dynamic> j)
      : code = _s(j['code']),
        label = _s(j['label']),
        amount = _dn(j['amount']) ?? 0;
}

class HistoryItem {
  final String status;
  final String at;
  final String by;
  final String? reason;

  HistoryItem.fromJson(Map<String, dynamic> j)
      : status = _s(j['status']),
        at = _s(j['at']),
        by = _s(j['by']),
        reason = _sn(j['reason']);
}

class Supplement {
  final String content;
  final String deadline;

  Supplement.fromJson(Map<String, dynamic> j)
      : content = _s(j['content']),
        deadline = _s(j['deadline']);
}

// ---------------------------------------------------------------- xét tuyển (phần đã công bố)
class Interview {
  final String scheduledAt;
  final String? location;
  final String committeeName;
  final String status;

  Interview.fromJson(Map<String, dynamic> j)
      : scheduledAt = _s(j['scheduledAt']),
        location = _sn(j['location']),
        committeeName = _s(j['committeeName']),
        status = _s(j['status']);
}

class ScoreAppealInfo {
  final String status;
  final double? oldScore;
  final double? newScore;
  final String? note;

  ScoreAppealInfo.fromJson(Map<String, dynamic> j)
      : status = _s(j['status']),
        oldScore = _dn(j['oldScore']),
        newScore = _dn(j['newScore']),
        note = _sn(j['note']);
}

class ScoreItem {
  final int subjectId;
  final String subjectName;
  final double weight;
  final double? score;
  final bool absent;
  final ScoreAppealInfo? appeal;

  ScoreItem.fromJson(Map<String, dynamic> j)
      : subjectId = _i(j['subjectId']),
        subjectName = _s(j['subjectName']),
        weight = _dn(j['weight']) ?? 0,
        score = _dn(j['score']),
        absent = _b(j['absent']),
        appeal = j['appeal'] is Map ? ScoreAppealInfo.fromJson(_m(j['appeal'])) : null;
}

class AppealRequest {
  final String status; // CHO_NOP_PHI | DA_NOP_PHI | DONG
  final String reason;
  final double feeAmount;
  final String? paidAt;
  final String transferContent;

  AppealRequest.fromJson(Map<String, dynamic> j)
      : status = _s(j['status']),
        reason = _s(j['reason']),
        feeAmount = _dn(j['feeAmount']) ?? 0,
        paidAt = _sn(j['paidAt']),
        transferContent = _s(j['transferContent']);
}

class Scores {
  final String publishedAt;
  final List<ScoreItem> items;
  final double? total;
  final String? appealDeadline;
  final bool canAppeal;
  final double appealFee;
  final AppealRequest? appeal;

  Scores.fromJson(Map<String, dynamic> j)
      : publishedAt = _s(j['publishedAt']),
        items = _l(j['items']).map((e) => ScoreItem.fromJson(_m(e))).toList(),
        total = _dn(j['total']),
        appealDeadline = _sn(j['appealDeadline']),
        canAppeal = _b(j['canAppeal']),
        appealFee = _dn(j['appealFee']) ?? 0,
        appeal = j['appeal'] is Map ? AppealRequest.fromJson(_m(j['appeal'])) : null;
}

class AdmissionResult {
  final String result; // TRUNG_TUYEN | DU_BI | KHONG_TRUNG_TUYEN
  final String label;
  final int? rank;
  final double? total;
  final double? benchmark;
  final int quota;
  final int? waitlistRank;
  final bool promoted;
  final String publishedAt;

  AdmissionResult.fromJson(Map<String, dynamic> j)
      : result = _s(j['result']),
        label = _s(j['label']),
        rank = _in(j['rank']),
        total = _dn(j['total']),
        benchmark = _dn(j['benchmark']),
        quota = _i(j['quota']),
        waitlistRank = _in(j['waitlistRank']),
        promoted = _b(j['promoted']),
        publishedAt = _s(j['publishedAt']);
}

class Enrollment {
  final String? decisionNo;
  final String? decisionDate;
  final String? signedAt;
  final String status; // CHUA_XAC_NHAN | DA_XAC_NHAN | TU_CHOI_QUA_HAN
  final String deadline;
  final String? confirmedAt;
  final bool canConfirm;
  final bool canDecline;
  final String? originals;
  final String? studentCode;
  final String? completedAt;

  Enrollment.fromJson(Map<String, dynamic> j)
      : decisionNo = _sn(j['decisionNo']),
        decisionDate = _sn(j['decisionDate']),
        signedAt = _sn(j['signedAt']),
        status = _s(j['status']),
        deadline = _s(j['deadline']),
        confirmedAt = _sn(j['confirmedAt']),
        canConfirm = _b(j['canConfirm']),
        canDecline = _b(j['canDecline']),
        originals = _sn(j['originals']),
        studentCode = _sn(j['studentCode']),
        completedAt = _sn(j['completedAt']);
}

class AdmissionView {
  final String interviewLabel;
  final bool hasInterview;
  final Interview? interview;
  final Scores? scores;
  final AdmissionResult? result;
  final Enrollment? enrollment;

  AdmissionView.fromJson(Map<String, dynamic> j)
      : interviewLabel = _s(j['interviewLabel'], 'Phỏng vấn'),
        hasInterview = _b(j['hasInterview']),
        interview = j['interview'] is Map ? Interview.fromJson(_m(j['interview'])) : null,
        scores = j['scores'] is Map ? Scores.fromJson(_m(j['scores'])) : null,
        result = j['result'] is Map ? AdmissionResult.fromJson(_m(j['result'])) : null,
        enrollment = j['enrollment'] is Map ? Enrollment.fromJson(_m(j['enrollment'])) : null;
}

class FullApplication {
  final int applicationId;
  final String applicationCode;
  final String reviewStatus;
  final String admissionStatus;
  final String createdAt;
  final String? submittedAt;
  final String degreeLevel; // THAC_SI | TIEN_SI
  final BatchRef batch;
  final MajorRef major;
  final Education? education;
  final Proposal? proposal;
  final List<AppDocument> documents;
  final List<String> requiredDocuments;
  final List<String> optionalDocuments;
  final List<String> missingDocuments;
  final LanguageInfo language;
  final EnglishTest? englishTest;
  final Payment? payment;
  final Supplement? supplement;
  final List<HistoryItem> history;
  final bool canEdit;
  final double fee;
  final List<FeeItem> feeItems;
  final double supplementCreditFee;
  final double appealFee;
  final double englishTestFee;
  final AdmissionView? admission;
  final bool declined;
  final String? declarationConfirmedAt;

  bool get isDraft => reviewStatus == 'DRAFT';
  bool get isDoctoral => degreeLevel == 'TIEN_SI';

  FullApplication.fromJson(Map<String, dynamic> j)
      : applicationId = _i(j['applicationId']),
        applicationCode = _s(j['applicationCode']),
        reviewStatus = _s(j['reviewStatus'], 'DRAFT'),
        admissionStatus = _s(j['admissionStatus'], 'NONE'),
        createdAt = _s(j['createdAt']),
        submittedAt = _sn(j['submittedAt']),
        degreeLevel = _s(j['degreeLevel'], 'THAC_SI'),
        batch = BatchRef.fromJson(_m(j['batch'])),
        major = MajorRef.fromJson(_m(j['major'])),
        education = j['education'] is Map ? Education.fromJson(_m(j['education'])) : null,
        proposal = j['proposal'] is Map ? Proposal.fromJson(_m(j['proposal'])) : null,
        documents = _l(j['documents']).map((e) => AppDocument.fromJson(_m(e))).toList(),
        requiredDocuments = _ls(j['requiredDocuments']),
        optionalDocuments = _ls(j['optionalDocuments']),
        missingDocuments = _ls(j['missingDocuments']),
        language = LanguageInfo.fromJson(_m(j['language'])),
        englishTest = j['englishTest'] is Map ? EnglishTest.fromJson(_m(j['englishTest'])) : null,
        payment = j['payment'] is Map ? Payment.fromJson(_m(j['payment'])) : null,
        supplement = j['supplement'] is Map ? Supplement.fromJson(_m(j['supplement'])) : null,
        history = _l(j['history']).map((e) => HistoryItem.fromJson(_m(e))).toList(),
        canEdit = _b(j['canEdit']),
        fee = _dn(j['fee']) ?? 0,
        feeItems = _l(j['feeItems']).map((e) => FeeItem.fromJson(_m(e))).toList(),
        supplementCreditFee = _dn(_m(j['otherFees'])['supplementCredit']) ?? 0,
        appealFee = _dn(_m(j['otherFees'])['appeal']) ?? 0,
        englishTestFee = _dn(_m(j['otherFees'])['englishTest']) ?? 0,
        admission = j['admission'] is Map ? AdmissionView.fromJson(_m(j['admission'])) : null,
        declined = _b(j['declined']),
        declarationConfirmedAt = _sn(j['declarationConfirmedAt']);

  /// Minh chứng theo từng loại
  List<AppDocument> docsOf(String type) => documents.where((d) => d.documentType == type).toList();
}

// ---------------------------------------------------------------- đợt tuyển sinh đang mở
class MajorCondition {
  final String description;
  final double? minGpa;
  final String? requiredCertificate;
  final bool isMandatory;

  MajorCondition.fromJson(Map<String, dynamic> j)
      : description = _s(j['description']),
        minGpa = _dn(j['minGpa']),
        requiredCertificate = _sn(j['requiredCertificate']),
        isMandatory = j['isMandatory'] != false;
}

class MajorSubject {
  final String subjectName;
  final String examFormat; // THI_VIET | PHONG_VAN | XET_HO_SO
  final double? weight;

  MajorSubject.fromJson(Map<String, dynamic> j)
      : subjectName = _s(j['subjectName']),
        examFormat = _s(j['examFormat']),
        weight = _dn(j['weight']);
}

class OpenMajor {
  final int batchMajorId;
  final String majorCode;
  final String majorName;
  final String? facultyName;
  final int quota;
  final List<MajorCondition> conditions;
  final List<MajorSubject> subjects;

  OpenMajor.fromJson(Map<String, dynamic> j)
      : batchMajorId = _i(j['batchMajorId']),
        majorCode = _s(j['majorCode']),
        majorName = _s(j['majorName']),
        facultyName = _sn(j['facultyName']),
        quota = _i(j['quota']),
        conditions = _l(j['conditions']).map((e) => MajorCondition.fromJson(_m(e))).toList(),
        subjects = _l(j['subjects']).map((e) => MajorSubject.fromJson(_m(e))).toList();

  double? get minGpa {
    for (final c in conditions) {
      if (c.minGpa != null) return c.minGpa;
    }
    return null;
  }
}

class OpenBatch {
  final int batchId;
  final String batchCode;
  final String batchName;
  final String degreeLevel;
  final String registrationStartAt;
  final String registrationEndAt;
  final String? examStartAt;
  final String? examEndAt;
  final String? legalBasis;
  final List<OpenMajor> majors;

  OpenBatch.fromJson(Map<String, dynamic> j)
      : batchId = _i(j['batchId']),
        batchCode = _s(j['batchCode']),
        batchName = _s(j['batchName']),
        degreeLevel = _s(j['degreeLevel'], 'THAC_SI'),
        registrationStartAt = _s(j['registrationStartAt']),
        registrationEndAt = _s(j['registrationEndAt']),
        examStartAt = _sn(j['examStartAt']),
        examEndAt = _sn(j['examEndAt']),
        legalBasis = _sn(j['legalBasis']),
        majors = _l(j['majors']).map((e) => OpenMajor.fromJson(_m(e))).toList();
}

// ---------------------------------------------------------------- thông báo, khiếu nại, GVHD
class Announcement {
  final int announcementId;
  final String title;
  final String category;
  final bool isPinned;
  final String? publishedAt;
  final String createdAt;
  final String? batchName;
  final String? createdByName;
  final String excerpt;
  final String? content;

  Announcement.fromJson(Map<String, dynamic> j)
      : announcementId = _i(j['announcementId']),
        title = _s(j['title']),
        category = _s(j['category']),
        isPinned = _b(j['isPinned']),
        publishedAt = _sn(j['publishedAt']),
        createdAt = _s(j['createdAt']),
        batchName = _sn(_m(j['batch'])['batchName']),
        createdByName = _sn(j['createdByName']),
        excerpt = _s(j['excerpt']),
        content = _sn(j['content']);
}

class CandidateNotification {
  final int notificationId;
  final String? title;
  final String content;
  final String createdAt;
  final String? readAt;

  CandidateNotification.fromJson(Map<String, dynamic> j)
      : notificationId = _i(j['notificationId']),
        title = _sn(j['title']),
        content = _s(j['content']),
        createdAt = _s(j['createdAt']),
        readAt = _sn(j['readAt']);

  bool get isRead => readAt != null;
}

class Complaint {
  final int complaintId;
  final String type;
  final String typeLabel;
  final String content;
  final String status; // PENDING | IN_PROGRESS | RESOLVED | REJECTED
  final String? response;
  final String createdAt;
  final String? resolvedAt;
  final String? applicationCode;

  Complaint.fromJson(Map<String, dynamic> j)
      : complaintId = _i(j['complaintId']),
        type = _s(j['type']),
        typeLabel = _s(j['typeLabel']),
        content = _s(j['content']),
        status = _s(j['status'], 'PENDING'),
        response = _sn(j['response']),
        createdAt = _s(j['createdAt']),
        resolvedAt = _sn(j['resolvedAt']),
        applicationCode = _sn(j['applicationCode']);
}

class Lecturer {
  final int lecturerId;
  final String fullName;
  final String? facultyName;

  Lecturer.fromJson(Map<String, dynamic> j)
      : lecturerId = _i(j['lecturerId']),
        fullName = _s(j['fullName']),
        facultyName = _sn(j['facultyName']);
}

class SupervisorRequestItem {
  final int requestId;
  final int lecturerId;
  final String lecturerName;
  final String facultyName;
  final String status; // PENDING | ACCEPTED | REJECTED
  final String requestedAt;
  final String? respondedAt;
  final String? responseNote;

  SupervisorRequestItem.fromJson(Map<String, dynamic> j)
      : requestId = _i(j['requestId']),
        lecturerId = _i(j['lecturerId']),
        lecturerName = _s(j['lecturerName']),
        facultyName = _s(j['facultyName']),
        status = _s(j['status']),
        requestedAt = _s(j['requestedAt']),
        respondedAt = _sn(j['respondedAt']),
        responseNote = _sn(j['responseNote']);
}

/// GET /supervisors/me — state: NO_APPLICATION | MASTER | DRAFT | DOCTORAL
class SupervisorOverview {
  final String state;
  final String? applicationCode;
  final String? reviewStatus;
  final String? majorName;
  final String? researchTopic;
  final String? researchField;
  final List<SupervisorRequestItem> requests;
  final bool canRequest;
  final int remaining;

  SupervisorOverview.fromJson(Map<String, dynamic> j)
      : state = _s(j['state'], 'NO_APPLICATION'),
        applicationCode = _sn(j['applicationCode']),
        reviewStatus = _sn(j['reviewStatus']),
        majorName = _sn(j['majorName']),
        researchTopic = _sn(j['researchTopic']),
        researchField = _sn(j['researchField']),
        requests = _l(j['requests']).map((e) => SupervisorRequestItem.fromJson(_m(e))).toList(),
        canRequest = _b(j['canRequest']),
        remaining = _i(j['remaining']);
}
