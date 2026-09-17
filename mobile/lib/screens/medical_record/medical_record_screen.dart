import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/data/care_repository.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../models/care_plan.dart';
import '../../models/journey_event.dart';
import '../../models/referral.dart';
import '../../widgets/cuidar_ui.dart';
import '../../widgets/error_state.dart';
import '../../widgets/status_badges.dart';

typedef _RecordData = (List<CarePlan>, List<Referral>, List<JourneyEvent>);

/// Prontuário da família: plano de cuidado, encaminhamentos e linha do tempo.
/// Não mostra conteúdo clínico interno da equipe (LGPD).
class MedicalRecordScreen extends StatefulWidget {
  final String patientId;

  const MedicalRecordScreen({super.key, required this.patientId});

  @override
  State<MedicalRecordScreen> createState() => _MedicalRecordScreenState();
}

class _MedicalRecordScreenState extends State<MedicalRecordScreen> {
  final _repository = CareRepository();
  late Future<_RecordData> _future;
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_RecordData> _load() async {
    final plans = await _repository.fetchCarePlans(widget.patientId);
    final referrals = await _repository.fetchReferrals(widget.patientId);
    final journey = await _repository.fetchJourney(widget.patientId);
    return (plans, referrals, journey);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_RecordData>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator(color: AppColors.primary));
        }
        if (snapshot.hasError) {
          return ErrorState(error: snapshot.error, onRetry: () => setState(() => _future = _load()));
        }
        final (plans, referrals, journey) = snapshot.data!;

        return RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async => setState(() => _future = _load()),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: [
              Text('Prontuário', style: AppTextStyles.displayLg.copyWith(fontSize: 28, fontWeight: FontWeight.w800)),
              const SizedBox(height: 12),
              _Segmented(
                value: _tab,
                labels: const ['Plano', 'Encaminhamentos', 'Linha do tempo'],
                onChanged: (v) => setState(() => _tab = v),
              ),
              const SizedBox(height: 16),
              if (_tab == 0) ..._plans(plans),
              if (_tab == 1) ..._referrals(referrals),
              if (_tab == 2) ..._timeline(journey),
            ],
          ),
        );
      },
    );
  }

  List<Widget> _plans(List<CarePlan> plans) {
    if (plans.isEmpty) return [const EmptyCard(title: 'Sem plano de cuidado', description: 'A equipe registra aqui o objetivo e os próximos passos.')];
    return [
      for (final plan in plans) ...[
        Container(
          decoration: cardDecoration(),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                color: AppColors.peachLight,
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    ProgressRing(
                      value: plan.items.isEmpty ? 0 : plan.items.where((i) => i.isDone).length / plan.items.length,
                      size: 68,
                      stroke: 9,
                      child: Text('${plan.items.where((i) => i.isDone).length}/${plan.items.length}', style: AppTextStyles.subtitle.copyWith(fontWeight: FontWeight.w800)),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('OBJETIVO', style: AppTextStyles.label.copyWith(fontSize: 11, color: Tone.peach.ink, letterSpacing: 0.8)),
                          Text(plan.goal ?? 'Plano de cuidado', style: AppTextStyles.titleMd),
                          const SizedBox(height: 4),
                          ToneBadge(label: plan.status == 'ativo' ? 'Plano ativo' : 'Encerrado', tone: plan.status == 'ativo' ? Tone.mint : Tone.neutral),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              for (final item in plan.items) _PlanItem(item: item),
            ],
          ),
        ),
        const SizedBox(height: 12),
      ],
    ];
  }

  List<Widget> _referrals(List<Referral> referrals) {
    if (referrals.isEmpty) return [const EmptyCard(title: 'Nenhum encaminhamento', description: 'Quando um serviço encaminhar para outro, você acompanha por aqui.')];
    return [
      for (final r in referrals) ...[
        Container(
          decoration: cardDecoration(),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const IconBubble(icon: Icons.send_rounded, tone: Tone.lilac, size: 36),
                  const SizedBox(width: 10),
                  Expanded(child: Text('Solicitado em ${DateFormat('dd/MM/yyyy').format(r.createdAt.toLocal())}', style: AppTextStyles.bodySm.copyWith(color: AppColors.secondaryText))),
                  PriorityBadge(priority: r.priority, short: true),
                ],
              ),
              const SizedBox(height: 10),
              Text(r.reason ?? 'Encaminhamento', style: AppTextStyles.body.copyWith(color: AppColors.primaryText)),
              const SizedBox(height: 10),
              ReferralStatusBadge(status: r.status),
            ],
          ),
        ),
        const SizedBox(height: 12),
      ],
    ];
  }

  List<Widget> _timeline(List<JourneyEvent> events) {
    if (events.isEmpty) return [const EmptyCard(title: 'Sem registros ainda')];
    Tone tone(String? stage) => switch (stage) {
          'entrada' => Tone.rose,
          'triagem' => Tone.peach,
          'fila' => Tone.sun,
          'atendimento' => Tone.mint,
          'continuidade' => Tone.lilac,
          'alerta' => Tone.rose,
          _ => Tone.neutral,
        };
    return [
      Container(
        decoration: cardDecoration(),
        padding: const EdgeInsets.fromLTRB(14, 6, 14, 14),
        child: Column(
          children: [
            for (var i = 0; i < events.length && i < 60; i++)
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SizedBox(
                      width: 20,
                      child: Column(
                        children: [
                          const SizedBox(height: 16),
                          Container(width: 12, height: 12, decoration: BoxDecoration(color: tone(events[i].stage).edge, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2))),
                          if (i < events.length - 1 && i < 59) Expanded(child: Container(width: 2, color: AppColors.line)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Container(
                        margin: const EdgeInsets.only(top: 8),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(color: AppColors.surface2.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(14)),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(events[i].label.toUpperCase(), style: AppTextStyles.label.copyWith(fontSize: 10, color: AppColors.secondaryText, letterSpacing: 0.6)),
                            Text(events[i].description ?? '', style: AppTextStyles.bodySm.copyWith(color: AppColors.primaryText, fontWeight: FontWeight.w600)),
                            Text(DateFormat("dd/MM/yyyy 'às' HH:mm").format(events[i].createdAt.toLocal()), style: AppTextStyles.bodySm.copyWith(fontSize: 11, color: AppColors.secondaryText)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    ];
  }
}

class _PlanItem extends StatelessWidget {
  final CarePlanItem item;
  const _PlanItem({required this.item});

  @override
  Widget build(BuildContext context) {
    final late = !item.isDone && item.dueDate != null && item.dueDate!.isBefore(DateTime.now());
    final inProgress = item.status == 'em_andamento';
    return Container(
      decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.line))),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: item.isDone ? Tone.mint.base : inProgress ? Tone.sun.soft : Colors.white,
              border: Border.all(color: item.isDone ? Tone.mint.edge : inProgress ? Tone.sun.edge : AppColors.lineStrong, width: 2),
            ),
            child: Icon(item.isDone ? Icons.check_rounded : inProgress ? Icons.timelapse_rounded : Icons.radio_button_unchecked_rounded,
                size: 20, color: item.isDone ? AppColors.primaryText : inProgress ? Tone.sun.ink : AppColors.inkFaint),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.description ?? '',
                    style: AppTextStyles.body.copyWith(
                      color: item.isDone ? AppColors.secondaryText : AppColors.primaryText,
                      fontWeight: FontWeight.w600,
                      decoration: item.isDone ? TextDecoration.lineThrough : null,
                    )),
                if (item.dueDate != null)
                  Text('${late ? 'Atrasado · ' : 'Prazo: '}${DateFormat('dd/MM/yyyy').format(item.dueDate!)}',
                      style: AppTextStyles.bodySm.copyWith(fontSize: 12, color: late ? AppColors.rose : AppColors.secondaryText, fontWeight: late ? FontWeight.w700 : FontWeight.w400)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Controle segmentado estilo iOS (igual ao sistema web)
class _Segmented extends StatelessWidget {
  final int value;
  final List<String> labels;
  final ValueChanged<int> onChanged;
  const _Segmented({required this.value, required this.labels, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: AppColors.surface2, borderRadius: BorderRadius.circular(14)),
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++)
            Expanded(
              child: GestureDetector(
                onTap: () => onChanged(i),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  padding: const EdgeInsets.symmetric(vertical: 9),
                  decoration: BoxDecoration(
                    color: i == value ? Colors.white : Colors.transparent,
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: i == value ? const [BoxShadow(color: Color(0x1F101828), blurRadius: 3, offset: Offset(0, 1))] : null,
                  ),
                  alignment: Alignment.center,
                  child: Text(labels[i], maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.label.copyWith(fontSize: 13, color: i == value ? AppColors.primaryText : AppColors.secondaryText, fontWeight: FontWeight.w700)),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
