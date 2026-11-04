-- ============================================================================
-- Vambora — Migração 0003: Storage (buckets e políticas)
-- ----------------------------------------------------------------------------
--  * public-media : imagens aprovadas (leitura pública). SEM dados sensíveis.
--  * driver-docs  : documentos privados (só dono e admin). NUNCA público.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('public-media', 'public-media', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('driver-docs', 'driver-docs', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- public-media: qualquer um lê; só autenticado envia; dono/admin altera/remove
-- Convenção de pasta: public-media/{auth.uid()}/arquivo.ext
-- ----------------------------------------------------------------------------
drop policy if exists media_public_read on storage.objects;
create policy media_public_read on storage.objects
  for select using (bucket_id = 'public-media');

drop policy if exists media_auth_insert on storage.objects;
create policy media_auth_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'public-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists media_owner_modify on storage.objects;
create policy media_owner_modify on storage.objects
  for update to authenticated
  using (bucket_id = 'public-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists media_owner_delete on storage.objects;
create policy media_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'public-media'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ----------------------------------------------------------------------------
-- driver-docs: PRIVADO. Só o dono (pasta = uid) e admin leem/gerenciam.
-- ----------------------------------------------------------------------------
drop policy if exists docs_owner_read on storage.objects;
create policy docs_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'driver-docs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists docs_owner_insert on storage.objects;
create policy docs_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'driver-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists docs_owner_delete on storage.objects;
create policy docs_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'driver-docs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
