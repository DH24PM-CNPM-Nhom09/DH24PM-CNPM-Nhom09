import 'package:flutter/material.dart';

import '../../services/app_state.dart';
import '../../theme/app_theme.dart';
import '../announcements_screen.dart';
import '../application_screen.dart';
import '../dashboard_screen.dart';
import '../notifications_screen.dart';
import '../profile_screen.dart';

/// Khung điều hướng chính sau đăng nhập (thanh tab dưới cùng).
class AppShell extends StatefulWidget {
  final int initialTab;
  const AppShell({super.key, this.initialTab = 0});

  /// Chuyển tab từ màn hình con (ví dụ nút "Xem hồ sơ" ở Tổng quan)
  static void goTab(BuildContext context, int index) =>
      context.findAncestorStateOfType<_AppShellState>()?.setTab(index);

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  late int _index = widget.initialTab;

  static const _titles = ['Tổng quan', 'Hồ sơ xét tuyển', 'Thông báo', 'Tuyển sinh', 'Cá nhân'];

  @override
  void initState() {
    super.initState();
    if (!appState.loadedOnce) appState.refresh();
  }

  void setTab(int i) => setState(() => _index = i);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_index], style: const TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: IndexedStack(index: _index, children: const [
        DashboardScreen(),
        ApplicationScreen(),
        NotificationsScreen(),
        AnnouncementsScreen(),
        ProfileScreen(),
      ]),
      bottomNavigationBar: ListenableBuilder(
        listenable: appState,
        builder: (context, _) => NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: (i) {
            setState(() => _index = i);
            if (i == 2) appState.refreshNotifications();
          },
          backgroundColor: Colors.white,
          indicatorColor: AppColors.accent50,
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          destinations: [
            const NavigationDestination(
                icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home, color: AppColors.accent), label: 'Tổng quan'),
            const NavigationDestination(
                icon: Icon(Icons.description_outlined),
                selectedIcon: Icon(Icons.description, color: AppColors.accent),
                label: 'Hồ sơ'),
            NavigationDestination(
              icon: Badge(
                isLabelVisible: appState.unread > 0,
                label: Text('${appState.unread}'),
                child: const Icon(Icons.notifications_none),
              ),
              selectedIcon: const Icon(Icons.notifications, color: AppColors.accent),
              label: 'Thông báo',
            ),
            const NavigationDestination(
                icon: Icon(Icons.campaign_outlined),
                selectedIcon: Icon(Icons.campaign, color: AppColors.accent),
                label: 'Tuyển sinh'),
            const NavigationDestination(
                icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person, color: AppColors.accent), label: 'Cá nhân'),
          ],
        ),
      ),
    );
  }
}
