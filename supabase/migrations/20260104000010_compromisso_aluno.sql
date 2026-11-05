-- ============================================================================
-- Vambora — Migração 0010: compromisso de atendimento por aluno (Fase 2)
-- ----------------------------------------------------------------------------
-- ADITIVA e NÃO destrutiva. Acrescenta à tabela route_passengers os campos do
-- compromisso individual de cada aluno (DEC-012, DEC-020..023): horário habitual,
-- tolerância antes/depois, tempo de atendimento e a origem da estimativa.
-- Tudo NULLABLE: linha sem valor = NÃO informado (nunca "confirmado pelo motorista").
-- Também atualiza a RPC salvar_rota_completa para persistir esses campos
-- (retrocompatível: payload antigo sem as chaves grava NULL).
-- NÃO apaga dados. NÃO altera RLS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Colunas do compromisso (em route_passengers — o vínculo aluno↔rota↔parada)
-- ----------------------------------------------------------------------------
alter table public.route_passengers
  add column if not exists horario_habitual_min int,
  add column if not exists ajuste_antes_min     int,
  add column if not exists ajuste_depois_min    int,
  add column if not exists atendimento_min       int,
  add column if not exists atendimento_origem    text;

do $$ begin
  alter table public.route_passengers add constraint route_passengers_horario_habitual_chk
    check (horario_habitual_min is null or (horario_habitual_min >= 0 and horario_habitual_min < 1440));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.route_passengers add constraint route_passengers_ajuste_antes_chk
    check (ajuste_antes_min is null or (ajuste_antes_min >= 0 and ajuste_antes_min <= 120));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.route_passengers add constraint route_passengers_ajuste_depois_chk
    check (ajuste_depois_min is null or (ajuste_depois_min >= 0 and ajuste_depois_min <= 120));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.route_passengers add constraint route_passengers_atendimento_chk
    check (atendimento_min is null or (atendimento_min >= 0 and atendimento_min <= 60));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.route_passengers add constraint route_passengers_atendimento_origem_chk
    check (atendimento_origem is null or atendimento_origem in ('informado','provisorio','desconhecido'));
exception when duplicate_object then null; end $$;

comment on column public.route_passengers.horario_habitual_min is
  'Minuto do dia (0..1439) do horário habitual de atendimento do aluno neste sentido (ida: embarque na casa; volta: desembarque na casa). NULL = não informado. Difere de drivers.boarding_time (padrão do motorista) e de routes.last_dropoff_min (limite da rota).';
comment on column public.route_passengers.ajuste_antes_min is
  'Tolerância, em minutos, ANTES do horário habitual deste aluno (DEC-006/DEC-012). Fixo = 0. NULL = não informado.';
comment on column public.route_passengers.ajuste_depois_min is
  'Tolerância, em minutos, DEPOIS do horário habitual deste aluno (DEC-006/DEC-012). Fixo = 0. NULL = não informado.';
comment on column public.route_passengers.atendimento_min is
  'Duração do atendimento do aluno na parada, em minutos (DEC-020..023). NULL = desconhecido. Regra de consolidação quando vários alunos partilham a parada: soma SEQUENCIAL (não presumir embarque simultâneo), cada evento contado UMA vez.';
comment on column public.route_passengers.atendimento_origem is
  'Origem de atendimento_min: informado | provisorio | desconhecido. NUNCA apresentar provisorio/NULL como confirmado pelo motorista.';

-- ----------------------------------------------------------------------------
-- 2) RPC salvar_rota_completa: persistir os novos campos (retrocompatível)
--    (CREATE OR REPLACE a partir da definição vigente, só acrescentando campos)
-- ----------------------------------------------------------------------------
create or replace function public.salvar_rota_completa(p_rota jsonb)
returns uuid
language plpgsql security definer set search_path = public as $function$
declare
  v_route_id uuid := nullif(p_rota->>'id','')::uuid;
  v_owner uuid := auth.uid();
  v_city text;
  v_stop jsonb;
  v_pax jsonb;
begin
  if v_owner is null then raise exception 'Precisa estar autenticado.'; end if;

  select coalesce((select city_id from public.drivers where owner_id = v_owner limit 1),
                  (select id from public.cities limit 1)) into v_city;

  if v_route_id is null then
    insert into public.routes (owner_id, vehicle_id, city_id, name, direction, turno, days,
      monitor, monitor_ocupa_lugar, reserved_seats, last_dropoff_min, early_leave_limit_min, status)
    values (v_owner, nullif(p_rota->>'vehicle_id','')::uuid, v_city,
      coalesce(p_rota->>'name',''), coalesce(p_rota->>'direction','ida'),
      nullif(p_rota->>'turno','')::public.turno,
      coalesce((select array_agg(value::text) from jsonb_array_elements_text(p_rota->'days')), '{}'),
      coalesce((p_rota->>'monitor')::boolean,false), coalesce((p_rota->>'monitor_ocupa_lugar')::boolean,false),
      coalesce((p_rota->>'reserved_seats')::int,0), nullif(p_rota->>'last_dropoff_min','')::int,
      nullif(p_rota->>'early_leave_limit_min','')::int, coalesce(p_rota->>'status','rascunho'))
    returning id into v_route_id;
  else
    update public.routes set
      vehicle_id = nullif(p_rota->>'vehicle_id','')::uuid, name = coalesce(p_rota->>'name',''),
      direction = coalesce(p_rota->>'direction','ida'), turno = nullif(p_rota->>'turno','')::public.turno,
      days = coalesce((select array_agg(value::text) from jsonb_array_elements_text(p_rota->'days')), '{}'),
      monitor = coalesce((p_rota->>'monitor')::boolean,false),
      monitor_ocupa_lugar = coalesce((p_rota->>'monitor_ocupa_lugar')::boolean,false),
      reserved_seats = coalesce((p_rota->>'reserved_seats')::int,0),
      last_dropoff_min = nullif(p_rota->>'last_dropoff_min','')::int,
      early_leave_limit_min = nullif(p_rota->>'early_leave_limit_min','')::int,
      status = coalesce(p_rota->>'status','rascunho'),
      version = version + 1
    where id = v_route_id and (owner_id = v_owner or public.is_admin());
    if not found then raise exception 'Rota não encontrada ou sem permissão.'; end if;
  end if;

  delete from public.route_passengers where route_id = v_route_id;
  delete from public.route_stops where route_id = v_route_id;

  for v_stop in select * from jsonb_array_elements(coalesce(p_rota->'stops','[]'::jsonb)) loop
    insert into public.route_stops (id, route_id, ordem, type, label, lat, lng, confirmed, destination_id, leg_time_min)
    values (coalesce(nullif(v_stop->>'id','')::uuid, gen_random_uuid()), v_route_id,
      (v_stop->>'ordem')::int, v_stop->>'type', coalesce(v_stop->>'label',''),
      nullif(v_stop->>'lat','')::double precision, nullif(v_stop->>'lng','')::double precision,
      coalesce((v_stop->>'confirmed')::boolean,false), nullif(v_stop->>'destination_id',''), nullif(v_stop->>'leg_time_min','')::int);
  end loop;

  for v_pax in select * from jsonb_array_elements(coalesce(p_rota->'passengers','[]'::jsonb)) loop
    insert into public.route_passengers (id, route_id, identificacao, board_stop_id, alight_stop_id, destination_id,
      horario_habitual_min, ajuste_antes_min, ajuste_depois_min, atendimento_min, atendimento_origem)
    values (coalesce(nullif(v_pax->>'id','')::uuid, gen_random_uuid()), v_route_id,
      coalesce(v_pax->>'identificacao',''), nullif(v_pax->>'board_stop_id','')::uuid,
      nullif(v_pax->>'alight_stop_id','')::uuid, nullif(v_pax->>'destination_id',''),
      nullif(v_pax->>'horario_habitual_min','')::int, nullif(v_pax->>'ajuste_antes_min','')::int,
      nullif(v_pax->>'ajuste_depois_min','')::int, nullif(v_pax->>'atendimento_min','')::int,
      nullif(v_pax->>'atendimento_origem',''));
  end loop;

  return v_route_id;
end;
$function$;
