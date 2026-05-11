import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Lime pin / droplet from `assets/branding/logo_mark.svg`.
class BrandLogoMark extends StatelessWidget {
  const BrandLogoMark({super.key, this.height = 48});

  final double height;

  @override
  Widget build(BuildContext context) {
    return SvgPicture.asset(
      'assets/branding/logo_mark.svg',
      height: height,
      semanticsLabel: 'WaterWise',
    );
  }
}
