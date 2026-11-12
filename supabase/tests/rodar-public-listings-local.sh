#!/usr/bin/env bash
# ============================================================================
# Prova, num PostgreSQL LOCAL descartável, que a vitrine pública
# (public.public_listings) é SOMENTE LEITURA. Não toca no Supabase.
#
#   supabase/tests/rodar-public-listings-local.sh
#
# Requisitos: PostgreSQL 14+ (initdb/pg_ctl/psql). Como root, o servidor sobe
# com o usuário de sistema `postgres`.
#
# Reproduz os privilégios padrão do Supabase (anon/authenticated recebem TODOS
# os privilégios em objetos novos do schema public), aplica as migrações
# ANTERIORES à correção e confere que o teste ACUSA a falha; aplica a correção
# (duas vezes: idempotência) e confere que o teste passa, que a escrita real é
# recusada, que a leitura continua e que CREATE OR REPLACE VIEW mantém o bloqueio.
# ============================================================================
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$(dirname "$(command -v initdb || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")"
DIR="$(mktemp -d /tmp/vanbora-pg.XXXXXX)"
PORTA="${PGPORT_TESTE:-54330}"
COMO=""; if [ "$(id -u)" = "0" ]; then COMO="runuser -u postgres --"; chown postgres "$DIR"; fi
parar() { $COMO "$BIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap parar EXIT

$COMO "$BIN/initdb" -D "$DIR/data" -A trust -U postgres >/dev/null
$COMO "$BIN/pg_ctl" -D "$DIR/data" -o "-p $PORTA -c listen_addresses='' -k $DIR" -l "$DIR/log" -w start >/dev/null
SQL() { PGOPTIONS="-c client_min_messages=warning" psql -X -q -v ON_ERROR_STOP=1 -h "$DIR" -p "$PORTA" -U postgres -d postgres "$@"; }
falhar() { echo "FALHOU: $*" >&2; exit 1; }

CORRECAO="$RAIZ/migrations/20261112194000_bloquear_escrita_public_listings.sql"
TESTE="$RAIZ/tests/public_listings_somente_leitura.sql"

SQL -c "create extension if not exists pgcrypto" -f "$RAIZ/tests/local/00_stubs_supabase.sql"
# Igual ao Supabase: objetos novos do schema public nascem com tudo para
# anon/authenticated — tabelas/views E funções. (A view chama
# motorista_elegivel(); numa view, EXECUTE de função é conferido com o papel de
# quem consulta, por isso a leitura anônima depende desse privilégio.)
SQL -c "alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
        alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;"
# Só as migrações ANTERIORES à correção (as posteriores dependem dela).
for f in "$RAIZ"/migrations/*.sql; do
  [[ "$(basename "$f")" < "$(basename "$CORRECAO")" ]] || continue
  echo "· $(basename "$f")"; SQL -f "$f" >/dev/null
done
SQL -c "insert into public.cities(id,name,uf) values ('aracatuba-sp','Araçatuba','SP') on conflict do nothing;
        insert into public.drivers(slug,name,city_id,is_demo,is_published) values ('demo-teste','Motorista Demo','aracatuba-sp',true,true);" >/dev/null

echo "· teste ANTES da correção (deve acusar a falha)"
if SQL -f "$TESTE" >/dev/null 2>&1; then falhar "o teste não detectou a escrita aberta na vitrine"; fi

echo "· $(basename "$CORRECAO") (1ª vez)";            SQL -1 -f "$CORRECAO" >/dev/null
echo "· $(basename "$CORRECAO") (2ª vez: idempotência)"; SQL -1 -f "$CORRECAO" >/dev/null
echo "· teste DEPOIS da correção";                     SQL -f "$TESTE"

echo "· escrita real como anon é recusada"
for cmd in "update public.public_listings set name='X' where slug='demo-teste'" \
           "delete from public.public_listings where slug='demo-teste'" \
           "insert into public.public_listings(slug,name,city_id) values ('falso','X','aracatuba-sp')"; do
  if SQL -c "set role anon; $cmd" >/dev/null 2>&1; then falhar "anon conseguiu: $cmd"; fi
done
[ "$(SQL -At -c "select name from public.drivers where slug='demo-teste'")" = "Motorista Demo" ] || falhar "dados alterados"
[ "$(SQL -At -c "set role anon; select count(*) from public.public_listings")" = "1" ] || falhar "leitura anônima quebrou"

echo "· CREATE OR REPLACE VIEW mantém o bloqueio"
DEF="$(SQL -At -c "select pg_get_viewdef('public.public_listings'::regclass)")"
SQL -c "create or replace view public.public_listings as $DEF" >/dev/null
SQL -f "$TESTE" >/dev/null

echo "· migrações POSTERIORES à correção mantêm a vitrine somente leitura"
for f in "$RAIZ"/migrations/*.sql; do
  [[ "$(basename "$f")" > "$(basename "$CORRECAO")" ]] || continue
  echo "  · $(basename "$f")"; SQL -1 -f "$f" >/dev/null
done
SQL -f "$TESTE" >/dev/null

echo "OK — vitrine pública somente leitura; leitura preservada."
