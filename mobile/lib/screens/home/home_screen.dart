import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/data/care_repository.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../models/appointment.dart';
import '../../models/journey_event.dart';
import '../../models/notification_item.dart';
import '../../models/patient.dart';
import '../../models/queue_entry.dart';
import '../../models/referral.dart';
import '../../models/enums.dart';
import '../../widgets/cuidar_ui.dart';
import '../../widgets/error_state.dart';
import '../../widgets/status_badges.dart';
import '../appointments/appointments_screen.dart';
import '../appointments/widgets/appointment_card.dart';
import 'widgets/care_journey_stepper.dart';

typedef _HomeData = (List<JourneyEvent>, List<Appointment>, List<QueueEntry>, List<Referral>, List<NotificationItem>);

/// Início: saudação, indicadores, trilha da jornada, próximas consultas e filas
/// — mesmo desenho do painel do sistema web.
class HomeScreen extends StatefulWidget {
  final Patient patient;
  final String profileId;
  final String profileName;
  final void Function(int tab) onNavigate;

  const HomeScreen({super.key, required this.patient, required this.profileId, required this.profileName, required this.onNavigate});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _repository = CareRepository();
  late Future<_HomeData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_HomeData> _load() async {
    final id = widget.patient.id;
    final results = await Future.wait([
      _repository.fetchJourney(id),
      _repository.fetchAppointments(id),
      _repository.fetchQueueStatus(id),
      _repository.fetchReferrals(id),
      _repository.fetchNotifications(widget.profileId),
    ]);
    return (
      results[0] as List<JourneyEvent>,
      results[1] as List<Appointment>,
      results[2] as List<QueueEntry>,
      results[3] as List<Referral>,
      results[4] as List<NotificationItem>,
    );
  }

  Future<void> _confirm(Appointment appointment) async {
    try {
      await _repository.confirmAppointment(appointment.id);
      if (!mounted) return;
      showCelebration(context, 'Presença confirmada!');
      setState(() => _future = _load());
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  String get _firstName => widget.profileName.trim().split(' ').first;

  String _age(DateTime? birth) {
    if (birth == null) return '';
    final now = DateTime.now();
    var years = now.year - birth.year;
    if (now.month < birth.month || (now.month == birth.month && now.day < birth.day)) years--;
    return years >= 2 ? '$years anos' : '${(now.difference(birth).inDays / 30).floor()} meses';
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_HomeData>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator(color: AppColors.primary));
        }
        if (snapshot.hasError) {
          return ErrorState(error: snapshot.error, onRetry: () => setState(() => _future = _load()));
        }

        final (journey, appointments, queue, referrals, notifications) = snapshot.data!;
        final waiting = queue.where((q) => q.status == QueueStatus.aguardando).toList();
        final active = queue.where((q) => q.status == QueueStatus.aguardando || q.status == QueueStatus.emAtendimento).toList();
        final unread = notifications.where((n) => !n.isRead).length;
        final bestPosition = waiting.where((q) => q.queuePosition != null).map((q) => q.queuePosition!).fold<int?>(null, (a, b) => a == null || b < a ? b : a);
        final pendingReferrals = referrals.where((r) => r.status == ReferralStatus.pendente || r.status == ReferralStatus.complementoSolicitado).length;

        return RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async => setState(() => _future = _load()),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: [
              // ---------------------------------------------------- Saudação
              Container(
                decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(24), border: Border.all(color: AppColors.line)),
                clipBehavior: Clip.antiAlias,
                child: Stack(
                  children: [
                    Positioned(top: -40, right: 70, child: OrganicBlob(color: Tone.mint.base.withValues(alpha: 0.35), size: 130, variant: 1)),
                    Positioned(bottom: -50, left: 120, child: OrganicBlob(color: Tone.peach.base.withValues(alpha: 0.25), size: 120)),
                    Positioned(
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: 124,
                      child: Image.asset('assets/brand/hero-family.jpg', fit: BoxFit.cover, alignment: const Alignment(0.35, 0), color: AppColors.primarySoft, colorBlendMode: BlendMode.multiply),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(18, 18, 132, 18),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Responsável', style: AppTextStyles.label.copyWith(color: AppColors.secondaryText)),
                          Text('Olá, $_firstName!', style: AppTextStyles.displayLg.copyWith(fontSize: 30, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 6),
                          Text('Acompanhe a jornada de cuidado de forma simples e segura.', style: AppTextStyles.body.copyWith(color: AppColors.ink)),
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(999)),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.favorite_rounded, size: 14, color: AppColors.primary),
                                const SizedBox(width: 6),
                                Flexible(
                                  child: Text(
                                    '${widget.patient.displayName.split(' ').first} · ${_age(widget.patient.birthDate)}',
                                    overflow: TextOverflow.ellipsis,
                                    style: AppTextStyles.label.copyWith(fontSize: 12.5),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // ---------------------------------------------------- Indicadores
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.15,
                children: [
                  StatTile(label: 'Próximas consultas', value: '${appointments.length}', icon: Icons.event_rounded, tone: Tone.lilac,
                      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => AppointmentsScreen(patientId: widget.patient.id)))),
                  StatTile(label: 'Posição na fila', value: bestPosition != null ? '$bestPositionº' : '—', icon: Icons.format_list_numbered_rounded, tone: Tone.sun, onTap: () => widget.onNavigate(1)),
                  StatTile(label: 'Encaminhamentos', value: '$pendingReferrals', suffix: pendingReferrals == 1 ? 'ativo' : 'ativos', icon: Icons.send_rounded, tone: Tone.peach, onTap: () => widget.onNavigate(2)),
                  StatTile(label: 'Avisos não lidos', value: '$unread', icon: Icons.notifications_rounded, tone: Tone.rose, onTap: () => widget.onNavigate(3)),
                ],
              ),
              const SizedBox(height: 16),

              // ---------------------------------------------------- Jornada
              SectionCard(
                title: 'Jornada do cuidado',
                subtitle: 'Cada etapa fica registrada na rede.',
                icon: Icons.route_rounded,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    CareJourneyStepper(events: journey),
                    if (journey.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      for (final e in journey.take(4)) _EventRow(event: e),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // ---------------------------------------------------- Consultas
              Row(
                children: [
                  const IconBubble(icon: Icons.event_available_rounded, tone: Tone.mint, size: 36),
                  const SizedBox(width: 10),
                  Expanded(child: Text('Próximas consultas', style: AppTextStyles.subtitle.copyWith(fontSize: 17, fontWeight: FontWeight.w700))),
                  TextButton(
                    onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => AppointmentsScreen(patientId: widget.patient.id))),
                    child: const Text('Ver todas'),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (appointments.isEmpty)
                const EmptyCard(title: 'Nenhuma consulta agendada', description: 'Quando o serviço agendar, ela aparece aqui e você recebe um aviso.')
              else
                for (final a in appointments.take(3)) ...[
                  AppointmentCard(appointment: a, onConfirm: () => _confirm(a)),
                  const SizedBox(height: 12),
                ],

              // ---------------------------------------------------- Filas
              if (active.isNotEmpty) ...[
                const SizedBox(height: 8),
                SectionCard(
                  title: 'Filas e acompanhamentos',
                  icon: Icons.format_list_numbered_rounded,
                  tone: Tone.sun,
                  action: TextButton(onPressed: () => widget.onNavigate(1), child: const Text('Detalhes')),
                  child: Column(
                    children: [
                      for (final q in active)
                        Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(color: AppColors.surface2.withValues(alpha: 0.7), borderRadius: BorderRadius.circular(16)),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(q.specialtyName ?? 'Atendimento', style: AppTextStyles.subtitle.copyWith(fontWeight: FontWeight.w700)),
                                    const SizedBox(height: 4),
                                    Wrap(spacing: 6, runSpacing: 4, children: [
                                      if (q.serviceName != null) ServiceChip(name: q.serviceName!, color: q.serviceColor),
                                      QueueStatusBadge(status: q.status),
                                    ]),
                                  ],
                                ),
                              ),
                              if (q.status == QueueStatus.aguardando && q.queuePosition != null)
                                _PositionBubble(position: q.queuePosition!),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _EventRow extends StatelessWidget {
  final JourneyEvent event;
  const _EventRow({required this.event});

  static Tone _tone(String? stage) => switch (stage) {
        'entrada' => Tone.rose,
        'triagem' => Tone.peach,
        'fila' => Tone.sun,
        'atendimento' => Tone.mint,
        'continuidade' => Tone.lilac,
        'alerta' => Tone.rose,
        _ => Tone.neutral,
      };

  @override
  Widget build(BuildContext context) {
    final tone = _tone(event.stage);
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(margin: const EdgeInsets.only(top: 6), width: 10, height: 10, decoration: BoxDecoration(color: tone.edge, shape: BoxShape.circle)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(event.description ?? event.label, style: AppTextStyles.bodySm.copyWith(color: AppColors.primaryText, fontWeight: FontWeight.w600)),
                Text(DateFormat("d 'de' MMM · HH:mm", 'pt_BR').format(event.createdAt.toLocal()), style: AppTextStyles.bodySm.copyWith(fontSize: 11, color: AppColors.secondaryText)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PositionBubble extends StatelessWidget {
  final int position;
  const _PositionBubble({required this.position});

  @override
  Widget build(BuildContext context) {
    final first = position == 1;
    return Container(
      width: 52,
      height: 52,
      decoration: BoxDecoration(color: first ? Tone.sun.base : Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: first ? Tone.sun.edge : AppColors.line)),
      alignment: Alignment.center,
      child: Text('$positionº', style: AppTextStyles.titleMd.copyWith(fontWeight: FontWeight.w800)),
    );
  }
}
