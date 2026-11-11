-- ============================================================================
-- VanBora — Migração 0017: pedido de interesse com o CONTEXTO da busca
-- ----------------------------------------------------------------------------
-- ADITIVA, idempotente e NÃO destrutiva. A função antiga `registrar_interesse`
-- continua existindo e funcionando igual; pedidos já gravados não mudam.
--
-- Por quê: a lista de interesse guardava só escola e turno. O pedido perdia o
-- SENTIDO (ida/volta), o horário de cada sentido e — quando a família se
-- interessa por uma rota específica — a rota e as condições do encaixe. Quem
-- atende precisava perguntar tudo de novo.
--
--   waitlist_requests.context  jsonb — o que foi buscado e calculado:
--       { destinoId, contratacao,
--         trechos: [{ sentido, horarioMin }],          -- ida: chegar até; volta: liberado a partir de
--         rota:    { rotaId, sentido, status, origemEscola, passagemCasaMin,
--                    horarioEscolaMin, versao, temposEstimados, condicao } | null }
--     NÃO contém endereço da família nem dado de quem já está na rota.
--   waitlist_requests.route_id uuid  — rota do interesse (quando houver). Some
--       com a rota (ON DELETE SET NULL); o contexto guarda a versão calculada.
--
-- Interesse NÃO reserva vaga e nada aqui envia mensagem a ninguém: é só um
-- registro para a equipe/motorista fazerem contato.
--
-- O app chama `registrar_interesse_v2` e, enquanto esta migração não for
-- aplicada, volta sozinho para a função antiga (levando um resumo do contexto
-- junto da região). NÃO APLICADA automaticamente: revise e aplique no ambiente
-- de teste antes de qualquer outro.
-- ============================================================================

alter table public.waitlist_requests
  add column if not exists context  jsonb,
  add column if not exists route_id uuid references public.routes(id) on delete set null;

do $$ begin
  alter table public.waitlist_requests add constraint waitlist_context_tamanho_chk
    check (context is null or (jsonb_typeof(context) = 'object' and pg_column_size(context) <= 4096));
exception when duplicate_object then null; end $$;

create index if not exists idx_waitlist_route on public.waitlist_requests(route_id) where route_id is not null;

comment on column public.waitlist_requests.context is
  'Contexto do pedido (sentido, horário por sentido, rota e condições do encaixe). Sem endereço da família e sem dados de terceiros. Não é reserva de vaga.';

create or replace function public.registrar_interesse_v2(
  p_city_id          text,
  p_contact_name     text,
  p_contact_whatsapp text,
  p_consent          boolean,
  p_region           text default null,
  p_destination_id   text default null,
  p_turno            public.turno default null,
  p_context          jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_route uuid;
  v_txt text;
begin
  if p_consent is not true then
    raise exception 'Consentimento é obrigatório.';
  end if;
  if coalesce(trim(p_contact_name), '') = '' or coalesce(trim(p_contact_whatsapp), '') = '' then
    raise exception 'Nome e WhatsApp são obrigatórios.';
  end if;
  if p_context is not null and (jsonb_typeof(p_context) <> 'object' or pg_column_size(p_context) > 4096) then
    raise exception 'Contexto do pedido inválido.';
  end if;

  -- Rota do interesse: só é ligada se existir e estiver concluída (não vaza nem
  -- confirma a existência de rascunhos: id inválido ou desconhecido vira NULL).
  v_txt := p_context #>> '{rota,rotaId}';
  if v_txt ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select r.id into v_route from public.routes r where r.id = v_txt::uuid and r.status = 'concluida';
  end if;

  insert into public.waitlist_requests
    (city_id, region, destination_id, turno, contact_name, contact_whatsapp, consent, context, route_id)
  values
    (p_city_id, p_region, p_destination_id, p_turno, p_contact_name, p_contact_whatsapp, true, p_context, v_route)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.registrar_interesse_v2(text, text, text, boolean, text, text, public.turno, jsonb) from public;
grant execute on function public.registrar_interesse_v2(text, text, text, boolean, text, text, public.turno, jsonb) to anon, authenticated;
