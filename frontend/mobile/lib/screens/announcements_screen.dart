import 'package:flutter/material.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../services/api_service.dart';
import '../services/pdf_service.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../utils/labels.dart';
import '../widgets/app_button.dart';
import '../widgets/app_card.dart';
import '../widgets/common.dart';

/// Tab "Tuyển sinh": thông báo của Nhà trường + các đợt đang mở (điều kiện từng ngành).
/// Xem được cả khi chưa đăng nhập (mở từ màn hình Đăng nhập với standalone = true).
class AnnouncementsScreen extends StatelessWidget {
  final bool standalone;
  const AnnouncementsScreen({super.key, this.standalone = false});

  @override
  Widget build(BuildContext context) {
    final body = DefaultTabController(
      length: 2,
      child: Column(children: [
        Container(
          color: Colors.white,
          child: const TabBar(
            labelColor: AppColors.accent,
            indicatorColor: AppColors.accent,
            unselectedLabelColor: AppColors.gray500,
            tabs: [Tab(text: 'Thông báo'), Tab(text: 'Đợt đang mở')],
          ),
        ),
        Expanded(
          child: TabBarView(children: [
            const _AnnouncementList(),
            OpenBatchesView(canApply: !standalone),
          ]),
        ),
      ]),
    );
    if (!standalone) return body;
    return Scaffold(appBar: AppBar(title: const Text('Thông tin tuyển sinh')), body: body);
  }
}

class _AnnouncementList extends StatefulWidget {
  const _AnnouncementList();

  @override
  State<_AnnouncementList> createState() => _AnnouncementListState();
}

class _AnnouncementListState extends State<_AnnouncementList> with AutomaticKeepAliveClientMixin {
  String _cat = '';
  late Future<List<Announcement>> _f = apiService.getAnnouncements();

  @override
  bool get wantKeepAlive => true;

  void _load() => setState(() => _f = apiService.getAnnouncements(category: _cat));

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Column(children: [
      SizedBox(
        height: 52,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          children: [
            for (final e in {'': 'Tất cả', ...announcementCategory}.entries)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(e.value),
                  selected: _cat == e.key,
                  onSelected: (_) {
                    _cat = e.key;
                    _load();
                  },
                ),
              ),
          ],
        ),
      ),
      Expanded(
        child: FutureBuilder<List<Announcement>>(
          future: _f,
          builder: (context, snap) => AsyncBody<List<Announcement>>(
            snap: snap,
            onRetry: _load,
            builder: (list) => RefreshIndicator(
              onRefresh: () async => _load(),
              child: list.isEmpty
                  ? ListView(children: const [EmptyView(icon: Icons.campaign_outlined, title: 'Chưa có thông báo')])
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                      itemCount: list.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, i) {
                        final a = list[i];
                        return InkWell(
                          borderRadius: BorderRadius.circular(14),
                          onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(builder: (_) => AnnouncementDetailScreen(id: a.announcementId, title: a.title))),
                          child: AppCard(
                            padding: const EdgeInsets.all(14),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Row(children: [
                                if (a.isPinned) const Icon(Icons.push_pin, size: 15, color: AppColors.accent),
                                if (a.isPinned) const SizedBox(width: 4),
                                Text(announcementCategory[a.category] ?? a.category,
                                    style: const TextStyle(fontSize: 11.5, color: AppColors.accentDark, fontWeight: FontWeight.w600)),
                                const Spacer(),
                                Text(fmtDate(a.publishedAt ?? a.createdAt),
                                    style: const TextStyle(fontSize: 11.5, color: AppColors.gray400)),
                              ]),
                              const SizedBox(height: 6),
                              Text(a.title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, height: 1.3)),
                              const SizedBox(height: 4),
                              Text(a.excerpt,
                                  maxLines: 3,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 13, color: AppColors.gray600, height: 1.4)),
                            ]),
                          ),
                        );
                      },
                    ),
            ),
          ),
        ),
      ),
    ]);
  }
}

class AnnouncementDetailScreen extends StatelessWidget {
  final int id;
  final String title;
  const AnnouncementDetailScreen({super.key, required this.id, required this.title});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Thông báo')),
      body: FutureBuilder<Announcement>(
        future: apiService.getAnnouncement(id),
        builder: (context, snap) => AsyncBody<Announcement>(
          snap: snap,
          onRetry: () => Navigator.of(context)
              .pushReplacement(MaterialPageRoute(builder: (_) => AnnouncementDetailScreen(id: id, title: title))),
          builder: (a) => ListView(padding: const EdgeInsets.all(18), children: [
            Text(announcementCategory[a.category] ?? a.category,
                style: const TextStyle(color: AppColors.accentDark, fontWeight: FontWeight.w600, fontSize: 12.5)),
            const SizedBox(height: 6),
            Text(a.title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, height: 1.3)),
            const SizedBox(height: 6),
            Text(
              [fmtDateTime(a.publishedAt ?? a.createdAt), if (a.createdByName != null) a.createdByName!].join(' · '),
              style: const TextStyle(color: AppColors.gray400, fontSize: 12.5),
            ),
            if (a.batchName != null) ...[
              const SizedBox(height: 8),
              Text('Đợt: ${a.batchName}', style: const TextStyle(color: AppColors.gray600, fontSize: 13)),
            ],
            const Divider(height: 28),
            SelectableText(a.content ?? a.excerpt, style: const TextStyle(fontSize: 15, height: 1.6)),
          ]),
        ),
      ),
    );
  }
}

// ======================================================================== đợt đang mở
class OpenBatchesScreen extends StatelessWidget {
  const OpenBatchesScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Điều kiện tuyển sinh')),
        body: const OpenBatchesView(canApply: true),
      );
}

class OpenBatchesView extends StatefulWidget {
  final bool canApply;
  const OpenBatchesView({super.key, required this.canApply});

  @override
  State<OpenBatchesView> createState() => _OpenBatchesViewState();
}

class _OpenBatchesViewState extends State<OpenBatchesView> with AutomaticKeepAliveClientMixin {
  late Future<List<OpenBatch>> _f = apiService.getOpenBatches();

  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return FutureBuilder<List<OpenBatch>>(
      future: _f,
      builder: (context, snap) => AsyncBody<List<OpenBatch>>(
        snap: snap,
        onRetry: () => setState(() => _f = apiService.getOpenBatches()),
        builder: (list) => RefreshIndicator(
          onRefresh: () async => setState(() => _f = apiService.getOpenBatches()),
          child: list.isEmpty
              ? ListView(children: const [
                  EmptyView(
                    icon: Icons.event_busy_outlined,
                    title: 'Hiện chưa có đợt tuyển sinh nào đang mở',
                    message: 'Theo dõi mục Thông báo để biết lịch mở đợt mới.',
                  ),
                ])
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: list.map((b) => _BatchCard(batch: b, canApply: widget.canApply)).toList(),
                ),
        ),
      ),
    );
  }
}

class _BatchCard extends StatelessWidget {
  final OpenBatch batch;
  final bool canApply;
  const _BatchCard({required this.batch, required this.canApply});

  @override
  Widget build(BuildContext context) {
    final b = batch;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => Navigator.of(context)
            .push(MaterialPageRoute(builder: (_) => BatchDetailScreen(batch: b, canApply: canApply))),
        child: AppCard(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              ToneBadge((AppColors.navy50, AppColors.navy800, degreeLabel[b.degreeLevel] ?? b.degreeLevel), small: true),
              const SizedBox(width: 8),
              ToneBadge(
                isPast(b.registrationEndAt)
                    ? (AppColors.gray100, AppColors.gray500, 'Đã hết hạn')
                    : (AppColors.success50, AppColors.success, 'Đang nhận hồ sơ · ${timeLeft(b.registrationEndAt)}'),
                small: true,
              ),
            ]),
            const SizedBox(height: 10),
            Text(b.batchName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text('Nhận hồ sơ: ${fmtDate(b.registrationStartAt)} – ${fmtDateTime(b.registrationEndAt)}',
                style: const TextStyle(fontSize: 13, color: AppColors.gray600)),
            if (b.examStartAt != null)
              Text('Thi/xét tuyển: từ ${fmtDate(b.examStartAt)}', style: const TextStyle(fontSize: 13, color: AppColors.gray600)),
            const SizedBox(height: 8),
            Text('${b.majors.length} ngành · tổng chỉ tiêu ${b.majors.fold<int>(0, (t, m) => t + m.quota)}',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.navy800)),
          ]),
        ),
      ),
    );
  }
}

class BatchDetailScreen extends StatelessWidget {
  final OpenBatch batch;
  final bool canApply;
  const BatchDetailScreen({super.key, required this.batch, required this.canApply});

  Future<void> _exportPdf(BuildContext context) async {
    try {
      await PdfService.shareConditions(batch);
    } catch (e) {
      if (context.mounted) showSnack(context, errText(e, 'Không tạo được tệp PDF.'), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final b = batch;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Điều kiện tuyển sinh'),
        actions: [
          IconButton(
            tooltip: 'Tải điều kiện (PDF)',
            icon: const Icon(Icons.picture_as_pdf_outlined),
            onPressed: () => _exportPdf(context),
          ),
        ],
      ),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Text(b.batchName, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        AppCard(
          padding: const EdgeInsets.all(14),
          child: Column(children: [
            KV('Trình độ', degreeLabel[b.degreeLevel]),
            KV('Mã đợt', b.batchCode),
            KV('Nhận hồ sơ', '${fmtDateTime(b.registrationStartAt)} – ${fmtDateTime(b.registrationEndAt)}'),
            if (b.examStartAt != null)
              KV('Thi / xét tuyển', '${fmtDate(b.examStartAt)}${b.examEndAt != null ? ' – ${fmtDate(b.examEndAt)}' : ''}'),
            if (b.legalBasis != null) KV('Căn cứ', b.legalBasis, bold: false),
          ]),
        ),
        const SizedBox(height: 10),
        AppButton(
          label: 'Tải điều kiện tuyển sinh (PDF)',
          icon: Icons.download,
          variant: AppButtonVariant.outline,
          fullWidth: true,
          onPressed: () => _exportPdf(context),
        ),
        const SizedBox(height: 18),
        const SectionTitle('Ngành tuyển sinh'),
        ...b.majors.map((m) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: AppCard(
                padding: const EdgeInsets.all(14),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(m.majorName, style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text('Mã ngành ${m.majorCode}${m.facultyName != null ? ' · ${m.facultyName}' : ''}',
                      style: const TextStyle(fontSize: 12.5, color: AppColors.gray500)),
                  const SizedBox(height: 6),
                  Text('Chỉ tiêu: ${m.quota}', style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.navy800)),
                  if (m.conditions.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    const Text('Điều kiện dự tuyển', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                    const SizedBox(height: 4),
                    ...m.conditions.map((c) => Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Icon(c.isMandatory ? Icons.check_circle : Icons.radio_button_unchecked,
                                size: 16, color: c.isMandatory ? AppColors.success : AppColors.gray400),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                [
                                  c.description,
                                  if (c.minGpa != null) 'Điểm TB tối thiểu ${fmtScore(c.minGpa)}',
                                  if (c.requiredCertificate != null) 'Yêu cầu: ${c.requiredCertificate}',
                                  if (!c.isMandatory) '(khuyến khích)',
                                ].join(' · '),
                                style: const TextStyle(fontSize: 13, height: 1.4),
                              ),
                            ),
                          ]),
                        )),
                  ],
                  if (m.subjects.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    const Text('Hình thức xét tuyển', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                    const SizedBox(height: 4),
                    ...m.subjects.map((s) => Padding(
                          padding: const EdgeInsets.only(top: 3),
                          child: Text(
                            '• ${s.subjectName} — ${examFormatLabel[s.examFormat] ?? s.examFormat}'
                            '${s.weight != null ? ' (trọng số ${fmtScore(s.weight! <= 1 ? s.weight! * 100 : s.weight!)}%)' : ''}',
                            style: const TextStyle(fontSize: 13),
                          ),
                        )),
                  ],
                ]),
              ),
            )),
        if (canApply && !isPast(b.registrationEndAt))
          const Padding(
            padding: EdgeInsets.only(top: 4),
            child: InfoBannerHint(),
          ),
      ]),
    );
  }
}

class InfoBannerHint extends StatelessWidget {
  const InfoBannerHint({super.key});

  @override
  Widget build(BuildContext context) => InfoBanner.info(
      'Đủ điều kiện? Vào tab Tổng quan → "Tạo hồ sơ xét tuyển" để đăng ký dự tuyển ngay trên điện thoại.');
}
