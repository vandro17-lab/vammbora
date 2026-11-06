-- ============================================================================
-- Vambora — Migração 0012: Configuração visual do app (app_ui_config)  [ADITIVO]
-- ----------------------------------------------------------------------------
-- Objetivo: guardar personalizações de APARÊNCIA por componente — começando pelos
-- TEXTOS editáveis (conteúdo, tamanho, peso, cor, alinhamento) e, no futuro,
-- cabeçalhos em camadas, botões e cartões. Tudo como mapa `chave -> JSON`.
--
-- A chave é um identificador ESTÁVEL de componente (ex.: "rotas.header.titulo").
-- Valores dinâmicos (números/datas do banco) NÃO são guardados aqui — só a
-- aparência; o conteúdo segue vindo dos dados reais.
--
-- NÃO altera tabelas operacionais, motores, RPCs nem regras. Reaproveita o
-- mecanismo de admin existente: public.is_admin().
--
-- Observação: versão SEM função/trigger de carimbo de propósito — evita o
-- dollar-quoting ($$), que alguns editores SQL quebram ao separar comandos por
-- ";". O `updated_at` é enviado pelo cliente na publicação.
-- ============================================================================

create table if not exists public.app_ui_config (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

comment on table public.app_ui_config is
  'Configuração visual do app (chave -> JSON). Escrita só admin; leitura pública.';

alter table public.app_ui_config enable row level security;

-- Leitura pública: o app (inclusive anônimo) precisa ler as personalizações.
drop policy if exists app_ui_config_public_read on public.app_ui_config;
create policy app_ui_config_public_read on public.app_ui_config
  for select using (true);

-- Escrita: somente admin.
drop policy if exists app_ui_config_admin_write on public.app_ui_config;
create policy app_ui_config_admin_write on public.app_ui_config
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- VERIFICAÇÃO (após aplicar):
--   select to_regclass('public.app_ui_config');                         -- public.app_ui_config
--   select count(*) from pg_policies where tablename = 'app_ui_config';  -- 2
-- ----------------------------------------------------------------------------
-- RECUPERAÇÃO (rollback manual) — só se precisar desfazer:
--   drop table if exists public.app_ui_config;
-- ============================================================================
