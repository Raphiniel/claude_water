import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

const _kPrefApiOrigin = 'field_api_origin';
const _kPrefFieldToken = 'field_token';
const _kPrefShareGps = 'field_share_gps';
const _kWebhookUrlKey = 'gateway_webhook_url';

/// Google Maps turn-by-turn (external app), optionally from current GPS.
String googleMapsDrivingDirectionsUrl({
  required double destLat,
  required double destLng,
  double? originLat,
  double? originLng,
}) {
  final dest = Uri.encodeComponent('$destLat,$destLng');
  if (originLat != null && originLng != null) {
    final org = Uri.encodeComponent('$originLat,$originLng');
    return 'https://www.google.com/maps/dir/?api=1&origin=$org&destination=$dest&travelmode=driving';
  }
  return 'https://www.google.com/maps/dir/?api=1&destination=$dest&travelmode=driving';
}

Future<String?> resolveApiOrigin(SharedPreferences p) async {
  final o = p.getString(_kPrefApiOrigin)?.trim() ?? '';
  if (o.isNotEmpty) {
    return o.replaceAll(RegExp(r'/+$'), '');
  }
  final wh = p.getString(_kWebhookUrlKey)?.trim() ?? '';
  final u = Uri.tryParse(wh);
  if (u != null && u.hasScheme && u.host.isNotEmpty) {
    return '${u.scheme}://${u.authority}';
  }
  return null;
}

class FieldJob {
  FieldJob({
    required this.id,
    required this.ticketNumber,
    required this.status,
    required this.faultCode,
    required this.waterPointCode,
    required this.waterPointLocation,
    this.latitude,
    this.longitude,
  });

  final int id;
  final String ticketNumber;
  final String status;
  final String faultCode;
  final String waterPointCode;
  final String waterPointLocation;
  final double? latitude;
  final double? longitude;

  static FieldJob? fromJson(Map<String, dynamic> m) {
    final idRaw = m['id'];
    final id = idRaw is int ? idRaw : int.tryParse('$idRaw');
    if (id == null) return null;

    final latRaw = m['latitude'];
    final lngRaw = m['longitude'];
    double? lat;
    double? lng;
    if (latRaw != null && '$latRaw'.isNotEmpty) {
      lat = double.tryParse('$latRaw');
    }
    if (lngRaw != null && '$lngRaw'.isNotEmpty) {
      lng = double.tryParse('$lngRaw');
    }
    return FieldJob(
      id: id,
      ticketNumber: '${m['ticket_number'] ?? ''}',
      status: '${m['status'] ?? ''}',
      faultCode: '${m['fault_code'] ?? ''}',
      waterPointCode: '${m['water_point_code'] ?? ''}',
      waterPointLocation: '${m['water_point_location'] ?? ''}',
      latitude: lat,
      longitude: lng,
    );
  }
}

/// Technician: jobs, live GPS to server, open Google Maps with driving route.
class FieldPortalTab extends StatefulWidget {
  const FieldPortalTab({super.key});

  @override
  State<FieldPortalTab> createState() => _FieldPortalTabState();
}

class _FieldPortalTabState extends State<FieldPortalTab> with WidgetsBindingObserver {
  final _tokenCtrl = TextEditingController();
  final _apiOriginCtrl = TextEditingController();

  bool _shareGps = false;
  String _resolvedOrigin = '';
  String _techName = '';
  List<FieldJob> _jobs = [];
  String? _error;
  bool _loading = false;
  Position? _lastPosition;
  StreamSubscription<Position>? _posSub;
  DateTime? _lastPostAt;
  Timer? _jobsPoll;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_loadPrefs());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _tokenCtrl.dispose();
    _apiOriginCtrl.dispose();
    _posSub?.cancel();
    _jobsPoll?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _shareGps) {
      unawaited(_startGpsStream());
    }
  }

  Future<void> _loadPrefs() async {
    final p = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      _tokenCtrl.text = p.getString(_kPrefFieldToken) ?? '';
      _apiOriginCtrl.text = p.getString(_kPrefApiOrigin) ?? '';
      _shareGps = p.getBool(_kPrefShareGps) ?? false;
    });
    await _refreshResolvedOrigin();
    if (_shareGps) {
      await _startGpsStream();
    }
  }

  Future<void> _persistFieldPrefs() async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_kPrefFieldToken, _tokenCtrl.text.trim());
    await p.setString(_kPrefApiOrigin, _apiOriginCtrl.text.trim());
    await p.setBool(_kPrefShareGps, _shareGps);
  }

  Future<void> _refreshResolvedOrigin() async {
    final p = await SharedPreferences.getInstance();
    final r = await resolveApiOrigin(p);
    if (!mounted) return;
    setState(() {
      _resolvedOrigin = r ?? '';
    });
  }

  Future<String?> _requireApiOrigin() async {
    final p = await SharedPreferences.getInstance();
    final manual = _apiOriginCtrl.text.trim();
    if (manual.isNotEmpty) {
      return manual.replaceAll(RegExp(r'/+$'), '');
    }
    return resolveApiOrigin(p);
  }

  Future<void> _fetchJobs() async {
    final token = _tokenCtrl.text.trim();
    if (token.isEmpty) {
      setState(() {
        _error = 'Enter your field token (from your coordinator).';
        _jobs = [];
        _loading = false;
      });
      return;
    }
    final origin = await _requireApiOrigin();
    if (origin == null || origin.isEmpty) {
      setState(() {
        _error = 'Set API server URL or configure the SMS webhook on the Relay tab.';
        _jobs = [];
        _loading = false;
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    final uri = Uri.parse('$origin/api/field/jobs/').replace(
      queryParameters: {'token': token},
    );

    try {
      final res = await http.get(uri, headers: const {'Accept': 'application/json'}).timeout(
            const Duration(seconds: 30),
          );
      if (!mounted) return;
      if (res.statusCode == 404) {
        setState(() {
          _jobs = [];
          _techName = '';
          _error = 'Invalid token.';
          _loading = false;
        });
        return;
      }
      if (res.statusCode != 200) {
        setState(() {
          _jobs = [];
          _error = 'Could not load jobs (HTTP ${res.statusCode}).';
          _loading = false;
        });
        return;
      }
      final body = jsonDecode(res.body);
      if (body is! Map<String, dynamic>) {
        setState(() {
          _jobs = [];
          _error = 'Unexpected response.';
          _loading = false;
        });
        return;
      }
      final rawJobs = body['jobs'];
      final tech = body['technician'];
      final list = <FieldJob>[];
      if (rawJobs is List) {
        for (final e in rawJobs) {
          if (e is Map<String, dynamic>) {
            final j = FieldJob.fromJson(e);
            if (j != null) list.add(j);
          }
        }
      }
      setState(() {
        _jobs = list;
        _techName = tech is Map ? '${tech['name'] ?? ''}' : '';
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _jobs = [];
        _error = 'Network error: $e';
        _loading = false;
      });
    }
  }

  Future<void> _postPosition(double lat, double lng) async {
    final token = _tokenCtrl.text.trim();
    final origin = await _requireApiOrigin();
    if (token.isEmpty || origin == null || origin.isEmpty) return;

    final uri = Uri.parse('$origin/api/field/position/');
    try {
      await http
          .post(
            uri,
            headers: const {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: jsonEncode({
              'token': token,
              'latitude': lat,
              'longitude': lng,
            }),
          )
          .timeout(const Duration(seconds: 25));
    } catch (_) {
      /* best-effort */
    }
  }

  Future<void> _startGpsStream() async {
    await _posSub?.cancel();
    _posSub = null;

    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.deniedForever || perm == LocationPermission.denied) {
      if (!mounted) return;
      setState(() {
        _shareGps = false;
        _error = 'Location permission denied — enable it in system settings to share GPS.';
      });
      await _persistFieldPrefs();
      return;
    }

    const settings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 35,
    );

    _posSub = Geolocator.getPositionStream(locationSettings: settings).listen(
      (pos) async {
        if (!mounted) return;
        setState(() => _lastPosition = pos);

        final now = DateTime.now();
        if (_lastPostAt != null && now.difference(_lastPostAt!) < const Duration(seconds: 12)) {
          return;
        }
        _lastPostAt = now;
        await _postPosition(pos.latitude, pos.longitude);
      },
      onError: (_) {},
    );
  }

  Future<void> _onShareGpsChanged(bool v) async {
    setState(() => _shareGps = v);
    await _persistFieldPrefs();
    if (v) {
      await _startGpsStream();
    } else {
      await _posSub?.cancel();
      _posSub = null;
      if (mounted) setState(() => _lastPosition = null);
    }
  }

  Future<void> _openMapsRoute(FieldJob job) async {
    final lat = job.latitude;
    final lng = job.longitude;
    if (lat == null || lng == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          behavior: SnackBarBehavior.floating,
          content: Text('This job has no map coordinates for the water point.'),
        ),
      );
      return;
    }

    final p = _lastPosition;
    final url = googleMapsDrivingDirectionsUrl(
      destLat: lat,
      destLng: lng,
      originLat: p?.latitude,
      originLng: p?.longitude,
    );
    final uri = Uri.parse(url);
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          behavior: SnackBarBehavior.floating,
          content: Text('Could not open Maps. Install Google Maps or a browser.'),
        ),
      );
    }
  }

  void _beginJobsPolling() {
    _jobsPoll?.cancel();
    _jobsPoll = Timer.periodic(const Duration(seconds: 45), (_) => _fetchJobs());
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return RefreshIndicator(
      onRefresh: () async {
        await _refreshResolvedOrigin();
        await _fetchJobs();
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          Text(
            'Open assigned jobs in Google Maps with driving directions (like ride-hailing apps). '
            'Turn on GPS sharing so dispatch sees your live position.',
            style: textTheme.bodyMedium?.copyWith(
              color: scheme.onSurfaceVariant,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _apiOriginCtrl,
            decoration: InputDecoration(
              labelText: 'API server (optional)',
              hintText: 'https://your-server.com',
              prefixIcon: const Icon(Icons.dns_outlined),
              helperText: _resolvedOrigin.isEmpty
                  ? 'Uses the same host as the Relay tab webhook when empty.'
                  : 'Resolved host: $_resolvedOrigin',
            ),
            keyboardType: TextInputType.url,
            autocorrect: false,
            onChanged: (_) => unawaited(_refreshResolvedOrigin()),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _tokenCtrl,
            decoration: const InputDecoration(
              labelText: 'Field token',
              hintText: 'UUID from coordinator / Technicians screen',
              prefixIcon: Icon(Icons.badge_outlined),
            ),
            autocorrect: false,
          ),
          const SizedBox(height: 12),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Share GPS with dispatch'),
            subtitle: Text(
              'Sends your location to the server while this tab is active.',
              style: textTheme.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
            ),
            value: _shareGps,
            onChanged: _onShareGpsChanged,
          ),
          if (_lastPosition != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                'Last fix: ${_lastPosition!.latitude.toStringAsFixed(5)}, '
                '${_lastPosition!.longitude.toStringAsFixed(5)}',
                style: textTheme.bodySmall?.copyWith(color: scheme.outline, fontFamily: 'monospace'),
              ),
            ),
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: _loading
                ? null
                : () async {
                    await _persistFieldPrefs();
                    await _fetchJobs();
                    _beginJobsPolling();
                  },
            icon: _loading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh_rounded),
            label: const Text('Load / refresh jobs'),
          ),
          if (_techName.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              'Signed in as $_techName',
              style: textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: textTheme.bodyMedium?.copyWith(color: scheme.error)),
          ],
          const SizedBox(height: 20),
          Text(
            'My jobs',
            style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          if (!_loading && _jobs.isEmpty && _error == null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Text(
                'No open jobs yet. Tap “Load / refresh jobs” after entering your token.',
                style: textTheme.bodySmall?.copyWith(color: scheme.outline),
              ),
            ),
          ..._jobs.map((j) {
            final hasCoords = j.latitude != null && j.longitude != null;
            return Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            j.ticketNumber,
                            style: textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                          ),
                        ),
                        Chip(
                          label: Text(j.status, style: textTheme.labelSmall),
                          visualDensity: VisualDensity.compact,
                          padding: EdgeInsets.zero,
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${j.waterPointCode} · ${j.waterPointLocation}',
                      style: textTheme.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
                    ),
                    Text('Fault: ${j.faultCode}', style: textTheme.bodySmall),
                    const SizedBox(height: 10),
                    FilledButton.tonalIcon(
                      onPressed: hasCoords ? () => _openMapsRoute(j) : null,
                      icon: const Icon(Icons.turn_right_rounded),
                      label: const Text('Navigate in Google Maps'),
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(44),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}
