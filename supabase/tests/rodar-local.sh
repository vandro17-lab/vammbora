#!/usr/bin/env bash
# ============================================================================
# Aplica TODAS as migrações num PostgreSQL LOCAL descartável e roda o teste da
# etapa 1 (modelo de dados das rotas). Não toca no Supabase.
#
#   supabase/tests/rodar-local.sh
#
# Requisitos: PostgreSQL 14+ instalado (initdb/pg_ctl/psql). Como root, o
# servidor sobe com o usuário de sistema `postgres`.
#
# O teste simula um banco JÁ EM USO: aplica 0001..0014, grava uma rota "antiga",
# só então aplica a 0015 (duas vezes, para provar que é idempotente) e confere
# que nada foi perdido nem inventado.
# ============================================================================
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$(dirname "$(command -v initdb || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")"
DIR="$(mktemp -d /tmp/vanbora-pg.XXXXXX)"
PORTA="${PGPORT_TESTE:-54329}"
COMO=""; if [ "$(id -u)" = "0" ]; then COMO="runuser -u postgres --"; chown postgres "$DIR"; fi
parar() { $COMO "$BIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap parar EXIT

$COMO "$BIN/initdb" -D "$DIR/data" -A trust -U postgres >/dev/null
$COMO "$BIN/pg_ctl" -D "$DIR/data" -o "-p $PORTA -c listen_addresses='' -k $DIR" -l "$DIR/log" -w start >/dev/null
SQL() { PGOPTIONS="-c client_min_messages=warning" psql -X -q -v ON_ERROR_STOP=1 -h "$DIR" -p "$PORTA" -U postgres -d postgres "$@"; }

SQL -c "create extension if not exists pgcrypto" -f "$RAIZ/tests/local/00_stubs_supabase.sql"
NOVA="$RAIZ/migrations/20260104000015_busca_encaixe_etapa1.sql"
for f in "$RAIZ"/migrations/*.sql; do
  [ "$f" = "$NOVA" ] && continue
  echo "· $(basename "$f")"; SQL -f "$f" >/dev/null
done
echo "· dados legados (antes da 0015)";      SQL -f "$RAIZ/tests/local/10_dados_legados.sql" >/dev/null
echo "· $(basename "$NOVA")";                 SQL -f "$NOVA" >/dev/null
echo "· $(basename "$NOVA") (2ª vez: idempotência)"; SQL -f "$NOVA" >/dev/null
echo "· teste etapa1_modelo_rotas.sql";       SQL -f "$RAIZ/tests/etapa1_modelo_rotas.sql"
echo "OK — migrações aplicadas e teste da etapa 1 aprovado."
