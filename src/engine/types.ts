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
