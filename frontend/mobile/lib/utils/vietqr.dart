// Mã VietQR (chuẩn EMVCo của NAPAS) — giống src/lib/vietqr.ts của bản web.
// Mọi app ngân hàng tại Việt Nam quét được; đã điền sẵn tài khoản, số tiền, nội dung.

const _banks = <String, String>{
  '970405': 'Agribank',
  '970436': 'Vietcombank',
  '970415': 'VietinBank',
  '970418': 'BIDV',
  '970407': 'Techcombank',
  '970422': 'MB',
  '970416': 'ACB',
  '970432': 'VPBank',
  '970403': 'Sacombank',
  '970423': 'TPBank',
  '970441': 'VIB',
  '970443': 'SHB',
  '970437': 'HDBank',
  '970448': 'OCB',
  '970426': 'MSB',
  '970440': 'SeABank',
  '970431': 'Eximbank',
  '970449': 'LPBank',
  '970428': 'Nam A Bank',
  '970409': 'Bac A Bank',
  '970452': 'KienlongBank',
  '970400': 'Saigonbank',
  '970438': 'BaoViet Bank',
  '970412': 'PVcomBank',
  '970425': 'ABBANK',
  '970419': 'NCB',
  '970454': 'BVBank',
  '970430': 'PGBank',
  '970406': 'DongA Bank',
  '970446': 'Co-opBank',
};

String? bankShortName(String? bin) => bin == null ? null : _banks[bin];

/// CRC-16/CCITT-FALSE (khởi tạo 0xFFFF, đa thức 0x1021)
String _crc16(String s) {
  var crc = 0xffff;
  for (final c in s.codeUnits) {
    crc ^= c << 8;
    for (var k = 0; k < 8; k++) {
      crc = (crc & 0x8000) != 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toRadixString(16).toUpperCase().padLeft(4, '0');
}

String _field(String id, String value) => '$id${value.length.toString().padLeft(2, '0')}$value';

const _accentFrom = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
const _accentTo = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';

/// Nội dung chuyển khoản an toàn cho mọi ngân hàng: không dấu, chỉ chữ, số, khoảng trắng, tối đa 25 ký tự
String cleanTransferNote(String s) {
  final b = StringBuffer();
  for (final ch in s.split('')) {
    final lower = ch.toLowerCase();
    final i = _accentFrom.indexOf(lower);
    if (i >= 0) {
      final r = _accentTo[i];
      b.write(ch == lower ? r : r.toUpperCase());
    } else {
      b.write(ch);
    }
  }
  final out = b.toString().replaceAll(RegExp(r'[^A-Za-z0-9 ]'), '').replaceAll(RegExp(r'\s+'), ' ').trim();
  return out.length > 25 ? out.substring(0, 25) : out;
}

/// Chuỗi dữ liệu VietQR: chuyển khoản tới tài khoản, có số tiền và nội dung
String vietQrPayload({required String bin, required String accountNo, num? amount, String? note}) {
  final account = _field('00', bin) + _field('01', accountNo.replaceAll(RegExp(r'\s'), ''));
  final merchant = _field('00', 'A000000727') + _field('01', account) + _field('02', 'QRIBFTTA');
  final amt = amount != null && amount > 0 ? amount.round().toString() : '';
  final n = note == null ? '' : cleanTransferNote(note);
  final body = '${_field('00', '01')}${_field('01', amt.isNotEmpty ? '12' : '11')}${_field('38', merchant)}${_field('53', '704')}${amt.isNotEmpty ? _field('54', amt) : ''}${_field('58', 'VN')}${n.isNotEmpty ? _field('62', _field('08', n)) : ''}6304';
  return body + _crc16(body);
}
