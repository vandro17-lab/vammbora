# 08 — Riscos, Recuperação e Reconciliação

## Riscos principais (ordenados por impacto)
1. **Regressão do marketplace ao ligar a van (GAP-1).** Mudar a fonte de verdade de recursos/capacidade (vehicles↔drivers↔view) pode fazer motoristas sumirem/aparecerem errado na vitrine.
   - *Mitigação:* decidir a abordagem em `05` Fase 5 antes de codar; migração aditiva; testar `public_listings` antes/depois; flag se preciso.
   - *Recuperação:* reverter serviço/mapeador; migração com rollback documentado.
2. **Perda de IDs/vínculos/compromissos ao salvar rota (RPC apaga-e-recria).** `salvar_rota_completa` deleta e recria `route_stops`/`route_passengers`; se o cliente não reenviar ids/campos, perde-se vínculo e compromissos (0010).
   - *Mitigação:* aplicar a correção recomendada (upsert por `id` + `COALESCE` nos campos de compromisso, remover só o que saiu do payload) **antes** da Fase 7; garantir que `rotaParaBanco` reenvia ids e os 5 campos.
   - *Recuperação:* `routes.version` para concorrência; backup lógico antes de editar em massa.
3. **Migração 0010 não aplicada.** Leitura/escrita dos compromissos quebra ou vem vazia enquanto as colunas não existem.
   - *Mitigação:* aplicar 0010 (aditiva) só após aprovação, junto da correção da RPC; até lá, telas de passageiros tratam os campos como ausentes.
4. **Quebra de login/sessão** ao mexer na entrada (Fase 4).
   - *Mitigação:* não tocar `auth.tsx`; só apresentação; preservar callback OAuth.
5. **Deep links / PWA** ao unificar rotas (Fase 2): manter redirects de `/painel/*` e `/pro`.
6. **Apresentar demo como real** (Clube/financeiro). *Mitigação:* `07` + marcação discreta.
7. **Divergência de contexto entre conversas.** *Mitigação:* `09` sempre atualizado; nada depende da memória do chat.

## Procedimento de recuperação (geral)
- Trabalhar **1 fase = 1+ commits pequenos**; nunca um commit gigante.
- Antes de migração: `justificativa, tabelas, campos, compatibilidade, impacto nas consultas, impacto no marketplace, RLS, aditiva, testes, rollback` (ver `11`? — resumo aqui).
- Toda migração **aditiva** (add column/table nullable); nunca destrutiva sem backup e aprovação.
- Rollback de código: `git revert <commit>`; rollback de branch nunca por force em branch de outro agente.

## Reconciliação obrigatória antes de implementar (fazer no início de CADA fase futura)
1. `git fetch origin` e comparar:
   - `main` mudou? (novos merges além de `011fb14`)
   - `src/engine/*` mudou? (motores são intocáveis sem fase própria)
   - **PR #14** (`ccr-f18e6a2b-a7ex08`) foi mergeado ou atualizado?
2. **Ordem de reconciliação recomendada** para telas de rota/passageiro/encaixe:
   a. Mergear/estabilizar **PR #14** (consolidação + geolocalização) na base de trabalho.
   b. Aplicar **migração 0010** (após aprovação) — aditiva.
   c. Aplicar **correção da RPC `salvar_rota_completa`** (após aprovação).
   d. Só então Fases 7/8 que gravam rotas.
3. Registrar em `09` o commit/base reconciliado.

## Estado do banco hoje (para detectar mudança futura)
Projeto `rnulmjdsvvuirqijemzy` (ACTIVE_HEALTHY, sa-east-1). Migrações aplicadas:
`core_schema, rls_policies, storage_buckets, rpc_functions, security_hardening,
proteger_campos_driver`. Contagens: **drivers=6 (is_demo), routes=0, route_stops=0,
route_passengers=0, vehicles=0, destinations=46, cities=1**. RLS ativa; `route_passengers`
sem colunas de compromisso. Se algo disto mudar, reauditar antes de prosseguir.

## Git / segurança desta linha
- Branch de documentação: `docs/plano-vambora-motoristas` (base `origin/main` `011fb14`).
- Só documentação; **sem** merge, deploy, migração ou mudança de código funcional.
- Não sobrescrever `ccr-f18e6a2b-a7ex08` (PR #14) nem branches de outros agentes.
