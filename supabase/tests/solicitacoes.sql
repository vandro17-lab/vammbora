-- ============================================================================
-- TESTE das solicitações das famílias (banco LOCAL descartável).
-- Pré-requisito: migrações aplicadas + tests/local/20_perfil_motorista_dados.sql
-- (usa as contas A, B e C e a escola 'esc-teste').
-- ============================================================================
\set ON_ERROR_STOP 1
set client_min_messages = notice;

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
create function pg_temp.recusa(cmd text, m text) returns void language plpgsql as $$
begin
  begin
    execute cmd;
  exception when others then
    return;
  end;
  raise exception 'FALHA (deveria ter sido recusado): %', m;
end $$;
-- Insere uma solicitação válida como o app faz (owner = conta logada).
create function pg_temp.nova(p_chave uuid, p_sentido text default 'ida', p_status text default 'ativa') returns uuid language sql as $$
  insert into public.transport_requests (owner_id, chave_envio, city_id, destination_id, origem_endereco, origem_lat, origem_lng,
    sentido, horario_ida_min, horario_volta_min, status)
  values (auth.uid(), p_chave, 'aracatuba-sp', 'esc-teste', 'Rua das Flores, 120 — Centro', -21.20345, -50.43912,
    p_sentido, case when p_sentido <> 'volta' then 420 end, case when p_sentido <> 'ida' then 750 end, p_status)
  on conflict (owner_id, chave_envio) do nothing
  returning id
$$;

\set A '''11111111-1111-4111-8111-111111111111'''
\set B '''22222222-2222-4222-8222-222222222222'''
\set CH1 '''c0000000-0000-4000-8000-000000000001'''

-- S1 — anônimo não lê nem cria -------------------------------------------------
begin; select pg_temp.anonimo();
select pg_temp.recusa('select count(*) from public.transport_requests', 'S1 anon lê solicitações');
select pg_temp.recusa($q$insert into public.transport_requests (owner_id, chave_envio, city_id, destination_id, origem_endereco, origem_lat, origem_lng, sentido, horario_ida_min)
  values ('11111111-1111-4111-8111-111111111111', gen_random_uuid(), 'aracatuba-sp', 'esc-teste', 'Rua X, 1', -21.2, -50.4, 'ida', 420)$q$, 'S1 anon cria');
commit;
\echo 'OK S1 anônimo sem acesso'

-- S2 — criação, status forçado, ponto aproximado e envio repetido ------------
begin; select pg_temp.como(:A);
select pg_temp.ok(pg_temp.nova(:CH1::uuid, 'ida', 'encerrada') is not null, 'S2 cria');
select pg_temp.ok(pg_temp.nova(:CH1::uuid) is null, 'S2 envio repetido não cria outra');
commit;
select pg_temp.ok((select count(*) = 1 from public.transport_requests where owner_id = :A), 'S2 uma solicitação só');
select pg_temp.ok((select status = 'ativa' and encerrada_em is null from public.transport_requests where owner_id = :A), 'S2 nasce ativa (status enviado ignorado)');
select pg_temp.ok((select origem_lat_aprox = -21.205 and origem_lng_aprox = -50.44 from public.transport_requests where owner_id = :A), 'S2 ponto aproximado em grade');
select pg_temp.ok((select quantidade_alunos = 1 from public.transport_requests where owner_id = :A), 'S2 sem informar, 1 aluno');
\echo 'OK S2 criação e envio repetido'

-- S3 — validações -------------------------------------------------------------
begin; select pg_temp.como(:A);
select pg_temp.recusa($q$insert into public.transport_requests (owner_id, chave_envio, city_id, destination_id, origem_endereco, origem_lat, origem_lng, sentido)
  values (auth.uid(), gen_random_uuid(), 'aracatuba-sp', 'esc-teste', 'Rua das Flores, 120', -21.2, -50.4, 'ida')$q$, 'S3 sem horário da ida');
select pg_temp.recusa($q$insert into public.transport_requests (owner_id, chave_envio, city_id, destination_id, origem_endereco, origem_lat, origem_lng, sentido, horario_ida_min)
  values (auth.uid(), gen_random_uuid(), 'aracatuba-sp', 'esc-teste', 'Rua das Flores, 120', -21.2, -50.4, 'ambos', 420)$q$, 'S3 ida e volta sem horário da volta');
select pg_temp.recusa($q$insert into public.transport_requests (owner_id, chave_envio, city_id, destination_id, origem_endereco, origem_lat, origem_lng, sentido, horario_ida_min)
  values (auth.uid(), gen_random_uuid(), 'aracatuba-sp', 'escola-que-nao-existe', 'Rua das Flores, 120', -21.2, -50.4, 'ida', 420)$q$, 'S3 escola inexistente');
select pg_temp.recusa($q$insert into public.transport_requests (owner_id, chave_envio, city_id, destination_id, origem_endereco, origem_lat, origem_lng, sentido, horario_ida_min)
  values (auth.uid(), gen_random_uuid(), 'aracatuba-sp', 'esc-teste', 'Rua das Flores, 120', 48.8, 2.3, 'ida', 420)$q$, 'S3 coordenada fora do Brasil');
select pg_temp.recusa($q$insert into public.transport_requests (owner_id, chave_envio, city_id, destination_id, origem_endereco, origem_lat, origem_lng, sentido, horario_ida_min, observacoes)
  values (auth.uid(), gen_random_uuid(), 'aracatuba-sp', 'esc-teste', 'Rua das Flores, 120', -21.2, -50.4, 'ida', 420, repeat('a', 501))$q$, 'S3 observação longa');
select pg_temp.recusa($q$insert into public.transport_requests (owner_id, chave_envio, city_id, destination_id, origem_endereco, origem_lat, origem_lng, sentido, horario_ida_min, etapa_ensino)
  values (auth.uid(), gen_random_uuid(), 'aracatuba-sp', 'esc-teste', 'Rua das Flores, 120', -21.2, -50.4, 'ida', 420, 'pos_doutorado')$q$, 'S3 etapa inválida');
commit;
select pg_temp.recusa($q$insert into public.transport_requests (owner_id, chave_envio, city_id, destination_id, origem_endereco, origem_lat, origem_lng, sentido, horario_ida_min)
  values (auth.uid(), gen_random_uuid(), 'aracatuba-sp', 'esc-teste', 'Av. Paulista, 1000', -23.56, -46.65, 'ida', 420)$q$, 'S3 ponto fora da cidade da solicitação');
select pg_temp.recusa($q$insert into public.transport_requests (owner_id, chave_envio, city_id, destination_id, origem_endereco, origem_lat, origem_lng, sentido, horario_ida_min, quantidade_alunos)
  values (auth.uid(), gen_random_uuid(), 'aracatuba-sp', 'esc-teste', 'Rua das Flores, 120', -21.2, -50.4, 'ida', 420, 0)$q$, 'S3 zero alunos');
select pg_temp.recusa($q$insert into public.transport_requests (owner_id, chave_envio, city_id, destination_id, origem_endereco, origem_lat, origem_lng, sentido, horario_ida_min, quantidade_alunos)
  values (auth.uid(), gen_random_uuid(), 'aracatuba-sp', 'esc-teste', 'Rua das Flores, 120', -21.2, -50.4, 'ida', 420, 9)$q$, 'S3 alunos acima do limite');
\echo 'OK S3 validações'

-- S4 — edição pela dona; campos protegidos ------------------------------------
begin; select pg_temp.como(:A);
update public.transport_requests set observacoes = 'Prefere sair às 6h30', etapa_ensino = 'fundamental_1', precisa_acessibilidade = true,
  owner_id = '22222222-2222-4222-8222-222222222222', chave_envio = gen_random_uuid() where owner_id = auth.uid();
commit;
select pg_temp.ok((select observacoes = 'Prefere sair às 6h30' and etapa_ensino = 'fundamental_1' and precisa_acessibilidade
                   and owner_id = :A and chave_envio = :CH1::uuid and updated_at >= created_at
                   from public.transport_requests where chave_envio = :CH1::uuid), 'S4 edita; dono e chave não mudam');
begin; select pg_temp.como(:A);
update public.transport_requests set quantidade_alunos = 3 where owner_id = auth.uid();
select pg_temp.ok((select quantidade_alunos = 3 from public.transport_requests where owner_id = auth.uid()), 'S4 informa 3 alunos (irmãos)');
select pg_temp.recusa($q$update public.transport_requests set origem_lat = -23.56, origem_lng = -46.65 where owner_id = auth.uid()$q$, 'S4 mover o ponto para fora da cidade');
commit;
\echo 'OK S4 edição'

-- S5 — pausar, reativar, encerrar (final) -------------------------------------
begin; select pg_temp.como(:A);
update public.transport_requests set status = 'pausada' where owner_id = auth.uid();
select pg_temp.ok((select status = 'pausada' from public.transport_requests where owner_id = auth.uid()), 'S5 pausa');
update public.transport_requests set status = 'ativa' where owner_id = auth.uid();
select pg_temp.ok((select status = 'ativa' from public.transport_requests where owner_id = auth.uid()), 'S5 reativa');
update public.transport_requests set status = 'encerrada', motivo_encerramento = 'contratou_fora' where owner_id = auth.uid();
select pg_temp.ok((select status = 'encerrada' and encerrada_em is not null and motivo_encerramento = 'contratou_fora'
                   from public.transport_requests where owner_id = auth.uid()), 'S5 encerra com motivo e data');
select pg_temp.recusa($q$update public.transport_requests set status = 'ativa' where owner_id = auth.uid()$q$, 'S5 reabrir encerrada');
select pg_temp.recusa($q$update public.transport_requests set observacoes = 'x' where owner_id = auth.uid()$q$, 'S5 editar encerrada');
commit;
select pg_temp.ok((select count(*) = 0 from public.transport_requests where status = 'ativa' and owner_id = :A), 'S5 encerrada não fica ativa');
\echo 'OK S5 pausa, reativação e encerramento'

-- S6 — isolamento entre famílias ----------------------------------------------
begin; select pg_temp.como(:A); select pg_temp.nova('c0000000-0000-4000-8000-000000000002'::uuid, 'ambos'); commit;
begin; select pg_temp.como(:B);
select pg_temp.ok((select count(*) from public.transport_requests) = 0, 'S6 B não vê as de A');
update public.transport_requests set observacoes = 'invadido', status = 'encerrada' where owner_id = :A;
select pg_temp.recusa($q$insert into public.transport_requests (owner_id, chave_envio, city_id, destination_id, origem_endereco, origem_lat, origem_lng, sentido, horario_ida_min)
  values ('11111111-1111-4111-8111-111111111111', gen_random_uuid(), 'aracatuba-sp', 'esc-teste', 'Rua das Flores, 120', -21.2, -50.4, 'ida', 420)$q$, 'S6 B cria em nome de A');
select pg_temp.ok(pg_temp.nova('c0000000-0000-4000-8000-000000000002'::uuid) is not null, 'S6 mesma chave em OUTRA conta é outra solicitação');
commit;
select pg_temp.ok((select status = 'ativa' and observacoes is null from public.transport_requests where chave_envio = 'c0000000-0000-4000-8000-000000000002'::uuid and owner_id = :A), 'S6 solicitação de A intacta');
\echo 'OK S6 isolamento entre famílias'

-- S7 — ninguém apaga pela API ---------------------------------------------------
begin; select pg_temp.como(:A);
select pg_temp.recusa('delete from public.transport_requests where owner_id = auth.uid()', 'S7 apagar');
commit;
\echo 'OK S7 sem exclusão'

-- S8 — limite de 10 abertas por conta -----------------------------------------
begin; select pg_temp.como(:B);
select pg_temp.nova(gen_random_uuid()) from generate_series(1, 9);
select pg_temp.ok((select count(*) = 10 from public.transport_requests where status in ('ativa', 'pausada')), 'S8 dez abertas');
select pg_temp.recusa('select pg_temp.nova(gen_random_uuid())', 'S8 décima primeira');
select pg_temp.ok(pg_temp.nova((select chave_envio from public.transport_requests order by created_at desc limit 1)) is null, 'S8 reenviar o mesmo pedido no limite não dá erro nem duplica');
select pg_temp.ok((select count(*) = 10 from public.transport_requests where status in ('ativa', 'pausada')), 'S8 continuam dez');
update public.transport_requests set status = 'encerrada' where id = (select id from public.transport_requests order by created_at limit 1);
select pg_temp.ok(pg_temp.nova(gen_random_uuid()) is not null, 'S8 encerrar libera uma nova');
commit;
\echo 'OK S8 limite de solicitações abertas'

-- S9 — vitrine e privilégios ----------------------------------------------------
select pg_temp.ok(not has_table_privilege('anon', 'public.transport_requests', 'SELECT'), 'S9 anon sem SELECT');
select pg_temp.ok(not has_table_privilege('authenticated', 'public.transport_requests', 'DELETE'), 'S9 sem DELETE');
select pg_temp.ok(not has_function_privilege('authenticated', 'public.proteger_solicitacao()', 'EXECUTE'), 'S9 gatilho fora da API');
select pg_temp.ok(not has_table_privilege('anon', 'public.public_listings', 'UPDATE'), 'S9 vitrine segue somente leitura');
select pg_temp.ok(not exists (select 1 from information_schema.view_table_usage where table_schema = 'public' and table_name = 'transport_requests'), 'S9 nenhuma view sobre solicitações');
select pg_temp.ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosrc ilike '%transport_requests%' and p.proname <> 'proteger_solicitacao'), 'S9 nenhuma função lê solicitações');
\echo 'OK S9 privilégios'

-- S10 — motorista não vê endereços das famílias ----------------------------------
insert into public.user_roles (user_id, role) values ('33333333-3333-4333-8333-333333333333', 'motorista') on conflict do nothing;
begin; select pg_temp.como('33333333-3333-4333-8333-333333333333');
select pg_temp.ok((select count(*) from public.transport_requests) = 0, 'S10 motorista não lê solicitações');
select pg_temp.ok((select count(*) from public.public_listings l where l::text ilike '%Rua das Flores%') = 0, 'S10 vitrine não contém endereços de famílias');
commit;
begin; select pg_temp.anonimo();
select pg_temp.ok((select count(*) from public.public_listings l where l::text ilike '%Rua das Flores%') = 0, 'S10 consulta pública não contém endereços de famílias');
commit;
\echo 'OK S10 endereços privados'

\echo 'OK — solicitações das famílias: todos os testes passaram'
