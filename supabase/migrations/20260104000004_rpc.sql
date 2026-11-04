-- ============================================================================
-- Vambora — Migração 0004: RPCs públicas seguras (SECURITY DEFINER)
-- ----------------------------------------------------------------------------
-- O público não escreve direto nas tabelas. Usa estas funções, que validam
-- consentimento, registram o lead e devolvem só o necessário.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Registra o contato (lead) e devolve o WhatsApp do motorista publicado.
-- Protege o telefone de varredura em massa: só é devolvido ao pedir contato,
-- e o pedido fica registrado. (Rate-limit por IP/app deve ser adicionado
-- na borda — ver docs/PENDENCIAS.md.)
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
  from public.drivers
  where slug = p_slug and is_published and not is_suspended;

  if not found then
    raise exception 'Motorista não encontrado ou indisponível.';
  end if;

  insert into public.leads (driver_id, destination_id, turno, contratacao, region, consent)
  values (v_driver.id, p_destination_id, p_turno, p_contratacao, p_region, true);

  return v_driver.whatsapp;
end;
$$;

-- ----------------------------------------------------------------------------
-- Registra interesse (waitlist) quando não há van compatível.
-- ----------------------------------------------------------------------------
create or replace function public.registrar_interesse(
  p_city_id        text,
  p_contact_name   text,
  p_contact_whatsapp text,
  p_consent        boolean,
  p_region         text default null,
  p_destination_id text default null,
  p_turno          public.turno default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_consent is not true then
    raise exception 'Consentimento é obrigatório.';
  end if;
  if coalesce(trim(p_contact_name), '') = '' or coalesce(trim(p_contact_whatsapp), '') = '' then
    raise exception 'Nome e WhatsApp são obrigatórios.';
  end if;

  insert into public.waitlist_requests
    (city_id, region, destination_id, turno, contact_name, contact_whatsapp, consent)
  values
    (p_city_id, p_region, p_destination_id, p_turno, p_contact_name, p_contact_whatsapp, true)
  returning id into v_id;

  return v_id;
end;
$$;

-- Expõe as RPCs ao público (a validação está dentro das funções).
grant execute on function public.solicitar_contato_whatsapp(text, boolean, text, public.turno, text, text) to anon, authenticated;
grant execute on function public.registrar_interesse(text, text, text, boolean, text, text, public.turno) to anon, authenticated;
