/// Signed-in operator session (JWT + profile flags).
class AppSession {
  const AppSession({
    required this.apiOrigin,
    required this.accessToken,
    required this.refreshToken,
    required this.username,
    required this.isStaff,
    required this.canConfigureSmsGateway,
    this.isOffline = false,
  });

  final String apiOrigin;
  final String accessToken;
  final String refreshToken;
  final String username;
  final bool isStaff;
  /// True only for Admins / superusers — handset SMS relay tab in the APK.
  final bool canConfigureSmsGateway;
  /// Session restored or signed in without reaching the server (cached tokens).
  final bool isOffline;

  AppSession copyWith({
    String? accessToken,
    bool? isOffline,
  }) {
    return AppSession(
      apiOrigin: apiOrigin,
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken,
      username: username,
      isStaff: isStaff,
      canConfigureSmsGateway: canConfigureSmsGateway,
      isOffline: isOffline ?? this.isOffline,
    );
  }
}
