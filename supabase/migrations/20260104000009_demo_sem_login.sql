-- ============================================================================
-- Vambora — Migração 0009: demonstração sem login + elegibilidade por perfil
-- ----------------------------------------------------------------------------
-- Objetivo (pedido do produto):
--  * Motorista de DEMONSTRAÇÃO (is_demo) aparece na vitrine só com
--    is_published=true e is_suspended=false — SEM login, cadastro ou
--    aprovação de documentos. ("Já aprovado" para a demo.)
--  * Motorista REAL continua passando pelo fluxo completo: anúncio ativo,
--    documentos do condutor aprovados e uma rota concluída com veículo de
--    documentos aprovados.
--  * Veículos e rotas de demonstração são marcados com is_demo para poderem
--    ser lidos publicamente e escondidos do painel de donos reais.
--
-- NÃO destrói dados. Sem ALTER ... DROP NOT NULL (os dados de demonstração
-- usam um perfil "placeholder" como dono — ver seed-aracatuba-demo.sql).
-- Idempotente: pode rodar novamente sem erro.
-- ============================================================================

-- 1) Marcador de demonstração em veículos e rotas --------------------------
alter table public.vehicles add column if not exists is_demo boolean not null default false;
alter table public.routes   add column if not exists is_demo boolean not null default false;

-- 2) Leitura pública SOMENTE das linhas de demonstração --------------------
-- (aditivas às políticas de dono/admin que já existem na migração 0007)
grant select on public.vehicles          to anon, authenticated;
grant select on public.routes            to anon, authenticated;
grant select on public.route_stops       to anon, authenticated;
grant select on public.route_passengers  to anon, authenticated;

drop policy if exists vehicles_demo_read on public.vehicles;
create policy vehicles_demo_read on public.vehicles for select using (is_demo);

drop policy if exists routes_demo_read on public.routes;
create policy routes_demo_read on public.routes for select using (is_demo);

drop policy if exists stops_demo_read on public.route_stops;
create policy stops_demo_read on public.route_stops for select
  using (exists (select 1 from public.routes r where r.id = route_id and r.is_demo));

drop policy if exists passengers_demo_read on public.route_passengers;
create policy passengers_demo_read on public.route_passengers for select
  using (exists (select 1 from public.routes r where r.id = route_id and r.is_demo));

-- 3) Elegibilidade: atalho para a demo, fluxo completo para os reais -------
create or replace function public.motorista_elegivel(d public.drivers)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when coalesce((d).is_demo, false) then
      -- DEMONSTRAÇÃO: pré-aprovado — basta estar publicado e não suspenso.
      (d).is_published and not (d).is_suspended
    else
      -- REAL: fluxo completo de cadastro/documentos/rota.
      (d).is_published and not (d).is_suspended and coalesce((d).anuncio_ativo, false)
        and public.condutor_documentos_ok((d).owner_id, (d).city_id)
        and exists (
          select 1 from public.routes r
          where r.owner_id = (d).owner_id and r.status = 'concluida'
            and public.veiculo_documentos_ok(r.vehicle_id, (d).owner_id, (d).city_id)
        )
  end;
$$;

-- Função interna: não deve ser chamada direto pelo público (só via view).
revoke execute on function public.motorista_elegivel(public.drivers) from public;
