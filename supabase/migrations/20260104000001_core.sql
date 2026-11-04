-- ============================================================================
-- Vambora — Migração 0001: núcleo do esquema
-- ----------------------------------------------------------------------------
-- Cria extensões, tipos (enums), tabelas do núcleo, índices, constraints e
-- gatilhos. Segurança (RLS) e storage vêm nas migrações seguintes.
-- Idempotente o suficiente para rodar em projeto novo. NÃO destrói dados.
-- ============================================================================

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Tipos (enums)
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('familia', 'motorista', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.destination_type as enum ('escola', 'faculdade', 'curso_livre');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.turno as enum ('manha', 'tarde', 'noite', 'integral');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.price_type as enum ('fixo', 'dinamico', 'a_combinar');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- updated_at automático
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Perfis e papéis (vinculados a auth.users do Supabase)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.user_roles (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      public.user_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
create index if not exists idx_user_roles_user on public.user_roles(user_id);

-- Cria o perfil automaticamente quando um usuário se cadastra no Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Catálogo geográfico e de destinos
-- ----------------------------------------------------------------------------
create table if not exists public.cities (
  id          text primary key,            -- ex.: 'aracatuba-sp'
  name        text not null,
  uf          char(2) not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.destinations (
  id            text primary key,          -- ex.: 'esc-paineiras'
  type          public.destination_type not null,
  name          text not null,
  neighborhood  text,
  city_id       text not null references public.cities(id) on delete restrict,
  inep_code     text,                      -- só preenchido com código REAL
  turnos        public.turno[] not null default '{}',
  source        text not null default 'demonstração',  -- INEP, manual, demo...
  lat           double precision,
  lng           double precision,
  is_demo       boolean not null default false,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists idx_destinations_city on public.destinations(city_id);
create index if not exists idx_destinations_published on public.destinations(is_published);

-- ----------------------------------------------------------------------------
-- Motoristas (perfil + veículo no núcleo; normalização evolui depois)
-- ----------------------------------------------------------------------------
create table if not exists public.drivers (
  id                  uuid primary key default gen_random_uuid(),
  slug                text unique not null,
  owner_id            uuid references public.profiles(id) on delete set null,
  name                text not null,
  photo_url           text,
  van_photo_url       text,
  description         text,
  city_id             text not null references public.cities(id) on delete restrict,
  neighborhoods       text[] not null default '{}',
  turnos              public.turno[] not null default '{}',
  capacity_total      int  not null default 0 check (capacity_total >= 0),
  seats_available     int  not null default 0 check (seats_available >= 0),
  feature_ac          boolean not null default false,
  feature_monitor     boolean not null default false,
  feature_seatbelt    boolean not null default false,
  feature_accessible  boolean not null default false,
  price_type          public.price_type not null default 'a_combinar',
  price_month         numeric(10,2),
  price_daily         numeric(10,2),
  rating_avg          numeric(2,1) not null default 0 check (rating_avg between 0 and 5),
  rating_count        int not null default 0 check (rating_count >= 0),
  boarding_time       text,                 -- "HH:MM"
  tolerance_before_min int not null default 3,
  tolerance_after_min  int not null default 7,
  whatsapp            text,                 -- SENSÍVEL: nunca na view pública
  doc_verified        boolean not null default false,  -- só true com verificação real
  is_demo             boolean not null default false,
  is_published        boolean not null default true,
  is_suspended        boolean not null default false,  -- admin pode suspender exibição
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (seats_available <= capacity_total)
);
create index if not exists idx_drivers_city on public.drivers(city_id);
create index if not exists idx_drivers_owner on public.drivers(owner_id);
create index if not exists idx_drivers_visivel on public.drivers(is_published, is_suspended);

drop trigger if exists trg_drivers_updated on public.drivers;
create trigger trg_drivers_updated
  before update on public.drivers
  for each row execute function public.set_updated_at();

-- Relação motorista <-> destinos (N:N)
create table if not exists public.driver_destinations (
  driver_id       uuid not null references public.drivers(id) on delete cascade,
  destination_id  text not null references public.destinations(id) on delete cascade,
  primary key (driver_id, destination_id)
);
create index if not exists idx_driver_dest_dest on public.driver_destinations(destination_id);

-- ----------------------------------------------------------------------------
-- Revisão documental (auditável) — sem selo sem evidência
-- ----------------------------------------------------------------------------
create table if not exists public.verification_reviews (
  id             uuid primary key default gen_random_uuid(),
  driver_id      uuid not null references public.drivers(id) on delete cascade,
  reviewer_id    uuid references public.profiles(id) on delete set null,
  reviewed_at    timestamptz not null default now(),
  scope          text,                -- o que foi verificado
  validity_until date,                -- validade da verificação
  result         text not null default 'pendente' check (result in ('aprovado','reprovado','pendente')),
  notes          text
);
create index if not exists idx_verif_driver on public.verification_reviews(driver_id);

-- ----------------------------------------------------------------------------
-- Leads (contato via WhatsApp) e lista de interesse (waitlist)
-- Coletam só o necessário, exigem consentimento, nunca endereço completo.
-- ----------------------------------------------------------------------------
create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  driver_id       uuid references public.drivers(id) on delete set null,
  destination_id  text references public.destinations(id) on delete set null,
  turno           public.turno,
  contratacao     text,
  region          text,              -- bairro/região, NUNCA endereço completo
  consent         boolean not null check (consent = true),
  created_at      timestamptz not null default now()
);
create index if not exists idx_leads_driver on public.leads(driver_id, created_at desc);

create table if not exists public.waitlist_requests (
  id               uuid primary key default gen_random_uuid(),
  city_id          text references public.cities(id) on delete set null,
  region           text,
  destination_id   text references public.destinations(id) on delete set null,
  turno            public.turno,
  contact_name     text not null,
  contact_whatsapp text not null,
  consent          boolean not null check (consent = true),
  created_at       timestamptz not null default now()
);
create index if not exists idx_waitlist_city on public.waitlist_requests(city_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Auditoria genérica
-- ----------------------------------------------------------------------------
create table if not exists public.audit_events (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null,
  entity     text,
  entity_id  text,
  data       jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_created on public.audit_events(created_at desc);

-- ----------------------------------------------------------------------------
-- Funções auxiliares de papel (usadas nas políticas RLS)
-- ----------------------------------------------------------------------------
create or replace function public.has_role(p_role public.user_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = p_role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_role('admin'::public.user_role);
$$;
