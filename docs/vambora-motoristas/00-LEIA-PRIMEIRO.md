# 00 — LEIA PRIMEIRO (Vambora Motoristas)

> Documento de orientação. Leia isto antes de qualquer fase. Tudo aqui foi
> **verificado no código e no banco** (projeto Supabase `rnulmjdsvvuirqijemzy`),
> não presumido. Data da auditoria: 2026-11-05.

## O que é o projeto
Vambora é um **marketplace de transporte escolar recorrente** em Araçatuba/SP.
Duas experiências no **mesmo projeto React (Vite + PWA) e mesmo banco Supabase**:
- **Vambora** (famílias): marketplace público — `/`, `/resultados`, `/van/:slug`.
- **Vambora Motoristas** (motorista): hoje dividido em dois lugares:
  - **`/painel/*`** — app operacional **real** (conta, veículos, rotas, construtor, simulador). É aqui que a lógica verdadeira vive.
  - **`/pro` e `/pro/encaixe`** — **Vambora Pro**, uma vitrine **demonstrativa** (16 módulos com dados fixos).
- **Admin**: `/admin/*`.

## Objetivo desta linha de trabalho
Modernizar e **unificar** a experiência do motorista sob o nome **"Vambora Motoristas"**, com fidelidade às imagens de referência, **sem reconstruir do zero** e **sem perder nenhuma lógica/integração já existente**.

## Arquitetura em uma frase
Telas React → serviços em `src/data/*` e `src/lib/*` → Supabase (tabelas + RPCs + view `public_listings`) → o mesmo núcleo de cálculo em `src/engine/*` atende simulador do motorista e (no futuro) a busca do marketplace.

## O que NÃO pode ser alterado (sem fase própria e aprovação)
1. **Motores** `src/engine/*` e seus testes de referência.
2. **Login/sessão** (`src/lib/auth.tsx`) — Google OAuth real via `signInWithOAuth`.
3. **Banco** (tabelas, RLS, RPCs, migrações) — nenhuma migração nesta linha sem aprovação.
4. **Contrato de dados** entre telas e Supabase (`src/data/source.ts`, `src/data/motorista-store.ts`) — mudanças aqui afetam marketplace E motorista.
5. **View `public_listings`** e função `motorista_elegivel` — controlam o que o público vê.

## Branches e trabalho em andamento (NÃO é tudo na `main`)
> ATUALIZAÇÃO 2026-11-06: a `main` avançou para **`3965b73`** — o **PR #14 foi MERGEADO**. A consolidação + geolocalização já estão na `main`. A migração 0010 e a correção da RPC continuam pendentes (ver `09`).
- **`main`** (antes `011fb14`): marketplace, painel real, Vambora Pro demo, login Google, 6 motoristas-demo no banco.
- **PR #14** (branch `ccr-f18e6a2b-a7ex08`): consolidação do Algoritmo Supremo (Fases 1, 2, 4) + geolocalização (geocodificação por número + alfinete arrastável). **MERGEADO na `main` (`3965b73`).**
- **Fase 1** (branch `fase1/protecao-testes-vambora-motoristas`): testes de proteção adicionados (ver `09`).
- **Migração 0010** (compromissos individuais por aluno): escrita, **NÃO aplicada** ao Supabase.
- **Pendência da RPC `salvar_rota_completa`**: apaga e recria paradas/passageiros (risco a IDs e vínculos) — correção recomendada, **não aplicada**.
- Estas três são **dependências arquiteturais** das telas de rotas/passageiros/oportunidades/encaixe. Ver `08-RISCOS-E-RECUPERACAO.md`.

## Onde estão as decisões
- Arquitetura: `01-AUDITORIA-ARQUITETURA.md`
- Fluxo dos dados e **lacunas críticas**: `02-MAPA-INTEGRACOES.md`
- Contratos/regras reais: `03-CONTRATOS-E-REGRAS.md`
- Referência visual (e **imagens pendentes**): `04-REFERENCIA-VISUAL.md`
- Plano em fases com contratos: `05-PLANO-DE-EXECUCAO.md`
- Testes de regressão: `06-MATRIZ-DE-TESTES.md`
- Real × demonstrativo: `07-RECURSOS-DEMONSTRATIVOS.md`
- Riscos/recuperação/reconciliação: `08-RISCOS-E-RECUPERACAO.md`
- Progresso/checkpoints: `09-PROGRESSO-E-CHECKPOINTS.md`

## As 3 lacunas que mudam o plano (resumo — detalhe em 02)
1. **Van editada ≠ marketplace.** O editor de van grava na tabela `vehicles`; o marketplace lê recursos/capacidade da tabela `drivers` (via `public_listings`). **Não há sincronização** e **não há nenhuma escrita do motorista na tabela `drivers`** (só o admin escreve). Hoje o motorista real não consegue publicar/editar o que o público vê.
2. **Recursos da van não filtram a busca.** `arCondicionado/monitor/cinto/acessibilidade` aparecem no perfil, mas a busca (`src/lib/matching.ts`) filtra só cidade/destino/turno/vagas.
3. **Rotas dependem de reconciliação** (PR #14 + migração 0010 + correção da RPC) antes de telas que gravam rotas/passageiros.

## Próxima fase
**Fase 0 está concluída** (esta documentação). A próxima é a **Fase 1 — Proteção e testes de referência**, que só começa após sua aprovação. Ver `05` e `09`.

## Como retomar o trabalho (outro agente / outra conversa)
1. Leia este arquivo e `09-PROGRESSO-E-CHECKPOINTS.md`.
2. Rode `git fetch` e confira se `main`, os motores (`src/engine`) ou o PR #14 mudaram — ver seção "Reconciliação" em `08`.
3. Confirme a fase atual em `09`. Execute **uma fase por vez**, com os testes do contrato da fase (`05`) e a matriz (`06`).
4. Atualize `09` ao fim de cada fase (fase, commit, testes, próximo passo).
