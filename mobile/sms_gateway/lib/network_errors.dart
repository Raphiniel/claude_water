import 'dart:async';
import 'dart:io';

import 'package:http/http.dart' as http;

/// True when the failure is connectivity-related (not bad credentials or HTTP 4xx/5xx).
bool isNetworkError(Object error) {
  if (error is SocketException || error is TimeoutException) return true;
  if (error is http.ClientException) return true;
  if (error is HandshakeException || error is TlsException) return true;
  if (error is IOException && error is! FileSystemException) return true;

  final lower = error.toString().toLowerCase();
  return lower.contains('failed host lookup') ||
      lower.contains('network is unreachable') ||
      lower.contains('connection refused') ||
      lower.contains('connection reset') ||
      lower.contains('connection timed out') ||
      lower.contains('no address associated with hostname') ||
      lower.contains('socketexception') ||
      lower.contains('clientexception');
}

String loginOfflineErrorMessage({required bool hasStoredCredentials}) {
  if (hasStoredCredentials) {
    return 'No internet connection. Use the same username and password '
        'from your last successful online sign-in on this device.';
  }
  return 'No internet connection. Connect to the internet for your first '
      'sign-in on this device, then you can sign in offline later.';
}

String loginUnreachableServerMessage() {
  return 'Could not reach the server. Check the server URL, mobile data, or Wi‑Fi.';
}
