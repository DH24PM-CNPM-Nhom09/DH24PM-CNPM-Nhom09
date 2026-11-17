import 'package:flutter/material.dart';

import '../services/api_client.dart';
import '../services/api_service.dart';
import '../services/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/common.dart';

/// Thông báo cá nhân: kết quả xử lý hồ sơ, yêu cầu bổ sung, lịch thi, kết quả…
class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  Future<void> _readAll(BuildContext context) async {
    try {
      await apiService.markAllNotificationsRead();
      await appState.refreshNotifications();
    } catch (e) {
      if (context.mounted) showSnack(context, errText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: appState,
      builder: (context, _) {
        if (!appState.loadedOnce) return const LoadingView();
        final list = appState.notifications;
        return RefreshIndicator(
          onRefresh: appState.refreshNotifications,
          child: ListView(padding: const EdgeInsets.symmetric(vertical: 8), children: [
            if (appState.unread > 0)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(children: [
                  Expanded(
                      child: Text('${appState.unread} thông báo chưa đọc',
                          style: const TextStyle(color: AppColors.gray500, fontSize: 13))),
                  TextButton(onPressed: () => _readAll(context), child: const Text('Đánh dấu đã đọc hết')),
                ]),
              ),
            if (list.isEmpty)
              const EmptyView(
                icon: Icons.notifications_off_outlined,
                title: 'Chưa có thông báo',
                message: 'Khi hồ sơ được xử lý, có lịch thi hay kết quả, thông báo sẽ hiện ở đây.',
              ),
            ...list.map((n) => InkWell(
                  onTap: () async {
                    showModalBottomSheet(
                      context: context,
                      showDragHandle: true,
                      isScrollControlled: true,
                      builder: (c) => SafeArea(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(n.title ?? 'Thông báo', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                            const SizedBox(height: 4),
                            Text(fmtDateTime(n.createdAt), style: const TextStyle(color: AppColors.gray400, fontSize: 12)),
                            const SizedBox(height: 12),
                            Text(n.content, style: const TextStyle(fontSize: 14.5, height: 1.5)),
                          ]),
                        ),
                      ),
                    );
                    if (!n.isRead) {
                      try {
                        await apiService.markNotificationRead(n.notificationId);
                        await appState.refreshNotifications();
                      } catch (_) {}
                    }
                  },
                  child: Container(
                    color: n.isRead ? null : AppColors.accent50.withValues(alpha: 0.5),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 5),
                        child: Icon(Icons.circle, size: 9, color: n.isRead ? Colors.transparent : AppColors.accent),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(n.title ?? 'Thông báo',
                              style: TextStyle(fontSize: 14.5, fontWeight: n.isRead ? FontWeight.w500 : FontWeight.w700)),
                          const SizedBox(height: 3),
                          Text(n.content,
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 13, color: AppColors.gray600, height: 1.4)),
                          const SizedBox(height: 4),
                          Text(fmtDateTime(n.createdAt), style: const TextStyle(fontSize: 11.5, color: AppColors.gray400)),
                        ]),
                      ),
                    ]),
                  ),
                )),
          ]),
        );
      },
    );
  }
}
