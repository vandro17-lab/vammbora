# 09 — Progresso e Checkpoints

Atualizar ao fim de cada fase. Fonte de verdade da continuidade (não depender do chat).

## Estado atual
- **Fase atual:** Fase 2 — Unificação da experiência Vambora Motoristas → **CONCLUÍDA**.
- **Próxima fase:** Fase 3 — Design system (**aguardando aprovação E imagens**).
- **Branch da documentação (plano):** `docs/plano-vambora-motoristas` (commit `7800374`, base `011fb14`).
- **Branch da Fase 1:** `fase1/protecao-testes-vambora-motoristas` (base `3965b73`) — PR **#15** (draft, revisão, sem merge).
- **Branch da Fase 2:** `fase2/unificacao-vambora-motoristas` (base `origin/main` = `3965b73`, SEM depender da Fase 1).
- **Impedimentos:** **imagens de referência não recebidas** (bloqueiam a Fase 3; ver `04`).

## Resultados reais da Fase 2
- **Fluxo unificado:** Marketplace → "Sou motorista" (`/motorista`) → entrada → `/motorista/conta` (auth existente) → **app real `/painel`**. Antes a entrada levava à demo `/pro`.
- **Arquivos:** `src/app/navegacao-motorista.tsx` (novo — fonte única: links da entrada + aliases), `src/App.tsx` (aliases aditivos), `src/pages/DriverLandingPage.tsx` (CTAs: "Entrar ou criar conta" principal; "Ver demonstração" secundário e rotulado).
- **Aliases canônicos (aditivos):** `/motoristas` e `/vambora-motoristas` → `/motorista`; `/app` → `/painel`. Links antigos preservados; `/pro` segue como prévia demonstrativa (não substitui `/painel`).
- **Testes:** `src/app/navegacao-motorista.test.tsx` (6, via `matchRoutes` sem DOM). Suíte: **215 passam**; `tsc --noEmit` 0; `build` ok.
- **Preservado e intocado:** login Google, construtor de rotas, simulador, cadastro de veículos, marketplace, banco, RLS, RPCs, motores. Sem migração 0010 e sem correção da RPC nesta fase.
- **Não verificado:** render-level e2e de navegação (projeto não tem jsdom/Testing Library) e fluxos reais de auth/Supabase — ver `06`.

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
| 1 | Proteção e testes de referência | ✅ concluída (PR #15) |
| 2 | Unificação do app (rotas/entrada) | ✅ concluída |
| 3 | Design system (depende de imagens) | ⛔ bloqueada (imagens) — próxima |
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
1. Revisar a Fase 2 na branch `fase2/unificacao-vambora-motoristas` (e a Fase 1 no PR #15).
2. Enviar as **imagens de referência** (pré-requisito da Fase 3).
3. Aprovar o início da **Fase 3** (design system) — ou pedir a reconciliação do banco (migração 0010 + correção da RPC) antes das fases de rota (7/8).

## Fase 3 (implementação visual) — BLOCO F CONCLUÍDO
- **Branch:** `feat/vambora-motoristas-10-telas` (base = audit branch, que tem main `01b8dd9` + doc 10). Blocos A–E: `f332707`.
- **Feito (blocos A–E):** app "Vambora Motoristas" em `/app` com as 10 telas navegáveis e responsáveis; indicadores calculados por funções reais (`src/lib/vm/*`), cenário demo como fallback; `/painel`, login, motores e marketplace preservados; entrada e pós-login → `/app`. tsc 0, build ok, 225 testes + 8 todo.
- **Feito (bloco F — acabamento):** 4 commits temáticos — (1) fidelidade visual: identidade verde/teal em tokens CSS, cartões com hairline+sombra, feedback de toque; (2) estados vazios reais (Dashboard/Minha Van/Rotas/Oportunidades) + responsividade (abas com wrap) + identidade do cabeçalho vinda da sessão real; (3) 5º item da nav resolvido como **"Mais"** (hub, como no `/pro`), corrigindo a página Mais que estava órfã, com Minha Van em destaque dentro do hub; (4) tipografia (`tabular-nums`) e ícone "Voltar" via lucide. Novo teste `src/components/vm/VMShell.test.tsx` (5). tsc 0, build ok, **230 testes + 8 todo**.
- **⚠️ Imagens de referência:** continuam **não recebidas** (ver doc `04`). A "fidelidade" do bloco F foi contra a linguagem visual existente e o app `/pro` (referência mais próxima), não contra imagens. Quando as imagens chegarem, só ajuste de layout/estilo (o mapa de dados do doc `10` não muda).
- **Pendências de dado (não bloqueiam o visual):** GAP-1/1b (van/perfil ↔ marketplace), migração 0010 + correção da RPC `salvar_rota_completa` (Fases 5/7) — **não aplicadas** nesta execução. Ver doc `10`.

## Log de checkpoints
- 2026-11-05 — Fase 0 concluída. Documentação criada em `docs/vambora-motoristas/` na branch `docs/plano-vambora-motoristas` (base `011fb14`). Sem alteração de código funcional, banco ou motores.
- 2026-11-06 — Fase 1 concluída na branch `fase1/protecao-testes-vambora-motoristas` (base `main` `3965b73`, já com PR #14 mergeado). Adicionados 10 testes de regressão + 8 it.todo de lacunas. Suíte: 219 passam + 8 todo; tsc 0; build ok. PR #15 (draft, revisão). Nada funcional/banco/motor alterado.
- 2026-11-06 — Fase 2 concluída na branch `fase2/unificacao-vambora-motoristas` (base `main` `3965b73`, sem depender da Fase 1). Entrada unificada leva ao app real `/painel` (não à demo `/pro`); fonte única de navegação + aliases aditivos; 6 testes de navegação. Suíte: 215 passam; tsc 0; build ok. Sem alterar banco/RLS/RPC/motores; migração 0010 e correção da RPC seguem pendentes.
- 2026-11-06 — **Auditoria de dados × 10 telas** (branch `docs/auditoria-dados-10-telas-vambora-motoristas`, base `main` `01b8dd9`). Reauditoria do banco (leitura): esquema estável + achado `route_stops.planned_time_min` (não lido pelo store, GAP-5). Mapa indicador-a-indicador em `10-AUDITORIA-DADOS-10-TELAS.md`, classificando RF/CALC/RNC/DEP/DEMO por tela e o caminho inverso (edição → consumidores). Plano `05` atualizado para exigir que os componentes visuais sigam os contratos reais do doc `10`. Imagens de referência seguem pendentes. Sem código funcional/banco/RLS/RPC/motor alterado.
- 2026-11-06 — **Bloco F (acabamento visual)** concluído na branch `feat/vambora-motoristas-10-telas` (4 commits temáticos sobre `0f36ea1`). Fidelidade verde/teal (tokens CSS + cartões), estados vazios para dados reais, responsividade das abas, 5º item da nav resolvido como "Mais" (hub; página antes órfã), Minha Van no hub, tipografia `tabular-nums` e ícones. Identidade do cabeçalho do painel passa a vir da sessão real (OAuth/e-mail); nota/avaliações só no cenário demo. Suíte: **230 passam + 8 todo** (novo `VMShell.test.tsx`); tsc 0; build ok. **Nada de banco/RLS/RPC/motor alterado**; imagens de referência seguem pendentes; migração 0010 e correção da RPC não aplicadas.
- 2026-11-06 — **Base consolidada** criada na branch `consolidacao/fases-1-2-vambora-motoristas` (base `main` `3965b73`): merge da Fase 1 + Fase 2. Código disjunto (sem conflito); só `00` e `09` conflitaram (add/add) e foram resolvidos para o superset da Fase 2 (que já registra as duas fases) — nada perdido. Preserva os 10 testes da Fase 1 + os 6 da Fase 2. Suíte completa reexecutada: **225 passam + 8 todo**; tsc 0; build ok. Registrado que o PR #14 já está na `main`.
