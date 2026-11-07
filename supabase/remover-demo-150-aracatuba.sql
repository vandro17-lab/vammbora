-- =====================================================================
-- Vambora — BASE DEMONSTRATIVA "VB150" — REMOÇÃO SEGURA
-- ---------------------------------------------------------------------
-- Remove EXCLUSIVAMENTE os registros gerados por este pacote (prefixo de
-- uuid 'b150d0'). NÃO toca em: dados reais, destinos/escolas, nem em
-- demonstrações anteriores (que usam ids aleatórios sem esse prefixo).
-- Transacional e idempotente (rodar de novo não causa erro).
-- =====================================================================
begin;
delete from public.route_passengers   where id::text like 'b150d0%' or route_id::text like 'b150d0%';
delete from public.route_stops        where id::text like 'b150d0%' or route_id::text like 'b150d0%';
delete from public.driver_destinations where driver_id::text like 'b150d0%';
delete from public.routes             where id::text like 'b150d0%';
delete from public.vehicles           where id::text like 'b150d0%';
delete from public.drivers            where id::text like 'b150d0%';
commit;

