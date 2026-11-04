-- ============================================================================
-- Teste de acessos à tabela drivers (RLS + gatilho de campos reservados)
-- ----------------------------------------------------------------------------
-- Como rodar: cole no SQL Editor do Supabase (ou psql com a service key) e
-- execute bloco a bloco. Cada bloco imprime o resultado e o ESPERADO.
-- Nenhum dado real é alterado (usa um registro de teste que é apagado ao final).
--
-- Resumo do que protege:
--  * Gatilho `trg_proteger_driver` fixa campos reservados (doc_verified,
--    rating_avg, rating_count, is_suspended, is_demo, owner_id, slug) para quem
--    NÃO é admin — tanto no INSERT quanto no UPDATE.
--  * RLS limita QUAIS linhas cada papel pode ler/editar.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- TESTE A — Gatilho: não-admin não escala; admin consegue (automatizável)
-- Esperado:
--   nao_admin_tentou_escalar -> doc_verified=false, rating_avg=0, is_suspended=false
--   admin_alterou            -> doc_verified=true,  rating_avg=5, is_suspended=true
-- ---------------------------------------------------------------------------
create or replace function public._teste_protecao_driver()
returns table(cenario text, doc_verified boolean, rating_avg numeric, is_suspended boolean)
language plpgsql as $$
declare vid uuid := '00000000-0000-0000-0000-0000000000ff';
begin
  perform set_config('request.jwt.claims', '', true);
  delete from public.drivers where id = vid;
  insert into public.drivers (id, slug, name, city_id, doc_verified, rating_avg, rating_count, is_suspended, is_demo)
  values (vid, '_teste_protecao', 'Teste Proteção', 'aracatuba-sp', false, 0, 0, false, false);

  -- usuário autenticado comum (não-admin) tenta escalar no próprio cadastro
  perform set_config('request.jwt.claims', '{"sub":"11111111-2222-3333-4444-555555555555","role":"authenticated"}', true);
  update public.drivers set doc_verified = true, rating_avg = 5, rating_count = 999, is_suspended = true where id = vid;
  return query select 'nao_admin_tentou_escalar'::text, d.doc_verified, d.rating_avg, d.is_suspended
    from public.drivers d where d.id = vid;

  -- administrador real altera (deve conseguir) — troque pelo e-mail do admin
  perform set_config('request.jwt.claims',
    (select json_build_object('sub', u.id, 'role', 'authenticated')::text
       from auth.users u where u.email = 'vandro17@gmail.com'), true);
  update public.drivers set doc_verified = true, rating_avg = 5, is_suspended = true where id = vid;
  return query select 'admin_alterou'::text, d.doc_verified, d.rating_avg, d.is_suspended
    from public.drivers d where d.id = vid;

  perform set_config('request.jwt.claims', '', true);
  delete from public.drivers where id = vid;
end;
$$;

select * from public._teste_protecao_driver();
drop function public._teste_protecao_driver();

-- ---------------------------------------------------------------------------
-- TESTE B — Leitura pública (visitante / anon)
-- Esperado: a view mostra os publicados; a tabela drivers NÃO é lida por anon.
-- ---------------------------------------------------------------------------
-- set local role anon;
-- select count(*) as vitrine_publica from public.public_listings;   -- > 0
-- select count(*) as drivers_direto  from public.drivers;           -- 0 (RLS bloqueia)
-- reset role;

-- ---------------------------------------------------------------------------
-- TESTE C — Outro usuário autenticado NÃO edita cadastro alheio (RLS)
-- Rode como um usuário real que NÃO é dono nem admin:
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<uid-de-outro-usuario>","role":"authenticated"}', true);
--   with u as (update public.drivers set seats_available = 0 where slug = 'dona-marcia-van-azul' returning 1)
--   select count(*) as linhas_afetadas from u;   -- Esperado: 0
--   reset role;

-- ---------------------------------------------------------------------------
-- TESTE D — Proprietário edita os campos permitidos, mas não os reservados
-- Rode como o dono (owner_id = auth.uid()); campos permitidos mudam, reservados não.
-- (Requer um motorista com owner_id = um usuário real não-admin.)
-- ---------------------------------------------------------------------------
