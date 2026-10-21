// Đọc mã QR trên Căn cước công dân gắn chip (mặt trước, góc trên bên phải).
// Nội dung: số CCCD | số CMND cũ | họ tên | ngày sinh ddmmyyyy | giới tính | nơi thường trú | ngày cấp ddmmyyyy
// Đọc từ QR là chính xác tuyệt đối nên dùng để điền sẵn — người dùng vẫn kiểm tra lại.

class IdCardFields {
  final String idNumber;
  final String? oldIdNumber;
  final String? fullName;
  final String? dob; // yyyy-mm-dd
  final String? gender; // NAM | NU
  final String? permanentAddress;
  final String? idIssueDate; // yyyy-mm-dd

  const IdCardFields({
    required this.idNumber,
    this.oldIdNumber,
    this.fullName,
    this.dob,
    this.gender,
    this.permanentAddress,
    this.idIssueDate,
  });
}

/// ddmmyyyy hoặc dd/mm/yyyy -> yyyy-mm-dd; sai ngày thì null
String? toIsoDate(String? s) {
  if (s == null) return null;
  final m = RegExp(r'^(\d{1,2})[/\-. ]?(\d{1,2})[/\-. ]?(\d{4})$').firstMatch(s.trim());
  if (m == null) return null;
  final d = int.parse(m.group(1)!), mo = int.parse(m.group(2)!), y = int.parse(m.group(3)!);
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1) return null;
  final dt = DateTime.utc(y, mo, d);
  if (dt.month != mo || dt.day != d) return null;
  return '$y-${mo.toString().padLeft(2, '0')}-${d.toString().padLeft(2, '0')}';
}

IdCardFields? parseCccdQr(String text) {
  final parts = text.split('|').map((x) => x.trim()).toList();
  if (parts.length < 6 || !RegExp(r'^\d{12}$').hasMatch(parts[0])) return null;
  final g = parts[4].toLowerCase();
  return IdCardFields(
    idNumber: parts[0],
    oldIdNumber: RegExp(r'^\d{9}$').hasMatch(parts[1]) ? parts[1] : null,
    fullName: parts[2].isEmpty ? null : parts[2],
    dob: toIsoDate(parts[3]),
    gender: g.startsWith('nam') ? 'NAM' : (g.startsWith('n') ? 'NU' : null),
    permanentAddress: parts[5].isEmpty ? null : parts[5],
    idIssueDate: parts.length > 6 ? toIsoDate(parts[6]) : null,
  );
}
