-- ============================================================================
-- Vambora — Migração 0002: Row Level Security (RLS) e leitura pública segura
-- ----------------------------------------------------------------------------
-- Princípios:
--  * A vitrine pública lê por VIEW (public_listings), SEM telefone/documento.
--  * A tabela drivers não é lida diretamente pelo público (anon).
--  * Dono (owner) gerencia só o próprio; admin gerencia tudo; validação no servidor.
-- ============================================================================

-- Habilita RLS em todas as tabelas sensíveis
alter table public.profiles            enable row level security;
alter table public.user_roles          enable row level security;
alter table public.cities              enable row level security;
alter table public.destinations        enable row level security;
alter table public.drivers             enable row level security;
alter table public.driver_destinations enable row level security;
alter table public.verification_reviews enable row level security;
alter table public.leads               enable row level security;
alter table public.waitlist_requests   enable row level security;
alter table public.audit_events        enable row level security;

-- ----------------------------------------------------------------------------
-- PROFILES: cada um vê/edita o seu; admin vê todos
-- ----------------------------------------------------------------------------
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- USER_ROLES: o próprio usuário lê seus papéis; só admin concede/remove
-- ----------------------------------------------------------------------------
drop policy if exists roles_self_select on public.user_roles;
create policy roles_self_select on public.user_roles
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists roles_admin_write on public.user_roles;
create policy roles_admin_write on public.user_roles
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- CITIES: leitura pública (referência); escrita só admin
-- ----------------------------------------------------------------------------
drop policy if exists cities_public_read on public.cities;
create policy cities_public_read on public.cities
  for select using (true);

drop policy if exists cities_admin_write on public.cities;
create policy cities_admin_write on public.cities
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- DESTINATIONS: leitura pública só dos publicados; escrita só admin
-- ----------------------------------------------------------------------------
drop policy if exists dest_public_read on public.destinations;
create policy dest_public_read on public.destinations
  for select using (is_published or public.is_admin());

drop policy if exists dest_admin_write on public.destinations;
create policy dest_admin_write on public.destinations
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- DRIVERS: SEM leitura direta pelo público. Dono gerencia o seu; admin tudo.
-- (A leitura pública acontece pela VIEW public_listings, mais abaixo.)
-- ----------------------------------------------------------------------------
drop policy if exists drivers_owner_select on public.drivers;
create policy drivers_owner_select on public.drivers
  for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists drivers_owner_insert on public.drivers;
create policy drivers_owner_insert on public.drivers
  for insert with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists drivers_owner_update on public.drivers;
create policy drivers_owner_update on public.drivers
  for update using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists drivers_admin_delete on public.drivers;
create policy drivers_admin_delete on public.drivers
  for delete using (public.is_admin());

-- DRIVER_DESTINATIONS: dono do motorista gerencia; admin tudo; leitura via view
drop policy if exists dd_owner_all on public.driver_destinations;
create policy dd_owner_all on public.driver_destinations
  for all using (
    public.is_admin() or exists (
      select 1 from public.drivers d
      where d.id = driver_id and d.owner_id = auth.uid()
    )
  ) with check (
    public.is_admin() or exists (
      select 1 from public.drivers d
      where d.id = driver_id and d.owner_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- VERIFICATION_REVIEWS: só admin; dono pode ler as suas
-- ----------------------------------------------------------------------------
drop policy if exists verif_read on public.verification_reviews;
create policy verif_read on public.verification_reviews
  for select using (
    public.is_admin() or exists (
      select 1 from public.drivers d
      where d.id = driver_id and d.owner_id = auth.uid()
    )
  );

drop policy if exists verif_admin_write on public.verification_reviews;
create policy verif_admin_write on public.verification_reviews
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- LEADS e WAITLIST: inserção pelo público via RPC (migração 0004).
-- Leitura só para admin / dono do motorista. Sem leitura anônima.
-- ----------------------------------------------------------------------------
drop policy if exists leads_read on public.leads;
create policy leads_read on public.leads
  for select using (
    public.is_admin() or exists (
      select 1 from public.drivers d
      where d.id = driver_id and d.owner_id = auth.uid()
    )
  );

drop policy if exists waitlist_admin_read on public.waitlist_requests;
create policy waitlist_admin_read on public.waitlist_requests
  for select using (public.is_admin());

-- AUDIT: só admin lê
drop policy if exists audit_admin_read on public.audit_events;
create policy audit_admin_read on public.audit_events
  for select using (public.is_admin());

-- ============================================================================
-- VIEW pública: só dados seguros de motoristas publicados e não suspensos.
-- SEM telefone, SEM documentos, SEM owner_id.
-- ============================================================================
create or replace view public.public_listings as
select
  d.id,
  d.slug,
  d.name,
  d.photo_url,
  d.van_photo_url,
  d.description,
  d.city_id,
  d.neighborhoods,
  d.turnos,
  d.capacity_total,
  d.seats_available,
  d.feature_ac,
  d.feature_monitor,
  d.feature_seatbelt,
  d.feature_accessible,
  d.price_type,
  d.price_month,
  d.price_daily,
  d.rating_avg,
  d.rating_count,
  d.boarding_time,
  d.tolerance_before_min,
  d.tolerance_after_min,
  d.doc_verified,
  d.is_demo,
  coalesce(
    (select array_agg(dd.destination_id) from public.driver_destinations dd where dd.driver_id = d.id),
    '{}'
  ) as destination_ids
from public.drivers d
where d.is_published and not d.is_suspended;

-- Concede leitura da view (e do catálogo) ao público anônimo e autenticado.
grant usage on schema public to anon, authenticated;
grant select on public.public_listings to anon, authenticated;
grant select on public.cities to anon, authenticated;
grant select on public.destinations to anon, authenticated;

-- Garante que o público NÃO lê a tabela drivers diretamente (só via view/RPC).
revoke select on public.drivers from anon;
