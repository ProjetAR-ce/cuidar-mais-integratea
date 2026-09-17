-- =====================================================================
-- Cuidar+ Web · Ajustes encontrados nos testes das Fases 2 e 3
-- Rodar depois do 20260916_001. Idempotente.
--
-- 1. Indicadores: período (de/até) no fuso de Crateús, e não em UTC
-- 2. Indicadores: fluxo de encaminhamentos com nome do serviço
-- 3. Atendimento: o primeiro registro é a versão 1; só correções geram versão nova
-- =====================================================================

set search_path = public, extensions;

-- 3. Versão do atendimento
create or replace function cuidar_private.tg_appointment_version() returns trigger
language plpgsql as $$
begin
  if old.summary is not null and (
       new.objective is distinct from old.objective or new.summary is distinct from old.summary
       or new.evolution_notes is distinct from old.evolution_notes) then
    new.version := old.version + 1;
  end if;
  return new;
end $$;

-- corrige registros que ganharam versão 2 no primeiro preenchimento
update public.appointments a
   set version = 1
 where a.version = 2
   and not exists (
     select 1 from public.record_revisions r
      where r.table_name = 'appointments' and r.record_id = a.id and (r.old_data ->> 'summary') is not null
   );

-- 1 e 2. Indicadores
create or replace function public.get_indicators(p_from date, p_to date, p_service uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_from timestamptz := p_from::timestamp at time zone 'America/Fortaleza';
  v_to timestamptz := (p_to + 1)::timestamp at time zone 'America/Fortaleza';
  v jsonb;
begin
  perform public.assert_role('coordenacao','gestao','admin');
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'attendance', (
      select jsonb_build_object(
        'agendados', count(*) filter (where status <> 'cancelado'),
        'presentes', count(*) filter (where status = 'presente'),
        'faltas_justificadas', count(*) filter (where status = 'falta_justificada'),
        'faltas_injustificadas', count(*) filter (where status = 'falta_injustificada'),
        'cancelados', count(*) filter (where status = 'cancelado'),
        'taxa_comparecimento', round(100.0 * count(*) filter (where status = 'presente')
            / nullif(count(*) filter (where status in ('presente', 'falta_justificada', 'falta_injustificada')), 0), 1))
      from appointments
      where scheduled_for >= v_from and scheduled_for < v_to and scheduled_for <= now()
        and (p_service is null or service_id = p_service)),
    'monthly', (
      select coalesce(jsonb_agg(t order by t.month), '[]'::jsonb) from (
        select to_char(date_trunc('month', scheduled_for at time zone 'America/Fortaleza'), 'YYYY-MM') as month,
               count(*) filter (where status = 'presente') as presentes,
               count(*) filter (where status in ('falta_justificada', 'falta_injustificada')) as faltas,
               count(*) filter (where status = 'cancelado') as cancelados
        from appointments
        where scheduled_for >= v_from and scheduled_for < v_to and scheduled_for <= now()
          and (p_service is null or service_id = p_service)
        group by 1) t),
    'waiting_by_service', (
      select coalesce(jsonb_agg(t order by t.waiting desc), '[]'::jsonb) from (
        select s.name as service, s.code, s.color, coalesce(sp.name, q.specialty) as specialty,
               count(*) as waiting,
               round((percentile_cont(0.5) within group (order by extract(epoch from now() - q.entered_at) / 86400))::numeric, 0) as median_wait_days
        from queue_entries q join services s on s.id = q.service_id left join specialties sp on sp.id = q.specialty_id
        where q.status = 'aguardando' and (p_service is null or q.service_id = p_service)
        group by s.name, s.code, s.color, coalesce(sp.name, q.specialty)) t),
    'demand_monthly', (
      select coalesce(jsonb_agg(t order by t.month), '[]'::jsonb) from (
        select to_char(date_trunc('month', entered_at at time zone 'America/Fortaleza'), 'YYYY-MM') as month, count(*) as entradas
        from queue_entries
        where entered_at >= v_from and entered_at < v_to and (p_service is null or service_id = p_service)
        group by 1) t),
    'referrals', (
      select jsonb_build_object(
        'total', count(*),
        'pendentes', count(*) filter (where status::text = 'pendente'),
        'aceitos', count(*) filter (where status::text = 'aceito'),
        'devolvidos', count(*) filter (where status::text = 'devolvido'),
        'complemento', count(*) filter (where status::text = 'complemento_solicitado'),
        'tempo_medio_resposta_horas', round((avg(extract(epoch from responded_at - created_at) / 3600) filter (where responded_at is not null))::numeric, 1),
        'taxa_resposta', round(100.0 * count(*) filter (where status::text in ('aceito', 'devolvido')) / nullif(count(*), 0), 1))
      from referrals
      where created_at >= v_from and created_at < v_to
        and (p_service is null or origin_service_id = p_service or destination_service_id = p_service)),
    'referral_flows', (
      select coalesce(jsonb_agg(t order by t.total desc), '[]'::jsonb) from (
        select so.name as origin, sd.name as destination, so.color as origin_color, sd.color as destination_color, count(*) as total
        from referrals r join services so on so.id = r.origin_service_id join services sd on sd.id = r.destination_service_id
        where r.created_at >= v_from and r.created_at < v_to
          and (p_service is null or r.origin_service_id = p_service or r.destination_service_id = p_service)
        group by so.name, sd.name, so.color, sd.color) t),
    'alerts', (
      select coalesce(jsonb_agg(t order by t.code), '[]'::jsonb) from (
        select code, alert_type, severity,
               count(*) filter (where status = 'pendente') as pendentes,
               count(*) filter (where status = 'revisado') as revisados
        from care_alerts
        where created_at >= v_from and created_at < v_to and (p_service is null or service_id = p_service)
        group by code, alert_type, severity) t),
    'stale_patients', (select count(*) from care_alerts where code = 'AL-05' and status = 'pendente'
                         and (p_service is null or service_id = p_service)),
    'consecutive_absences', (select count(*) from care_alerts where code = 'AL-04' and status = 'pendente'
                         and (p_service is null or service_id = p_service)),
    'duplicates', (select jsonb_build_object(
                      'pendentes', count(*) filter (where status = 'pendente'),
                      'revisadas', count(*) filter (where status <> 'pendente'))
                   from patient_duplicate_candidates),
    'search_before_create', (
      select round(100.0 * count(*) filter (where exists (
               select 1 from audit_logs l where l.user_id = p.created_by and l.action = 'patient.search'
                 and l.created_at between p.created_at - interval '30 minutes' and p.created_at))
             / nullif(count(*), 0), 1)
      from patients p where p.created_by is not null and p.created_at >= v_from and p.created_at < v_to),
    'queue_complete_pct', (
      select round(100.0 * count(*) filter (where priority is not null and entered_at is not null and service_id is not null)
             / nullif(count(*), 0), 1)
      from queue_entries where (p_service is null or service_id = p_service))
  ) into v;

  return v;
end $$;

revoke all on function public.get_indicators(date, date, uuid) from public, anon;
grant execute on function public.get_indicators(date, date, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
