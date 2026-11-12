-- ============================================================================
-- VanBora — Perfil profissional REAL do motorista, oferta de rotas e contato
-- ----------------------------------------------------------------------------
-- NÃO APLICADA. Revise e aplique pela ferramenta de migração do Supabase
-- (apply_migration). Ao aplicar, renomeie este arquivo para a VERSÃO REGISTRADA
-- (ver supabase/HISTORICO-MIGRACOES.md). Execute numa única transação.
--
-- PROBLEMA (diagnóstico de 12/11/2026, só leitura):
--   * o cadastro real nunca cria a linha em public.drivers (0 motoristas com
--     dono em produção), então nenhum motorista real chega à vitrine;
--   * motorista_elegivel() exige documentos aprovados e há 0 requisitos
--     cadastrados: para motoristas reais ela é SEMPRE falsa. O Documento Mestre
--     (§14.6) revogou a exigência documental como condição de publicação.
--
-- REGRAS APROVADAS (Etapa 2C):
--   * PERFIL: o perfil publicado pelo motorista fica visível mesmo sem rotas ou
--     vagas disponíveis (sem vagas fictícias). Sem exigência documental.
--   * ROTAS: rota CONCLUÍDA fica disponível para a busca automaticamente; o
--     motorista pode PAUSAR a oferta sem apagar a rota nem voltá-la a rascunho.
--     A busca continua devolvendo só o que o motor de encaixe aprovar.
--   * WHATSAPP: obrigatório no cadastro profissional, guardado PRIVADO em
--     drivers.whatsapp; o contato direto pelo perfil é uma escolha separada
--     (contato_whatsapp_ativo), DESLIGADA por padrão.
--
-- O QUE ESTA MIGRAÇÃO FAZ (aditiva; não altera nenhum valor existente):
--   1) índice único parcial: no máximo UM perfil de motorista por conta;
--   2) routes.oferta_pausada (padrão false): todas as rotas seguem como hoje;
--      salvar_rota_completa NÃO toca nesta coluna, então editar passageiros
--      preserva a pausa e o estado concluído;
--   3) drivers.contato_whatsapp_ativo (padrão false);
--   4) motorista_elegivel(): DEMONSTRAÇÃO idêntica; REAL = dono + publicado +
--      não suspenso + anúncio ativo (sem documentos, sem exigir rota);
--   5) solicitar_contato_whatsapp(): só entrega o número de perfil VISÍVEL que
--      AUTORIZOU o contato direto (demonstração: como antes);
--   6) view public_listings: CREATE OR REPLACE acrescentando, NO FIM, só o
--      indicador booleano contato_whatsapp_ativo (nunca o número). CREATE OR
--      REPLACE mantém os privilégios (somente leitura) — ensaiado;
--   7) RPCs salvar_perfil_motorista / publicar_perfil_motorista /
--      definir_contato_whatsapp / meu_perfil_motorista, sempre sobre a
--      PRÓPRIA conta;
--   8) o perfil só é CRIADO pela RPC (validações, slug e WhatsApp): INSERT
--      direto em public.drivers deixa de ser permitido a anon/authenticated.
--
-- NÃO FAZ: não apaga tabelas/funções de documentos, não toca nos motoristas
-- demonstrativos nem em vans/rotas/passageiros, não altera RLS, não altera
-- salvar_rota_completa nem os cálculos de encaixe.
--
-- PRIVILÉGIOS: no Supabase, funções novas do schema public nascem executáveis
-- por anon (privilégios padrão). As RPCs novas são revogadas EXPLICITAMENTE de
-- anon e PUBLIC e concedidas só a authenticated.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Um perfil de motorista por conta
-- ----------------------------------------------------------------------------
create unique index if not exists drivers_owner_unico
  on public.drivers (owner_id)
  where owner_id is not null;

-- ----------------------------------------------------------------------------
-- 2) Pausa da oferta de uma rota (sem apagar, sem virar rascunho)
-- ----------------------------------------------------------------------------
alter table public.routes
  add column if not exists oferta_pausada boolean not null default false;
comment on column public.routes.oferta_pausada is
  'true = o motorista pausou a oferta desta rota: ela não entra na busca das famílias. Não muda o status (concluída/rascunho) nem os passageiros. salvar_rota_completa não altera esta coluna.';

-- ----------------------------------------------------------------------------
-- 3) Contato direto pelo WhatsApp: escolha do motorista, desligada por padrão
-- ----------------------------------------------------------------------------
alter table public.drivers
  add column if not exists contato_whatsapp_ativo boolean not null default false;
comment on column public.drivers.contato_whatsapp_ativo is
  'true = o motorista autorizou o botão "Conversar no WhatsApp" no perfil público. O número (drivers.whatsapp) é privado e nunca aparece na vitrine.';

-- ----------------------------------------------------------------------------
-- 4) Elegibilidade para a vitrine — sem documentos e sem exigir rota
-- ----------------------------------------------------------------------------
create or replace function public.motorista_elegivel(d public.drivers)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when coalesce((d).is_demo, false) then
      -- DEMONSTRAÇÃO: inalterado — basta estar publicado e não suspenso.
      (d).is_published and not (d).is_suspended
    else
      -- REAL: perfil com dono, publicado, não suspenso e anúncio ligado pelo
      -- próprio motorista. Rotas e vagas são decididas pela busca, não aqui.
      (d).owner_id is not null
        and (d).is_published and not (d).is_suspended
        and coalesce((d).anuncio_ativo, false)
  end;
$$;

-- ----------------------------------------------------------------------------
-- 5) Contato por WhatsApp: perfil visível E contato direto autorizado
-- ----------------------------------------------------------------------------
create or replace function public.solicitar_contato_whatsapp(
  p_slug          text,
  p_consent       boolean,
  p_destination_id text default null,
  p_turno         public.turno default null,
  p_contratacao   text default null,
  p_region        text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver  public.drivers%rowtype;
begin
  if p_consent is not true then
    raise exception 'Consentimento é obrigatório para obter o contato.';
  end if;

  select * into v_driver
  from public.drivers d
  where d.slug = p_slug
    and public.motorista_elegivel(d)
    and (d.is_demo or (d.contato_whatsapp_ativo and d.whatsapp is not null));

  if not found then
    raise exception 'Motorista não encontrado ou sem contato direto disponível.';
  end if;

  insert into public.leads (driver_id, destination_id, turno, contratacao, region, consent)
  values (v_driver.id, p_destination_id, p_turno, p_contratacao, p_region, true);

  return v_driver.whatsapp;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6) Vitrine: + indicador de contato direto (booleano; NUNCA o número)
--    Mesma definição de produção, com a coluna nova no FIM (exigência do
--    CREATE OR REPLACE VIEW). Os privilégios (somente leitura) são mantidos.
-- ----------------------------------------------------------------------------
create or replace view public.public_listings as
select
  d.id, d.slug, d.name, d.photo_url, d.van_photo_url, d.description,
  d.city_id, d.neighborhoods, d.turnos, d.capacity_total, d.seats_available,
  d.feature_ac, d.feature_monitor, d.feature_seatbelt, d.feature_accessible,
  d.price_type, d.price_month, d.price_daily, d.rating_avg, d.rating_count,
  d.boarding_time, d.tolerance_before_min, d.tolerance_after_min,
  d.doc_verified, d.is_demo,
  coalesce(
    (select array_agg(dd.destination_id) from public.driver_destinations dd where dd.driver_id = d.id),
    '{}'
  ) as destination_ids,
  d.contato_whatsapp_ativo
from public.drivers d
where public.motorista_elegivel(d);

-- Defesa explícita (além de CREATE OR REPLACE manter os privilégios): a vitrine
-- continua SOMENTE LEITURA para anon/authenticated (correção 20261112194000).
revoke insert, update, delete, truncate on table public.public_listings from anon, authenticated, public;

-- ----------------------------------------------------------------------------
-- 6b) Perfil só nasce pela RPC salvar_perfil_motorista (SECURITY DEFINER, não
--     precisa deste privilégio). Edição direta do PRÓPRIO perfil segue pela RLS
--     (o gatilho protege nota, selo, suspensão, demo, dono e slug).
-- ----------------------------------------------------------------------------
revoke insert on table public.drivers from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7a) Criar ou atualizar o PRÓPRIO perfil profissional
-- ----------------------------------------------------------------------------
create or replace function public.salvar_perfil_motorista(
  p_nome                   text,
  p_descricao              text,
  p_city_id                text,
  p_whatsapp               text,
  p_contato_whatsapp_ativo boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_nome  text := btrim(coalesce(p_nome, ''));
  v_desc  text := nullif(btrim(coalesce(p_descricao, '')), '');
  v_zap   text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
  v_base  text;
  v_slug  text;
  v_id    uuid;
  v_tent  int := 0;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para salvar o perfil.' using errcode = '42501';
  end if;
  if char_length(v_nome) < 2 or char_length(v_nome) > 60 then
    raise exception 'O nome de apresentação precisa ter de 2 a 60 letras.' using errcode = '22023';
  end if;
  if v_desc is not null and char_length(v_desc) > 600 then
    raise exception 'A apresentação pode ter no máximo 600 caracteres.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.cities c where c.id = p_city_id) then
    raise exception 'Escolha uma cidade da lista.' using errcode = '22023';
  end if;
  -- WhatsApp OBRIGATÓRIO. Celular brasileiro: 55 + DDD + 9 + 8 dígitos
  -- (aceita sem o 55 e completa; nada é inventado).
  if v_zap ~ '^[1-9][1-9]9[0-9]{8}$' then
    v_zap := '55' || v_zap;
  end if;
  if v_zap is null then
    raise exception 'Informe o seu WhatsApp (com DDD).' using errcode = '22023';
  end if;
  if v_zap !~ '^55[1-9][1-9]9[0-9]{8}$' then
    raise exception 'Confira o WhatsApp: use DDD e número de celular, como (18) 99999-0000.' using errcode = '22023';
  end if;

  -- Um salvamento por vez para a mesma conta (evita perfil duplicado em clique duplo).
  perform pg_advisory_xact_lock(hashtext('vanbora:perfil_motorista:' || v_uid::text));

  select d.id into v_id from public.drivers d where d.owner_id = v_uid;

  if v_id is not null then
    -- PERFIL EXISTENTE: só os campos do perfil. Slug, nota, selo, suspensão e
    -- demonstração ficam como estão (o gatilho proteger_campos_driver garante).
    update public.drivers
       set name = v_nome, description = v_desc, city_id = p_city_id, whatsapp = v_zap,
           contato_whatsapp_ativo = coalesce(p_contato_whatsapp_ativo, false)
     where id = v_id and owner_id = v_uid;
  else
    -- PERFIL NOVO: slug legível, único e fixo depois de criado.
    v_base := lower(translate(v_nome,
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'));
    v_base := btrim(regexp_replace(v_base, '[^a-z0-9]+', '-', 'g'), '-');
    v_base := left(coalesce(nullif(v_base, ''), 'motorista'), 40);
    v_slug := v_base;
    while exists (select 1 from public.drivers d where d.slug = v_slug) loop
      v_tent := v_tent + 1;
      if v_tent > 20 then
        raise exception 'Não foi possível gerar o endereço do perfil. Tente de novo.';
      end if;
      v_slug := v_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 5);
    end loop;

    insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;
    insert into public.drivers (owner_id, slug, name, description, city_id, whatsapp, contato_whatsapp_ativo,
                                is_published, anuncio_ativo, is_demo)
    values (v_uid, v_slug, v_nome, v_desc, p_city_id, v_zap, coalesce(p_contato_whatsapp_ativo, false),
            true, false, false)
    returning id into v_id;
  end if;

  insert into public.user_roles (user_id, role) values (v_uid, 'motorista')
  on conflict (user_id, role) do nothing;

  return (select jsonb_build_object(
            'id', d.id, 'slug', d.slug, 'nome', d.name, 'descricao', d.description,
            'cidade_id', d.city_id, 'whatsapp', d.whatsapp,
            'contato_whatsapp_ativo', d.contato_whatsapp_ativo,
            'anuncio_ativo', d.anuncio_ativo, 'suspenso', d.is_suspended)
          from public.drivers d where d.id = v_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- 7b) Publicar / despublicar o PRÓPRIO perfil (RLS de drivers vale: invoker)
-- ----------------------------------------------------------------------------
create or replace function public.publicar_perfil_motorista(p_ativo boolean)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para publicar o perfil.' using errcode = '42501';
  end if;
  update public.drivers set anuncio_ativo = coalesce(p_ativo, false)
   where owner_id = v_uid and not is_demo;
  if not found then
    raise exception 'Crie seu perfil profissional antes de publicar.' using errcode = 'P0002';
  end if;
  return coalesce(p_ativo, false);
end;
$$;

-- ----------------------------------------------------------------------------
-- 7b2) Ativar / desativar o contato direto pelo WhatsApp (PRÓPRIO perfil)
-- ----------------------------------------------------------------------------
create or replace function public.definir_contato_whatsapp(p_ativo boolean)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para alterar o contato.' using errcode = '42501';
  end if;
  update public.drivers set contato_whatsapp_ativo = coalesce(p_ativo, false)
   where owner_id = v_uid and not is_demo
     and (not coalesce(p_ativo, false) or whatsapp is not null);
  if not found then
    raise exception 'Cadastre seu perfil e seu WhatsApp antes de ativar o contato.' using errcode = 'P0002';
  end if;
  return coalesce(p_ativo, false);
end;
$$;

-- ----------------------------------------------------------------------------
-- 7c) Ler o PRÓPRIO perfil + situação (invoker: RLS do dono)
--     rotas_disponiveis = rotas concluídas, não pausadas, com van do dono:
--     são as que a busca AVALIA (quem decide vaga/encaixe é o motor).
-- ----------------------------------------------------------------------------
create or replace function public.meu_perfil_motorista()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select case when auth.uid() is null then null else (
    select jsonb_build_object(
      'id', d.id, 'slug', d.slug, 'nome', d.name, 'descricao', d.description,
      'cidade_id', d.city_id, 'whatsapp', d.whatsapp,
      'contato_whatsapp_ativo', d.contato_whatsapp_ativo,
      'anuncio_ativo', d.anuncio_ativo, 'suspenso', d.is_suspended,
      'rotas_disponiveis', (
        select count(*) from public.routes r
        join public.vehicles v on v.id = r.vehicle_id and v.owner_id = r.owner_id
        where r.owner_id = d.owner_id and r.status = 'concluida' and not r.oferta_pausada
          and not r.is_demo and not v.is_demo),
      'visivel', public.motorista_elegivel(d))
    from public.drivers d
    where d.owner_id = auth.uid() and not d.is_demo
  ) end;
$$;

-- ----------------------------------------------------------------------------
-- Privilégios das RPCs novas: só usuário autenticado
-- ----------------------------------------------------------------------------
revoke execute on function public.salvar_perfil_motorista(text, text, text, text, boolean) from public, anon;
revoke execute on function public.publicar_perfil_motorista(boolean) from public, anon;
revoke execute on function public.definir_contato_whatsapp(boolean) from public, anon;
revoke execute on function public.meu_perfil_motorista() from public, anon;
grant execute on function public.salvar_perfil_motorista(text, text, text, text, boolean) to authenticated;
grant execute on function public.publicar_perfil_motorista(boolean) to authenticated;
grant execute on function public.definir_contato_whatsapp(boolean) to authenticated;
grant execute on function public.meu_perfil_motorista() to authenticated;

-- Autoverificação: aborta (desfaz tudo) se algo não ficou como esperado.
do $$
begin
  if has_function_privilege('anon', 'public.salvar_perfil_motorista(text, text, text, text, boolean)', 'EXECUTE')
     or has_function_privilege('anon', 'public.publicar_perfil_motorista(boolean)', 'EXECUTE')
     or has_function_privilege('anon', 'public.definir_contato_whatsapp(boolean)', 'EXECUTE')
     or has_function_privilege('anon', 'public.meu_perfil_motorista()', 'EXECUTE') then
    raise exception 'RPC de perfil executável por anon: abortando';
  end if;
  -- A vitrine continua legível por anon (a view chama motorista_elegivel).
  if not has_function_privilege('anon', 'public.motorista_elegivel(public.drivers)', 'EXECUTE')
     or not has_table_privilege('anon', 'public.public_listings', 'SELECT') then
    raise exception 'A vitrine pública deixaria de ser legível: abortando';
  end if;
  -- A vitrine continua somente leitura (correção 20261112194000).
  if has_table_privilege('anon', 'public.public_listings', 'INSERT')
     or has_table_privilege('anon', 'public.public_listings', 'UPDATE')
     or has_table_privilege('anon', 'public.public_listings', 'DELETE')
     or has_table_privilege('authenticated', 'public.public_listings', 'INSERT')
     or has_table_privilege('authenticated', 'public.public_listings', 'UPDATE')
     or has_table_privilege('authenticated', 'public.public_listings', 'DELETE') then
    raise exception 'A vitrine voltou a aceitar escrita: abortando';
  end if;
  -- Perfil só nasce pela RPC.
  if has_table_privilege('anon', 'public.drivers', 'INSERT')
     or has_table_privilege('authenticated', 'public.drivers', 'INSERT') then
    raise exception 'INSERT direto em drivers continua liberado: abortando';
  end if;
  -- O número nunca aparece na vitrine.
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'public_listings' and column_name in ('whatsapp', 'owner_id')) then
    raise exception 'A vitrine passaria a expor telefone/dono: abortando';
  end if;
end $$;
