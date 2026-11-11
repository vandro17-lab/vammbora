-- ============================================================================
-- VanBora — Migração 0015: busca e encaixe, ETAPA 1 (modelo de dados e cadastro)
-- ----------------------------------------------------------------------------
-- ADITIVA, idempotente e NÃO destrutiva. Nenhum dado existente é apagado nem
-- preenchido por suposição: tudo o que é novo nasce NULL/false ("não
-- informado"), e o app aponta o que precisa de revisão.
--
--  1) routes
--       habitual_departure_min — horário habitual de saída da van (o endereço de
--                                saída continua sendo a parada `saida`; o quanto
--                                o motorista autoriza antecipar continua em
--                                `early_leave_limit_min`: NULL = não informado,
--                                0 = não autoriza).
--       turno_confirmed        — o PERÍODO ESCOLAR (`turno`) foi confirmado pelo
--                                motorista. Período e sentido (`direction`) são
--                                colunas separadas: a volta do meio-dia pode ser
--                                do período da manhã.
--       availability_reviewed  — o motorista já revisou a lista de escolas que
--                                aceita incluir nesta rota (lista vazia e
--                                revisada = "nenhuma"; não revisada = ausente).
--  2) route_stops (visita à escola)
--       arrival_deadline_min   — ida: limite de chegada à escola.
--       release_time_min       — volta: horário de liberação dos alunos.
--       group_service_min      — tempo de atendimento do GRUPO (aceita fração).
--       gate_custom            — lat/lng da parada é um PORTÃO específico; a
--                                identidade da unidade segue em `destination_id`.
--       (o ponto final obrigatório e seu limite seguem em `routes.last_dropoff_min`)
--  3) route_passengers.atendimento_min passa a aceitar fração de minuto
--       (int -> numeric(6,2); 0.5 = 30 s). Valores existentes são preservados.
--  4) route_school_availability — escolas que o motorista ACEITA INCLUIR numa
--       rota, mesmo sem passageiros. Pertence à ROTA (que já carrega período,
--       sentido e dias); `days` opcional restringe a um subconjunto dos dias.
--       NÃO é parada: não entra em route_stops, não gera parada obrigatória e
--       não altera a duração atual da rota.
--  5) RPC salvar_rota_completa — persiste os campos novos. Retrocompatível:
--       payload do app ANTIGO (sem as chaves novas) preserva o que já estava
--       gravado, em vez de apagar.
--
-- Também alinha o repositório a duas diferenças já presentes no banco em uso:
-- a RPC grava `habitual_arrival_min` e a coluna tem CHECK de 0..1439.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) ROTA: saída habitual, período confirmado, disponibilidade revisada
-- ----------------------------------------------------------------------------
alter table public.routes
  add column if not exists habitual_departure_min int,
  add column if not exists turno_confirmed       boolean not null default false,
  add column if not exists availability_reviewed boolean not null default false;

do $$ begin
  alter table public.routes add constraint routes_habitual_departure_chk
    check (habitual_departure_min is null or (habitual_departure_min >= 0 and habitual_departure_min <= 1439));
exception when duplicate_object then null; end $$;

comment on column public.routes.habitual_departure_min is
  'Horário habitual de saída da van (minuto do dia 0..1439). NULL = não informado. O endereço de saída é a parada type=saida.';
comment on column public.routes.early_leave_limit_min is
  'Quanto o motorista autoriza ANTECIPAR a saída habitual, em minutos. NULL = não informado (não presumir); 0 = não autoriza.';
comment on column public.routes.turno_confirmed is
  'true = o período escolar (turno) foi confirmado pelo motorista. false = sugerido/legado: precisa de revisão. Período e sentido (direction) são independentes.';
comment on column public.routes.availability_reviewed is
  'true = o motorista revisou a lista de escolas que aceita incluir nesta rota (route_school_availability). Lista vazia + true = nenhuma; false = ainda não informado.';
comment on column public.routes.last_dropoff_min is
  'Limite do PONTO FINAL obrigatório da rota (minuto do dia): ida = deixar o último aluno até; é o limite da última parada.';

-- ----------------------------------------------------------------------------
-- 2) VISITA À ESCOLA (route_stops type=escola)
-- ----------------------------------------------------------------------------
alter table public.route_stops
  add column if not exists habitual_arrival_min int,   -- já existe no banco em uso (0013)
  add column if not exists arrival_deadline_min int,
  add column if not exists release_time_min     int,
  add column if not exists group_service_min    numeric(6,2),
  add column if not exists gate_custom          boolean not null default false;

do $$ begin
  alter table public.route_stops add constraint route_stops_habitual_arrival_min_chk
    check (habitual_arrival_min is null or (habitual_arrival_min >= 0 and habitual_arrival_min <= 1439)) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.route_stops add constraint route_stops_arrival_deadline_chk
    check (arrival_deadline_min is null or (arrival_deadline_min >= 0 and arrival_deadline_min <= 1439));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.route_stops add constraint route_stops_release_time_chk
    check (release_time_min is null or (release_time_min >= 0 and release_time_min <= 1439));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.route_stops add constraint route_stops_group_service_chk
    check (group_service_min is null or (group_service_min >= 0 and group_service_min <= 60));
exception when duplicate_object then null; end $$;

comment on column public.route_stops.destination_id is
  'Escola: ID da unidade no catálogo `destinations` (o mesmo usado pelas famílias). É a IDENTIDADE da escola; lat/lng da parada podem apontar um portão específico (gate_custom).';
comment on column public.route_stops.arrival_deadline_min is
  'Visita à escola na IDA: limite de chegada (minuto do dia). NULL = não informado. Difere de habitual_arrival_min (quando a van costuma chegar).';
comment on column public.route_stops.release_time_min is
  'Visita à escola na VOLTA: horário de liberação dos alunos (minuto do dia). NULL = não informado.';
comment on column public.route_stops.group_service_min is
  'Visita à escola: tempo de atendimento do GRUPO, em minutos (aceita fração; 0.5 = 30 s). NULL = não informado; 0 = sem espera.';
comment on column public.route_stops.gate_custom is
  'true = lat/lng desta parada de escola é um portão específico marcado pelo motorista; false = ponto do catálogo. A unidade continua identificada por destination_id.';

-- ----------------------------------------------------------------------------
-- 3) PASSAGEIRO: tempo de atendimento com fração de minuto
-- ----------------------------------------------------------------------------
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'route_passengers'
      and column_name = 'atendimento_min' and data_type <> 'numeric'
  ) then
    alter table public.route_passengers alter column atendimento_min type numeric(6,2);
  end if;
end $$;

comment on column public.route_passengers.atendimento_min is
  'Duração do atendimento DESTE aluno na parada, em minutos (aceita fração; 0.5 = 30 s). NULL = não informado; 0 = zero informado. Vários alunos na mesma parada somam em sequência.';
comment on column public.route_passengers.ajuste_antes_min is
  'Flexibilidade, em minutos, ANTES do horário habitual deste aluno. NULL = não informado; 0 = sem flexibilidade (informado).';
comment on column public.route_passengers.ajuste_depois_min is
  'Flexibilidade, em minutos, DEPOIS do horário habitual deste aluno. NULL = não informado; 0 = sem flexibilidade (informado).';

-- ----------------------------------------------------------------------------
-- 4) ESCOLAS QUE O MOTORISTA ACEITA INCLUIR NA ROTA (disponibilidade)
-- ----------------------------------------------------------------------------
create table if not exists public.route_school_availability (
  id                   uuid primary key default gen_random_uuid(),
  route_id             uuid not null references public.routes(id) on delete cascade,
  destination_id       text not null references public.destinations(id) on delete cascade,
  days                 text[],                 -- NULL = todos os dias da rota
  gate_lat             double precision,       -- portão específico (opcional)
  gate_lng             double precision,
  arrival_deadline_min int,                    -- ida: limite de chegada, se a escola entrar
  release_time_min     int,                    -- volta: liberação, se a escola entrar
  group_service_min    numeric(6,2),           -- tempo do grupo, se a escola entrar
  created_at           timestamptz not null default now(),
  unique (route_id, destination_id),
  constraint route_school_avail_days_chk
    check (days is null or days <@ array['seg','ter','qua','qui','sex','sab','dom']::text[]),
  constraint route_school_avail_gate_chk
    check ((gate_lat is null) = (gate_lng is null)),
  constraint route_school_avail_deadline_chk
    check (arrival_deadline_min is null or (arrival_deadline_min >= 0 and arrival_deadline_min <= 1439)),
  constraint route_school_avail_release_chk
    check (release_time_min is null or (release_time_min >= 0 and release_time_min <= 1439)),
  constraint route_school_avail_group_chk
    check (group_service_min is null or (group_service_min >= 0 and group_service_min <= 60))
);
create index if not exists idx_route_school_avail_route on public.route_school_availability(route_id);
create index if not exists idx_route_school_avail_dest  on public.route_school_availability(destination_id);

comment on table public.route_school_availability is
  'Escolas que o motorista ACEITA INCLUIR em uma rota, mesmo sem passageiros atuais. Pertence à rota (período, sentido e dias vêm de routes). NÃO é parada: não gera parada obrigatória nem altera a duração atual. A lista geral do motorista (driver_destinations) só sugere o preenchimento; não autoriza rota nenhuma.';
comment on column public.route_school_availability.days is
  'Subconjunto dos dias da rota em que a escola é aceita. NULL = todos os dias da rota.';

alter table public.route_school_availability enable row level security;

drop policy if exists school_avail_owner on public.route_school_availability;
create policy school_avail_owner on public.route_school_availability for all
  using (public.is_admin() or exists (
    select 1 from public.routes r where r.id = route_id and r.owner_id = auth.uid()))
  with check (public.is_admin() or exists (
    select 1 from public.routes r where r.id = route_id and r.owner_id = auth.uid()));

-- Mesmo critério das demais tabelas de rota: só as linhas de demonstração são públicas.
drop policy if exists school_avail_demo_read on public.route_school_availability;
create policy school_avail_demo_read on public.route_school_availability for select
  using (exists (select 1 from public.routes r where r.id = route_id and r.is_demo));

grant select on public.route_school_availability to anon, authenticated;
grant insert, update, delete on public.route_school_availability to authenticated;

-- ----------------------------------------------------------------------------
-- 5) RPC salvar_rota_completa — campos novos, retrocompatível
-- ----------------------------------------------------------------------------
create or replace function public.salvar_rota_completa(p_rota jsonb)
returns uuid
language plpgsql security definer set search_path = public as $function$
declare
  v_route_id uuid := nullif(p_rota->>'id','')::uuid;
  v_owner uuid := auth.uid();
  v_city text;
  v_stop jsonb;
  v_pax jsonb;
  v_esc jsonb;
  v_old jsonb;                 -- parada como estava antes (para payload do app antigo)
  v_old_stops jsonb := '{}'::jsonb;
begin
  if v_owner is null then raise exception 'Precisa estar autenticado.'; end if;

  -- Toda escola de uma rota concluída vem do catálogo (mantém o ID da unidade).
  if coalesce(p_rota->>'status','rascunho') = 'concluida' and exists (
    select 1 from jsonb_array_elements(coalesce(p_rota->'stops','[]'::jsonb)) s
    where s->>'type' = 'escola' and nullif(s->>'destination_id','') is null
  ) then
    raise exception 'Há uma parada de escola sem escola do catálogo. Escolha a escola na lista antes de concluir a rota.';
  end if;

  select coalesce((select city_id from public.drivers where owner_id = v_owner limit 1),
                  (select id from public.cities limit 1)) into v_city;

  if v_route_id is null then
    insert into public.routes (owner_id, vehicle_id, city_id, name, direction, turno, days,
      monitor, monitor_ocupa_lugar, reserved_seats, last_dropoff_min, early_leave_limit_min, status,
      habitual_departure_min, turno_confirmed, availability_reviewed)
    values (v_owner, nullif(p_rota->>'vehicle_id','')::uuid, v_city,
      coalesce(p_rota->>'name',''), coalesce(p_rota->>'direction','ida'),
      nullif(p_rota->>'turno','')::public.turno,
      coalesce((select array_agg(value::text) from jsonb_array_elements_text(p_rota->'days')), '{}'),
      coalesce((p_rota->>'monitor')::boolean,false), coalesce((p_rota->>'monitor_ocupa_lugar')::boolean,false),
      coalesce((p_rota->>'reserved_seats')::int,0), nullif(p_rota->>'last_dropoff_min','')::int,
      nullif(p_rota->>'early_leave_limit_min','')::int, coalesce(p_rota->>'status','rascunho'),
      nullif(p_rota->>'habitual_departure_min','')::int,
      coalesce((p_rota->>'turno_confirmed')::boolean,false),
      coalesce((p_rota->>'availability_reviewed')::boolean,false))
    returning id into v_route_id;
  else
    update public.routes set
      vehicle_id = nullif(p_rota->>'vehicle_id','')::uuid, name = coalesce(p_rota->>'name',''),
      direction = coalesce(p_rota->>'direction','ida'), turno = nullif(p_rota->>'turno','')::public.turno,
      days = coalesce((select array_agg(value::text) from jsonb_array_elements_text(p_rota->'days')), '{}'),
      monitor = coalesce((p_rota->>'monitor')::boolean,false),
      monitor_ocupa_lugar = coalesce((p_rota->>'monitor_ocupa_lugar')::boolean,false),
      reserved_seats = coalesce((p_rota->>'reserved_seats')::int,0),
      last_dropoff_min = nullif(p_rota->>'last_dropoff_min','')::int,
      early_leave_limit_min = nullif(p_rota->>'early_leave_limit_min','')::int,
      status = coalesce(p_rota->>'status','rascunho'),
      -- chave ausente (app antigo) = mantém o valor gravado
      habitual_departure_min = case when p_rota ? 'habitual_departure_min'
        then nullif(p_rota->>'habitual_departure_min','')::int else habitual_departure_min end,
      turno_confirmed = case when p_rota ? 'turno_confirmed'
        then coalesce((p_rota->>'turno_confirmed')::boolean,false) else turno_confirmed end,
      availability_reviewed = case when p_rota ? 'availability_reviewed'
        then coalesce((p_rota->>'availability_reviewed')::boolean,false) else availability_reviewed end,
      version = version + 1
    where id = v_route_id and (owner_id = v_owner or public.is_admin());
    if not found then raise exception 'Rota não encontrada ou sem permissão.'; end if;
  end if;

  -- Paradas e alunos são recriados a cada salvamento. Guarda as paradas antigas
  -- para não perder os campos novos quando o payload vier do app antigo.
  select coalesce(jsonb_object_agg(lower(s.id::text), to_jsonb(s)), '{}'::jsonb)
    into v_old_stops from public.route_stops s where s.route_id = v_route_id;

  delete from public.route_passengers where route_id = v_route_id;
  delete from public.route_stops where route_id = v_route_id;

  for v_stop in select * from jsonb_array_elements(coalesce(p_rota->'stops','[]'::jsonb)) loop
    v_old := coalesce(v_old_stops -> lower(nullif(v_stop->>'id','')), '{}'::jsonb);
    insert into public.route_stops (id, route_id, ordem, type, label, lat, lng, confirmed, destination_id,
      leg_time_min, habitual_arrival_min, arrival_deadline_min, release_time_min, group_service_min, gate_custom)
    values (coalesce(nullif(v_stop->>'id','')::uuid, gen_random_uuid()), v_route_id,
      (v_stop->>'ordem')::int, v_stop->>'type', coalesce(v_stop->>'label',''),
      nullif(v_stop->>'lat','')::double precision, nullif(v_stop->>'lng','')::double precision,
      coalesce((v_stop->>'confirmed')::boolean,false), nullif(v_stop->>'destination_id',''),
      nullif(v_stop->>'leg_time_min','')::int, nullif(v_stop->>'habitual_arrival_min','')::int,
      case when v_stop ? 'arrival_deadline_min' then nullif(v_stop->>'arrival_deadline_min','')::int
           else nullif(v_old->>'arrival_deadline_min','')::int end,
      case when v_stop ? 'release_time_min' then nullif(v_stop->>'release_time_min','')::int
           else nullif(v_old->>'release_time_min','')::int end,
      case when v_stop ? 'group_service_min' then nullif(v_stop->>'group_service_min','')::numeric
           else nullif(v_old->>'group_service_min','')::numeric end,
      case when v_stop ? 'gate_custom' then coalesce((v_stop->>'gate_custom')::boolean,false)
           else coalesce((v_old->>'gate_custom')::boolean,false) end);
  end loop;

  for v_pax in select * from jsonb_array_elements(coalesce(p_rota->'passengers','[]'::jsonb)) loop
    insert into public.route_passengers (id, route_id, identificacao, board_stop_id, alight_stop_id, destination_id,
      horario_habitual_min, ajuste_antes_min, ajuste_depois_min, atendimento_min, atendimento_origem)
    values (coalesce(nullif(v_pax->>'id','')::uuid, gen_random_uuid()), v_route_id,
      coalesce(v_pax->>'identificacao',''), nullif(v_pax->>'board_stop_id','')::uuid,
      nullif(v_pax->>'alight_stop_id','')::uuid, nullif(v_pax->>'destination_id',''),
      nullif(v_pax->>'horario_habitual_min','')::int, nullif(v_pax->>'ajuste_antes_min','')::int,
      nullif(v_pax->>'ajuste_depois_min','')::int, nullif(v_pax->>'atendimento_min','')::numeric,
      nullif(v_pax->>'atendimento_origem',''));
  end loop;

  -- Escolas que o motorista aceita incluir: só substitui quando a chave vier no
  -- payload (app antigo não a envia e, portanto, não apaga a lista).
  if p_rota ? 'school_availability' then
    delete from public.route_school_availability where route_id = v_route_id;
    for v_esc in select * from jsonb_array_elements(coalesce(p_rota->'school_availability','[]'::jsonb)) loop
      insert into public.route_school_availability (id, route_id, destination_id, days, gate_lat, gate_lng,
        arrival_deadline_min, release_time_min, group_service_min)
      values (coalesce(nullif(v_esc->>'id','')::uuid, gen_random_uuid()), v_route_id,
        v_esc->>'destination_id',
        case when jsonb_typeof(v_esc->'days') = 'array'
          then coalesce((select array_agg(value::text) from jsonb_array_elements_text(v_esc->'days')), '{}') end,
        nullif(v_esc->>'gate_lat','')::double precision, nullif(v_esc->>'gate_lng','')::double precision,
        nullif(v_esc->>'arrival_deadline_min','')::int, nullif(v_esc->>'release_time_min','')::int,
        nullif(v_esc->>'group_service_min','')::numeric)
      on conflict (route_id, destination_id) do nothing;
    end loop;
  end if;

  return v_route_id;
end;
$function$;

revoke execute on function public.salvar_rota_completa(jsonb) from public;
grant execute on function public.salvar_rota_completa(jsonb) to authenticated;
