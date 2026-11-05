# Relatório de Consolidação — Algoritmo Supremo (Fases 1, 2 e 4)

> Branch de consolidação: `ccr-f18e6a2b-a7ex08`. Base: `main` (`011fb14`).
> Esta consolidação **não** toca a `main`, **não** faz deploy e **não** aplica migrações.
> Data da auditoria: 2026-11-05.

## 1. Estado da `main`
- HEAD: `011fb14` = *Merge pull request #13* (`claude/driver-database-social-login-4jekg2`).
- Acima dela estão, mergeados: PR #12 (simulador inteligente), #11, #10, #6, #5, #4, #3, #2, #1.
- A `main` **já contém** o simulador (`SimuladorEncaixePage`, `rota-para-encaixe`, `matriz-viaria`) e o login social + marcadores `is_demo`.

## 2. Pull Requests encontrados
| PR | Tema | Estado |
|----|------|--------|
| #13 | demo Araçatuba sem login + login Google | **merged** (na main) |
| #12 | Simulador Inteligente de Rotas | **merged** (na main) |
| #11 | textos de horários | merged |
| #10 | motor unificado + Supabase + mapas | merged |
| #9 | motor viário prazo final | **aberto (draft)** — base `feat/mapas-reais…` (trabalho antigo, não é fase) |
| #8 | mapas reais cadastro | **aberto (draft)** |
| #7 | motor encaixe ida/volta | **aberto (draft)** |
| #6, #5, #4, #3, #2, #1 | — | merged |

**Não existe PR** para `claude/algoritmo-supremo-fase1/2/2-proposta/4`. Essas fases viviam **apenas como branches** — os commits foram aproveitados diretamente nesta consolidação. Os PRs #7/#8/#9 são de uma linha anterior (motor antigo) e **não** fazem parte do Algoritmo Supremo das Fases 1/2/4; ficaram intocados.

## 3. Branches verificadas (relação com a `main`)
`main` é ancestral de todas elas (nenhuma divergência de base):
- `claude/algoritmo-supremo-fase1` → +1 commit `ea27f58` (testes de referência + snapshots; marca `engine.ts`/`matching.ts` como legados).
- `claude/algoritmo-supremo-fase4` → +2 commits (`ea27f58` + `38cf4fc`); **já inclui a Fase 1**; adiciona `encaixe-geografico.ts` (`encontrarEncaixesProgressivo`) e `encaixe-progressivo.test.ts`.
- `claude/algoritmo-supremo-fase2` → +1 commit `4314708`; tipos/store/adaptadores + migração `0010` + `compromisso-aluno.test.ts`.
- `claude/algoritmo-supremo-fase2-proposta` → +1 commit `657d63f`; apenas documentos de proposta.

## 4. Branch criada para consolidação
`ccr-f18e6a2b-a7ex08`, a partir de `main` (`011fb14`), com três merges `--no-ff` (histórico preservado) + 1 commit de teste de integração.

## 5. Commits e funcionalidades aproveitados
- Fase 1: `ea27f58` — testes de referência e snapshots; motores antigos preservados (nada apagado).
- Fase 4: `38cf4fc` — `encontrarEncaixesProgressivo` (escola nova, reorganização controlada, orçamento de busca, classificação compatível/incompatível/indeterminado).
- Fase 2: `4314708` — 5 campos de compromisso por aluno (`horario_habitual_min`, `ajuste_antes_min`, `ajuste_depois_min`, `atendimento_min`, `atendimento_origem`) nos tipos, no store e nos adaptadores (`encaixe.ts`, `rota-para-encaixe.ts`, `rota-para-motor.ts`), + migração `0010` + testes.
- Fase 2 proposta: `657d63f` — docs.

## 6. Conflitos encontrados e resolvidos
**Nenhum.** Os conjuntos de arquivos são disjuntos (Fase 4 e Fase 2 não tocam os mesmos arquivos; Fase 1 já está dentro da Fase 4). Os três merges entraram limpos, sem edição manual.

## 7. Arquivos alterados (vs `main`)
Fase 1/4: `src/engine/engine.ts`, `src/lib/matching.ts`, `src/engine/encaixe-geografico.ts`, `src/engine/referencia-encaixe.test.ts` (+ snapshot), `src/engine/encaixe-progressivo.test.ts`.
Fase 2: `src/types/motorista.ts`, `src/data/motorista-store.ts`, `src/lib/encaixe.ts`, `src/lib/rota-para-encaixe.ts`, `src/lib/rota-para-motor.ts`, `src/lib/compromisso-aluno.test.ts`, `supabase/migrations/20260104000010_compromisso_aluno.sql`.
Docs: `docs/fase2/*`.
Consolidação: `src/engine/integracao-progressivo-compromisso.test.ts` (novo), este relatório.

## 8. Testes (número real da branch consolidada)
- **202 testes aprovados** em 17 arquivos (`vitest run`). *Não* é a soma de 179+190+184 — aqueles eram estados diferentes.
- Inclui 3 testes novos de integração Fase 4 × Fase 2 (ver §10).
- `tsc --noEmit` (lint/typecheck): **0 erros**.
- `npm run build` (tsc -b + vite): **sucesso** (único aviso: chunk > 500 kB, não é erro).

## 9. Integração do motor (fluxo cadastro → motor → simulador)
- **Já funciona:** adaptadores de Fase 2 (`encaixe.ts`, `rota-para-encaixe.ts`, `rota-para-motor.ts`) consomem `atendimentoMin` por aluno e interseção de janelas; o simulador do motorista (`SimuladorEncaixePage`) usa `simularEncaixeRota` → `montarBase`, que já honra o atendimento por aluno.
- **Parcial / não conectado:** `encontrarEncaixesProgressivo` (Fase 4) só é referenciado pelos próprios testes. **Não há adaptador** ligando a `Rota` do cadastro (com os compromissos da Fase 2) à busca progressiva, nem a tela usa a busca progressiva. Conectar isso é a **Fase C** (futuro) — não implementada aqui por ser nova funcionalidade, fora do escopo da consolidação.
- Contrato compartilhado confirmado: a busca progressiva opera sobre `RotaOperacional`, cujos `Compromisso` carregam `atendimentoMin`. Logo o motor progressivo **é capaz** de honrar os compromissos individuais assim que um adaptador os entregue — provado pelos testes de integração abaixo.

## 10. Testes de integração adicionados (Fase 4 × Fase 2)
`src/engine/integracao-progressivo-compromisso.test.ts` (3 casos, números auditáveis, matriz 3 min/trecho):
1. O atendimento individual inverte o veredito: provisório (1 min) → `compativel`; compromisso maior (7 min) → `incompativel` (prova concluída, não "indeterminado").
2. Atendimento ausente (`null`) cai no provisório — nunca em zero nem em "confirmado".
3. A busca progressiva **não altera** a rota original.

## 11. Situação da migração `0010` (auditoria do Supabase)
- Projeto confirmado: **`rnulmjdsvvuirqijemzy`** (nome "vambora", `ACTIVE_HEALTHY`, região sa-east-1).
- Migrações aplicadas no banco (6): `core_schema`, `rls_policies`, `storage_buckets`, `rpc_functions`, `security_hardening`, `proteger_campos_driver`.
- **`route_passengers` NÃO possui** as colunas de compromisso → **migração 0010 NÃO aplicada.** (Confirmado por inspeção de colunas.)
- `confirmar_encaixe_rota` (RPC do PR #12 / 0009) **também não existe** no banco.
- RLS **ativa** em `routes`, `route_stops`, `route_passengers`, `drivers`, `vehicles`, `destinations`.

### Divergência 30 motoristas/112 rotas × 6 motoristas/0 rotas — RESOLVIDA
Contagens reais hoje: **drivers=6 (todos `is_demo=true`), routes=0, route_stops=0, route_passengers=0, vehicles=0, destinations=46, cities=1.**
O número "30 motoristas, 41 destinos, 112 rotas, 446 paradas, 697 passageiros" era o **SQL de importação preparado** no PR #13 (idempotente) — **nunca executado**. O estado efetivo é o seed de 6 motoristas-demo, sem rotas. Os 46 destinos reais de Araçatuba foram semeados.

## 12. Risco na RPC `salvar_rota_completa` (apaga e recria)
A definição **vigente** no banco e a da 0010 são idênticas, exceto que a 0010 acrescenta os 5 campos de compromisso ao `INSERT` de passageiros. O padrão **`DELETE` de todos os `route_passengers` e `route_stops` e recriação** **já está em produção** — não é introduzido pela 0010.

Chaves estrangeiras relevantes (do banco):
- `route_passengers.board_stop_id → route_stops.id` **ON DELETE CASCADE**
- `route_passengers.alight_stop_id → route_stops.id` **ON DELETE SET NULL**
- `route_passengers.route_id → routes.id` / `route_stops.route_id → routes.id` **ON DELETE CASCADE**

**Riscos (não "risco zero" só porque as tabelas estão vazias — o risco é de comportamento, a cada salvamento):**
1. **Perda silenciosa de compromissos (incremental da 0010).** Como a RPC apaga e recria passageiros, se o cliente salvar a rota **sem** reenviar os 5 campos de compromisso no payload, o `INSERT` grava `NULL` — **apagando compromissos já salvos**. (Com `atendimento_origem` ausente ⇒ volta a "não informado".)
2. **Troca de identificadores.** `id` de parada/passageiro é preservado só se o cliente reenviar (`coalesce(nullif(id), gen_random_uuid())`). Se não reenviar, cada salvamento gera UUIDs novos. Hoje nada externo referencia esses ids, mas `confirmar_encaixe_rota` (futuro) e histórico passariam a depender disso.
3. **Integridade das paradas.** Ordem de deleção correta (passageiros antes de paradas) e função atômica (uma transação): se o payload trocar ids de parada e deixar `board_stop_id` órfão, a transação **falha e reverte** (não corrompe), mas o salvamento quebra. Depende do cliente reenviar ids de parada coerentes.
4. Permissões: os `DELETE` não repetem o filtro de dono, mas `v_route_id` já foi validado pelo `UPDATE` (dono/admin) ou recém-inserido para o dono — **sem risco de apagar rota de terceiros.**

### Correção mais segura recomendada (preparar, **não aplicar** ainda)
Trocar o "apaga-e-recria" por **upsert por `id` com remoção só do que saiu do payload**, preservando ids e campos não enviados:
- `route_stops`: `INSERT ... ON CONFLICT (id) DO UPDATE`; depois `DELETE` apenas as paradas da rota cujo `id` **não** está no payload.
- `route_passengers`: idem; e nos campos de compromisso usar **`COALESCE(novo, antigo)`** no `DO UPDATE`, para que um payload parcial **não** zere compromissos já gravados.
- Alternativa mínima (se não quiser mexer na RPC agora): manter o apaga-e-recria, porém **exigir** que o cliente sempre reenvie o objeto completo do passageiro (incluindo os 5 campos e os ids de parada) antes de aplicar a 0010 — mais frágil; preferir a opção de upsert.

Qualquer uma destas é **proposta**: nada foi executado no banco.

## 13. Pendências reais do Algoritmo Supremo
- **A. Persistência:** aplicar a 0010 (após a decisão sobre a RPC) e validar gravação/leitura dos 5 campos.
- **B. Cadastro (UI):** coletar horário habitual, tolerâncias e atendimento por aluno na tela do motorista (hoje os campos existem no tipo/store, mas não há coleta na interface).
- **C. Simulador ↔ motor progressivo:** criar o adaptador `Rota` → `RotaOperacional` para `encontrarEncaixesProgressivo` e ligar à tela (escola nova + reorganização).
- **D. Marketplace:** busca das famílias consultar rotas reais, no servidor, sem expor endereços dos alunos.
- **E. Otimização:** comparar rota original × proposta, com aprovação do motorista como condição.
- **F. Testes integrados ponta a ponta** com dados controlados.

## 14. Próxima fase recomendada
**A → C**, nesta ordem: primeiro decidir a RPC e aplicar a 0010 (persistência confiável dos compromissos), depois ligar o motor progressivo ao simulador (C), reaproveitando o seam já provado pelos testes de integração. B pode andar em paralelo com A. D/E/F dependem de A e C.
