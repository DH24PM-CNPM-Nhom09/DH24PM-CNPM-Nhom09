import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config.dart';

/// Lỗi chuẩn của backend: { error_code, message, detail? }
class ApiException implements Exception {
  final String code;
  final String message;
  final String? detail;
  final int status;

  const ApiException(this.code, this.message, {this.detail, this.status = 0});

  @override
  String toString() => message;
}

/// Lớp gọi HTTP dùng chung: gắn token, đổi lỗi mạng/máy chủ thành câu tiếng Việt dễ hiểu.
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  static const _kToken = 'access_token';
  static const _kApiBase = 'api_base';

  String apiBase = AppConfig.defaultApiBase;
  String? _token;
  http.Client _http = http.Client();

  /// Gọi khi phiên đăng nhập hết hạn (401) — app quay về màn hình đăng nhập.
  void Function()? onUnauthorized;

  bool get isLoggedIn => _token != null && _token!.isNotEmpty;

  /// Bộ nhớ trên máy (token, địa chỉ máy chủ). Lỗi đọc/ghi không được làm treo hay sập app:
  /// khi đó app vẫn chạy, chỉ là phải đăng nhập lại ở lần mở sau.
  Future<SharedPreferences?> _prefs() async {
    try {
      return await SharedPreferences.getInstance().timeout(const Duration(seconds: 5));
    } catch (_) {
      return null;
    }
  }

  Future<void> load() async {
    final p = await _prefs();
    if (p == null) return;
    try {
      _token = p.getString(_kToken);
      final saved = p.getString(_kApiBase);
      if (saved != null && saved.trim().isNotEmpty) apiBase = saved.trim();
    } catch (_) {}
  }

  Future<void> saveToken(String token) async {
    _token = token;
    try {
      await (await _prefs())?.setString(_kToken, token);
    } catch (_) {}
  }

  Future<void> clearToken() async {
    _token = null;
    try {
      await (await _prefs())?.remove(_kToken);
    } catch (_) {}
  }

  /// Đổi địa chỉ máy chủ (để trống = dùng mặc định).
  Future<void> setApiBase(String? value) async {
    final v = (value ?? '').trim().replaceAll(RegExp(r'/+$'), '');
    apiBase = v.isEmpty ? AppConfig.defaultApiBase : v;
    try {
      final p = await _prefs();
      if (v.isEmpty) {
        await p?.remove(_kApiBase);
      } else {
        await p?.setString(_kApiBase, v);
      }
    } catch (_) {}
    _http.close();
    _http = http.Client();
  }

  Map<String, String> _headers({bool json = true}) => {
        if (json) 'Content-Type': 'application/json',
        'Accept': 'application/json',
        if (isLoggedIn) 'Authorization': 'Bearer $_token',
      };

  Uri _uri(String path) => Uri.parse('$apiBase$path');

  Future<dynamic> get(String path) => _send('GET', path);
  Future<dynamic> post(String path, [Object? body]) => _send('POST', path, body);
  Future<dynamic> put(String path, [Object? body]) => _send('PUT', path, body);
  Future<dynamic> patch(String path, [Object? body]) => _send('PATCH', path, body);
  Future<dynamic> delete(String path) => _send('DELETE', path);

  Future<dynamic> _send(String method, String path, [Object? body]) async {
    final req = http.Request(method, _uri(path))..headers.addAll(_headers());
    if (body != null) req.body = jsonEncode(body);
    return _run(() => _http.send(req));
  }

  /// Tải tệp (multipart) — dùng cho minh chứng hồ sơ.
  Future<dynamic> upload(
    String path, {
    required List<int> bytes,
    required String fileName,
    required String mimeType,
    Map<String, String> fields = const {},
  }) {
    final req = http.MultipartRequest('POST', _uri(path))
      ..headers.addAll(_headers(json: false))
      ..fields.addAll(fields);
    final parts = mimeType.split('/');
    req.files.add(http.MultipartFile.fromBytes(
      'file',
      bytes,
      filename: fileName,
      contentType: MediaType(parts.first, parts.length > 1 ? parts[1] : 'octet-stream'),
    ));
    return _run(() => _http.send(req));
  }

  Future<dynamic> _run(Future<http.StreamedResponse> Function() send) async {
    http.Response res;
    try {
      res = await http.Response.fromStream(await send().timeout(AppConfig.requestTimeout));
    } on TimeoutException {
      throw const ApiException('TIMEOUT',
          'Máy chủ phản hồi quá lâu (có thể đang khởi động lại sau thời gian nghỉ). Vui lòng thử lại sau ít phút.');
    } on SocketException {
      throw const ApiException('NETWORK', 'Không kết nối được máy chủ. Kiểm tra mạng (Wi-Fi/4G) rồi thử lại.');
    } on http.ClientException {
      throw const ApiException('NETWORK', 'Không kết nối được máy chủ. Kiểm tra mạng (Wi-Fi/4G) rồi thử lại.');
    } on HandshakeException {
      throw const ApiException('NETWORK', 'Không tạo được kết nối an toàn tới máy chủ. Thử lại sau.');
    }

    final text = utf8.decode(res.bodyBytes, allowMalformed: true);
    dynamic data;
    if (text.isNotEmpty) {
      try {
        data = jsonDecode(text);
      } catch (_) {
        data = null;
      }
    }

    if (res.statusCode == 401 && isLoggedIn) {
      await clearToken();
      onUnauthorized?.call();
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      if (data is Map) {
        final msg = data['message'];
        throw ApiException(
          (data['error_code'] ?? data['error'] ?? 'HTTP_${res.statusCode}').toString(),
          msg is List ? msg.join('\n') : (msg ?? 'Đã có lỗi xảy ra (mã ${res.statusCode}).').toString(),
          detail: data['detail']?.toString(),
          status: res.statusCode,
        );
      }
      if (res.statusCode == 502 || res.statusCode == 503 || res.statusCode == 504) {
        throw ApiException('SERVER_DOWN',
            'Máy chủ đang khởi động hoặc tạm ngừng (mã ${res.statusCode}). Vui lòng thử lại sau ít phút.',
            status: res.statusCode);
      }
      throw ApiException('HTTP_${res.statusCode}', 'Đã có lỗi xảy ra (mã ${res.statusCode}).',
          status: res.statusCode);
    }
    return data;
  }
}

final api = ApiClient.instance;

/// Câu thông báo lỗi để hiển thị cho người dùng.
String errText(Object e, [String fallback = 'Đã có lỗi xảy ra, vui lòng thử lại.']) {
  if (e is ApiException) return e.message;
  return fallback;
}
