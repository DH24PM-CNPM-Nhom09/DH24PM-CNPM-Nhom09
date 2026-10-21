import 'package:flutter/material.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../utils/labels.dart';
import '../widgets/app_button.dart';
import '../widgets/app_card.dart';
import '../widgets/common.dart';

/// Giảng viên hướng dẫn (bậc tiến sĩ): xem phản hồi, gửi đề nghị tới giảng viên khác nếu bị từ chối.
class GvhdScreen extends StatefulWidget {
  const GvhdScreen({super.key});

  @override
  State<GvhdScreen> createState() => _GvhdScreenState();
}

class _GvhdScreenState extends State<GvhdScreen> {
  late Future<SupervisorOverview> _f = apiService.getSupervisors();
  bool _busy = false;

  void _reload() => setState(() => _f = apiService.getSupervisors());

  Future<void> _request(SupervisorOverview o) async {
    List<Lecturer> lecturers;
    try {
      lecturers = await apiService.getLecturers();
    } catch (e) {
      if (mounted) showSnack(context, errText(e), error: true);
      return;
    }
    final asked = o.requests.map((r) => r.lecturerId).toSet();
    final options = lecturers.where((l) => !asked.contains(l.lecturerId)).toList();
    if (!mounted) return;
    final picked = await showModalBottomSheet<Lecturer>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (c) => SafeArea(
        child: SizedBox(
          height: MediaQuery.of(c).size.height * 0.6,
          child: Column(children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 0, 20, 8),
              child: Text('Chọn giảng viên', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
            ),
            Expanded(
              child: options.isEmpty
                  ? const Center(child: Text('Không còn giảng viên nào để chọn.'))
                  : ListView(
                      children: options
                          .map((l) => ListTile(
                                leading: const Icon(Icons.person_outline),
                                title: Text(l.fullName),
                                subtitle: l.facultyName == null ? null : Text(l.facultyName!),
                                onTap: () => Navigator.pop(c, l),
                              ))
                          .toList(),
                    ),
            ),
          ]),
        ),
      ),
    );
    if (picked == null) return;
    setState(() => _busy = true);
    try {
      final r = await apiService.requestSupervisor(picked.lecturerId);
      setState(() => _f = Future.value(r));
      if (mounted) showSnack(context, 'Đã gửi đề nghị tới ${picked.fullName}.');
    } catch (e) {
      if (mounted) showSnack(context, errText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Giảng viên hướng dẫn')),
      body: FutureBuilder<SupervisorOverview>(
        future: _f,
        builder: (context, snap) => AsyncBody<SupervisorOverview>(
          snap: snap,
          onRetry: _reload,
          builder: (o) => RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(padding: const EdgeInsets.all(16), children: switch (o.state) {
              'NO_APPLICATION' => const [
                  EmptyView(icon: Icons.school_outlined, title: 'Chưa có hồ sơ', message: 'Mục này dành cho thí sinh dự tuyển tiến sĩ.'),
                ],
              'MASTER' => const [
                  EmptyView(
                      icon: Icons.school_outlined,
                      title: 'Không áp dụng cho bậc thạc sĩ',
                      message: 'Giảng viên hướng dẫn luận văn thạc sĩ được phân công sau khi nhập học.'),
                ],
              'DRAFT' => const [
                  EmptyView(
                      icon: Icons.edit_note,
                      title: 'Hồ sơ đang là bản nháp',
                      message: 'Chọn giảng viên mong muốn ở bước "Đề tài nghiên cứu", sau khi nộp hồ sơ đề nghị sẽ được gửi đi.'),
                ],
              _ => [
                  AppCard(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      KV('Mã hồ sơ', o.applicationCode),
                      KV('Ngành', o.majorName),
                      KV('Đề tài', o.researchTopic),
                      KV('Lĩnh vực', o.researchField),
                    ]),
                  ),
                  const SizedBox(height: 16),
                  const SectionTitle('Đề nghị hướng dẫn'),
                  if (o.requests.isEmpty)
                    const Text('Chưa gửi đề nghị nào.', style: TextStyle(color: AppColors.gray500)),
                  ...o.requests.map((r) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: AppCard(
                          padding: const EdgeInsets.all(14),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(children: [
                              Expanded(child: Text(r.lecturerName, style: const TextStyle(fontWeight: FontWeight.w700))),
                              ToneBadge(supervisorTone(r.status), small: true),
                            ]),
                            if (r.facultyName.isNotEmpty)
                              Text(r.facultyName, style: const TextStyle(fontSize: 12.5, color: AppColors.gray500)),
                            const SizedBox(height: 4),
                            Text('Gửi ${fmtDateTime(r.requestedAt)}${r.respondedAt != null ? ' · phản hồi ${fmtDateTime(r.respondedAt)}' : ''}',
                                style: const TextStyle(fontSize: 12, color: AppColors.gray400)),
                            if (r.responseNote != null && r.responseNote!.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 6),
                                child: Text('Ghi chú: ${r.responseNote}', style: const TextStyle(fontSize: 13)),
                              ),
                          ]),
                        ),
                      )),
                  if (o.canRequest)
                    AppButton(
                      label: 'Đề nghị giảng viên khác (còn ${o.remaining} lần)',
                      fullWidth: true,
                      loading: _busy,
                      onPressed: () => _request(o),
                    ),
                ],
            }),
          ),
        ),
      ),
    );
  }
}
