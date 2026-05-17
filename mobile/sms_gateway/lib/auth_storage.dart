import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'app_models.dart';

/// SharedPreferences key for API host (field portal tab reads the same key).
const kPrefFieldApiOrigin = 'field_api_origin';

const _kAccess = 'waterwise_access_token';
const _kRefresh = 'waterwise_refresh_token';
const _kOrigin = 'waterwise_api_origin';
const _kUsername = 'waterwise_username';
const _kIsStaff = 'waterwise_is_staff';
const _kCanSms = 'waterwise_can_sms';

/// Backend origin only, e.g. `https://host` (no `/api` suffix).
String normalizeApiOrigin(String raw) {
  var o = raw.trim().replaceAll(RegExp(r'/+$'), '');
  if (o.endsWith('/api')) {
    o = o.substring(0, o.length - 4);
  }
  return o.replaceAll(RegExp(r'/+$'), '');
}

Future<Map<String, dynamic>?> _getMe(String origin, String access) async {
  final uri = Uri.parse('${normalizeApiOrigin(origin)}/api/me/');
  try {
    final res = await http
        .get(
          uri,
          headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer $access',
          },
        )
        .timeout(const Duration(seconds: 20));
    if (res.statusCode != 200) return null;
    final body = jsonDecode(res.body);
    return body is Map<String, dynamic> ? body : null;
  } catch (_) {
    return null;
  }
}

Future<String?> _refreshAccess(String origin, String refresh) async {
  final uri = Uri.parse('${normalizeApiOrigin(origin)}/api/token/refresh/');
  try {
    final res = await http
        .post(
          uri,
          headers: const {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: jsonEncode({'refresh': refresh}),
        )
        .timeout(const Duration(seconds: 20));
    if (res.statusCode != 200) return null;
    final body = jsonDecode(res.body);
    if (body is Map<String, dynamic> && body['access'] is String) {
      return body['access'] as String;
    }
    return null;
  } catch (_) {
    return null;
  }
}

class AuthStorage {
  AuthStorage({FlutterSecureStorage? secure})
      : _secure = secure ?? const FlutterSecureStorage();

  final FlutterSecureStorage _secure;

  Future<void> saveSession({
    required String apiOrigin,
    required String access,
    required String refresh,
    required String username,
    required bool isStaff,
    required bool canConfigureSmsGateway,
  }) async {
    final origin = normalizeApiOrigin(apiOrigin);
    await _secure.write(key: _kAccess, value: access);
    await _secure.write(key: _kRefresh, value: refresh);
    await _secure.write(key: _kOrigin, value: origin);
    await _secure.write(key: _kUsername, value: username);
    await _secure.write(key: _kIsStaff, value: isStaff ? '1' : '0');
    await _secure.write(key: _kCanSms, value: canConfigureSmsGateway ? '1' : '0');

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(kPrefFieldApiOrigin, origin);
    final wh = prefs.getString('gateway_webhook_url')?.trim() ?? '';
    if (wh.isEmpty) {
      await prefs.setString('gateway_webhook_url', '$origin/api/sms/incoming/');
    }
  }

  Future<void> clearSession() async {
    await _secure.deleteAll();
  }

  /// Restore session from secure storage; refresh access token if needed.
  Future<AppSession?> tryRestoreSession() async {
    final origin = await _secure.read(key: _kOrigin);
    var access = await _secure.read(key: _kAccess);
    final refresh = await _secure.read(key: _kRefresh);
    if (origin == null || origin.isEmpty || access == null) {
      return null;
    }

    var me = await _getMe(origin, access);
    if (me == null && refresh != null && refresh.isNotEmpty) {
      final fresh = await _refreshAccess(origin, refresh);
      if (fresh != null) {
        await _secure.write(key: _kAccess, value: fresh);
        access = fresh;
        me = await _getMe(origin, fresh);
      }
    }
    if (me == null) {
      await clearSession();
      return null;
    }

    final username = me['username'] as String? ?? await _secure.read(key: _kUsername) ?? '';
    final isStaff = me['is_staff'] == true;
    final canSms = me['can_configure_sms_gateway'] == true;
    await saveSession(
      apiOrigin: origin,
      access: access,
      refresh: refresh ?? '',
      username: username,
      isStaff: isStaff,
      canConfigureSmsGateway: canSms,
    );
    return AppSession(
      apiOrigin: normalizeApiOrigin(origin),
      accessToken: access,
      refreshToken: refresh ?? '',
      username: username,
      isStaff: isStaff,
      canConfigureSmsGateway: canSms,
    );
  }
}
