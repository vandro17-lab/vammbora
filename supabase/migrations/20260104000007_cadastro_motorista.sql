-- ============================================================================
-- Vambora — Migração 0007: cadastro do motorista, veículos, documentos e rotas
-- ----------------------------------------------------------------------------
-- Acrescenta, sem destruir nada:
--  * vehicles                 — veículos do motorista (separado do cadastro)
--  * document_requirements    — requisitos de documento por cidade e categoria
--  * documents                — documentos enviados (condutor/veículo) + análise
--  * routes / route_stops / route_passengers — construtor visual de rotas
--  * Restrição de VISIBILIDADE pública: só aparece motorista elegível
--    (publicado, não suspenso, com documentos exigidos aprovados e válidos,
--     anúncio ativo e com rota concluída). Sem requisitos definidos => não elegível.
-- Tudo com RLS: cada um só mexe no que é seu; admin aprova; motorista nunca se aprova.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- VEÍCULOS
-- ----------------------------------------------------------------------------
create table if not exists public.vehicles (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references public.profiles(id) on delete cascade,
  model              text,
  year               int,
  plate              text,                 -- PRIVADO: nunca em view/consulta pública
  seats_passenger    int not null default 0 check (seats_passenger >= 0),
  feature_ac         boolean not null default false,
  feature_accessible boolean not null default false,
  feature_seatbelt   boolean not null default false,
  consumo_kml        numeric(5,2),         -- opcional, uso futuro
  photo_urls         text[] not null default '{}',  -- bucket público (fotos aprovadas)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_vehicles_owner on public.vehicles(owner_id);
drop trigger if exists trg_vehicles_updated on public.vehicles;
create trigger trg_vehicles_updated before update on public.vehicles
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- REQUISITOS DE DOCUMENTO (configuráveis por cidade e categoria)
-- NÃO inventamos a lista legal de Araçatuba: começa vazia; admin configura.
-- ----------------------------------------------------------------------------
create table if not exists public.document_requirements (
  id                uuid primary key default gen_random_uuid(),
  city_id           text not null references public.cities(id) on delete cascade,
  category          text not null check (category in ('condutor','veiculo')),
  key               text not null,
  name              text not null,
  requires_validity boolean not null default true,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (city_id, category, key)
);
create index if not exists idx_docreq_city on public.document_requirements(city_id, category) where active;

-- ----------------------------------------------------------------------------
-- DOCUMENTOS (enviados pelo motorista; aprovados só por admin)
-- ----------------------------------------------------------------------------
create table if not exists public.documents (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  category        text not null check (category in ('condutor','veiculo')),
  vehicle_id      uuid references public.vehicles(id) on delete cascade,  -- quando category='veiculo'
  requirement_id  uuid references public.document_requirements(id) on delete set null,
  requirement_key text,
  file_path       text,                 -- bucket PRIVADO driver-docs
  status          text not null default 'em_analise'
                    check (status in ('em_analise','aprovado','reprovado','vencido')),
  validity_until  date,
  review_reason   text,
  reviewer_id     uuid references public.profiles(id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_documents_owner on public.documents(owner_id);
create index if not exists idx_documents_vehicle on public.documents(vehicle_id);
drop trigger if exists trg_documents_updated on public.documents;
create trigger trg_documents_updated before update on public.documents
  for each row execute function public.set_updated_at();

-- Protege campos de análise: motorista NÃO aprova a si mesmo.
-- Não-admin só pode inserir/editar com status 'em_analise' e sem campos de revisão.
create or replace function public.proteger_documento()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'em_analise';
    new.reviewer_id := null; new.reviewed_at := null; new.review_reason := null;
  elsif tg_op = 'UPDATE' then
    new.status := old.status;           -- só admin muda status
    new.reviewer_id := old.reviewer_id;
    new.reviewed_at := old.reviewed_at;
    new.review_reason := old.review_reason;
    new.owner_id := old.owner_id;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_proteger_documento on public.documents;
create trigger trg_proteger_documento before insert or update on public.documents
  for each row execute function public.proteger_documento();

-- ----------------------------------------------------------------------------
-- ROTAS (construtor visual) — alinhado ao contrato do motor (RotaInstancia)
-- ----------------------------------------------------------------------------
create table if not exists public.routes (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references public.profiles(id) on delete cascade,
  vehicle_id           uuid references public.vehicles(id) on delete set null,
  city_id              text not null references public.cities(id) on delete restrict,
  name                 text not null default '',
  direction            text not null default 'ida' check (direction in ('ida','volta')),
  turno                public.turno,
  days                 text[] not null default '{}',
  monitor              boolean not null default false,
  monitor_ocupa_lugar  boolean not null default false,
  reserved_seats       int not null default 0 check (reserved_seats >= 0),
  last_dropoff_min     int,              -- "deixar o último aluno" (minutos da meia-noite)
  early_leave_limit_min int,             -- limite de antecipação (minutos)
  status               text not null default 'rascunho' check (status in ('rascunho','concluida')),
  version              int not null default 1,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_routes_owner on public.routes(owner_id);
drop trigger if exists trg_routes_updated on public.routes;
create trigger trg_routes_updated before update on public.routes
  for each row execute function public.set_updated_at();

-- Paradas em ordem de passagem (endereço é PRIVADO)
create table if not exists public.route_stops (
  id               uuid primary key default gen_random_uuid(),
  route_id         uuid not null references public.routes(id) on delete cascade,
  ordem            int not null,
  type             text not null check (type in ('saida','casa','escola')),
  label            text not null default '',     -- PRIVADO (endereço/referência)
  lat              double precision,
  lng              double precision,
  confirmed        boolean not null default false,
  destination_id   text references public.destinations(id) on delete set null, -- quando escola
  leg_time_min     int,                            -- minutos informados até a PRÓXIMA parada
  planned_time_min int,                           -- estimativa (opcional)
  created_at       timestamptz not null default now()
);
create index if not exists idx_route_stops_route on public.route_stops(route_id, ordem);

-- Passageiros (privado): identificados por ID, não pelo nome
create table if not exists public.route_passengers (
  id             uuid primary key default gen_random_uuid(),
  route_id       uuid not null references public.routes(id) on delete cascade,
  identificacao  text not null,                   -- nome curto/apelido (PRIVADO)
  board_stop_id  uuid references public.route_stops(id) on delete cascade,
  alight_stop_id uuid references public.route_stops(id) on delete set null,
  destination_id text references public.destinations(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_route_passengers_route on public.route_passengers(route_id);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.vehicles              enable row level security;
alter table public.document_requirements enable row level security;
alter table public.documents             enable row level security;
alter table public.routes                enable row level security;
alter table public.route_stops           enable row level security;
alter table public.route_passengers      enable row level security;

-- VEHICLES: dono gerencia o seu; admin tudo. Sem leitura pública direta.
drop policy if exists vehicles_owner on public.vehicles;
create policy vehicles_owner on public.vehicles for all
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- DOCUMENT_REQUIREMENTS: leitura por qualquer autenticado (p/ montar a lista); escrita só admin.
drop policy if exists docreq_read on public.document_requirements;
create policy docreq_read on public.document_requirements for select
  using (auth.role() = 'authenticated' or public.is_admin());
drop policy if exists docreq_admin on public.document_requirements;
create policy docreq_admin on public.document_requirements for all
  using (public.is_admin()) with check (public.is_admin());

-- DOCUMENTS: dono lê/insere/edita os seus (sem aprovar); admin tudo.
drop policy if exists documents_owner_read on public.documents;
create policy documents_owner_read on public.documents for select
  using (owner_id = auth.uid() or public.is_admin());
drop policy if exists documents_owner_write on public.documents;
create policy documents_owner_write on public.documents for insert
  with check (owner_id = auth.uid() or public.is_admin());
drop policy if exists documents_owner_update on public.documents;
create policy documents_owner_update on public.documents for update
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
drop policy if exists documents_admin_delete on public.documents;
create policy documents_admin_delete on public.documents for delete
  using (owner_id = auth.uid() or public.is_admin());

-- ROUTES / STOPS / PASSENGERS: dono gerencia o seu; admin tudo. Sem leitura pública.
drop policy if exists routes_owner on public.routes;
create policy routes_owner on public.routes for all
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists stops_owner on public.route_stops;
create policy stops_owner on public.route_stops for all
  using (public.is_admin() or exists (
    select 1 from public.routes r where r.id = route_id and r.owner_id = auth.uid()))
  with check (public.is_admin() or exists (
    select 1 from public.routes r where r.id = route_id and r.owner_id = auth.uid()));

drop policy if exists passengers_owner on public.route_passengers;
create policy passengers_owner on public.route_passengers for all
  using (public.is_admin() or exists (
    select 1 from public.routes r where r.id = route_id and r.owner_id = auth.uid()))
  with check (public.is_admin() or exists (
    select 1 from public.routes r where r.id = route_id and r.owner_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- ELEGIBILIDADE PÚBLICA (documentação aprovada) + gating da vitrine
-- ----------------------------------------------------------------------------
-- Condutor OK: existe >=1 requisito 'condutor' ativo na cidade E todos têm
-- documento aprovado e não vencido do owner. (Sem requisitos => NÃO ok.)
create or replace function public.condutor_documentos_ok(p_owner uuid, p_city text)
returns boolean language sql stable security definer set search_path = public as $$
  with req as (
    select id from public.document_requirements
    where city_id = p_city and category = 'condutor' and active
  )
  select exists (select 1 from req)
     and not exists (
       select 1 from req
       where not exists (
         select 1 from public.documents d
         where d.owner_id = p_owner and d.category = 'condutor'
           and d.requirement_id = req.id and d.status = 'aprovado'
           and (d.validity_until is null or d.validity_until >= current_date)
       )
     );
$$;

-- Veículo OK: existe >=1 requisito 'veiculo' ativo E este veículo tem todos aprovados/válidos.
create or replace function public.veiculo_documentos_ok(p_vehicle uuid, p_owner uuid, p_city text)
returns boolean language sql stable security definer set search_path = public as $$
  with req as (
    select id from public.document_requirements
    where city_id = p_city and category = 'veiculo' and active
  )
  select p_vehicle is not null
     and exists (select 1 from req)
     and not exists (
       select 1 from req
       where not exists (
         select 1 from public.documents d
         where d.owner_id = p_owner and d.category = 'veiculo' and d.vehicle_id = p_vehicle
           and d.requirement_id = req.id and d.status = 'aprovado'
           and (d.validity_until is null or d.validity_until >= current_date)
       )
     );
$$;

-- Motorista elegível para a vitrine: publicado, não suspenso, anúncio ativo,
-- condutor OK e existe uma ROTA concluída/ativa com um veículo com documentos OK.
create or replace function public.motorista_elegivel(d public.drivers)
returns boolean language sql stable security definer set search_path = public as $$
  select d.is_published and not d.is_suspended and coalesce(d.anuncio_ativo, false)
     and public.condutor_documentos_ok(d.owner_id, d.city_id)
     and exists (
       select 1 from public.routes r
       where r.owner_id = d.owner_id and r.status = 'concluida'
         and public.veiculo_documentos_ok(r.vehicle_id, d.owner_id, d.city_id)
     );
$$;

-- Flag "anúncio ativo" no drivers (motorista liga; só aparece se elegível).
alter table public.drivers add column if not exists anuncio_ativo boolean not null default false;

-- Recria a view pública com o gating de elegibilidade.
create or replace view public.public_listings as
select
  d.id, d.slug, d.name, d.photo_url, d.van_photo_url, d.description,
  d.city_id, d.neighborhoods, d.turnos, d.capacity_total, d.seats_available,
  d.feature_ac, d.feature_monitor, d.feature_seatbelt, d.feature_accessible,
  d.price_type, d.price_month, d.price_daily, d.rating_avg, d.rating_count,
  d.boarding_time, d.tolerance_before_min, d.tolerance_after_min,
  d.doc_verified, d.is_demo,
  coalesce(
    (select array_agg(dd.destination_id) from public.driver_destinations dd where dd.driver_id = d.id),
    '{}'
  ) as destination_ids
from public.drivers d
where public.motorista_elegivel(d);

grant select on public.public_listings to anon, authenticated;
grant select on public.document_requirements to authenticated;

-- ----------------------------------------------------------------------------
-- RPC transacional: salvar rota + paradas + passageiros de uma vez (atômico)
-- ----------------------------------------------------------------------------
create or replace function public.salvar_rota_completa(p_rota jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_route_id uuid := nullif(p_rota->>'id','')::uuid;
  v_owner uuid := auth.uid();
  v_city text;
  v_stop jsonb;
  v_pax jsonb;
begin
  if v_owner is null then raise exception 'Precisa estar autenticado.'; end if;

  -- cidade: do veículo/driver do dono (fallback: primeira cidade)
  select coalesce((select city_id from public.drivers where owner_id = v_owner limit 1),
                  (select id from public.cities limit 1)) into v_city;

  if v_route_id is null then
    insert into public.routes (owner_id, vehicle_id, city_id, name, direction, turno, days,
      monitor, monitor_ocupa_lugar, reserved_seats, last_dropoff_min, early_leave_limit_min, status)
    values (v_owner, nullif(p_rota->>'vehicle_id','')::uuid, v_city,
      coalesce(p_rota->>'name',''), coalesce(p_rota->>'direction','ida'),
      nullif(p_rota->>'turno','')::public.turno,
      coalesce((select array_agg(value::text) from jsonb_array_elements_text(p_rota->'days')), '{}'),
      coalesce((p_rota->>'monitor')::boolean,false), coalesce((p_rota->>'monitor_ocupa_lugar')::boolean,false),
      coalesce((p_rota->>'reserved_seats')::int,0), nullif(p_rota->>'last_dropoff_min','')::int,
      nullif(p_rota->>'early_leave_limit_min','')::int, coalesce(p_rota->>'status','rascunho'))
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
      status = coalesce(p_rota->>'status','rascunho')
    where id = v_route_id and (owner_id = v_owner or public.is_admin());
    if not found then raise exception 'Rota não encontrada ou sem permissão.'; end if;
  end if;

  delete from public.route_passengers where route_id = v_route_id;
  delete from public.route_stops where route_id = v_route_id;

  for v_stop in select * from jsonb_array_elements(coalesce(p_rota->'stops','[]'::jsonb)) loop
    insert into public.route_stops (id, route_id, ordem, type, label, lat, lng, confirmed, destination_id, leg_time_min)
    values (coalesce(nullif(v_stop->>'id','')::uuid, gen_random_uuid()), v_route_id,
      (v_stop->>'ordem')::int, v_stop->>'type', coalesce(v_stop->>'label',''),
      nullif(v_stop->>'lat','')::double precision, nullif(v_stop->>'lng','')::double precision,
      coalesce((v_stop->>'confirmed')::boolean,false), nullif(v_stop->>'destination_id',''), nullif(v_stop->>'leg_time_min','')::int);
  end loop;

  for v_pax in select * from jsonb_array_elements(coalesce(p_rota->'passengers','[]'::jsonb)) loop
    insert into public.route_passengers (id, route_id, identificacao, board_stop_id, alight_stop_id, destination_id)
    values (coalesce(nullif(v_pax->>'id','')::uuid, gen_random_uuid()), v_route_id,
      coalesce(v_pax->>'identificacao',''), nullif(v_pax->>'board_stop_id','')::uuid,
      nullif(v_pax->>'alight_stop_id','')::uuid, nullif(v_pax->>'destination_id',''));
  end loop;

  return v_route_id;
end;
$$;
grant execute on function public.salvar_rota_completa(jsonb) to authenticated;
