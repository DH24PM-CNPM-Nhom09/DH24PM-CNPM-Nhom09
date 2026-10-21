// Tạo tệp PDF ngay trên điện thoại (không cần mạng):
//   • Giấy báo trúng tuyển (yêu cầu 3) — giống bản web: có mã QR đối chiếu hồ sơ.
//   • Điều kiện tuyển sinh của một đợt (yêu cầu 2).
// Dùng phông Roboto đóng gói kèm app để hiển thị đúng tiếng Việt.
import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../models/models.dart';
import '../utils/format.dart';
import '../utils/labels.dart';

class LetterData {
  final String fullName;
  final String? dob;
  final String? gender;
  final String? idNumber;
  final String applicationCode;
  final String degreeLevel;
  final String batchName;
  final String majorName;
  final String majorCode;
  final double? total;
  final String decisionNo;
  final String? decisionDate;
  final String? deadline;
  final String? confirmedAt;
  final String? studentCode;

  const LetterData({
    required this.fullName,
    required this.dob,
    required this.gender,
    required this.idNumber,
    required this.applicationCode,
    required this.degreeLevel,
    required this.batchName,
    required this.majorName,
    required this.majorCode,
    required this.total,
    required this.decisionNo,
    required this.decisionDate,
    required this.deadline,
    required this.confirmedAt,
    required this.studentCode,
  });

  String get qrText => 'GIAY BAO TRUNG TUYEN|$applicationCode|QD $decisionNo|${decisionDate ?? ''}';
}

String safeFileName(String s) => s.replaceAll(RegExp(r'[^A-Za-z0-9._-]+'), '-');

class PdfService {
  static pw.ThemeData? _theme;

  static Future<pw.ThemeData> _loadTheme() async {
    if (_theme != null) return _theme!;
    Future<pw.Font> f(String n) async => pw.Font.ttf(await rootBundle.load('assets/fonts/$n.ttf'));
    _theme = pw.ThemeData.withFont(
      base: await f('Roboto-Regular'),
      bold: await f('Roboto-Medium'),
      italic: await f('Roboto-Italic'),
      boldItalic: await f('Roboto-MediumItalic'),
    );
    return _theme!;
  }

  static String _todayLine() {
    final d = DateTime.now().toUtc().add(const Duration(hours: 7));
    String two(int v) => v.toString().padLeft(2, '0');
    return 'An Giang, ngày ${two(d.day)} tháng ${two(d.month)} năm ${d.year}';
  }

  static pw.Widget _nationalHeader() => pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Expanded(
          flex: 42,
          child: pw.Column(children: [
            pw.Text('ĐẠI HỌC QUỐC GIA TP. HỒ CHÍ MINH', style: const pw.TextStyle(fontSize: 9.5)),
            pw.Text('TRƯỜNG ĐẠI HỌC AN GIANG', style: const pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 2),
            pw.Container(width: 90, height: 0.7, color: PdfColors.black),
          ]),
        ),
        pw.Expanded(
          flex: 58,
          child: pw.Column(children: [
            pw.Text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', style: const pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
            pw.Text('Độc lập - Tự do - Hạnh phúc', style: const pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 2),
            pw.Container(width: 115, height: 0.7, color: PdfColors.black),
          ]),
        ),
      ]);

  // ====================================================================== giấy báo trúng tuyển
  static Future<Uint8List> admissionLetter(LetterData l) async {
    final theme = await _loadTheme();
    final degree = l.degreeLevel == 'TIEN_SI' ? 'tiến sĩ' : 'thạc sĩ';
    final degreeCap = degree[0].toUpperCase() + degree.substring(1);
    final info = <(String, String)>[
      ('Họ và tên:', l.fullName.toUpperCase()),
      ('Ngày sinh:', '${fmtDate(l.dob)}${genderLabel[l.gender] != null ? '        Giới tính: ${genderLabel[l.gender]}' : ''}'),
      if (l.idNumber != null && l.idNumber!.isNotEmpty) ('Số CCCD:', l.idNumber!),
      ('Mã hồ sơ:', l.applicationCode),
      ('Ngành trúng tuyển:', '${l.majorName} (mã ${l.majorCode})'),
      ('Trình độ:', degreeCap),
      if (l.total != null) ('Tổng điểm xét tuyển:', fmtScore(l.total)),
    ];
    final steps = [
      'Xác nhận nhập học trên Cổng tuyển sinh sau đại học${l.deadline != null ? ' trước ${fmtDateTime(l.deadline)}' : ' trong thời hạn quy định'}. '
          'Quá hạn không xác nhận được xem như từ chối nhập học.',
      'Nộp bản chính (hoặc bản sao chứng thực) văn bằng, bảng điểm, chứng chỉ đã khai khi đăng ký và giấy báo này '
          'tại Phòng Đào tạo Sau đại học để đối chiếu.',
      'Sau khi đối chiếu hồ sơ, Nhà trường hoàn tất thủ tục và cấp mã học viên trên Cổng tuyển sinh.',
    ];
    const base = pw.TextStyle(fontSize: 12, lineSpacing: 3);

    final doc = pw.Document(title: 'Giấy báo trúng tuyển', author: 'Cổng tuyển sinh sau đại học');
    doc.addPage(pw.Page(
      theme: theme,
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.fromLTRB(56, 42, 48, 42),
      build: (ctx) => pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        _nationalHeader(),
        pw.SizedBox(height: 10),
        pw.Align(
          alignment: pw.Alignment.centerRight,
          child: pw.Text(_todayLine(), style: const pw.TextStyle(fontSize: 10.5, fontStyle: pw.FontStyle.italic)),
        ),
        pw.SizedBox(height: 20),
        pw.Center(child: pw.Text('GIẤY BÁO TRÚNG TUYỂN', style: const pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold))),
        pw.SizedBox(height: 2),
        pw.Center(
            child: pw.Text('Trình độ $degree — ${l.batchName}', style: const pw.TextStyle(fontStyle: pw.FontStyle.italic))),
        pw.SizedBox(height: 18),
        pw.Text('Trường Đại học An Giang trân trọng thông báo:', style: base),
        pw.SizedBox(height: 6),
        pw.Padding(
          padding: const pw.EdgeInsets.only(left: 14),
          child: pw.Table(
            columnWidths: {0: const pw.FixedColumnWidth(140), 1: const pw.FlexColumnWidth()},
            children: info
                .map((r) => pw.TableRow(children: [
                      pw.Padding(padding: const pw.EdgeInsets.symmetric(vertical: 2), child: pw.Text(r.$1, style: base)),
                      pw.Padding(
                        padding: const pw.EdgeInsets.symmetric(vertical: 2),
                        child: pw.Text(r.$2, style: base.copyWith(fontWeight: pw.FontWeight.bold)),
                      ),
                    ]))
                .toList(),
          ),
        ),
        pw.SizedBox(height: 10),
        pw.RichText(
          textAlign: pw.TextAlign.justify,
          text: pw.TextSpan(style: base, children: [
            const pw.TextSpan(text: 'đã '),
            const pw.TextSpan(text: 'TRÚNG TUYỂN', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
            pw.TextSpan(text: ' trình độ $degree theo Quyết định số '),
            pw.TextSpan(text: l.decisionNo, style: const pw.TextStyle(fontWeight: pw.FontWeight.bold)),
            pw.TextSpan(
                text: '${l.decisionDate != null ? ' ngày ${fmtDate(l.decisionDate)}' : ''} của Hiệu trưởng Trường Đại học An Giang.'),
          ]),
        ),
        pw.SizedBox(height: 14),
        pw.Text('Thủ tục nhập học', style: base.copyWith(fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 4),
        ...List.generate(
          steps.length,
          (i) => pw.Padding(
            padding: const pw.EdgeInsets.only(left: 10, bottom: 3),
            child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.SizedBox(width: 16, child: pw.Text('${i + 1}.', style: base)),
              pw.Expanded(child: pw.Text(steps[i], style: base, textAlign: pw.TextAlign.justify)),
            ]),
          ),
        ),
        if (l.confirmedAt != null)
          pw.Padding(
            padding: const pw.EdgeInsets.only(top: 8),
            child: pw.Text('Thí sinh đã xác nhận nhập học lúc ${fmtDateTime(l.confirmedAt)}.',
                style: base.copyWith(fontStyle: pw.FontStyle.italic)),
          ),
        if (l.studentCode != null)
          pw.Padding(
            padding: const pw.EdgeInsets.only(top: 4),
            child: pw.RichText(
                text: pw.TextSpan(style: base, children: [
              const pw.TextSpan(text: 'Mã học viên: '),
              pw.TextSpan(text: l.studentCode, style: const pw.TextStyle(fontWeight: pw.FontWeight.bold)),
            ])),
          ),
        pw.SizedBox(height: 26),
        pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.SizedBox(
            width: 150,
            child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.BarcodeWidget(barcode: pw.Barcode.qrCode(), data: l.qrText, width: 84, height: 84),
              pw.SizedBox(height: 3),
              pw.Text('Mã đối chiếu hồ sơ', style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700)),
            ]),
          ),
          pw.Spacer(),
          pw.SizedBox(
            width: 230,
            child: pw.Column(children: [
              pw.Text('PHÒNG ĐÀO TẠO SAU ĐẠI HỌC', style: const pw.TextStyle(fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 2),
              pw.Text('(Giấy báo được tạo tự động từ Cổng tuyển sinh sau đại học, căn cứ quyết định nêu trên)',
                  textAlign: pw.TextAlign.center, style: const pw.TextStyle(fontSize: 9, fontStyle: pw.FontStyle.italic)),
            ]),
          ),
        ]),
      ]),
    ));
    return doc.save();
  }

  static Future<void> shareAdmissionLetter(LetterData l) async {
    final bytes = await admissionLetter(l);
    await Printing.sharePdf(bytes: bytes, filename: 'Giay-bao-trung-tuyen-${safeFileName(l.applicationCode)}.pdf');
  }

  // ====================================================================== điều kiện tuyển sinh
  static Future<Uint8List> conditions(OpenBatch b) async {
    final theme = await _loadTheme();
    final degree = degreeLabel[b.degreeLevel] ?? b.degreeLevel;
    pw.Widget h(String t) => pw.Padding(
          padding: const pw.EdgeInsets.only(top: 14, bottom: 6),
          child: pw.Text(t, style: const pw.TextStyle(fontSize: 12.5, fontWeight: pw.FontWeight.bold)),
        );
    pw.Widget cell(String t, {bool bold = false, pw.TextAlign align = pw.TextAlign.left}) => pw.Padding(
          padding: const pw.EdgeInsets.symmetric(horizontal: 4, vertical: 3),
          child: pw.Text(t, textAlign: align, style: pw.TextStyle(fontSize: 9.5, fontWeight: bold ? pw.FontWeight.bold : null)),
        );
    pw.Widget table(List<String> head, List<List<String>> rows, Map<int, pw.TableColumnWidth> widths) => pw.Table(
          border: pw.TableBorder.all(color: PdfColors.grey600, width: 0.5),
          columnWidths: widths,
          children: [
            pw.TableRow(
              decoration: const pw.BoxDecoration(color: PdfColors.grey200),
              children: head.map((t) => cell(t, bold: true, align: pw.TextAlign.center)).toList(),
            ),
            ...rows.map((r) => pw.TableRow(children: r.map((t) => cell(t)).toList())),
          ],
        );

    final doc = pw.Document(title: 'Điều kiện tuyển sinh ${b.batchCode}', author: 'Cổng tuyển sinh sau đại học');
    doc.addPage(pw.MultiPage(
      theme: theme,
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.fromLTRB(48, 40, 40, 40),
      footer: (ctx) => pw.Row(children: [
        pw.Text('Tạo từ ứng dụng Tuyển sinh Sau đại học — ${fmtDateTime(DateTime.now().toUtc().toIso8601String())}',
            style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600)),
        pw.Spacer(),
        pw.Text('Trang ${ctx.pageNumber}/${ctx.pagesCount}', style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600)),
      ]),
      build: (ctx) => [
        _nationalHeader(),
        pw.SizedBox(height: 18),
        pw.Center(
            child: pw.Text('ĐIỀU KIỆN TUYỂN SINH TRÌNH ĐỘ ${degree.toUpperCase()}',
                style: const pw.TextStyle(fontSize: 15, fontWeight: pw.FontWeight.bold))),
        pw.Center(child: pw.Text(b.batchName, style: const pw.TextStyle(fontStyle: pw.FontStyle.italic))),
        h('I. THÔNG TIN ĐỢT TUYỂN SINH'),
        table(['Mục', 'Nội dung'], [
          ['Mã đợt', b.batchCode],
          ['Trình độ', degree],
          ['Thời gian nhận hồ sơ', '${fmtDateTime(b.registrationStartAt)} – ${fmtDateTime(b.registrationEndAt)}'],
          if (b.examStartAt != null)
            ['Thời gian thi / xét tuyển', '${fmtDate(b.examStartAt)}${b.examEndAt != null ? ' – ${fmtDate(b.examEndAt)}' : ''}'],
          if (b.legalBasis != null) ['Căn cứ', b.legalBasis!],
        ], {
          0: const pw.FixedColumnWidth(150),
          1: const pw.FlexColumnWidth()
        }),
        h('II. NGÀNH VÀ CHỈ TIÊU'),
        table(
          ['STT', 'Mã ngành', 'Tên ngành', 'Khoa', 'Chỉ tiêu'],
          [
            for (var i = 0; i < b.majors.length; i++)
              ['${i + 1}', b.majors[i].majorCode, b.majors[i].majorName, b.majors[i].facultyName ?? '', '${b.majors[i].quota}'],
          ],
          {
            0: const pw.FixedColumnWidth(30),
            1: const pw.FixedColumnWidth(65),
            2: const pw.FlexColumnWidth(3),
            3: const pw.FlexColumnWidth(2),
            4: const pw.FixedColumnWidth(50)
          },
        ),
        h('III. ĐIỀU KIỆN DỰ TUYỂN'),
        table(
          ['Ngành', 'Điều kiện', 'Điểm TB tối thiểu', 'Chứng chỉ', 'Bắt buộc'],
          [
            for (final m in b.majors)
              for (final c in m.conditions)
                [m.majorName, c.description, c.minGpa == null ? '' : fmtScore(c.minGpa), c.requiredCertificate ?? '', c.isMandatory ? 'Có' : 'Không'],
          ],
          {
            0: const pw.FlexColumnWidth(2),
            1: const pw.FlexColumnWidth(3),
            2: const pw.FixedColumnWidth(60),
            3: const pw.FlexColumnWidth(1.5),
            4: const pw.FixedColumnWidth(45)
          },
        ),
        h('IV. HÌNH THỨC XÉT TUYỂN'),
        table(
          ['Ngành', 'Môn / nội dung', 'Hình thức', 'Trọng số'],
          [
            for (final m in b.majors)
              for (final s in m.subjects)
                [
                  m.majorName,
                  s.subjectName,
                  examFormatLabel[s.examFormat] ?? s.examFormat,
                  s.weight == null ? '' : '${fmtScore(s.weight! <= 1 ? s.weight! * 100 : s.weight!)}%',
                ],
          ],
          {0: const pw.FlexColumnWidth(2), 1: const pw.FlexColumnWidth(2.5), 2: const pw.FlexColumnWidth(1.3), 3: const pw.FixedColumnWidth(55)},
        ),
      ],
    ));
    return doc.save();
  }

  static Future<void> shareConditions(OpenBatch b) async {
    final bytes = await conditions(b);
    await Printing.sharePdf(bytes: bytes, filename: 'Dieu-kien-tuyen-sinh-${safeFileName(b.batchCode)}.pdf');
  }
}

