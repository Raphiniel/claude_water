# WaterWise API — SMS gateway (Android)

Forwards incoming SMS to your Django webhook `POST /api/sms/incoming/` with headers `X-SMS-Gateway: 1` and optional `X-SMS-Gateway-Secret`. When the server returns JSON with `outbound_sms`, the app can send that text back to the reporter using the handset SIM.

## Setup

1. On the server, set `SMS_GATEWAY_SHARED_SECRET` if you want the shared secret header (see `backend/.env.example`).
2. Install the APK on the gateway phone (Econet SIM). Grant **SMS** permission.
3. Enter webhook URL, e.g. `https://your.domain/api/sms/incoming/`, optional secret, enable **Forward** and **Reply**.

Keep the app in the foreground or recents; listening uses foreground mode for reliability.

## Build release APK

```bash
cd mobile/sms_gateway
flutter pub get
flutter build apk --release
```

APK output: `build/app/outputs/flutter-apk/app-release.apk`

### If the build fails

- **Namespace / `telephony`:** The app uses a **vendored** copy in `packages/telephony` with `namespace` set for Android Gradle Plugin 8+. You should not need to edit your pub cache.
- **Kotlin daemon:** If you see `Could not connect to Kotlin compile daemon`, stop Gradle (`cd android` then `.\gradlew --stop`), close other IDEs using Gradle, and run `flutter build apk --release` again. This repo sets `kotlin.compiler.execution.strategy=in-process` in `android/gradle.properties` to reduce that failure mode.

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Learn Flutter](https://docs.flutter.dev/get-started/learn-flutter)
- [Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Flutter learning resources](https://docs.flutter.dev/reference/learning-resources)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.
