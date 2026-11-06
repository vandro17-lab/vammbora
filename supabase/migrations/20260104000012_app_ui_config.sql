-- ============================================================================
-- Vambora — Migração 0012: Configuração visual do app (app_ui_config)  [ADITIVO]
-- ----------------------------------------------------------------------------
-- Objetivo: guardar personalizações de APARÊNCIA por componente — começando pelos
-- TEXTOS editáveis (conteúdo, tamanho, peso, cor, alinhamento) e, no futuro,
-- cabeçalhos em camadas, botões e cartões. Tudo como mapa `chave -> JSON`.
--
-- A chave é um identificador ESTÁVEL de componente (ex.: "rotas.header.titulo"),
-- independente de posição no código. Valores dinâmicos (números/datas do banco)
-- NÃO são guardados aqui — só a aparência; o conteúdo segue vindo dos dados reais.
--
-- NÃO altera tabelas operacionais, motores, RPCs nem regras. Reaproveita o
-- mecanismo de admin existente: public.is_admin(). Recuperação no fim do arquivo.
-- ============================================================================

create table if not exists public.app_ui_config (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
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

-- Carimbo server-side (não confiar no cliente para updated_at/updated_by).
create or replace function public.app_ui_config_touch()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_app_ui_config_touch on public.app_ui_config;
create trigger trg_app_ui_config_touch
  before insert or update on public.app_ui_config
  for each row execute function public.app_ui_config_touch();

-- ============================================================================
-- VERIFICAÇÃO (após aplicar): deve retornar a tabela e 2 políticas.
--   select count(*) from pg_policies where tablename = 'app_ui_config';  -- 2
--   select to_regclass('public.app_ui_config');                          -- public.app_ui_config
-- ----------------------------------------------------------------------------
-- RECUPERAÇÃO (rollback manual) — só se precisar desfazer:
--   drop trigger if exists trg_app_ui_config_touch on public.app_ui_config;
--   drop function if exists public.app_ui_config_touch();
--   drop table if exists public.app_ui_config;
-- ============================================================================
