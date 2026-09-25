import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../widgets/app_card.dart';
import '../widgets/app_text_field.dart';
import '../widgets/app_button.dart';

const _complaintTypes = {
  'PHUC_KHAO_DIEM': 'Phúc khảo điểm',
  'KHIEU_NAI_KET_QUA': 'Khiếu nại kết quả xét tuyển',
  'KHIEU_NAI_HO_SO': 'Khiếu nại xử lý hồ sơ',
  'KHAC': 'Khác',
};

class ComplaintScreen extends StatefulWidget {
  const ComplaintScreen({super.key});
  @override
  State<ComplaintScreen> createState() => _ComplaintScreenState();
}

class _ComplaintScreenState extends State<ComplaintScreen> {
  String _type = 'PHUC_KHAO_DIEM';
  final _codeCtrl = TextEditingController();
  final _contentCtrl = TextEditingController();
  bool _loading = false;
  bool _done = false;
  String _error = '';

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      await apiService.submitComplaint(_type, _codeCtrl.text, _contentCtrl.text);
      setState(() => _done = true);
    } catch (e) {
      setState(() => _error = 'Gửi yêu cầu thất bại.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Gửi yêu cầu phúc khảo điểm hoặc khiếu nại liên quan đến quá trình xét tuyển.',
            style: TextStyle(fontSize: 13, color: AppColors.gray500)),
        const SizedBox(height: 16),
        AppCard(
          child: _done
              ? Column(
                  children: [
                    const CircleAvatar(
                      radius: 28,
                      backgroundColor: AppColors.success50,
                      child: Icon(Icons.check, color: AppColors.success, size: 28),
                    ),
                    const SizedBox(height: 12),
                    const Text('Đã gửi yêu cầu thành công', style: TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    const Text('Chúng tôi sẽ phản hồi qua email trong vòng 5-7 ngày làm việc.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12, color: AppColors.gray500)),
                    const SizedBox(height: 16),
                    AppButton(
                      label: 'Gửi yêu cầu khác',
                      variant: AppButtonVariant.outline,
                      onPressed: () => setState(() => _done = false),
                    ),
                  ],
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_error.isNotEmpty) ...[InfoBanner.danger(_error), const SizedBox(height: 12)],
                    AppDropdown<String>(
                      label: 'Loại yêu cầu',
                      value: _type,
                      items: _complaintTypes.keys.toList(),
                      labelBuilder: (k) => _complaintTypes[k]!,
                      onChanged: (v) => setState(() => _type = v),
                    ),
                    const SizedBox(height: 16),
                    AppTextField(label: 'Mã hồ sơ', required: true, controller: _codeCtrl, hint: 'HS2027-00458'),
                    const SizedBox(height: 16),
                    AppTextField(
                      label: 'Nội dung',
                      required: true,
                      controller: _contentCtrl,
                      maxLines: 5,
                      hint: 'Mô tả chi tiết nội dung khiếu nại / phúc khảo...',
                    ),
                    const SizedBox(height: 20),
                    AppButton(label: 'Gửi yêu cầu', loading: _loading, onPressed: _submit),
                  ],
                ),
        ),
      ],
    );
  }
}
