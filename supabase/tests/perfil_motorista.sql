-- ============================================================================
-- TESTE do perfil REAL do motorista (banco LOCAL descartável).
-- Pré-requisito: migrações aplicadas + tests/local/20_perfil_motorista_dados.sql.
-- Cada verificação que falhar interrompe com "FALHA: …".
-- ============================================================================
\set ON_ERROR_STOP 1
set client_min_messages = notice;

-- Auxiliares (só desta sessão) ------------------------------------------------
create function pg_temp.como(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.anonimo() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $$;
create function pg_temp.ok(c boolean, m text) returns void language plpgsql as $$
begin
  if c is not true then raise exception 'FALHA: %', m; end if;
end $$;
-- Executa um comando que DEVE falhar; se passar, o teste falha.
create function pg_temp.recusa(cmd text, m text) returns void language plpgsql as $$
begin
  begin
    execute cmd;
  exception when others then
    return;
  end;
  raise exception 'FALHA (deveria ter sido recusado): %', m;
end $$;
create function pg_temp.vitrine_tem(p_slug text) returns boolean language sql as $$
  select exists (select 1 from public.public_listings where slug = p_slug)
$$;

\set A '''11111111-1111-4111-8111-111111111111'''
\set B '''22222222-2222-4222-8222-222222222222'''
\set C '''33333333-3333-4333-8333-333333333333'''

-- T1 — Usuário sem perfil ----------------------------------------------------
begin;
select pg_temp.como(:C);
select pg_temp.ok(public.meu_perfil_motorista() is null, 'T1 usuário sem perfil deveria ler perfil nulo');
select pg_temp.recusa('select public.publicar_perfil_motorista(true)', 'T1 publicar sem perfil');
commit;
begin;
select pg_temp.anonimo();
select pg_temp.ok((select count(*) from public.public_listings where not is_demo) = 0, 'T1 vitrine não deveria ter motorista real');
commit;
\echo 'OK T1 usuário sem perfil'

-- T2 — Cadastro de motorista novo -------------------------------------------
begin;
select pg_temp.como(:A);
select pg_temp.ok((public.salvar_perfil_motorista('Tio Zé', 'Transporto alunos há 15 anos.', 'aracatuba-sp', '(18) 99999-0000')->>'slug') = 'tio-ze', 'T2 slug gerado');
commit;
select pg_temp.ok((select count(*) from public.drivers where owner_id = :A) = 1, 'T2 exatamente um perfil para A');
select pg_temp.ok((select not is_demo and not doc_verified and rating_avg = 0 and rating_count = 0 and not anuncio_ativo and not is_suspended
                   and whatsapp = '5518999990000' and name = 'Tio Zé' and city_id = 'aracatuba-sp'
                   from public.drivers where owner_id = :A), 'T2 campos do perfil novo (sem selo, sem nota, não publicado)');
select pg_temp.ok(exists (select 1 from public.user_roles where user_id = :A and role = 'motorista'), 'T2 papel motorista atribuído');
\echo 'OK T2 cadastro novo'

-- T3 — Perfil já existente (edição mantém id e slug) ------------------------
create temp table t3_antes as select id, slug from public.drivers where owner_id = :A;
begin;
select pg_temp.como(:A);
select public.salvar_perfil_motorista('Tio Zé da Van', null, 'aracatuba-sp', null);
commit;
select pg_temp.ok((select count(*) from public.drivers where owner_id = :A) = 1, 'T3 continua um perfil só');
select pg_temp.ok((select d.id = t.id and d.slug = t.slug and d.name = 'Tio Zé da Van' and d.description is null and d.whatsapp is null
                   from public.drivers d, t3_antes t where d.owner_id = :A), 'T3 edição mantém id/slug e atualiza campos');
\echo 'OK T3 perfil existente'

-- T4 — Tentativa de cadastro duplicado --------------------------------------
begin;
select pg_temp.como(:A);
select pg_temp.recusa($q$insert into public.drivers (owner_id, slug, name, city_id) values ('11111111-1111-4111-8111-111111111111', 'outro-a', 'Outro', 'aracatuba-sp')$q$,
                      'T4 segundo perfil para a mesma conta (via API)');
commit;
select pg_temp.recusa($q$insert into public.drivers (owner_id, slug, name, city_id) values ('11111111-1111-4111-8111-111111111111', 'outro-a2', 'Outro', 'aracatuba-sp')$q$,
                      'T4 segundo perfil para a mesma conta (índice único)');
select pg_temp.ok((select count(*) from public.drivers where owner_id = :A) = 1, 'T4 nenhum perfil duplicado');
\echo 'OK T4 duplicado recusado'

-- T5 — Vinculação de van/rota + publicação e despublicação -----------------
begin;
select pg_temp.como(:A);
select public.salvar_perfil_motorista('Tio Zé da Van', 'Atendo Araçatuba.', 'aracatuba-sp', '18988887777');
select pg_temp.ok((public.meu_perfil_motorista()->>'rota_concluida_com_van')::boolean, 'T5 A tem rota concluída com a própria van');
select pg_temp.ok(not (public.meu_perfil_motorista()->>'visivel')::boolean, 'T5 antes de publicar não está visível');
commit;
begin; select pg_temp.anonimo();
select pg_temp.ok(not pg_temp.vitrine_tem('tio-ze'), 'T5 não publicado não aparece');
select pg_temp.recusa($q$select public.solicitar_contato_whatsapp('tio-ze', true)$q$, 'T5 WhatsApp de perfil não publicado');
commit;
begin; select pg_temp.como(:A); select public.publicar_perfil_motorista(true);
select pg_temp.ok((public.meu_perfil_motorista()->>'visivel')::boolean, 'T5 publicado fica visível');
commit;
begin; select pg_temp.anonimo();
select pg_temp.ok(pg_temp.vitrine_tem('tio-ze'), 'T5 publicado aparece na vitrine');
select pg_temp.ok(public.solicitar_contato_whatsapp('tio-ze', true) = '5518988887777', 'T5 contato do perfil publicado');
commit;
begin; select pg_temp.como(:A); select public.publicar_perfil_motorista(false); commit;
begin; select pg_temp.anonimo();
select pg_temp.ok(not pg_temp.vitrine_tem('tio-ze'), 'T5 despublicado some da vitrine');
commit;
begin; select pg_temp.como(:A); select public.publicar_perfil_motorista(true); commit;
\echo 'OK T5 vinculação, publicação e despublicação'

-- T6 — Conta B: rota em rascunho e rota com van de OUTRA conta não valem -----
begin;
select pg_temp.como(:B);
select pg_temp.ok((public.salvar_perfil_motorista('Tio Zé', null, 'aracatuba-sp', null)->>'slug') like 'tio-ze-%', 'T6 slug único para nome repetido');
select public.publicar_perfil_motorista(true);
select pg_temp.ok(not (public.meu_perfil_motorista()->>'rota_concluida_com_van')::boolean, 'T6 rascunho/van alheia não contam');
select pg_temp.ok(not (public.meu_perfil_motorista()->>'visivel')::boolean, 'T6 B não fica visível');
commit;
begin; select pg_temp.anonimo();
select pg_temp.ok((select count(*) from public.public_listings where not is_demo) = 1, 'T6 só A aparece');
commit;
\echo 'OK T6 associação incorreta não publica'

-- T7 — Isolamento entre contas ----------------------------------------------
begin;
select pg_temp.como(:B);
update public.drivers set name = 'invadido' where slug = 'tio-ze';
delete from public.drivers where slug = 'tio-ze';
select pg_temp.ok(public.meu_perfil_motorista()->>'nome' = 'Tio Zé', 'T7 B só lê o próprio perfil');
select pg_temp.ok((select count(*) from public.drivers where owner_id = :A) = 0, 'T7 B não enxerga o perfil de A pela tabela');
-- campos reservados do próprio perfil: não mudam
update public.drivers set doc_verified = true, rating_avg = 5, rating_count = 99, is_suspended = true, is_demo = true,
                          owner_id = '11111111-1111-4111-8111-111111111111', slug = 'roubado'
 where owner_id = :B;
commit;
select pg_temp.ok((select name = 'Tio Zé da Van' from public.drivers where owner_id = :A), 'T7 perfil de A intacto');
select pg_temp.ok((select count(*) = 1 from public.drivers where owner_id = :A), 'T7 A continua com um perfil');
select pg_temp.ok((select not doc_verified and rating_avg = 0 and rating_count = 0 and not is_suspended and not is_demo and slug like 'tio-ze-%'
                   from public.drivers where owner_id = :B), 'T7 B não altera selo, nota, suspensão, demo, dono ou slug');
select pg_temp.ok((select anuncio_ativo from public.drivers where owner_id = :A), 'T7 publicar de B não afetou A');
\echo 'OK T7 isolamento entre contas'

-- T8 — Anônimo não usa as RPCs de perfil ------------------------------------
begin; select pg_temp.anonimo();
select pg_temp.recusa($q$select public.salvar_perfil_motorista('X', null, 'aracatuba-sp', null)$q$, 'T8 anon salvar');
select pg_temp.recusa($q$select public.publicar_perfil_motorista(true)$q$, 'T8 anon publicar');
select pg_temp.recusa($q$select public.meu_perfil_motorista()$q$, 'T8 anon ler perfil');
commit;
\echo 'OK T8 anônimo bloqueado'

-- T9 — Validações -----------------------------------------------------------
begin; select pg_temp.como(:C);
select pg_temp.recusa($q$select public.salvar_perfil_motorista('Z', null, 'aracatuba-sp', null)$q$, 'T9 nome curto');
select pg_temp.recusa($q$select public.salvar_perfil_motorista('Zé Teste', null, 'cidade-x', null)$q$, 'T9 cidade inexistente');
select pg_temp.recusa($q$select public.salvar_perfil_motorista('Zé Teste', null, 'aracatuba-sp', '1234')$q$, 'T9 WhatsApp inválido');
select pg_temp.recusa($q$select public.salvar_perfil_motorista('Zé Teste', repeat('a', 601), 'aracatuba-sp', null)$q$, 'T9 apresentação longa');
select pg_temp.ok(public.meu_perfil_motorista() is null, 'T9 nada gravado após erros');
commit;
\echo 'OK T9 validações'

-- T10 — Demonstração e vitrine ----------------------------------------------
begin; select pg_temp.anonimo();
select pg_temp.ok((select count(*) from public.public_listings where is_demo) = 2, 'T10 demos visíveis inalterados (2)');
select pg_temp.ok(pg_temp.vitrine_tem('tio-joao') and not pg_temp.vitrine_tem('demo-suspenso'), 'T10 demo publicado aparece; suspenso não');
select pg_temp.recusa($q$select public.solicitar_contato_whatsapp('demo-suspenso', true)$q$, 'T10 contato de demo suspenso (como antes)');
select public.solicitar_contato_whatsapp('tio-joao', true);
commit;
select pg_temp.ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'public_listings'
                              and column_name in ('whatsapp', 'owner_id', 'cpf', 'phone')), 'T10 vitrine sem telefone/dono/CPF');
select pg_temp.ok(not has_table_privilege('anon', 'public.public_listings', 'UPDATE')
                  and not has_table_privilege('authenticated', 'public.public_listings', 'INSERT'), 'T10 vitrine segue somente leitura');
\echo 'OK T10 demonstração e vitrine'

\echo 'OK — perfil real do motorista: todos os testes passaram'
