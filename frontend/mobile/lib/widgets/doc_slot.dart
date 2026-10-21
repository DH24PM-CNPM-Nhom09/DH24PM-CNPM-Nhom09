import 'package:flutter/material.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../services/api_service.dart';
import '../services/file_pick.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../utils/labels.dart';
import 'common.dart';

/// Một loại minh chứng: tên, hướng dẫn, các tệp đã nộp (kèm kết quả kiểm tra), nút tải thêm.
/// Sau mỗi lần tải/xóa gọi onChanged để màn hình cha nạp lại hồ sơ.
class DocSlot extends StatefulWidget {
  final FullApplication app;
  final String type;
  final bool required;
  final bool canUpload;
  final bool canDelete;
  final Future<void> Function() onChanged;
  final Widget? extra;

  const DocSlot({
    super.key,
    required this.app,
    required this.type,
    required this.required,
    required this.canUpload,
    required this.canDelete,
    required this.onChanged,
    this.extra,
  });

  @override
  State<DocSlot> createState() => _DocSlotState();
}

class _DocSlotState extends State<DocSlot> {
  bool _busy = false;
  String _error = '';

  Future<void> _upload() async {
    setState(() => _error = '');
    PickedFile? f;
    try {
      f = await pickEvidence(context, title: docName(widget.type));
    } on FilePickException catch (e) {
      setState(() => _error = e.message);
      return;
    } catch (e) {
      setState(() => _error = 'Không mở được camera / thư viện ảnh. Kiểm tra quyền truy cập của app.');
      return;
    }
    if (f == null) return;
    setState(() => _busy = true);
    try {
      final dup = await apiService.uploadDocument(
        applicationId: widget.app.applicationId,
        documentType: widget.type,
        bytes: f.bytes,
        fileName: f.name,
        mimeType: f.mimeType,
      );
      await widget.onChanged();
      if (mounted) {
        showSnack(context,
            dup ? 'Đã tải lên, nhưng tệp trùng nội dung với tệp bạn đã nộp — kiểm tra lại nếu chọn nhầm.' : 'Đã tải lên ${f.name}');
      }
    } catch (e) {
      if (mounted) setState(() => _error = errText(e, 'Tải tệp thất bại, vui lòng thử lại.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete(AppDocument d) async {
    final ok = await confirmDialog(context,
        title: 'Xóa tệp?', message: 'Xóa "${d.fileName}" khỏi hồ sơ?', ok: 'Xóa', danger: true);
    if (!ok) return;
    setState(() => _busy = true);
    try {
      await apiService.deleteDocument(d.documentId);
      await widget.onChanged();
    } catch (e) {
      if (mounted) setState(() => _error = errText(e, 'Không xóa được tệp.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final docs = widget.app.docsOf(widget.type);
    final missing = widget.required && docs.isEmpty;
    final invalid = docs.any((d) => d.verifyStatus == 'INVALID');
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: missing || invalid ? AppColors.warning : AppColors.gray200),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Text.rich(
              TextSpan(
                style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: AppColors.gray900),
                children: [
                  TextSpan(text: docName(widget.type)),
                  if (widget.required) const TextSpan(text: ' *', style: TextStyle(color: AppColors.danger)),
                ],
              ),
            ),
          ),
          if (docs.isNotEmpty)
            const Icon(Icons.check_circle, color: AppColors.success, size: 20)
          else if (widget.required)
            const ToneBadge((AppColors.warning50, AppColors.warning, 'Còn thiếu'), small: true),
        ]),
        if (docHint[widget.type] != null) ...[
          const SizedBox(height: 4),
          Text(docHint[widget.type]!, style: const TextStyle(fontSize: 12.5, color: AppColors.gray500, height: 1.35)),
        ],
        if (widget.extra != null) ...[const SizedBox(height: 8), widget.extra!],
        for (final d in docs)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Container(
              padding: const EdgeInsets.fromLTRB(10, 8, 4, 8),
              decoration: BoxDecoration(color: AppColors.gray50, borderRadius: BorderRadius.circular(8)),
              child: Row(children: [
                Icon(d.fileName.toLowerCase().endsWith('.pdf') ? Icons.picture_as_pdf : Icons.image_outlined,
                    size: 20, color: AppColors.gray500),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(d.fileName,
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 2),
                    Row(children: [
                      Text(fmtSize(d.fileSizeKb), style: const TextStyle(fontSize: 11.5, color: AppColors.gray500)),
                      const SizedBox(width: 8),
                      ToneBadge(verifyTone(d.verifyStatus), small: true),
                    ]),
                    if (d.verifyNote != null && d.verifyNote!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text('Ghi chú: ${d.verifyNote}',
                            style: const TextStyle(fontSize: 12, color: AppColors.danger, height: 1.3)),
                      ),
                  ]),
                ),
                if (widget.canDelete)
                  IconButton(
                    tooltip: 'Xóa',
                    onPressed: _busy ? null : () => _delete(d),
                    icon: const Icon(Icons.delete_outline, color: AppColors.gray500, size: 20),
                  ),
              ]),
            ),
          ),
        if (_error.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(_error, style: const TextStyle(color: AppColors.danger, fontSize: 12.5)),
          ),
        if (widget.canUpload) ...[
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _busy ? null : _upload,
              icon: _busy
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.add_a_photo_outlined, size: 18),
              label: Text(_busy ? 'Đang xử lý…' : (docs.isEmpty ? 'Chụp / chọn tệp' : 'Tải thêm tệp')),
            ),
          ),
        ],
      ]),
    );
  }
}
