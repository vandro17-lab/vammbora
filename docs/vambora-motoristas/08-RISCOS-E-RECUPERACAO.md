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

## Estado da `main` e PRs (atualizado 2026-11-06)
- **PR #14 JÁ FOI INCORPORADO à `main`**: a `main` está em **`3965b73`** (Merge PR #14). A consolidação do Algoritmo Supremo (Fases 1/2/4) + geolocalização estão na `main`. Não há mais o que "mergear do PR #14".
- Fase 1 (testes de proteção) → PR **#15**. Fase 2 (unificação) → PR **#16**. Ambas baseadas em `3965b73`.
- **Base consolidada** Fase 1 + Fase 2 → branch `consolidacao/fases-1-2-vambora-motoristas` (PR de consolidação). É a base recomendada para a Fase 3.

## Reconciliação obrigatória antes de implementar (fazer no início de CADA fase futura)
1. `git fetch origin` e comparar:
   - `main` mudou além de `3965b73`? (novos merges)
   - `src/engine/*` mudou? (motores são intocáveis sem fase própria)
2. **Ordem de reconciliação recomendada** para telas de rota/passageiro/encaixe (banco ainda pendente):
   a. Aplicar **migração 0010** (após aprovação) — aditiva.
   b. Aplicar **correção da RPC `salvar_rota_completa`** (após aprovação).
   c. Só então Fases 7/8 que gravam rotas.
3. Registrar em `09` o commit/base reconciliado.

## Estado do banco hoje (para detectar mudança futura)
Projeto `rnulmjdsvvuirqijemzy` (ACTIVE_HEALTHY, sa-east-1). Migrações aplicadas:
`core_schema, rls_policies, storage_buckets, rpc_functions, security_hardening,
proteger_campos_driver`. Contagens: **drivers=6 (is_demo), routes=0, route_stops=0,
route_passengers=0, vehicles=0, destinations=46, cities=1**. RLS ativa; `route_passengers`
sem colunas de compromisso. Se algo disto mudar, reauditar antes de prosseguir.

## Git / segurança desta linha
- Branches: `docs/plano-vambora-motoristas` (plano, base `011fb14`); `fase1/protecao-testes-vambora-motoristas` (PR #15); `fase2/unificacao-vambora-motoristas` (PR #16); `consolidacao/fases-1-2-vambora-motoristas` (base recomendada, Fase 1 + Fase 2). Todas baseadas na `main` atual `3965b73`.
- **Sem** merge na `main`, deploy, migração ou alteração de banco/RLS/RPC/motores sem autorização.
- Não sobrescrever branches de outros agentes.
- Overlap de docs entre Fase 1 e Fase 2: os documentos da Fase 2 são superset (registram as duas fases); na consolidação, `00` e `09` foram resolvidos para essa versão — nada da Fase 1 foi perdido.
