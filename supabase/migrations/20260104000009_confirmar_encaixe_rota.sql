-- ============================================================================
-- Vambora — Migração 0009: confirmação ATÔMICA do encaixe de um novo aluno
-- ----------------------------------------------------------------------------
-- ATENÇÃO: esta migração NÃO é aplicada automaticamente pelo deploy da Vercel.
-- Ela precisa ser REVISADA e aplicada manualmente (supabase db push) pelo
-- responsável, pois habilita a gravação definitiva do encaixe. Enquanto não
-- for aplicada, a tela do simulador mantém o botão "Confirmar" desativado.
--
-- O que ela garante (regras do simulador):
--  * Propriedade: só o dono da rota (owner_id = auth.uid()) pode confirmar.
--  * Concorrência: trava a linha da rota (FOR UPDATE) e exige que a versão
--    (updated_at) seja a mesma usada na simulação. Se a rota mudou entre a
--    simulação e a confirmação, a operação é rejeitada e uma nova simulação
--    é exigida — impedindo que confirmações simultâneas ultrapassem a
--    capacidade.
--  * Atomicidade: parada(s) do novo aluno + passageiro são inseridos numa
--    única transação (tudo ou nada).
--
-- A validação de capacidade/horários por trecho continua sendo refeita no
-- cliente com dados viários reais imediatamente antes desta chamada; a trava
-- de linha + checagem de versão garantem que nada foi alterado nesse intervalo.
-- Nada aqui apaga rotas, paradas ou passageiros existentes.
-- ============================================================================

create or replace function public.confirmar_encaixe_rota(
  p_route_id uuid,
  p_expected_updated_at timestamptz,
  p_novos_stops jsonb,          -- paradas novas a inserir (ex.: casa do novo aluno)
  p_novo_passageiro jsonb       -- { identificacao, board_stop_id, alight_stop_id, destination_id }
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_updated timestamptz;
  v_stop jsonb;
  v_new_updated timestamptz;
begin
  -- Trava a rota e lê dono + versão atual.
  select owner_id, updated_at into v_owner, v_updated
  from public.routes
  where id = p_route_id
  for update;

  if v_owner is null then
    raise exception 'Rota não encontrada.' using errcode = 'P0002';
  end if;
  if v_owner <> auth.uid() then
    raise exception 'Você não é o dono desta rota.' using errcode = '42501';
  end if;
  -- Concorrência otimista: a rota não pode ter mudado desde a simulação.
  if p_expected_updated_at is distinct from v_updated then
    raise exception 'A rota foi alterada. Faça uma nova simulação antes de confirmar.'
      using errcode = '40001';
  end if;

  -- Insere as paradas novas do encaixe (mantém as existentes).
  for v_stop in select * from jsonb_array_elements(coalesce(p_novos_stops, '[]'::jsonb))
  loop
    insert into public.route_stops (id, route_id, ordem, type, label, lat, lng, confirmed, destination_id, leg_time_min)
    values (
      coalesce(nullif(v_stop->>'id','')::uuid, gen_random_uuid()),
      p_route_id,
      (v_stop->>'ordem')::int,
      v_stop->>'type',
      v_stop->>'label',
      nullif(v_stop->>'lat','')::double precision,
      nullif(v_stop->>'lng','')::double precision,
      coalesce((v_stop->>'confirmed')::boolean, true),
      nullif(v_stop->>'destination_id',''),
      nullif(v_stop->>'leg_time_min','')::int
    );
  end loop;

  -- Insere o passageiro do novo aluno.
  insert into public.route_passengers (id, route_id, identificacao, board_stop_id, alight_stop_id, destination_id)
  values (
    gen_random_uuid(),
    p_route_id,
    p_novo_passageiro->>'identificacao',
    nullif(p_novo_passageiro->>'board_stop_id','')::uuid,
    nullif(p_novo_passageiro->>'alight_stop_id','')::uuid,
    nullif(p_novo_passageiro->>'destination_id','')
  );

  -- Marca nova versão da rota (também serve de confirmação da escrita).
  update public.routes set updated_at = now() where id = p_route_id
  returning updated_at into v_new_updated;

  return v_new_updated;
end;
$$;

-- Função interna: não exposta publicamente; só usuários autenticados (RLS cuida do escopo).
revoke execute on function public.confirmar_encaixe_rota(uuid, timestamptz, jsonb, jsonb) from public;
grant execute on function public.confirmar_encaixe_rota(uuid, timestamptz, jsonb, jsonb) to authenticated;
