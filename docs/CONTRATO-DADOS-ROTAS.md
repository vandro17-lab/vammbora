# Contrato de dados das rotas → motor de encaixe

Este documento descreve **como os dados persistidos pelo cadastro de rotas** (tabelas
`routes`, `route_stops`, `route_passengers`, `vehicles`) se convertem na entrada do motor de
encaixe (`src/engine/types.ts` → `RotaInstancia`). **O cadastro fornece os dados; o motor avalia.**

> ⚠️ Esta tarefa **não** altera `src/engine/` nem `src/lib/matching.ts`. A conversão
> (adaptador) e o consumo do cálculo ficam a cargo da revisão dos motores (ChatGPT). Aqui só
> definimos o contrato e um ponto de integração (`src/lib/rota-para-motor.ts`).

## Origem dos dados (Supabase)

- `vehicles.seats_passenger` — lugares de passageiro (o motorista **não** conta).
- `routes` — `direction` (ida/volta), `turno`, `monitor`, `monitor_ocupa_lugar`,
  `reserved_seats` (lugares indisponíveis a alunos), `last_dropoff_min`, `early_leave_limit_min`,
  `status` (`rascunho`/`concluida`), `version`, `vehicle_id`, `city_id`.
- `route_stops` — paradas em ordem (`ordem`), `type` (`saida`/`casa`/`escola`), `label` (privado),
  `lat`/`lng`/`confirmed`, `destination_id` (quando escola), `planned_time_min` (estimativa).
- `route_passengers` — `identificacao` (privado), `board_stop_id`, `alight_stop_id`,
  `destination_id` (derivado do desembarque).

## Capacidade disponível por trecho (DERIVADA, não armazenada solta)

A ocupação em cada trecho é **calculada** a partir dos embarques/desembarques, nunca um número
independente que possa divergir:

```
capacidade_alunos = vehicles.seats_passenger
                  - (routes.monitor_ocupa_lugar ? 1 : 0)
                  - routes.reserved_seats

ocupacao_apos(parada_i) = nº de passageiros cujo board.ordem <= i E (alight é null OU alight.ordem > i)
livres_apos(parada_i)  = capacidade_alunos - ocupacao_apos(parada_i)
```

Helper em `src/lib/ocupacao-rota.ts` (`capacidadeAlunos`, `ocupacaoPorTrecho`). A vitrine e o
motor **não** devem usar um "vagas" fixo: sempre derivar da sequência.

> Exemplo: a van pode estar cheia antes de uma escola e ter 3 lugares livres depois que 3 alunos
> descerem — isso **não** significa 3 vagas no percurso inteiro.

## Mapeamento para `RotaInstancia` (uma por destino/escola da rota)

Uma rota com N escolas gera, para o motor, **uma `RotaInstancia` por escola** (o adaptador do
motor monta cada uma). Para cada escola `E` da rota:

| Campo `RotaInstancia` | Origem |
|---|---|
| `id` | `routes.id` + `E.destination_id` |
| `turno` | `routes.turno` |
| `destino.id` | `E.destination_id` |
| `destino.horarioInicioAula` | do catálogo da escola (quando confiável) ou restrição informada; se ausente, **dado faltante** |
| `destino.margemChegadaMin` | parâmetro (default seguro); pendente de validação legal |
| `capacidadeVeiculo` | `capacidade_alunos` (ver acima) |
| `pontos[]` | paradas `casa` antes de `E`, em ordem, com `horarioPlanejado` = `planned_time_min` e `ocupacaoTrechoSeguinte` derivada; `toleranciaAtrasoMin` = janela contratada (parâmetro) |
| `chegadaPlanejadaDestino` | `planned_time_min` da parada `E` (quando houver) |
| `bufferPiorCasoMin` | parâmetro (default) |
| `limiteTempoABordoMin` | `null` enquanto pendente de validação legal |

### Horários / cálculo reverso

- `routes.last_dropoff_min` = "a que horas deixar o último aluno".
- `routes.early_leave_limit_min` = limite de antecipação.
- Os `planned_time_min` das paradas são **estimativas**: quando faltarem tempos de trecho ou o
  cálculo do motor, a rota pode ser salva **sem** previsão. Nunca marcar como apta ao encaixe só
  por ter sido cadastrada.

## Ponto de integração

`src/lib/rota-para-motor.ts` exporta `rotaParaInstancias(rota): { instancias; dadosFaltantes }`.
Ele monta as `RotaInstancia` a partir dos dados persistidos e **lista o que falta** (ex.: horário
de início da escola, tempos de trecho). O motor só é consumido quando `dadosFaltantes` está vazio;
caso contrário, a rota fica cadastrada mas **não** elegível ao encaixe automático.

> Enquanto o contrato não estiver plenamente atendido (tempos/cálculo), o app **não** afirma que o
> encaixe foi verificado. Isso é responsabilidade da revisão dos motores (ChatGPT).
