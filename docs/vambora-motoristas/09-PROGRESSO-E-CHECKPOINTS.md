# 09 — Progresso e Checkpoints

Atualizar ao fim de cada fase. Fonte de verdade da continuidade (não depender do chat).

## Estado atual
- **Fase atual:** Fase 1 — Proteção e testes de referência → **CONCLUÍDA**.
- **Próxima fase:** Fase 2 — Unificação do app (**aguardando aprovação**).
- **Branch da documentação (plano):** `docs/plano-vambora-motoristas` (commit `7800374`, base `011fb14`).
- **Branch de trabalho da Fase 1:** `fase1/protecao-testes-vambora-motoristas` (base `origin/main` = `3965b73`).
- **Impedimentos:** **imagens de referência não recebidas** (bloqueiam Fase 3 e o detalhamento visual; ver `04`).

## ⚠️ Reconciliação registrada (2026-11-05, início da Fase 1)
- A `main` **avançou de `011fb14` para `3965b73`**: o **PR #14 foi MERGEADO** (consolidação Algoritmo Supremo Fases 1/2/4 + geolocalização agora estão na `main`).
- A Fase 1 foi baseada na `main` nova (`3965b73`), já incluindo esse trabalho.
- **Continuam pendentes** (merge de código NÃO aplica banco): **migração 0010 não aplicada**; **correção da RPC `salvar_rota_completa` não feita**; `confirmar_encaixe_rota` não existe no banco. Reauditar o banco antes das Fases 7/8 (ver `08`).

## Resultados reais da Fase 1
- **Testes de regressão (devem passar) adicionados:** 10 — `src/lib/matching-contrato.test.ts` (7) + `src/data/motorista-store-contrato.test.ts` (3).
- **Lacunas documentadas (it.todo, não passam nem falham):** 8 — `src/data/lacunas-conhecidas.test.ts`.
- **Suíte completa:** `vitest run` → **219 passam + 8 todo** (antes: 209). `tsc --noEmit` → **0 erros**. `npm run build` → **sucesso**.
- **Nada funcional, de banco, RLS, RPC ou motor foi alterado.** Só foram adicionados testes e documentação.
- **Não verificado (depende de auth/Supabase/chave):** fluxos reais de login, gravação em `vehicles`/`routes`, matriz viária — ver `06`.

## Fases
| Fase | Tema | Status |
|------|------|--------|
| 0 | Auditoria e documentação | ✅ concluída |
| 1 | Proteção e testes de referência | ✅ concluída |
| 2 | Unificação do app (rotas/entrada) | ⏳ aguardando aprovação |
| 3 | Design system (depende de imagens) | ⛔ bloqueada (imagens) |
| 4 | Entrada e autenticação | ⬜ |
| 5 | Cadastro + Minha Van ↔ marketplace (GAP-1) | ⬜ |
| 6 | Dashboard | ⬜ |
| 7 | Rotas (requer reconciliação) | ⬜ |
| 8 | Oportunidades e encaixe | ⬜ |
| 9 | Inteligência e financeiro | ⬜ |
| 10 | Clube do Motorista | ⬜ |
| 11 | Módulos complementares | ⬜ |
| 12 | Integração e acabamento | ⬜ |
| 13 | Testes finais e demonstração | ⬜ |

## Dependências abertas (bloqueiam fases)
- **Imagens de referência** → Fase 3 (e detalhamento visual de 4+).
- **PR #14** (consolidação + geolocalização) → reconciliar antes das Fases 7/8.
- **Migração 0010** (compromissos) → aplicar (com aprovação) antes de passageiros/encaixe reais.
- **Correção da RPC `salvar_rota_completa`** → antes da edição real de rotas (Fase 7).
- **Decisão de produto GAP-1** (fonte de verdade van ↔ drivers ↔ view) → Fase 5.

## Próximo passo exato
1. Revisar os testes da Fase 1 na branch `fase1/protecao-testes-vambora-motoristas`.
2. Enviar as **imagens de referência** (bloqueiam a Fase 3).
3. Aprovar o início da **Fase 2** (unificação do app, sem redesenho) — ou pedir a reconciliação do banco (migração 0010 + correção da RPC) antes das fases de rota.

## Log de checkpoints
- 2026-11-05 — Fase 0 concluída. Documentação criada em `docs/vambora-motoristas/` na branch `docs/plano-vambora-motoristas` (base `011fb14`). Sem alteração de código funcional, banco ou motores.
- 2026-11-06 — Fase 1 concluída na branch `fase1/protecao-testes-vambora-motoristas` (base `main` `3965b73`, já com PR #14 mergeado). Adicionados 10 testes de regressão + 8 it.todo de lacunas. Suíte: 219 passam + 8 todo; tsc 0; build ok. Nada funcional/banco/motor alterado. Migração 0010 e correção da RPC seguem pendentes.
