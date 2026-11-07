-- ============================================================================
-- Vambora — Migração 0013: colunas da busca por horário + índices de performance
-- ----------------------------------------------------------------------------
-- ADITIVA e NÃO destrutiva. Alinha as migrations do repositório ao schema que o
-- app e a API JÁ usam em produção, e acrescenta um índice para a busca pública.
--
--  * routes.is_published          — publicação explícita da rota (já lida pelo
--                                    app em src/data/motorista-store.ts e pela
--                                    API api/buscar-rotas.ts). Default false:
--                                    "concluída" não implica "publicada".
--  * route_stops.habitual_arrival_min — horário habitual de chegada declarado
--                                    pelo motorista na parada (âncora de horário
--                                    da busca inteligente; minuto do dia 0..1439).
--  * índice routes(status,is_demo,direction) — a busca filtra exatamente por
--                                    esses campos (§10: evita varredura cheia).
--
-- `if not exists` em tudo: rodar em banco que já tem as colunas é no-op seguro.
-- NÃO adiciona CHECK em colunas já populadas (evita quebrar linhas existentes).
-- ============================================================================

alter table public.routes      add column if not exists is_published boolean not null default false;
alter table public.route_stops add column if not exists habitual_arrival_min int;

-- Preço por ALUNO da van (valor fixo por aluno, NUNCA por trecho). Opcional por
-- rota: quando preenchido, a busca pode exibi-lo no cartão; NULL = "a combinar".
alter table public.routes add column if not exists price_type  public.price_type;
alter table public.routes add column if not exists price_month numeric(10,2);

comment on column public.routes.is_published is
  'Rota publicada na busca pública pela família (ação explícita do motorista). "concluida" NÃO implica publicada. Default false.';
comment on column public.routes.price_month is
  'Mensalidade por ALUNO desta van (valor fixo por aluno, não por trecho). NULL = a combinar.';
comment on column public.routes.price_type is
  'Tipo de preço da rota: fixo | dinamico | a_combinar. Espelha o preço do motorista para a busca por rota.';
comment on column public.route_stops.habitual_arrival_min is
  'Horário habitual de chegada declarado pelo motorista nesta parada (minuto do dia 0..1439). Âncora de horário da busca inteligente; NULL = não informado.';

-- Índice da busca pública (routes concluídas, por sentido, excluindo/incluindo demo).
create index if not exists idx_routes_busca on public.routes (status, is_demo, direction);
