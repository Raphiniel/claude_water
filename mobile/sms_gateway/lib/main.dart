import 'dart:async' show unawaited;
import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:telephony/telephony.dart';

/// User-facing product name (launcher, app bar).
const String kAppName = 'WaterWise API';

const _kPrefUrl = 'gateway_webhook_url';
const _kPrefSecret = 'gateway_shared_secret';
const _kPrefForward = 'gateway_forward';
const _kPrefReply = 'gateway_reply';

/// Top-level handler required by [Telephony.listenIncomingSms] for background SMS.
/// Must stay a library-level function (not a class/instance method).
@pragma('vm:entry-point')
Future<void> waterwiseSmsBackgroundHandler(SmsMessage message) async {
  await processInboundSms(
    message,
    onLog: (s) => debugPrint('[WaterWise SMS bg] $s'),
  );
}

Future<void> processInboundSms(
  SmsMessage msg, {
  void Function(String line)? onLog,
}) async {
  void log(String m) => onLog?.call(m);

  final prefs = await SharedPreferences.getInstance();
  final url = prefs.getString(_kPrefUrl)?.trim() ?? '';
  final secret = prefs.getString(_kPrefSecret)?.trim() ?? '';
  final forward = prefs.getBool(_kPrefForward) ?? false;
  final reply = prefs.getBool(_kPrefReply) ?? true;

  if (!forward) {
    log('Skip: forwarding off');
    return;
  }
  if (url.isEmpty) {
    log('Skip: webhook URL empty');
    return;
  }

  final uri = Uri.tryParse(url);
  if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
    log('Bad webhook URL');
    return;
  }

  final from = msg.address?.trim() ?? '';
  final text = msg.body ?? '';
  if (from.isEmpty) {
    log('Skip: no sender address');
    return;
  }

  final headers = <String, String>{
    'X-SMS-Gateway': '1',
    'Accept': 'application/json',
  };
  if (secret.isNotEmpty) {
    headers['X-SMS-Gateway-Secret'] = secret;
  }

  try {
    log('POST → $uri (from $from)');
    final response = await http
        .post(
          uri,
          headers: headers,
          body: {'from': from, 'text': text},
        )
        .timeout(const Duration(seconds: 45));

    log('HTTP ${response.statusCode}');

    Map<String, dynamic>? jsonBody;
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        jsonBody = decoded;
      }
    } catch (_) {
      /* plain GOOD/BAD from legacy webhook */
    }

    final outbound = jsonBody?['outbound_sms'];
    if (reply &&
        outbound is String &&
        outbound.trim().isNotEmpty) {
      final telephony = Telephony.instance;
      await telephony.sendSms(
        to: from,
        message: outbound.trim(),
        isMultipart: outbound.length > 160,
        subscriptionId: msg.subscriptionId,
      );
      log('Reply SMS sent to $from (HTTP ${response.statusCode})');
      return;
    }

    if (response.statusCode == 403) {
      log('Forbidden: check X-SMS-Gateway-Secret vs server SMS_GATEWAY_SHARED_SECRET');
      return;
    }

    if (!reply) {
      return;
    }

    log('No outbound_sms in response (HTTP ${response.statusCode})');
  } catch (e, st) {
    log('Error: $e');
    debugPrintStack(stackTrace: st);
  }
}

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const WaterWiseApp());
}

class WaterWiseApp extends StatelessWidget {
  const WaterWiseApp({super.key});

  @override
  Widget build(BuildContext context) {
    final base = ColorScheme.fromSeed(
      seedColor: const Color(0xFF0369A1),
      brightness: Brightness.light,
      primary: const Color(0xFF0369A1),
      secondary: const Color(0xFF0EA5E9),
      surface: const Color(0xFFF0F9FF),
    );

    return MaterialApp(
      title: kAppName,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: base,
        appBarTheme: AppBarTheme(
          centerTitle: false,
          elevation: 0,
          scrolledUnderElevation: 0.5,
          backgroundColor: base.surface,
          foregroundColor: base.onSurface,
          titleTextStyle: TextStyle(
            color: base.onSurface,
            fontSize: 20,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.3,
          ),
        ),
        cardTheme: CardThemeData(
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          color: Colors.white,
          surfaceTintColor: Colors.transparent,
          margin: EdgeInsets.zero,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: base.surface,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: base.outlineVariant),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: base.primary, width: 2),
          ),
        ),
        listTileTheme: ListTileThemeData(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      home: const GatewayHomePage(),
    );
  }
}

class GatewayHomePage extends StatefulWidget {
  const GatewayHomePage({super.key});

  @override
  State<GatewayHomePage> createState() => _GatewayHomePageState();
}

class _GatewayHomePageState extends State<GatewayHomePage>
    with WidgetsBindingObserver {
  final _urlCtrl = TextEditingController();
  final _secretCtrl = TextEditingController();
  final Telephony _telephony = Telephony.instance;

  bool _forwarding = false;
  bool _replyEnabled = true;
  bool _listenerReady = false;
  String _permLine = 'Tap the button below to grant SMS access.';
  String _batteryLine = '';

  final List<String> _log = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load().then((_) {
      _refreshPermLine();
      _refreshBatteryLine();
      _attachListener();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _urlCtrl.dispose();
    _secretCtrl.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(_onAppResumed());
    }
  }

  Future<void> _onAppResumed() async {
    await _refreshPermLine();
    await _refreshBatteryLine();
    if (!mounted) return;
    final st = await Permission.sms.status;
    if (!mounted) return;
    if (st.isGranted && !_listenerReady) {
      await _attachListener();
    }
  }

  Future<void> _load() async {
    final p = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      _urlCtrl.text = p.getString(_kPrefUrl) ?? '';
      _secretCtrl.text = p.getString(_kPrefSecret) ?? '';
      _forwarding = p.getBool(_kPrefForward) ?? false;
      _replyEnabled = p.getBool(_kPrefReply) ?? true;
    });
  }

  Future<void> _persist() async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_kPrefUrl, _urlCtrl.text.trim());
    await p.setString(_kPrefSecret, _secretCtrl.text.trim());
    await p.setBool(_kPrefForward, _forwarding);
    await p.setBool(_kPrefReply, _replyEnabled);
  }

  void _addLog(String line) {
    final ts = TimeOfDay.now().format(context);
    setState(() {
      _log.insert(0, '[$ts] $line');
      if (_log.length > 120) {
        _log.removeLast();
      }
    });
  }

  Future<void> _refreshPermLine() async {
    final st = await Permission.sms.status;
    if (!mounted) return;
    setState(() {
      _permLine = st.isGranted
          ? 'SMS access granted — this device can receive and send relay messages.'
          : 'SMS permission required to forward reports and send replies.';
    });
  }

  Future<void> _requestSmsPermission() async {
    await Permission.sms.request();
    await _telephony.requestSmsPermissions;
    final st = await Permission.sms.status;
    if (!mounted) return;
    setState(() {
      _permLine = st.isGranted
          ? 'SMS access granted — this device can receive and send relay messages.'
          : st.isPermanentlyDenied
              ? 'SMS blocked in system settings — use Open settings when prompted.'
              : 'Permission denied. Enable SMS in system settings for this app.';
    });
    if (st.isGranted) {
      await _attachListener();
    } else {
      _addLog('SMS permission denied');
      if (st.isPermanentlyDenied) {
        _showOpenSmsSettingsSnack();
      }
    }
  }

  void _showOpenSmsSettingsSnack() {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        content: const Text('Enable SMS permissions for this app in system settings.'),
        action: SnackBarAction(
          label: 'Open settings',
          onPressed: () {
            unawaited(openAppSettings());
          },
        ),
      ),
    );
  }

  Future<void> _refreshBatteryLine() async {
    if (!Platform.isAndroid) {
      if (mounted) setState(() => _batteryLine = '');
      return;
    }
    final st = await Permission.ignoreBatteryOptimizations.status;
    if (!mounted) return;
    setState(() {
      _batteryLine = st.isGranted
          ? 'Battery: unrestricted — good for relay while the phone is locked or the screen is off.'
          : 'Battery: still optimized — Android may delay or block the webhook POST when the screen is off. Tap below to allow.';
    });
  }

  /// Lets the relay finish HTTPS while the device is dozing (locked / screen off).
  Future<void> _requestUnrestrictedBattery() async {
    if (!Platform.isAndroid) return;
    final req = await Permission.ignoreBatteryOptimizations.request();
    await _refreshBatteryLine();
    if (!mounted) return;
    if (req.isGranted) {
      _addLog('Battery unrestricted — background POSTs allowed');
    } else {
      _addLog('Battery still restricted — use system settings if the dialog was skipped');
    }
  }

  Future<void> _attachListener() async {
    try {
      _telephony.listenIncomingSms(
        onNewMessage: (SmsMessage message) {
          processInboundSms(message, onLog: (s) {
            if (mounted) _addLog(s);
          });
        },
        onBackgroundMessage: waterwiseSmsBackgroundHandler,
        listenInBackground: true,
      );
      if (!mounted) return;
      setState(() => _listenerReady = true);
      _addLog('Listening for incoming SMS (foreground + background)');
    } catch (e) {
      if (mounted) {
        setState(() => _listenerReady = false);
        _addLog('listenIncomingSms failed: $e');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      backgroundColor: scheme.surface,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(kAppName),
            Text(
              'SMS gateway',
              style: textTheme.labelMedium?.copyWith(
                color: scheme.onSurfaceVariant,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Save settings',
            onPressed: () async {
              await _persist();
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  behavior: SnackBarBehavior.floating,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  content: const Text('Settings saved'),
                ),
              );
            },
            icon: const Icon(Icons.save_rounded),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
        children: [
          _HeroCard(scheme: scheme, textTheme: textTheme),
          const SizedBox(height: 16),
          _SectionCard(
            icon: Icons.shield_outlined,
            title: 'Permissions',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  _permLine,
                  style: textTheme.bodyMedium?.copyWith(
                    color: scheme.onSurfaceVariant,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 14),
                FilledButton.tonalIcon(
                  onPressed: _requestSmsPermission,
                  icon: const Icon(Icons.sms_outlined),
                  label: const Text('Grant SMS access'),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
                if (Platform.isAndroid) ...[
                  const SizedBox(height: 14),
                  Text(
                    _batteryLine.isEmpty
                        ? 'Checking battery settings…'
                        : _batteryLine,
                    style: textTheme.bodyMedium?.copyWith(
                      color: scheme.onSurfaceVariant,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 12),
                  FilledButton.tonalIcon(
                    onPressed: _requestUnrestrictedBattery,
                    icon: const Icon(Icons.battery_charging_full_rounded),
                    label: const Text('Allow unrestricted battery (locked / screen off)'),
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                Text(
                  'Tip: SMS is received in the background when the phone is locked. '
                  'For best results grant SMS + unrestricted battery above, open this app once after reboot, '
                  'and on Xiaomi / Oppo / Vivo enable autostart for this app in system settings. '
                  'Dual-SIM: replies use the same SIM that received each message; if texts still fail, '
                  'pick a default SMS SIM in Android settings.',
                  style: textTheme.bodySmall?.copyWith(
                    color: scheme.outline,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _SectionCard(
            icon: Icons.link_rounded,
            title: 'Server connection',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _urlCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Webhook URL',
                    hintText: 'https://your.domain/api/sms/incoming/',
                    prefixIcon: Icon(Icons.cloud_outlined),
                  ),
                  keyboardType: TextInputType.url,
                  autocorrect: false,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _secretCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Shared secret (optional)',
                    hintText: 'Matches SMS_GATEWAY_SHARED_SECRET on server',
                    prefixIcon: Icon(Icons.key_outlined),
                  ),
                  obscureText: true,
                  autocorrect: false,
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _SectionCard(
            icon: Icons.tune_rounded,
            title: 'Relay options',
            child: Column(
              children: [
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Forward SMS to server'),
                  subtitle: Text(
                    'POST incoming texts to your WaterWise webhook',
                    style: textTheme.bodySmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                  value: _forwarding,
                  onChanged: (v) async {
                    setState(() => _forwarding = v);
                    await _persist();
                  },
                ),
                const Divider(height: 1),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Automatic reply SMS'),
                  subtitle: Text(
                    'Send outbound_sms from the API response to the reporter',
                    style: textTheme.bodySmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                  value: _replyEnabled,
                  onChanged: (v) async {
                    setState(() => _replyEnabled = v);
                    await _persist();
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _StatusBanner(
            listenerReady: _listenerReady,
            scheme: scheme,
            textTheme: textTheme,
          ),
          const SizedBox(height: 16),
          _SectionCard(
            icon: Icons.article_outlined,
            title: 'Activity log',
            child: _log.isEmpty
                ? Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Text(
                      'No events yet. Incoming SMS will appear here.',
                      style: textTheme.bodySmall?.copyWith(
                        color: scheme.outline,
                      ),
                    ),
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: _log.map((line) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: SelectableText(
                          line,
                          style: textTheme.bodySmall?.copyWith(
                            fontFamily: 'monospace',
                            fontFamilyFallback: const ['monospace'],
                            height: 1.35,
                            color: scheme.onSurfaceVariant,
                          ),
                        ),
                      );
                    }).toList(),
                  ),
          ),
        ],
      ),
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.scheme, required this.textTheme});

  final ColorScheme scheme;
  final TextTheme textTheme;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            scheme.primary,
            scheme.primary.withValues(alpha: 0.85),
            const Color(0xFF0284C7),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: scheme.primary.withValues(alpha: 0.28),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(Icons.water_drop_rounded, color: scheme.onPrimary, size: 32),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Fault SMS relay',
                  style: textTheme.titleMedium?.copyWith(
                    color: scheme.onPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Bridge handset SMS to your API and optional auto-replies.',
                  style: textTheme.bodySmall?.copyWith(
                    color: scheme.onPrimary.withValues(alpha: 0.92),
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.icon,
    required this.title,
    required this.child,
  });

  final IconData icon;
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 22, color: scheme.primary),
                const SizedBox(width: 10),
                Text(
                  title,
                  style: textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            child,
          ],
        ),
      ),
    );
  }
}

class _StatusBanner extends StatelessWidget {
  const _StatusBanner({
    required this.listenerReady,
    required this.scheme,
    required this.textTheme,
  });

  final bool listenerReady;
  final ColorScheme scheme;
  final TextTheme textTheme;

  @override
  Widget build(BuildContext context) {
    final ok = listenerReady;
    final bg = ok
        ? scheme.primaryContainer.withValues(alpha: 0.55)
        : scheme.errorContainer.withValues(alpha: 0.45);
    final fg = ok ? scheme.onPrimaryContainer : scheme.onErrorContainer;
    final icon = ok ? Icons.hearing_rounded : Icons.hearing_disabled_rounded;

    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Icon(icon, color: fg, size: 26),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    ok ? 'Listener active' : 'Listener not active',
                    style: textTheme.titleSmall?.copyWith(
                      color: fg,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    ok
                        ? 'Foreground and background — ready for incoming messages.'
                        : 'Check permissions or return from settings; the listener retries automatically.',
                    style: textTheme.bodySmall?.copyWith(color: fg, height: 1.3),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
