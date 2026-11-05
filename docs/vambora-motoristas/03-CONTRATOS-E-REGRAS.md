# 03 — Contratos de Dados e Regras de Negócio

Contratos reais encontrados no código. Mudar qualquer um destes afeta mais de
uma tela; trate-os como interface pública.

## Tipos de domínio — marketplace (`src/types/index.ts`)
`Motorista`: `id, slug, nome, fotoUrl, vanFotoUrl, descricao, cidadeId,
bairrosAtendidos[], destinosIds[], turnos[], capacidadeTotal, vagasDisponiveis,
recursos{arCondicionado,monitor,cintoTresPontos,acessibilidade},
preco{tipo,mensal?,avulso?}, avaliacao{media,quantidade},
janela{horario,toleranciaAntesMin,toleranciaDepoisMin}, documentacaoVerificada,
whatsapp, demo`.
`Destino`, `CriteriosBusca{cidadeId,endereco,destinoId,turno,contratacao,...}`.

## Tipos de domínio — motorista (`src/types/motorista.ts`)
- `Veiculo`: `id, modelo, ano?, placa?, lugaresPassageiro, arCondicionado, acessivel, cintos, fotos[]`.
- `Rota`: `id, nome, sentido('ida'|'volta'), turno, dias[], veiculoId, monitor, monitorOcupaLugar, lugaresReservados, ultimoDesembarqueMin, limiteAntecipacaoMin, status, atualizadoEm, paradas[], passageiros[]`.
- `ParadaRota`: `id, ordem, tipo('saida'|'casa'|'escola'), rotulo, lat?, lng?, confirmado, destinoId?, tempoAteProximaMin?`.
- `PassageiroRota`: `id, identificacao, embarqueParadaId, desembarqueParadaId, destinoId, horarioHabitualMin?, ajusteAntesMin?, ajusteDepoisMin?, atendimentoMin?, atendimentoOrigem?` (os 5 últimos = Fase 2, dependem da migração 0010).

## Contrato banco ↔ domínio (mapeadores — NÃO quebrar nomes de coluna)
- **Marketplace:** `src/data/source.ts` `mapMotorista(LinhaListing)` — colunas de `public_listings`/`drivers`: `feature_ac→recursos.arCondicionado`, `feature_monitor→monitor`, `feature_seatbelt→cintoTresPontos`, `feature_accessible→acessibilidade`, `capacity_total→capacidadeTotal`, `seats_available→vagasDisponiveis`, `price_type/price_month/price_daily→preco`, `boarding_time/tolerance_*→janela`.
- **Veículo:** `motorista-store.ts` `salvarVeiculo` — `modelo→model, ano→year, placa→plate, lugaresPassageiro→seats_passenger, arCondicionado→feature_ac, acessivel→feature_accessible, cintos→feature_seatbelt, fotos→photo_urls`. (⚠️ `vehicles` tem `consumo_kml` no banco, ainda **não** mapeado no tipo `Veiculo` — oportunidade para o módulo Combustível.)
- **Rota:** `motorista-store.ts` `rotaParaBanco`/`mapRotaDoBanco` — inclui `stops[]` e `passengers[]` com os campos de compromisso.

## Tabelas (colunas verificadas no banco)
- `drivers`: `id, slug, owner_id, name, photo_url, van_photo_url, description, city_id, neighborhoods, turnos, capacity_total, seats_available, feature_ac, feature_monitor, feature_seatbelt, feature_accessible, price_type, price_month, price_daily, rating_avg, rating_count, boarding_time, tolerance_before_min, tolerance_after_min, whatsapp, doc_verified, is_demo, is_published, is_suspended, anuncio_ativo, created_at, updated_at`.
- `vehicles`: `id, owner_id, model, year, plate, seats_passenger, feature_ac, feature_accessible, feature_seatbelt, consumo_kml, photo_urls, is_demo, created_at, updated_at`.
- `routes`: `id, owner_id, vehicle_id, city_id, name, direction, turno, days, monitor, monitor_ocupa_lugar, reserved_seats, last_dropoff_min, early_leave_limit_min, status, version, is_demo, created_at, updated_at`.
- `route_stops`: `id, route_id, ordem, type, label, lat, lng, confirmed, destination_id, leg_time_min`.
- `route_passengers`: `id, route_id, identificacao, board_stop_id, alight_stop_id, destination_id, created_at` — **sem** os 5 campos de compromisso (migração 0010 pendente).

### Chaves estrangeiras relevantes (route_*)
- `route_passengers.board_stop_id → route_stops.id` **ON DELETE CASCADE**
- `route_passengers.alight_stop_id → route_stops.id` **ON DELETE SET NULL**
- `route_passengers.route_id → routes.id` / `route_stops.route_id → routes.id` **ON DELETE CASCADE**

## RPCs (banco)
- `salvar_rota_completa(p_rota jsonb)` — `SECURITY DEFINER`; cria/atualiza `routes` (checa dono/admin), depois **apaga e recria** `route_stops`+`route_passengers`. IDs preservados só se o payload reenviar; concorrência por `version`. ⚠️ ver `08`.
- `registrar_interesse(...)`, `solicitar_contato_whatsapp(...)`.
- `motorista_elegivel(drivers)`, `condutor_documentos_ok`, `veiculo_documentos_ok` — elegibilidade/publicação.
- `is_admin`, `has_role`, `handle_new_user` (gatilho de criação de `profiles`), `set_updated_at`, `proteger_campos_driver`, `proteger_documento`.

## Motores (`src/engine/*`) — contratos de cálculo (NÃO alterar sem fase própria)
- `engine.ts` (legado) + `matching.ts` (legado) — marcados como candidatos a legado na Fase 1 do Algoritmo Supremo.
- `encaixe-geografico.ts` — motor oficial. Tipos: `PontoGeo, Compromisso{…,atendimentoMin}, MatrizViaria, RotaOperacional, PedidoEncaixe, OpcaoEncaixe`. Funções: `simularRota`, `encontrarEncaixes`, `encontrarIdaVolta`, `encontrarEncaixesProgressivo` (escola nova + reorganização + classificação compatível/incompatível/indeterminado).
- `planejamento.ts` — horários/ocupação por sequência.
- Adaptadores em `src/lib/`: `encaixe.ts`, `rota-para-encaixe.ts` (usado pelo simulador via `simularEncaixeRota`), `rota-para-motor.ts`, `busca-encaixe.ts`, `matriz-viaria.ts`, `ocupacao-rota.ts`.
- **Regra de honestidade do motor:** nunca inventa tempos; trecho sem dado vira indeterminado; não afirma "impossível" por esgotar orçamento de busca.

## Regras de negócio a preservar
1. Visibilidade pública = `motorista_elegivel` (publicado, não suspenso, docs do condutor e do veículo aprovados, etc.). Sem requisitos ⇒ não elegível.
2. Capacidade conta **lugares de passageiro** (motorista não ocupa; monitor ocupa só se `monitorOcupaLugar`); `reserved_seats` reduz oferta.
3. Simulação **não grava** (é só avaliação). Confirmação de encaixe exige operação atômica no servidor (RPC 0009 `confirmar_encaixe_rota` **não aplicada**).
4. Tolerância individual por aluno (Fase 2) nunca apresentada como "confirmada" quando `NULL`/provisória.
5. Privacidade: endereços dos alunos e telefone não vão para a vitrine pública.
