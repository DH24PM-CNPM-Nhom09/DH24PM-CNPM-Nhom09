import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config.dart';
import '../../models/models.dart';
import '../../services/api_client.dart';
import '../../services/api_service.dart';
import '../../services/app_state.dart';
import '../../theme/app_theme.dart';
import '../../utils/cccd.dart';
import '../../utils/format.dart';
import '../../utils/labels.dart';
import '../../widgets/app_button.dart';
import '../../widgets/app_card.dart';
import '../../widgets/app_text_field.dart';
import '../../widgets/common.dart';
import '../../widgets/doc_slot.dart';
import '../scan_cccd_screen.dart';

/// Tạo / hoàn thiện / nộp hồ sơ xét tuyển (UC-DK-01..05) — cùng các bước như bản web:
/// Đợt & ngành → Quá trình đào tạo → Ngoại ngữ → Minh chứng (khai theo CCCD) → [Đề tài, bậc TS] → Xác nhận & nộp.
class ApplicationWizardScreen extends StatefulWidget {
  const ApplicationWizardScreen({super.key});

  @override
  State<ApplicationWizardScreen> createState() => _ApplicationWizardScreenState();
}

enum _Step { major, education, language, documents, research, review }

const _stepLabel = {
  _Step.major: 'Đợt & ngành',
  _Step.education: 'Quá trình đào tạo',
  _Step.language: 'Ngoại ngữ',
  _Step.documents: 'Minh chứng',
  _Step.research: 'Đề tài nghiên cứu',
  _Step.review: 'Xác nhận & nộp',
};

const _issuePlaces = [
  'Bộ Công an',
  'Cục Cảnh sát quản lý hành chính về trật tự xã hội',
  'Cục Cảnh sát đăng ký quản lý cư trú và dữ liệu quốc gia về dân cư',
];
const _otherPlace = 'Khác (ghi rõ)';

class _ApplicationWizardScreenState extends State<ApplicationWizardScreen> {
  bool _loading = true;
  Object? _loadError;
  bool _busy = false;
  String _error = '';

  Candidate? _profile;
  List<OpenBatch> _batches = [];
  FullApplication? _app;
  List<Lecturer> _lecturers = [];

  _Step _step = _Step.major;
  int? _batchId;
  int? _batchMajorId;

  // Quá trình đào tạo
  String _eduLevel = 'DAI_HOC';
  final _institution = TextEditingController();
  final _eduMajor = TextEditingController();
  final _gradYear = TextEditingController();
  final _gpa = TextEditingController();
  int _gpaScale = 4;
  Map<String, String> _eduErr = {};

  // Ngoại ngữ
  String? _langOption;
  final _langNote = TextEditingController();

  // Khai theo CCCD
  final _idNumber = TextEditingController();
  String _idIssueDate = '';
  String? _issuePlaceChoice;
  final _issuePlaceOther = TextEditingController();
  final _birthplace = TextEditingController();
  final _ethnicity = TextEditingController(text: 'Kinh');
  final _phone = TextEditingController();
  final _permanent = TextEditingController();
  final _address = TextEditingController();
  bool _sameAddress = false;
  bool _commit = false;
  Map<String, String> _declErr = {};
  String? _gender;
  String _qrWarning = '';
  String _optionalType = 'CHUNG_CHI_NGOAI_NGU';

  // Đề tài (tiến sĩ)
  final _topic = TextEditingController();
  final _field = TextEditingController();
  int? _lecturerId;

  bool _agree = false;
  List<String> _missingProfile = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in [
      _institution, _eduMajor, _gradYear, _gpa, _langNote, _idNumber, _issuePlaceOther, _birthplace,
      _ethnicity, _phone, _permanent, _address, _topic, _field,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  OpenBatch? get _batch => _batches.where((b) => b.batchId == _batchId).firstOrNull;
  OpenMajor? get _major => _batch?.majors.where((m) => m.batchMajorId == _batchMajorId).firstOrNull;
  String get _degree => _batch?.degreeLevel ?? _app?.degreeLevel ?? 'THAC_SI';
  List<_Step> get _steps => _degree == 'TIEN_SI'
      ? const [_Step.major, _Step.education, _Step.language, _Step.documents, _Step.research, _Step.review]
      : const [_Step.major, _Step.education, _Step.language, _Step.documents, _Step.review];

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final r = await Future.wait([apiService.getProfile(), apiService.getFullApplication(), apiService.getOpenBatches()]);
      _profile = r[0] as Candidate;
      final a = r[1] as FullApplication?;
      _batches = r[2] as List<OpenBatch>;
      _app = (a != null && a.declined) ? null : a;
      _fillDeclFromProfile(_profile!);
      final app = _app;
      if (app != null && app.isDraft) {
        _batchId = app.batch.batchId;
        _batchMajorId = app.major.batchMajorId;
        final e = app.education;
        if (e != null) {
          _eduLevel = e.degreeLevel;
          _institution.text = e.institutionName;
          _eduMajor.text = e.majorName;
          _gradYear.text = '${e.graduationYear}';
          _gpa.text = e.gpa == null ? '' : fmtScore(e.gpa);
          _gpaScale = e.gpaScale == 10 ? 10 : 4;
        }
        if (app.language.option != null) {
          _langOption = app.language.option;
          _langNote.text = app.language.note ?? '';
        }
        final p = app.proposal;
        if (p != null) {
          _topic.text = p.researchTopic;
          _field.text = p.researchField ?? '';
          _lecturerId = p.preferredLecturerId;
        }
        _commit = app.declarationConfirmedAt != null;
        // Mở lại đúng bước còn dang dở
        _step = app.language.option == null
            ? _Step.language
            : (app.missingDocuments.isNotEmpty || app.declarationConfirmedAt == null)
                ? _Step.documents
                : (app.isDoctoral && app.proposal == null)
                    ? _Step.research
                    : _Step.review;
      } else if (_batches.length == 1) {
        _batchId = _batches.first.batchId;
      }
      if (_degree == 'TIEN_SI') {
        apiService.getLecturers().then((l) {
          if (mounted) setState(() => _lecturers = l);
        }).catchError((_) {});
      }
      if (_step == _Step.review) _loadChecklist();
    } catch (e) {
      _loadError = e;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _fillDeclFromProfile(Candidate p) {
    _idNumber.text = p.idNumber ?? '';
    _idIssueDate = p.idIssueDate ?? '';
    final place = p.idIssuePlace ?? '';
    if (place.isNotEmpty) {
      if (_issuePlaces.contains(place)) {
        _issuePlaceChoice = place;
      } else {
        _issuePlaceChoice = _otherPlace;
        _issuePlaceOther.text = place;
      }
    }
    _birthplace.text = p.birthplace ?? '';
    _ethnicity.text = (p.ethnicity ?? '').isEmpty ? 'Kinh' : p.ethnicity!;
    _phone.text = p.phoneNumber ?? '';
    _permanent.text = p.permanentAddress ?? '';
    _address.text = p.address ?? '';
    _sameAddress = (p.permanentAddress ?? '').isNotEmpty && p.permanentAddress == p.address;
    _gender = p.gender;
  }

  void _go(_Step s) {
    setState(() {
      _error = '';
      _step = s;
    });
    if (s == _Step.review) _loadChecklist();
  }

  Future<void> _loadChecklist() async {
    try {
      final r = await api.get('/applications/me/checklist');
      if (mounted && r is Map) setState(() => _missingProfile = (r['missingProfile'] as List? ?? []).map((e) => '$e').toList());
    } catch (_) {}
  }

  Future<void> _run(Future<void> Function() job, String fallback) async {
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      await job();
    } catch (e) {
      if (mounted) setState(() => _error = errText(e, fallback));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _refreshApp() async {
    final a = await apiService.getFullApplication();
    if (mounted) setState(() => _app = a);
    appState.setApplication(a);
  }

  // ------------------------------------------------------------------ lưu từng bước
  Future<void> _saveEducation() async {
    final e = <String, String>{};
    final year = int.tryParse(_gradYear.text.trim());
    final gpa = double.tryParse(_gpa.text.trim().replaceAll(',', '.'));
    final thisYear = DateTime.now().year;
    if (_institution.text.trim().length < 3) e['inst'] = 'Nhập tên trường đã tốt nghiệp.';
    if (_eduMajor.text.trim().length < 2) e['major'] = 'Nhập ngành đã tốt nghiệp.';
    if (year == null || year < 1960 || year > thisYear) e['year'] = 'Năm tốt nghiệp từ 1960 đến $thisYear.';
    if (gpa == null || gpa < 0 || gpa > _gpaScale) e['gpa'] = 'Điểm trung bình từ 0 đến $_gpaScale.';
    setState(() => _eduErr = e);
    if (e.isNotEmpty || _major == null) return;
    await _run(() async {
      final a = await apiService.saveDraft(batchMajorId: _major!.batchMajorId, education: {
        'degreeLevel': _degree == 'THAC_SI' ? 'DAI_HOC' : _eduLevel,
        'institutionName': _institution.text.trim().replaceAll(RegExp(r'\s+'), ' '),
        'majorName': _eduMajor.text.trim().replaceAll(RegExp(r'\s+'), ' '),
        'graduationYear': year,
        'gpa': (gpa! * 100).round() / 100,
        'gpaScale': _gpaScale,
      });
      setState(() => _app = a);
      appState.setApplication(a);
      _go(a.language.option != null ? _Step.documents : _Step.language);
    }, 'Không lưu được hồ sơ nháp, vui lòng thử lại.');
  }

  Future<void> _saveLanguage() async {
    if (_langOption == null) return setState(() => _error = 'Chọn một trong ba trường hợp.');
    if (_langOption == 'EXEMPT' && _langNote.text.trim().length < 5) {
      return setState(() => _error = 'Ghi rõ lý do được miễn.');
    }
    await _run(() async {
      final a = await apiService.saveLanguage(_langOption!, _langOption == 'TEST' ? '' : _langNote.text.trim());
      setState(() => _app = a);
      appState.setApplication(a);
      _go(_Step.documents);
    }, 'Không lưu được thông tin ngoại ngữ.');
  }

  String get _issuePlace =>
      (_issuePlaceChoice == _otherPlace ? _issuePlaceOther.text : (_issuePlaceChoice ?? '')).trim().replaceAll(RegExp(r'\s+'), ' ');

  bool _validateDecl() {
    final e = <String, String>{};
    final today = toYmd(DateTime.now());
    final dob = _profile?.dob ?? '';
    if (!RegExp(r'^\d{12}$').hasMatch(_idNumber.text.replaceAll(' ', ''))) e['id'] = 'Số CCCD gồm đúng 12 chữ số.';
    if (_idIssueDate.isEmpty) {
      e['issueDate'] = 'Chọn ngày cấp.';
    } else if (_idIssueDate.compareTo(today) > 0) {
      e['issueDate'] = 'Ngày cấp không được sau hôm nay.';
    } else if (dob.isNotEmpty && _idIssueDate.compareTo(dob) < 0) {
      e['issueDate'] = 'Ngày cấp không được trước ngày sinh.';
    }
    if (_issuePlaceChoice == null) {
      e['place'] = 'Chọn nơi cấp.';
    } else if (_issuePlaceChoice == _otherPlace && _issuePlaceOther.text.trim().length < 3) {
      e['placeOther'] = 'Ghi nơi cấp đúng như mặt sau thẻ.';
    }
    if (_birthplace.text.trim().length < 2) e['birthplace'] = 'Nhập nơi sinh.';
    if (_ethnicity.text.trim().length < 2) e['ethnicity'] = 'Nhập dân tộc.';
    if (!RegExp(r'^0\d{9}$').hasMatch(_phone.text.replaceAll(RegExp(r'[\s.]'), ''))) {
      e['phone'] = 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.';
    }
    if (_permanent.text.trim().length < 5) e['permanent'] = 'Nhập nơi thường trú như trên CCCD.';
    if (!_sameAddress && _address.text.trim().length < 5) e['address'] = 'Nhập địa chỉ liên hệ.';
    if (_gender == null) e['gender'] = 'Chọn giới tính.';
    setState(() => _declErr = e);
    return e.isEmpty;
  }

  Future<void> _saveDeclaration() async {
    if (!_validateDecl()) {
      setState(() => _error = 'Kiểm tra lại mục "Thông tin cá nhân": còn ô chưa điền đúng.');
      return;
    }
    if (!_commit) return setState(() => _error = 'Tích ô cam kết ở cuối mục Thông tin cá nhân trước khi tiếp tục.');
    await _run(() async {
      if (_gender != _profile?.gender) await apiService.updateProfile({'gender': _gender});
      final a = await apiService.saveDeclaration({
        'idNumber': _idNumber.text.replaceAll(' ', ''),
        'idIssueDate': _idIssueDate,
        'idIssuePlace': _issuePlace,
        'birthplace': _birthplace.text.trim(),
        'ethnicity': _ethnicity.text.trim(),
        'phoneNumber': _phone.text.replaceAll(RegExp(r'[\s.]'), ''),
        'permanentAddress': _permanent.text.trim(),
        'address': (_sameAddress ? _permanent.text : _address.text).trim(),
        'confirm': true,
      });
      _profile = await apiService.getProfile();
      setState(() => _app = a);
      appState.setApplication(a);
      final idx = _steps.indexOf(_Step.documents);
      _go(_steps[idx + 1]);
    }, 'Không lưu được thông tin cá nhân, vui lòng thử lại.');
  }

  Future<void> _saveResearch() async {
    final topic = _topic.text.trim().replaceAll(RegExp(r'\s+'), ' ');
    if (topic.length < 10) return setState(() => _error = 'Tên đề tài cần ít nhất 10 ký tự.');
    if (topic.length > 500) return setState(() => _error = 'Tên đề tài tối đa 500 ký tự.');
    await _run(() async {
      final a = await apiService.saveProposal(
          researchTopic: topic, researchField: _field.text.trim(), preferredLecturerId: _lecturerId);
      setState(() => _app = a);
      appState.setApplication(a);
      _go(_Step.review);
    }, 'Không lưu được thông tin nghiên cứu.');
  }

  Future<void> _submit() async {
    if (!_agree) return setState(() => _error = 'Bạn cần xác nhận cam kết trước khi nộp hồ sơ.');
    await _run(() async {
      await apiService.submitApplication();
      await appState.refresh();
      if (!mounted) return;
      await showDialog(
        context: context,
        builder: (c) => AlertDialog(
          icon: const Icon(Icons.check_circle, color: AppColors.success, size: 48),
          title: const Text('Đã nộp hồ sơ'),
          content: const Text(
              'Hồ sơ đã được gửi tới Nhà trường. Bước tiếp theo: nộp lệ phí xét tuyển bằng mã VietQR trong mục Hồ sơ.'),
          actions: [FilledButton(onPressed: () => Navigator.pop(c), child: const Text('Xem hồ sơ'))],
        ),
      );
      if (mounted) Navigator.of(context).pop();
    }, 'Nộp hồ sơ thất bại, vui lòng thử lại.');
    _refreshApp().catchError((_) {});
  }

  Future<void> _cancelDraft() async {
    final ok = await confirmDialog(context,
        title: 'Hủy bản nháp?',
        message: 'Toàn bộ thông tin và minh chứng của bản nháp sẽ bị xóa. Bạn có thể tạo hồ sơ mới sau.',
        ok: 'Hủy bản nháp',
        danger: true);
    if (!ok) return;
    await _run(() async {
      await apiService.cancelDraft();
      await appState.refresh();
      if (mounted) Navigator.of(context).pop();
    }, 'Không hủy được bản nháp.');
  }

  Future<void> _scanCccd() async {
    final f = await Navigator.of(context).push<IdCardFields>(MaterialPageRoute(builder: (_) => const ScanCccdScreen()));
    if (f == null) return;
    final warnings = <String>[];
    final p = _profile;
    if (p != null) {
      if (f.fullName != null && foldVi(f.fullName!) != foldVi(p.fullName)) {
        warnings.add('Họ tên trên thẻ (${f.fullName}) khác họ tên trong hồ sơ (${p.fullName}).');
      }
      if (f.dob != null && p.dob.isNotEmpty && f.dob != p.dob) warnings.add('Ngày sinh trên thẻ khác ngày sinh trong hồ sơ.');
      if (f.gender != null && p.gender != null && f.gender != p.gender) warnings.add('Giới tính trên thẻ khác giới tính trong hồ sơ.');
    }
    setState(() {
      _idNumber.text = f.idNumber;
      if (f.idIssueDate != null) _idIssueDate = f.idIssueDate!;
      if (f.permanentAddress != null) _permanent.text = f.permanentAddress!;
      if (_gender == null && f.gender != null) _gender = f.gender;
      _qrWarning = warnings.isEmpty
          ? ''
          : '${warnings.join(' ')} Nếu hồ sơ khai sai, sửa ở mục Cá nhân → Sửa thông tin trước khi nộp.';
    });
    if (mounted) showSnack(context, 'Đã điền số CCCD, ngày cấp, nơi thường trú từ mã QR. Kiểm tra lại nhé.');
  }

  // ------------------------------------------------------------------ giao diện
  @override
  Widget build(BuildContext context) {
    Widget body;
    if (_loading) {
      body = const LoadingView();
    } else if (_loadError != null) {
      body = ErrorView(message: errText(_loadError!, 'Không tải được dữ liệu.'), onRetry: _load);
    } else if (_app != null && !_app!.isDraft) {
      body = EmptyView(
        icon: Icons.task_alt,
        title: 'Bạn đã nộp hồ sơ ${_app!.applicationCode}',
        message: 'Mỗi thí sinh nộp một hồ sơ trong đợt. Theo dõi tình trạng hồ sơ ở tab Hồ sơ.',
        action: AppButton(label: 'Về trang hồ sơ', onPressed: () => Navigator.of(context).pop()),
      );
    } else if (_app != null && !_app!.canEdit) {
      body = const EmptyView(
        icon: Icons.event_busy,
        title: 'Đợt tuyển sinh đã hết hạn nhận hồ sơ',
        message: 'Bản nháp không còn chỉnh sửa hay nộp được.',
      );
    } else {
      body = Column(children: [
        _StepHeader(steps: _steps, current: _step),
        Expanded(
          child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 24), children: [
            if (_error.isNotEmpty) Alert(_error),
            ...switch (_step) {
              _Step.major => _majorStep(),
              _Step.education => _educationStep(),
              _Step.language => _languageStep(),
              _Step.documents => _documentsStep(),
              _Step.research => _researchStep(),
              _Step.review => _reviewStep(),
            },
          ]),
        ),
      ]);
    }
    return Scaffold(
      appBar: AppBar(
        title: Text(_app?.isDraft == true ? 'Hoàn thiện hồ sơ' : 'Tạo hồ sơ xét tuyển'),
        actions: [
          if (_app?.isDraft == true && _app!.canEdit)
            PopupMenuButton<String>(
              onSelected: (v) => v == 'cancel' ? _cancelDraft() : null,
              itemBuilder: (_) => const [PopupMenuItem(value: 'cancel', child: Text('Hủy bản nháp'))],
            ),
        ],
      ),
      body: SafeArea(child: body),
    );
  }

  Widget _nav({required String next, required VoidCallback? onNext, _Step? back}) => Padding(
        padding: const EdgeInsets.only(top: 16),
        child: Row(children: [
          if (back != null)
            Expanded(
              child: AppButton(label: 'Quay lại', variant: AppButtonVariant.ghost, onPressed: _busy ? null : () => _go(back)),
            ),
          if (back != null) const SizedBox(width: 10),
          Expanded(flex: 2, child: AppButton(label: next, loading: _busy, onPressed: onNext)),
        ]),
      );

  // ---- Bước 1: đợt & ngành
  List<Widget> _majorStep() {
    if (_batches.isEmpty) {
      return const [
        EmptyView(
          icon: Icons.event_busy_outlined,
          title: 'Hiện chưa có đợt tuyển sinh nào đang mở',
          message: 'Theo dõi tab Tuyển sinh để biết lịch mở đợt mới.',
        ),
      ];
    }
    final b = _batch;
    return [
      const SectionTitle('Chọn đợt tuyển sinh'),
      ..._batches.map((x) => _ChoiceCard(
            selected: x.batchId == _batchId,
            title: x.batchName,
            subtitle: '${degreeLabel[x.degreeLevel]} · nhận hồ sơ đến ${fmtDateTime(x.registrationEndAt)} (${timeLeft(x.registrationEndAt)})',
            onTap: () => setState(() {
              _batchId = x.batchId;
              _batchMajorId = null;
              if (x.degreeLevel == 'TIEN_SI' && _lecturers.isEmpty) {
                apiService.getLecturers().then((l) {
                  if (mounted) setState(() => _lecturers = l);
                }).catchError((_) {});
              }
            }),
          )),
      if (b != null) ...[
        const SizedBox(height: 12),
        const SectionTitle('Chọn ngành dự tuyển'),
        ...b.majors.map((m) => _ChoiceCard(
              selected: m.batchMajorId == _batchMajorId,
              title: m.majorName,
              subtitle: [
                'Mã ${m.majorCode} · chỉ tiêu ${m.quota}',
                if (m.minGpa != null) 'Điểm TB tối thiểu ${fmtScore(m.minGpa)}',
                ...m.conditions.where((c) => c.minGpa == null).map((c) => c.description),
              ].join('\n'),
              onTap: () => setState(() => _batchMajorId = m.batchMajorId),
            )),
      ],
      _nav(
        next: 'Tiếp tục',
        onNext: _major == null
            ? null
            : () {
                if (_degree == 'THAC_SI') _eduLevel = 'DAI_HOC';
                _go(_Step.education);
              },
      ),
    ];
  }

  // ---- Bước 2: quá trình đào tạo
  List<Widget> _educationStep() {
    final minGpa = _major?.minGpa;
    final gpa = double.tryParse(_gpa.text.replaceAll(',', '.'));
    return [
      SectionTitle('Quá trình đào tạo — ${_major?.majorName ?? ''}'),
      if (_degree == 'TIEN_SI')
        AppDropdown<String>(
          label: 'Văn bằng dùng để dự tuyển',
          required: true,
          value: _eduLevel,
          items: const ['DAI_HOC', 'THAC_SI'],
          labelBuilder: (v) => 'Bằng ${eduLabel[v]!.toLowerCase()}',
          onChanged: (v) => setState(() => _eduLevel = v ?? 'DAI_HOC'),
        )
      else
        const Padding(
          padding: EdgeInsets.only(bottom: 12),
          child: Text('Khai thông tin bằng tốt nghiệp đại học.', style: TextStyle(color: AppColors.gray500)),
        ),
      AppTextField(label: 'Trường đã tốt nghiệp', required: true, controller: _institution, errorText: _eduErr['inst']),
      AppTextField(label: 'Ngành đã tốt nghiệp', required: true, controller: _eduMajor, errorText: _eduErr['major']),
      AppTextField(
        label: 'Năm tốt nghiệp',
        required: true,
        controller: _gradYear,
        keyboardType: TextInputType.number,
        maxLength: 4,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        errorText: _eduErr['year'],
      ),
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(
          flex: 3,
          child: AppTextField(
            label: 'Điểm trung bình',
            required: true,
            controller: _gpa,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            errorText: _eduErr['gpa'],
            onChanged: (_) => setState(() {}),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          flex: 2,
          child: AppDropdown<int>(
            label: 'Thang điểm',
            value: _gpaScale,
            items: const [4, 10],
            labelBuilder: (v) => 'Thang $v',
            onChanged: (v) => setState(() => _gpaScale = v ?? 4),
          ),
        ),
      ]),
      if (minGpa != null && gpa != null && _gpaScale == 4 && gpa < minGpa)
        InfoBanner.warning('Ngành này yêu cầu điểm trung bình tối thiểu ${fmtScore(minGpa)} (thang 4). '
            'Bạn vẫn lưu được, nhưng hồ sơ có thể không đạt điều kiện.'),
      _nav(next: 'Lưu & tiếp tục', onNext: _saveEducation, back: _Step.major),
    ];
  }

  // ---- Bước 3: ngoại ngữ
  List<Widget> _languageStep() {
    final req = _app?.language.requiredLevel ?? '';
    return [
      const SectionTitle('Năng lực ngoại ngữ'),
      if (req.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Text('Chuẩn đầu vào: $req', style: const TextStyle(color: AppColors.gray600)),
        ),
      ...languageOptions.entries.map((e) => _ChoiceCard(
            selected: _langOption == e.key,
            title: e.value.$1,
            subtitle: e.key == 'TEST' && (_app?.englishTestFee ?? 0) > 0
                ? '${e.value.$2}\nLệ phí thi: ${fmtMoney(_app!.englishTestFee)}'
                : e.value.$2,
            onTap: () => setState(() => _langOption = e.key),
          )),
      if (_langOption == 'EXEMPT') ...[
        const SizedBox(height: 6),
        AppTextField(label: 'Lý do được miễn', required: true, controller: _langNote, maxLines: 3),
        Wrap(
          spacing: 8,
          runSpacing: 6,
          children: exemptReasons
              .map((r) => ActionChip(
                    label: Text(r, style: const TextStyle(fontSize: 12)),
                    onPressed: () => setState(() => _langNote.text = r),
                  ))
              .toList(),
        ),
      ],
      if (_langOption == 'CERTIFICATE')
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: InfoBanner.info('Bạn sẽ tải chứng chỉ ngoại ngữ ở bước Minh chứng.'),
        ),
      _nav(next: 'Lưu & tiếp tục', onNext: _saveLanguage, back: _Step.education),
    ];
  }

  // ---- Bước 4: khai theo CCCD + minh chứng
  List<Widget> _documentsStep() {
    final a = _app!;
    final p = _profile!;
    final optionalTypes = a.optionalDocuments.where((t) => !a.requiredDocuments.contains(t)).toList();
    final uploadedOptional = optionalTypes.where((t) => a.docsOf(t).isNotEmpty).toList();
    if (!optionalTypes.contains(_optionalType) && optionalTypes.isNotEmpty) _optionalType = optionalTypes.first;
    return [
      const SectionTitle('1. Thông tin cá nhân (khai theo CCCD)'),
      AppCard(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          OutlinedButton.icon(
            onPressed: _scanCccd,
            icon: const Icon(Icons.qr_code_scanner),
            label: const Text('Quét mã QR trên CCCD để điền nhanh'),
          ),
          const SizedBox(height: 4),
          const Text('Mã QR ở góc trên bên phải mặt trước thẻ CCCD gắn chip.',
              style: TextStyle(fontSize: 12, color: AppColors.gray500)),
          if (_qrWarning.isNotEmpty) ...[const SizedBox(height: 8), InfoBanner.warning(_qrWarning)],
          const Divider(height: 24),
          KV('Họ và tên', p.fullName),
          KV('Ngày sinh', fmtDate(p.dob)),
          if (p.gender != null) KV('Giới tính', genderLabel[p.gender]),
          if (p.gender == null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: AppDropdown<String>(
                label: 'Giới tính',
                required: true,
                value: _gender,
                items: const ['NAM', 'NU', 'KHAC'],
                labelBuilder: (v) => genderLabel[v]!,
                errorText: _declErr['gender'],
                onChanged: (v) => setState(() => _gender = v),
              ),
            ),
          const SizedBox(height: 10),
          AppTextField(
            label: 'Số CCCD',
            required: true,
            controller: _idNumber,
            keyboardType: TextInputType.number,
            maxLength: 12,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            errorText: _declErr['id'],
          ),
          DateField(
            label: 'Ngày cấp',
            required: true,
            value: _idIssueDate,
            errorText: _declErr['issueDate'],
            firstDate: DateTime(1990),
            onChanged: (v) => setState(() => _idIssueDate = v),
          ),
          AppDropdown<String>(
            label: 'Nơi cấp',
            required: true,
            value: _issuePlaceChoice,
            hint: 'Chọn như mặt sau thẻ',
            items: const [..._issuePlaces, _otherPlace],
            labelBuilder: (v) => v,
            errorText: _declErr['place'],
            onChanged: (v) => setState(() => _issuePlaceChoice = v),
          ),
          if (_issuePlaceChoice == _otherPlace)
            AppTextField(label: 'Ghi rõ nơi cấp', required: true, controller: _issuePlaceOther, errorText: _declErr['placeOther']),
          AppTextField(label: 'Nơi sinh', required: true, controller: _birthplace, hint: 'Tỉnh/thành phố', errorText: _declErr['birthplace']),
          AppTextField(label: 'Dân tộc', required: true, controller: _ethnicity, errorText: _declErr['ethnicity']),
          AppTextField(
            label: 'Số điện thoại',
            required: true,
            controller: _phone,
            keyboardType: TextInputType.phone,
            maxLength: 12,
            errorText: _declErr['phone'],
          ),
          AppTextField(
            label: 'Nơi thường trú (như trên CCCD)',
            required: true,
            controller: _permanent,
            maxLines: 2,
            errorText: _declErr['permanent'],
          ),
          CheckboxListTile(
            value: _sameAddress,
            dense: true,
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            title: const Text('Địa chỉ liên hệ giống nơi thường trú'),
            onChanged: (v) => setState(() => _sameAddress = v == true),
          ),
          if (!_sameAddress)
            AppTextField(label: 'Địa chỉ liên hệ', required: true, controller: _address, maxLines: 2, errorText: _declErr['address']),
          CheckboxListTile(
            value: _commit,
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            title: const Text(
              'Tôi cam kết thông tin khai trên đây là đúng sự thật, khớp với CCCD và minh chứng đã nộp; '
              'nếu sai tôi chịu trách nhiệm trước Nhà trường.',
              style: TextStyle(fontSize: 13),
            ),
            onChanged: (v) => setState(() => _commit = v == true),
          ),
        ]),
      ),
      const SizedBox(height: 18),
      SectionTitle('2. Minh chứng bắt buộc (${a.requiredDocuments.length - a.missingDocuments.length}/${a.requiredDocuments.length})'),
      ...a.requiredDocuments.map((t) => DocSlot(
            key: ValueKey('req-$t'),
            app: a,
            type: t,
            required: true,
            canUpload: true,
            canDelete: true,
            onChanged: _refreshApp,
            extra: t == 'DON_DANG_KY'
                ? Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      onPressed: () => launchUrl(Uri.parse('${AppConfig.webBase}/application/print'),
                          mode: LaunchMode.externalApplication),
                      icon: const Icon(Icons.print_outlined, size: 18),
                      label: const Text('Mở trang in đơn trên web'),
                    ),
                  )
                : null,
          )),
      if (optionalTypes.isNotEmpty) ...[
        const SizedBox(height: 12),
        const SectionTitle('3. Minh chứng khác (nếu có)'),
        ...uploadedOptional.map((t) => DocSlot(
              key: ValueKey('opt-$t'),
              app: a,
              type: t,
              required: false,
              canUpload: true,
              canDelete: true,
              onChanged: _refreshApp,
            )),
        AppDropdown<String>(
          label: 'Thêm loại minh chứng',
          value: _optionalType,
          items: optionalTypes,
          labelBuilder: docName,
          onChanged: (v) => setState(() => _optionalType = v ?? _optionalType),
        ),
        if (!uploadedOptional.contains(_optionalType))
          DocSlot(
            key: ValueKey('new-$_optionalType'),
            app: a,
            type: _optionalType,
            required: false,
            canUpload: true,
            canDelete: true,
            onChanged: _refreshApp,
          ),
      ],
      _nav(next: 'Lưu & tiếp tục', onNext: _saveDeclaration, back: _Step.language),
    ];
  }

  // ---- Bước 5 (tiến sĩ): đề tài nghiên cứu
  List<Widget> _researchStep() => [
        const SectionTitle('Đề tài nghiên cứu dự kiến'),
        AppTextField(label: 'Tên đề tài', required: true, controller: _topic, maxLines: 3, maxLength: 500),
        AppTextField(label: 'Lĩnh vực nghiên cứu', controller: _field),
        AppDropdown<int?>(
          label: 'Giảng viên hướng dẫn mong muốn (không bắt buộc)',
          value: _lecturerId,
          items: [null, ..._lecturers.map((l) => l.lecturerId)],
          labelBuilder: (id) {
            if (id == null) return 'Chưa chọn';
            final l = _lecturers.firstWhere((x) => x.lecturerId == id);
            return '${l.fullName}${l.facultyName != null ? ' — ${l.facultyName}' : ''}';
          },
          onChanged: (v) => setState(() => _lecturerId = v),
        ),
        _nav(next: 'Lưu & tiếp tục', onNext: _saveResearch, back: _Step.documents),
      ];

  // ---- Bước cuối: xác nhận & nộp
  List<Widget> _reviewStep() {
    final a = _app!;
    final p = _profile!;
    final problems = <String>[
      if (_missingProfile.isNotEmpty) 'Thông tin cá nhân còn thiếu: ${_missingProfile.join(', ')}.',
      if (a.declarationConfirmedAt == null) 'Chưa khai thông tin theo CCCD và tích ô cam kết ở bước Minh chứng.',
      if (a.missingDocuments.isNotEmpty) 'Còn thiếu minh chứng: ${a.missingDocuments.map(docName).join(', ')}.',
      if (a.isDoctoral && a.proposal == null) 'Chưa khai đề tài nghiên cứu.',
    ];
    return [
      const SectionTitle('Kiểm tra lại hồ sơ'),
      AppCard(
        padding: const EdgeInsets.all(14),
        child: Column(children: [
          KV('Họ và tên', p.fullName),
          KV('Ngày sinh', fmtDate(p.dob)),
          KV('Số CCCD', p.idNumber),
          KV('Đợt', a.batch.batchName),
          KV('Ngành', '${a.major.majorName} (${a.major.majorCode})'),
          KV('Trình độ', degreeLabel[a.degreeLevel]),
          if (a.education != null)
            KV('Văn bằng',
                '${eduLabel[a.education!.degreeLevel]} · ${a.education!.institutionName} · ${a.education!.graduationYear} · '
                    'ĐTB ${fmtScore(a.education!.gpa)}/${a.education!.gpaScale}'),
          KV('Ngoại ngữ', languageOptions[a.language.option]?.$1),
          if (a.proposal != null) KV('Đề tài', a.proposal!.researchTopic),
          KV('Minh chứng', '${a.documents.length} tệp'),
        ]),
      ),
      const SizedBox(height: 12),
      AppCard(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Lệ phí phải nộp sau khi nộp hồ sơ', style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          ...a.feeItems.map((f) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(children: [
                  Expanded(child: Text(f.label, style: const TextStyle(fontSize: 13))),
                  Text(fmtMoney(f.amount), style: const TextStyle(fontWeight: FontWeight.w600)),
                ]),
              )),
          const Divider(),
          Row(children: [
            const Expanded(child: Text('Tổng cộng', style: TextStyle(fontWeight: FontWeight.w700))),
            Text(fmtMoney(a.fee), style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.accentDark, fontSize: 16)),
          ]),
        ]),
      ),
      const SizedBox(height: 12),
      if (problems.isNotEmpty) InfoBanner.warning('Chưa nộp được:\n• ${problems.join('\n• ')}'),
      CheckboxListTile(
        value: _agree,
        contentPadding: EdgeInsets.zero,
        controlAffinity: ListTileControlAffinity.leading,
        title: const Text(
          'Tôi xác nhận các thông tin và minh chứng là đúng sự thật, đồng ý nộp hồ sơ. '
          'Sau khi nộp, hồ sơ không chỉnh sửa được trừ khi Nhà trường yêu cầu bổ sung.',
          style: TextStyle(fontSize: 13),
        ),
        onChanged: (v) => setState(() => _agree = v == true),
      ),
      _nav(next: 'Nộp hồ sơ', onNext: _submit, back: _steps[_steps.length - 2]),
    ];
  }
}

class _StepHeader extends StatelessWidget {
  final List<_Step> steps;
  final _Step current;
  const _StepHeader({required this.steps, required this.current});

  @override
  Widget build(BuildContext context) {
    final i = steps.indexOf(current);
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Bước ${i + 1}/${steps.length}: ${_stepLabel[current]}',
            style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.navy800)),
        const SizedBox(height: 8),
        Row(
          children: List.generate(
            steps.length,
            (k) => Expanded(
              child: Container(
                height: 5,
                margin: EdgeInsets.only(right: k == steps.length - 1 ? 0 : 4),
                decoration: BoxDecoration(
                  color: k <= i ? AppColors.accent : AppColors.gray200,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
          ),
        ),
      ]),
    );
  }
}

class _ChoiceCard extends StatelessWidget {
  final bool selected;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  const _ChoiceCard({required this.selected, required this.title, required this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Material(
          color: selected ? AppColors.accent50 : Colors.white,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: onTap,
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: selected ? AppColors.accent : AppColors.gray200, width: selected ? 1.6 : 1),
              ),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Icon(selected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                    color: selected ? AppColors.accent : AppColors.gray400, size: 22),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
                    const SizedBox(height: 3),
                    Text(subtitle, style: const TextStyle(fontSize: 12.5, color: AppColors.gray600, height: 1.4)),
                  ]),
                ),
              ]),
            ),
          ),
        ),
      );
}
