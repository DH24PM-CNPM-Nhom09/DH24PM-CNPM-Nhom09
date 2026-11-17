// Định dạng ngày giờ, tiền theo kiểu Việt Nam. Giờ hiển thị luôn theo giờ Việt Nam (UTC+7),
// không phụ thuộc múi giờ đặt trên điện thoại.

DateTime? parseIso(String? iso) {
  if (iso == null || iso.isEmpty) return null;
  final d = DateTime.tryParse(iso);
  if (d == null) return null;
  // Chuỗi chỉ có ngày (yyyy-mm-dd) giữ nguyên, chuỗi có giờ đổi sang giờ Việt Nam
  if (iso.length <= 10) return DateTime(d.year, d.month, d.day);
  return d.toUtc().add(const Duration(hours: 7));
}

String _pad2(int v) => v.toString().padLeft(2, '0');

/// dd/mm/yyyy
String fmtDate(String? iso) {
  final d = parseIso(iso);
  return d == null ? '' : '${_pad2(d.day)}/${_pad2(d.month)}/${d.year}';
}

/// HH:mm dd/mm/yyyy
String fmtDateTime(String? iso) {
  final d = parseIso(iso);
  return d == null ? '' : '${_pad2(d.hour)}:${_pad2(d.minute)} ${_pad2(d.day)}/${_pad2(d.month)}/${d.year}';
}

/// yyyy-mm-dd từ DateTime (dùng gửi lên API)
String toYmd(DateTime d) => '${d.year}-${_pad2(d.month)}-${_pad2(d.day)}';

/// "còn 3 ngày", "còn 5 giờ", "đã hết hạn"
String timeLeft(String? iso) {
  final d = iso == null ? null : DateTime.tryParse(iso);
  if (d == null) return '';
  final diff = d.difference(DateTime.now());
  if (diff.isNegative) return 'đã hết hạn';
  if (diff.inDays >= 1) return 'còn ${diff.inDays} ngày';
  if (diff.inHours >= 1) return 'còn ${diff.inHours} giờ';
  return 'còn ${diff.inMinutes.clamp(1, 59)} phút';
}

bool isPast(String? iso) {
  final d = iso == null ? null : DateTime.tryParse(iso);
  return d != null && d.isBefore(DateTime.now());
}

/// 1.100.000 đ
String fmtMoney(num v) {
  final s = v.round().abs().toString();
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write('.');
    b.write(s[i]);
  }
  return '${v < 0 ? '-' : ''}$b đ';
}

String fmtSize(int kb) => kb >= 1024 ? '${(kb / 1024).toStringAsFixed(1).replaceAll('.', ',')} MB' : '$kb KB';

/// 7,25 (dấu phẩy thập phân, tối đa 2 chữ số)
String fmtScore(num? v) {
  if (v == null) return '—';
  final r = (v * 100).round() / 100;
  final s = r == r.roundToDouble() ? r.toInt().toString() : r.toString();
  return s.replaceAll('.', ',');
}

/// Bỏ dấu tiếng Việt, viết hoa — để so tên
String foldVi(String s) {
  const from = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
  const to = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';
  final b = StringBuffer();
  for (final ch in s.toLowerCase().split('')) {
    final i = from.indexOf(ch);
    b.write(i >= 0 ? to[i] : ch);
  }
  return b.toString().toUpperCase().replaceAll(RegExp(r'[^A-Z0-9 ]+'), ' ').replaceAll(RegExp(r'\s+'), ' ').trim();
}
