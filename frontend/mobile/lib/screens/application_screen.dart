import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../services/api_service.dart';
import '../services/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../utils/labels.dart';
import '../utils/vietqr.dart';
import '../widgets/app_button.dart';
import '../widgets/app_card.dart';
import '../widgets/app_text_field.dart';
import '../widgets/common.dart';
import '../widgets/doc_slot.dart';
import 'admission_letter_screen.dart';
import 'wizard/application_wizard_screen.dart';

/// Tab "Hồ sơ": tình trạng hồ sơ, lệ phí (VietQR), bổ sung minh chứng, lịch thi, điểm, kết quả, nhập học.
class ApplicationScreen extends StatelessWidget {
  const ApplicationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: appState,
      builder: (context, _) {
        if (!appState.loadedOnce) {
          if (appState.error != null) {
            return ErrorView(message: errText(appState.error!, 'Không tải được hồ sơ.'), onRetry: appState.refresh);
          }
          return const LoadingView();
        }
        final a = appState.activeApplication;
        Future<void> openWizard() async {
          await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ApplicationWizardScreen()));
          await appState.refresh();
        }

        return RefreshIndicator(
          onRefresh: appState.refresh,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            if (a == null) ...[
              if (appState.application?.declined == true)
                InfoBanner.warning('Hồ sơ ${appState.application!.applicationCode} đã hủy do từ chối / quá hạn xác nhận nhập học.'),
              EmptyView(
                icon: Icons.folder_open_outlined,
                title: 'Bạn chưa có hồ sơ xét tuyển',
                message: 'Chọn đợt và ngành đang mở, khai thông tin, chụp minh chứng rồi nộp — tất cả trên điện thoại.',
                action: AppButton(label: 'Tạo hồ sơ xét tuyển', icon: Icons.add, onPressed: openWizard),
              ),
            ] else if (a.isDraft)
              _DraftCard(app: a, onContinue: openWizard)
            else ...[
              _HeaderCard(app: a),
              if (a.reviewStatus == 'NEEDS_SUPPLEMENT') _SupplementCard(app: a),
              if (a.reviewStatus == 'REJECTED') _RejectedCard(app: a),
              if (a.payment != null) _PaymentCard(app: a),
              if (a.englishTest != null) _EnglishTestCard(test: a.englishTest!),
              if (a.admission != null) _AdmissionCard(app: a),
              _DocumentsCard(app: a),
              _HistoryCard(app: a),
            ],
          ]),
        );
      },
    );
  }
}

Widget _gap() => const SizedBox(height: 14);

class _DraftCard extends StatelessWidget {
  final FullApplication app;
  final VoidCallback onContinue;
  const _DraftCard({required this.app, required this.onContinue});

  @override
  Widget build(BuildContext context) {
    final a = app;
    final done = a.requiredDocuments.length - a.missingDocuments.length;
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Expanded(child: Text('Hồ sơ nháp', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800))),
          ToneBadge(reviewTone(a.reviewStatus), small: true),
        ]),
        const SizedBox(height: 8),
        KV('Mã hồ sơ', a.applicationCode),
        KV('Đợt', a.batch.batchName),
        KV('Ngành', a.major.majorName),
        KV('Hạn nộp', '${fmtDateTime(a.batch.registrationEndAt)} (${timeLeft(a.batch.registrationEndAt)})'),
        const SizedBox(height: 8),
        Text('Minh chứng bắt buộc: $done/${a.requiredDocuments.length}',
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        LinearProgressIndicator(
          value: a.requiredDocuments.isEmpty ? 0 : done / a.requiredDocuments.length,
          minHeight: 7,
          borderRadius: BorderRadius.circular(4),
          backgroundColor: AppColors.gray100,
          color: AppColors.accent,
        ),
        const SizedBox(height: 14),
        if (a.canEdit)
          AppButton(label: 'Tiếp tục hoàn thiện & nộp', fullWidth: true, onPressed: onContinue)
        else
          InfoBanner.danger('Đợt tuyển sinh đã hết hạn nhận hồ sơ, bản nháp không nộp được nữa.'),
      ]),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  final FullApplication app;
  const _HeaderCard({required this.app});

  @override
  Widget build(BuildContext context) {
    final a = app;
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: SelectableText(a.applicationCode, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800))),
        ]),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 6, children: [
          ToneBadge(reviewTone(a.reviewStatus)),
          if (a.admissionStatus != 'NONE') ToneBadge(admissionTone(a.admissionStatus)),
        ]),
        const SizedBox(height: 10),
        KV('Đợt', a.batch.batchName),
        KV('Ngành', '${a.major.majorName} (${a.major.majorCode})'),
        KV('Trình độ', degreeLabel[a.degreeLevel]),
        if (a.major.facultyName != null) KV('Khoa', a.major.facultyName),
        KV('Ngày nộp', fmtDateTime(a.submittedAt)),
        if (a.proposal != null) ...[
          KV('Đề tài', a.proposal!.researchTopic),
          if (a.proposal!.lecturerName != null) KV('GVHD đề xuất', a.proposal!.lecturerName),
        ],
      ]),
    ).withGap();
  }
}

class _SupplementCard extends StatefulWidget {
  final FullApplication app;
  const _SupplementCard({required this.app});

  @override
  State<_SupplementCard> createState() => _SupplementCardState();
}

class _SupplementCardState extends State<_SupplementCard> {
  bool _busy = false;

  Future<void> _done() async {
    final ok = await confirmDialog(context,
        title: 'Gửi lại hồ sơ?',
        message: 'Xác nhận bạn đã tải lại đủ các minh chứng được yêu cầu. Hồ sơ sẽ chuyển lại cho cán bộ thẩm định.',
        ok: 'Gửi lại');
    if (!ok) return;
    setState(() => _busy = true);
    try {
      await apiService.submitSupplement();
      await appState.refresh();
      if (mounted) showSnack(context, 'Đã gửi lại hồ sơ cho cán bộ thẩm định.');
    } catch (e) {
      if (mounted) showSnack(context, errText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.app;
    // Loại cần nộp lại: có tệp bị đánh "không hợp lệ" hoặc còn thiếu
    final types = <String>{
      ...a.documents.where((d) => d.verifyStatus == 'INVALID').map((d) => d.documentType),
      ...a.missingDocuments,
    };
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.warning50,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.warning.withValues(alpha: 0.4)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Row(children: [
            Icon(Icons.warning_amber_rounded, color: AppColors.warning),
            SizedBox(width: 8),
            Text('Yêu cầu bổ sung minh chứng', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.warning)),
          ]),
          const SizedBox(height: 8),
          Text(a.supplement?.content ?? 'Cán bộ yêu cầu bổ sung minh chứng.', style: const TextStyle(height: 1.45)),
          if (a.supplement != null) ...[
            const SizedBox(height: 6),
            Text('Hạn bổ sung: ${fmtDateTime(a.supplement!.deadline)} (${timeLeft(a.supplement!.deadline)})',
                style: const TextStyle(fontWeight: FontWeight.w700)),
          ],
        ]),
      ),
      const SizedBox(height: 10),
      ...(types.isEmpty ? a.requiredDocuments : types.toList()).map((t) => DocSlot(
            key: ValueKey('sup-$t'),
            app: a,
            type: t,
            required: a.requiredDocuments.contains(t),
            canUpload: true,
            canDelete: false,
            onChanged: appState.refreshApplication,
          )),
      AppButton(label: 'Tôi đã bổ sung xong — gửi lại hồ sơ', fullWidth: true, loading: _busy, onPressed: _done),
      _gap(),
    ]);
  }
}

class _RejectedCard extends StatelessWidget {
  final FullApplication app;
  const _RejectedCard({required this.app});

  @override
  Widget build(BuildContext context) {
    final reason = app.history.where((h) => h.status == 'REJECTED').map((h) => h.reason).whereType<String>().firstOrNull;
    return InfoBanner.danger(
      'Hồ sơ không đạt thẩm định${reason != null ? ': $reason' : '.'} '
      'Nếu chưa đồng ý, vào Cá nhân → Khiếu nại để gửi yêu cầu xem xét lại.',
    ).withGap();
  }
}

/// Lệ phí xét tuyển + mã VietQR để chuyển khoản
class _PaymentCard extends StatelessWidget {
  final FullApplication app;
  const _PaymentCard({required this.app});

  @override
  Widget build(BuildContext context) {
    final p = app.payment!;
    final bank = p.bank;
    final canQr = (bank.bankBin ?? '').isNotEmpty && bank.accountNo.isNotEmpty;
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SectionTitle('Lệ phí xét tuyển', trailing: ToneBadge(paymentTone(p.status), small: true)),
        ...app.feeItems.map((f) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(children: [
                Expanded(child: Text(f.label, style: const TextStyle(fontSize: 13, color: AppColors.gray600))),
                Text(fmtMoney(f.amount), style: const TextStyle(fontSize: 13)),
              ]),
            )),
        const Divider(),
        Row(children: [
          const Expanded(child: Text('Tổng cộng', style: TextStyle(fontWeight: FontWeight.w700))),
          Text(fmtMoney(p.amount), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17, color: AppColors.accentDark)),
        ]),
        if (p.status == 'SUCCESS') ...[
          const SizedBox(height: 8),
          KV('Biên lai', p.receiptNo),
          KV('Ngày nộp', fmtDateTime(p.paidAt)),
        ],
        if (p.status == 'PENDING') ...[
          const SizedBox(height: 14),
          if (canQr)
            Center(
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(border: Border.all(color: AppColors.gray200), borderRadius: BorderRadius.circular(12)),
                child: Column(children: [
                  QrImageView(
                    data: vietQrPayload(bin: bank.bankBin!, accountNo: bank.accountNo, amount: p.amount, note: p.transferContent),
                    size: 210,
                    backgroundColor: Colors.white,
                  ),
                  const Text('Quét bằng app ngân hàng (VietQR)', style: TextStyle(fontSize: 12, color: AppColors.gray500)),
                ]),
              ),
            ),
          const SizedBox(height: 10),
          KV('Ngân hàng', bankShortName(bank.bankBin) ?? bank.bankName),
          _CopyRow(label: 'Số tài khoản', value: bank.accountNo),
          KV('Chủ tài khoản', bank.accountName),
          _CopyRow(label: 'Nội dung CK', value: p.transferContent),
          const SizedBox(height: 8),
          InfoBanner.info('Ghi đúng nội dung chuyển khoản để Nhà trường đối soát. '
              'Trạng thái chuyển "Đã thanh toán" sau khi cán bộ xác nhận, bạn sẽ nhận thông báo.'),
        ],
      ]),
    ).withGap();
  }
}

class _CopyRow extends StatelessWidget {
  final String label;
  final String value;
  const _CopyRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) => Row(children: [
        Expanded(child: KV(label, value)),
        IconButton(
          tooltip: 'Sao chép',
          icon: const Icon(Icons.copy, size: 18, color: AppColors.gray500),
          onPressed: () {
            Clipboard.setData(ClipboardData(text: value));
            showSnack(context, 'Đã sao chép $label');
          },
        ),
      ]);
}

class _EnglishTestCard extends StatelessWidget {
  final EnglishTest test;
  const _EnglishTestCard({required this.test});

  @override
  Widget build(BuildContext context) {
    final t = test;
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SectionTitle('Thi đánh giá năng lực tiếng Anh', trailing: ToneBadge(englishTone(t.result), small: true)),
        if (t.testAt == null)
          const Text('Chưa có lịch thi. Nhà trường sẽ thông báo số báo danh và phòng thi.',
              style: TextStyle(color: AppColors.gray600, fontSize: 13))
        else ...[
          KV('Số báo danh', t.candidateNumber),
          KV('Thời gian', fmtDateTime(t.testAt)),
          KV('Phòng', [t.room, if (t.seatNo != null) 'ghế ${t.seatNo}'].whereType<String>().join(', ')),
          KV('Địa điểm', t.location),
          if (t.note != null) KV('Ghi chú', t.note, bold: false),
        ],
        if (t.score != null) KV('Điểm', fmtScore(t.score)),
      ]),
    ).withGap();
  }
}

/// Xét tuyển → điểm → kết quả → quyết định → nhập học
class _AdmissionCard extends StatefulWidget {
  final FullApplication app;
  const _AdmissionCard({required this.app});

  @override
  State<_AdmissionCard> createState() => _AdmissionCardState();
}

class _AdmissionCardState extends State<_AdmissionCard> {
  bool _busy = false;

  Future<void> _confirm() async {
    final ok = await confirmDialog(context,
        title: 'Xác nhận nhập học?',
        message: 'Bạn xác nhận sẽ nhập học ngành ${widget.app.major.majorName}. Sau đó nộp bản chính văn bằng để đối chiếu.',
        ok: 'Xác nhận');
    if (!ok) return;
    await _act(() => apiService.confirmEnrollment(), 'Đã xác nhận nhập học. Tải giấy báo trúng tuyển để làm thủ tục.');
  }

  Future<void> _decline() async {
    final reason = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Từ chối nhập học?'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('Hồ sơ sẽ bị hủy và suất trúng tuyển chuyển cho thí sinh dự bị. Không hoàn tác được.'),
          const SizedBox(height: 10),
          TextField(controller: reason, maxLines: 2, decoration: const InputDecoration(hintText: 'Lý do (không bắt buộc)')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Thôi')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Từ chối nhập học'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await _act(() => apiService.declineEnrollment(reason.text.trim()), 'Đã ghi nhận bạn từ chối nhập học.');
  }

  Future<void> _appeal(Scores s) async {
    final picked = <int>{};
    final reason = TextEditingController();
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (c) => StatefulBuilder(
        builder: (c, set) => Padding(
          padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(c).viewInsets.bottom + 20),
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Đơn phúc khảo điểm', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text('Lệ phí ${fmtMoney(s.appealFee)} · hạn nộp ${fmtDateTime(s.appealDeadline)}',
                  style: const TextStyle(color: AppColors.gray500, fontSize: 13)),
              const SizedBox(height: 10),
              ...s.items.where((i) => !i.absent).map((i) => CheckboxListTile(
                    value: picked.contains(i.subjectId),
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text('${i.subjectName} — ${fmtScore(i.score)} điểm'),
                    onChanged: (v) => set(() => v == true ? picked.add(i.subjectId) : picked.remove(i.subjectId)),
                  )),
              AppTextField(label: 'Lý do phúc khảo', required: true, controller: reason, maxLines: 4, hint: 'Ít nhất 20 ký tự'),
              AppButton(
                label: 'Gửi đơn phúc khảo',
                fullWidth: true,
                onPressed: () {
                  if (picked.isEmpty || reason.text.trim().length < 20) {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                        content: Text('Chọn ít nhất một phần điểm và ghi lý do (từ 20 ký tự).')));
                    return;
                  }
                  Navigator.pop(c, true);
                },
              ),
            ]),
          ),
        ),
      ),
    );
    if (ok != true) return;
    await _act(() => apiService.fileScoreAppeal(picked.toList(), reason.text.trim()),
        'Đã nộp đơn phúc khảo. Nộp lệ phí theo hướng dẫn để đơn được xử lý.');
  }

  Future<void> _act(Future<void> Function() job, String okText) async {
    setState(() => _busy = true);
    try {
      await job();
      await appState.refresh();
      if (mounted) showSnack(context, okText);
    } catch (e) {
      if (mounted) showSnack(context, errText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ad = widget.app.admission!;
    final children = <Widget>[];

    final iv = ad.interview;
    if (iv != null) {
      children.addAll([
        SectionTitle(ad.interviewLabel),
        KV('Thời gian', fmtDateTime(iv.scheduledAt)),
        KV('Địa điểm', iv.location),
        KV('Tiểu ban', iv.committeeName),
        const Divider(height: 24),
      ]);
    }

    final s = ad.scores;
    if (s != null) {
      children.addAll([
        const SectionTitle('Điểm xét tuyển'),
        ...s.items.map((i) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(i.subjectName, style: const TextStyle(fontSize: 13.5)),
                    Text('Trọng số ${fmtScore(i.weight <= 1 ? i.weight * 100 : i.weight)}%',
                        style: const TextStyle(fontSize: 11.5, color: AppColors.gray400)),
                    if (i.appeal != null)
                      Text(
                        i.appeal!.status == 'PENDING'
                            ? 'Đang phúc khảo'
                            : i.appeal!.status == 'RESOLVED_CHANGED'
                                ? 'Phúc khảo: ${fmtScore(i.appeal!.oldScore)} → ${fmtScore(i.appeal!.newScore)}'
                                : 'Phúc khảo: giữ nguyên điểm',
                        style: const TextStyle(fontSize: 12, color: AppColors.info),
                      ),
                  ]),
                ),
                Text(i.absent ? 'Vắng' : fmtScore(i.score),
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              ]),
            )),
        const Divider(),
        Row(children: [
          const Expanded(child: Text('Tổng điểm', style: TextStyle(fontWeight: FontWeight.w700))),
          Text(fmtScore(s.total), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.navy800)),
        ]),
        Text('Công bố: ${fmtDateTime(s.publishedAt)}', style: const TextStyle(fontSize: 12, color: AppColors.gray400)),
        if (s.appeal != null) ...[
          const SizedBox(height: 10),
          InfoBanner.info([
            'Đơn phúc khảo: ${s.appeal!.status == 'CHO_NOP_PHI' ? 'chờ nộp lệ phí' : s.appeal!.status == 'DA_NOP_PHI' ? 'đã nộp lệ phí, đang xử lý' : 'đã đóng'}.',
            if (s.appeal!.status == 'CHO_NOP_PHI')
              'Chuyển ${fmtMoney(s.appeal!.feeAmount)} với nội dung "${s.appeal!.transferContent}" vào tài khoản lệ phí của Trường.',
          ].join(' ')),
        ] else if (s.canAppeal) ...[
          const SizedBox(height: 10),
          AppButton(
            label: 'Nộp đơn phúc khảo (hạn ${fmtDate(s.appealDeadline)})',
            variant: AppButtonVariant.outline,
            fullWidth: true,
            onPressed: _busy ? null : () => _appeal(s),
          ),
        ],
        const Divider(height: 24),
      ]);
    }

    final r = ad.result;
    if (r != null) {
      children.addAll([
        SectionTitle('Kết quả xét tuyển', trailing: ToneBadge(resultTone(r.result, r.label))),
        if (r.total != null) KV('Tổng điểm', fmtScore(r.total)),
        if (r.rank != null) KV('Xếp hạng', '${r.rank} / chỉ tiêu ${r.quota}'),
        if (r.benchmark != null) KV('Điểm chuẩn', fmtScore(r.benchmark)),
        if (r.waitlistRank != null) KV('Thứ tự dự bị', '${r.waitlistRank}'),
        if (r.promoted) InfoBanner.success('Bạn được gọi bổ sung từ danh sách dự bị.'),
        Text('Công bố: ${fmtDateTime(r.publishedAt)}', style: const TextStyle(fontSize: 12, color: AppColors.gray400)),
      ]);
    }

    final e = ad.enrollment;
    if (e != null) {
      children.addAll([
        const Divider(height: 24),
        const SectionTitle('Quyết định trúng tuyển & nhập học'),
        KV('Quyết định', '${e.decisionNo ?? ''}${e.decisionDate != null ? ' ngày ${fmtDate(e.decisionDate)}' : ''}'),
        KV(
          'Trạng thái',
          switch (e.status) {
            'DA_XAC_NHAN' => 'Đã xác nhận nhập học ${fmtDateTime(e.confirmedAt)}',
            'TU_CHOI_QUA_HAN' => 'Từ chối / quá hạn xác nhận',
            _ => 'Chưa xác nhận — hạn ${fmtDateTime(e.deadline)} (${timeLeft(e.deadline)})',
          },
        ),
        if (e.originals != null)
          KV('Bản chính', switch (e.originals) {
            'VERIFIED' => 'Đã đối chiếu',
            'MISSING' => 'Thiếu — liên hệ Phòng ĐT SĐH',
            _ => 'Chờ nộp / đối chiếu',
          }),
        if (e.studentCode != null) KV('Mã học viên', e.studentCode),
        const SizedBox(height: 10),
        if (e.canConfirm)
          AppButton(label: 'Xác nhận nhập học', fullWidth: true, loading: _busy, onPressed: _confirm),
        if (e.canDecline) ...[
          const SizedBox(height: 8),
          AppButton(label: 'Từ chối nhập học', variant: AppButtonVariant.ghost, fullWidth: true, onPressed: _busy ? null : _decline),
        ],
        if (e.status != 'TU_CHOI_QUA_HAN') ...[
          const SizedBox(height: 8),
          AppButton(
            label: 'Xem & tải giấy báo trúng tuyển (PDF)',
            icon: Icons.picture_as_pdf_outlined,
            variant: AppButtonVariant.secondary,
            fullWidth: true,
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AdmissionLetterScreen())),
          ),
        ],
      ]);
    }

    if (children.isEmpty) return const SizedBox.shrink();
    return AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children)).withGap();
  }
}

class _DocumentsCard extends StatelessWidget {
  final FullApplication app;
  const _DocumentsCard({required this.app});

  @override
  Widget build(BuildContext context) {
    final a = app;
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SectionTitle('Minh chứng đã nộp (${a.documents.length})'),
        if (a.documents.isEmpty) const Text('Chưa có tệp nào.', style: TextStyle(color: AppColors.gray500)),
        ...a.documents.map((d) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Icon(d.fileName.toLowerCase().endsWith('.pdf') ? Icons.picture_as_pdf_outlined : Icons.image_outlined,
                    color: AppColors.gray400, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(docName(d.documentType), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
                    Text('${d.fileName} · ${fmtSize(d.fileSizeKb)}',
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: AppColors.gray500)),
                    if (d.verifyNote != null && d.verifyNote!.isNotEmpty)
                      Text(d.verifyNote!, style: const TextStyle(fontSize: 12, color: AppColors.danger)),
                  ]),
                ),
                ToneBadge(verifyTone(d.verifyStatus), small: true),
              ]),
            )),
      ]),
    ).withGap();
  }
}

class _HistoryCard extends StatelessWidget {
  final FullApplication app;
  const _HistoryCard({required this.app});

  @override
  Widget build(BuildContext context) {
    // Mới nhất lên đầu
    final h = app.history.reversed.toList();
    if (h.isEmpty) return const SizedBox.shrink();
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const SectionTitle('Lịch sử xử lý'),
        for (var i = 0; i < h.length; i++)
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Column(children: [
              Container(
                width: 12,
                height: 12,
                margin: const EdgeInsets.only(top: 3),
                decoration: BoxDecoration(color: i == 0 ? AppColors.accent : AppColors.gray300, shape: BoxShape.circle),
              ),
              if (i < h.length - 1) Container(width: 2, height: 44, color: AppColors.gray200),
            ]),
            const SizedBox(width: 12),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(historyLabel[h[i].status] ?? h[i].status, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
                  Text(fmtDateTime(h[i].at), style: const TextStyle(fontSize: 12, color: AppColors.gray400)),
                  if (h[i].reason != null && h[i].reason!.isNotEmpty)
                    Text(h[i].reason!, style: const TextStyle(fontSize: 12.5, color: AppColors.gray600)),
                ]),
              ),
            ),
          ]),
      ]),
    );
  }
}

extension on Widget {
  Widget withGap() => Padding(padding: const EdgeInsets.only(bottom: 14), child: this);
}
