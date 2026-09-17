-- =====================================================================
-- Cuidar+ Web · IntegraTEA Crateús
-- Migração completa v1 · 16/09/2026
--
-- Como rodar: Supabase → SQL Editor → colar tudo → Run.
-- Pode ser executado mais de uma vez (idempotente).
--
-- O que faz:
--   1. Extensões (pg_trgm, unaccent)
--   2. Novas colunas (aditivas) e novas tabelas
--   3. Funções de perfil usadas pelo RLS
--   4. Triggers: normalização, updated_at, bloqueio de exclusão (RN-009),
--      versões, auditoria, linha do tempo automática e alertas (AL-01..AL-06)
--   5. Views (fila priorizada, agenda sem dado clínico)
--   6. RPCs de negócio (cadastro, triagem, agenda, encaminhamento, alertas…)
--   7. Indicadores e capacidade
--   8. Políticas RLS (recria todas as políticas das tabelas do sistema)
--   9. Dados de referência (serviços, especialidades, parâmetros)
--  10. Agendamento opcional com pg_cron
-- =====================================================================

set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- 1. Extensões
-- ---------------------------------------------------------------------
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create schema if not exists cuidar_private;

-- Novo status de encaminhamento (RF-013: destino pode pedir complemento)
alter type public.referral_status add value if not exists 'complemento_solicitado';

-- ---------------------------------------------------------------------
-- 2. Estrutura
-- ---------------------------------------------------------------------

-- Padrões das tabelas existentes
alter table public.services       alter column id set default gen_random_uuid(), alter column created_at set default now();
alter table public.patients       alter column id set default gen_random_uuid(), alter column created_at set default now(), alter column updated_at set default now();
alter table public.triages        alter column id set default gen_random_uuid(), alter column created_at set default now();
alter table public.queue_entries  alter column id set default gen_random_uuid(), alter column entered_at set default now(), alter column updated_at set default now(), alter column status set default 'aguardando';
alter table public.appointments   alter column id set default gen_random_uuid(), alter column created_at set default now(), alter column status set default 'agendado';
alter table public.journey_events alter column id set default gen_random_uuid(), alter column created_at set default now();
alter table public.referrals      alter column id set default gen_random_uuid(), alter column created_at set default now(), alter column updated_at set default now(), alter column status set default 'pendente';
alter table public.care_alerts    alter column id set default gen_random_uuid(), alter column created_at set default now(), alter column status set default 'pendente';
alter table public.audit_logs     alter column id set default gen_random_uuid(), alter column created_at set default now();
alter table public.profiles       alter column created_at set default now();

-- 2.1 Serviços e especialidades (RF-017)
alter table public.services
  add column if not exists description text,
  add column if not exists secretaria text,
  add column if not exists color text,
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();
create unique index if not exists services_code_key on public.services (code);

create table if not exists public.specialties (
  id uuid primary key default gen_random_uuid(),
  name varchar(120) not null unique,
  code varchar(40) not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.service_specialties (
  service_id uuid not null references public.services(id),
  specialty_id uuid not null references public.specialties(id),
  monthly_capacity integer not null default 0 check (monthly_capacity >= 0),
  professionals_count integer not null default 0 check (professionals_count >= 0),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (service_id, specialty_id)
);

-- 2.2 Perfis
alter table public.profiles
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists job_title text,
  add column if not exists specialty_id uuid references public.specialties(id),
  add column if not exists active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

-- 2.3 Pacientes (RF-004)
alter table public.patients
  add column if not exists social_name text,
  add column if not exists sex text check (sex in ('feminino','masculino','intersexo','nao_informado')),
  add column if not exists guardian_name text,
  add column if not exists guardian_phone text,
  add column if not exists guardian_relationship text,
  add column if not exists address text,
  add column if not exists neighborhood text,
  add column if not exists school_name text,
  add column if not exists status text not null default 'ativo' check (status in ('ativo','inativo','mesclado')),
  add column if not exists merged_into_id uuid references public.patients(id),
  add column if not exists created_by uuid references public.profiles(id);

-- 2.4 Possíveis duplicidades (RF-005)
create table if not exists public.patient_duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  candidate_id uuid not null references public.patients(id),
  score numeric(4,2) not null default 0,
  reasons text[] not null default '{}',
  status text not null default 'pendente' check (status in ('pendente','confirmado','rejeitado')),
  kept_patient_id uuid references public.patients(id),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  check (patient_id <> candidate_id)
);
create unique index if not exists patient_duplicate_pair_key
  on public.patient_duplicate_candidates (least(patient_id, candidate_id), greatest(patient_id, candidate_id));

-- 2.5 Triagem (RF-006, RN-006)
alter table public.triages
  add column if not exists specialty_id uuid references public.specialties(id),
  add column if not exists need_description text,
  add column if not exists priority_justification text;

-- 2.6 Encaminhamentos (RF-013)
alter table public.referrals
  add column if not exists specialty_id uuid references public.specialties(id),
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists responded_by uuid references public.profiles(id),
  add column if not exists responded_at timestamptz,
  add column if not exists due_at timestamptz,
  add column if not exists complement_notes text;

-- 2.7 Fila (RF-007, RN-005)
alter table public.queue_entries
  add column if not exists specialty_id uuid references public.specialties(id),
  add column if not exists triage_id uuid references public.triages(id),
  add column if not exists referral_id uuid references public.referrals(id),
  add column if not exists origin text not null default 'triagem' check (origin in ('triagem','encaminhamento','retorno','demanda_espontanea')),
  add column if not exists priority_justification text,
  add column if not exists cancel_reason text,
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz,
  add column if not exists created_by uuid references public.profiles(id);

-- 2.8 Agenda e atendimento (RF-009..011)
alter table public.appointments
  add column if not exists specialty_id uuid references public.specialties(id),
  add column if not exists queue_entry_id uuid references public.queue_entries(id),
  add column if not exists objective text,
  add column if not exists summary text,
  add column if not exists duration_minutes integer not null default 50 check (duration_minutes between 10 and 480),
  add column if not exists rescheduled_from_id uuid references public.appointments(id),
  add column if not exists cancel_reason text,
  add column if not exists attendance_marked_at timestamptz,
  add column if not exists attendance_marked_by uuid references public.profiles(id),
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists version integer not null default 1;

-- 2.9 Plano compartilhado (RF-014)
create table if not exists public.care_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  reference_service_id uuid not null references public.services(id),
  coordinator_id uuid references public.profiles(id),
  goal text not null,
  status text not null default 'ativo' check (status in ('ativo','encerrado')),
  review_due_at date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists care_plans_one_active on public.care_plans (patient_id) where status = 'ativo';

create table if not exists public.care_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.care_plans(id),
  patient_id uuid not null references public.patients(id),
  description text not null,
  service_id uuid references public.services(id),
  responsible_id uuid references public.profiles(id),
  due_date date,
  status text not null default 'pendente' check (status in ('pendente','em_andamento','concluido')),
  completed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.10 Alertas (RF-015)
alter table public.care_alerts alter column patient_id drop not null;  -- AL-06 é por serviço
alter table public.care_alerts
  add column if not exists code varchar(10),
  add column if not exists title text,
  add column if not exists reason text,
  add column if not exists service_id uuid references public.services(id),
  add column if not exists related_table text,
  add column if not exists related_id uuid,
  add column if not exists review_notes text,
  add column if not exists dedupe_key text;
create unique index if not exists care_alerts_dedupe_key on public.care_alerts (dedupe_key);

-- 2.11 Linha do tempo (RF-012)
alter table public.journey_events
  add column if not exists stage text check (stage in ('entrada','triagem','fila','atendimento','continuidade','alerta','nota')),
  add column if not exists source_table text,
  add column if not exists source_id uuid,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- 2.12 Auditoria (RF-019)
alter table public.audit_logs
  add column if not exists resource_id uuid,
  add column if not exists user_role text;

-- 2.13 Parâmetros, versões e formulários
create table if not exists public.system_parameters (
  key text primary key,
  value jsonb,
  label text,
  description text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.record_revisions (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid not null,
  version integer not null,
  changed_fields text[] not null default '{}',
  old_data jsonb not null,
  new_data jsonb not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create table if not exists public.form_definitions (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.services(id),
  name text not null,
  context text not null default 'atendimento' check (context in ('cadastro','triagem','atendimento')),
  fields jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.form_definitions(id),
  patient_id uuid not null references public.patients(id),
  appointment_id uuid references public.appointments(id),
  answers jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 2.14 Índices
create index if not exists idx_profiles_service on public.profiles (service_id);
create index if not exists idx_triages_patient on public.triages (patient_id);
create index if not exists idx_queue_patient on public.queue_entries (patient_id);
create index if not exists idx_queue_service_status on public.queue_entries (service_id, status);
create index if not exists idx_appointments_patient on public.appointments (patient_id, scheduled_for);
create index if not exists idx_appointments_professional on public.appointments (professional_id, scheduled_for);
create index if not exists idx_appointments_scheduled on public.appointments (scheduled_for);
create index if not exists idx_journey_patient on public.journey_events (patient_id, created_at desc);
create index if not exists idx_referrals_patient on public.referrals (patient_id);
create index if not exists idx_referrals_destination on public.referrals (destination_service_id, status);
create index if not exists idx_alerts_status on public.care_alerts (status, severity);
create index if not exists idx_alerts_patient on public.care_alerts (patient_id);
create index if not exists idx_audit_created on public.audit_logs (created_at desc);
create index if not exists idx_audit_user on public.audit_logs (user_id, action, created_at desc);
create index if not exists idx_revisions_record on public.record_revisions (table_name, record_id);
create index if not exists idx_plan_items_plan on public.care_plan_items (plan_id);

-- ---------------------------------------------------------------------
-- 3. Funções utilitárias e de perfil
-- ---------------------------------------------------------------------

-- Normaliza texto para busca (minúsculas, sem acento, espaços simples)
create or replace function public.f_norm(t text) returns text
language sql immutable parallel safe
set search_path = public, extensions
as $$
  select lower(unaccent('unaccent'::regdictionary, btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g'))))
$$;

create index if not exists idx_patients_name_trgm on public.patients using gin (public.f_norm(full_name) gin_trgm_ops);
create index if not exists idx_patients_mother_trgm on public.patients using gin (public.f_norm(mother_name) gin_trgm_ops);
create index if not exists idx_patients_birth on public.patients (birth_date);

create or replace function public.app_role() returns public.user_role
language sql stable security definer set search_path = public
as $$ select p.role from public.profiles p where p.id = auth.uid() and p.active $$;

create or replace function public.app_service_id() returns uuid
language sql stable security definer set search_path = public
as $$ select p.service_id from public.profiles p where p.id = auth.uid() and p.active $$;

create or replace function public.has_role(variadic p_roles public.user_role[]) returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.app_role() = any(p_roles), false) $$;

create or replace function public.is_admin() returns boolean
language sql stable set search_path = public as $$ select public.has_role('admin') $$;
create or replace function public.is_staff() returns boolean
language sql stable set search_path = public as $$ select public.has_role('recepcao','profissional','coordenacao','gestao','admin') $$;
create or replace function public.is_care_team() returns boolean
language sql stable set search_path = public as $$ select public.has_role('recepcao','profissional','coordenacao','admin') $$;
create or replace function public.is_clinical() returns boolean
language sql stable set search_path = public as $$ select public.has_role('profissional','coordenacao','admin') $$;
create or replace function public.is_manager() returns boolean
language sql stable set search_path = public as $$ select public.has_role('coordenacao','gestao','admin') $$;

create or replace function public.is_guardian_of(p_patient uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.patients where id = p_patient and responsible_id = auth.uid()) $$;

create or replace function public.assert_role(variadic p_roles public.user_role[]) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not coalesce(public.app_role() = any(p_roles), false) then
    raise exception 'Seu perfil não tem permissão para esta ação.' using errcode = '42501';
  end if;
end $$;

create or replace function cuidar_private.param_num(p_key text, p_default numeric) returns numeric
language sql stable security definer set search_path = public
as $$ select coalesce((select (value #>> '{}')::numeric from public.system_parameters where key = p_key), p_default) $$;

create or replace function cuidar_private.priority_points(p_priority public.priority_level) returns numeric
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select (value ->> p_priority::text)::numeric from public.system_parameters where key = 'prioridade_pontos'),
    case p_priority when 'P1' then 100 when 'P2' then 50 else 0 end)
$$;

create or replace function cuidar_private.service_name(p_id uuid) returns text
language sql stable security definer set search_path = public
as $$ select name::text from public.services where id = p_id $$;

create or replace function cuidar_private.specialty_name(p_id uuid) returns text
language sql stable security definer set search_path = public
as $$ select name::text from public.specialties where id = p_id $$;

create or replace function cuidar_private.profile_name(p_id uuid) returns text
language sql stable security definer set search_path = public
as $$ select full_name::text from public.profiles where id = p_id $$;

create or replace function cuidar_private.patient_name(p_id uuid) returns text
language sql stable security definer set search_path = public
as $$ select coalesce(social_name, full_name)::text from public.patients where id = p_id $$;

create or replace function cuidar_private.valid_profile(p_id uuid) returns uuid
language sql stable security definer set search_path = public
as $$ select id from public.profiles where id = p_id $$;

create or replace function cuidar_private.fmt_ts(p_ts timestamptz) returns text
language sql stable
as $$ select to_char(p_ts at time zone 'America/Fortaleza', 'DD/MM/YYYY "às" HH24:MI') $$;

create or replace function cuidar_private.fmt_date(p_ts timestamptz) returns text
language sql stable
as $$ select to_char(p_ts at time zone 'America/Fortaleza', 'DD/MM/YYYY') $$;

-- ---------------------------------------------------------------------
-- 4. Triggers
-- ---------------------------------------------------------------------

-- 4.1 updated_at
create or replace function cuidar_private.tg_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['services','service_specialties','profiles','patients','queue_entries','appointments',
                           'referrals','care_plans','care_plan_items','form_definitions']
  loop
    execute format('drop trigger if exists trg_touch on public.%I', t);
    execute format('create trigger trg_touch before update on public.%I for each row execute function cuidar_private.tg_touch()', t);
  end loop;
end $$;

-- 4.2 Normalização do paciente (RN-002)
create or replace function cuidar_private.tg_patient_normalize() returns trigger
language plpgsql as $$
begin
  new.cns := nullif(regexp_replace(coalesce(new.cns, ''), '\D', '', 'g'), '');
  new.cpf := nullif(regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g'), '');
  new.full_name := btrim(regexp_replace(new.full_name, '\s+', ' ', 'g'));
  new.mother_name := btrim(regexp_replace(new.mother_name, '\s+', ' ', 'g'));
  if new.cns is not null and length(new.cns) <> 15 then
    raise exception 'O CNS deve ter 15 dígitos.' using errcode = '22023';
  end if;
  if new.cpf is not null and length(new.cpf) <> 11 then
    raise exception 'O CPF deve ter 11 dígitos.' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists trg_patient_normalize on public.patients;
create trigger trg_patient_normalize before insert or update on public.patients
  for each row execute function cuidar_private.tg_patient_normalize();

-- Índices únicos depois da normalização (RN-002)
create unique index if not exists patients_cns_unique on public.patients (cns) where cns is not null;
create unique index if not exists patients_cpf_unique on public.patients (cpf) where cpf is not null;

-- 4.3 Nada é apagado (RN-009)
create or replace function cuidar_private.tg_block_delete() returns trigger
language plpgsql as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return old;
  end if;
  raise exception 'Registros de % não podem ser apagados. Faça uma correção, que gera uma nova versão.', tg_table_name
    using errcode = '42501';
end $$;

do $$
declare t text;
begin
  foreach t in array array['patients','triages','queue_entries','appointments','journey_events','referrals',
                           'care_alerts','care_plans','care_plan_items','audit_logs','record_revisions',
                           'patient_duplicate_candidates','form_responses']
  loop
    execute format('drop trigger if exists trg_block_delete on public.%I', t);
    execute format('create trigger trg_block_delete before delete on public.%I for each row execute function cuidar_private.tg_block_delete()', t);
  end loop;
end $$;

-- Eventos da jornada só podem mudar de paciente (fusão de cadastro)
create or replace function cuidar_private.tg_journey_immutable() returns trigger
language plpgsql as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then return new; end if;
  if (to_jsonb(new) - 'patient_id') is distinct from (to_jsonb(old) - 'patient_id') then
    raise exception 'Eventos da linha do tempo não podem ser alterados.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_journey_immutable on public.journey_events;
create trigger trg_journey_immutable before update on public.journey_events
  for each row execute function cuidar_private.tg_journey_immutable();

create or replace function cuidar_private.tg_audit_immutable() returns trigger
language plpgsql as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then return new; end if;
  raise exception 'Logs de auditoria não podem ser alterados.' using errcode = '42501';
end $$;
drop trigger if exists trg_audit_immutable on public.audit_logs;
create trigger trg_audit_immutable before update on public.audit_logs
  for each row execute function cuidar_private.tg_audit_immutable();

-- 4.4 Proteção de perfil: só admin muda papel, serviço e ativo
create or replace function cuidar_private.tg_profile_guard() returns trigger
language plpgsql as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') or public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role or new.service_id is distinct from old.service_id
     or new.active is distinct from old.active or new.id is distinct from old.id then
    raise exception 'Somente o administrador pode alterar perfil, serviço ou situação do usuário.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_profile_guard on public.profiles;
create trigger trg_profile_guard before update on public.profiles
  for each row execute function cuidar_private.tg_profile_guard();

-- 4.5 Versões (RN-009)
create or replace function cuidar_private.tg_appointment_version() returns trigger
language plpgsql as $$
begin
  if new.objective is distinct from old.objective or new.summary is distinct from old.summary
     or new.evolution_notes is distinct from old.evolution_notes then
    new.version := old.version + 1;
  end if;
  return new;
end $$;
drop trigger if exists trg_appointment_version on public.appointments;
create trigger trg_appointment_version before update on public.appointments
  for each row execute function cuidar_private.tg_appointment_version();

create or replace function cuidar_private.tg_revision() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
  v_fields text[];
  v_version int;
begin
  select array_agg(n.key order by n.key) into v_fields
  from jsonb_each(v_new) n
  where n.key not in ('updated_at', 'version') and (v_old -> n.key) is distinct from n.value;
  if v_fields is null then return null; end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.record_revisions where table_name = tg_table_name and record_id = old.id;

  insert into public.record_revisions (table_name, record_id, version, changed_fields, old_data, new_data, changed_by)
  values (tg_table_name, old.id, v_version, v_fields, v_old, v_new, auth.uid());
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['patients','triages','queue_entries','appointments','referrals','care_plans','care_plan_items','care_alerts']
  loop
    execute format('drop trigger if exists trg_revision on public.%I', t);
    execute format('create trigger trg_revision after update on public.%I for each row execute function cuidar_private.tg_revision()', t);
  end loop;
end $$;

-- 4.6 Auditoria automática (RF-019)
create or replace function cuidar_private.tg_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_rec jsonb;
  v_changed jsonb;
begin
  if auth.uid() is null then return null; end if;  -- operações do sistema (seed, jobs)
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  v_rec := coalesce(v_new, v_old);

  if tg_op = 'UPDATE' then
    select jsonb_agg(n.key) into v_changed
    from jsonb_each(v_new) n
    where n.key not in ('updated_at', 'version') and (v_old -> n.key) is distinct from n.value;
    if v_changed is null then return null; end if;
  end if;

  insert into public.audit_logs (user_id, user_role, action, resource, resource_id, details)
  values (
    auth.uid(), public.app_role()::text,
    tg_table_name || '.' || lower(tg_op), tg_table_name,
    case when v_rec ? 'id' then (v_rec ->> 'id')::uuid end,
    jsonb_strip_nulls(jsonb_build_object(
      'patient_id', coalesce(v_rec ->> 'patient_id', case when tg_table_name = 'patients' then v_rec ->> 'id' end),
      'campos', v_changed))
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['patients','triages','queue_entries','appointments','referrals','care_alerts','care_plans',
                           'care_plan_items','profiles','services','service_specialties','system_parameters',
                           'patient_duplicate_candidates','form_definitions','form_responses']
  loop
    execute format('drop trigger if exists trg_audit on public.%I', t);
    execute format('create trigger trg_audit after insert or update on public.%I for each row execute function cuidar_private.tg_audit()', t);
  end loop;
end $$;

drop trigger if exists trg_audit on public.journey_events;  -- eventos derivados não poluem a auditoria

-- 4.7 Linha do tempo automática (RF-012)
create or replace function cuidar_private.add_event(
  p_patient uuid, p_service uuid, p_type text, p_description text, p_stage text,
  p_source_table text, p_source_id uuid, p_created_by uuid, p_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_patient is null then return null; end if;
  insert into public.journey_events (patient_id, service_id, event_type, description, stage, source_table, source_id, created_by, created_at, metadata)
  values (p_patient, p_service, p_type, p_description, p_stage, p_source_table, p_source_id,
          cuidar_private.valid_profile(p_created_by), coalesce(p_at, now()), coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;

create or replace function cuidar_private.tg_journey_patients() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform cuidar_private.add_event(new.id, null, 'cadastro', 'Cadastro único criado na rede Cuidar+', 'entrada',
    'patients', new.id, new.created_by, new.created_at);
  return null;
end $$;
drop trigger if exists trg_journey on public.patients;
create trigger trg_journey after insert on public.patients
  for each row execute function cuidar_private.tg_journey_patients();

create or replace function cuidar_private.tg_journey_triages() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform cuidar_private.add_event(new.patient_id, new.service_id, 'triagem',
    format('Triagem realizada · prioridade %s%s', new.priority, coalesce(' · ' || cuidar_private.specialty_name(new.specialty_id), '')),
    'triagem', 'triages', new.id, new.professional_id, new.created_at,
    jsonb_build_object('priority', new.priority));
  return null;
end $$;
drop trigger if exists trg_journey on public.triages;
create trigger trg_journey after insert on public.triages
  for each row execute function cuidar_private.tg_journey_triages();

create or replace function cuidar_private.tg_journey_queue() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_desc text;
begin
  if tg_op = 'INSERT' then
    perform cuidar_private.add_event(new.patient_id, new.service_id, 'fila_entrada',
      format('Entrou na fila de %s (%s)', new.specialty, new.priority),
      'fila', 'queue_entries', new.id, new.created_by, new.entered_at,
      jsonb_build_object('priority', new.priority, 'origin', new.origin));
    if new.status <> 'aguardando' then
      perform cuidar_private.add_event(new.patient_id, new.service_id, 'fila_status',
        format('Iniciou acompanhamento em %s', new.specialty), 'fila', 'queue_entries', new.id,
        new.created_by, coalesce(new.started_at, new.entered_at));
    end if;
    return null;
  end if;

  if new.status is distinct from old.status then
    v_desc := case new.status
      when 'em_atendimento' then format('Saiu da fila e iniciou acompanhamento em %s', new.specialty)
      when 'concluido' then format('Acompanhamento em %s concluído', new.specialty)
      when 'cancelado' then format('Entrada na fila de %s cancelada%s', new.specialty, coalesce(': ' || new.cancel_reason, ''))
      else format('Voltou a aguardar na fila de %s', new.specialty) end;
    perform cuidar_private.add_event(new.patient_id, new.service_id, 'fila_status', v_desc, 'fila',
      'queue_entries', new.id, auth.uid(), now(), jsonb_build_object('status', new.status));
  end if;

  if new.priority is distinct from old.priority then
    perform cuidar_private.add_event(new.patient_id, new.service_id, 'fila_prioridade',
      format('Prioridade na fila de %s alterada de %s para %s', new.specialty, old.priority, new.priority), 'fila',
      'queue_entries', new.id, auth.uid(), now());
  end if;
  return null;
end $$;
drop trigger if exists trg_journey on public.queue_entries;
create trigger trg_journey after insert or update on public.queue_entries
  for each row execute function cuidar_private.tg_journey_queue();

create or replace function cuidar_private.appointment_outcome_event(a public.appointments, p_by uuid, p_at timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_sp text := coalesce(cuidar_private.specialty_name(a.specialty_id), 'atendimento');
begin
  if a.status = 'presente' then
    perform cuidar_private.add_event(a.patient_id, a.service_id, 'atendimento_realizado',
      format('Atendimento de %s realizado com %s', v_sp, coalesce(cuidar_private.profile_name(a.professional_id), 'profissional')),
      'atendimento', 'appointments', a.id, coalesce(p_by, a.professional_id), p_at);
  elsif a.status = 'falta_justificada' then
    perform cuidar_private.add_event(a.patient_id, a.service_id, 'falta',
      format('Falta justificada no atendimento de %s', v_sp), 'atendimento', 'appointments', a.id, p_by, p_at);
  elsif a.status = 'falta_injustificada' then
    perform cuidar_private.add_event(a.patient_id, a.service_id, 'falta',
      format('Falta sem justificativa no atendimento de %s', v_sp), 'atendimento', 'appointments', a.id, p_by, p_at);
  elsif a.status = 'cancelado' then
    perform cuidar_private.add_event(a.patient_id, a.service_id, 'cancelamento',
      format('Atendimento de %s cancelado%s', v_sp, coalesce(': ' || a.cancel_reason, '')),
      'atendimento', 'appointments', a.id, p_by, p_at);
  end if;
end $$;

create or replace function cuidar_private.tg_journey_appointments() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform cuidar_private.add_event(new.patient_id, new.service_id, 'agendamento',
      format('%s agendado para %s', coalesce(cuidar_private.specialty_name(new.specialty_id), 'Atendimento'), cuidar_private.fmt_ts(new.scheduled_for)),
      'atendimento', 'appointments', new.id, new.created_by, least(new.created_at, new.scheduled_for));
    if new.status <> 'agendado' then
      perform cuidar_private.appointment_outcome_event(new, coalesce(new.attendance_marked_by, new.created_by),
        coalesce(new.attendance_marked_at, new.scheduled_for));
    end if;
  elsif new.status is distinct from old.status then
    perform cuidar_private.appointment_outcome_event(new, auth.uid(), now());
  end if;
  return null;
end $$;
drop trigger if exists trg_journey on public.appointments;
create trigger trg_journey after insert or update on public.appointments
  for each row execute function cuidar_private.tg_journey_appointments();

create or replace function cuidar_private.referral_outcome_event(r public.referrals, p_at timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_origin text := cuidar_private.service_name(r.origin_service_id);
  v_dest text := cuidar_private.service_name(r.destination_service_id);
begin
  case r.status::text
    when 'aceito' then
      perform cuidar_private.add_event(r.patient_id, r.destination_service_id, 'encaminhamento_aceito',
        format('%s aceitou o encaminhamento vindo de %s', v_dest, v_origin), 'continuidade', 'referrals', r.id, r.responded_by, p_at);
    when 'devolvido' then
      perform cuidar_private.add_event(r.patient_id, r.destination_service_id, 'encaminhamento_devolvido',
        format('%s devolveu o encaminhamento vindo de %s', v_dest, v_origin), 'continuidade', 'referrals', r.id, r.responded_by, p_at);
    when 'complemento_solicitado' then
      perform cuidar_private.add_event(r.patient_id, r.destination_service_id, 'encaminhamento_complemento',
        format('%s pediu complemento ao encaminhamento de %s', v_dest, v_origin), 'continuidade', 'referrals', r.id, r.responded_by, p_at);
    when 'pendente' then
      perform cuidar_private.add_event(r.patient_id, r.origin_service_id, 'encaminhamento_reenviado',
        format('%s enviou o complemento pedido por %s', v_origin, v_dest), 'continuidade', 'referrals', r.id, auth.uid(), p_at);
  end case;
end $$;

create or replace function cuidar_private.tg_journey_referrals() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform cuidar_private.add_event(new.patient_id, new.origin_service_id, 'encaminhamento',
      format('Encaminhado de %s para %s (%s)%s', cuidar_private.service_name(new.origin_service_id),
        cuidar_private.service_name(new.destination_service_id), new.priority,
        coalesce(' · ' || cuidar_private.specialty_name(new.specialty_id), '')),
      'continuidade', 'referrals', new.id, new.created_by, new.created_at);
    if new.status::text <> 'pendente' then
      perform cuidar_private.referral_outcome_event(new, coalesce(new.responded_at, new.created_at));
    end if;
  elsif new.status is distinct from old.status then
    perform cuidar_private.referral_outcome_event(new, now());
  end if;
  return null;
end $$;
drop trigger if exists trg_journey on public.referrals;
create trigger trg_journey after insert or update on public.referrals
  for each row execute function cuidar_private.tg_journey_referrals();

create or replace function cuidar_private.tg_journey_plans() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'care_plans' then
    if tg_op = 'INSERT' then
      perform cuidar_private.add_event(new.patient_id, new.reference_service_id, 'plano',
        format('Plano de cuidado criado · serviço de referência: %s', cuidar_private.service_name(new.reference_service_id)),
        'continuidade', 'care_plans', new.id, new.created_by, new.created_at);
    elsif new.status is distinct from old.status and new.status = 'encerrado' then
      perform cuidar_private.add_event(new.patient_id, new.reference_service_id, 'plano_encerrado',
        'Plano de cuidado encerrado', 'continuidade', 'care_plans', new.id, auth.uid(), now());
    end if;
  else
    if tg_op = 'INSERT' then
      perform cuidar_private.add_event(new.patient_id, new.service_id, 'plano_passo',
        format('Próximo passo: %s%s', new.description, coalesce(' · até ' || to_char(new.due_date, 'DD/MM/YYYY'), '')),
        'continuidade', 'care_plan_items', new.id, new.created_by, new.created_at);
    elsif new.status is distinct from old.status and new.status = 'concluido' then
      perform cuidar_private.add_event(new.patient_id, new.service_id, 'plano_passo_concluido',
        format('Passo concluído: %s', new.description), 'continuidade', 'care_plan_items', new.id, auth.uid(), now());
    end if;
  end if;
  return null;
end $$;
drop trigger if exists trg_journey on public.care_plans;
create trigger trg_journey after insert or update on public.care_plans
  for each row execute function cuidar_private.tg_journey_plans();
drop trigger if exists trg_journey on public.care_plan_items;
create trigger trg_journey after insert or update on public.care_plan_items
  for each row execute function cuidar_private.tg_journey_plans();

create or replace function cuidar_private.tg_journey_alerts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.patient_id is null then return null; end if;
  if tg_op = 'INSERT' then
    perform cuidar_private.add_event(new.patient_id, new.service_id, 'alerta',
      format('Alerta: %s', coalesce(new.title, new.alert_type)), 'alerta', 'care_alerts', new.id, null, new.created_at,
      jsonb_build_object('severity', new.severity, 'code', new.code));
  elsif new.status is distinct from old.status and new.status = 'revisado' then
    perform cuidar_private.add_event(new.patient_id, new.service_id, 'alerta_revisado',
      format('Alerta revisado: %s', coalesce(new.title, new.alert_type)), 'alerta', 'care_alerts', new.id,
      new.reviewed_by, coalesce(new.reviewed_at, now()));
  end if;
  return null;
end $$;
drop trigger if exists trg_journey on public.care_alerts;
create trigger trg_journey after insert or update on public.care_alerts
  for each row execute function cuidar_private.tg_journey_alerts();

-- 4.8 Alertas (RF-015, AL-01..AL-06)
create or replace function cuidar_private.raise_alert(
  p_code text, p_type text, p_patient uuid, p_service uuid, p_severity public.alert_severity,
  p_title text, p_reason text, p_action text, p_related_table text, p_related_id uuid,
  p_dedupe text, p_at timestamptz default now()
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.care_alerts (code, alert_type, patient_id, service_id, severity, status, title, reason,
                                  action_recommended, related_table, related_id, dedupe_key, created_at)
  values (p_code, p_type, p_patient, p_service, p_severity, 'pendente', p_title, p_reason,
          p_action, p_related_table, p_related_id, p_dedupe, coalesce(p_at, now()))
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  return v_id;
end $$;

-- AL-01 Possível duplicidade (RN-003: alerta, nunca fusão automática)
create or replace function cuidar_private.tg_detect_duplicates() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  r record;
  v_cand uuid;
begin
  if new.status = 'mesclado' then return null; end if;
  for r in
    select p.id, p.full_name, p.created_at,
           similarity(public.f_norm(p.full_name), public.f_norm(new.full_name)) as name_sim,
           similarity(public.f_norm(p.mother_name), public.f_norm(new.mother_name)) as mother_sim,
           (p.birth_date = new.birth_date) as same_birth,
           (p.cpf is not null and p.cpf = new.cpf) as same_cpf
    from public.patients p
    where p.id <> new.id and p.status <> 'mesclado'
      and (p.cpf = new.cpf or p.birth_date = new.birth_date or public.f_norm(p.full_name) % public.f_norm(new.full_name))
  loop
    if r.same_cpf
       or (r.same_birth and r.name_sim >= 0.55)
       or (r.name_sim >= 0.75 and r.mother_sim >= 0.6)
       or (r.same_birth and r.mother_sim >= 0.75 and r.name_sim >= 0.35) then
      v_cand := null;
      insert into public.patient_duplicate_candidates (patient_id, candidate_id, score, reasons, created_at)
      values (r.id, new.id,
        round(greatest(case when r.same_cpf then 1 else 0 end,
                       r.name_sim * 0.5 + r.mother_sim * 0.3 + case when r.same_birth then 0.2 else 0 end)::numeric, 2),
        array_remove(array[
          case when r.same_cpf then 'Mesmo CPF' end,
          case when r.name_sim >= 0.35 then format('Nome %s%% parecido', round((r.name_sim * 100)::numeric)) end,
          case when r.same_birth then 'Mesma data de nascimento' end,
          case when r.mother_sim >= 0.5 then format('Nome da mãe %s%% parecido', round((r.mother_sim * 100)::numeric)) end
        ], null),
        new.created_at)
      on conflict do nothing
      returning id into v_cand;

      if v_cand is not null then
        perform cuidar_private.raise_alert('AL-01', 'duplicidade', new.id, null, 'critico',
          'Possível cadastro duplicado',
          format('O cadastro de %s é muito parecido com o de %s, criado em %s.', new.full_name, r.full_name, cuidar_private.fmt_date(r.created_at)),
          'Comparar os dois cadastros e confirmar se são a mesma pessoa.',
          'patient_duplicate_candidates', v_cand,
          'AL-01:' || least(r.id, new.id)::text || ':' || greatest(r.id, new.id)::text,
          new.created_at);
      end if;
    end if;
  end loop;
  return null;
end $$;
drop trigger if exists trg_detect_duplicates on public.patients;
create trigger trg_detect_duplicates after insert on public.patients
  for each row execute function cuidar_private.tg_detect_duplicates();

-- AL-02 Sobreposição: mesma especialidade ativa em serviços diferentes (RN-011)
create or replace function cuidar_private.tg_detect_overlap() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare r record;
begin
  if new.status not in ('aguardando', 'em_atendimento') then return null; end if;
  for r in
    select q.id, q.service_id
    from public.queue_entries q
    where q.patient_id = new.patient_id and q.id <> new.id and q.service_id <> new.service_id
      and q.status in ('aguardando', 'em_atendimento')
      and (q.specialty_id = new.specialty_id or public.f_norm(q.specialty) = public.f_norm(new.specialty))
  loop
    perform cuidar_private.raise_alert('AL-02', 'sobreposicao', new.patient_id, new.service_id, 'critico',
      'Atendimento semelhante em dois serviços',
      format('%s está ativo em %s nos serviços %s e %s ao mesmo tempo.', cuidar_private.patient_name(new.patient_id),
        new.specialty, cuidar_private.service_name(r.service_id), cuidar_private.service_name(new.service_id)),
      'Definir o serviço de referência ou registrar que os atendimentos são complementares.',
      'queue_entries', new.id,
      format('AL-02:%s:%s:%s:%s', new.patient_id, public.f_norm(new.specialty), least(r.service_id, new.service_id), greatest(r.service_id, new.service_id)),
      least(now(), coalesce(new.updated_at, now())));
  end loop;
  return null;
end $$;
drop trigger if exists trg_detect_overlap on public.queue_entries;
create trigger trg_detect_overlap after insert or update of status on public.queue_entries
  for each row execute function cuidar_private.tg_detect_overlap();

-- AL-04 Faltas consecutivas (RN-010)
create or replace function cuidar_private.tg_detect_absences() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_n int := cuidar_private.param_num('faltas_consecutivas_alerta', 3)::int;
  v_cnt int;
  v_all boolean;
  v_last_presence uuid;
begin
  if new.status not in ('falta_justificada', 'falta_injustificada') then return null; end if;

  select count(*), bool_and(t.status in ('falta_justificada', 'falta_injustificada'))
    into v_cnt, v_all
  from (
    select a.status from public.appointments a
    where a.patient_id = new.patient_id
      and a.status in ('presente', 'falta_justificada', 'falta_injustificada')
      and a.scheduled_for <= new.scheduled_for
    order by a.scheduled_for desc
    limit v_n
  ) t;

  if v_cnt = v_n and v_all then
    select a.id into v_last_presence from public.appointments a
    where a.patient_id = new.patient_id and a.status = 'presente' and a.scheduled_for < new.scheduled_for
    order by a.scheduled_for desc limit 1;

    perform cuidar_private.raise_alert('AL-04', 'faltas_consecutivas', new.patient_id, new.service_id, 'critico',
      format('%s faltas seguidas', v_n),
      format('%s faltou aos últimos %s atendimentos, sem presença registrada entre eles.', cuidar_private.patient_name(new.patient_id), v_n),
      'Fazer busca ativa e conversar com a família sobre possíveis barreiras de acesso.',
      'appointments', new.id,
      'AL-04:' || new.patient_id::text || ':' || coalesce(v_last_presence::text, 'inicio'),
      least(now(), new.scheduled_for + interval '2 hours'));
  end if;
  return null;
end $$;
drop trigger if exists trg_detect_absences on public.appointments;
create trigger trg_detect_absences after insert or update of status on public.appointments
  for each row execute function cuidar_private.tg_detect_absences();

-- AL-03, AL-05, AL-06: verificação periódica
create or replace function public.run_care_alert_checks() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
  v_days int;
  v_id uuid;
  r record;
begin
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'Seu perfil não tem permissão para esta ação.' using errcode = '42501';
  end if;

  -- AL-03 Encaminhamento parado
  v_days := cuidar_private.param_num('encaminhamento_prazo_dias', 7)::int;
  for r in
    select rf.id, rf.patient_id, rf.origin_service_id, rf.destination_service_id, rf.created_at, rf.due_at
    from public.referrals rf
    where rf.status = 'pendente'
      and coalesce(rf.due_at, rf.created_at + make_interval(days => v_days)) < now()
  loop
    v_id := cuidar_private.raise_alert('AL-03', 'encaminhamento_parado', r.patient_id, r.destination_service_id, 'atencao',
      'Encaminhamento sem resposta',
      format('O encaminhamento de %s, de %s para %s, está sem resposta há %s dias.',
        cuidar_private.patient_name(r.patient_id), cuidar_private.service_name(r.origin_service_id),
        cuidar_private.service_name(r.destination_service_id), floor(extract(epoch from now() - r.created_at) / 86400)),
      format('Cobrar resposta de %s ou redirecionar o encaminhamento.', cuidar_private.service_name(r.destination_service_id)),
      'referrals', r.id, 'AL-03:' || r.id::text);
    if v_id is not null then v_count := v_count + 1; end if;
  end loop;

  -- AL-05 Cuidado sem atualização
  v_days := cuidar_private.param_num('cuidado_sem_atualizacao_dias', 30)::int;
  for r in
    select p.id, max(j.created_at) as last_event,
           coalesce((select cp.reference_service_id from public.care_plans cp where cp.patient_id = p.id and cp.status = 'ativo' limit 1),
                    (select q.service_id from public.queue_entries q where q.patient_id = p.id and q.status = 'em_atendimento' limit 1)) as service_id
    from public.patients p
    left join public.journey_events j on j.patient_id = p.id and j.created_at <= now() and j.stage is distinct from 'alerta'
    where p.status = 'ativo'
      and (exists (select 1 from public.queue_entries q where q.patient_id = p.id and q.status = 'em_atendimento')
           or exists (select 1 from public.care_plans cp where cp.patient_id = p.id and cp.status = 'ativo'))
    group by p.id
    having coalesce(max(j.created_at), p.created_at) < now() - make_interval(days => v_days)
  loop
    v_id := cuidar_private.raise_alert('AL-05', 'cuidado_sem_atualizacao', r.id, r.service_id, 'atencao',
      'Cuidado sem atualização',
      format('%s não tem nenhum registro na jornada desde %s (prazo: %s dias).',
        cuidar_private.patient_name(r.id), coalesce(cuidar_private.fmt_date(r.last_event), 'o cadastro'), v_days),
      'Revisar o plano de cuidado e confirmar quem é o responsável pelo próximo passo.',
      'patients', r.id, 'AL-05:' || r.id::text || ':' || to_char(now(), 'YYYY-MM'));
    if v_id is not null then v_count := v_count + 1; end if;
  end loop;

  -- AL-06 Fila acima da capacidade
  for r in
    select ss.service_id, ss.specialty_id, ss.monthly_capacity,
           (select count(*) from public.queue_entries q
             where q.service_id = ss.service_id and q.specialty_id = ss.specialty_id and q.status = 'aguardando') as waiting
    from public.service_specialties ss
    join public.services s on s.id = ss.service_id and s.active
    where ss.active
  loop
    if r.waiting > r.monthly_capacity and r.waiting > 0 then
      v_id := cuidar_private.raise_alert('AL-06', 'fila_acima_capacidade', null, r.service_id, 'atencao',
        'Fila acima da capacidade',
        format('%s em %s tem %s pessoas aguardando para %s vagas por mês.',
          cuidar_private.specialty_name(r.specialty_id), cuidar_private.service_name(r.service_id), r.waiting, r.monthly_capacity),
        'Redistribuir a demanda com outros serviços da rede ou ampliar a agenda.',
        'service_specialties', r.specialty_id,
        format('AL-06:%s:%s:%s', r.service_id, r.specialty_id, to_char(now(), 'YYYY-MM')));
      if v_id is not null then v_count := v_count + 1; end if;
    end if;
  end loop;

  insert into public.system_parameters (key, value, label, description)
  values ('alertas_ultima_execucao', to_jsonb(now()), 'Última verificação de alertas', 'Preenchido automaticamente.')
  on conflict (key) do update set value = excluded.value, updated_at = now();

  return v_count;
end $$;

-- Chamado pelas telas: roda a verificação no máximo a cada 10 minutos
create or replace function public.refresh_care_alerts() returns integer
language plpgsql security definer set search_path = public as $$
declare v_last timestamptz;
begin
  perform public.assert_role('recepcao','profissional','coordenacao','gestao','admin');
  select (value #>> '{}')::timestamptz into v_last from public.system_parameters where key = 'alertas_ultima_execucao';
  if v_last is null or v_last < now() - interval '10 minutes' then
    return public.run_care_alert_checks();
  end if;
  return 0;
end $$;

-- ---------------------------------------------------------------------
-- 5. Views
-- ---------------------------------------------------------------------

-- Fila priorizada e explicável (RF-008, RN-007). Respeita o RLS de quem consulta.
create or replace view public.v_queue_ranked with (security_invoker = true) as
with base as (
  select q.*,
         coalesce(p.social_name, p.full_name)::text as patient_name,
         p.birth_date as patient_birth_date,
         p.cns as patient_cns,
         s.name::text as service_name,
         s.code::text as service_code,
         s.color as service_color,
         coalesce(sp.name::text, q.specialty::text) as specialty_name,
         greatest(0, floor(extract(epoch from (now() - coalesce(q.entered_at, now()))) / 86400))::int as wait_days,
         coalesce((select (x.value ->> q.priority::text)::numeric from public.system_parameters x where x.key = 'prioridade_pontos'),
                  case q.priority when 'P1' then 100 when 'P2' then 50 else 0 end) as priority_points,
         coalesce((select (x.value #>> '{}')::numeric from public.system_parameters x where x.key = 'pontos_por_dia_espera'), 1) as points_per_day
  from public.queue_entries q
  join public.patients p on p.id = q.patient_id
  join public.services s on s.id = q.service_id
  left join public.specialties sp on sp.id = q.specialty_id
)
select b.*,
       (b.priority_points + b.wait_days * b.points_per_day) as score,
       case when b.status = 'aguardando' then
         row_number() over (partition by b.service_id, b.specialty_name, (b.status = 'aguardando')
                            order by (b.priority_points + b.wait_days * b.points_per_day) desc, b.entered_at asc)
       end as queue_position,
       format('Prioridade %s vale %s pontos + %s dias de espera × %s = %s pontos',
              b.priority, b.priority_points, b.wait_days, b.points_per_day,
              b.priority_points + b.wait_days * b.points_per_day) as rank_reason
from base b;

-- Agenda sem conteúdo clínico (recepção pode ver)
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
where public.is_care_team();

-- ---------------------------------------------------------------------
-- 6. RPCs de negócio
-- ---------------------------------------------------------------------

-- 6.1 Busca prévia (RF-003). Registra a busca para cumprir RN-001.
create or replace function public.search_patients(p_query text, p_birth_date date default null, p_limit int default 20)
returns table (
  id uuid, full_name text, social_name text, birth_date date, cns text, cpf text, mother_name text,
  guardian_name text, aps_reference text, status text, score real, match_reason text
)
language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  v_q text := public.f_norm(p_query);
  v_digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
  v_rows int;
begin
  perform public.assert_role('recepcao','profissional','coordenacao','admin');
  if length(v_q) < 2 and p_birth_date is null then
    raise exception 'Digite pelo menos 2 letras, o CNS, o CPF ou a data de nascimento.' using errcode = '22023';
  end if;

  return query
  with m as (
    select p.*,
      case when length(v_digits) >= 11 and (p.cns = v_digits or p.cpf = v_digits) then 1.0::real
           else greatest(
             similarity(public.f_norm(p.full_name), v_q),
             similarity(public.f_norm(coalesce(p.social_name, '')), v_q),
             case when public.f_norm(p.full_name) like '%' || v_q || '%' then 0.9::real else 0 end,
             similarity(public.f_norm(p.mother_name), v_q) * 0.8,
             similarity(public.f_norm(coalesce(p.guardian_name, '')), v_q) * 0.7,
             case when public.f_norm(p.mother_name) like '%' || v_q || '%' then 0.7::real else 0 end
           ) end as s,
      case when length(v_digits) >= 11 and p.cns = v_digits then 'CNS igual'
           when length(v_digits) >= 11 and p.cpf = v_digits then 'CPF igual'
           when public.f_norm(p.full_name) like '%' || v_q || '%' or similarity(public.f_norm(p.full_name), v_q) >= 0.3 then 'Nome parecido'
           when similarity(public.f_norm(p.mother_name), v_q) >= 0.3 or public.f_norm(p.mother_name) like '%' || v_q || '%' then 'Nome da mãe parecido'
           else 'Nome do responsável parecido' end as reason
    from public.patients p
    where p.status <> 'mesclado'
      and (p_birth_date is null or p.birth_date = p_birth_date)
      and (
        length(v_q) < 2
        or (length(v_digits) >= 11 and (p.cns = v_digits or p.cpf = v_digits))
        or public.f_norm(p.full_name) % v_q
        or public.f_norm(p.full_name) like '%' || v_q || '%'
        or public.f_norm(coalesce(p.social_name, '')) % v_q
        or public.f_norm(p.mother_name) % v_q
        or public.f_norm(p.mother_name) like '%' || v_q || '%'
        or public.f_norm(coalesce(p.guardian_name, '')) % v_q
      )
  )
  select m.id, m.full_name::text, m.social_name, m.birth_date, m.cns::text, m.cpf::text, m.mother_name::text,
         m.guardian_name, m.aps_reference::text, m.status, m.s::real, m.reason::text
  from m
  order by m.s desc, m.full_name
  limit greatest(1, least(p_limit, 50));

  get diagnostics v_rows = row_count;
  insert into public.audit_logs (user_id, user_role, action, resource, details)
  values (auth.uid(), public.app_role()::text, 'patient.search', 'patients',
          jsonb_build_object('tipo', case when length(v_digits) >= 11 then 'documento' else 'nome' end,
                             'com_nascimento', p_birth_date is not null, 'resultados', v_rows));
end $$;

-- 6.2 Verificação em tempo real durante o cadastro (RF-005)
create or replace function public.check_patient_duplicates(
  p_full_name text, p_birth_date date, p_mother_name text, p_cns text default null, p_cpf text default null
) returns table (id uuid, full_name text, birth_date date, mother_name text, cns text, score real, reasons text[])
language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  v_cns text := nullif(regexp_replace(coalesce(p_cns, ''), '\D', '', 'g'), '');
  v_cpf text := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
begin
  perform public.assert_role('recepcao','profissional','coordenacao','admin');
  return query
  select x.id, x.full_name, x.birth_date, x.mother_name, x.cns, x.score, x.reasons
  from (
    select p.id, p.full_name::text, p.birth_date, p.mother_name::text, p.cns::text,
      greatest(case when p.cns = v_cns or p.cpf = v_cpf then 1 else 0 end,
               similarity(public.f_norm(p.full_name), public.f_norm(p_full_name)) * 0.5
               + similarity(public.f_norm(p.mother_name), public.f_norm(p_mother_name)) * 0.3
               + case when p.birth_date = p_birth_date then 0.2 else 0 end)::real as score,
      array_remove(array[
        case when p.cns = v_cns then 'CNS igual (não pode duplicar)' end,
        case when p.cpf = v_cpf then 'CPF igual' end,
        case when similarity(public.f_norm(p.full_name), public.f_norm(p_full_name)) >= 0.45 then 'Nome parecido' end,
        case when p.birth_date = p_birth_date then 'Mesma data de nascimento' end,
        case when similarity(public.f_norm(p.mother_name), public.f_norm(p_mother_name)) >= 0.5 then 'Nome da mãe parecido' end
      ], null) as reasons
    from public.patients p
    where p.status <> 'mesclado'
      and ((v_cns is not null and p.cns = v_cns)
        or (v_cpf is not null and p.cpf = v_cpf)
        or (length(public.f_norm(p_full_name)) >= 3 and public.f_norm(p.full_name) % public.f_norm(p_full_name))
        or (p_birth_date is not null and p.birth_date = p_birth_date and length(public.f_norm(p_mother_name)) >= 3
            and public.f_norm(p.mother_name) % public.f_norm(p_mother_name)))
  ) x
  where x.score >= 0.45
  order by x.score desc
  limit 5;
end $$;

-- 6.3 Cadastro único (RF-004, RN-001, RN-002)
create or replace function public.create_patient(p_data jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_cns text := nullif(regexp_replace(coalesce(p_data ->> 'cns', ''), '\D', '', 'g'), '');
  v_cpf text := nullif(regexp_replace(coalesce(p_data ->> 'cpf', ''), '\D', '', 'g'), '');
begin
  perform public.assert_role('recepcao','profissional','coordenacao','admin');

  if not exists (select 1 from public.audit_logs
                 where user_id = auth.uid() and action = 'patient.search' and created_at > now() - interval '30 minutes') then
    raise exception 'Antes de cadastrar, faça uma busca para confirmar que a pessoa ainda não está no sistema.' using errcode = 'P0001';
  end if;
  if v_cns is not null and exists (select 1 from public.patients where cns = v_cns) then
    raise exception 'Já existe um paciente com este CNS. Abra o cadastro existente.' using errcode = '23505';
  end if;
  if v_cpf is not null and exists (select 1 from public.patients where cpf = v_cpf) then
    raise exception 'Já existe um paciente com este CPF. Abra o cadastro existente.' using errcode = '23505';
  end if;
  if coalesce(btrim(p_data ->> 'full_name'), '') = '' or coalesce(btrim(p_data ->> 'mother_name'), '') = ''
     or (p_data ->> 'birth_date') is null then
    raise exception 'Nome, data de nascimento e nome da mãe são obrigatórios.' using errcode = '22023';
  end if;

  insert into public.patients (full_name, social_name, birth_date, mother_name, cns, cpf, sex,
    guardian_name, guardian_phone, guardian_relationship, aps_reference, address, neighborhood, school_name, created_by)
  values (p_data ->> 'full_name', nullif(btrim(p_data ->> 'social_name'), ''), (p_data ->> 'birth_date')::date,
    p_data ->> 'mother_name', v_cns, v_cpf, nullif(p_data ->> 'sex', ''),
    nullif(btrim(p_data ->> 'guardian_name'), ''), nullif(btrim(p_data ->> 'guardian_phone'), ''),
    nullif(btrim(p_data ->> 'guardian_relationship'), ''), nullif(btrim(p_data ->> 'aps_reference'), ''),
    nullif(btrim(p_data ->> 'address'), ''), nullif(btrim(p_data ->> 'neighborhood'), ''),
    nullif(btrim(p_data ->> 'school_name'), ''), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- 6.4 Revisão de duplicidade (RN-004)
create or replace function public.resolve_duplicate(p_candidate uuid, p_decision text, p_keep_patient uuid default null, p_notes text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.patient_duplicate_candidates;
  v_merge uuid;
begin
  perform public.assert_role('coordenacao','admin');
  select * into c from public.patient_duplicate_candidates where id = p_candidate for update;
  if c.id is null then raise exception 'Registro de duplicidade não encontrado.'; end if;
  if c.status <> 'pendente' then raise exception 'Esta duplicidade já foi revisada.'; end if;
  if p_decision not in ('confirmado', 'rejeitado') then raise exception 'Decisão inválida.'; end if;

  if p_decision = 'confirmado' then
    if p_keep_patient not in (c.patient_id, c.candidate_id) then
      raise exception 'Escolha qual dos dois cadastros deve ser mantido.';
    end if;
    v_merge := case when p_keep_patient = c.patient_id then c.candidate_id else c.patient_id end;

    update public.patients set status = 'mesclado', merged_into_id = p_keep_patient where id = v_merge;
    update public.triages set patient_id = p_keep_patient where patient_id = v_merge;
    update public.queue_entries set patient_id = p_keep_patient where patient_id = v_merge;
    update public.appointments set patient_id = p_keep_patient where patient_id = v_merge;
    update public.referrals set patient_id = p_keep_patient where patient_id = v_merge;
    update public.care_plans set patient_id = p_keep_patient where patient_id = v_merge;
    update public.care_plan_items set patient_id = p_keep_patient where patient_id = v_merge;
    update public.form_responses set patient_id = p_keep_patient where patient_id = v_merge;
    update public.care_alerts set patient_id = p_keep_patient where patient_id = v_merge;
    update public.journey_events set patient_id = p_keep_patient where patient_id = v_merge;

    perform cuidar_private.add_event(p_keep_patient, null, 'fusao',
      'Cadastros duplicados unificados após revisão', 'entrada', 'patient_duplicate_candidates', c.id, auth.uid(), now());
    insert into public.audit_logs (user_id, user_role, action, resource, resource_id, details)
    values (auth.uid(), public.app_role()::text, 'patient.merge', 'patients', p_keep_patient,
            jsonb_build_object('patient_id', p_keep_patient, 'mesclado', v_merge));
  end if;

  update public.patient_duplicate_candidates
     set status = p_decision, kept_patient_id = p_keep_patient, reviewed_by = auth.uid(), reviewed_at = now(), review_notes = p_notes
   where id = c.id;

  update public.care_alerts
     set status = 'revisado', reviewed_by = auth.uid(), reviewed_at = now(),
         review_notes = coalesce(p_notes, case when p_decision = 'confirmado' then 'Cadastros unificados' else 'Não são a mesma pessoa' end)
   where related_table = 'patient_duplicate_candidates' and related_id = c.id and status = 'pendente';
end $$;

-- 6.5 Triagem + entrada na fila (RF-006, RN-005, RN-006)
create or replace function public.create_triage(
  p_patient uuid, p_service uuid, p_specialty uuid, p_priority public.priority_level,
  p_need text, p_justification text, p_notes text default null, p_add_to_queue boolean default true
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_triage uuid;
  v_queue uuid;
  v_sp text := cuidar_private.specialty_name(p_specialty);
begin
  perform public.assert_role('profissional','coordenacao','admin');
  if public.app_role() = 'profissional' and p_service is distinct from public.app_service_id() then
    raise exception 'Profissionais só podem triar para o próprio serviço.' using errcode = '42501';
  end if;
  if v_sp is null then raise exception 'Escolha uma especialidade.'; end if;
  if length(coalesce(btrim(p_need), '')) < 5 then raise exception 'Descreva a necessidade.'; end if;
  if length(coalesce(btrim(p_justification), '')) < 10 then
    raise exception 'A prioridade precisa de uma justificativa (mínimo de 10 caracteres).' using errcode = '22023';
  end if;
  if not exists (select 1 from public.patients where id = p_patient and status = 'ativo') then
    raise exception 'Paciente não encontrado ou inativo.';
  end if;

  insert into public.triages (patient_id, service_id, professional_id, priority, clinical_notes, specialty_id, need_description, priority_justification)
  values (p_patient, p_service, auth.uid(), p_priority, coalesce(nullif(btrim(p_notes), ''), p_need), p_specialty, p_need, p_justification)
  returning id into v_triage;

  if p_add_to_queue then
    if exists (select 1 from public.queue_entries where patient_id = p_patient and service_id = p_service
               and specialty_id = p_specialty and status in ('aguardando', 'em_atendimento')) then
      raise exception 'O paciente já está na fila de % neste serviço.', v_sp;
    end if;
    insert into public.queue_entries (patient_id, service_id, specialty, specialty_id, priority, status, origin, triage_id, priority_justification, created_by)
    values (p_patient, p_service, v_sp, p_specialty, p_priority, 'aguardando', 'triagem', v_triage, p_justification, auth.uid())
    returning id into v_queue;
  end if;

  return jsonb_build_object('triage_id', v_triage, 'queue_entry_id', v_queue);
end $$;

-- 6.6 Fila
create or replace function public.update_queue_status(p_entry uuid, p_status public.queue_status, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare q public.queue_entries;
begin
  perform public.assert_role('profissional','coordenacao','admin');
  select * into q from public.queue_entries where id = p_entry for update;
  if q.id is null then raise exception 'Entrada da fila não encontrada.'; end if;
  if public.app_role() = 'profissional' and q.service_id is distinct from public.app_service_id() then
    raise exception 'Você só pode alterar a fila do seu serviço.' using errcode = '42501';
  end if;
  if p_status = 'cancelado' and length(coalesce(btrim(p_reason), '')) < 5 then
    raise exception 'Informe o motivo do cancelamento.';
  end if;
  update public.queue_entries
     set status = p_status,
         cancel_reason = case when p_status = 'cancelado' then p_reason else cancel_reason end,
         started_at = case when p_status = 'em_atendimento' then coalesce(started_at, now()) else started_at end,
         finished_at = case when p_status in ('concluido', 'cancelado') then now() else null end
   where id = p_entry;
end $$;

create or replace function public.update_queue_priority(p_entry uuid, p_priority public.priority_level, p_justification text)
returns void
language plpgsql security definer set search_path = public as $$
declare q public.queue_entries;
begin
  perform public.assert_role('profissional','coordenacao','admin');
  select * into q from public.queue_entries where id = p_entry for update;
  if q.id is null then raise exception 'Entrada da fila não encontrada.'; end if;
  if public.app_role() = 'profissional' and q.service_id is distinct from public.app_service_id() then
    raise exception 'Você só pode alterar a fila do seu serviço.' using errcode = '42501';
  end if;
  if length(coalesce(btrim(p_justification), '')) < 10 then
    raise exception 'A nova prioridade precisa de justificativa (mínimo de 10 caracteres).';
  end if;
  update public.queue_entries set priority = p_priority, priority_justification = p_justification where id = p_entry;
end $$;

-- 6.7 Agenda (RF-009, RF-010)
create or replace function public.schedule_appointment(
  p_patient uuid, p_service uuid, p_professional uuid, p_specialty uuid, p_when timestamptz,
  p_duration int default 50, p_queue_entry uuid default null, p_objective text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.assert_role('recepcao','profissional','coordenacao','admin');
  if not exists (select 1 from public.profiles where id = p_professional and active and role in ('profissional','coordenacao')) then
    raise exception 'Profissional inválido.';
  end if;
  if exists (
    select 1 from public.appointments a
    where a.professional_id = p_professional and a.status = 'agendado'
      and tstzrange(a.scheduled_for, a.scheduled_for + make_interval(mins => a.duration_minutes))
          && tstzrange(p_when, p_when + make_interval(mins => coalesce(p_duration, 50)))
  ) then
    raise exception 'O profissional já tem um atendimento neste horário.' using errcode = '23P01';
  end if;

  insert into public.appointments (patient_id, service_id, professional_id, specialty_id, scheduled_for, duration_minutes,
                                   queue_entry_id, objective, status, created_by)
  values (p_patient, p_service, p_professional, p_specialty, p_when, coalesce(p_duration, 50),
          p_queue_entry, nullif(btrim(p_objective), ''), 'agendado', auth.uid())
  returning id into v_id;

  if p_queue_entry is not null then
    update public.queue_entries set status = 'em_atendimento', started_at = coalesce(started_at, now())
     where id = p_queue_entry and status = 'aguardando';
  end if;
  return v_id;
end $$;

create or replace function public.reschedule_appointment(p_appointment uuid, p_when timestamptz, p_reason text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a public.appointments;
  v_new uuid;
begin
  perform public.assert_role('recepcao','profissional','coordenacao','admin');
  select * into a from public.appointments where id = p_appointment for update;
  if a.id is null then raise exception 'Agendamento não encontrado.'; end if;
  if a.status <> 'agendado' then raise exception 'Só é possível reagendar atendimentos ainda agendados.'; end if;
  if length(coalesce(btrim(p_reason), '')) < 3 then raise exception 'Informe o motivo do reagendamento.'; end if;

  update public.appointments set status = 'cancelado', cancel_reason = 'Reagendado: ' || p_reason where id = a.id;
  v_new := public.schedule_appointment(a.patient_id, a.service_id, a.professional_id, a.specialty_id, p_when,
                                       a.duration_minutes, null, a.objective);
  update public.appointments set rescheduled_from_id = a.id, queue_entry_id = a.queue_entry_id where id = v_new;
  return v_new;
end $$;

create or replace function public.cancel_appointment(p_appointment uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_role('recepcao','profissional','coordenacao','admin');
  if length(coalesce(btrim(p_reason), '')) < 3 then raise exception 'Informe o motivo do cancelamento.'; end if;
  update public.appointments set status = 'cancelado', cancel_reason = p_reason
   where id = p_appointment and status = 'agendado';
  if not found then raise exception 'Só é possível cancelar atendimentos ainda agendados.'; end if;
end $$;

create or replace function public.mark_attendance(p_appointment uuid, p_status public.appointment_status, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare a public.appointments;
begin
  perform public.assert_role('recepcao','profissional','coordenacao','admin');
  if p_status not in ('presente', 'falta_justificada', 'falta_injustificada', 'agendado') then
    raise exception 'Situação inválida.';
  end if;
  if p_status = 'falta_justificada' and length(coalesce(btrim(p_reason), '')) < 3 then
    raise exception 'Informe a justificativa da falta.';
  end if;
  select * into a from public.appointments where id = p_appointment for update;
  if a.id is null then raise exception 'Agendamento não encontrado.'; end if;
  if a.status = 'cancelado' then raise exception 'Este atendimento foi cancelado.'; end if;
  if a.summary is not null and p_status <> 'presente' then
    raise exception 'O atendimento já foi registrado. Não é possível marcar falta.';
  end if;

  update public.appointments
     set status = p_status,
         absence_reason = case when p_status in ('falta_justificada', 'falta_injustificada') then nullif(btrim(p_reason), '') else null end,
         attendance_marked_at = now(), attendance_marked_by = auth.uid()
   where id = a.id;
end $$;

-- 6.8 Registro do atendimento (RF-011). Correções geram nova versão.
create or replace function public.record_session(p_appointment uuid, p_objective text, p_summary text, p_evolution text default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  a public.appointments;
  v_version int;
begin
  perform public.assert_role('profissional','coordenacao','admin');
  select * into a from public.appointments where id = p_appointment for update;
  if a.id is null then raise exception 'Agendamento não encontrado.'; end if;
  if a.status not in ('agendado', 'presente') then
    raise exception 'Só é possível registrar atendimentos agendados ou com presença.';
  end if;
  if public.app_role() = 'profissional' and a.professional_id <> auth.uid() then
    raise exception 'Somente o profissional responsável pode registrar este atendimento.' using errcode = '42501';
  end if;
  if length(coalesce(btrim(p_summary), '')) < 10 then raise exception 'Escreva a síntese do atendimento.'; end if;

  update public.appointments
     set objective = nullif(btrim(p_objective), ''), summary = p_summary, evolution_notes = nullif(btrim(p_evolution), ''),
         status = 'presente',
         attendance_marked_at = coalesce(attendance_marked_at, now()),
         attendance_marked_by = coalesce(attendance_marked_by, auth.uid())
   where id = a.id
  returning version into v_version;
  return v_version;
end $$;

-- 6.9 Encaminhamentos (RF-013, RN-008)
create or replace function public.create_referral(
  p_patient uuid, p_origin uuid, p_destination uuid, p_specialty uuid, p_reason text, p_priority public.priority_level
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.assert_role('profissional','coordenacao','admin');
  if p_origin = p_destination then raise exception 'Origem e destino precisam ser diferentes.'; end if;
  if public.app_role() = 'profissional' and p_origin is distinct from public.app_service_id() then
    raise exception 'Profissionais só podem encaminhar a partir do próprio serviço.' using errcode = '42501';
  end if;
  if length(coalesce(btrim(p_reason), '')) < 10 then raise exception 'Descreva o motivo do encaminhamento.'; end if;
  if exists (select 1 from public.referrals where patient_id = p_patient and destination_service_id = p_destination
             and status in ('pendente') and specialty_id is not distinct from p_specialty) then
    raise exception 'Já existe um encaminhamento pendente deste paciente para este destino.';
  end if;

  insert into public.referrals (patient_id, origin_service_id, destination_service_id, specialty_id, reason, priority, status, created_by, due_at)
  values (p_patient, p_origin, p_destination, p_specialty, p_reason, p_priority, 'pendente', auth.uid(),
          now() + make_interval(days => cuidar_private.param_num('encaminhamento_prazo_dias', 7)::int))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.respond_referral(p_referral uuid, p_action text, p_notes text default null, p_add_to_queue boolean default true)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.referrals;
  v_queue uuid;
  v_sp text;
begin
  perform public.assert_role('profissional','coordenacao','admin');
  if p_action not in ('aceito', 'devolvido', 'complemento_solicitado') then raise exception 'Ação inválida.'; end if;
  select * into r from public.referrals where id = p_referral for update;
  if r.id is null then raise exception 'Encaminhamento não encontrado.'; end if;
  if r.status::text <> 'pendente' then raise exception 'Este encaminhamento não está aguardando resposta.'; end if;
  if public.app_role() = 'profissional' and r.destination_service_id is distinct from public.app_service_id() then
    raise exception 'Somente o serviço de destino pode responder este encaminhamento.' using errcode = '42501';
  end if;
  if p_action <> 'aceito' and length(coalesce(btrim(p_notes), '')) < 5 then
    raise exception 'Explique o motivo da devolução ou o complemento necessário.';
  end if;

  update public.referrals
     set status = p_action::public.referral_status, response_notes = nullif(btrim(p_notes), ''),
         responded_by = auth.uid(), responded_at = now()
   where id = r.id;

  if p_action = 'aceito' and p_add_to_queue and r.specialty_id is not null then
    v_sp := cuidar_private.specialty_name(r.specialty_id);
    select id into v_queue from public.queue_entries
     where patient_id = r.patient_id and service_id = r.destination_service_id and specialty_id = r.specialty_id
       and status in ('aguardando', 'em_atendimento') limit 1;
    if v_queue is null then
      insert into public.queue_entries (patient_id, service_id, specialty, specialty_id, priority, status, origin, referral_id,
                                        priority_justification, created_by)
      values (r.patient_id, r.destination_service_id, v_sp, r.specialty_id, r.priority, 'aguardando', 'encaminhamento', r.id,
              'Prioridade definida no encaminhamento: ' || left(r.reason, 200), auth.uid())
      returning id into v_queue;
    end if;
  end if;

  update public.care_alerts set status = 'revisado', reviewed_by = auth.uid(), reviewed_at = now(),
         review_notes = 'Encaminhamento respondido'
   where related_table = 'referrals' and related_id = r.id and status = 'pendente';

  return jsonb_build_object('queue_entry_id', v_queue);
end $$;

create or replace function public.resubmit_referral(p_referral uuid, p_complement text)
returns void
language plpgsql security definer set search_path = public as $$
declare r public.referrals;
begin
  perform public.assert_role('profissional','coordenacao','admin');
  select * into r from public.referrals where id = p_referral for update;
  if r.id is null then raise exception 'Encaminhamento não encontrado.'; end if;
  if r.status::text <> 'complemento_solicitado' then raise exception 'Este encaminhamento não tem complemento pendente.'; end if;
  if public.app_role() = 'profissional' and r.origin_service_id is distinct from public.app_service_id() then
    raise exception 'Somente o serviço de origem pode enviar o complemento.' using errcode = '42501';
  end if;
  if length(coalesce(btrim(p_complement), '')) < 10 then raise exception 'Escreva o complemento.'; end if;
  update public.referrals
     set status = 'pendente', complement_notes = p_complement,
         due_at = now() + make_interval(days => cuidar_private.param_num('encaminhamento_prazo_dias', 7)::int)
   where id = r.id;
end $$;

-- 6.10 Plano compartilhado (RF-014)
create or replace function public.create_care_plan(p_patient uuid, p_reference_service uuid, p_goal text, p_review_due date default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.assert_role('profissional','coordenacao','admin');
  if exists (select 1 from public.care_plans where patient_id = p_patient and status = 'ativo') then
    raise exception 'O paciente já tem um plano ativo. Adicione passos a ele.';
  end if;
  if length(coalesce(btrim(p_goal), '')) < 5 then raise exception 'Descreva o objetivo do plano.'; end if;
  insert into public.care_plans (patient_id, reference_service_id, coordinator_id, goal, review_due_at, created_by)
  values (p_patient, p_reference_service, auth.uid(), p_goal, p_review_due, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.add_care_plan_item(p_plan uuid, p_description text, p_service uuid, p_responsible uuid, p_due date)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_patient uuid;
begin
  perform public.assert_role('profissional','coordenacao','admin');
  select patient_id into v_patient from public.care_plans where id = p_plan and status = 'ativo';
  if v_patient is null then raise exception 'Plano não encontrado ou encerrado.'; end if;
  if length(coalesce(btrim(p_description), '')) < 5 then raise exception 'Descreva o próximo passo.'; end if;
  insert into public.care_plan_items (plan_id, patient_id, description, service_id, responsible_id, due_date, created_by)
  values (p_plan, v_patient, p_description, p_service, p_responsible, p_due, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.update_care_plan_item(p_item uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_role('profissional','coordenacao','admin');
  if p_status not in ('pendente', 'em_andamento', 'concluido') then raise exception 'Situação inválida.'; end if;
  update public.care_plan_items
     set status = p_status, completed_at = case when p_status = 'concluido' then now() else null end
   where id = p_item;
  if not found then raise exception 'Passo não encontrado.'; end if;
end $$;

create or replace function public.close_care_plan(p_plan uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_role('coordenacao','admin','profissional');
  update public.care_plans set status = 'encerrado' where id = p_plan and status = 'ativo';
  if not found then raise exception 'Plano não encontrado ou já encerrado.'; end if;
end $$;

-- 6.11 Nota manual na jornada
create or replace function public.add_journey_note(p_patient uuid, p_description text)
returns uuid
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_role('profissional','coordenacao','admin');
  if length(coalesce(btrim(p_description), '')) < 5 then raise exception 'Escreva a anotação.'; end if;
  return cuidar_private.add_event(p_patient, public.app_service_id(), 'nota', p_description, 'nota',
                                  null, null, auth.uid(), now());
end $$;

-- 6.12 Revisão de alerta (RF-016)
create or replace function public.review_alert(p_alert uuid, p_notes text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_role('profissional','coordenacao','admin');
  if length(coalesce(btrim(p_notes), '')) < 5 then raise exception 'Registre o que foi feito.'; end if;
  update public.care_alerts
     set status = 'revisado', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = p_notes
   where id = p_alert and status = 'pendente';
  if not found then raise exception 'Alerta não encontrado ou já revisado.'; end if;
end $$;

-- 6.13 Auditoria de leitura sensível e exportação (RF-019, RF-021)
create or replace function public.log_access(p_action text, p_resource text, p_resource_id uuid default null, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_role('recepcao','profissional','coordenacao','gestao','admin');
  if p_action not in ('sensitive.read', 'export', 'login', 'logout', 'access.denied') then
    raise exception 'Ação de auditoria inválida.';
  end if;
  insert into public.audit_logs (user_id, user_role, action, resource, resource_id, details)
  values (auth.uid(), public.app_role()::text, p_action, p_resource, p_resource_id, coalesce(p_details, '{}'::jsonb));
end $$;

-- ---------------------------------------------------------------------
-- 7. Indicadores e capacidade (RF-017, RF-018, RN-012: sempre agregados)
-- ---------------------------------------------------------------------
create or replace function public.get_home_stats()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  perform public.assert_role('recepcao','profissional','coordenacao','gestao','admin');
  select jsonb_build_object(
    'patients_total', (select count(*) from patients where status <> 'mesclado'),
    'patients_new_30d', (select count(*) from patients where status <> 'mesclado' and created_at >= now() - interval '30 days'),
    'patients_new_prev_30d', (select count(*) from patients where status <> 'mesclado' and created_at >= now() - interval '60 days' and created_at < now() - interval '30 days'),
    'in_care_30d', (select count(distinct patient_id) from appointments where status = 'presente' and scheduled_for >= now() - interval '30 days' and scheduled_for <= now()),
    'in_care_prev_30d', (select count(distinct patient_id) from appointments where status = 'presente' and scheduled_for >= now() - interval '60 days' and scheduled_for < now() - interval '30 days'),
    'waiting_total', (select count(*) from queue_entries where status = 'aguardando'),
    'referrals_pending', (select count(*) from referrals where status::text in ('pendente', 'complemento_solicitado')),
    'referrals_30d', (select count(*) from referrals where created_at >= now() - interval '30 days'),
    'referrals_prev_30d', (select count(*) from referrals where created_at >= now() - interval '60 days' and created_at < now() - interval '30 days'),
    'median_wait_days', (select round((percentile_cont(0.5) within group (order by extract(epoch from started_at - entered_at) / 86400))::numeric, 0)
                           from queue_entries where started_at >= now() - interval '30 days'),
    'median_wait_days_prev', (select round((percentile_cont(0.5) within group (order by extract(epoch from started_at - entered_at) / 86400))::numeric, 0)
                           from queue_entries where started_at >= now() - interval '60 days' and started_at < now() - interval '30 days'),
    'current_median_wait_days', (select round((percentile_cont(0.5) within group (order by extract(epoch from now() - entered_at) / 86400))::numeric, 0)
                           from queue_entries where status = 'aguardando'),
    'appointments_today', (select count(*) from appointments where status <> 'cancelado'
                             and (scheduled_for at time zone 'America/Fortaleza')::date = (now() at time zone 'America/Fortaleza')::date),
    'attendance_rate_30d', (select round(100.0 * count(*) filter (where status = 'presente')
                             / nullif(count(*) filter (where status in ('presente', 'falta_justificada', 'falta_injustificada')), 0), 0)
                           from appointments where scheduled_for >= now() - interval '30 days' and scheduled_for <= now()),
    'alerts_pending', (select count(*) from care_alerts where status = 'pendente'),
    'alerts_critical', (select count(*) from care_alerts where status = 'pendente' and severity = 'critico'),
    'alerts_by_code', (select coalesce(jsonb_object_agg(code, n), '{}'::jsonb)
                       from (select code, count(*) n from care_alerts where status = 'pendente' and code is not null group by code) t),
    'duplicates_pending', (select count(*) from patient_duplicate_candidates where status = 'pendente'),
    'alerts_reviewed_today', (select count(*) from care_alerts where status = 'revisado'
                                and (reviewed_at at time zone 'America/Fortaleza')::date = (now() at time zone 'America/Fortaleza')::date),
    'referrals_answered_today', (select count(*) from referrals where responded_at is not null
                                and (responded_at at time zone 'America/Fortaleza')::date = (now() at time zone 'America/Fortaleza')::date),
    'attendance_marked_today', (select count(*) from appointments where status <> 'agendado' and status <> 'cancelado'
                                and (scheduled_for at time zone 'America/Fortaleza')::date = (now() at time zone 'America/Fortaleza')::date)
  ) into v;
  return v;
end $$;

create or replace function public.get_capacity(p_service uuid default null)
returns table (
  service_id uuid, service_name text, service_code text, service_color text,
  specialty_id uuid, specialty_name text, monthly_capacity int, professionals_count int,
  waiting bigint, in_care bigint, demand_30d bigint, scheduled_30d bigint,
  median_wait_days numeric, oldest_wait_days numeric, utilization numeric, situation text
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.assert_role('profissional','coordenacao','gestao','admin');
  return query
  select ss.service_id, s.name::text, s.code::text, s.color, ss.specialty_id, sp.name::text,
         ss.monthly_capacity, ss.professionals_count,
         coalesce(w.waiting, 0), coalesce(w.in_care, 0), coalesce(w.demand, 0), coalesce(ap.scheduled, 0),
         w.median_wait, w.oldest_wait,
         case when ss.monthly_capacity > 0 then round(100.0 * coalesce(ap.scheduled, 0) / ss.monthly_capacity, 0) end,
         case when ss.monthly_capacity = 0 and coalesce(w.waiting, 0) > 0 then 'sem_oferta'
              when coalesce(w.waiting, 0) > ss.monthly_capacity then 'gargalo'
              when ss.monthly_capacity > 0 and (coalesce(ap.scheduled, 0) >= ss.monthly_capacity * 0.85
                                                or coalesce(w.waiting, 0) >= ss.monthly_capacity * 0.7) then 'atencao'
              else 'ok' end
  from service_specialties ss
  join services s on s.id = ss.service_id
  join specialties sp on sp.id = ss.specialty_id
  left join lateral (
    select count(*) filter (where q.status = 'aguardando') as waiting,
           count(*) filter (where q.status = 'em_atendimento') as in_care,
           count(*) filter (where q.entered_at >= now() - interval '30 days') as demand,
           round((percentile_cont(0.5) within group (order by extract(epoch from now() - q.entered_at) / 86400)
                  filter (where q.status = 'aguardando'))::numeric, 0) as median_wait,
           round((max(extract(epoch from now() - q.entered_at) / 86400) filter (where q.status = 'aguardando'))::numeric, 0) as oldest_wait
    from queue_entries q
    where q.service_id = ss.service_id and q.specialty_id = ss.specialty_id
  ) w on true
  left join lateral (
    select count(*) as scheduled
    from appointments a
    where a.service_id = ss.service_id and a.specialty_id = ss.specialty_id and a.status <> 'cancelado'
      and a.scheduled_for >= now() - interval '15 days' and a.scheduled_for < now() + interval '15 days'
  ) ap on true
  where ss.active and s.active and (p_service is null or ss.service_id = p_service)
  order by s.name, sp.name;
end $$;

create or replace function public.get_indicators(p_from date, p_to date, p_service uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_from timestamptz := p_from::timestamptz;
  v_to timestamptz := (p_to + 1)::timestamptz;
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
        select so.code as origin, sd.code as destination, count(*) as total
        from referrals r join services so on so.id = r.origin_service_id join services sd on sd.id = r.destination_service_id
        where r.created_at >= v_from and r.created_at < v_to
          and (p_service is null or r.origin_service_id = p_service or r.destination_service_id = p_service)
        group by so.code, sd.code) t),
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

-- ---------------------------------------------------------------------
-- 8. RLS
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  v_tables text[] := array['services','specialties','service_specialties','profiles','patients','patient_duplicate_candidates',
    'triages','queue_entries','appointments','journey_events','referrals','care_alerts','care_plans','care_plan_items',
    'audit_logs','system_parameters','record_revisions','form_definitions','form_responses'];
  t text;
begin
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public' and tablename = any(v_tables)
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
  foreach t in array v_tables loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Cadastros de referência: todos leem, admin altera
create policy services_select on public.services for select to authenticated using (true);
create policy services_admin on public.services for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy specialties_select on public.specialties for select to authenticated using (true);
create policy specialties_admin on public.specialties for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy service_specialties_select on public.service_specialties for select to authenticated using (true);
create policy service_specialties_admin on public.service_specialties for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy system_parameters_select on public.system_parameters for select to authenticated using (true);
create policy system_parameters_admin on public.system_parameters for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy form_definitions_select on public.form_definitions for select to authenticated using (true);
create policy form_definitions_admin on public.form_definitions for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Perfis
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_insert_admin on public.profiles for insert to authenticated with check ((select public.is_admin()));

-- Pacientes: identificação para a equipe de cuidado; responsável vê os seus (app mobile)
create policy patients_select on public.patients for select to authenticated
  using ((select public.is_care_team()) or responsible_id = (select auth.uid()));
create policy patients_update on public.patients for update to authenticated
  using ((select public.is_care_team())) with check ((select public.is_care_team()));

create policy duplicates_select on public.patient_duplicate_candidates for select to authenticated
  using ((select public.is_care_team()));

-- Conteúdo clínico: profissional, coordenação e admin (+ responsável do paciente)
create policy triages_select on public.triages for select to authenticated
  using ((select public.is_clinical()) or public.is_guardian_of(patient_id));
create policy queue_select on public.queue_entries for select to authenticated
  using ((select public.is_care_team()) or public.is_guardian_of(patient_id));
create policy appointments_select on public.appointments for select to authenticated
  using ((select public.is_clinical()) or public.is_guardian_of(patient_id));
create policy journey_select on public.journey_events for select to authenticated
  using ((select public.is_clinical()) or public.is_guardian_of(patient_id));
create policy referrals_select on public.referrals for select to authenticated
  using ((select public.is_clinical()) or public.is_guardian_of(patient_id));
create policy care_plans_select on public.care_plans for select to authenticated
  using ((select public.is_clinical()) or public.is_guardian_of(patient_id));
create policy care_plan_items_select on public.care_plan_items for select to authenticated
  using ((select public.is_clinical()) or public.is_guardian_of(patient_id));
create policy form_responses_select on public.form_responses for select to authenticated
  using ((select public.is_clinical()));
create policy form_responses_insert on public.form_responses for insert to authenticated
  with check ((select public.is_clinical()) and created_by = (select auth.uid()));
create policy alerts_select on public.care_alerts for select to authenticated
  using ((select public.is_clinical()));

-- Auditoria e versões
create policy audit_select on public.audit_logs for select to authenticated using ((select public.is_admin()));
create policy revisions_select on public.record_revisions for select to authenticated
  using ((select public.has_role('admin', 'coordenacao')));

-- Permissões de objeto
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update on public.services, public.specialties, public.service_specialties, public.profiles, public.patients,
  public.system_parameters, public.form_definitions, public.form_responses to authenticated;
grant usage on schema cuidar_private to authenticated, service_role;
revoke all on all functions in schema cuidar_private from public, anon, authenticated;
grant select on public.v_queue_ranked, public.v_agenda to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'search_patients(text,date,integer)', 'check_patient_duplicates(text,date,text,text,text)', 'create_patient(jsonb)',
    'resolve_duplicate(uuid,text,uuid,text)', 'create_triage(uuid,uuid,uuid,public.priority_level,text,text,text,boolean)',
    'update_queue_status(uuid,public.queue_status,text)', 'update_queue_priority(uuid,public.priority_level,text)',
    'schedule_appointment(uuid,uuid,uuid,uuid,timestamptz,integer,uuid,text)', 'reschedule_appointment(uuid,timestamptz,text)',
    'cancel_appointment(uuid,text)', 'mark_attendance(uuid,public.appointment_status,text)', 'record_session(uuid,text,text,text)',
    'create_referral(uuid,uuid,uuid,uuid,text,public.priority_level)', 'respond_referral(uuid,text,text,boolean)',
    'resubmit_referral(uuid,text)', 'create_care_plan(uuid,uuid,text,date)', 'add_care_plan_item(uuid,text,uuid,uuid,date)',
    'update_care_plan_item(uuid,text)', 'close_care_plan(uuid)', 'add_journey_note(uuid,text)', 'review_alert(uuid,text)',
    'log_access(text,text,uuid,jsonb)', 'get_home_stats()', 'get_capacity(uuid)', 'get_indicators(date,date,uuid)',
    'run_care_alert_checks()', 'refresh_care_alerts()']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 9. Dados de referência
-- ---------------------------------------------------------------------
insert into public.services (name, code, description, secretaria, color, capacity) values
  ('NASF', 'NASF', 'Núcleo Ampliado de Saúde da Família', 'Saúde', 'mint', 180),
  ('NAPE', 'NAPE', 'Núcleo de Apoio Pedagógico Especializado', 'Educação', 'lilac', 140),
  ('CREAES', 'CREAES', 'Centro de referência especializado', 'Saúde', 'peach', 160),
  ('Casa Mais Azul', 'CASA_MAIS_AZUL', 'Espaço de acolhimento e convivência', 'Assistência Social', 'sun', 120),
  ('CRASF', 'CRASF', 'Centro de referência da assistência às famílias', 'Assistência Social', 'rose', 100)
on conflict (code) do update set description = coalesce(public.services.description, excluded.description),
  secretaria = coalesce(public.services.secretaria, excluded.secretaria), color = coalesce(public.services.color, excluded.color);

insert into public.specialties (name, code) values
  ('Fonoaudiologia', 'FONO'), ('Terapia Ocupacional', 'TO'), ('Psicologia', 'PSICO'), ('Neuropediatria', 'NEUROPED'),
  ('Psiquiatria infantojuvenil', 'PSIQ'), ('Psicopedagogia', 'PSICOPED'), ('Fisioterapia', 'FISIO'), ('Nutrição', 'NUTRI'),
  ('Serviço Social', 'SERV_SOCIAL'), ('Atendimento Educacional Especializado', 'AEE'), ('Musicoterapia', 'MUSICO'),
  ('Educação Física adaptada', 'EDFIS')
on conflict (code) do nothing;

insert into public.service_specialties (service_id, specialty_id, monthly_capacity, professionals_count)
select s.id, sp.id, x.cap, x.prof
from (values
  ('NASF', 'FONO', 40, 2), ('NASF', 'PSICO', 48, 2), ('NASF', 'FISIO', 32, 1), ('NASF', 'NUTRI', 24, 1), ('NASF', 'SERV_SOCIAL', 20, 1),
  ('NAPE', 'PSICOPED', 40, 2), ('NAPE', 'AEE', 60, 3), ('NAPE', 'FONO', 16, 1),
  ('CREAES', 'NEUROPED', 20, 1), ('CREAES', 'PSIQ', 16, 1), ('CREAES', 'TO', 36, 2), ('CREAES', 'FONO', 24, 1), ('CREAES', 'PSICO', 24, 1),
  ('CASA_MAIS_AZUL', 'MUSICO', 30, 1), ('CASA_MAIS_AZUL', 'EDFIS', 40, 1), ('CASA_MAIS_AZUL', 'TO', 20, 1),
  ('CRASF', 'SERV_SOCIAL', 40, 2), ('CRASF', 'PSICO', 20, 1)
) as x(service_code, specialty_code, cap, prof)
join public.services s on s.code = x.service_code
join public.specialties sp on sp.code = x.specialty_code
on conflict (service_id, specialty_id) do nothing;

insert into public.system_parameters (key, value, label, description) values
  ('prioridade_pontos', '{"P1": 100, "P2": 50, "P3": 0}', 'Pontos por prioridade',
   'Quantos pontos cada prioridade soma na ordenação da fila (RN-007). Aguardando decisão D-03.'),
  ('pontos_por_dia_espera', '1', 'Pontos por dia de espera',
   'Quantos pontos cada dia de espera soma. Com 1 ponto, um P2 passa um P1 recém-chegado depois de 50 dias.'),
  ('criterios_prioridade', '{"P1": "Risco à integridade, regressão importante ou crise frequente; primeira infância sem nenhum acompanhamento.", "P2": "Prejuízo funcional relevante na comunicação, na escola ou na rotina familiar.", "P3": "Acompanhamento de manutenção ou demanda sem prejuízo funcional imediato."}',
   'Critérios de prioridade', 'Texto de apoio exibido na triagem. Provisório até a Prefeitura validar (D-03).'),
  ('encaminhamento_prazo_dias', '7', 'Prazo de resposta do encaminhamento (dias)', 'Depois deste prazo gera o alerta AL-03 (D-04).'),
  ('cuidado_sem_atualizacao_dias', '30', 'Prazo sem atualização (dias)', 'Pacientes em acompanhamento sem registro por este prazo geram o alerta AL-05.'),
  ('faltas_consecutivas_alerta', '3', 'Faltas seguidas para alerta', 'Quantidade de faltas consecutivas que gera o alerta AL-04 (RN-010).')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 10. pg_cron (opcional). Se a extensão não estiver disponível, as telas
--     chamam refresh_care_alerts() e o sistema segue funcionando.
-- ---------------------------------------------------------------------
do $$
begin
  begin
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'cuidar_alertas';
    perform cron.schedule('cuidar_alertas', '*/30 * * * *', 'select public.run_care_alert_checks()');
    raise notice 'pg_cron configurado: alertas a cada 30 minutos.';
  exception when others then
    raise notice 'pg_cron indisponível (%). Os alertas serão atualizados pelas telas.', sqlerrm;
  end;
end $$;

notify pgrst, 'reload schema';
