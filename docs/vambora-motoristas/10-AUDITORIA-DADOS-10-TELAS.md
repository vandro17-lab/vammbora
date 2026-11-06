# 10 — Auditoria de Dados × 10 Telas (Vambora Motoristas)

> Base: `main` `01b8dd9` (Fases 1+2 incorporadas). Banco reauditado em
> **2026-11-06** (projeto `rnulmjdsvvuirqijemzy`, modo leitura). Objetivo: construir
> a aparência das imagens **sobre a inteligência real que o Vambora já tem**, sem
> inventar número que possa ser calculado e sem duplicar lógica.

## ⚠️ Impedimento: imagens não recebidas
As "dez telas de referência" não vieram anexadas nesta execução (só texto). Logo,
o mapeamento **indicador-a-indicador do layout exato** de cada imagem fica
pendente das imagens. Para não travar, este documento mapeia as **telas já
existentes no código** que são a base dessas imagens:
- **App demonstrativo** `src/pages/vambora-pro/VamboraProPage.tsx` (16 módulos com indicadores concretos — a referência mais próxima do app desejado).
- **App real** `/painel/*` (`PainelMotoristaPage`, `VeiculosPage`, `RotaBuilderPage`, `RotasListPage`, `SimuladorEncaixePage`, `PaginasSimples`).
Quando as imagens chegarem, só ajustamos **layout/estilo** e confirmamos indicadores — o **mapa de dados abaixo não muda**.

## Reauditoria do banco (delta desde a última)
Esquema estável. Tabelas, `public_listings`, RPCs e triggers iguais aos de `03`.
**Novidade:** `route_stops` agora tem **`planned_time_min`** (além de `leg_time_min`) e `created_at` — o store (`mapRotaDoBanco`) lê só `leg_time_min`; `planned_time_min` existe no banco mas **não é lido** (lacuna GAP-5, abaixo). Contagens: `drivers=6 (is_demo), vehicles=0, routes=0, route_stops=0, route_passengers=0, destinations=46, documents=0`. `route_passengers` **sem** colunas de compromisso (migração 0010 ainda não aplicada).

## Legenda de classificação (por indicador/ação)
- **RF** = Real e funcional (já lê dado real e aparece).
- **RNC** = Real, existe no banco/serviço mas **não conectado** a esta tela (hoje usa demo).
- **CALC** = Calculável com dados existentes + motor/serviço já pronto (só ligar).
- **DEP** = Depende de dado ou implementação adicional (coluna/tabela/coleta/UI).
- **DEMO** = Demonstrativo por ora (sem fonte real planejada nesta fase).

Fonte real = `tabela.coluna` · serviço (`arquivo.função`) · algoritmo.
Atualização = como o valor muda quando o dado muda.

---

## Inventário de motores/serviços reais disponíveis (reutilizar — não reescrever)
- **Ocupação:** `src/lib/ocupacao-rota.ts` → `capacidadeAlunos`, `ocupacaoPorTrecho`, `picoOcupacao`, `aBordoEm`, `validarRota`, `podeFinalizar`.
- **Encaixe:** `src/engine/encaixe-geografico.ts` → `simularRota`, `encontrarEncaixes`, `encontrarIdaVolta`, `encontrarEncaixesProgressivo`.
- **Adaptadores:** `src/lib/encaixe.ts` (`rotaOperacionalDeCadastro`, `partidaRetroativa`, `criarMatrizDemo`, `haversineMetros`), `src/lib/rota-para-encaixe.ts` (`simularEncaixeRota`, `coletarPontos`, `limitePadraoDoTurno`), `src/lib/rota-para-motor.ts`.
- **Busca/oportunidades:** `src/lib/busca-encaixe.ts` (`buscarComMotor`, `rotaDemonstrativaDoMotorista`, `coordDaOrigem`).
- **Matriz viária real:** `src/lib/matriz-viaria.ts` (`matrizDeTabelas`) via `api/mapas.ts` op `matriz` (exige login).
- **Geolocalização:** `src/lib/geocode.ts` (`geocodificarPreciso`, `reverseGeocodificar`).
- **Persistência:** `src/data/motorista-store.ts` (`listarVeiculos/salvarVeiculo`, `listarRotas/salvarRota` via RPC `salvar_rota_completa`).
- **Marketplace:** `src/data/source.ts` (`listarMotoristas` ← `public_listings`, admin).
- **Fontes DEMO:** `src/data/motorista-demo.ts` (`INDICADORES_DEMO`, `VAN_DEMO`, `ALUNOS_DEMO`, `OPORTUNIDADES_DEMO`, `FINANCEIRO_DEMO`, `COMBUSTIVEL_DEMO`, `MANUTENCAO_DEMO`, `DOCUMENTOS_DEMO`, `AVISOS_DEMO`, `CALENDARIO_DEMO`, `rotaDemoManha`).

---

## TELA 1 — Entrada / Boas-vindas ("Sou motorista")
Componente: `DriverLandingPage` (entrada unificada da Fase 2).
| Elemento | Fonte real | Classe | Atualização |
|---|---|---|---|
| Benefícios, van escolar, textos | estáticos de marca | DEMO (conteúdo fixo, ok) | build |
| "Entrar ou criar conta" | `auth.tsx` (`/motorista/conta`) | RF | — |
| "Ver demonstração" → `/pro` | rota | RF | — |
Nenhum indicador calculado aqui. **Fase 4** (visual) + **Fase 2** (fluxo, feito).

## TELA 2 — Autenticação (login / cadastro / Google)
Componente: `ContaMotoristaPage` + `src/lib/auth.tsx`.
| Elemento | Fonte real | Classe | Atualização |
|---|---|---|---|
| Login e-mail/senha | Supabase Auth (`entrar`/`cadastrar`) | RF | sessão |
| Login Google | `signInWithOAuth({provider:'google'})` | RF | callback → `/painel` |
| Sessão / `isAdmin` | `AuthProvider` + `has_role` | RF | reativa |
Sem indicadores numéricos. Preservar integralmente (nunca duplicar auth).

## TELA 3 — Minha Van (cadastro do veículo)
Componentes: `VeiculosPage` ⇄ demo `Perfil`/chips em `VamboraProPage`.
| Indicador/campo | Fonte real | Classe | Atualização |
|---|---|---|---|
| Modelo, ano, placa | `vehicles.model/year/plate` · `salvarVeiculo` | RF | upsert → relê |
| Lugares de passageiro | `vehicles.seats_passenger` | RF | upsert |
| Ar-condicionado / acessível / cintos | `vehicles.feature_ac/accessible/seatbelt` | RF (no painel) | upsert |
| Fotos da van | `vehicles.photo_urls` | RF | upsert |
| **Consumo médio (km/L)** | `vehicles.consumo_kml` (**coluna já existe**) | RNC (não há campo na UI nem no tipo `Veiculo`) | ao coletar (Fase 5/9) |
| **Reflexo no marketplace** (recursos/capacidade) | `drivers.feature_*/capacity_total` via `public_listings` | **DEP — GAP-1** (van grava em `vehicles`, vitrine lê `drivers`; sem sync) | Fase 5 |
Forward (editar → consumidores): hoje **para em `vehicles`**; não chega à vitrine. Ligar em Fase 5 (ver §Integrações delicadas).

## TELA 4 — Início / Dashboard
Demo: `VamboraProPage > Inicio` (`INDICADORES_DEMO`). Real: `PainelMotoristaPage` (já lê `listarVeiculos`/`listarRotas`).
| Indicador | Fonte real / cálculo | Classe | Atualização |
|---|---|---|---|
| nº de vans / "tem van" | `listarVeiculos().length` | RF (no painel real) | ao salvar van |
| nº de rotas / concluídas | `listarRotas()` + `status` | RF (no painel real) | ao salvar rota |
| **alunos** | Σ `route_passengers` das rotas (`listarRotas`) | CALC | ao salvar rota |
| **vagas** | `capacidadeAlunos(rota,veic) − picoOcupacao(rota)` (`ocupacao-rota`) | CALC | ao salvar rota/van |
| **escolas** | distintos `route_stops.destination_id` (type=escola) | CALC | ao salvar rota |
| **% ocupação** ("rota de hoje 75%") | `picoOcupacao/capacidadeAlunos` | CALC | ao salvar rota/van |
| nota / nº avaliações | `drivers.rating_avg/rating_count` (via `public_listings`/`drivers`) | RNC (demo usa `MOTORISTA_DEMO.nota`) | admin/futuro |
| saudação (bom dia…) | hora local | RF | runtime |
| Avisos | `AVISOS_DEMO` | DEMO (sem tabela) | Fase futura |
Observação: o dashboard bonito (`/pro`) usa números demo; os **equivalentes reais já existem** (acima) — Fase 6 liga à fonte certa.

## TELA 5 — Rotas (lista / detalhe / mapa / construtor)
Demo: `VamboraProPage > Rotas` (lista fixa). Real: `RotasListPage` + `RotaBuilderPage` + `MapaInterativoRota`.
| Indicador/elemento | Fonte real | Classe | Atualização |
|---|---|---|---|
| Lista de rotas (nome, sentido, status, dias) | `routes.*` · `listarRotas`/`mapRotaDoBanco` | RF (painel real) | ao salvar |
| Paradas (ordem/tipo/coords/confirmado) | `route_stops.*` | RF | RPC `salvar_rota_completa` |
| Escola da parada | `route_stops.destination_id` → `destinations` | RF | — |
| Passageiros da rota | `route_passengers.*` | RF | RPC |
| Tempo por trecho | `route_stops.leg_time_min` | RF | mapa/OSRM/`matrizDeTabelas` |
| `planned_time_min` | `route_stops.planned_time_min` | **DEP — GAP-5** (existe no banco, store não lê) | — |
| Mapa + geocodificação por número + alfinete | `MapaInterativoRota`/`SeletorPontoMapa` + `geocode.ts` + `api/mapas` | RF (Fase 14/PR #14) | ao mover/salvar |
| "2 escolas · Seg a Sex" (demo) | `OPORTUNIDADES`/`INDICADORES_DEMO` | DEMO (no `/pro`) | Fase 7 liga ao real |
Forward: editar rota → `salvar_rota_completa` (⚠️ apaga-e-recria — GAP-3). **Pré-requisito** antes da Fase 7: corrigir a RPC + aplicar 0010.

## TELA 6 — Oportunidades (famílias procurando)
Demo: `VamboraProPage > Oportunidades` (`OPORTUNIDADES_DEMO`).
| Elemento | Fonte real / motor | Classe | Atualização |
|---|---|---|---|
| Lista de oportunidades (região/escola/turno) | hoje `OPORTUNIDADES_DEMO` | DEMO (não há fila real de demanda) | Fase 8/D |
| Origem da demanda real | `waitlist_requests`/`leads` (interesse das famílias) | DEP (precisa pipeline de demanda) | Fase 8 |
| Compatibilidade de uma oportunidade | `busca-encaixe.buscarComMotor` / `encontrarEncaixes` | RNC (motor pronto, sem feed real) | — |
Nuance: a **fila** é demo; a **avaliação de compatibilidade** usa motor real (ver Tela 7).

## TELA 7 — Simulador de encaixe ("e se eu aceitar?")
Demo: `VamboraProPage > SimuladorImpacto`. Real: `SimuladorEncaixePage` (`/painel/simulador`).
| Indicador | Fonte real / motor | Classe | Atualização |
|---|---|---|---|
| Cabe / não cabe | `encontrarEncaixes` (motor real) | **RF — já usa motor real** (mesmo no `/pro`, sobre dados demo) | recalcula ao simular |
| Horário busca em casa / chega à escola | `opcao.horarioBuscaMin/horarioEntregaMin` | RF (cálculo real) | — |
| min a bordo / desvio | `opcao.minutosABordo/desvioMin` | RF | — |
| Matriz de tempos | `criarMatrizDemo` (demo) **ou** `matrizDeTabelas` (real, com login) | RF c/ matriz real; demo usa matriz sintética | — |
| Compromissos por aluno (atendimento/tolerância) | `route_passengers` (Fase 2) — **depende da 0010** | DEP | Fase 8 |
Classificação honesta: **lógica real**; os **dados** podem ser demo (matriz sintética) ou reais (rota salva + matriz viária). Não substituir o motor por fórmula.

## TELA 8 — Inteligência / Financeiro
Demo: `VamboraProPage > Financeiro` (`FINANCEIRO_DEMO`, `INDICADORES_DEMO.receitaMes/aReceber`).
| Indicador | Fonte real / cálculo | Classe | Atualização |
|---|---|---|---|
| Receita do mês / a receber | — (não há tabela de pagamentos) | DEMO/DEP (precisa modelo financeiro) | Fase 9 |
| Mensalidade por aluno | `drivers.price_month`/`price_daily` (referência) | RNC (demo usa `FINANCEIRO_DEMO.mensalidade`) | — |
| Gráfico últimos meses | — | DEMO | Fase 9 |
| nº pagas / em atraso | — (sem cobrança real) | DEMO | Fase 9 |
"Inteligência" (ocupação média, aproveitamento) = **CALC** a partir de `ocupacao-rota` + rotas. Financeiro de receita/cobrança = **DEP** (não há dados).

## TELA 9 — Combustível
Demo: `VamboraProPage > Combustivel` (`COMBUSTIVEL_DEMO`).
| Indicador | Fonte real / cálculo | Classe | Atualização |
|---|---|---|---|
| Consumo (km/L) | `vehicles.consumo_kml` (**coluna existe**) | RNC (falta coletar na UI + mapear no tipo) | ao coletar (Fase 5) |
| Distância da rota | Σ `route_stops.leg_time_min`/OSRM ou `matrizDeTabelas`/`haversineMetros` | CALC | ao salvar/calcular |
| Gasto do mês / preço do litro | preço informado pelo motorista (**sem coluna hoje**) | DEP (precisa campo de preço + registro) | Fase 9 |
| Último abastecimento | — (sem tabela) | DEMO/DEP | Fase 9 |
Projeção = `consumo_kml` + distância (reais) × preço informado → **CALC assim que houver preço**.

## TELA 10 — Passageiros
Demo: `VamboraProPage > Passageiros` (`ALUNOS_DEMO`). Real: embutido nas rotas.
| Indicador | Fonte real | Classe | Atualização |
|---|---|---|---|
| Lista (apelido, escola, embarque) | `route_passengers.identificacao/destination_id/board_stop_id` + `destinations` | CALC (dados existem nas rotas; falta uma tela agregada) | ao salvar rota |
| Privacidade (só apelido) | contrato já respeitado | RF | — |
| Compromisso por aluno (horário/tolerância/atendimento) | `route_passengers` 5 campos | DEP — migração 0010 | Fase 5/7 |

## TELAS COMPLEMENTARES (fazem parte do conjunto de módulos)
| Tela | Fonte real | Classe | Fase |
|---|---|---|---|
| **Vagas por trecho** | `ocupacaoPorTrecho(rota)` (pronto!) | CALC (demo usa lista fixa) | 6/7 |
| **Calendário** | `routes.days`/`turno` (programação) + `CALENDARIO_DEMO` | RNC/DEMO | 11 |
| **Manutenção** | sem tabela (`MANUTENCAO_DEMO`) | DEP (tabela nova) | 11 |
| **Documentação** | `documents`/`document_requirements` + RPCs `*_documentos_ok` | RNC (banco real existe; `/pro` usa `DOCUMENTOS_DEMO`) | 11 |
| **Clube do Motorista** | sem dados (futuro `club_offers`) | DEMO (fixtures substituíveis) | 10 |
| **AlugaVan** | sem dados | DEMO | 11 |
| **Perfil** | `drivers.*` (nome, nota, cidade, etc.) | RNC — **GAP-1b** (motorista não edita `drivers`) | 5 |
| **Relatórios** | `ocupacao-rota` + rotas | CALC/DEP | 9 |

---

## Caminho inverso (edição do motorista → consumidores)
| Edita | Grava | Consumidores | Estado |
|---|---|---|---|
| Van (recursos/capacidade/consumo) | `vehicles` (`salvarVeiculo`) | painel do motorista | RF até o painel; **não chega ao marketplace** (GAP-1) |
| Perfil público (nome, bairros, preço, turnos) | **deveria** gravar `drivers` | `public_listings` → busca/perfil | **DEP — GAP-1b** (não há escrita do motorista em `drivers`) |
| Rota (paradas/passageiros/horários) | `routes/route_stops/route_passengers` via RPC | construtor, simulador, motores, (futuro) busca | RF com ⚠️ GAP-3 (RPC apaga-e-recria; 0010 pendente) |
| Compromisso por aluno | `route_passengers` (5 campos) | motor progressivo, simulador | DEP — 0010 |

## Integrações mais delicadas (ordem de risco)
1. **GAP-1 / GAP-1b (van/perfil ↔ marketplace):** decidir fonte de verdade (`vehicles`↔`drivers`↔`public_listings`) e criar escrita segura do motorista em `drivers` sem quebrar `motorista_elegivel`/RLS/`trg_proteger_driver`. Afeta Telas 3, 4, 10, Perfil e todo o marketplace. **Fase 5.**
2. **GAP-3 (RPC `salvar_rota_completa` + migração 0010):** apaga-e-recria → risco a ids/vínculos/compromissos. Pré-requisito das Telas 5/7/10 reais. **Antes da Fase 7.**
3. **Oportunidades reais (Tela 6):** exige pipeline de demanda (de `waitlist_requests`/busca das famílias) para alimentar o motor — hoje só demo. **Fase 8.**
4. **Financeiro/Combustível (Telas 8/9):** faltam dados (pagamentos, preço de combustível) — parte é CALC (ocupação, distância), parte é DEP. **Fase 9.**
5. **GAP-5 (`planned_time_min`):** coluna no banco não lida pelo store — decidir uso/limpeza. Baixo risco.

## Resumo por classificação
- **RF (já alimentam tela):** auth, cadastro de van (até o painel), lista/detalhe/construtor de rotas, mapa+geocodificação, simulador de encaixe (lógica), contadores do painel real.
- **CALC (ligar motor/serviço pronto):** alunos, vagas, escolas, % ocupação, vagas por trecho, distância da rota, lista de passageiros agregada, indicadores de "inteligência" de ocupação.
- **RNC (real no banco, não na tela):** `consumo_kml`, `drivers.rating_*`/preço, documentação (`documents`), perfil público.
- **DEP (precisa dado/implementação):** reflexo van→marketplace (GAP-1), edição de `drivers` (GAP-1b), compromissos (0010), receita/cobrança, preço de combustível, manutenção, oportunidades reais, `planned_time_min`.
- **DEMO (sem fonte real planejada agora):** avisos, calendário (parcial), Clube, AlugaVan, gráficos financeiros de exemplo.
