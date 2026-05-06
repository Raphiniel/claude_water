import 'package:flutter_test/flutter_test.dart';
import 'package:sms_gateway/main.dart';

void main() {
  testWidgets('App builds', (WidgetTester tester) async {
    await tester.pumpWidget(const WaterWiseApp());
    expect(find.text(kAppName), findsWidgets);
  });
}