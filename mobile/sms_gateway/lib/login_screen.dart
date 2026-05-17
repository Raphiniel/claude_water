import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'app_models.dart';
import 'auth_storage.dart';
import 'brand_assets.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.onSuccess});

  final void Function(AppSession session) onSuccess;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _originCtrl = TextEditingController();
  final _userCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _originCtrl.text = kDefaultWaterwiseApiOrigin;
  }

  @override
  void dispose() {
    _originCtrl.dispose();
    _userCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    var origin = normalizeApiOrigin(_originCtrl.text);
    if (origin.isEmpty) {
      origin = kDefaultWaterwiseApiOrigin;
    }
    final username = _userCtrl.text.trim();
    final password = _passCtrl.text;
    if (username.isEmpty || password.isEmpty) {
      setState(() {
        _busy = false;
        _error = 'Enter username and password.';
      });
      return;
    }

    final tokenUri = Uri.parse('$origin/api/token/');
    try {
      final tok = await http
          .post(
            tokenUri,
            headers: const {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: jsonEncode({'username': username, 'password': password}),
          )
          .timeout(const Duration(seconds: 30));

      if (tok.statusCode == 401) {
        setState(() {
          _busy = false;
          _error = 'Invalid username or password.';
        });
        return;
      }
      if (tok.statusCode != 200) {
        setState(() {
          _busy = false;
          _error = 'Login failed (HTTP ${tok.statusCode}). Check the server URL.';
        });
        return;
      }

      final tokBody = jsonDecode(tok.body);
      if (tokBody is! Map<String, dynamic>) {
        setState(() {
          _busy = false;
          _error = 'Unexpected response from server.';
        });
        return;
      }
      final access = tokBody['access'] as String?;
      final refresh = tokBody['refresh'] as String?;
      if (access == null || refresh == null) {
        setState(() {
          _busy = false;
          _error = 'Server did not return tokens.';
        });
        return;
      }

      final meUri = Uri.parse('$origin/api/me/');
      final meRes = await http
          .get(
            meUri,
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Bearer $access',
            },
          )
          .timeout(const Duration(seconds: 20));

      if (meRes.statusCode != 200) {
        setState(() {
          _busy = false;
          _error = 'Could not load profile (/api/me/).';
        });
        return;
      }
      final me = jsonDecode(meRes.body);
      if (me is! Map<String, dynamic>) {
        setState(() {
          _busy = false;
          _error = 'Invalid profile response.';
        });
        return;
      }

      final isStaff = me['is_staff'] == true;
      final canSms = me['can_configure_sms_gateway'] == true;
      final uname = me['username'] as String? ?? username;

      await AuthStorage().saveSession(
        apiOrigin: origin,
        access: access,
        refresh: refresh,
        username: uname,
        isStaff: isStaff,
        canConfigureSmsGateway: canSms,
      );

      if (!mounted) return;
      widget.onSuccess(
        AppSession(
          apiOrigin: origin,
          accessToken: access,
          refreshToken: refresh,
          username: uname,
          isStaff: isStaff,
          canConfigureSmsGateway: canSms,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Network error: $e';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      backgroundColor: scheme.surface,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Center(child: BrandLogoMark(height: 56)),
                  const SizedBox(height: 12),
                  Text(
                    'WaterWise API',
                    textAlign: TextAlign.center,
                    style: textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: scheme.primary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Sign in to configure the SMS relay (staff) or use field navigation.',
                    style: textTheme.bodyMedium?.copyWith(
                      color: scheme.onSurfaceVariant,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 28),
                  TextField(
                    controller: _originCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Server URL',
                      hintText: kDefaultWaterwiseApiOrigin,
                      helperText: 'Pre-filled for WaterWise production; change only for another host.',
                      prefixIcon: Icon(Icons.cloud_outlined),
                    ),
                    keyboardType: TextInputType.url,
                    autocorrect: false,
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _userCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Username',
                      prefixIcon: Icon(Icons.person_outline),
                    ),
                    autocorrect: false,
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _passCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Password',
                      prefixIcon: Icon(Icons.lock_outline),
                    ),
                    obscureText: true,
                    onSubmitted: (_) => _busy ? null : _submit(),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 14),
                    Text(_error!, style: textTheme.bodySmall?.copyWith(color: scheme.error)),
                  ],
                  const SizedBox(height: 22),
                  FilledButton(
                    onPressed: _busy ? null : _submit,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _busy
                        ? const SizedBox(
                            height: 22,
                            width: 22,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Sign in'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
