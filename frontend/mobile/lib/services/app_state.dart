import 'package:flutter/foundation.dart';

import '../models/models.dart';
import 'api_service.dart';

/// Dữ liệu dùng chung giữa các tab (hồ sơ cá nhân, hồ sơ xét tuyển, số thông báo chưa đọc).
/// Màn hình nào thay đổi dữ liệu thì gọi refresh() để các tab khác cập nhật theo.
class AppState extends ChangeNotifier {
  Candidate? profile;
  FullApplication? application;
  List<CandidateNotification> notifications = const [];
  bool loading = false;
  Object? error;
  bool loadedOnce = false;

  int get unread => notifications.where((n) => !n.isRead).length;

  /// Hồ sơ đang theo dõi (bỏ qua hồ sơ đã hủy do từ chối nhập học)
  FullApplication? get activeApplication => (application != null && !application!.declined) ? application : null;

  Future<void> refresh() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final r = await Future.wait([
        apiService.getProfile(),
        apiService.getFullApplication(),
        apiService.getNotifications(),
      ]);
      profile = r[0] as Candidate;
      application = r[1] as FullApplication?;
      notifications = r[2] as List<CandidateNotification>;
      loadedOnce = true;
    } catch (e) {
      error = e;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> refreshApplication() async {
    try {
      application = await apiService.getFullApplication();
      notifyListeners();
    } catch (_) {}
  }

  Future<void> refreshNotifications() async {
    try {
      notifications = await apiService.getNotifications();
      notifyListeners();
    } catch (_) {}
  }

  void setApplication(FullApplication? a) {
    application = a;
    notifyListeners();
  }

  void clear() {
    profile = null;
    application = null;
    notifications = const [];
    loadedOnce = false;
    error = null;
    notifyListeners();
  }
}

final appState = AppState();
