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

## Etapa 1 da busca e do encaixe — modelo de dados e cadastro (migração 0015)

Regra geral: **`NULL`/vazio = não informado; zero = informado como zero.** Cadastro antigo não
recebe horário nem autorização por suposição: o app lista o que falta em "Precisa de revisão"
(`pendenciasDeRevisao`, em `src/lib/cadastro-rota.ts`).

| Informação | Onde fica | Observação |
|---|---|---|
| Endereço de saída da van | parada `route_stops.type = 'saida'` | já existia |
| Horário habitual de saída | `routes.habitual_departure_min` | novo |
| Quanto autoriza antecipar | `routes.early_leave_limit_min` | já existia; `0` = não autoriza, `NULL` = não informado |
| Período escolar | `routes.turno` + `routes.turno_confirmed` | separado de `routes.direction`; o app sugere pelo horário e o motorista confirma |
| Ponto final obrigatório e limite | última parada + `routes.last_dropoff_min` | preservado |
| Endereço do aluno | parada `casa` do aluno | ida: embarque; volta: desembarque |
| Escola do aluno | `destination_id` da parada de escola do aluno | sempre o ID do catálogo `destinations` (o mesmo das famílias) |
| Horário habitual e flexibilidade do aluno | `route_passengers.horario_habitual_min`, `ajuste_antes_min`, `ajuste_depois_min` | já existiam |
| Tempo de atendimento do aluno | `route_passengers.atendimento_min` | agora `numeric(6,2)`: `0.5` = 30 s |
| Portão da escola | `lat`/`lng` da parada + `route_stops.gate_custom` | a unidade continua sendo `destination_id` |
| Limite de chegada (ida) | `route_stops.arrival_deadline_min` | novo; diferente de `habitual_arrival_min` |
| Liberação (volta) | `route_stops.release_time_min` | novo |
| Tempo de atendimento do grupo | `route_stops.group_service_min` | novo, aceita fração |
| Escolas já no percurso | paradas `type = 'escola'` | — |
| Escolas que aceita incluir | `route_school_availability` (+ `routes.availability_reviewed`) | pertence à rota (período, sentido e dias dela; `days` opcional restringe os dias); **não é parada** e não altera a duração |
| Lista geral do motorista | `driver_destinations` | só sugere o preenchimento; não autoriza rota nenhuma |

Compatibilidade: a RPC `salvar_rota_completa` mantém os campos novos quando o payload vem do app
anterior (chaves ausentes); o app e a API leem no formato anterior se o banco ainda não tiver a
migração. Enquanto o limite de chegada/liberação não for informado, os cálculos seguem usando o
horário habitual da parada, como antes. O uso das escolas disponíveis pela busca fica para a
próxima etapa.

Teste local (PostgreSQL descartável, sem tocar no Supabase): `supabase/tests/rodar-local.sh`.
