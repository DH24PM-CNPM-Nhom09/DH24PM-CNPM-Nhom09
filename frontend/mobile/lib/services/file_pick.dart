// Chọn tệp minh chứng: chụp ảnh bằng camera, chọn ảnh trong máy, hoặc chọn tệp PDF.
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../config.dart';
import '../theme/app_theme.dart';

class PickedFile {
  final List<int> bytes;
  final String name;
  final String mimeType;
  const PickedFile(this.bytes, this.name, this.mimeType);

  int get sizeKb => (bytes.length / 1024).ceil();
}

class FilePickException implements Exception {
  final String message;
  const FilePickException(this.message);
  @override
  String toString() => message;
}

String? _mimeOf(String name) {
  final n = name.toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.png')) return 'image/png';
  return null;
}

/// Hỏi nguồn tệp rồi trả về tệp đã kiểm tra (định dạng, ≤ 5MB). null = người dùng bỏ qua.
Future<PickedFile?> pickEvidence(BuildContext context, {String? title}) async {
  final source = await showModalBottomSheet<String>(
    context: context,
    showDragHandle: true,
    builder: (c) => SafeArea(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        if (title != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          ),
        ListTile(
          leading: const Icon(Icons.photo_camera_outlined, color: AppColors.accent),
          title: const Text('Chụp ảnh giấy tờ'),
          subtitle: const Text('Đặt giấy tờ trên nền phẳng, đủ sáng, chụp thẳng'),
          onTap: () => Navigator.pop(c, 'camera'),
        ),
        ListTile(
          leading: const Icon(Icons.photo_library_outlined, color: AppColors.accent),
          title: const Text('Chọn ảnh có sẵn'),
          onTap: () => Navigator.pop(c, 'gallery'),
        ),
        ListTile(
          leading: const Icon(Icons.picture_as_pdf_outlined, color: AppColors.accent),
          title: const Text('Chọn tệp PDF / ảnh trong máy'),
          subtitle: const Text('Bản scan PDF, JPG hoặc PNG, tối đa 5MB'),
          onTap: () => Navigator.pop(c, 'file'),
        ),
        const SizedBox(height: 8),
      ]),
    ),
  );
  if (source == null) return null;

  PickedFile? f;
  if (source == 'file') {
    final x = await FilePicker.pickFile(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png'],
    );
    if (x == null) return null;
    List<int> bytes;
    try {
      bytes = await x.xFile.readAsBytes();
    } catch (_) {
      throw const FilePickException('Không đọc được tệp đã chọn.');
    }
    final mime = _mimeOf(x.name);
    if (mime == null) throw const FilePickException('Chỉ nhận tệp PDF, JPG hoặc PNG.');
    f = PickedFile(bytes, x.name, mime);
  } else {
    // Ảnh chụp được nén về JPEG (chất lượng 85%, cạnh dài ≤ 2400px) — vẫn đọc rõ chữ, thường < 2MB
    final x = await ImagePicker().pickImage(
      source: source == 'camera' ? ImageSource.camera : ImageSource.gallery,
      imageQuality: 85,
      maxWidth: 2400,
      maxHeight: 2400,
    );
    if (x == null) return null;
    final bytes = await x.readAsBytes();
    var name = x.name;
    var mime = _mimeOf(name);
    if (mime == null) {
      // Một số máy trả về .heic/.webp — đổi tên thành .jpg vì image_picker đã nén lại sang JPEG
      name = '${name.split('.').first}.jpg';
      mime = 'image/jpeg';
    }
    f = PickedFile(bytes, name, mime);
  }

  if (f.bytes.isEmpty) throw const FilePickException('Tệp rỗng, vui lòng chọn tệp khác.');
  if (f.bytes.length > AppConfig.maxFileBytes) {
    throw const FilePickException('Tệp vượt quá 5MB. Hãy chụp lại hoặc nén/scan lại tệp nhỏ hơn.');
  }
  return f;
}
