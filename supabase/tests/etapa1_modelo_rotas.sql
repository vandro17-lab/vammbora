-- ============================================================================
-- Teste da migração 0015 (busca e encaixe, etapa 1 — modelo de dados das rotas)
-- ----------------------------------------------------------------------------
-- Como rodar: `supabase/tests/rodar-local.sh` (PostgreSQL LOCAL descartável).
-- Pressupõe os dados de `tests/local/10_dados_legados.sql`, gravados ANTES da
-- 0015. Qualquer falha interrompe com erro (assert). Não usar no banco real.
-- ============================================================================
\set ON_ERROR_STOP 1

-- ---------------------------------------------------------------------------
-- A) Cadastro antigo: nada perdido, nada inventado
-- ---------------------------------------------------------------------------
do $$
declare r public.routes; s public.route_stops; p public.route_passengers;
begin
  select * into r from public.routes where id = '99999999-9999-4999-8999-999999999999';
  assert r.turno = 'manha' and r.direction = 'ida' and r.last_dropoff_min = 420, 'A1: dados antigos da rota preservados';
  assert r.habitual_departure_min is null, 'A2: saída habitual NÃO inventada';
  assert r.early_leave_limit_min is null, 'A3: antecipação NÃO inventada';
  assert r.turno_confirmed = false, 'A4: período antigo fica "a confirmar"';
  assert r.availability_reviewed = false, 'A5: disponibilidade antiga fica "não informada"';
  assert not exists (select 1 from public.route_school_availability), 'A6: nenhuma escola autorizada por suposição';

  select * into s from public.route_stops where id = '99999999-0000-4000-8000-000000000002';
  assert s.destination_id = 'esc-a' and s.habitual_arrival_min = 415, 'A7: escola antiga preservada';
  assert s.arrival_deadline_min is null and s.release_time_min is null and s.group_service_min is null,
    'A8: limite/liberação/tempo do grupo NÃO copiados do horário habitual';
  assert s.gate_custom = false, 'A9: portão específico não presumido';

  select * into p from public.route_passengers where id = '99999999-1111-4111-8111-000000000001';
  assert p.atendimento_min = 2 and p.horario_habitual_min = 400, 'A10: atendimento inteiro preservado na troca de tipo';
  assert p.ajuste_antes_min is null and p.ajuste_depois_min is null, 'A11: flexibilidade ausente continua ausente';
  assert (select data_type from information_schema.columns
          where table_name = 'route_passengers' and column_name = 'atendimento_min') = 'numeric', 'A12: atendimento aceita fração';
end $$;

-- ---------------------------------------------------------------------------
-- B) RPC como o motorista dono (papel authenticated + RLS)
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', false);

-- B1) App ANTIGO salva a rota antiga (sem as chaves novas): nada novo é apagado.
reset role;
update public.routes set habitual_departure_min = 380, turno_confirmed = true, availability_reviewed = true
  where id = '99999999-9999-4999-8999-999999999999';
update public.route_stops set arrival_deadline_min = 425, group_service_min = 1.5, gate_custom = true
  where id = '99999999-0000-4000-8000-000000000002';
insert into public.route_school_availability (route_id, destination_id) values ('99999999-9999-4999-8999-999999999999', 'esc-b');
set role authenticated;

select public.salvar_rota_completa('{
  "id":"99999999-9999-4999-8999-999999999999","name":"Antiga","direction":"ida","turno":"manha","days":["seg","ter"],
  "vehicle_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","last_dropoff_min":420,"status":"concluida",
  "stops":[
    {"id":"99999999-0000-4000-8000-000000000000","ordem":0,"type":"saida","label":"Garagem","lat":-21.19,"lng":-50.42,"confirmed":true},
    {"id":"99999999-0000-4000-8000-000000000001","ordem":1,"type":"casa","label":"Rua 1, 10","lat":-21.195,"lng":-50.425,"confirmed":true,"habitual_arrival_min":400},
    {"id":"99999999-0000-4000-8000-000000000002","ordem":2,"type":"escola","label":"Escola A","lat":-21.2,"lng":-50.43,"confirmed":true,"destination_id":"esc-a","habitual_arrival_min":415}],
  "passengers":[{"id":"99999999-1111-4111-8111-000000000001","identificacao":"Ana",
    "board_stop_id":"99999999-0000-4000-8000-000000000001","alight_stop_id":"99999999-0000-4000-8000-000000000002",
    "destination_id":"esc-a","horario_habitual_min":400,"atendimento_min":2,"atendimento_origem":"informado"}]
}'::jsonb);

do $$
declare r public.routes; s public.route_stops;
begin
  select * into r from public.routes where id = '99999999-9999-4999-8999-999999999999';
  assert r.habitual_departure_min = 380 and r.turno_confirmed and r.availability_reviewed, 'B1a: app antigo não apaga campos novos da rota';
  select * into s from public.route_stops where id = '99999999-0000-4000-8000-000000000002';
  assert s.arrival_deadline_min = 425 and s.group_service_min = 1.5 and s.gate_custom, 'B1b: app antigo não apaga campos novos da escola';
  assert s.habitual_arrival_min = 415, 'B1c: horário habitual da parada é gravado pela RPC';
  assert (select count(*) from public.route_school_availability where route_id = r.id) = 1, 'B1d: app antigo não apaga a disponibilidade';
end $$;

-- B2) App NOVO cria uma rota de VOLTA do período da MANHÃ, com tudo preenchido.
select public.salvar_rota_completa('{
  "id":null,"name":"Volta do meio-dia","direction":"volta","turno":"manha","turno_confirmed":true,"days":["seg","ter","qua"],
  "vehicle_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","habitual_departure_min":715,"early_leave_limit_min":0,
  "last_dropoff_min":780,"availability_reviewed":true,"status":"concluida",
  "stops":[
    {"id":"77777777-0000-4000-8000-000000000000","ordem":0,"type":"saida","label":"Garagem","lat":-21.19,"lng":-50.42,"confirmed":true},
    {"id":"77777777-0000-4000-8000-000000000001","ordem":1,"type":"escola","label":"Escola A","lat":-21.2001,"lng":-50.4302,"confirmed":true,
     "destination_id":"esc-a","gate_custom":true,"release_time_min":720,"group_service_min":0.5,"arrival_deadline_min":null},
    {"id":"77777777-0000-4000-8000-000000000002","ordem":2,"type":"casa","label":"Rua 1, 10","lat":-21.195,"lng":-50.425,"confirmed":true}],
  "passengers":[
    {"id":"77777777-1111-4111-8111-000000000001","identificacao":"Ana","board_stop_id":"77777777-0000-4000-8000-000000000001",
     "alight_stop_id":"77777777-0000-4000-8000-000000000002","destination_id":"esc-a",
     "horario_habitual_min":740,"ajuste_antes_min":0,"ajuste_depois_min":5,"atendimento_min":0.5,"atendimento_origem":"informado"},
    {"id":"77777777-1111-4111-8111-000000000002","identificacao":"Bia","board_stop_id":"77777777-0000-4000-8000-000000000001",
     "alight_stop_id":"77777777-0000-4000-8000-000000000002","destination_id":"esc-a",
     "horario_habitual_min":null,"ajuste_antes_min":null,"ajuste_depois_min":null,"atendimento_min":0,"atendimento_origem":"informado"}],
  "school_availability":[
    {"destination_id":"esc-b","days":["seg","qua"],"release_time_min":725,"group_service_min":2},
    {"destination_id":"esc-c","days":null,"gate_lat":-21.2201,"gate_lng":-50.4502}]
}'::jsonb) as nova_rota \gset

do $$
declare r public.routes; s public.route_stops; a public.route_passengers; b public.route_passengers; n int;
begin
  select * into r from public.routes where name = 'Volta do meio-dia';
  assert r.direction = 'volta' and r.turno = 'manha' and r.turno_confirmed, 'B2a: volta do período da manhã, confirmada';
  assert r.habitual_departure_min = 715, 'B2b: saída habitual';
  assert r.early_leave_limit_min = 0, 'B2c: antecipação ZERO é diferente de ausente';
  assert r.last_dropoff_min = 780, 'B2d: limite do ponto final preservado';

  select * into s from public.route_stops where id = '77777777-0000-4000-8000-000000000001';
  assert s.destination_id = 'esc-a' and s.gate_custom and s.lat = -21.2001, 'B2e: portão específico mantém o ID da unidade';
  assert s.release_time_min = 720 and s.group_service_min = 0.5 and s.arrival_deadline_min is null, 'B2f: liberação e tempo do grupo (30 s)';

  select * into a from public.route_passengers where id = '77777777-1111-4111-8111-000000000001';
  select * into b from public.route_passengers where id = '77777777-1111-4111-8111-000000000002';
  assert a.atendimento_min = 0.5 and a.ajuste_antes_min = 0 and a.ajuste_depois_min = 5, 'B2g: atendimento de 30 s e flexibilidade 0/5';
  assert b.atendimento_min = 0 and b.ajuste_antes_min is null and b.horario_habitual_min is null, 'B2h: zero informado x ausente';

  select count(*) into n from public.route_school_availability where route_id = r.id;
  assert n = 2, 'B2i: duas escolas disponíveis';
  assert (select days from public.route_school_availability where route_id = r.id and destination_id = 'esc-b') = '{seg,qua}', 'B2j: dias da disponibilidade';
  assert (select days is null and gate_lat = -21.2201 from public.route_school_availability where route_id = r.id and destination_id = 'esc-c'), 'B2k: todos os dias + portão';
  -- Escola apenas disponível NÃO vira parada.
  assert (select count(*) from public.route_stops where route_id = r.id) = 3, 'B2l: disponibilidade não cria parada';
  assert not exists (select 1 from public.route_stops where route_id = r.id and destination_id in ('esc-b','esc-c')), 'B2m: idem';
  -- A disponibilidade é DESTA rota: a outra rota do motorista continua só com a dela.
  assert (select count(*) from public.route_school_availability where route_id = '99999999-9999-4999-8999-999999999999') = 1, 'B2n: disponibilidade não vaza entre rotas';
end $$;

-- B3) Lista de disponibilidade enviada vazia = apagada (revisada e vazia).
select public.salvar_rota_completa(
  (select jsonb_build_object('id', r.id, 'name', r.name, 'direction', r.direction, 'turno', r.turno, 'turno_confirmed', true,
     'days', to_jsonb(r.days), 'vehicle_id', r.vehicle_id, 'status', 'rascunho', 'availability_reviewed', true,
     'stops', '[]'::jsonb, 'passengers', '[]'::jsonb, 'school_availability', '[]'::jsonb)
   from public.routes r where r.name = 'Volta do meio-dia'));
do $$ begin
  assert not exists (select 1 from public.route_school_availability a join public.routes r on r.id = a.route_id where r.name = 'Volta do meio-dia'),
    'B3: lista vazia enviada apaga a disponibilidade';
end $$;

-- B4) Regras recusadas pelo banco.
do $$
declare ok boolean;
begin
  ok := false;
  begin
    perform public.salvar_rota_completa('{"id":null,"name":"x","direction":"ida","status":"concluida",
      "stops":[{"ordem":0,"type":"escola","label":"Escola sem catálogo","confirmed":true}],"passengers":[]}'::jsonb);
  exception when others then ok := true; end;
  assert ok, 'B4a: rota concluída com escola fora do catálogo é recusada';

  ok := false;
  begin
    perform public.salvar_rota_completa('{"id":null,"name":"x","direction":"ida","status":"rascunho","stops":[],"passengers":[],
      "school_availability":[{"destination_id":"escola-inexistente"}]}'::jsonb);
  exception when foreign_key_violation then ok := true; end;
  assert ok, 'B4b: disponibilidade só aceita escola do catálogo';

  ok := false;
  begin
    perform public.salvar_rota_completa('{"id":null,"name":"x","direction":"ida","status":"rascunho","stops":[],"passengers":[],
      "school_availability":[{"destination_id":"esc-a","days":["feriado"]}]}'::jsonb);
  exception when check_violation then ok := true; end;
  assert ok, 'B4c: dia inválido recusado';

  ok := false;
  begin
    perform public.salvar_rota_completa('{"id":null,"name":"x","direction":"ida","status":"rascunho","habitual_departure_min":1500,"stops":[],"passengers":[]}'::jsonb);
  exception when check_violation then ok := true; end;
  assert ok, 'B4d: horário de saída fora do dia recusado';
end $$;

-- ---------------------------------------------------------------------------
-- C) RLS: outro motorista e o público não enxergam a disponibilidade
-- ---------------------------------------------------------------------------
do $$ begin
  assert (select count(*) from public.route_school_availability) = 1, 'C1: dono vê a própria disponibilidade';
end $$;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', false);
do $$
declare ok boolean := false;
begin
  assert (select count(*) from public.route_school_availability) = 0, 'C2: outro motorista não vê';
  begin
    insert into public.route_school_availability (route_id, destination_id) values ('99999999-9999-4999-8999-999999999999', 'esc-c');
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'C3: outro motorista não grava na rota alheia';
  ok := false;
  begin
    perform public.salvar_rota_completa('{"id":"99999999-9999-4999-8999-999999999999","name":"invadida","stops":[],"passengers":[],"school_availability":[]}'::jsonb);
  exception when others then ok := true; end;
  assert ok, 'C4: RPC recusa rota de outro dono';
end $$;
set role anon;
select set_config('request.jwt.claims', '', false);
do $$ begin
  assert (select count(*) from public.route_school_availability) = 0, 'C5: público não vê disponibilidade de rota real';
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.route_school_availability where route_id = '99999999-9999-4999-8999-999999999999') = 1,
    'C6: tentativa de invasão não alterou nada';
end $$;

select 'etapa1_modelo_rotas: todos os testes passaram' as resultado;
