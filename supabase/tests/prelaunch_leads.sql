-- ============================================================================
-- Teste da migração 0018 (pré-lançamento — interessados)
-- ----------------------------------------------------------------------------
-- Como rodar: `supabase/tests/rodar-prelancamento-local.sh` (PostgreSQL LOCAL
-- descartável). Qualquer falha interrompe com erro. NÃO usar no banco real:
-- o teste grava contatos fictícios.
-- ============================================================================
\set ON_ERROR_STOP 1

-- Usuários de teste: um admin e um usuário comum.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'admin@teste.local'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'comum@teste.local')
on conflict do nothing;
insert into public.user_roles (user_id, role) values ('aaaaaaaa-0000-4000-8000-000000000001', 'admin')
on conflict do nothing;

create or replace function pg_temp.falha(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return null;                       -- não falhou
exception when others then
  return sqlstate;
end $$;

-- ---------------------------------------------------------------------------
-- A) Gravação pelo servidor (service_role) — motorista, família, validação
-- ---------------------------------------------------------------------------
set role service_role;
do $$
declare r jsonb; h text := repeat('a', 64); l public.prelaunch_leads;
begin
  r := public.registrar_interesse_lancamento('{"lead_type":"motorista","full_name":"  Carlos   Teste  Souza ","whatsapp_e164":"+5518998760001","email":"","consent_accepted":true,"privacy_policy_version":"2026-11-11","source":"site","street_address":"ignorar","school_name":"ignorar"}', h);
  assert r = '{"ok":true,"resultado":"criado"}', 'A1: motorista criado — ' || r;
  select * into l from public.prelaunch_leads where whatsapp_e164 = '+5518998760001' and lead_type = 'motorista';
  assert l.full_name = 'Carlos Teste Souza', 'A2: nome sem espaços excessivos';
  assert l.email is null, 'A3: e-mail vazio vira NULL (opcional)';
  assert l.street_address is null and l.school_name is null and l.city is null, 'A4: motorista não guarda endereço/escola';
  assert l.consent_accepted and l.consent_at is not null and l.privacy_policy_version = '2026-11-11', 'A5: consentimento registrado';
  assert l.status = 'novo' and l.source = 'site', 'A6: situação e origem padrão';

  r := public.registrar_interesse_lancamento('{"lead_type":"familia","full_name":"Ana Teste Lima","whatsapp_e164":"+5518998760002","email":"Ana@Exemplo.com","street_address":"Rua das Flores","address_number":"123a","neighborhood":"Centro","address_complement":"","city":"Araçatuba","state":"sp","school_name":"EE Exemplo","school_shift":"manha","transport_direction":"ida_volta","consent_accepted":true,"privacy_policy_version":"2026-11-11"}', h);
  assert r = '{"ok":true,"resultado":"criado"}', 'A7: família criada — ' || r;
  select * into l from public.prelaunch_leads where whatsapp_e164 = '+5518998760002';
  assert l.street_address = 'Rua das Flores' and l.address_number = '123A' and l.neighborhood = 'Centro', 'A8: endereço gravado';
  assert l.address_complement is null and l.city = 'Araçatuba' and l.state = 'SP', 'A9: complemento opcional; cidade/UF';
  assert l.school_name = 'EE Exemplo' and l.school_shift = 'manha' and l.transport_direction = 'ida_volta', 'A10: escola e período';
  assert l.email = 'ana@exemplo.com', 'A11: e-mail normalizado';

  -- Mesmo WhatsApp em perfis diferentes: permitido.
  r := public.registrar_interesse_lancamento('{"lead_type":"familia","full_name":"Carlos Teste Souza","whatsapp_e164":"+5518998760001","street_address":"Av. Brasil","address_number":"S/N","neighborhood":"Vila Nova","city":"Araçatuba","state":"SP","school_name":"EMEB Exemplo","school_shift":"tarde","consent_accepted":true,"privacy_policy_version":"2026-11-11"}', h);
  assert r->>'resultado' = 'criado', 'A12: mesmo WhatsApp como motorista E família';
  assert (select count(*) from public.prelaunch_leads where whatsapp_e164 = '+5518998760001') = 2, 'A13: duas inscrições, perfis diferentes';
end $$;

-- ---------------------------------------------------------------------------
-- B) Duplicidade no mesmo perfil: não duplica e não sobrescreve
-- ---------------------------------------------------------------------------
do $$
declare r jsonb; l public.prelaunch_leads;
begin
  r := public.registrar_interesse_lancamento('{"lead_type":"motorista","full_name":"Outro Nome Qualquer","whatsapp_e164":"+5518998760001","email":"novo@exemplo.com","consent_accepted":true,"privacy_policy_version":"2026-11-11"}', repeat('b', 64));
  assert r = '{"ok":true,"resultado":"reenviado"}', 'B1: reenvio tratado — ' || r;
  assert (select count(*) from public.prelaunch_leads where whatsapp_e164 = '+5518998760001' and lead_type = 'motorista') = 1, 'B2: sem linha duplicada';
  select * into l from public.prelaunch_leads where whatsapp_e164 = '+5518998760001' and lead_type = 'motorista';
  assert l.full_name = 'Carlos Teste Souza' and l.email is null, 'B3: dados originais NÃO sobrescritos';
  assert l.resubmitted_at is not null and l.last_resubmission->>'full_name' = 'Outro Nome Qualquer'
     and l.last_resubmission->>'email' = 'novo@exemplo.com', 'B4: reenvio guardado à parte para conferência';
  -- A resposta do reenvio não carrega nenhum dado do cadastro existente.
  assert (select array_agg(k order by k) from jsonb_object_keys(r) k) = array['ok','resultado'], 'B5: resposta sem dados pessoais';
end $$;

-- ---------------------------------------------------------------------------
-- C) Validação no banco (recusa sem gravar)
-- ---------------------------------------------------------------------------
do $$
declare r jsonb; antes int; h text := repeat('c', 64);
  base jsonb := '{"lead_type":"familia","full_name":"Bia Teste Rocha","whatsapp_e164":"+5518998760003","street_address":"Rua Um","address_number":"10","neighborhood":"Centro","city":"Araçatuba","state":"SP","school_name":"EE Exemplo","school_shift":"noite","consent_accepted":true,"privacy_policy_version":"2026-11-11"}';
  caso record;
begin
  select count(*) into antes from public.prelaunch_leads;
  for caso in select * from (values
    ('whatsapp_e164', '{"whatsapp_e164":"+551836221234"}'::jsonb),           -- fixo
    ('whatsapp_e164', '{"whatsapp_e164":"+5520998760003"}'),                 -- DDD inexistente
    ('whatsapp_e164', '{"whatsapp_e164":"18998760003"}'),                    -- sem E.164
    ('whatsapp_e164', '{"whatsapp_e164":"+5518998760003; drop table x"}'),
    ('email',         '{"email":"nao-e-email"}'),
    ('full_name',     '{"full_name":"Bia"}'),
    ('full_name',     '{"full_name":"Bia 123 Rocha"}'),
    ('consent_accepted', '{"consent_accepted":false}'),
    ('consent_accepted', '{"consent_accepted":"sim"}'),
    ('lead_type',     '{"lead_type":"admin"}'),
    ('street_address','{"street_address":""}'),
    ('address_number','{"address_number":"12 34"}'),
    ('neighborhood',  '{"neighborhood":" "}'),
    ('school_name',   '{"school_name":"ab"}'),
    ('school_shift',  '{"school_shift":"integral"}'),
    ('transport_direction', '{"transport_direction":"qualquer"}'),
    ('privacy_policy_version', '{"privacy_policy_version":""}')
  ) as t(campo, mudanca) loop
    -- hash próprio por caso: este bloco testa validação, não o limite de envios
    r := public.registrar_interesse_lancamento(base || caso.mudanca, md5(caso.campo || caso.mudanca::text) || md5(caso.mudanca::text));
    assert r->>'ok' = 'false' and r->>'erro' = 'invalido' and r->'campos' ? caso.campo,
      'C: esperado inválido em ' || caso.campo || ' — ' || r;
  end loop;
  assert (select count(*) from public.prelaunch_leads) = antes, 'C2: nada gravado em envios inválidos';

  r := public.registrar_interesse_lancamento(base, 'hash-invalido');
  assert r->>'erro' = 'invalido', 'C3: hash de IP malformado recusado';
  r := public.registrar_interesse_lancamento('[]'::jsonb, h);
  assert r->>'erro' = 'invalido', 'C4: payload que não é objeto recusado';
  r := public.registrar_interesse_lancamento(base - 'transport_direction', h);
  assert r->>'resultado' = 'criado', 'C5: família válida sem tipo de transporte (opcional)';
end $$;

-- ---------------------------------------------------------------------------
-- D) Limite de envios (dentro do banco)
-- ---------------------------------------------------------------------------
do $$
declare r jsonb; h text := repeat('d', 64); i int;
begin
  for i in 1..5 loop
    r := public.registrar_interesse_lancamento(jsonb_build_object('lead_type','motorista','full_name','Limite Teste Silva','whatsapp_e164','+55189987700' || lpad(i::text, 2, '0'),'consent_accepted',true,'privacy_policy_version','2026-11-11'), h);
    assert r->>'ok' = 'true', 'D1: envio ' || i || ' aceito — ' || r;
  end loop;
  r := public.registrar_interesse_lancamento('{"lead_type":"motorista","full_name":"Limite Teste Silva","whatsapp_e164":"+5518998770099","consent_accepted":true,"privacy_policy_version":"2026-11-11"}', h);
  assert r = '{"ok":false,"erro":"limite"}', 'D2: 6º envio em 10 min do mesmo visitante é bloqueado — ' || r;
  assert not exists (select 1 from public.prelaunch_leads where whatsapp_e164 = '+5518998770099'), 'D3: bloqueado não grava';
  r := public.registrar_interesse_lancamento('{"lead_type":"motorista","full_name":"Limite Teste Silva","whatsapp_e164":"+5518998770099","consent_accepted":true,"privacy_policy_version":"2026-11-11"}', repeat('e', 64));
  assert r->>'ok' = 'true', 'D4: outro visitante não é afetado';

  -- Janela: envios antigos deixam de contar e o registro técnico expira em 24 h.
  update public.prelaunch_submission_log set created_at = now() - interval '11 minutes' where ip_hash = h;
  r := public.registrar_interesse_lancamento('{"lead_type":"motorista","full_name":"Limite Teste Silva","whatsapp_e164":"+5518998770098","consent_accepted":true,"privacy_policy_version":"2026-11-11"}', h);
  assert r->>'ok' = 'true', 'D5: liberado após a janela de 10 min';
  update public.prelaunch_submission_log set created_at = now() - interval '25 hours' where ip_hash = h;
  perform public.registrar_interesse_lancamento('{"lead_type":"motorista","full_name":"Limite Teste Silva","whatsapp_e164":"+5518998770097","consent_accepted":true,"privacy_policy_version":"2026-11-11"}', repeat('f', 64));
  assert (select count(*) from public.prelaunch_submission_log where ip_hash = h) = 0, 'D6: registro técnico com mais de 24 h é apagado';
end $$;
reset role;

-- CHECKs da tabela valem até para quem escreve direto (última barreira).
do $$
begin
  assert pg_temp.falha($q$insert into public.prelaunch_leads (lead_type, full_name, whatsapp_e164, consent_accepted, privacy_policy_version) values ('motorista','Xis Teste','+5518998760009', false, 'v')$q$) = '23514', 'E1: sem consentimento não entra';
  assert pg_temp.falha($q$insert into public.prelaunch_leads (lead_type, full_name, whatsapp_e164, consent_accepted, privacy_policy_version) values ('familia','Xis Teste','+5518998760009', true, 'v')$q$) = '23514', 'E2: família sem endereço/escola não entra';
  assert pg_temp.falha($q$insert into public.prelaunch_leads (lead_type, full_name, whatsapp_e164, consent_accepted, privacy_policy_version) values ('motorista','Xis Teste','18998760009', true, 'v')$q$) = '23514', 'E3: WhatsApp fora do E.164 não entra';
  assert pg_temp.falha($q$insert into public.prelaunch_leads (lead_type, full_name, whatsapp_e164, consent_accepted, privacy_policy_version) values ('motorista','Carlos Teste Souza','+5518998760001', true, 'v')$q$) = '23505', 'E4: unicidade por perfil + WhatsApp';
end $$;

-- ---------------------------------------------------------------------------
-- F) Visitante (anon): nenhum acesso
-- ---------------------------------------------------------------------------
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
do $$
begin
  assert pg_temp.falha('select 1 from public.prelaunch_leads') = '42501', 'F1: anon não lê';
  assert pg_temp.falha('select count(*) from public.prelaunch_leads') = '42501', 'F2: anon não conta/lista';
  assert pg_temp.falha($q$insert into public.prelaunch_leads (lead_type, full_name, whatsapp_e164, consent_accepted, privacy_policy_version) values ('motorista','Xis Teste','+5518998760010', true, 'v')$q$) = '42501', 'F3: anon não insere direto';
  assert pg_temp.falha($q$update public.prelaunch_leads set status = 'descartado'$q$) = '42501', 'F4: anon não altera';
  assert pg_temp.falha('delete from public.prelaunch_leads') = '42501', 'F5: anon não apaga';
  assert pg_temp.falha($q$select public.registrar_interesse_lancamento('{}'::jsonb, repeat('a', 64))$q$) = '42501', 'F6: anon não executa a função de gravação';
  assert pg_temp.falha('select 1 from public.prelaunch_submission_log') = '42501', 'F7: anon não lê o registro técnico';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- G) Usuário autenticado comum (não admin): nada visível, nada alterável
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}', false);
do $$
declare n int;
begin
  assert (select count(*) from public.prelaunch_leads) = 0, 'G1: usuário comum não enxerga nenhuma inscrição';
  update public.prelaunch_leads set status = 'descartado'; get diagnostics n = row_count;
  assert n = 0, 'G2: usuário comum não altera';
  delete from public.prelaunch_leads; get diagnostics n = row_count;
  assert n = 0, 'G3: usuário comum não apaga';
  assert pg_temp.falha($q$insert into public.prelaunch_leads (lead_type, full_name, whatsapp_e164, consent_accepted, privacy_policy_version) values ('motorista','Xis Teste','+5518998760011', true, 'v')$q$) = '42501', 'G4: usuário comum não insere';
  assert pg_temp.falha($q$select public.registrar_interesse_lancamento('{}'::jsonb, repeat('a', 64))$q$) = '42501', 'G5: usuário comum não executa a função';
  assert pg_temp.falha('select 1 from public.prelaunch_submission_log') = '42501', 'G6: registro técnico inacessível';
end $$;

-- ---------------------------------------------------------------------------
-- H) Administrador: lista, muda a situação e exclui — nada além disso
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', false);
do $$
declare n int; antes timestamptz; depois timestamptz;
begin
  assert (select count(*) from public.prelaunch_leads) >= 4, 'H1: admin lista as inscrições';
  select updated_at into antes from public.prelaunch_leads where whatsapp_e164 = '+5518998760002';
  perform pg_sleep(0.01);
  update public.prelaunch_leads set status = 'contatado' where whatsapp_e164 = '+5518998760002'; get diagnostics n = row_count;
  assert n = 1, 'H2: admin muda a situação';
  select updated_at into depois from public.prelaunch_leads where whatsapp_e164 = '+5518998760002';
  assert depois > antes, 'H3: updated_at acompanha';
  assert pg_temp.falha($q$update public.prelaunch_leads set status = 'qualquer' where whatsapp_e164 = '+5518998760002'$q$) = '23514', 'H4: situação restrita aos valores previstos';
  assert pg_temp.falha($q$update public.prelaunch_leads set full_name = 'Alterado Indevido' where whatsapp_e164 = '+5518998760002'$q$) = '42501', 'H5: admin não edita dados do titular pela API';
  assert pg_temp.falha($q$update public.prelaunch_leads set whatsapp_e164 = '+5518998760077' where whatsapp_e164 = '+5518998760002'$q$) = '42501', 'H6: nem o contato';
  assert pg_temp.falha($q$insert into public.prelaunch_leads (lead_type, full_name, whatsapp_e164, consent_accepted, privacy_policy_version) values ('motorista','Xis Teste','+5518998760012', true, 'v')$q$) = '42501', 'H7: admin não cria inscrição direto na tabela';
  delete from public.prelaunch_leads where whatsapp_e164 = '+5518998760002'; get diagnostics n = row_count;
  assert n = 1, 'H8: admin exclui (pedido do titular)';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- I) Estrutura: RLS ligada, sem política para anon, função restrita
-- ---------------------------------------------------------------------------
do $$
begin
  assert (select relrowsecurity from pg_class where oid = 'public.prelaunch_leads'::regclass), 'I1: RLS ligada (leads)';
  assert (select relrowsecurity from pg_class where oid = 'public.prelaunch_submission_log'::regclass), 'I2: RLS ligada (registro técnico)';
  assert not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prelaunch_leads'
                     and (roles && array['anon','public']::name[] or cmd = 'INSERT')), 'I3: nenhuma política para anon nem de INSERT';
  assert not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prelaunch_submission_log'), 'I4: registro técnico sem políticas';
  assert not has_function_privilege('anon', 'public.registrar_interesse_lancamento(jsonb, text)', 'execute'), 'I5: função fechada para anon';
  assert not has_function_privilege('authenticated', 'public.registrar_interesse_lancamento(jsonb, text)', 'execute'), 'I6: função fechada para authenticated';
  assert has_function_privilege('service_role', 'public.registrar_interesse_lancamento(jsonb, text)', 'execute'), 'I7: função aberta só ao servidor';
  assert not has_table_privilege('anon', 'public.prelaunch_leads', 'select'), 'I8: anon sem privilégio de leitura';
end $$;

select 'prelaunch_leads: todos os testes aprovados' as resultado;
