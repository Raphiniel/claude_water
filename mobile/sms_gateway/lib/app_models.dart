/// Signed-in operator session (JWT + profile flags).
class AppSession {
  const AppSession({
    required this.apiOrigin,
    required this.accessToken,
    required this.refreshToken,
    required this.username,
    required this.isStaff,
    required this.canConfigureSmsGateway,
  });

  final String apiOrigin;
  final String accessToken;
  final String refreshToken;
  final String username;
  final bool isStaff;
  /// True only for Admins / superusers — handset SMS relay tab in the APK.
  final bool canConfigureSmsGateway;
}
