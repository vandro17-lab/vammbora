-- ============================================================================
-- VIAGENS REALIZADAS (navegação do motorista)
-- ----------------------------------------------------------------------------
-- Cada vez que o motorista toca em "Iniciar rota" nasce uma VIAGEM; durante
-- ela ficam registrados os horários reais: chegada em cada parada, embarque,
-- desembarque e falta de cada aluno, com o tempo de espera.
--
-- As paradas e os alunos de uma rota são apagados e recriados a cada
-- salvamento da rota; por isso os eventos NÃO têm chave estrangeira para
-- eles: guardam o id e uma cópia do nome/endereço do momento da viagem, e o
-- histórico sobrevive a edições e à exclusão da rota.
--
-- Privado: só o dono (e admin) lê e grava. Aditivo e idempotente.
-- ============================================================================

create table if not exists public.route_trips (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  route_id     uuid references public.routes(id) on delete set null,
  route_name   text not null default '',
  direction    text not null check (direction in ('ida','volta')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_route_trips_owner on public.route_trips(owner_id, started_at desc);
create index if not exists idx_route_trips_route on public.route_trips(route_id, started_at desc);

create table if not exists public.route_trip_events (
  id              uuid primary key default gen_random_uuid(),
  trip_id         uuid not null references public.route_trips(id) on delete cascade,
  owner_id        uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  type            text not null check (type in ('chegada','embarque','desembarque','falta')),
  stop_id         uuid,
  stop_type       text check (stop_type in ('saida','casa','escola')),
  stop_label      text not null default '',   -- PRIVADO (endereço/escola)
  stop_order      int,
  passenger_id    uuid,
  passenger_name  text,                       -- PRIVADO
  occurred_at     timestamptz not null default now(),
  wait_seconds    int check (wait_seconds is null or wait_seconds >= 0), -- espera desde a chegada na parada
  lat             double precision,
  lng             double precision,
  created_at      timestamptz not null default now()
);
create index if not exists idx_route_trip_events_trip on public.route_trip_events(trip_id, occurred_at);
create index if not exists idx_route_trip_events_owner on public.route_trip_events(owner_id);

alter table public.route_trips       enable row level security;
alter table public.route_trip_events enable row level security;

drop policy if exists route_trips_owner on public.route_trips;
create policy route_trips_owner on public.route_trips
  for all
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists route_trip_events_owner on public.route_trip_events;
create policy route_trip_events_owner on public.route_trip_events
  for all
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
