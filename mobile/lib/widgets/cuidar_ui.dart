import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import '../core/theme/app_text_styles.dart';

/// Kit de componentes do Cuidar+ — espelha o design system do sistema web
/// (bolhas orgânicas, bolhas de ícone, badges com ícone, anéis e barras de
/// progresso, trilha da jornada e celebração).

// ------------------------------------------------------------------ Bolha orgânica
class OrganicBlob extends StatelessWidget {
  final Color color;
  final double size;
  final int variant;
  const OrganicBlob({super.key, required this.color, this.size = 120, this.variant = 0});

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(child: CustomPaint(size: Size.square(size), painter: _BlobPainter(color, variant)));
  }
}

class _BlobPainter extends CustomPainter {
  final Color color;
  final int variant;
  _BlobPainter(this.color, this.variant);

  @override
  void paint(Canvas canvas, Size size) {
    final r = size.width / 2;
    final c = Offset(r, r);
    const points = 8;
    final seeds = [
      [1.0, 0.82, 0.95, 0.78, 1.0, 0.86, 0.92, 0.8],
      [0.9, 1.0, 0.8, 0.94, 0.84, 1.0, 0.78, 0.92],
      [0.95, 0.8, 1.0, 0.85, 0.9, 0.78, 1.0, 0.88],
    ][variant % 3];
    final pts = <Offset>[];
    for (var i = 0; i < points; i++) {
      final a = (2 * math.pi / points) * i;
      pts.add(c + Offset(math.cos(a), math.sin(a)) * r * seeds[i]);
    }
    final path = Path();
    for (var i = 0; i < points; i++) {
      final p0 = pts[(i - 1 + points) % points];
      final p1 = pts[i];
      final p2 = pts[(i + 1) % points];
      final p3 = pts[(i + 2) % points];
      if (i == 0) path.moveTo(p1.dx, p1.dy);
      final cp1 = p1 + (p2 - p0) / 6;
      final cp2 = p2 - (p3 - p1) / 6;
      path.cubicTo(cp1.dx, cp1.dy, cp2.dx, cp2.dy, p2.dx, p2.dy);
    }
    path.close();
    canvas.drawPath(path, Paint()..color = color);
  }

  @override
  bool shouldRepaint(covariant _BlobPainter old) => old.color != color || old.variant != variant;
}

// ------------------------------------------------------------------ Bolha de ícone
class IconBubble extends StatelessWidget {
  final IconData icon;
  final Tone tone;
  final double size;
  final bool solid;
  const IconBubble({super.key, required this.icon, this.tone = Tone.lilac, this.size = 44, this.solid = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: solid ? tone.edge : tone.soft,
        borderRadius: BorderRadius.circular(size * 0.32),
      ),
      child: Icon(icon, size: size * 0.5, color: solid ? Colors.white : tone.ink),
    );
  }
}

// ------------------------------------------------------------------ Badge (cor + ícone + texto)
class ToneBadge extends StatelessWidget {
  final String label;
  final Tone tone;
  final IconData? icon;
  final bool small;
  const ToneBadge({super.key, required this.label, this.tone = Tone.neutral, this.icon, this.small = true});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: small ? 8 : 10, vertical: small ? 3 : 5),
      decoration: BoxDecoration(color: tone.soft, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: small ? 13 : 15, color: tone.ink), const SizedBox(width: 4)],
          Text(label, style: AppTextStyles.label.copyWith(fontSize: small ? 11.5 : 13, color: tone.ink, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

// ------------------------------------------------------------------ Card com cabeçalho
class SectionCard extends StatelessWidget {
  final String title;
  final String? subtitle;
  final IconData? icon;
  final Tone tone;
  final Widget child;
  final Widget? action;
  final EdgeInsetsGeometry padding;
  const SectionCard({
    super.key,
    required this.title,
    required this.child,
    this.subtitle,
    this.icon,
    this.tone = Tone.lilac,
    this.action,
    this.padding = const EdgeInsets.fromLTRB(16, 0, 16, 16),
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 12, 12),
            child: Row(
              children: [
                if (icon != null) ...[IconBubble(icon: icon!, tone: tone, size: 36), const SizedBox(width: 12)],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: AppTextStyles.subtitle.copyWith(fontSize: 17, fontWeight: FontWeight.w700)),
                      if (subtitle != null) Text(subtitle!, style: AppTextStyles.bodySm.copyWith(color: AppColors.secondaryText)),
                    ],
                  ),
                ),
                ?action,
              ],
            ),
          ),
          Padding(padding: padding, child: child),
        ],
      ),
    );
  }
}

BoxDecoration cardDecoration({Color color = Colors.white}) => BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(24),
      border: Border.all(color: AppColors.line),
      boxShadow: const [BoxShadow(color: Color(0x0A101828), blurRadius: 2, offset: Offset(0, 1))],
    );

// ------------------------------------------------------------------ Indicador com bolha no canto
class StatTile extends StatelessWidget {
  final String label;
  final String value;
  final String? suffix;
  final IconData icon;
  final Tone tone;
  final VoidCallback? onTap;
  const StatTile({super.key, required this.label, required this.value, required this.icon, required this.tone, this.suffix, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Ink(
          decoration: cardDecoration(),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: Stack(
              children: [
                Positioned(right: -28, bottom: -34, child: OrganicBlob(color: tone.base.withValues(alpha: 0.45), size: 96, variant: label.length % 3)),
                Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      IconBubble(icon: icon, tone: tone, size: 40),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppTextStyles.bodySm.copyWith(color: AppColors.secondaryText)),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(value, style: AppTextStyles.displayLg.copyWith(fontSize: 28, fontWeight: FontWeight.w800, height: 1.1)),
                              if (suffix != null) ...[
                                const SizedBox(width: 4),
                                Padding(padding: const EdgeInsets.only(bottom: 3), child: Text(suffix!, style: AppTextStyles.subtitle.copyWith(fontWeight: FontWeight.w700))),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ------------------------------------------------------------------ Barra de progresso grossa
class ThickProgressBar extends StatelessWidget {
  final double value; // 0..1
  final Color color;
  final double height;
  const ThickProgressBar({super.key, required this.value, this.color = AppColors.mint, this.height = 12});

  @override
  Widget build(BuildContext context) {
    final v = value.clamp(0.0, 1.0);
    return LayoutBuilder(
      builder: (context, c) => Container(
        height: height,
        decoration: BoxDecoration(color: AppColors.surface2, borderRadius: BorderRadius.circular(height)),
        alignment: Alignment.centerLeft,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 700),
          curve: Curves.easeOutCubic,
          width: math.max(v == 0 ? 0 : height, c.maxWidth * v),
          decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(height)),
          child: Align(
            alignment: Alignment.topCenter,
            child: Container(
              margin: EdgeInsets.fromLTRB(height * 0.5, height * 0.2, height * 0.5, 0),
              height: height * 0.25,
              decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.4), borderRadius: BorderRadius.circular(height)),
            ),
          ),
        ),
      ),
    );
  }
}

// ------------------------------------------------------------------ Anel de progresso
class ProgressRing extends StatelessWidget {
  final double value; // 0..1
  final Color color;
  final double size;
  final double stroke;
  final Widget? child;
  const ProgressRing({super.key, required this.value, this.color = AppColors.mint, this.size = 64, this.stroke = 9, this.child});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: value.clamp(0.0, 1.0)),
            duration: const Duration(milliseconds: 900),
            curve: Curves.easeOutCubic,
            builder: (context, v, _) => CustomPaint(size: Size.square(size), painter: _RingPainter(v, color, stroke)),
          ),
          ?child,
        ],
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  final double v;
  final Color color;
  final double stroke;
  _RingPainter(this.v, this.color, this.stroke);

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset(stroke / 2, stroke / 2) & Size(size.width - stroke, size.height - stroke);
    canvas.drawArc(rect, 0, 2 * math.pi, false, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = color.withValues(alpha: 0.18));
    canvas.drawArc(rect, -math.pi / 2, 2 * math.pi * v, false, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..color = color);
  }

  @override
  bool shouldRepaint(covariant _RingPainter old) => old.v != v || old.color != color;
}

// ------------------------------------------------------------------ Estado vazio
class EmptyCard extends StatelessWidget {
  final String title;
  final String? description;
  final bool celebrate;
  const EmptyCard({super.key, required this.title, this.description, this.celebrate = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: cardDecoration(),
      clipBehavior: Clip.antiAlias,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(left: -60, top: -60, child: OrganicBlob(color: Tone.mint.base.withValues(alpha: 0.3), size: 130)),
          Positioned(right: -50, bottom: -60, child: OrganicBlob(color: Tone.lilac.base.withValues(alpha: 0.3), size: 140, variant: 1)),
          Center(
            child: Column(
              children: [
                celebrate
                    ? Container(
                        width: 64,
                        height: 64,
                        decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                        child: const Icon(Icons.check_rounded, color: Colors.white, size: 36),
                      )
                    : Image.asset('assets/brand/symbol.png', width: 64),
                const SizedBox(height: 12),
                Text(title, textAlign: TextAlign.center, style: AppTextStyles.titleMd),
                if (description != null) ...[
                  const SizedBox(height: 4),
                  Text(description!, textAlign: TextAlign.center, style: AppTextStyles.bodySm.copyWith(color: AppColors.secondaryText)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ------------------------------------------------------------------ Logo
class BrandLogo extends StatelessWidget {
  final double symbolSize;
  final bool tagline;
  const BrandLogo({super.key, this.symbolSize = 40, this.tagline = true});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Image.asset('assets/brand/symbol.png', width: symbolSize),
        const SizedBox(width: 10),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Cuidar+', style: AppTextStyles.displayLg.copyWith(fontSize: symbolSize * 0.7, color: AppColors.primary, fontWeight: FontWeight.w800, height: 1)),
            if (tagline) Text('Inovação que transforma o cuidado.', style: AppTextStyles.bodySm.copyWith(fontSize: 11, color: AppColors.secondaryText)),
          ],
        ),
      ],
    );
  }
}

// ------------------------------------------------------------------ Celebração (check que pula + confete)
Future<void> showCelebration(BuildContext context, String message) async {
  final overlay = Overlay.of(context);
  final entry = OverlayEntry(builder: (_) => _Celebration(message: message));
  overlay.insert(entry);
  await Future<void>.delayed(const Duration(milliseconds: 1700));
  entry.remove();
}

class _Celebration extends StatefulWidget {
  final String message;
  const _Celebration({required this.message});
  @override
  State<_Celebration> createState() => _CelebrationState();
}

class _CelebrationState extends State<_Celebration> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..forward();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const colors = [AppColors.primary, AppColors.mint, AppColors.peach, AppColors.purple, AppColors.yellow];
    return IgnorePointer(
      child: Material(
        color: Colors.transparent,
        child: Center(
          child: AnimatedBuilder(
            animation: _c,
            builder: (context, _) {
              final t = Curves.easeOut.transform(_c.value);
              final pop = Curves.elasticOut.transform((_c.value * 1.6).clamp(0.0, 1.0));
              return Opacity(
                opacity: _c.value > 0.85 ? (1 - (_c.value - 0.85) / 0.15) : 1,
                child: SizedBox(
                  width: 260,
                  height: 260,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      for (var i = 0; i < 18; i++)
                        Transform.translate(
                          offset: Offset(math.cos(i / 18 * 2 * math.pi), math.sin(i / 18 * 2 * math.pi)) * (40 + 60 * t + (i % 3) * 14 * t),
                          child: Container(width: 10, height: 10, decoration: BoxDecoration(color: colors[i % 5], shape: BoxShape.circle)),
                        ),
                      Transform.scale(
                        scale: pop,
                        child: Container(
                          width: 84,
                          height: 84,
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                            boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.35), blurRadius: 24, offset: const Offset(0, 10))],
                          ),
                          child: const Icon(Icons.check_rounded, color: Colors.white, size: 48),
                        ),
                      ),
                      Positioned(
                        bottom: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(999), boxShadow: const [BoxShadow(color: Color(0x1F101828), blurRadius: 30, offset: Offset(0, 12))]),
                          child: Text(widget.message, style: AppTextStyles.subtitle.copyWith(fontWeight: FontWeight.w700)),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
