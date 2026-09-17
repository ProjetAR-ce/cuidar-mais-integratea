-- =====================================================================
-- Cuidar+ / IntegraTEA · Migração 005 · Confirmação de presença pela família
-- Rodar depois da 001 a 004. Idempotente.
--
-- O app das famílias (Flutter) permite que o responsável confirme que vai
-- comparecer à consulta. A equipe vê a confirmação na agenda.
-- =====================================================================

set search_path = public, extensions;

alter table public.appointments
  add column if not exists confirmed_by_guardian_at timestamptz;

-- Nova coluna no fim da view (create or replace mantém as anteriores)
create or replace view public.v_agenda as
select a.id, a.patient_id,
       coalesce(p.social_name, p.full_name)::text as patient_name,
       p.birth_date as patient_birth_date,
       p.guardian_name, p.guardian_phone,
       a.service_id, s.name::text as service_name, s.code::text as service_code, s.color as service_color,
       a.professional_id, pr.full_name::text as professional_name,
       a.specialty_id, sp.name::text as specialty_name,
       a.scheduled_for, a.duration_minutes, a.status, a.absence_reason, a.cancel_reason,
       a.rescheduled_from_id, a.queue_entry_id, a.attendance_marked_at, a.created_at,
       (a.summary is not null) as has_session_record,
       a.confirmed_by_guardian_at
from public.appointments a
join public.patients p on p.id = a.patient_id
join public.services s on s.id = a.service_id
join public.profiles pr on pr.id = a.professional_id
left join public.specialties sp on sp.id = a.specialty_id
where public.is_care_team() or public.is_guardian_of(a.patient_id);

grant select on public.v_agenda to authenticated;

create or replace function public.confirm_appointment_attendance(p_appointment_id uuid)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  a public.appointments;
  v_at timestamptz := now();
begin
  select * into a from public.appointments where id = p_appointment_id for update;
  if a.id is null then raise exception 'Consulta não encontrada.'; end if;
  if not public.is_guardian_of(a.patient_id) then
    raise exception 'Somente o responsável pelo paciente pode confirmar a presença.' using errcode = '42501';
  end if;
  if a.status <> 'agendado' then raise exception 'Esta consulta não está mais agendada.'; end if;
  if a.scheduled_for < now() then raise exception 'Não é possível confirmar uma consulta que já passou.'; end if;
  if a.confirmed_by_guardian_at is not null then return a.confirmed_by_guardian_at; end if;

  update public.appointments set confirmed_by_guardian_at = v_at where id = a.id;

  perform cuidar_private.add_event(a.patient_id, a.service_id, 'confirmacao_familia',
    format('Família confirmou presença no atendimento de %s', coalesce(cuidar_private.fmt_ts(a.scheduled_for), '')),
    'atendimento', 'appointments', a.id, auth.uid(), v_at);

  insert into public.audit_logs (user_id, user_role, action, resource, resource_id, details)
  values (auth.uid(), public.app_role()::text, 'appointments.guardian_confirm', 'appointments', a.id,
          jsonb_build_object('patient_id', a.patient_id));
  return v_at;
end $$;

revoke all on function public.confirm_appointment_attendance(uuid) from public, anon;
grant execute on function public.confirm_appointment_attendance(uuid) to authenticated;

notify pgrst, 'reload schema';
