# Motor de encaixe do Vambora — contrato implementado

Módulo isolado em `src/engine/`, TypeScript strict, funções puras e determinísticas,
sem rede, mapas, relógio, aleatoriedade ou dependências de produção.
Tempos e desvios são entradas fornecidas pelo chamador; o motor não mede trajetos.
A implementação foi preparada com assistência do ChatGPT/Codex.

## Decisões que corrigem o brief anterior

- O caso-base tinha aula às 07:00, margem de 10 minutos e chegada às 07:00,
  mas esperava “disponível”. Agora a aula do caso-base começa às **07:10 (430)**:
  a chegada às 07:00 (420) respeita exatamente a margem. Um teste separado
  mantém os números antigos e confirma que o resultado é indisponível.
- Dados ausentes **ou inválidos** produzem `elegivel=false`. A regra anterior
  `elegivel = nivel !== 'indisponivel'` não se aplica a dados incompletos.
- `indice` significa inserção **antes** do ponto nesse índice. Logo, o ponto
  nesse índice também sofre atraso. `indice === pontos.length` é após o último.
- O embarque divide o trecho que sai da parada anterior: a ocupação desse trecho
  também deve ser conferida. Isso fecha a brecha da inserção após a última parada.
- Limite a bordo `null` não reprova por duração, mas deixa o resultado sob consulta,
  com alerta. Não significa que 60 minutos sejam uma lei validada.
- Falhas duras prevalecem sobre condições negociáveis. O motor acumula motivos
  quando há dados suficientes para calcular, sem transformar atraso em aprovação.

## Escopo e pressupostos

Uma solicitação representa **um aluno**, que permanece até o destino único da rota.
`pontos` já estão ordenados e `ocupacaoTrechoSeguinte` representa o estado antes
inserir esse aluno. Array vazio significa rota explicitamente sem paradas/passageiros;
array ausente é dado faltante. Antes da primeira parada a ocupação é zero.

Horários são minutos desde meia-noite, no mesmo dia, entre 0 e 1440 exclusivo.
Frações de minuto são aceitas; índices, capacidade e ocupação são inteiros.
Rotas que atravessam meia-noite exigem evolução desse contrato.

O motor não verifica se destino/turno/tempo informado corresponde à realidade,
não geocodifica endereço e não calcula trânsito. `disponivel` é compatibilidade
**com os dados recebidos**, não reserva nem garantia operacional.

## Tipos públicos

```ts
/** Minuto desde a meia-noite. 06:38 => 398. */
export type Minutos = number;

export type Turno = 'manha' | 'tarde' | 'noite' | 'integral';
export type Contratacao = 'mensal' | 'avulso';
export type NivelEncaixe = 'disponivel' | 'sob_consulta' | 'indisponivel';

/** Um ponto na sequência da rota (em ordem de passagem). */
export interface PontoRota {
  id: string;
  /** Minuto planejado de passagem neste ponto, SEM trânsito extra. */
  horarioPlanejado: Minutos;
  /** Assentos já ocupados NO TRECHO seguinte a este ponto, antes do novo aluno. */
  ocupacaoTrechoSeguinte: number;
  /** Janela contratada deste passageiro existente (quanto ele tolera atrasar), em minutos. */
  toleranciaAtrasoMin: number;
}

export interface DestinoRota {
  id: string;
  /** Minuto de início da aula/compromisso. */
  horarioInicioAula: Minutos;
  /** Margem mínima para chegar ANTES da aula (minutos). */
  margemChegadaMin: number;
}

/** A rota de uma van, para um turno, já planejada. */
export interface RotaInstancia {
  id: string;
  turno: Turno;
  destino: DestinoRota;
  capacidadeVeiculo: number;
  /** Pontos em ordem de passagem (primeiro embarque -> último antes do destino). */
  pontos: PontoRota[];
  /** Minuto planejado de CHEGADA ao destino, SEM trânsito extra. */
  chegadaPlanejadaDestino: Minutos;
  /** Buffer de PIOR CASO de trânsito a somar aos tempos (minutos). >= 0. */
  bufferPiorCasoMin: number;
  /**
   * Limite de tempo a bordo em minutos. `null` = parâmetro AINDA NÃO validado legalmente:
   * nesse caso NÃO bloqueia o encaixe, apenas adiciona um alerta informativo.
   */
  limiteTempoABordoMin: number | null;
}

/** O pedido do novo aluno + como ele entraria na rota. */
export interface SolicitacaoAluno {
  destinoId: string;
  turno: Turno;
  contratacao: Contratacao;
  /** Data do serviço avulso (YYYY-MM-DD). Só quando contratacao === 'avulso'. */
  dataAvulso?: string;
  /**
   * Janela desejada de passagem do aluno no ponto dele (opcional).
   * Se informada, a passagem estimada precisa caber em [desejadoMin - antes, desejadoMin + depois].
   */
  janelaDesejada?: { desejadoMin: Minutos; antesMin: number; depoisMin: number };
  /** Como o aluno entra na rota (desvio já calculado por fora; aqui é entrada). */
  insercao: {
    /** Entra ANTES de pontos[indice]; length = após a última parada. Divide o trecho anterior. */
    indice: number;
    /** Minuto planejado de passagem no ponto do novo aluno, SEM buffer. */
    horarioPassagemPlanejado: Minutos;
    /** Minutos adicionais que o desvio para pegar este aluno soma ao RESTANTE da rota. >= 0. */
    atrasoAdicionalMin: number;
  };
  /** Para avulso: assentos de folga disponíveis naquele dia. undefined = não informado. */
  folgaAvulsoAssentos?: number;
}

export interface ImpactoEncaixe {
  /** Chegada ao destino (com buffer) ANTES de aceitar o aluno. */
  chegadaAntes: Minutos;
  /** Chegada ao destino (com buffer) DEPOIS de aceitar o aluno. */
  chegadaDepois: Minutos;
  /** Folga até a aula ANTES (margem positiva = chega com folga). */
  folgaAntesMin: number;
  /** Folga até a aula DEPOIS. */
  folgaDepoisMin: number;
}

export interface ResultadoEncaixe {
  elegivel: boolean;
  nivel: NivelEncaixe;
  /** Explicações honestas em pt-BR (uma ou mais frases curtas). */
  motivos: string[];
  /** Minuto estimado de passagem no ponto do aluno (COM buffer). */
  passagemEstimada?: Minutos;
  /** Tempo estimado do aluno dentro da van até o destino (minutos). */
  tempoABordoMin?: number;
  /** Chegada estimada ao destino com o novo aluno (COM buffer). */
  chegadaEstimadaDestino?: Minutos;
  impacto?: ImpactoEncaixe;
  /** true quando a janela de um passageiro existente ou do novo aluno exige renegociação. */
  precisaRenegociacao: boolean;
  /** Campos ausentes ou inválidos. Se não vazio, elegivel=false e nunca disponível. */
  dadosFaltantes: string[];
}

```

## Funções públicas


```ts
/** Avalia se o aluno encaixa na rota. Função PURA. */
export function avaliarEncaixe(
  rota: RotaInstancia,
  solicitacao: SolicitacaoAluno,
): ResultadoEncaixe;

/**
 * Revalida imediatamente antes de confirmar a vaga (o estado pode ter mudado).
 * Mesma lógica de avaliarEncaixe; existe para deixar explícito o passo de revalidação.
 */
export function revalidarAntesDeConfirmar(
  rota: RotaInstancia,
  solicitacao: SolicitacaoAluno,
): ResultadoEncaixe;
```


## Regras e precedência

1. **Compatibilidade:** turno ou destino conhecidos e diferentes retornam
   indisponível, `elegivel=false`, motivo “Turno ou destino incompatível”.
   Campo desconhecido não é tratado como incompatibilidade comprovada.
2. **Validação:** campos essenciais, objetos e arrays ausentes, valores não finitos,
   negativos onde proibidos, índices fora dos limites, IDs de paradas repetidos e
   ordem temporal incoerente ficam em `dadosFaltantes`. Retorno sob consulta e
   inelegível, sem estimativas inventadas. Capacidade e início da aula devem ser
   maiores que zero; limite a bordo é positivo ou null.
3. **Capacidade:** conferir todos os trechos a partir de `max(0, indice - 1)`.
   Exigir `ocupacaoTrechoSeguinte + 1 <= capacidadeVeiculo`. O trecho anterior
   ao índice só conta na porção depois do novo embarque. Trechos inteiramente
   anteriores não entram na avaliação. Falha: “Sem assento em um dos trechos”.
4. **Tempos:**
   - passagem = passagem planejada do novo aluno + buffer;
   - chegada antes = chegada planejada ao destino + buffer;
   - chegada depois = chegada antes + atraso adicional;
   - tempo a bordo = chegada depois − passagem.
   O horário planejado do novo aluno já é fornecido pelo chamador; não se soma
   o desvio novamente à passagem. O buffer uniforme se cancela no tempo a bordo:
   esse é um modelo simplificado, não uma simulação de trânsito por trecho.
5. **Chegada:** chegada depois deve ser menor ou igual ao início da aula menos
   margem. Se ultrapassar: indisponível, “Chegaria tarde demais para a aula”.
6. **Passageiros existentes:** nos pontos `i >= indice`, comparar atraso adicional
   com tolerância. Igual é permitido; maior exige renegociação e sob consulta.
   Não altera horários nem compara o buffer novamente com a tolerância: esta regra
   mede o atraso incremental causado pelo novo aluno.
7. **Janela desejada:** passagem dentro de `[desejadoMin - antesMin,
   desejadoMin + depoisMin]`, inclusive. Fora: sob consulta e
   `precisaRenegociacao=true`. Esse indicador cobre tanto a janela nova quanto
   a de passageiros existentes.
8. **Bordo:** acima de limite numérico bloqueia; igual permite. Null adiciona
   “Limite de tempo a bordo pendente de validação legal” e sob consulta.
   A duração avaliada é a do novo aluno; as durações individuais dos demais
   não são representadas neste contrato e devem ser validadas numa evolução.
9. **Avulso:** exige data civil válida YYYY-MM-DD e folga inteira não negativa.
   Zero bloqueia. Ausência ou valor inválido entra em `dadosFaltantes` e deixa
   inelegível. Essas duas faltas não impedem calcular impacto e detectar outras
   falhas duras. Mesmo com tudo válido, avulso é sempre sob consulta.
   A data não consulta calendário, não altera a rota e não é comparada com hoje.
   O chamador deve enviar a rota e a folga correspondentes ao dia solicitado.
10. **Resultado:** falha dura ⇒ indisponível. Sem falha dura, condição negociável,
    limite pendente, avulso ou dados faltantes ⇒ sob consulta. Caso contrário,
    mensal ⇒ disponível. Elegível somente quando não indisponível **e** sem
    dados faltantes. Elegível sob consulta não significa autorizado a confirmar.
11. **Impacto:** sempre preenchido quando os dados do cálculo são válidos.
    Folga = início da aula − chegada; não é a folga restante após descontar a margem.
    Somente somas finitas são retornadas.
12. **Imutabilidade e revalidação:** nenhuma entrada é modificada. A revalidação
    chama a mesma lógica com o estado recebido, sem cache nem acesso ao banco.

## Exemplo verificável

Caso-base: aula 430, margem 10, chegada planejada 410, buffer 8,
embarque planejado 390, desvio 2, limite a bordo 60 e assento livre em todos
os trechos afetados. Resultado:

| Campo | Valor |
|---|---|
| passagemEstimada | 398 (06:38) |
| chegadaEstimadaDestino | 420 (07:00) |
| tempoABordoMin | 22 |
| impacto.chegadaAntes | 418 (06:58) |
| impacto.folgaAntesMin | 12 |
| impacto.folgaDepoisMin | 10 |
| nivel | disponivel |

Os testes de renegociação usam aula às 07:30 para isolar a tolerância sem
esconder uma violação da margem de chegada. Inserção após a última parada
usa embarque às 06:45, posterior à última parada às 06:40.

## Validação e arquivos

- `src/engine/types.ts`: contrato dos tipos originais, com comentários esclarecidos.
- `src/engine/engine.ts`: avaliação e revalidação.
- `src/engine/engine.test.ts`: cenários de compatibilidade, capacidade nos trechos,
  margens, tolerâncias, janela nova, limite a bordo, avulso, impacto, dados inválidos,
  cronologia, imutabilidade e revalidação.

Execute `npx vitest run src/engine`, `npm test` e `npm run build`.
Os testes antigos do adaptador continuam separados dos testes do motor.

## Integração posterior — responsabilidade do chamador

A busca atual não foi modificada por esta implementação. O adaptador deverá montar
`RotaInstancia` e `SolicitacaoAluno` com dados suficientes, inclusive ocupação por trecho.
Não converter o único total de vagas do motorista em ocupações fictícias por parada.

Antes da confirmação, obter estado atualizado e chamar `revalidarAntesDeConfirmar`.
Para impedir dois usuários de ocupar a mesma vaga, a persistência deverá verificar
capacidade e reservar de forma atômica no servidor. Esta função pura sozinha não
resolve concorrência. Condições sob consulta exigem confirmação/renegociação externa.

Nenhuma integração com telas, banco, mapas ou confirmação foi adicionada nesta etapa.

## Etapa 2 — incluir um aluno é reprogramar a viagem inteira

Código: `src/engine/encaixe-geografico.ts` (motor) e `src/lib/rota-para-encaixe.ts`,
`src/lib/busca-rotas-reais.ts`, `api/buscar-rotas.ts` (adaptadores). Testes do cenário de
referência (saída → 1 → 2 → 3 → escola A → 4 → escola B): `src/lib/encaixe-viagem-inteira.test.ts`.

**Como o motor decide.** Para cada posição de embarque e de desembarque do novo aluno, a viagem é
recalculada do começo ao fim, trecho por trecho: deslocamento pelas ruas, chegada, espera (quando
a van chega antes do horário combinado ou da liberação), atendimento, saída e ocupação. Uma
candidata só vale se TODOS os compromissos continuam cumpridos.

| Regra | Como é aplicada |
|---|---|
| Saída habitual | A cadastrada (`saidaHabitualMin`). Sem ela, é calculada de trás para frente e o resultado indica `fontePartida: 'calculada'`. |
| Antecipação | Calculada pela folga real, já descontando esperas (`antecipacaoNecessariaMin`); a van sai em minuto cheio (`antecipacaoMin`). Dentro do autorizado = viável; acima = aprovação. Com saída cadastrada e antecipação não informada, nada é presumido. |
| Janelas individuais | Horário habitual − "antes" / + "depois" de cada aluno. Embarque cedo = a van espera; tarde = inviável. Nunca são deslocadas. |
| Limites das escolas | Cada escola tem o seu (ida: chegar até; volta com liberação cadastrada: não sair antes, a van espera). |
| Ponto final | Na ida, a última escola com limite continua sendo a última parada. Na volta, "última entrega até" vale para a viagem inteira. |
| Capacidade | Conferida a cada trecho com o novo aluno a bordo; lugares = van − monitor (se ocupa) − reservados. |
| Atendimento | Individual na casa; do grupo na escola, uma vez. Escola nova soma o tempo do grupo uma vez. Mesma coordenada: deslocamento 0, atendimento soma. |
| Escola aceita e não visitada | Casa e escola entram juntas na avaliação, com o portão, o limite e o tempo de grupo informados na lista de aceitas. Lista revisada sem a escola = não avaliada. Lista nunca revisada (cadastro antigo) = avaliada, mas a inclusão depende de aprovação. |
| Reorganização | Só quando a ordem atual não resolve: por compromisso (até 8) ou por parada (rotas maiores), mantendo precedência, limites e ponto final. Sempre depende de aprovação. Uma parada existente não é partida ao meio. |
| Precisão | Trechos reais em minutos com duas casas (não mais arredondados para cima). |

**Situação final** (`situacao`): `viavel`, `aprovacao` (com a lista em `aprovacoes`),
`incompativel` (todas as posições calculadas, com dados completos) ou `inconclusivo` (faltou dado,
rota-base inconsistente ou a busca atingiu o limite de ordens — nunca significa "não cabe").

**Explicação.** `explicacao` traz o resumo em texto; `trechos` traz a viagem recalculada linha a
linha, com a chegada atual e a diferença de cada compromisso.
