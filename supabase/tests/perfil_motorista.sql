-- ============================================================================
-- TESTE do perfil REAL do motorista, da oferta de rotas e do contato
-- (banco LOCAL descartável).
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
-- Rota inteira no formato de salvar_rota_completa (como o app envia),
-- opcionalmente com um passageiro a mais ou a menos.
create function pg_temp.rota_json(p_rota uuid, p_status text, p_extra jsonb default null, p_sem text default null)
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', r.id, 'name', r.name, 'direction', r.direction, 'turno', r.turno, 'days', to_jsonb(r.days),
    'vehicle_id', r.vehicle_id, 'monitor', r.monitor, 'monitor_ocupa_lugar', r.monitor_ocupa_lugar,
    'reserved_seats', r.reserved_seats, 'status', p_status,
    'stops', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'ordem', s.ordem, 'type', s.type, 'label', s.label,
                'lat', s.lat, 'lng', s.lng, 'confirmed', s.confirmed, 'destination_id', s.destination_id) order by s.ordem), '[]')
              from public.route_stops s where s.route_id = r.id),
    'passengers', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'identificacao', p.identificacao,
                    'board_stop_id', p.board_stop_id, 'alight_stop_id', p.alight_stop_id)), '[]')
                   from public.route_passengers p where p.route_id = r.id and p.identificacao is distinct from p_sem)
                  || case when p_extra is null then '[]'::jsonb else jsonb_build_array(p_extra) end)
  from public.routes r where r.id = p_rota
$$;

\set A '''11111111-1111-4111-8111-111111111111'''
\set B '''22222222-2222-4222-8222-222222222222'''
\set C '''33333333-3333-4333-8333-333333333333'''
\set ROTA_A '''aaaaaaaa-1111-4000-8000-000000000001'''
\set ROTA_B_RASCUNHO '''bbbbbbbb-1111-4000-8000-000000000001'''

-- T1 — Usuário sem perfil ----------------------------------------------------
begin;
select pg_temp.como(:C);
select pg_temp.ok(public.meu_perfil_motorista() is null, 'T1 usuário sem perfil deveria ler perfil nulo');
select pg_temp.recusa('select public.publicar_perfil_motorista(true)', 'T1 publicar sem perfil');
commit;
begin; select pg_temp.anonimo();
select pg_temp.ok((select count(*) from public.public_listings where not is_demo) = 0, 'T1 vitrine sem motorista real');
commit;
\echo 'OK T1 usuário sem perfil'

-- T2 — WhatsApp obrigatório e cadastro novo ---------------------------------
begin; select pg_temp.como(:A);
select pg_temp.recusa($q$select public.salvar_perfil_motorista('Tio Zé', null, 'aracatuba-sp', null)$q$, 'T2 sem WhatsApp');
select pg_temp.recusa($q$select public.salvar_perfil_motorista('Tio Zé', null, 'aracatuba-sp', '   ')$q$, 'T2 WhatsApp em branco');
select pg_temp.recusa($q$select public.salvar_perfil_motorista('Tio Zé', null, 'aracatuba-sp', '(18) 3333-0000')$q$, 'T2 telefone fixo');
select pg_temp.ok(public.meu_perfil_motorista() is null, 'T2 nada gravado sem WhatsApp válido');
select pg_temp.ok((public.salvar_perfil_motorista('Tio Zé', 'Transporto alunos há 15 anos.', 'aracatuba-sp', '(18) 99999-0000')->>'slug') = 'tio-ze', 'T2 slug gerado');
commit;
select pg_temp.ok((select count(*) from public.drivers where owner_id = :A) = 1, 'T2 exatamente um perfil para A');
select pg_temp.ok((select not is_demo and not doc_verified and rating_avg = 0 and rating_count = 0 and not anuncio_ativo and not is_suspended
                   and whatsapp = '5518999990000' and not contato_whatsapp_ativo and name = 'Tio Zé'
                   from public.drivers where owner_id = :A), 'T2 perfil novo: WhatsApp normalizado e privado, contato direto DESLIGADO, sem selo/nota');
select pg_temp.ok(exists (select 1 from public.user_roles where user_id = :A and role = 'motorista'), 'T2 papel motorista atribuído');
\echo 'OK T2 WhatsApp obrigatório e cadastro novo'

-- T3 — Perfil existente (edição mantém id e slug) ---------------------------
create temp table t3_antes as select id, slug from public.drivers where owner_id = :A;
begin; select pg_temp.como(:A);
select public.salvar_perfil_motorista('Tio Zé da Van', null, 'aracatuba-sp', '18988887777', false);
commit;
select pg_temp.ok((select d.id = t.id and d.slug = t.slug and d.name = 'Tio Zé da Van' and d.description is null and d.whatsapp = '5518988887777'
                   from public.drivers d, t3_antes t where d.owner_id = :A), 'T3 edição mantém id/slug e atualiza campos');
\echo 'OK T3 perfil existente'

-- T4 — Cadastro duplicado ---------------------------------------------------
begin; select pg_temp.como(:A);
select pg_temp.recusa($q$insert into public.drivers (owner_id, slug, name, city_id) values ('11111111-1111-4111-8111-111111111111', 'outro-a', 'Outro', 'aracatuba-sp')$q$,
                      'T4 segundo perfil para a mesma conta (via API)');
commit;
select pg_temp.recusa($q$insert into public.drivers (owner_id, slug, name, city_id) values ('11111111-1111-4111-8111-111111111111', 'outro-a2', 'Outro', 'aracatuba-sp')$q$,
                      'T4 segundo perfil para a mesma conta (índice único)');
select pg_temp.ok((select count(*) from public.drivers where owner_id = :A) = 1, 'T4 nenhum perfil duplicado');
\echo 'OK T4 duplicado recusado'

-- T5 — Perfil publicado SEM rota disponível fica visível --------------------
begin; select pg_temp.como(:B);
select pg_temp.ok((public.salvar_perfil_motorista('Tio Zé', null, 'aracatuba-sp', '18977776666')->>'slug') like 'tio-ze-%', 'T5 slug único para nome repetido');
select public.publicar_perfil_motorista(true);
select pg_temp.ok((public.meu_perfil_motorista()->>'rotas_disponiveis')::int = 0, 'T5 B: rascunho e rota com van de outra conta não contam');
select pg_temp.ok((public.meu_perfil_motorista()->>'visivel')::boolean, 'T5 B publicado sem rota disponível fica visível');
commit;
begin; select pg_temp.anonimo();
select pg_temp.ok((select count(*) from public.public_listings where not is_demo) = 1, 'T5 vitrine mostra o perfil de B');
commit;
\echo 'OK T5 perfil publicado sem rota disponível'

-- T6 — Rota concluída disponível; pausa e retomada; rascunho fora -----------
begin; select pg_temp.como(:A);
select pg_temp.ok((public.meu_perfil_motorista()->>'rotas_disponiveis')::int = 1, 'T6 rota concluída com van própria disponível');
update public.routes set oferta_pausada = true where id = :ROTA_A;
select pg_temp.ok((public.meu_perfil_motorista()->>'rotas_disponiveis')::int = 0, 'T6 rota pausada não fica disponível');
commit;
select pg_temp.ok((select status = 'concluida' and oferta_pausada from public.routes where id = :ROTA_A), 'T6 pausar não vira rascunho');
select pg_temp.ok((select count(*) = 1 from public.route_passengers where route_id = :ROTA_A), 'T6 pausar não mexe nos passageiros');
begin; select pg_temp.como(:A);
update public.routes set oferta_pausada = false where id = :ROTA_A;
select pg_temp.ok((public.meu_perfil_motorista()->>'rotas_disponiveis')::int = 1, 'T6 retomar a oferta devolve a rota');
commit;
select pg_temp.ok((select status = 'rascunho' from public.routes where id = :ROTA_B_RASCUNHO), 'T6 rascunho continua rascunho (fora da busca)');
\echo 'OK T6 disponibilidade, pausa e retomada'

-- T7 — Editar passageiros de rota concluída preserva estado e pausa ---------
begin; select pg_temp.como(:A);
select public.salvar_rota_completa(pg_temp.rota_json(:ROTA_A, 'concluida',
  jsonb_build_object('id', 'aaaaaaaa-3333-4000-8000-000000000002', 'identificacao', 'Cliente de fora',
                     'board_stop_id', 'aaaaaaaa-2222-4000-8000-000000000001', 'alight_stop_id', 'aaaaaaaa-2222-4000-8000-000000000002')));
commit;
select pg_temp.ok((select count(*) = 2 from public.route_passengers where route_id = :ROTA_A), 'T7 passageiro de fora adicionado');
select pg_temp.ok((select status = 'concluida' and not oferta_pausada from public.routes where id = :ROTA_A), 'T7 adicionar mantém concluída e disponível');
update public.routes set oferta_pausada = true where id = :ROTA_A;  -- motorista pausa
begin; select pg_temp.como(:A);
select public.salvar_rota_completa(pg_temp.rota_json(:ROTA_A, 'concluida', null, 'Cliente de fora'));
commit;
select pg_temp.ok((select count(*) = 1 from public.route_passengers where route_id = :ROTA_A), 'T7 passageiro removido (vaga liberada)');
select pg_temp.ok((select status = 'concluida' and oferta_pausada from public.routes where id = :ROTA_A), 'T7 salvar a rota não desfaz a pausa');
update public.routes set oferta_pausada = false where id = :ROTA_A;
\echo 'OK T7 edição de passageiros'

-- T8 — Privacidade do WhatsApp ----------------------------------------------
begin; select pg_temp.como(:A); select public.publicar_perfil_motorista(true); commit;
begin; select pg_temp.anonimo();
select pg_temp.ok(pg_temp.vitrine_tem('tio-ze'), 'T8 perfil publicado aparece');
select pg_temp.ok((select not contato_whatsapp_ativo from public.public_listings where slug = 'tio-ze'), 'T8 vitrine informa contato desligado');
select pg_temp.recusa($q$select public.solicitar_contato_whatsapp('tio-ze', true)$q$, 'T8 contato direto DESATIVADO não entrega número');
commit;
begin; select pg_temp.como(:A); select public.salvar_perfil_motorista('Tio Zé da Van', null, 'aracatuba-sp', '18988887777', true); commit;
begin; select pg_temp.anonimo();
select pg_temp.ok(public.solicitar_contato_whatsapp('tio-ze', true) = '5518988887777', 'T8 contato ativo + perfil visível entrega o número');
commit;
begin; select pg_temp.como(:A); select public.publicar_perfil_motorista(false); commit;
begin; select pg_temp.anonimo();
select pg_temp.recusa($q$select public.solicitar_contato_whatsapp('tio-ze', true)$q$, 'T8 perfil despublicado não entrega número');
commit;
select pg_temp.ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'public_listings'
                              and column_name in ('whatsapp', 'owner_id', 'cpf', 'phone')), 'T8 vitrine sem telefone/dono/CPF');
begin; select pg_temp.como(:A); select public.publicar_perfil_motorista(true); commit;
\echo 'OK T8 privacidade do WhatsApp'

-- T9 — Isolamento entre contas ----------------------------------------------
begin; select pg_temp.como(:B);
update public.drivers set name = 'invadido', contato_whatsapp_ativo = false where slug = 'tio-ze';
delete from public.drivers where slug = 'tio-ze';
update public.routes set oferta_pausada = true where id = :ROTA_A;
select pg_temp.ok((select count(*) from public.drivers where owner_id = :A) = 0, 'T9 B não enxerga o perfil (nem o WhatsApp) de A');
select pg_temp.ok((select count(*) from public.routes where id = :ROTA_A) = 0, 'T9 B não enxerga a rota de A');
select pg_temp.recusa($q$select public.salvar_rota_completa(jsonb_build_object('id', 'aaaaaaaa-1111-4000-8000-000000000001', 'status', 'rascunho'))$q$,
                      'T9 B não salva a rota de A');
update public.drivers set doc_verified = true, rating_avg = 5, rating_count = 99, is_suspended = true, is_demo = true,
                          owner_id = '11111111-1111-4111-8111-111111111111', slug = 'roubado'
 where owner_id = :B;
commit;
select pg_temp.ok((select name = 'Tio Zé da Van' and contato_whatsapp_ativo from public.drivers where owner_id = :A), 'T9 perfil e contato de A intactos');
select pg_temp.ok((select status = 'concluida' and not oferta_pausada from public.routes where id = :ROTA_A), 'T9 rota de A intacta');
select pg_temp.ok((select not doc_verified and rating_avg = 0 and rating_count = 0 and not is_suspended and not is_demo and slug like 'tio-ze-%'
                   from public.drivers where owner_id = :B), 'T9 B não altera selo, nota, suspensão, demo, dono ou slug');
\echo 'OK T9 isolamento entre contas'

-- T10 — Anônimo não usa as RPCs de perfil -----------------------------------
begin; select pg_temp.anonimo();
select pg_temp.recusa($q$select public.salvar_perfil_motorista('X', null, 'aracatuba-sp', '18999990000')$q$, 'T10 anon salvar');
select pg_temp.recusa($q$select public.publicar_perfil_motorista(true)$q$, 'T10 anon publicar');
select pg_temp.recusa($q$select public.meu_perfil_motorista()$q$, 'T10 anon ler perfil');
select pg_temp.ok((select count(*) from public.routes where not is_demo) = 0, 'T10 anon não lê rotas reais');
commit;
\echo 'OK T10 anônimo bloqueado'

-- T11 — Validações ----------------------------------------------------------
begin; select pg_temp.como(:C);
select pg_temp.recusa($q$select public.salvar_perfil_motorista('Z', null, 'aracatuba-sp', '18999990000')$q$, 'T11 nome curto');
select pg_temp.recusa($q$select public.salvar_perfil_motorista('Zé Teste', null, 'cidade-x', '18999990000')$q$, 'T11 cidade inexistente');
select pg_temp.recusa($q$select public.salvar_perfil_motorista('Zé Teste', repeat('a', 601), 'aracatuba-sp', '18999990000')$q$, 'T11 apresentação longa');
select pg_temp.ok(public.meu_perfil_motorista() is null, 'T11 nada gravado após erros');
commit;
\echo 'OK T11 validações'

-- T12 — Demonstração e vitrine ----------------------------------------------
begin; select pg_temp.anonimo();
select pg_temp.ok((select count(*) from public.public_listings where is_demo) = 2, 'T12 demos visíveis inalterados (2)');
select pg_temp.ok(pg_temp.vitrine_tem('tio-joao') and not pg_temp.vitrine_tem('demo-suspenso'), 'T12 demo publicado aparece; suspenso não');
select pg_temp.recusa($q$select public.solicitar_contato_whatsapp('demo-suspenso', true)$q$, 'T12 contato de demo suspenso (como antes)');
select public.solicitar_contato_whatsapp('tio-joao', true);
commit;
select pg_temp.ok(not has_table_privilege('anon', 'public.public_listings', 'UPDATE')
                  and not has_table_privilege('authenticated', 'public.public_listings', 'INSERT'), 'T12 vitrine segue somente leitura');
\echo 'OK T12 demonstração e vitrine'

\echo 'OK — perfil real do motorista: todos os testes passaram'
