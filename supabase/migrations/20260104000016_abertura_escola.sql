-- ============================================================================
-- VanBora — Migração 0016: abertura da escola (busca e encaixe)
-- ----------------------------------------------------------------------------
-- ADITIVA, idempotente e NÃO destrutiva. Nada é preenchido por suposição: a
-- coluna nasce NULL ("não informado") e, enquanto estiver NULL, o cálculo é o
-- mesmo de antes.
--
--   route_stops.opening_time_min                — IDA: a partir de que minuto do
--   route_school_availability.opening_time_min    dia a escola recebe os alunos
--                                                 (abertura do portão). Se a van
--                                                 chega antes, ESPERA; a entrega
--                                                 só conta a partir da abertura.
--
-- A busca das famílias (api/buscar-rotas) e o app do motorista leem a coluna
-- quando ela existe e funcionam sem ela (leitura com retorno ao formato
-- anterior). A RPC `salvar_rota_completa` é a MESMA da migração 0015, com a
-- coluna nova: chave ausente no payload (app anterior) preserva o valor gravado.
--
-- NÃO APLICADA automaticamente. Revise e aplique no ambiente de teste antes de
-- qualquer outro.
-- ============================================================================

alter table public.route_stops
  add column if not exists opening_time_min int;
alter table public.route_school_availability
  add column if not exists opening_time_min int;

do $$ begin
  alter table public.route_stops add constraint route_stops_opening_time_chk
    check (opening_time_min is null or (opening_time_min >= 0 and opening_time_min <= 1439));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.route_school_availability add constraint route_school_avail_opening_time_chk
    check (opening_time_min is null or (opening_time_min >= 0 and opening_time_min <= 1439));
exception when duplicate_object then null; end $$;

comment on column public.route_stops.opening_time_min is
  'IDA: minuto do dia a partir do qual a escola recebe os alunos (abertura do portão). NULL = não informado.';
comment on column public.route_school_availability.opening_time_min is
  'IDA: abertura do portão, caso a escola entre na rota. NULL = não informado.';

create or replace function public.salvar_rota_completa(p_rota jsonb)
returns uuid
language plpgsql security definer set search_path = public as $function$
declare
  v_route_id uuid := nullif(p_rota->>'id','')::uuid;
  v_owner uuid := auth.uid();
  v_city text;
  v_stop jsonb;
  v_pax jsonb;
  v_esc jsonb;
  v_old jsonb;                 -- parada como estava antes (para payload do app antigo)
  v_old_stops jsonb := '{}'::jsonb;
begin
  if v_owner is null then raise exception 'Precisa estar autenticado.'; end if;

  -- Toda escola de uma rota concluída vem do catálogo (mantém o ID da unidade).
  if coalesce(p_rota->>'status','rascunho') = 'concluida' and exists (
    select 1 from jsonb_array_elements(coalesce(p_rota->'stops','[]'::jsonb)) s
    where s->>'type' = 'escola' and nullif(s->>'destination_id','') is null
  ) then
    raise exception 'Há uma parada de escola sem escola do catálogo. Escolha a escola na lista antes de concluir a rota.';
  end if;

  select coalesce((select city_id from public.drivers where owner_id = v_owner limit 1),
                  (select id from public.cities limit 1)) into v_city;

  if v_route_id is null then
    insert into public.routes (owner_id, vehicle_id, city_id, name, direction, turno, days,
      monitor, monitor_ocupa_lugar, reserved_seats, last_dropoff_min, early_leave_limit_min, status,
      habitual_departure_min, turno_confirmed, availability_reviewed)
    values (v_owner, nullif(p_rota->>'vehicle_id','')::uuid, v_city,
      coalesce(p_rota->>'name',''), coalesce(p_rota->>'direction','ida'),
      nullif(p_rota->>'turno','')::public.turno,
      coalesce((select array_agg(value::text) from jsonb_array_elements_text(p_rota->'days')), '{}'),
      coalesce((p_rota->>'monitor')::boolean,false), coalesce((p_rota->>'monitor_ocupa_lugar')::boolean,false),
      coalesce((p_rota->>'reserved_seats')::int,0), nullif(p_rota->>'last_dropoff_min','')::int,
      nullif(p_rota->>'early_leave_limit_min','')::int, coalesce(p_rota->>'status','rascunho'),
      nullif(p_rota->>'habitual_departure_min','')::int,
      coalesce((p_rota->>'turno_confirmed')::boolean,false),
      coalesce((p_rota->>'availability_reviewed')::boolean,false))
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
      -- chave ausente (app antigo) = mantém o valor gravado
      habitual_departure_min = case when p_rota ? 'habitual_departure_min'
        then nullif(p_rota->>'habitual_departure_min','')::int else habitual_departure_min end,
      turno_confirmed = case when p_rota ? 'turno_confirmed'
        then coalesce((p_rota->>'turno_confirmed')::boolean,false) else turno_confirmed end,
      availability_reviewed = case when p_rota ? 'availability_reviewed'
        then coalesce((p_rota->>'availability_reviewed')::boolean,false) else availability_reviewed end,
      version = version + 1
    where id = v_route_id and (owner_id = v_owner or public.is_admin());
    if not found then raise exception 'Rota não encontrada ou sem permissão.'; end if;
  end if;

  -- Paradas e alunos são recriados a cada salvamento. Guarda as paradas antigas
  -- para não perder os campos novos quando o payload vier do app antigo.
  select coalesce(jsonb_object_agg(lower(s.id::text), to_jsonb(s)), '{}'::jsonb)
    into v_old_stops from public.route_stops s where s.route_id = v_route_id;

  delete from public.route_passengers where route_id = v_route_id;
  delete from public.route_stops where route_id = v_route_id;

  for v_stop in select * from jsonb_array_elements(coalesce(p_rota->'stops','[]'::jsonb)) loop
    v_old := coalesce(v_old_stops -> lower(nullif(v_stop->>'id','')), '{}'::jsonb);
    insert into public.route_stops (id, route_id, ordem, type, label, lat, lng, confirmed, destination_id,
      leg_time_min, habitual_arrival_min, arrival_deadline_min, release_time_min, group_service_min, gate_custom,
      opening_time_min)
    values (coalesce(nullif(v_stop->>'id','')::uuid, gen_random_uuid()), v_route_id,
      (v_stop->>'ordem')::int, v_stop->>'type', coalesce(v_stop->>'label',''),
      nullif(v_stop->>'lat','')::double precision, nullif(v_stop->>'lng','')::double precision,
      coalesce((v_stop->>'confirmed')::boolean,false), nullif(v_stop->>'destination_id',''),
      nullif(v_stop->>'leg_time_min','')::int, nullif(v_stop->>'habitual_arrival_min','')::int,
      case when v_stop ? 'arrival_deadline_min' then nullif(v_stop->>'arrival_deadline_min','')::int
           else nullif(v_old->>'arrival_deadline_min','')::int end,
      case when v_stop ? 'release_time_min' then nullif(v_stop->>'release_time_min','')::int
           else nullif(v_old->>'release_time_min','')::int end,
      case when v_stop ? 'group_service_min' then nullif(v_stop->>'group_service_min','')::numeric
           else nullif(v_old->>'group_service_min','')::numeric end,
      case when v_stop ? 'gate_custom' then coalesce((v_stop->>'gate_custom')::boolean,false)
           else coalesce((v_old->>'gate_custom')::boolean,false) end,
      -- abertura da escola: chave ausente (app anterior) = mantém o valor gravado
      case when v_stop ? 'opening_time_min' then nullif(v_stop->>'opening_time_min','')::int
           else nullif(v_old->>'opening_time_min','')::int end);
  end loop;

  for v_pax in select * from jsonb_array_elements(coalesce(p_rota->'passengers','[]'::jsonb)) loop
    insert into public.route_passengers (id, route_id, identificacao, board_stop_id, alight_stop_id, destination_id,
      horario_habitual_min, ajuste_antes_min, ajuste_depois_min, atendimento_min, atendimento_origem)
    values (coalesce(nullif(v_pax->>'id','')::uuid, gen_random_uuid()), v_route_id,
      coalesce(v_pax->>'identificacao',''), nullif(v_pax->>'board_stop_id','')::uuid,
      nullif(v_pax->>'alight_stop_id','')::uuid, nullif(v_pax->>'destination_id',''),
      nullif(v_pax->>'horario_habitual_min','')::int, nullif(v_pax->>'ajuste_antes_min','')::int,
      nullif(v_pax->>'ajuste_depois_min','')::int, nullif(v_pax->>'atendimento_min','')::numeric,
      nullif(v_pax->>'atendimento_origem',''));
  end loop;

  -- Escolas que o motorista aceita incluir: só substitui quando a chave vier no
  -- payload (app antigo não a envia e, portanto, não apaga a lista).
  if p_rota ? 'school_availability' then
    delete from public.route_school_availability where route_id = v_route_id;
    for v_esc in select * from jsonb_array_elements(coalesce(p_rota->'school_availability','[]'::jsonb)) loop
      insert into public.route_school_availability (id, route_id, destination_id, days, gate_lat, gate_lng,
        arrival_deadline_min, release_time_min, group_service_min, opening_time_min)
      values (coalesce(nullif(v_esc->>'id','')::uuid, gen_random_uuid()), v_route_id,
        v_esc->>'destination_id',
        case when jsonb_typeof(v_esc->'days') = 'array'
          then coalesce((select array_agg(value::text) from jsonb_array_elements_text(v_esc->'days')), '{}') end,
        nullif(v_esc->>'gate_lat','')::double precision, nullif(v_esc->>'gate_lng','')::double precision,
        nullif(v_esc->>'arrival_deadline_min','')::int, nullif(v_esc->>'release_time_min','')::int,
        nullif(v_esc->>'group_service_min','')::numeric, nullif(v_esc->>'opening_time_min','')::int)
      on conflict (route_id, destination_id) do nothing;
    end loop;
  end if;

  return v_route_id;
end;
$function$;

revoke execute on function public.salvar_rota_completa(jsonb) from public;
grant execute on function public.salvar_rota_completa(jsonb) to authenticated;
