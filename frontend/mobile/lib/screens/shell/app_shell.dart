import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../dashboard_screen.dart';
import '../application_screen.dart';
import '../gvhd_screen.dart';
import '../complaint_screen.dart';
import '../profile_screen.dart';
import '../auth/login_screen.dart';

// Khung điều hướng chính sau đăng nhập — dùng Bottom Navigation Bar,
// tương ứng với sidebar/bottom-nav trong bản web (AppLayout.tsx).
class AppShell extends StatefulWidget {
  const AppShell({super.key});
  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;

  final _screens = const [
    DashboardScreen(),
    ApplicationScreen(),
    GvhdScreen(),
    ComplaintScreen(),
    ProfileScreen(),
  ];

  void _logout() {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    const titles = ['Tổng quan', 'Hồ sơ xét tuyển', 'GVHD', 'Khiếu nại', 'Hồ sơ cá nhân'];
    return Scaffold(
      appBar: AppBar(
        title: Text(titles[_index], style: const TextStyle(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            onPressed: _logout,
            icon: const Icon(Icons.logout, color: AppColors.gray500, size: 20),
            tooltip: 'Đăng xuất',
          ),
        ],
      ),
      body: IndexedStack(index: _index, children: _screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        backgroundColor: Colors.white,
        indicatorColor: AppColors.accent50,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home, color: AppColors.accent), label: 'Tổng quan'),
          NavigationDestination(icon: Icon(Icons.description_outlined), selectedIcon: Icon(Icons.description, color: AppColors.accent), label: 'Hồ sơ'),
          NavigationDestination(icon: Icon(Icons.school_outlined), selectedIcon: Icon(Icons.school, color: AppColors.accent), label: 'GVHD'),
          NavigationDestination(icon: Icon(Icons.mail_outline), selectedIcon: Icon(Icons.mail, color: AppColors.accent), label: 'Khiếu nại'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person, color: AppColors.accent), label: 'Cá nhân'),
        ],
      ),
    );
  }
}
