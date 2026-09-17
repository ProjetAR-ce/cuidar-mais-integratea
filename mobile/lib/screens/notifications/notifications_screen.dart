import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/data/care_repository.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../models/notification_item.dart';
import '../../widgets/cuidar_ui.dart';
import '../../widgets/error_state.dart';

/// Central de avisos da família (`public.notifications`), alimentada pelos
/// gatilhos do sistema web: consulta agendada/cancelada, encaminhamento etc.
class NotificationsScreen extends StatefulWidget {
  final String profileId;

  const NotificationsScreen({super.key, required this.profileId});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final _repository = CareRepository();
  List<NotificationItem>? _items;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final items = await _repository.fetchNotifications(widget.profileId);
      if (!mounted) return;
      setState(() {
        _items = items;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _markRead(NotificationItem item) async {
    if (item.isRead) return;
    setState(() => _items = [for (final n in _items!) n.id == item.id ? n.copyWith(isRead: true) : n]);
    try {
      await _repository.markNotificationRead(item.id);
    } catch (_) {
      // Mantém a leitura otimista; na próxima atualização o estado real volta do banco.
    }
  }

  Future<void> _markAll() async {
    final unread = _items!.where((n) => !n.isRead).toList();
    setState(() => _items = [for (final n in _items!) n.copyWith(isRead: true)]);
    await Future.wait(unread.map((n) => _repository.markNotificationRead(n.id).catchError((_) {})));
  }

  (IconData, Tone) _style(String type) => switch (type) {
        'consulta' => (Icons.event_available_rounded, Tone.lilac),
        'encaminhamento' => (Icons.send_rounded, Tone.blue),
        'documentacao' => (Icons.description_rounded, Tone.sun),
        'fila' => (Icons.format_list_numbered_rounded, Tone.peach),
        'plano' => (Icons.flag_rounded, Tone.mint),
        'alerta' => (Icons.warning_amber_rounded, Tone.rose),
        _ => (Icons.notifications_rounded, Tone.lilac),
      };

  @override
  Widget build(BuildContext context) {
    if (_error != null && _items == null) {
      return ErrorState(error: _error, onRetry: () {
        setState(() => _error = null);
        _load();
      });
    }
    if (_items == null) return const Center(child: CircularProgressIndicator(color: AppColors.primary));

    final items = _items!;
    final unread = items.where((n) => !n.isRead).length;

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          Row(
            children: [
              Expanded(child: Text('Avisos', style: AppTextStyles.displayLg.copyWith(fontSize: 28, fontWeight: FontWeight.w800))),
              if (unread > 0) TextButton.icon(onPressed: _markAll, icon: const Icon(Icons.done_all_rounded, size: 18), label: const Text('Marcar todos')),
            ],
          ),
          const SizedBox(height: 2),
          Text(unread == 0 ? 'Tudo em dia por aqui.' : '$unread ${unread == 1 ? 'aviso novo' : 'avisos novos'} para você.',
              style: AppTextStyles.body.copyWith(color: AppColors.secondaryText)),
          const SizedBox(height: 16),
          if (items.isEmpty)
            const EmptyCard(celebrate: true, title: 'Nenhum aviso', description: 'Quando a equipe agendar ou atualizar algo, você fica sabendo aqui.')
          else
            for (final n in items) ...[
              _NotificationTile(item: n, style: _style(n.type), onTap: () => _markRead(n)),
              const SizedBox(height: 10),
            ],
        ],
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  final NotificationItem item;
  final (IconData, Tone) style;
  final VoidCallback onTap;
  const _NotificationTile({required this.item, required this.style, required this.onTap});

  String _when(DateTime at) {
    final diff = DateTime.now().difference(at);
    if (diff.inMinutes < 1) return 'agora';
    if (diff.inMinutes < 60) return 'há ${diff.inMinutes} min';
    if (diff.inHours < 24) return 'há ${diff.inHours} h';
    if (diff.inDays < 7) return 'há ${diff.inDays} ${diff.inDays == 1 ? 'dia' : 'dias'}';
    return DateFormat('dd/MM/yyyy').format(at);
  }

  @override
  Widget build(BuildContext context) {
    final unread = !item.isRead;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          padding: const EdgeInsets.all(14),
          decoration: cardDecoration(color: unread ? AppColors.primarySoft : Colors.white).copyWith(
            border: Border.all(color: unread ? AppColors.primary.withValues(alpha: 0.25) : AppColors.line),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconBubble(icon: style.$1, tone: style.$2, size: 44),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(item.title,
                              style: AppTextStyles.subtitle.copyWith(fontWeight: unread ? FontWeight.w800 : FontWeight.w600)),
                        ),
                        if (unread) Container(width: 9, height: 9, decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle)),
                      ],
                    ),
                    if (item.body != null) ...[
                      const SizedBox(height: 2),
                      Text(item.body!, style: AppTextStyles.bodySm.copyWith(color: AppColors.ink)),
                    ],
                    const SizedBox(height: 6),
                    Text(_when(item.createdAt.toLocal()), style: AppTextStyles.bodySm.copyWith(fontSize: 12, color: AppColors.secondaryText)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
