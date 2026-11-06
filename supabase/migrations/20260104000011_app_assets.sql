-- ============================================================================
-- Vambora — Migração 0011: Gerenciador de ARTES (app_assets)  [ADITIVO]
-- ----------------------------------------------------------------------------
-- Objetivo: permitir que o admin publique imagens/ilustrações profissionais em
-- "espaços" (slots) pré-definidos da interface (ex.: van do cabeçalho, arte do
-- Clube, ícones da tela Mais), com fallback para os visuais atuais quando não
-- houver arte publicada.
--
-- NÃO altera tabelas operacionais, motores, RPCs nem regras de negócio.
-- Cria apenas:
--   * bucket de Storage `app-assets` (leitura pública; escrita só admin)
--   * tabela `public.app_assets` (mapa slot -> arte publicada)
--   * RLS: leitura pública; escrita somente `public.is_admin()`
--   * trigger de carimbo (updated_at / updated_by)
--
-- Reaproveita o mecanismo de admin existente: `public.is_admin()`.
-- Recuperação (rollback) documentada no fim do arquivo.
-- ============================================================================

-- ------------------------------------------------------------------ Bucket
insert into storage.buckets (id, name, public)
values ('app-assets', 'app-assets', true)
on conflict (id) do nothing;

-- ------------------------------------------------------------------ Tabela
create table if not exists public.app_assets (
  slot          text primary key,
  url           text not null,
  storage_path  text not null,
  content_type  text,
  width         integer,
  height        integer,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id) on delete set null
);

comment on table public.app_assets is
  'Mapa slot -> arte publicada (gerenciador de aparência). Escrita só admin; leitura pública.';

alter table public.app_assets enable row level security;

-- Leitura pública: o app (inclusive anônimo) precisa ler as artes publicadas.
drop policy if exists app_assets_public_read on public.app_assets;
create policy app_assets_public_read on public.app_assets
  for select using (true);

-- Escrita: somente admin.
drop policy if exists app_assets_admin_write on public.app_assets;
create policy app_assets_admin_write on public.app_assets
  for all using (public.is_admin()) with check (public.is_admin());

-- Carimbo server-side (não confiar no cliente para updated_at/updated_by).
create or replace function public.app_assets_touch()
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

drop trigger if exists trg_app_assets_touch on public.app_assets;
create trigger trg_app_assets_touch
  before insert or update on public.app_assets
  for each row execute function public.app_assets_touch();

-- ------------------------------------------------------- Storage: policies
-- Convenção de pasta: app-assets/{slot}/{arquivo}. Leitura pública; escrita só admin.
drop policy if exists app_assets_read on storage.objects;
create policy app_assets_read on storage.objects
  for select using (bucket_id = 'app-assets');

drop policy if exists app_assets_admin_insert on storage.objects;
create policy app_assets_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'app-assets' and public.is_admin());

drop policy if exists app_assets_admin_update on storage.objects;
create policy app_assets_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'app-assets' and public.is_admin())
  with check (bucket_id = 'app-assets' and public.is_admin());

drop policy if exists app_assets_admin_delete on storage.objects;
create policy app_assets_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'app-assets' and public.is_admin());

-- ============================================================================
-- RECUPERAÇÃO (rollback manual) — executar apenas se precisar desfazer:
-- ----------------------------------------------------------------------------
--   drop trigger if exists trg_app_assets_touch on public.app_assets;
--   drop function if exists public.app_assets_touch();
--   drop table if exists public.app_assets;
--   drop policy if exists app_assets_read on storage.objects;
--   drop policy if exists app_assets_admin_insert on storage.objects;
--   drop policy if exists app_assets_admin_update on storage.objects;
--   drop policy if exists app_assets_admin_delete on storage.objects;
--   -- apagar objetos do bucket antes de remover o bucket:
--   delete from storage.objects where bucket_id = 'app-assets';
--   delete from storage.buckets where id = 'app-assets';
-- ============================================================================
