-- ============================================================================
-- VanBora — Etapa 3A: solicitações de transporte das FAMÍLIAS
-- ----------------------------------------------------------------------------
-- NÃO APLICADA. Aplique pela ferramenta de migração do Supabase
-- (apply_migration) e renomeie este arquivo para a VERSÃO REGISTRADA
-- (supabase/HISTORICO-MIGRACOES.md). Execute numa única transação.
--
-- Uma solicitação é o pedido EXPLÍCITO e CONFIRMADO de uma família autenticada
-- (pesquisar não cria solicitação). Ela pertence à conta, pode ser editada,
-- pausada, reativada e encerrada só por ela. No futuro, as solicitações ATIVAS
-- alimentam o Radar de Oportunidades dos motoristas — por isso já ficam
-- guardados o destino, o sentido, os horários e um ponto APROXIMADO da origem
-- (grade de ~500 m). Nada aqui é público: não há view nem RPC que exponha
-- solicitações; o radar futuro deverá ler por uma função própria, com dados
-- minimizados (nunca o endereço nem a coordenada exata).
--
-- NÃO faz: propostas, mensagens, notificações, radar, alteração de rotas, do
-- algoritmo de encaixe ou de qualquer tabela existente.
-- ============================================================================

create table if not exists public.transport_requests (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  -- Gerada pelo app a cada formulário: o mesmo envio repetido (clique duplo,
  -- rede lenta) não cria uma segunda solicitação.
  chave_envio            uuid not null,
  city_id                text not null references public.cities(id) on delete restrict,
  destination_id         text not null references public.destinations(id) on delete restrict,
  -- PRIVADO: endereço e coordenada exata só para a própria família (e admin).
  origem_endereco        text not null,
  origem_lat             double precision not null,
  origem_lng             double precision not null,
  -- Ponto APROXIMADO (grade de 0,005° ≈ 500 m) para o radar futuro.
  origem_lat_aprox       double precision generated always as (round((origem_lat * 200)::numeric) / 200) stored,
  origem_lng_aprox       double precision generated always as (round((origem_lng * 200)::numeric) / 200) stored,
  sentido                text not null,
  -- ida: chegar à escola ATÉ; volta: aluno liberado A PARTIR DE (minuto do dia).
  horario_ida_min        int,
  horario_volta_min      int,
  turno                  public.turno,
  etapa_ensino           text,
  precisa_acessibilidade boolean not null default false,
  observacoes            text,
  status                 text not null default 'ativa',
  motivo_encerramento    text,
  encerrada_em           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint transport_requests_chave_unica unique (owner_id, chave_envio),
  constraint transport_requests_endereco_chk check (char_length(btrim(origem_endereco)) between 5 and 200),
  constraint transport_requests_coord_chk check (origem_lat between -34 and 6 and origem_lng between -74 and -34),
  constraint transport_requests_sentido_chk check (sentido in ('ida', 'volta', 'ambos')),
  constraint transport_requests_horario_ida_chk check (horario_ida_min is null or horario_ida_min between 0 and 1439),
  constraint transport_requests_horario_volta_chk check (horario_volta_min is null or horario_volta_min between 0 and 1439),
  -- O horário de cada sentido pedido é obrigatório (e só dele).
  constraint transport_requests_horarios_chk check (
    (sentido = 'volta' or horario_ida_min is not null) and (sentido = 'ida' or horario_volta_min is not null)
    and (sentido <> 'ida' or horario_volta_min is null) and (sentido <> 'volta' or horario_ida_min is null)),
  constraint transport_requests_etapa_chk check (etapa_ensino is null or etapa_ensino in
    ('infantil', 'fundamental_1', 'fundamental_2', 'medio', 'universitario')),
  constraint transport_requests_obs_chk check (observacoes is null or char_length(observacoes) <= 500),
  constraint transport_requests_status_chk check (status in ('ativa', 'pausada', 'encerrada')),
  constraint transport_requests_motivo_chk check (motivo_encerramento is null or motivo_encerramento in
    ('contratou_vanbora', 'contratou_fora', 'desistiu', 'outro'))
);

comment on table public.transport_requests is
  'Solicitações de transporte das famílias (Etapa 3A). Privadas: só a própria conta (e admin). Ativas alimentarão o Radar de Oportunidades por uma função com dados minimizados.';

create index if not exists idx_transport_requests_owner on public.transport_requests (owner_id, created_at desc);
-- Radar futuro: solicitações ativas por escola e sentido.
create index if not exists idx_transport_requests_radar on public.transport_requests (destination_id, sentido) where status = 'ativa';

-- ----------------------------------------------------------------------------
-- Regras de escrita (valem para qualquer caminho: app, API, admin)
-- ----------------------------------------------------------------------------
create or replace function public.proteger_solicitacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_abertas int;
begin
  if tg_op = 'INSERT' then
    -- Nasce ativa; encerramento só depois. Limite de solicitações abertas por
    -- conta (proteção contra abuso e cliques em sequência).
    new.status := 'ativa';
    new.motivo_encerramento := null;
    new.encerrada_em := null;
    new.created_at := now();
    new.updated_at := now();
    select count(*) into v_abertas from public.transport_requests
     where owner_id = new.owner_id and status in ('ativa', 'pausada');
    if v_abertas >= 10 then
      raise exception 'Você já tem 10 solicitações abertas. Encerre alguma antes de criar outra.' using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- UPDATE
  if old.status = 'encerrada' and not public.is_admin() then
    raise exception 'Esta solicitação foi encerrada e não pode mais ser alterada.' using errcode = 'P0001';
  end if;
  new.id := old.id;
  new.owner_id := old.owner_id;            -- não muda de dono
  new.chave_envio := old.chave_envio;
  new.created_at := old.created_at;
  new.updated_at := now();
  if new.status = 'encerrada' then
    new.encerrada_em := coalesce(old.encerrada_em, now());
  else
    new.motivo_encerramento := null;
    new.encerrada_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_solicitacao on public.transport_requests;
create trigger trg_proteger_solicitacao
  before insert or update on public.transport_requests
  for each row execute function public.proteger_solicitacao();

-- Função de gatilho: não é chamável pela API.
revoke execute on function public.proteger_solicitacao() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- RLS: cada família só vê e altera as próprias solicitações; admin consulta.
-- Sem DELETE (encerrar é o caminho; o histórico fica).
-- ----------------------------------------------------------------------------
alter table public.transport_requests enable row level security;

drop policy if exists transport_requests_dono_le on public.transport_requests;
create policy transport_requests_dono_le on public.transport_requests
  for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());

drop policy if exists transport_requests_dono_cria on public.transport_requests;
create policy transport_requests_dono_cria on public.transport_requests
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists transport_requests_dono_altera on public.transport_requests;
create policy transport_requests_dono_altera on public.transport_requests
  for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Privilégios: nada para anon; autenticado só lê, cria e altera (sem apagar).
revoke all on table public.transport_requests from public, anon, authenticated;
grant select, insert, update on table public.transport_requests to authenticated;

-- Autoverificação: aborta (desfaz tudo) se algo não ficou como esperado.
do $$
begin
  if has_table_privilege('anon', 'public.transport_requests', 'SELECT')
     or has_table_privilege('anon', 'public.transport_requests', 'INSERT')
     or has_table_privilege('anon', 'public.transport_requests', 'UPDATE') then
    raise exception 'anon com acesso a solicitações: abortando';
  end if;
  if has_table_privilege('authenticated', 'public.transport_requests', 'DELETE')
     or has_table_privilege('authenticated', 'public.transport_requests', 'TRUNCATE') then
    raise exception 'authenticated pode apagar solicitações: abortando';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.transport_requests'::regclass) then
    raise exception 'RLS desligado em transport_requests: abortando';
  end if;
  -- A vitrine continua somente leitura (correções anteriores).
  if has_table_privilege('anon', 'public.public_listings', 'UPDATE')
     or has_table_privilege('authenticated', 'public.public_listings', 'INSERT') then
    raise exception 'A vitrine voltou a aceitar escrita: abortando';
  end if;
end $$;
