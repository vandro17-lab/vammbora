#!/usr/bin/env bash
# ============================================================================
# Testa, num PostgreSQL LOCAL descartável, a migração do perfil real do
# motorista. Não toca no Supabase.
#
#   supabase/tests/rodar-perfil-motorista-local.sh
#
# 1) aplica as migrações ANTERIORES com os privilégios padrão do Supabase
#    (tabelas e funções novas nascem com tudo para anon/authenticated);
# 2) carrega o cenário (contas A/B/C, motoristas demo, vans, rotas, aluno);
# 3) tira a "impressão digital" de todos os dados existentes e da vitrine;
# 4) aplica a migração nova (duas vezes: idempotência) e confere que NENHUM
#    dado existente mudou e que a vitrine continua igual;
# 5) roda tests/perfil_motorista.sql (cadastro, duplicidade, publicação,
#    isolamento, anônimo, validações, demonstração);
# 6) confere de novo que vans, rotas, paradas, alunos e demos não mudaram.
# ============================================================================
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$(dirname "$(command -v initdb || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")"
DIR="$(mktemp -d /tmp/vanbora-pg.XXXXXX)"
PORTA="${PGPORT_TESTE:-54332}"
COMO=""; if [ "$(id -u)" = "0" ]; then COMO="runuser -u postgres --"; chown postgres "$DIR"; fi
parar() { $COMO "$BIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap parar EXIT

# UTF-8 como em produção (com SQL_ASCII, acentos viram bytes e o slug sai errado).
$COMO "$BIN/initdb" -D "$DIR/data" -A trust -U postgres -E UTF8 --locale=C.UTF-8 >/dev/null
$COMO "$BIN/pg_ctl" -D "$DIR/data" -o "-p $PORTA -c listen_addresses='' -k $DIR" -l "$DIR/log" -w start >/dev/null
SQL() { PGOPTIONS="-c client_min_messages=warning" psql -X -q -v ON_ERROR_STOP=1 -h "$DIR" -p "$PORTA" -U postgres -d postgres "$@"; }
falhar() { echo "FALHOU: $*" >&2; exit 1; }

NOVA="$RAIZ/migrations/20261112220000_perfil_motorista_real.sql"

SQL -c "create extension if not exists pgcrypto" -f "$RAIZ/tests/local/00_stubs_supabase.sql"
SQL -c "alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
        alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;"
for f in "$RAIZ"/migrations/*.sql; do
  [ "$f" = "$NOVA" ] && continue
  SQL -f "$f" >/dev/null
done
echo "· migrações anteriores aplicadas"
SQL -f "$RAIZ/tests/local/20_perfil_motorista_dados.sql" >/dev/null
echo "· cenário carregado"

DIGITAL="select string_agg(t || '=' || n || ':' || h, ' ') from (
  select 'drivers' t, count(*) n, md5(coalesce(string_agg((to_jsonb(d) - 'contato_whatsapp_ativo')::text, '|' order by id), '')) h from public.drivers d
  union all select 'driver_destinations', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by driver_id, destination_id), '')) from public.driver_destinations x
  union all select 'vehicles', count(*), md5(coalesce(string_agg(to_jsonb(v)::text, '|' order by id), '')) from public.vehicles v
  union all select 'routes', count(*), md5(coalesce(string_agg((to_jsonb(r) - 'oferta_pausada')::text, '|' order by id), '')) from public.routes r
  union all select 'route_stops', count(*), md5(coalesce(string_agg(to_jsonb(s)::text, '|' order by id), '')) from public.route_stops s
  union all select 'route_passengers', count(*), md5(coalesce(string_agg(to_jsonb(p)::text, '|' order by id), '')) from public.route_passengers p
) z"
# Sem drivers (o teste cria perfis reais): só o que NÃO pode mudar.
INTOCAVEL="select string_agg(t || '=' || n || ':' || h, ' ') from (
  select 'drivers_demo' t, count(*) n, md5(coalesce(string_agg((to_jsonb(d) - 'contato_whatsapp_ativo')::text, '|' order by id), '')) h from public.drivers d where is_demo
  union all select 'driver_destinations', count(*), md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by driver_id, destination_id), '')) from public.driver_destinations x
  union all select 'vehicles', count(*), md5(coalesce(string_agg(to_jsonb(v)::text, '|' order by id), '')) from public.vehicles v
  union all select 'routes', count(*), md5(coalesce(string_agg((to_jsonb(r) - 'oferta_pausada')::text, '|' order by id), '')) from public.routes r where r.id <> 'aaaaaaaa-1111-4000-8000-000000000001'
  union all select 'route_stops', count(*), md5(coalesce(string_agg(to_jsonb(s)::text, '|' order by id), '')) from public.route_stops s where s.route_id <> 'aaaaaaaa-1111-4000-8000-000000000001'
  union all select 'route_passengers', count(*), md5(coalesce(string_agg(to_jsonb(p)::text, '|' order by id), '')) from public.route_passengers p where p.route_id <> 'aaaaaaaa-1111-4000-8000-000000000001'
) z"
VITRINE="begin; set local role anon; select count(*) || ':' || md5(coalesce(string_agg((to_jsonb(l) - 'contato_whatsapp_ativo')::text, '|' order by id), '')) from public.public_listings l; rollback;"

ANTES="$(SQL -At -c "$DIGITAL")"
INTOCAVEL_ANTES="$(SQL -At -c "$INTOCAVEL")"
VITRINE_ANTES="$(SQL -At -c "$VITRINE" | grep ':')"

SQL -1 -f "$NOVA" >/dev/null; echo "· $(basename "$NOVA") (1ª vez)"
SQL -1 -f "$NOVA" >/dev/null; echo "· $(basename "$NOVA") (2ª vez: idempotência)"

[ "$(SQL -At -c "$DIGITAL")" = "$ANTES" ] || falhar "a migração alterou dados existentes"
[ "$(SQL -At -c "$VITRINE" | grep ':')" = "$VITRINE_ANTES" ] || falhar "a vitrine mudou com a migração"
[ "$(SQL -At -c "select (select count(*) from public.routes where oferta_pausada) + (select count(*) from public.drivers where contato_whatsapp_ativo)")" = "0" ] || falhar "colunas novas deveriam nascer false"
echo "· nenhum dado existente mudou (colunas novas nascem false); vitrine idêntica (${VITRINE_ANTES%%:*} linha(s))"

if ! SAIDA="$(SQL -f "$RAIZ/tests/perfil_motorista.sql" 2>&1)"; then
  echo "$SAIDA" | grep -E 'OK T|FALHA|ERROR' >&2
  falhar "tests/perfil_motorista.sql"
fi
echo "$SAIDA" | grep -E '^OK'

[ "$(SQL -At -c "$INTOCAVEL")" = "$INTOCAVEL_ANTES" ] || falhar "vans, rotas, paradas, alunos ou demos mudaram"
echo "· vans, demais rotas, paradas, alunos e motoristas demo intactos após os testes"
SQL -f "$RAIZ/tests/public_listings_somente_leitura.sql" >/dev/null && echo "· vitrine segue somente leitura"
echo "OK — perfil real do motorista aprovado no banco local."
