-- ============================================================================
-- Vambora — Migração 0006: proteger campos reservados da tabela drivers
-- ----------------------------------------------------------------------------
-- As políticas RLS já limitam QUAIS linhas um motorista pode inserir/editar
-- (as suas). Mas RLS não limita QUAIS COLUNAS. Sem isto, um motorista poderia
-- enviar, na inserção ou na atualização do próprio cadastro, valores indevidos
-- (ex.: doc_verified = true, nota alta, tirar a própria suspensão).
--
-- Este gatilho BEFORE INSERT/UPDATE fixa os campos reservados à equipe quando
-- quem escreve NÃO é admin (e não é uma operação de servidor confiável, em que
-- auth.uid() é nulo — service_role/psql). Assim a proteção vale para QUALQUER
-- caminho (API REST, app), não só escondendo na interface.
--
-- NÃO é destrutivo: não apaga dados, só impede escalonamento de privilégio.
-- Campos reservados: doc_verified, rating_avg, rating_count, is_suspended,
-- is_demo, owner_id (não transferível), slug (fixo após criação).
-- ============================================================================

create or replace function public.proteger_campos_driver()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admin e operações de servidor (sem usuário autenticado) podem tudo.
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Cadastro novo não pode nascer verificado, avaliado, suspenso ou como demo.
    new.doc_verified := false;
    new.rating_avg   := 0;
    new.rating_count := 0;
    new.is_suspended := false;
    new.is_demo      := false;
  elsif tg_op = 'UPDATE' then
    -- Mantém os valores antigos dos campos reservados (bloqueia a alteração).
    new.doc_verified := old.doc_verified;
    new.rating_avg   := old.rating_avg;
    new.rating_count := old.rating_count;
    new.is_suspended := old.is_suspended;
    new.is_demo      := old.is_demo;
    new.owner_id     := old.owner_id;  -- não pode transferir o cadastro
    new.slug         := old.slug;      -- slug fixo após a criação
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_driver on public.drivers;
create trigger trg_proteger_driver
  before insert or update on public.drivers
  for each row execute function public.proteger_campos_driver();
