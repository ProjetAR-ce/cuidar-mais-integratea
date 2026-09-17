import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/data/care_repository.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../models/enums.dart';
import '../../models/queue_entry.dart';
import '../../widgets/cuidar_ui.dart';
import '../../widgets/error_state.dart';
import '../../widgets/status_badges.dart';

/// Fila do dependente (v_queue_ranked) com a mesma transparência do sistema
/// web: posição em destaque, espera em barra e "Por que esta posição?".
class QueueScreen extends StatefulWidget {
  final String patientId;

  const QueueScreen({super.key, required this.patientId});

  @override
  State<QueueScreen> createState() => _QueueScreenState();
}

class _QueueScreenState extends State<QueueScreen> {
  final _repository = CareRepository();
  late Future<List<QueueEntry>> _future;

  @override
  void initState() {
    super.initState();
    _future = _repository.fetchQueueStatus(widget.patientId);
  }

  void _reload() => setState(() => _future = _repository.fetchQueueStatus(widget.patientId));

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<QueueEntry>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator(color: AppColors.primary));
        }
        if (snapshot.hasError) return ErrorState(error: snapshot.error, onRetry: _reload);

        final entries = [...snapshot.data!]..sort((a, b) => a.status.index.compareTo(b.status.index));
        final waiting = entries.where((e) => e.status == QueueStatus.aguardando).toList();
        final maxWait = math.max(30, entries.map((e) => e.waitDays ?? 0).fold<int>(0, math.max));

        return RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async => _reload(),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: [
              Text('Fila de atendimento', style: AppTextStyles.displayLg.copyWith(fontSize: 28, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text('A ordem considera a prioridade definida pela equipe e o tempo de espera. Toda posição tem explicação.',
                  style: AppTextStyles.body.copyWith(color: AppColors.secondaryText)),
              const SizedBox(height: 16),
              if (entries.isEmpty)
                const EmptyCard(celebrate: true, title: 'Nenhuma fila no momento', description: 'Quando houver uma triagem ou encaminhamento aceito, a posição aparece aqui.')
              else ...[
                Row(
                  children: [
                    Expanded(child: _Metric(label: 'Aguardando', value: '${waiting.length}', color: AppColors.yellow)),
                    const SizedBox(width: 12),
                    Expanded(child: _Metric(label: 'Em acompanhamento', value: '${entries.where((e) => e.status == QueueStatus.emAtendimento).length}', color: AppColors.purple)),
                  ],
                ),
                const SizedBox(height: 16),
                for (final e in entries) ...[_QueueCard(entry: e, maxWait: maxWait), const SizedBox(height: 12)],
              ],
            ],
          ),
        );
      },
    );
  }
}

class _Metric extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _Metric({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: cardDecoration(),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(width: 5, margin: const EdgeInsets.symmetric(vertical: 12), decoration: BoxDecoration(color: color, borderRadius: const BorderRadius.horizontal(right: Radius.circular(5)))),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: AppTextStyles.bodySm.copyWith(color: AppColors.secondaryText)),
                  Text(value, style: AppTextStyles.displayLg.copyWith(fontSize: 26, fontWeight: FontWeight.w800)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QueueCard extends StatefulWidget {
  final QueueEntry entry;
  final int maxWait;
  const _QueueCard({required this.entry, required this.maxWait});

  @override
  State<_QueueCard> createState() => _QueueCardState();
}

class _QueueCardState extends State<_QueueCard> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final e = widget.entry;
    final waitingNow = e.status == QueueStatus.aguardando;
    final days = e.waitDays ?? 0;
    final first = e.queuePosition == 1;

    return Container(
      decoration: cardDecoration(),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (waitingNow && e.queuePosition != null)
                Container(
                  width: 56,
                  height: 56,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: first ? Tone.sun.base : AppColors.surface2,
                    borderRadius: BorderRadius.circular(18),
                    border: first ? Border.all(color: Tone.sun.edge) : null,
                  ),
                  child: Text('${e.queuePosition}º', style: AppTextStyles.titleLg.copyWith(fontWeight: FontWeight.w800)),
                )
              else
                IconBubble(icon: e.status == QueueStatus.emAtendimento ? Icons.play_arrow_rounded : Icons.check_rounded, tone: e.status == QueueStatus.emAtendimento ? Tone.lilac : Tone.mint, size: 56),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(e.specialtyName ?? 'Fila de atendimento', style: AppTextStyles.subtitle.copyWith(fontSize: 17, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Wrap(spacing: 6, runSpacing: 4, children: [
                      if (e.serviceName != null) ServiceChip(name: e.serviceName!, color: e.serviceColor),
                      PriorityBadge(priority: e.priority, short: true),
                      QueueStatusBadge(status: e.status),
                    ]),
                  ],
                ),
              ),
            ],
          ),
          if (waitingNow) ...[
            const SizedBox(height: 14),
            Row(
              children: [
                Text('Espera', style: AppTextStyles.label.copyWith(color: AppColors.secondaryText)),
                const Spacer(),
                Text('$days ${days == 1 ? 'dia' : 'dias'}', style: AppTextStyles.label.copyWith(fontWeight: FontWeight.w800)),
              ],
            ),
            const SizedBox(height: 6),
            ThickProgressBar(value: days / widget.maxWait, color: days > 60 ? AppColors.rose : days > 30 ? AppColors.peach : AppColors.mint, height: 10),
          ] else
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text('Na rede desde ${DateFormat('dd/MM/yyyy').format(e.enteredAt.toLocal())}', style: AppTextStyles.bodySm.copyWith(color: AppColors.secondaryText)),
            ),
          if (waitingNow && e.rankReason != null) ...[
            const SizedBox(height: 8),
            InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => setState(() => _open = !_open),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    const Icon(Icons.help_outline_rounded, size: 18, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Text('Por que esta posição?', style: AppTextStyles.label.copyWith(color: AppColors.primary, fontWeight: FontWeight.w700)),
                    const Spacer(),
                    AnimatedRotation(turns: _open ? 0.5 : 0, duration: const Duration(milliseconds: 200), child: const Icon(Icons.expand_more_rounded, color: AppColors.primary)),
                  ],
                ),
              ),
            ),
            AnimatedCrossFade(
              duration: const Duration(milliseconds: 220),
              crossFadeState: _open ? CrossFadeState.showSecond : CrossFadeState.showFirst,
              firstChild: const SizedBox(width: double.infinity),
              secondChild: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(16)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${e.rankReason}.', style: AppTextStyles.bodySm.copyWith(color: AppColors.primaryText, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Text('A prioridade é definida por um profissional da rede, com justificativa registrada. O tempo de espera também soma pontos, para que ninguém fique esquecido.',
                        style: AppTextStyles.bodySm.copyWith(color: AppColors.ink)),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
