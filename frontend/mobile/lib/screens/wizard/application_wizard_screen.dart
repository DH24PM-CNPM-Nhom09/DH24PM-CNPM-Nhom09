import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_card.dart';
import '../../widgets/app_text_field.dart';
import '../../widgets/app_button.dart';
import '../../models/models.dart';

class ApplicationWizardScreen extends StatefulWidget {
  const ApplicationWizardScreen({super.key});
  @override
  State<ApplicationWizardScreen> createState() => _ApplicationWizardScreenState();
}

class _ApplicationWizardScreenState extends State<ApplicationWizardScreen> {
  int _step = 1;
  bool _submitting = false;

  final _fullNameCtrl = TextEditingController();
  final _dobCtrl = TextEditingController();
  final _idNumberCtrl = TextEditingController();
  final _majorCtrl = TextEditingController();
  final _noteCtrl = TextEditingController();
  DegreeLevel _degreeLevel = DegreeLevel.thacSi;
  String _batchName = 'Đợt tuyển sinh 2027';
  final List<String> _files = [];

  static const _steps = ['Thông tin cá nhân', 'Ngành & đợt tuyển sinh', 'Tải hồ sơ', 'Xác nhận & nộp'];

  Future<void> _submit() async {
    setState(() => _submitting = true);
    // TODO (Backend): POST /applications với dữ liệu wizard này khi tích hợp thật.
    await Future.delayed(const Duration(milliseconds: 700));
    if (mounted) Navigator.of(context).pop();
  }

  Widget _buildStepper() {
    return Row(
      children: List.generate(_steps.length, (i) {
        final id = i + 1;
        final active = _step == id;
        final done = _step > id;
        return Expanded(
          child: Row(
            children: [
              Expanded(
                child: Column(
                  children: [
                    CircleAvatar(
                      radius: 16,
                      backgroundColor: active
                          ? AppColors.accent
                          : done
                              ? AppColors.success
                              : AppColors.gray100,
                      child: Text(
                        done ? '✓' : '$id',
                        style: TextStyle(
                            color: active || done ? Colors.white : AppColors.gray400,
                            fontWeight: FontWeight.w700,
                            fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
              if (id < _steps.length)
                Expanded(
                  flex: 2,
                  child: Container(height: 2, color: done ? AppColors.success : AppColors.gray100),
                ),
            ],
          ),
        );
      }),
    );
  }

  Widget _buildStepContent() {
    switch (_step) {
      case 1:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppTextField(label: 'Họ và tên', required: true, controller: _fullNameCtrl),
            const SizedBox(height: 16),
            AppTextField(label: 'Ngày sinh (yyyy-MM-dd)', required: true, controller: _dobCtrl),
            const SizedBox(height: 16),
            AppTextField(label: 'Số CCCD/CMND', required: true, controller: _idNumberCtrl),
          ],
        );
      case 2:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppDropdown<DegreeLevel>(
              label: 'Bậc đào tạo',
              value: _degreeLevel,
              items: DegreeLevel.values,
              labelBuilder: (d) => d == DegreeLevel.tienSi ? 'Tiến sĩ' : 'Thạc sĩ',
              onChanged: (v) => setState(() => _degreeLevel = v),
            ),
            const SizedBox(height: 16),
            AppDropdown<String>(
              label: 'Đợt tuyển sinh',
              value: _batchName,
              items: const ['Đợt tuyển sinh 2027', 'Đợt tuyển sinh 2027 (bổ sung)'],
              labelBuilder: (s) => s,
              onChanged: (v) => setState(() => _batchName = v),
            ),
            const SizedBox(height: 16),
            AppTextField(label: 'Ngành đăng ký', required: true, controller: _majorCtrl, hint: 'VD: Khoa học Máy tính'),
            const SizedBox(height: 16),
            AppTextField(
                label: 'Ghi chú thêm (không bắt buộc)', controller: _noteCtrl, maxLines: 3,
                hint: 'Nguyện vọng hướng nghiên cứu, hoàn cảnh đặc biệt cần lưu ý...'),
          ],
        );
      case 3:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: () => setState(() => _files.add('tai_lieu_${_files.length + 1}.pdf')),
              child: Container(
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.gray300, style: BorderStyle.solid, width: 1.5),
                  borderRadius: BorderRadius.circular(10),
                  color: AppColors.gray25,
                ),
                child: const Column(
                  children: [
                    Icon(Icons.attach_file, size: 28, color: AppColors.gray400),
                    SizedBox(height: 8),
                    Text('Nhấn để chọn file', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                    SizedBox(height: 4),
                    Text('PDF/JPG/PNG, tối đa 5MB mỗi file, tổng tối đa 30MB',
                        style: TextStyle(fontSize: 11, color: AppColors.gray400), textAlign: TextAlign.center),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            for (var i = 0; i < _files.length; i++)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                    border: Border.all(color: AppColors.gray200), borderRadius: BorderRadius.circular(10)),
                child: Row(
                  children: [
                    Expanded(child: Text(_files[i], style: const TextStyle(fontSize: 13))),
                    IconButton(
                      icon: const Icon(Icons.close, size: 18, color: AppColors.gray400),
                      onPressed: () => setState(() => _files.removeAt(i)),
                    ),
                  ],
                ),
              ),
          ],
        );
      default:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: AppColors.gray50, borderRadius: BorderRadius.circular(10)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _summaryRow('Họ và tên', _fullNameCtrl.text),
                  _summaryRow('Ngày sinh', _dobCtrl.text),
                  _summaryRow('Bậc đào tạo', _degreeLevel == DegreeLevel.tienSi ? 'Tiến sĩ' : 'Thạc sĩ'),
                  _summaryRow('Ngành đăng ký', _majorCtrl.text),
                  _summaryRow('Đợt tuyển sinh', _batchName),
                  _summaryRow('Số tài liệu đính kèm', '${_files.length} file'),
                ],
              ),
            ),
            const SizedBox(height: 12),
            const Text(
                'Bằng việc nộp hồ sơ, bạn xác nhận toàn bộ thông tin cung cấp là chính xác và chịu trách nhiệm về tính trung thực của hồ sơ.',
                style: TextStyle(fontSize: 11, color: AppColors.gray400)),
          ],
        );
    }
  }

  Widget _summaryRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 130, child: Text(label, style: const TextStyle(fontSize: 12, color: AppColors.gray400))),
          Expanded(
              child: Text(value.isEmpty ? '—' : value,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tạo hồ sơ xét tuyển')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildStepper(),
              const SizedBox(height: 20),
              AppCard(child: _buildStepContent()),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  AppButton(
                    label: '← Quay lại',
                    variant: AppButtonVariant.ghost,
                    onPressed: _step == 1 ? null : () => setState(() => _step -= 1),
                  ),
                  _step < 4
                      ? AppButton(label: 'Tiếp tục', onPressed: () => setState(() => _step += 1))
                      : AppButton(label: 'Nộp hồ sơ', loading: _submitting, onPressed: _submit),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
