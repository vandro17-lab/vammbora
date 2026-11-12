#!/usr/bin/env bash
# ============================================================================
# Testa, num PostgreSQL LOCAL descartável, a migração das solicitações das
# famílias (Etapa 3A). Não toca no Supabase.
#
#   supabase/tests/rodar-solicitacoes-local.sh
#
# Aplica as migrações anteriores com os privilégios padrão do Supabase, carrega
# o cenário, confere que a migração nova (duas vezes: idempotência) não altera
# nenhuma tabela existente e roda tests/solicitacoes.sql.
# ============================================================================
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$(dirname "$(command -v initdb || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")"
DIR="$(mktemp -d /tmp/vanbora-pg.XXXXXX)"
PORTA="${PGPORT_TESTE:-54333}"
COMO=""; if [ "$(id -u)" = "0" ]; then COMO="runuser -u postgres --"; chown postgres "$DIR"; fi
parar() { $COMO "$BIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap parar EXIT

$COMO "$BIN/initdb" -D "$DIR/data" -A trust -U postgres -E UTF8 --locale=C.UTF-8 >/dev/null
$COMO "$BIN/pg_ctl" -D "$DIR/data" -o "-p $PORTA -c listen_addresses='' -k $DIR" -l "$DIR/log" -w start >/dev/null
SQL() { PGOPTIONS="-c client_min_messages=warning" psql -X -q -v ON_ERROR_STOP=1 -h "$DIR" -p "$PORTA" -U postgres -d postgres "$@"; }
falhar() { echo "FALHOU: $*" >&2; exit 1; }

NOVA="$RAIZ/migrations/20261112230000_solicitacoes_familias.sql"

SQL -c "create extension if not exists pgcrypto" -f "$RAIZ/tests/local/00_stubs_supabase.sql"
SQL -c "alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
        alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;"
for f in "$RAIZ"/migrations/*.sql; do
  [[ "$(basename "$f")" < "$(basename "$NOVA")" ]] || continue
  SQL -f "$f" >/dev/null
done
echo "· migrações anteriores aplicadas"
SQL -f "$RAIZ/tests/local/20_perfil_motorista_dados.sql" >/dev/null
echo "· cenário carregado"

DIGITAL="select string_agg(t || '=' || n || ':' || h, ' ') from (
  select 'drivers' t, count(*) n, md5(coalesce(string_agg(to_jsonb(d)::text, '|' order by id), '')) h from public.drivers d
  union all select 'vehicles', count(*), md5(coalesce(string_agg(to_jsonb(v)::text, '|' order by id), '')) from public.vehicles v
  union all select 'routes', count(*), md5(coalesce(string_agg(to_jsonb(r)::text, '|' order by id), '')) from public.routes r
  union all select 'route_stops', count(*), md5(coalesce(string_agg(to_jsonb(s)::text, '|' order by id), '')) from public.route_stops s
  union all select 'route_passengers', count(*), md5(coalesce(string_agg(to_jsonb(p)::text, '|' order by id), '')) from public.route_passengers p
  union all select 'acl_vitrine', 0, md5(relacl::text) from pg_class where oid = 'public.public_listings'::regclass
) z"
ANTES="$(SQL -At -c "$DIGITAL")"
SQL -1 -f "$NOVA" >/dev/null; echo "· $(basename "$NOVA") (1ª vez)"
SQL -1 -f "$NOVA" >/dev/null; echo "· $(basename "$NOVA") (2ª vez: idempotência)"
[ "$(SQL -At -c "$DIGITAL")" = "$ANTES" ] || falhar "a migração alterou tabelas existentes ou a vitrine"
echo "· nenhuma tabela existente nem a vitrine mudaram"

if ! SAIDA="$(SQL -f "$RAIZ/tests/solicitacoes.sql" 2>&1)"; then
  echo "$SAIDA" | grep -E 'OK S|FALHA|ERROR' >&2
  falhar "tests/solicitacoes.sql"
fi
echo "$SAIDA" | grep -E '^OK'
[ "$(SQL -At -c "$DIGITAL")" = "$ANTES" ] || falhar "os testes alteraram tabelas de motoristas/rotas"
SQL -f "$RAIZ/tests/public_listings_somente_leitura.sql" >/dev/null && echo "· vitrine segue somente leitura"
echo "OK — solicitações das famílias aprovadas no banco local."
