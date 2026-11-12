#!/usr/bin/env bash
# ============================================================================
# Verificação PELA API REAL (PostgREST) da vitrine pública, com a chave ANON.
# Rode de um computador com acesso à internet.
#
# SEGURO MESMO SE A CORREÇÃO NÃO TIVER SIDO APLICADA — nada é gravado:
#   * PATCH e DELETE filtram por um id que não existe (0 linhas afetadas);
#   * POST usa uma cidade inexistente: se a escrita fosse permitida, o banco
#     recusaria pela chave estrangeira (409 / 23503), sem gravar nada.
#
# Esperado DEPOIS da correção:
#   GET    -> 200 e "content-range: 0-.../156" (ou o total atual da vitrine)
#   PATCH  -> 401 com "code":"42501"   (permission denied for view public_listings)
#   DELETE -> 401 com "code":"42501"
#   POST   -> 401 com "code":"42501"
# Se PATCH/DELETE vierem 204/200, ou POST vier 409/23503: a escrita AINDA está aberta.
# ============================================================================
set -u
U="https://rnulmjdsvvuirqijemzy.supabase.co"
K="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJudWxtamRzdnZ1aXJxaWplbXp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3NDk5NjIsImV4cCI6MjEwOTMyNTk2Mn0.Cbne-PvsCtoLcSHgLk89DwmU-bSMPYJvRy61B7_g3a4"   # chave ANON (pública, já está no site)
H=(-H "apikey: $K" -H "Authorization: Bearer $K" -H "Content-Type: application/json")
NADA="00000000-0000-0000-0000-000000000000"

echo "1) GET (leitura pública)";  curl -sS -o /dev/null -D - "${H[@]}" -H "Prefer: count=exact" "$U/rest/v1/public_listings?select=id&limit=1" | grep -iE "^HTTP|content-range"
echo "2) PATCH (alterar)";        curl -sS -w "\n   HTTP %{http_code}\n" "${H[@]}" -X PATCH  "$U/rest/v1/public_listings?id=eq.$NADA" -d '{"name":"teste"}'
echo "3) DELETE (apagar)";        curl -sS -w "\n   HTTP %{http_code}\n" "${H[@]}" -X DELETE "$U/rest/v1/public_listings?id=eq.$NADA"
echo "4) POST (criar)";           curl -sS -w "\n   HTTP %{http_code}\n" "${H[@]}" -H "Prefer: return=minimal" -X POST "$U/rest/v1/public_listings" -d '{"slug":"teste-nao-gravar","name":"teste","city_id":"cidade-inexistente-teste"}'
echo "5) Perfil público de um motorista (leitura usada por /van/:slug)"
curl -sS -o /dev/null -w "   HTTP %{http_code}\n" "${H[@]}" "$U/rest/v1/public_listings?select=slug,name&limit=1"
