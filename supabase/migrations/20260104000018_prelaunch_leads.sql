-- ============================================================================
-- PRÉ-LANÇAMENTO — cadastro de interessados (motoristas e famílias)
-- ----------------------------------------------------------------------------
-- Estrutura SEPARADA das tabelas operacionais (drivers, routes, leads,
-- waitlist_requests…): nada do aplicativo existente é alterado.
--
-- O que esta migração cria:
--   * public.prelaunch_leads            — as inscrições (dados pessoais)
--   * public.prelaunch_submission_log   — registro técnico p/ limite de envios
--   * public.registrar_interesse_lancamento(jsonb, text) — ÚNICA porta de
--     entrada de gravação; só o papel service_role (servidor) pode executar.
--
-- Segurança:
--   * RLS ligada nas duas tabelas.
--   * Visitante (anon) não lê, não lista, não grava, não altera, não apaga.
--   * Usuário autenticado só enxerga algo se for admin (public.is_admin()):
--     pode listar, mudar a SITUAÇÃO do contato (coluna status) e excluir
--     (pedido de exclusão do titular — LGPD). Nenhum outro campo é editável.
--   * A gravação pública passa pelo endpoint /api/interesse (servidor), que
--     chama a função abaixo com a service_role. A função valida tudo de novo
--     e aplica o limite de envios dentro do banco (não depende de memória do
--     servidor).
--
-- Idempotente: pode ser aplicada mais de uma vez.
-- ============================================================================

-- DDDs brasileiros válidos + celular (9 dígitos começando em 9), em E.164.
-- ^\+55(DDD)9XXXXXXXX$

create table if not exists public.prelaunch_leads (
  id                     uuid primary key default gen_random_uuid(),
  lead_type              text not null,
  full_name              text not null,
  whatsapp_e164          text not null,
  email                  text,
  -- Endereço de embarque e escola: só para famílias.
  street_address         text,
  address_number         text,
  neighborhood           text,
  address_complement     text,
  city                   text,
  state                  text,
  school_name            text,
  school_shift           text,
  transport_direction    text,
  -- Consentimento (LGPD).
  consent_accepted       boolean not null,
  consent_at             timestamptz not null default now(),
  privacy_policy_version text not null,
  source                 text not null default 'site',
  status                 text not null default 'novo',
  -- Reinscrição com o mesmo WhatsApp no mesmo perfil: o registro original NÃO
  -- é sobrescrito; o último reenvio fica guardado aqui para a equipe conferir.
  resubmitted_at         timestamptz,
  last_resubmission      jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint prelaunch_leads_type_chk
    check (lead_type in ('motorista', 'familia')),
  constraint prelaunch_leads_name_chk
    check (char_length(full_name) between 5 and 120
           and full_name = btrim(full_name)
           and position(' ' in full_name) > 0
           and full_name !~ '[0-9<>@[:cntrl:]]'),
  constraint prelaunch_leads_whatsapp_chk
    check (whatsapp_e164 ~ '^\+55(1[1-9]|2[12478]|3[1-578]|4[1-9]|5[1345]|6[1-9]|7[13-579]|8[1-9]|9[1-9])9[0-9]{8}$'),
  constraint prelaunch_leads_email_chk
    check (email is null or (char_length(email) between 6 and 254
           and email = lower(email)
           and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@.]{2,}$')),
  constraint prelaunch_leads_street_chk
    check (street_address is null or char_length(street_address) between 3 and 120),
  constraint prelaunch_leads_number_chk
    check (address_number is null or address_number ~ '^([0-9]{1,6}[A-Z]?|S/N)$'),
  constraint prelaunch_leads_neighborhood_chk
    check (neighborhood is null or char_length(neighborhood) between 2 and 80),
  constraint prelaunch_leads_complement_chk
    check (address_complement is null or char_length(address_complement) between 1 and 80),
  constraint prelaunch_leads_city_chk
    check (city is null or char_length(city) between 2 and 80),
  constraint prelaunch_leads_state_chk
    check (state is null or state ~ '^[A-Z]{2}$'),
  constraint prelaunch_leads_school_chk
    check (school_name is null or char_length(school_name) between 3 and 120),
  constraint prelaunch_leads_shift_chk
    check (school_shift is null or school_shift in ('manha', 'tarde', 'noite')),
  constraint prelaunch_leads_direction_chk
    check (transport_direction is null or transport_direction in ('ida', 'volta', 'ida_volta')),
  constraint prelaunch_leads_consent_chk
    check (consent_accepted),
  constraint prelaunch_leads_policy_chk
    check (char_length(privacy_policy_version) between 1 and 40),
  constraint prelaunch_leads_source_chk
    check (char_length(source) between 1 and 40),
  constraint prelaunch_leads_status_chk
    check (status in ('novo', 'contatado', 'convertido', 'descartado')),
  -- Família: endereço de embarque, escola e período são obrigatórios.
  constraint prelaunch_leads_family_chk
    check (lead_type <> 'familia' or (
      street_address is not null and address_number is not null
      and neighborhood is not null and city is not null and state is not null
      and school_name is not null and school_shift is not null)),
  -- Mesmo WhatsApp pode existir como motorista E como família; nunca duas
  -- vezes no mesmo perfil.
  constraint prelaunch_leads_type_whatsapp_uniq unique (lead_type, whatsapp_e164)
);

comment on table public.prelaunch_leads is
  'Interessados no pré-lançamento (motoristas e famílias). Dados pessoais: sem acesso público; leitura/gestão só admin; gravação só via registrar_interesse_lancamento (service_role).';

create index if not exists idx_prelaunch_leads_created on public.prelaunch_leads (created_at desc);
create index if not exists idx_prelaunch_leads_status  on public.prelaunch_leads (status);

drop trigger if exists trg_prelaunch_leads_updated on public.prelaunch_leads;
create trigger trg_prelaunch_leads_updated
  before update on public.prelaunch_leads
  for each row execute function public.set_updated_at();

-- Registro técnico para limitar envios (sem IP em claro: só um hash com segredo
-- do servidor). Linhas com mais de 24 h são apagadas a cada novo envio.
create table if not exists public.prelaunch_submission_log (
  id         bigint generated always as identity primary key,
  ip_hash    text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
comment on table public.prelaunch_submission_log is
  'Controle de abuso do formulário de pré-lançamento (hash do IP + horário). Retenção de 24 h. Sem acesso por clientes.';
create index if not exists idx_prelaunch_log_ip      on public.prelaunch_submission_log (ip_hash, created_at);
create index if not exists idx_prelaunch_log_created on public.prelaunch_submission_log (created_at);

-- ----------------------------------------------------------------------------
-- RLS e privilégios
-- ----------------------------------------------------------------------------
alter table public.prelaunch_leads          enable row level security;
alter table public.prelaunch_submission_log enable row level security;

revoke all on table public.prelaunch_leads          from public, anon, authenticated;
revoke all on table public.prelaunch_submission_log from public, anon, authenticated;

-- Autenticado: privilégio mínimo; quem decide a linha é a política (só admin).
grant select, delete   on table public.prelaunch_leads to authenticated;
grant update (status)  on table public.prelaunch_leads to authenticated;
grant all on table public.prelaunch_leads          to service_role;
grant all on table public.prelaunch_submission_log to service_role;

drop policy if exists prelaunch_leads_admin_select on public.prelaunch_leads;
create policy prelaunch_leads_admin_select on public.prelaunch_leads
  for select to authenticated using ((select public.is_admin()));

drop policy if exists prelaunch_leads_admin_update on public.prelaunch_leads;
create policy prelaunch_leads_admin_update on public.prelaunch_leads
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists prelaunch_leads_admin_delete on public.prelaunch_leads;
create policy prelaunch_leads_admin_delete on public.prelaunch_leads
  for delete to authenticated using ((select public.is_admin()));

-- Sem política de INSERT: nenhum cliente insere direto na tabela.
-- prelaunch_submission_log: nenhuma política (só service_role/funções).

-- ----------------------------------------------------------------------------
-- Gravação controlada
-- ----------------------------------------------------------------------------
-- p_payload: campos já normalizados pelo servidor (a função valida de novo).
-- p_ip_hash: HMAC-SHA256 do IP do visitante, calculado no servidor.
-- Retorno:
--   {"ok": true,  "resultado": "criado" | "reenviado"}
--   {"ok": false, "erro": "limite"}                      — muitos envios
--   {"ok": false, "erro": "invalido", "campos": [...]}   — dados recusados
create or replace function public.registrar_interesse_lancamento(p_payload jsonb, p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- Limites (por visitante e geral).
  c_max_10min  constant int := 5;
  c_max_24h    constant int := 20;
  c_max_global constant int := 300;   -- por hora, somando todos os visitantes

  v_10min int; v_24h int; v_global int;
  v_campos text[] := '{}';
  v_novo boolean;

  v_type   text; v_name text; v_whats text; v_email text;
  v_street text; v_number text; v_hood text; v_compl text;
  v_city   text; v_state text; v_school text; v_shift text; v_dir text;
  v_policy text; v_source text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'erro', 'invalido', 'campos', jsonb_build_array('requisicao'));
  end if;

  -- Limite de envios (conta toda tentativa, válida ou não).
  delete from public.prelaunch_submission_log where created_at < now() - interval '24 hours';
  select
    count(*) filter (where ip_hash = p_ip_hash and created_at > now() - interval '10 minutes'),
    count(*) filter (where ip_hash = p_ip_hash),
    count(*) filter (where created_at > now() - interval '1 hour')
  into v_10min, v_24h, v_global
  from public.prelaunch_submission_log;
  if v_10min >= c_max_10min or v_24h >= c_max_24h or v_global >= c_max_global then
    return jsonb_build_object('ok', false, 'erro', 'limite');
  end if;
  insert into public.prelaunch_submission_log (ip_hash) values (p_ip_hash);

  -- Normalização: espaços excessivos fora; vazio vira NULL.
  v_type   := p_payload->>'lead_type';
  v_name   := nullif(btrim(regexp_replace(coalesce(p_payload->>'full_name', ''), '\s+', ' ', 'g')), '');
  v_whats  := nullif(btrim(coalesce(p_payload->>'whatsapp_e164', '')), '');
  v_email  := nullif(lower(btrim(coalesce(p_payload->>'email', ''))), '');
  v_street := nullif(btrim(regexp_replace(coalesce(p_payload->>'street_address', ''), '\s+', ' ', 'g')), '');
  v_number := nullif(upper(btrim(coalesce(p_payload->>'address_number', ''))), '');
  v_hood   := nullif(btrim(regexp_replace(coalesce(p_payload->>'neighborhood', ''), '\s+', ' ', 'g')), '');
  v_compl  := nullif(btrim(regexp_replace(coalesce(p_payload->>'address_complement', ''), '\s+', ' ', 'g')), '');
  v_city   := nullif(btrim(coalesce(p_payload->>'city', '')), '');
  v_state  := nullif(upper(btrim(coalesce(p_payload->>'state', ''))), '');
  v_school := nullif(btrim(regexp_replace(coalesce(p_payload->>'school_name', ''), '\s+', ' ', 'g')), '');
  v_shift  := nullif(p_payload->>'school_shift', '');
  v_dir    := nullif(p_payload->>'transport_direction', '');
  v_policy := nullif(btrim(coalesce(p_payload->>'privacy_policy_version', '')), '');
  v_source := coalesce(nullif(btrim(coalesce(p_payload->>'source', '')), ''), 'site');

  -- Validação no servidor (as CHECKs da tabela são a última barreira).
  if v_type is null or v_type not in ('motorista', 'familia') then v_campos := array_append(v_campos, 'lead_type'); end if;
  if v_name is null or char_length(v_name) not between 5 and 120
     or position(' ' in v_name) = 0 or v_name ~ '[0-9<>@[:cntrl:]]' then
    v_campos := array_append(v_campos, 'full_name');
  end if;
  if v_whats is null
     or v_whats !~ '^\+55(1[1-9]|2[12478]|3[1-578]|4[1-9]|5[1345]|6[1-9]|7[13-579]|8[1-9]|9[1-9])9[0-9]{8}$' then
    v_campos := array_append(v_campos, 'whatsapp_e164');
  end if;
  if v_email is not null and (char_length(v_email) not between 6 and 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@.]{2,}$') then
    v_campos := array_append(v_campos, 'email');
  end if;
  if (p_payload->'consent_accepted') is distinct from 'true'::jsonb then
    v_campos := array_append(v_campos, 'consent_accepted');
  end if;
  if v_policy is null or char_length(v_policy) > 40 then v_campos := array_append(v_campos, 'privacy_policy_version'); end if;
  if char_length(v_source) > 40 then v_campos := array_append(v_campos, 'source'); end if;

  if v_type = 'familia' then
    if v_street is null or char_length(v_street) not between 3 and 120 then v_campos := array_append(v_campos, 'street_address'); end if;
    if v_number is null or v_number !~ '^([0-9]{1,6}[A-Z]?|S/N)$'       then v_campos := array_append(v_campos, 'address_number'); end if;
    if v_hood is null or char_length(v_hood) not between 2 and 80        then v_campos := array_append(v_campos, 'neighborhood'); end if;
    if v_compl is not null and char_length(v_compl) > 80                 then v_campos := array_append(v_campos, 'address_complement'); end if;
    if v_city is null or char_length(v_city) not between 2 and 80        then v_campos := array_append(v_campos, 'city'); end if;
    if v_state is null or v_state !~ '^[A-Z]{2}$'                        then v_campos := array_append(v_campos, 'state'); end if;
    if v_school is null or char_length(v_school) not between 3 and 120   then v_campos := array_append(v_campos, 'school_name'); end if;
    if v_shift is null or v_shift not in ('manha', 'tarde', 'noite')     then v_campos := array_append(v_campos, 'school_shift'); end if;
    if v_dir is not null and v_dir not in ('ida', 'volta', 'ida_volta')  then v_campos := array_append(v_campos, 'transport_direction'); end if;
  else
    -- Motorista: endereço/escola não são coletados; ignora o que vier.
    v_street := null; v_number := null; v_hood := null; v_compl := null;
    v_city := null; v_state := null; v_school := null; v_shift := null; v_dir := null;
  end if;

  if array_length(v_campos, 1) is not null then
    return jsonb_build_object('ok', false, 'erro', 'invalido', 'campos', to_jsonb(v_campos));
  end if;

  insert into public.prelaunch_leads as l (
    lead_type, full_name, whatsapp_e164, email,
    street_address, address_number, neighborhood, address_complement, city, state,
    school_name, school_shift, transport_direction,
    consent_accepted, consent_at, privacy_policy_version, source
  ) values (
    v_type, v_name, v_whats, v_email,
    v_street, v_number, v_hood, v_compl, v_city, v_state,
    v_school, v_shift, v_dir,
    true, now(), v_policy, v_source
  )
  on conflict on constraint prelaunch_leads_type_whatsapp_uniq do update
    set resubmitted_at = now(),
        last_resubmission = jsonb_strip_nulls(jsonb_build_object(
          'full_name', v_name, 'email', v_email,
          'street_address', v_street, 'address_number', v_number,
          'neighborhood', v_hood, 'address_complement', v_compl,
          'city', v_city, 'state', v_state,
          'school_name', v_school, 'school_shift', v_shift, 'transport_direction', v_dir,
          'consent_at', now(), 'privacy_policy_version', v_policy, 'source', v_source))
  returning (l.xmax = 0) into v_novo;

  return jsonb_build_object('ok', true, 'resultado', case when v_novo then 'criado' else 'reenviado' end);
end;
$$;

comment on function public.registrar_interesse_lancamento(jsonb, text) is
  'Grava uma inscrição do pré-lançamento com validação e limite de envios. Executável APENAS por service_role (endpoint /api/interesse).';

revoke all on function public.registrar_interesse_lancamento(jsonb, text) from public, anon, authenticated;
grant execute on function public.registrar_interesse_lancamento(jsonb, text) to service_role;
