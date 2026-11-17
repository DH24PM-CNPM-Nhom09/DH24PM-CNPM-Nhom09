import 'package:flutter/material.dart';
import 'package:printing/printing.dart';

import '../services/app_state.dart';
import '../services/pdf_service.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

/// Giấy báo trúng tuyển (yêu cầu 3): tạo PDF ngay trên máy, xem trước, tải về / chia sẻ (Zalo, email…).
class AdmissionLetterScreen extends StatelessWidget {
  const AdmissionLetterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final a = appState.activeApplication;
    final p = appState.profile;
    final e = a?.admission?.enrollment;
    final r = a?.admission?.result;
    if (a == null || p == null || e == null || r == null || e.status == 'TU_CHOI_QUA_HAN') {
      return Scaffold(
        appBar: AppBar(title: const Text('Giấy báo trúng tuyển')),
        body: const EmptyView(
          icon: Icons.hourglass_empty,
          title: 'Chưa có giấy báo',
          message: 'Giấy báo có sau khi quyết định công nhận trúng tuyển được ký ban hành.',
        ),
      );
    }
    final letter = LetterData(
      fullName: p.fullName,
      dob: p.dob,
      gender: p.gender,
      idNumber: p.idNumber,
      applicationCode: a.applicationCode,
      degreeLevel: a.degreeLevel,
      batchName: a.batch.batchName,
      majorName: a.major.majorName,
      majorCode: a.major.majorCode,
      total: r.total,
      decisionNo: e.decisionNo ?? '',
      decisionDate: e.decisionDate,
      deadline: e.deadline,
      confirmedAt: e.confirmedAt,
      studentCode: e.studentCode,
    );
    final fileName = 'Giay-bao-trung-tuyen-${safeFileName(a.applicationCode)}.pdf';
    return Scaffold(
      appBar: AppBar(title: const Text('Giấy báo trúng tuyển')),
      body: Column(children: [
        Container(
          width: double.infinity,
          color: AppColors.info50,
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          child: const Text(
            'Bấm nút chia sẻ để lưu PDF vào máy hoặc gửi qua Zalo/email. Mang giấy báo khi làm thủ tục nhập học.',
            style: TextStyle(color: AppColors.info, fontSize: 12.5),
          ),
        ),
        Expanded(
          child: PdfPreview(
            build: (_) => PdfService.admissionLetter(letter),
            pdfFileName: fileName,
            canChangePageFormat: false,
            canChangeOrientation: false,
            canDebug: false,
            allowPrinting: true,
            allowSharing: true,
            loadingWidget: const LoadingView(text: 'Đang tạo giấy báo…'),
          ),
        ),
      ]),
    );
  }
}
