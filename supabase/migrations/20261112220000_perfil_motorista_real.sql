-- ============================================================================
-- VanBora — Perfil profissional REAL do motorista e publicação sem documentos
-- ----------------------------------------------------------------------------
-- NÃO APLICADA. Prepare/revise e aplique pela ferramenta de migração do Supabase
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
-- O QUE ESTA MIGRAÇÃO FAZ (aditiva; não altera nenhuma linha existente):
--   1) índice único parcial: no máximo UM perfil de motorista por conta;
--   2) motorista_elegivel(): ramo de DEMONSTRAÇÃO idêntico ao anterior; ramo
--      REAL sem documentos: publicado + não suspenso + anúncio ativo + dono +
--      ao menos uma rota real CONCLUÍDA com uma van do PRÓPRIO dono;
--   3) solicitar_contato_whatsapp(): passa a exigir motorista_elegivel(), para
--      o WhatsApp de um perfil NÃO publicado não ser entregue a ninguém (para
--      os motoristas de demonstração o comportamento é o mesmo de antes);
--   4) RPC salvar_perfil_motorista(): cria ou atualiza o perfil DO PRÓPRIO
--      usuário (nunca de outro), gera slug único e fixo, atribui o papel
--      'motorista'; campos reservados seguem protegidos pelo gatilho existente;
--   5) RPC publicar_perfil_motorista(): liga/desliga o anúncio do próprio perfil;
--   6) RPC meu_perfil_motorista(): lê o próprio perfil e a situação de
--      publicação (o que falta para aparecer às famílias).
--
-- NÃO FAZ: não recria a view public_listings (CREATE OR REPLACE FUNCTION mantém
-- a view e os privilégios da função), não apaga as tabelas/funções de
-- documentos, não toca nos 156 motoristas demonstrativos nem em vans/rotas,
-- não altera RLS nem o algoritmo de busca.
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
-- 2) Elegibilidade para a vitrine — sem exigência documental
-- ----------------------------------------------------------------------------
create or replace function public.motorista_elegivel(d public.drivers)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when coalesce((d).is_demo, false) then
      -- DEMONSTRAÇÃO: inalterado — basta estar publicado e não suspenso.
      (d).is_published and not (d).is_suspended
    else
      -- REAL: perfil com dono, publicado, não suspenso, anúncio ligado pelo
      -- próprio motorista e ao menos uma rota real concluída com van do dono.
      (d).owner_id is not null
        and (d).is_published and not (d).is_suspended
        and coalesce((d).anuncio_ativo, false)
        and exists (
          select 1
          from public.routes r
          join public.vehicles v on v.id = r.vehicle_id and v.owner_id = r.owner_id
          where r.owner_id = (d).owner_id
            and r.status = 'concluida'
            and not r.is_demo
            and not v.is_demo
        )
  end;
$$;

-- ----------------------------------------------------------------------------
-- 3) Contato por WhatsApp só para motorista elegível (visível na vitrine)
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
  where d.slug = p_slug and public.motorista_elegivel(d);

  if not found then
    raise exception 'Motorista não encontrado ou indisponível.';
  end if;

  insert into public.leads (driver_id, destination_id, turno, contratacao, region, consent)
  values (v_driver.id, p_destination_id, p_turno, p_contratacao, p_region, true);

  return v_driver.whatsapp;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) Criar ou atualizar o PRÓPRIO perfil profissional
-- ----------------------------------------------------------------------------
create or replace function public.salvar_perfil_motorista(
  p_nome             text,
  p_descricao        text,
  p_city_id          text,
  p_whatsapp_contato text default null
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
  v_zap   text := nullif(regexp_replace(coalesce(p_whatsapp_contato, ''), '\D', '', 'g'), '');
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
  -- Celular brasileiro: 55 + DDD + 9 + 8 dígitos (aceita sem o 55 e completa).
  if v_zap ~ '^[1-9][1-9]9[0-9]{8}$' then
    v_zap := '55' || v_zap;
  end if;
  if v_zap is not null and v_zap !~ '^55[1-9][1-9]9[0-9]{8}$' then
    raise exception 'Confira o WhatsApp: use DDD e número de celular, como (18) 99999-0000.' using errcode = '22023';
  end if;

  -- Um salvamento por vez para a mesma conta (evita perfil duplicado em clique duplo).
  perform pg_advisory_xact_lock(hashtext('vanbora:perfil_motorista:' || v_uid::text));

  select d.id into v_id from public.drivers d where d.owner_id = v_uid;

  if v_id is not null then
    -- PERFIL EXISTENTE: só os campos do perfil. Slug, nota, selo, suspensão e
    -- demonstração ficam como estão (o gatilho proteger_campos_driver garante).
    update public.drivers
       set name = v_nome, description = v_desc, city_id = p_city_id, whatsapp = v_zap
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
    insert into public.drivers (owner_id, slug, name, description, city_id, whatsapp,
                                is_published, anuncio_ativo, is_demo)
    values (v_uid, v_slug, v_nome, v_desc, p_city_id, v_zap, true, false, false)
    returning id into v_id;
  end if;

  insert into public.user_roles (user_id, role) values (v_uid, 'motorista')
  on conflict (user_id, role) do nothing;

  return (select jsonb_build_object(
            'id', d.id, 'slug', d.slug, 'nome', d.name, 'descricao', d.description,
            'cidade_id', d.city_id, 'whatsapp_contato', d.whatsapp,
            'anuncio_ativo', d.anuncio_ativo, 'suspenso', d.is_suspended)
          from public.drivers d where d.id = v_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) Publicar / despublicar o PRÓPRIO perfil (RLS de drivers vale: invoker)
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
-- 6) Ler o PRÓPRIO perfil + situação de publicação (invoker: RLS do dono)
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
      'cidade_id', d.city_id, 'whatsapp_contato', d.whatsapp,
      'anuncio_ativo', d.anuncio_ativo, 'suspenso', d.is_suspended,
      'rota_concluida_com_van', exists (
        select 1 from public.routes r
        join public.vehicles v on v.id = r.vehicle_id and v.owner_id = r.owner_id
        where r.owner_id = d.owner_id and r.status = 'concluida' and not r.is_demo and not v.is_demo),
      'visivel', public.motorista_elegivel(d))
    from public.drivers d
    where d.owner_id = auth.uid() and not d.is_demo
  ) end;
$$;

-- ----------------------------------------------------------------------------
-- Privilégios das RPCs novas: só usuário autenticado
-- ----------------------------------------------------------------------------
revoke execute on function public.salvar_perfil_motorista(text, text, text, text) from public, anon;
revoke execute on function public.publicar_perfil_motorista(boolean) from public, anon;
revoke execute on function public.meu_perfil_motorista() from public, anon;
grant execute on function public.salvar_perfil_motorista(text, text, text, text) to authenticated;
grant execute on function public.publicar_perfil_motorista(boolean) to authenticated;
grant execute on function public.meu_perfil_motorista() to authenticated;

-- Autoverificação: aborta (desfaz tudo) se algo não ficou como esperado.
do $$
begin
  if has_function_privilege('anon', 'public.salvar_perfil_motorista(text, text, text, text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.publicar_perfil_motorista(boolean)', 'EXECUTE')
     or has_function_privilege('anon', 'public.meu_perfil_motorista()', 'EXECUTE') then
    raise exception 'RPC de perfil executável por anon: abortando';
  end if;
  -- A vitrine continua legível por anon (a view chama motorista_elegivel).
  if not has_function_privilege('anon', 'public.motorista_elegivel(public.drivers)', 'EXECUTE') then
    raise exception 'anon perdeu EXECUTE em motorista_elegivel: a vitrine pararia';
  end if;
  -- A vitrine continua somente leitura (correção 20261112194000).
  if has_table_privilege('anon', 'public.public_listings', 'UPDATE')
     or has_table_privilege('authenticated', 'public.public_listings', 'INSERT') then
    raise exception 'A vitrine voltou a aceitar escrita: abortando';
  end if;
end $$;
