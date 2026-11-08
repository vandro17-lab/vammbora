# 05 — Plano de Execução (fases pequenas e seguras)

Cada fase é pequena o bastante para implementar, testar e salvar numa conversa.
Executar **uma por vez**, só após aprovação. Ordem respeita dependências reais.
Legenda de contrato por fase: **Objetivo · Estado atual · Dependências ·
Arquivos · Dados · Preservar · Modificar · Riscos · Testes · Critério ·
Checkpoint · Recuperação · Pendências.**

> Pré-condição global de toda fase futura: **reconciliar** com a `main` e os
> motores (ver `08`). Nenhuma fase altera banco/motores/produção sem aprovação.
>
> **Contratos de dados por tela:** TODA fase que construir componentes visuais
> (3, 5, 6, 7, 8, 9, 10, 11) deve seguir o mapa de `10-AUDITORIA-DADOS-10-TELAS.md`
> — cada indicador ligado à sua fonte real (RF/CALC/RNC), o que é DEP (espera dado)
> e o que é DEMO (fixture substituível). Regra: **não inventar número que o mapa
> marque como CALC/RF**, e **não reescrever motor** que já exista. O `/pro` é a
> base visual; os números reais vêm das fontes do doc `10`.

---

## Fase 0 — Auditoria e documentação ✅ (esta entrega)
- **Objetivo:** mapear arquitetura, dados, integrações, riscos e planejar.
- **Estado:** concluída; docs em `docs/vambora-motoristas/`.
- **Critério:** os 10 documentos existem e refletem o código real. **Feito.**
- **Pendência:** imagens de referência (ver `04`).

---

## Fase 1 — Proteção e testes de referência
- **Objetivo:** criar rede de segurança verificável antes de qualquer mudança visual.
- **Estado atual:** há testes (vitest) dos motores e libs; **não há** testes de fluxo de telas do motorista, nem snapshot do contrato marketplace↔drivers.
- **Dependências:** Fase 0.
- **Arquivos:** novos testes em `src/**/*.test.ts(x)`; possível `docs/vambora-motoristas/06` atualizado. (Sem tocar produção.)
- **Dados:** nenhum (testes usam modo demo/local e fixtures).
- **Preservar:** todos os testes atuais passando; motores intactos.
- **Modificar:** só adicionar testes (render de `/painel/*`, mapeadores `source.ts`/`motorista-store.ts`, `matching.ts`).
- **Riscos:** baixos; testes frágeis se tocarem rede — usar mocks.
- **Testes:** `vitest run`, `tsc --noEmit`, `npm run build` verdes.
- **Critério:** nº de testes registrado; cobre os contratos de `02`/`03`.
- **Checkpoint:** commit `test(fase1): rede de proteção`.
- **Recuperação:** reverter commit (só testes).
- **Pendências:** testes e2e de auth/banco ficam como "não verificados".

---

## Fase 2 — Unificação do app "VanBora Motoristas" (rotas/entrada, sem redesenho)
- **Objetivo:** definir a casca única do app do motorista e os redirecionamentos, unificando `/painel/*` (real) e `/pro` (visual) sob uma identidade só, **sem** perder lógica.
- **Estado atual:** duas experiências separadas (`MotoristaShell` real; `VamboraProPage` demo). `/motorista` é landing pública "sou motorista".
- **Dependências:** Fase 1; decisão de URLs.
- **Arquivos:** `src/App.tsx` (rotas), `src/pages/motorista/MotoristaShell.tsx`, `src/pages/vambora-pro/*`, `DriverLandingPage.tsx`; possível novo `src/pages/motoristas-app/` (casca).
- **Dados:** nenhum.
- **Preservar:** todas as rotas atuais e **links antigos** (`/painel/*`, `/pro`) via redirect; login; sessão.
- **Modificar:** introduzir casca/navegação única; `/pro` passa a apontar para os módulos reais quando existirem, demo quando não.
- **Riscos:** quebrar deep links e PWA; loops de redirect.
- **Testes:** navegação manual + testes de rota; redirecionamentos antigos respondem; build.
- **Critério:** uma navegação única acessa todos os módulos sem duplicar telas; links antigos funcionam.
- **Checkpoint:** commit `feat(fase2): casca única VanBora Motoristas + redirects`.
- **Recuperação:** reverter; rotas antigas continuam no histórico.
- **Pendências:** identidade PWA própria avaliada, não necessariamente implementada.

---

## Fase 3 — Design system (depende das imagens)
- **Objetivo:** tokens e componentes conforme as imagens aprovadas.
- **Contratos:** os componentes de indicador (stat tile, barra de ocupação, gráfico) devem ser **data-agnósticos** e receber os valores já calculados pelos serviços reais do doc `10` (ex.: barra de ocupação alimentada por `ocupacaoPorTrecho`). Nada de número embutido no componente.
- **Estado atual:** Tailwind custom (`navy/mint/amber`) + componentes utilitários; `VamboraProPage` é a base visual.
- **Dependências:** **imagens de referência** (`04`); Fase 2.
- **Arquivos:** `tailwind.config`, `src/index.css`, `src/components/ui/*` (novos), `04-REFERENCIA-VISUAL.md`.
- **Preservar:** identidade do marketplace (não regredir o público).
- **Modificar:** adicionar tokens/componentes sem quebrar classes existentes.
- **Testes:** build; checagem visual em viewport mobile; sem erros de console.
- **Critério:** componentes base batem com as imagens; reaproveitáveis.
- **Checkpoint:** commit `feat(fase3): design system VanBora Motoristas`.
- **Bloqueio:** **não inicia sem as imagens.**

---

## Fase 4 — Entrada e autenticação (apresentação)
- **Objetivo:** tela de boas-vindas "Sou motorista" premium (van escolar, benefícios, começar, entrar), preservando login Google.
- **Estado atual:** `DriverLandingPage` + `ContaMotoristaPage` (login/cadastro; `entrarComProvedor('google')`).
- **Dependências:** Fases 2 e 3.
- **Arquivos:** `DriverLandingPage.tsx`, `ContaMotoristaPage.tsx`, componentes de marca.
- **Dados:** nenhum (auth já existe).
- **Preservar:** `src/lib/auth.tsx` (OAuth real); sem novo sistema de auth; sem duplicar usuário/cadastro.
- **Modificar:** só apresentação + fluxo Marketplace→Sou motorista→Entrada→Login/cadastro→App.
- **Riscos:** quebrar callback OAuth/redirect pós-login.
- **Testes:** login Google (ambiente com provider habilitado) — senão **não verificado**; navegação de entrada; build.
- **Critério:** fluxo de entrada fiel à imagem; login intacto.
- **Checkpoint:** commit `feat(fase4): entrada VanBora Motoristas`.

---

## Fase 5 — Cadastro e "Minha Van" + ligação ao marketplace (GAP-1/GAP-1b)
- **Objetivo:** motorista edita perfil público (`drivers`) e van; o que ele edita passa a refletir no marketplace, respeitando publicação.
- **Estado atual:** van grava em `vehicles` (`salvarVeiculo`); **nada** grava `drivers` pelo motorista; marketplace lê `drivers`; sem sync. (GAP-1/1b de `02`.)
- **Dependências:** Fases 1–4; **decisão de produto + possível migração** (ver `11`/`08`).
- **Arquivos:** `VeiculosPage.tsx`, `PerfilMotoristaPage` (`PaginasSimples.tsx`), `src/data/source.ts` e/ou `motorista-store.ts`; **banco:** definir fonte de verdade.
- **Dados:** `drivers` (perfil, recursos, capacidade), `vehicles` (van), `driver_destinations`.
- **Decisão arquitetural a tomar aqui (documentar antes de codar):** uma de —
  (a) **View passa a derivar recursos/capacidade de `vehicles`** (join em `public_listings`); ou
  (b) **Gatilho/serviço sincroniza `vehicles → drivers`**; ou
  (c) **Serviço de perfil escreve `drivers`** e a van vira detalhe do perfil.
  Preferir a que **menos** altere a view usada pelo marketplace; qualquer uma exige RPC/escrita segura em `drivers` respeitando `trg_proteger_driver` e `motorista_elegivel`.
- **Preservar:** `public_listings`, elegibilidade, RLS, e o marketplace existente.
- **Riscos:** regressão do marketplace; divergência de dados; publicar motorista sem docs.
- **Testes:** editar AC/capacidade → refletir em `public_listings` (quando publicado); matriz `06` itens 4–8.
- **Critério:** "editar van/perfil → marketplace reflete, respeitando publicação" passa a ser **verdadeiro e testado**.
- **Checkpoint:** commit por subpasso; migração (se houver) só após aprovação separada.
- **Recuperação:** migração aditiva + rollback documentado; feature flag se preciso.

---

## Fase 6 — Dashboard (Início)
- **Objetivo:** dashboard real (motorista, van, passageiros, rotas, ocupação, vagas, combustível, atalhos) ligado às fontes certas.
- **Estado atual:** `PainelMotoristaPage` real (pendências); `VamboraProPage` início demo.
- **Dependências:** Fases 2,3,5.
- **Arquivos:** `PainelMotoristaPage.tsx`, novos componentes de cartão/indicador.
- **Dados:** `drivers`, `vehicles`(+`consumo_kml`), `routes`/contagens.
- **Preservar:** cálculos de ocupação (`ocupacao-rota.ts`).
- **Modificar:** só apresentação + ligação de indicadores reais; indicadores sem fonte real ficam marcados como demonstrativos (`07`).
- **Testes:** indicadores batem com dados; build.
- **Critério:** nenhum número "bonito" sem fonte real ou marcação clara.

---

## Fase 7 — Rotas (lista, detalhe, mapa, construtor) — depende de reconciliação
- **Objetivo:** modernizar apresentação preservando construtor e persistência.
- **Estado atual:** `RotasListPage`, `RotaBuilderPage`, `MapaInterativoRota` reais; PR #14 traz geocodificação por número + alfinete arrastável.
- **Dependências:** **reconciliar PR #14 + migração 0010 + correção da RPC** (`08`) ANTES.
- **Arquivos:** `RotasListPage.tsx`, `RotaBuilderPage.tsx`, `MapaInterativoRota.tsx`, `SeletorPontoMapa.tsx` (do PR #14).
- **Dados:** `routes/route_stops/route_passengers`; RPC `salvar_rota_completa`.
- **Preservar:** persistência, ids/vínculos, geolocalização, motores.
- **Riscos:** perda de ids/compromissos (RPC apaga-e-recria) — por isso a correção vem antes.
- **Testes:** matriz `06` itens 9–17; criar/editar rota e reler ids.
- **Critério:** construtor intacto, visual novo, nada perdido no salvar/editar.

---

## Fase 8 — Oportunidades e simulador de encaixe
- **Objetivo:** ligar a nova interface aos motores (progressivo + compromissos).
- **Estado atual:** `SimuladorEncaixePage` usa `simularEncaixeRota`; `encontrarEncaixesProgressivo` existe (PR #14) mas **não** está ligado à tela.
- **Dependências:** Fases 5,7; PR #14 reconciliado.
- **Arquivos:** `SimuladorEncaixePage.tsx`, adaptadores `src/lib/*`, `vambora-pro` (Vagas).
- **Dados:** rotas/compromissos; matriz viária (`api/mapas.ts`).
- **Preservar:** motores e honestidade (indeterminado ≠ impossível); simulação não grava.
- **Testes:** comparar com testes de referência; itens 18–19 da matriz.
- **Critério:** resultados do motor real, com antes/depois, capacidade, horários, impacto.

---

## Fase 9 — Inteligência e Financeiro / Combustível
- **Objetivo:** indicadores e simuladores sem inventar resultados; combustível usa `consumo_kml` real + distância dos motores.
- **Estado atual:** demonstrativo no `/pro`.
- **Dependências:** Fases 6,8.
- **Dados:** `vehicles.consumo_kml` (já existe), distâncias (matriz viária), preços informados.
- **Preservar:** cálculos reais; separar claramente cenário demonstrativo de cálculo real.
- **Testes:** valores conferíveis; itens 20 da matriz.

---

## Fase 10 — Clube do Motorista (vitrine substituível)
- **Objetivo:** vitrine interativa de benefícios (categorias, cartões, filtros, detalhes) com **dados demonstrativos** estruturados e substituíveis.
- **Estado atual:** só um item de menu no `/pro`.
- **Dependências:** Fase 3.
- **Arquivos:** `src/pages/.../clube/*`, `src/data/demo/clube.ts` (fixtures).
- **Dados:** **sem tabela nova agora**; fixtures demo (`isDemo`), arquitetura pronta para futura tabela `club_offers`.
- **Preservar:** não atribuir descontos fictícios a empresas reais.
- **Testes:** navegação de categorias/filtros/detalhe; build.
- **Critério:** trocar fixtures por ofertas reais depois **sem** reconstruir a UI.

---

## Fase 11 — Módulos complementares (Manutenção, Calendário, Documentação, Passageiros, AlugaVan)
- **Objetivo:** telas dos módulos restantes, reais onde há dado, demonstrativas onde não há.
- **Estado atual:** Documentação real-ish (`documents`); Passageiros vinculados a rotas; resto demo no `/pro`.
- **Dependências:** Fases 5,7.
- **Dados:** `documents`/`document_requirements` (real); `routes/route_passengers` (passageiros); Manutenção/Calendário → decisão de tabela nova (ver `11`) ou demo.
- **Preservar:** privacidade dos alunos; fluxo documental existente.
- **Testes:** itens 13, e navegação dos módulos.

---

## Fase 12 — Integração e acabamento
- **Objetivo:** validar navegação, responsividade, identidade, estados de interação em todo o app.
- **Dependências:** 2–11.
- **Testes:** responsividade (mobile), build, lint, sem erros de console.

---

## Fase 13 — Testes finais e preparação da demonstração
- **Objetivo:** rodar a matriz `06` inteira; registrar o que é real × demonstrativo; estabilidade.
- **Critério:** matriz executada, status real (verificado/não verificado) honesto.

---

## Dependências entre fases (resumo)
`0 → 1 → 2 → 3(imagens) → 4 → 5(GAP-1) → 6 → [reconciliação PR#14/0010/RPC] → 7 → 8 → 9 → 10 → 11 → 12 → 13`.
Fase 10 pode andar em paralelo após a 3. Fase 5 é a que destrava o valor real do marketplace.
