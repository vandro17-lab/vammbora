#!/usr/bin/env bash
# ============================================================================
# Aplica TODAS as migrações num PostgreSQL LOCAL descartável e roda o teste do
# pré-lançamento (tabela prelaunch_leads + função de gravação). Não toca no
# Supabase.
#
#   supabase/tests/rodar-prelancamento-local.sh
#
# Requisitos: PostgreSQL 14+ instalado (initdb/pg_ctl/psql).
# A migração 0018 é aplicada DUAS vezes para provar que é idempotente.
#
# Com MANTER=1 o servidor continua no ar ao final (para testes de ponta a
# ponta): o script imprime PGHOST/PGPORT e o comando para encerrar.
# ============================================================================
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$(dirname "$(command -v initdb || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")"
DIR="$(mktemp -d /tmp/vanbora-pg.XXXXXX)"
PORTA="${PGPORT_TESTE:-54331}"
COMO=""; if [ "$(id -u)" = "0" ]; then COMO="runuser -u postgres --"; chown postgres "$DIR"; fi
parar() { $COMO "$BIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
[ "${MANTER:-0}" = "1" ] || trap parar EXIT

$COMO "$BIN/initdb" -D "$DIR/data" -A trust -U postgres >/dev/null
$COMO "$BIN/pg_ctl" -D "$DIR/data" -o "-p $PORTA -c listen_addresses='' -k $DIR" -l "$DIR/log" -w start >/dev/null
SQL() { PGOPTIONS="-c client_min_messages=warning" psql -X -q -v ON_ERROR_STOP=1 -h "$DIR" -p "$PORTA" -U postgres -d postgres "$@"; }

SQL -c "create extension if not exists pgcrypto" -f "$RAIZ/tests/local/00_stubs_supabase.sql"
# Como no Supabase: tabelas e funções novas nascem com privilégios para anon e
# authenticated. A migração precisa fechar isso explicitamente — é o que testamos.
SQL -c "alter default privileges in schema public grant all on tables to anon, authenticated" \
    -c "alter default privileges in schema public grant execute on functions to anon, authenticated, service_role"
NOVA="$RAIZ/migrations/20260104000018_prelaunch_leads.sql"
for f in "$RAIZ"/migrations/*.sql; do
  [ "$f" = "$NOVA" ] && continue
  echo "· $(basename "$f")"; SQL -f "$f" >/dev/null
done
echo "· $(basename "$NOVA")";                        SQL -f "$NOVA" >/dev/null
echo "· $(basename "$NOVA") (2ª vez: idempotência)"; SQL -f "$NOVA" >/dev/null
echo "· teste prelaunch_leads.sql";                  SQL -f "$RAIZ/tests/prelaunch_leads.sql"
echo "OK — migrações aplicadas e teste do pré-lançamento aprovado."
if [ "${MANTER:-0}" = "1" ]; then
  # Limpa os contatos fictícios do teste: o banco fica pronto para o teste de ponta a ponta.
  SQL -c "truncate public.prelaunch_leads, public.prelaunch_submission_log"
  echo "PGHOST=$DIR PGPORT=$PORTA"
  echo "Para encerrar: $COMO $BIN/pg_ctl -D $DIR/data -m immediate stop && rm -rf $DIR"
fi
