import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../models/models.dart';
import '../widgets/app_card.dart';
import '../widgets/status_badge.dart';
import '../widgets/app_text_field.dart';
import '../widgets/app_button.dart';

class ApplicationScreen extends StatefulWidget {
  const ApplicationScreen({super.key});
  @override
  State<ApplicationScreen> createState() => _ApplicationScreenState();
}

class _ApplicationScreenState extends State<ApplicationScreen> {
  Application? _app;
  List<ApplicationDocument> _docs = [];
  DocumentType _docType = DocumentType.vanBang;
  bool _loading = true;
  bool _uploading = false;
  String _uploadError = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final app = await apiService.getMyApplication();
    final docs = await apiService.getMyDocuments();
    setState(() {
      _app = app;
      _docs = docs;
      _loading = false;
    });
  }

  // Mô phỏng chọn file (chưa gắn file_picker thật) — khi tích hợp thật,
  // thay bằng gói file_picker để lấy tên + dung lượng file thật từ máy.
  Future<void> _simulateUpload() async {
    if (_app == null) return;
    setState(() {
      _uploading = true;
      _uploadError = '';
    });
    try {
      await apiService.uploadDocument(_app!.applicationId, 'tai_lieu_moi.pdf', 900, _docType.name);
      final fresh = await apiService.getMyDocuments();
      setState(() => _docs = fresh);
    } on ApiException catch (e) {
      setState(() => _uploadError = e.message);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_app != null) ...[
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Mã hồ sơ: ${_app!.applicationCode}',
                  style: const TextStyle(fontSize: 13, color: AppColors.gray500)),
              StatusBadge.review(_app!.reviewStatus),
            ],
          ),
          if (_app!.reviewStatus == ReviewStatus.needsSupplement) ...[
            const SizedBox(height: 12),
            InfoBanner.warning(
                'Hồ sơ cần bổ sung thêm giấy tờ. Giới hạn: tối đa 5MB/file, tổng tối đa 30MB/hồ sơ.'),
          ],
          const SizedBox(height: 16),
        ],
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Tài liệu đã nộp', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              if (_docs.isEmpty)
                const Text('Chưa có tài liệu nào được tải lên.',
                    style: TextStyle(fontSize: 13, color: AppColors.gray400)),
              for (final d in _docs) ...[
                Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                      border: Border.all(color: AppColors.gray200), borderRadius: BorderRadius.circular(10)),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(d.fileName,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                            const SizedBox(height: 2),
                            Text('${documentTypeLabel(d.documentType)} · ${(d.fileSizeKb / 1024).toStringAsFixed(1)} MB',
                                style: const TextStyle(fontSize: 11, color: AppColors.gray500)),
                          ],
                        ),
                      ),
                      StatusBadge(
                        text: switch (d.verifyStatus) {
                          VerifyStatus.valid => 'Hợp lệ',
                          VerifyStatus.pending => 'Đang kiểm tra',
                          VerifyStatus.invalid => 'Không hợp lệ',
                        },
                        background: switch (d.verifyStatus) {
                          VerifyStatus.valid => AppColors.success50,
                          VerifyStatus.pending => AppColors.warning50,
                          VerifyStatus.invalid => AppColors.gray100,
                        },
                        foreground: switch (d.verifyStatus) {
                          VerifyStatus.valid => AppColors.success,
                          VerifyStatus.pending => AppColors.warning,
                          VerifyStatus.invalid => AppColors.gray500,
                        },
                      ),
                    ],
                  ),
                ),
              ],
              const Divider(height: 24),
              const Text('Tải lên tài liệu mới', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
              const SizedBox(height: 10),
              if (_uploadError.isNotEmpty) ...[
                InfoBanner.danger(_uploadError),
                const SizedBox(height: 10),
              ],
              AppDropdown<DocumentType>(
                label: 'Loại tài liệu',
                value: _docType,
                items: DocumentType.values,
                labelBuilder: documentTypeLabel,
                onChanged: (v) => setState(() => _docType = v),
              ),
              const SizedBox(height: 12),
              AppButton(
                label: 'Chọn file',
                variant: AppButtonVariant.outline,
                loading: _uploading,
                onPressed: _simulateUpload,
                icon: Icons.upload_file,
              ),
              const SizedBox(height: 6),
              const Text('Định dạng PDF/JPG/PNG, tối đa 5MB mỗi file.',
                  style: TextStyle(fontSize: 11, color: AppColors.gray400)),
            ],
          ),
        ),
      ],
    );
  }
}
