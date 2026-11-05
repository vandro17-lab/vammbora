-- ============================================================================
-- PROPOSTA — Fase 2 (dados do compromisso de atendimento por aluno)
-- ----------------------------------------------------------------------------
-- STATUS: PROPOSTA — NÃO APLICAR sem aprovação. Fica em docs/ de propósito,
--         fora de supabase/migrations/, para não ser aplicada por engano.
--         Ao aprovar, vira a migração 0010 em supabase/migrations/.
--
-- Migração ADITIVA e NÃO destrutiva. Acrescenta à tabela route_passengers os
-- campos do compromisso individual de cada aluno (DEC-012, DEC-020..023):
-- horário habitual, tolerância antes/depois, tempo de atendimento e a origem
-- da estimativa. Tudo NULLABLE: linha sem valor = NÃO informado (nunca deve
-- ser apresentado como confirmado pelo motorista).
-- ============================================================================

alter table public.route_passengers
  add column if not exists horario_habitual_min int,
  add column if not exists ajuste_antes_min     int,
  add column if not exists ajuste_depois_min    int,
  add column if not exists atendimento_min       int,
  add column if not exists atendimento_origem    text;

-- Restrições de domínio (idempotentes). Aceitam NULL (= não informado).
do $$ begin
  alter table public.route_passengers
    add constraint route_passengers_horario_habitual_chk
    check (horario_habitual_min is null or (horario_habitual_min >= 0 and horario_habitual_min < 1440));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.route_passengers
    add constraint route_passengers_ajuste_antes_chk
    check (ajuste_antes_min is null or (ajuste_antes_min >= 0 and ajuste_antes_min <= 120));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.route_passengers
    add constraint route_passengers_ajuste_depois_chk
    check (ajuste_depois_min is null or (ajuste_depois_min >= 0 and ajuste_depois_min <= 120));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.route_passengers
    add constraint route_passengers_atendimento_chk
    check (atendimento_min is null or (atendimento_min >= 0 and atendimento_min <= 60));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.route_passengers
    add constraint route_passengers_atendimento_origem_chk
    check (atendimento_origem is null or atendimento_origem in ('informado','provisorio','desconhecido'));
exception when duplicate_object then null; end $$;

comment on column public.route_passengers.horario_habitual_min is
  'Minuto do dia (0..1439) do horário habitual de atendimento do aluno neste sentido (ida: embarque na casa; volta: desembarque na casa). NULL = não informado. Não confundir com drivers.boarding_time (padrão do motorista) nem com routes.last_dropoff_min (limite da rota).';
comment on column public.route_passengers.ajuste_antes_min is
  'Tolerância, em minutos, ANTES do horário habitual deste aluno (DEC-006/DEC-012). Fixo=0. NULL = não informado.';
comment on column public.route_passengers.ajuste_depois_min is
  'Tolerância, em minutos, DEPOIS do horário habitual deste aluno (DEC-006/DEC-012). Fixo=0. NULL = não informado.';
comment on column public.route_passengers.atendimento_min is
  'Duração do atendimento do aluno na parada, em minutos (DEC-020..023). NULL = desconhecido.';
comment on column public.route_passengers.atendimento_origem is
  'Origem de atendimento_min: informado (motorista informou) | provisorio (estimativa do sistema) | desconhecido. NUNCA apresentar provisorio/NULL como confirmado pelo motorista.';

-- Observação: NÃO há alteração de RLS. As políticas de route_passengers
-- (dono/admin + leitura pública apenas de is_demo) continuam valendo para as
-- novas colunas automaticamente.
