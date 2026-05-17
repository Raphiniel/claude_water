import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'app_models.dart';
import 'network_errors.dart';

/// SharedPreferences key for API host (field portal tab reads the same key).
const kPrefFieldApiOrigin = 'field_api_origin';

const _kAccess = 'waterwise_access_token';
const _kRefresh = 'waterwise_refresh_token';
const _kOrigin = 'waterwise_api_origin';
const _kUsername = 'waterwise_username';
const _kIsStaff = 'waterwise_is_staff';
const _kCanSms = 'waterwise_can_sms';
const _kOfflineLogin = 'waterwise_offline_login';

/// Backend origin only, e.g. `https://host` (no `/api` suffix).
String normalizeApiOrigin(String raw) {
  var o = raw.trim().replaceAll(RegExp(r'/+$'), '');
  if (o.endsWith('/api')) {
    o = o.substring(0, o.length - 4);
  }
  return o.replaceAll(RegExp(r'/+$'), '');
}

class _MeFetchResult {
  const _MeFetchResult({
    this.profile,
    this.networkFailure = false,
    this.unauthorized = false,
  });

  final Map<String, dynamic>? profile;
  final bool networkFailure;
  final bool unauthorized;
}

class _RefreshResult {
  const _RefreshResult({
    this.access,
    this.networkFailure = false,
  });

  final String? access;
  final bool networkFailure;
}

Future<_MeFetchResult> _fetchMe(String origin, String access) async {
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
    if (res.statusCode == 401) {
      return const _MeFetchResult(unauthorized: true);
    }
    if (res.statusCode != 200) {
      return const _MeFetchResult();
    }
    final body = jsonDecode(res.body);
    if (body is Map<String, dynamic>) {
      return _MeFetchResult(profile: body);
    }
    return const _MeFetchResult();
  } catch (e) {
    if (isNetworkError(e)) {
      return const _MeFetchResult(networkFailure: true);
    }
    return const _MeFetchResult();
  }
}

Future<_RefreshResult> _refreshAccessDetailed(String origin, String refresh) async {
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
    if (res.statusCode == 401 || res.statusCode == 400) {
      return const _RefreshResult();
    }
    if (res.statusCode != 200) {
      return const _RefreshResult();
    }
    final body = jsonDecode(res.body);
    if (body is Map<String, dynamic> && body['access'] is String) {
      return _RefreshResult(access: body['access'] as String);
    }
    return const _RefreshResult();
  } catch (e) {
    if (isNetworkError(e)) {
      return const _RefreshResult(networkFailure: true);
    }
    return const _RefreshResult();
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
    String? password,
  }) async {
    final origin = normalizeApiOrigin(apiOrigin);
    await _secure.write(key: _kAccess, value: access);
    await _secure.write(key: _kRefresh, value: refresh);
    await _secure.write(key: _kOrigin, value: origin);
    await _secure.write(key: _kUsername, value: username);
    await _secure.write(key: _kIsStaff, value: isStaff ? '1' : '0');
    await _secure.write(key: _kCanSms, value: canConfigureSmsGateway ? '1' : '0');

    if (password != null && password.isNotEmpty) {
      await _secure.write(
        key: _kOfflineLogin,
        value: jsonEncode({
          'origin': origin,
          'username': username,
          'password': password,
        }),
      );
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(kPrefFieldApiOrigin, origin);
    final wh = prefs.getString('gateway_webhook_url')?.trim() ?? '';
    if (wh.isEmpty) {
      await prefs.setString('gateway_webhook_url', '$origin/api/sms/incoming/');
    }
  }

  Future<void> clearSession() async {
    await _secure.delete(key: _kAccess);
    await _secure.delete(key: _kRefresh);
    await _secure.delete(key: _kOrigin);
    await _secure.delete(key: _kUsername);
    await _secure.delete(key: _kIsStaff);
    await _secure.delete(key: _kCanSms);
    await _secure.delete(key: _kOfflineLogin);
  }

  Future<bool> hasOfflineCredentialsFor({
    required String apiOrigin,
    required String username,
  }) async {
    final stored = await _readOfflineLoginRecord();
    if (stored == null) return false;
    return stored['origin'] == normalizeApiOrigin(apiOrigin) &&
        stored['username'] == username.trim();
  }

  Future<Map<String, String>?> _readOfflineLoginRecord() async {
    final raw = await _secure.read(key: _kOfflineLogin);
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) return null;
      final origin = decoded['origin'] as String?;
      final uname = decoded['username'] as String?;
      final pass = decoded['password'] as String?;
      if (origin == null || uname == null || pass == null) return null;
      return {'origin': origin, 'username': uname, 'password': pass};
    } catch (_) {
      return null;
    }
  }

  Future<AppSession?> _loadCachedSession({bool isOffline = false}) async {
    final origin = await _secure.read(key: _kOrigin);
    final access = await _secure.read(key: _kAccess);
    final refresh = await _secure.read(key: _kRefresh);
    if (origin == null || origin.isEmpty || access == null || access.isEmpty) {
      return null;
    }

    final username = await _secure.read(key: _kUsername) ?? '';
    final isStaff = (await _secure.read(key: _kIsStaff)) == '1';
    final canSms = (await _secure.read(key: _kCanSms)) == '1';

    return AppSession(
      apiOrigin: normalizeApiOrigin(origin),
      accessToken: access,
      refreshToken: refresh ?? '',
      username: username,
      isStaff: isStaff,
      canConfigureSmsGateway: canSms,
      isOffline: isOffline,
    );
  }

  AppSession _sessionFromProfile({
    required Map<String, dynamic> me,
    required String origin,
    required String access,
    required String refresh,
    bool isOffline = false,
  }) {
    final username = me['username'] as String? ?? '';
    final isStaff = me['is_staff'] == true;
    final canSms = me['can_configure_sms_gateway'] == true;
    return AppSession(
      apiOrigin: normalizeApiOrigin(origin),
      accessToken: access,
      refreshToken: refresh,
      username: username,
      isStaff: isStaff,
      canConfigureSmsGateway: canSms,
      isOffline: isOffline,
    );
  }

  /// Sign in using credentials saved after a prior online login (no network).
  Future<AppSession?> tryOfflineLogin({
    required String apiOrigin,
    required String username,
    required String password,
  }) async {
    final stored = await _readOfflineLoginRecord();
    if (stored == null) return null;

    final origin = normalizeApiOrigin(apiOrigin);
    if (stored['origin'] != origin) return null;
    if (stored['username'] != username.trim()) return null;
    if (stored['password'] != password) return null;

    return _loadCachedSession(isOffline: true);
  }

  /// Restore session from secure storage; refresh access token when online.
  Future<AppSession?> tryRestoreSession() async {
    final cached = await _loadCachedSession();
    if (cached == null) return null;

    final origin = cached.apiOrigin;
    var access = cached.accessToken;
    final refresh = cached.refreshToken;

    var meResult = await _fetchMe(origin, access);
    if (meResult.profile != null) {
      final session = _sessionFromProfile(
        me: meResult.profile!,
        origin: origin,
        access: access,
        refresh: refresh,
      );
      await saveSession(
        apiOrigin: origin,
        access: access,
        refresh: refresh,
        username: session.username,
        isStaff: session.isStaff,
        canConfigureSmsGateway: session.canConfigureSmsGateway,
      );
      return session;
    }
    if (meResult.networkFailure) {
      return cached.copyWith(isOffline: true);
    }

    if (meResult.unauthorized && refresh.isNotEmpty) {
      final refreshResult = await _refreshAccessDetailed(origin, refresh);
      if (refreshResult.networkFailure) {
        return cached.copyWith(isOffline: true);
      }
      if (refreshResult.access != null) {
        access = refreshResult.access!;
        await _secure.write(key: _kAccess, value: access);
        meResult = await _fetchMe(origin, access);
        if (meResult.profile != null) {
          final session = _sessionFromProfile(
            me: meResult.profile!,
            origin: origin,
            access: access,
            refresh: refresh,
          );
          await saveSession(
            apiOrigin: origin,
            access: access,
            refresh: refresh,
            username: session.username,
            isStaff: session.isStaff,
            canConfigureSmsGateway: session.canConfigureSmsGateway,
          );
          return session;
        }
        if (meResult.networkFailure) {
          return cached.copyWith(accessToken: access, isOffline: true);
        }
      }
    }

    if (meResult.networkFailure) {
      return cached.copyWith(isOffline: true);
    }

    await clearSession();
    return null;
  }
}
