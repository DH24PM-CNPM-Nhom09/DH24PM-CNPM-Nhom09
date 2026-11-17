import 'package:flutter/material.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../services/api_service.dart';
import '../services/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../utils/labels.dart';
import '../widgets/app_button.dart';
import '../widgets/app_card.dart';
import '../widgets/app_text_field.dart';
import '../widgets/common.dart';

/// Khiếu nại / phúc khảo: gửi yêu cầu và theo dõi câu trả lời của Nhà trường.
class ComplaintScreen extends StatefulWidget {
  const ComplaintScreen({super.key});

  @override
  State<ComplaintScreen> createState() => _ComplaintScreenState();
}

class _ComplaintScreenState extends State<ComplaintScreen> {
  String _type = complaintTypes.first.$1;
  late final _code = TextEditingController(text: appState.activeApplication?.applicationCode ?? '');
  final _content = TextEditingController();
  bool _busy = false;
  String _error = '';
  late Future<List<Complaint>> _mine = apiService.getComplaints();

  @override
  void dispose() {
    _code.dispose();
    _content.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_content.text.trim().length < 20) {
      return setState(() => _error = 'Nội dung cần ít nhất 20 ký tự để cán bộ xử lý được.');
    }
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      await apiService.submitComplaint(type: _type, applicationCode: _code.text.trim(), content: _content.text.trim());
      _content.clear();
      setState(() => _mine = apiService.getComplaints());
      appState.refreshNotifications();
      if (mounted) showSnack(context, 'Đã gửi yêu cầu. Nhà trường sẽ trả lời tại đây và qua thông báo.');
    } catch (e) {
      setState(() => _error = errText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Khiếu nại / phúc khảo')),
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.all(16), children: [
          AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const SectionTitle('Gửi yêu cầu mới'),
              if (_error.isNotEmpty) Alert(_error),
              AppDropdown<String>(
                label: 'Loại yêu cầu',
                required: true,
                value: _type,
                items: complaintTypes.map((e) => e.$1).toList(),
                labelBuilder: (v) => complaintTypes.firstWhere((e) => e.$1 == v).$2,
                onChanged: (v) => setState(() => _type = v ?? _type),
              ),
              AppTextField(label: 'Mã hồ sơ', controller: _code, hint: 'Ví dụ THS-2026-D2-8480101-00012'),
              AppTextField(
                label: 'Nội dung',
                required: true,
                controller: _content,
                maxLines: 5,
                hint: 'Trình bày cụ thể sự việc, thời điểm và đề nghị của bạn (ít nhất 20 ký tự).',
              ),
              AppButton(label: 'Gửi yêu cầu', fullWidth: true, loading: _busy, onPressed: _send),
            ]),
          ),
          const SizedBox(height: 18),
          const SectionTitle('Yêu cầu đã gửi'),
          FutureBuilder<List<Complaint>>(
            future: _mine,
            builder: (context, snap) => AsyncBody<List<Complaint>>(
              snap: snap,
              onRetry: () => setState(() => _mine = apiService.getComplaints()),
              builder: (list) => list.isEmpty
                  ? const Text('Bạn chưa gửi yêu cầu nào.', style: TextStyle(color: AppColors.gray500))
                  : Column(
                      children: list
                          .map((c) => Padding(
                                padding: const EdgeInsets.only(bottom: 10),
                                child: AppCard(
                                  padding: const EdgeInsets.all(14),
                                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Row(children: [
                                      Expanded(
                                        child: Text(c.typeLabel.isEmpty ? c.type : c.typeLabel,
                                            style: const TextStyle(fontWeight: FontWeight.w700)),
                                      ),
                                      ToneBadge(complaintTone(c.status), small: true),
                                    ]),
                                    Text(
                                      '${fmtDateTime(c.createdAt)}${c.applicationCode != null ? ' · ${c.applicationCode}' : ''}',
                                      style: const TextStyle(fontSize: 12, color: AppColors.gray400),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(c.content, style: const TextStyle(fontSize: 13.5, height: 1.4)),
                                    if (c.response != null && c.response!.isNotEmpty) ...[
                                      const SizedBox(height: 8),
                                      Container(
                                        width: double.infinity,
                                        padding: const EdgeInsets.all(10),
                                        decoration: BoxDecoration(
                                            color: AppColors.navy50, borderRadius: BorderRadius.circular(8)),
                                        child: Text('Nhà trường trả lời: ${c.response}',
                                            style: const TextStyle(fontSize: 13, color: AppColors.navy800, height: 1.4)),
                                      ),
                                    ],
                                  ]),
                                ),
                              ))
                          .toList(),
                    ),
            ),
          ),
        ]),
      ),
    );
  }
}
