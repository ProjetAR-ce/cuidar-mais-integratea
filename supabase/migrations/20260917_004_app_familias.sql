-- =====================================================================
-- Cuidar+ / IntegraTEA · Migração 004 · App das famílias (Flutter)
-- Rodar depois da 001, 002 e 003. Idempotente.
--
-- 1. Agenda visível para o responsável no app (v_agenda)
-- 2. Notificações do app, geradas automaticamente pelo sistema web
-- 3. Avisos e notícias publicados para as famílias
-- =====================================================================

set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- 1. Agenda: equipe da rede OU responsável pelo paciente
-- ---------------------------------------------------------------------
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
       (a.summary is not null) as has_session_record
from public.appointments a
join public.patients p on p.id = a.patient_id
join public.services s on s.id = a.service_id
join public.profiles pr on pr.id = a.professional_id
left join public.specialties sp on sp.id = a.specialty_id
where public.is_care_team() or public.is_guardian_of(a.patient_id);

grant select on public.v_agenda to authenticated;

-- ---------------------------------------------------------------------
-- 2. Notificações
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  patient_id uuid references public.patients(id),
  type text not null default 'aviso',
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_profile on public.notifications (profile_id, created_at desc);
alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
drop policy if exists notifications_insert_team on public.notifications;
create policy notifications_insert_team on public.notifications for insert to authenticated
  with check ((select public.is_clinical()));
grant select, insert, update on public.notifications to authenticated;

-- A família só pode marcar como lida; o conteúdo não muda
create or replace function cuidar_private.tg_notification_guard() returns trigger
language plpgsql as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then return new; end if;
  if (to_jsonb(new) - 'is_read' - 'read_at') is distinct from (to_jsonb(old) - 'is_read' - 'read_at') then
    raise exception 'Só é possível marcar a notificação como lida.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_notification_guard on public.notifications;
create trigger trg_notification_guard before update on public.notifications
  for each row execute function cuidar_private.tg_notification_guard();

create or replace function cuidar_private.notify_guardian(p_patient uuid, p_type text, p_title text, p_body text, p_at timestamptz default now())
returns void
language plpgsql security definer set search_path = public as $$
declare v_resp uuid;
begin
  select responsible_id into v_resp from public.patients where id = p_patient;
  if v_resp is null then return; end if;
  insert into public.notifications (profile_id, patient_id, type, title, body, created_at)
  values (v_resp, p_patient, p_type, p_title, p_body, coalesce(p_at, now()));
end $$;

-- Eventos do sistema web que avisam a família (sem conteúdo clínico)
create or replace function cuidar_private.tg_notify_appointments() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_sp text := coalesce(cuidar_private.specialty_name(new.specialty_id), 'atendimento');
begin
  if tg_op = 'INSERT' and new.status = 'agendado' and new.scheduled_for > now() then
    perform cuidar_private.notify_guardian(new.patient_id, 'consulta', 'Consulta agendada 🩺',
      format('%s em %s, %s.', v_sp, cuidar_private.service_name(new.service_id), cuidar_private.fmt_ts(new.scheduled_for)));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status = 'cancelado' and new.scheduled_for > now() then
    perform cuidar_private.notify_guardian(new.patient_id, 'consulta', 'Consulta cancelada',
      format('A consulta de %s de %s foi cancelada. O serviço vai orientar sobre a remarcação.', v_sp, cuidar_private.fmt_ts(new.scheduled_for)));
  end if;
  return null;
end $$;
drop trigger if exists trg_notify on public.appointments;
create trigger trg_notify after insert or update of status on public.appointments
  for each row execute function cuidar_private.tg_notify_appointments();

create or replace function cuidar_private.tg_notify_referrals() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform cuidar_private.notify_guardian(new.patient_id, 'encaminhamento', 'Novo encaminhamento 📋',
      format('Encaminhamento de %s para %s. O serviço de destino vai analisar e dar retorno.',
        cuidar_private.service_name(new.origin_service_id), cuidar_private.service_name(new.destination_service_id)), new.created_at);
  elsif new.status is distinct from old.status and new.status::text = 'aceito' then
    perform cuidar_private.notify_guardian(new.patient_id, 'encaminhamento', 'Encaminhamento aceito ✅',
      format('%s aceitou o encaminhamento. Acompanhe a posição na fila pelo app.', cuidar_private.service_name(new.destination_service_id)));
  elsif new.status is distinct from old.status and new.status::text = 'complemento_solicitado' then
    perform cuidar_private.notify_guardian(new.patient_id, 'documentacao', 'Documentação pendente ⚠️',
      format('%s pediu informações complementares. Procure o serviço de origem.', cuidar_private.service_name(new.destination_service_id)));
  end if;
  return null;
end $$;
drop trigger if exists trg_notify on public.referrals;
create trigger trg_notify after insert or update of status on public.referrals
  for each row execute function cuidar_private.tg_notify_referrals();

create or replace function cuidar_private.tg_notify_queue() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'aguardando' then
    perform cuidar_private.notify_guardian(new.patient_id, 'fila', 'Entrada na fila',
      format('Inclusão na fila de %s. A ordem considera a prioridade definida pela equipe e o tempo de espera.', new.specialty), new.entered_at);
  end if;
  return null;
end $$;
drop trigger if exists trg_notify on public.queue_entries;
create trigger trg_notify after insert on public.queue_entries
  for each row execute function cuidar_private.tg_notify_queue();

-- ---------------------------------------------------------------------
-- 3. Avisos e notícias
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  cover_image_url text,
  body text not null,
  category text not null default 'aviso' check (category in ('aviso', 'noticia', 'evento')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
drop policy if exists posts_select_published on public.posts;
create policy posts_select_published on public.posts for select to authenticated
  using (status = 'published' or (select public.has_role('admin', 'coordenacao')));
drop policy if exists posts_manage on public.posts;
create policy posts_manage on public.posts for all to authenticated
  using ((select public.has_role('admin', 'coordenacao'))) with check ((select public.has_role('admin', 'coordenacao')));
grant select, insert, update on public.posts to authenticated;

insert into public.posts (title, subtitle, body, category, status, published_at)
select * from (values
  ('Projeto Laços de Amor 💙', 'Fortalecendo vínculos entre famílias e profissionais.',
   'Encontros mensais de acolhimento para mães, pais e cuidadores, com troca de experiências e orientação da equipe multiprofissional. [Conteúdo de demonstração.]',
   'evento', 'published', now() - interval '5 days'),
  ('Atividades Sensoriais na Rede IntegraTEA', 'Desenvolvimento e ludicidade no dia a dia.',
   'A Casa Mais Azul oferece oficinas sensoriais em pequenos grupos. Informe-se no serviço de referência da criança. [Conteúdo de demonstração.]',
   'noticia', 'published', now() - interval '12 days'),
  ('Inauguração do Novo Bloco Terapêutico', 'Mais espaço e qualidade para o atendimento.',
   'Novas salas de terapia ocupacional e fonoaudiologia ampliam a capacidade de atendimento da rede. [Conteúdo de demonstração.]',
   'noticia', 'published', now() - interval '20 days'),
  ('Avise quando não puder comparecer', 'Sua vaga pode ajudar outra família.',
   'Se não puder ir a uma consulta, avise o serviço com antecedência. Assim a vaga é remarcada e ninguém perde a vez. [Conteúdo de demonstração.]',
   'aviso', 'published', now() - interval '2 days')
) as seed(title, subtitle, body, category, status, published_at)
where not exists (select 1 from public.posts where title = seed.title);

-- Notificações de demonstração para as famílias já vinculadas no seed
insert into public.notifications (profile_id, patient_id, type, title, body, created_at)
select p.responsible_id, p.id, x.type, x.title, x.body, now() - x.ago
from public.patients p
cross join (values
  ('consulta', 'Consulta Confirmada 🩺', 'A presença na próxima consulta está confirmada. Chegue com 10 minutos de antecedência.', interval '1 day'),
  ('encaminhamento', 'Novo Encaminhamento 📋', 'Um novo encaminhamento foi registrado para a rede. Você será avisado da resposta.', interval '3 days'),
  ('documentacao', 'Documentação Pendente ⚠️', 'Leve o Cartão SUS e o relatório escolar mais recente no próximo atendimento.', interval '6 days')
) as x(type, title, body, ago)
where p.responsible_id is not null
  and not exists (select 1 from public.notifications n where n.patient_id = p.id and n.title = x.title);

notify pgrst, 'reload schema';
