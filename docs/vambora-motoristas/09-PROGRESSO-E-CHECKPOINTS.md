# 09 — Progresso e Checkpoints

Atualizar ao fim de cada fase. Fonte de verdade da continuidade (não depender do chat).

## Estado atual
- **Fase atual:** Fase 0 — Auditoria e documentação → **CONCLUÍDA**.
- **Próxima fase:** Fase 1 — Proteção e testes de referência (**aguardando aprovação**).
- **Branch da documentação:** `docs/plano-vambora-motoristas`.
- **Base/origem:** `origin/main` = `011fb14` (Merge PR #13).
- **Commit da doc:** (preenchido no push — ver histórico da branch).
- **Testes nesta entrega:** nenhum código alterado; `main` como está. (Build/testes da linha PR #14: 209 testes verdes, à parte.)
- **Impedimentos:** **imagens de referência não recebidas** (bloqueiam Fase 3 e o detalhamento visual; ver `04`).

## Fases
| Fase | Tema | Status |
|------|------|--------|
| 0 | Auditoria e documentação | ✅ concluída |
| 1 | Proteção e testes de referência | ⏳ aguardando aprovação |
| 2 | Unificação do app (rotas/entrada) | ⬜ |
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
1. Você aprova o plano (ou pede ajustes).
2. Você envia as **imagens de referência**.
3. Autoriza o início da **Fase 1** (apenas testes de proteção, sem telas).

## Log de checkpoints
- 2026-11-05 — Fase 0 concluída. Documentação criada em `docs/vambora-motoristas/` na branch `docs/plano-vambora-motoristas` (base `011fb14`). Sem alteração de código funcional, banco ou motores.
