import type { Turno } from '@/types';

export type SentidoRota = 'ida' | 'volta';
export type TipoParada = 'saida' | 'casa' | 'escola';
export type StatusRota = 'rascunho' | 'concluida';

export interface Veiculo {
  id: string;
  modelo: string;
  ano?: number;
  placa?: string; // privada
  lugaresPassageiro: number;
  arCondicionado: boolean;
  acessivel: boolean;
  cintos: boolean;
  fotos: string[];
}

export interface ParadaRota {
  id: string;
  ordem: number;
  tipo: TipoParada;
  /** Endereço/referência — PRIVADO. */
  rotulo: string;
  lat?: number;
  lng?: number;
  confirmado: boolean;
  /** Horário habitual de chegada informado pelo motorista, em minutos do dia. */
  horarioChegadaMin?: number | null;
  /** Quando tipo === 'escola'. */
  destinoId?: string | null;
  destinoNome?: string | null;
  /** Minutos estimados até a PRÓXIMA parada (informado pelo motorista; opcional).
   *  Usado pelo motor para calcular horários/ocupação; nunca inventado pelo app. */
  tempoAteProximaMin?: number | null;
  /* ---- Visita à ESCOLA (só quando tipo === 'escola') ----
   * A identidade da unidade é `destinoId` (catálogo, o mesmo das famílias).
   * `null`/ausente = NÃO informado; nunca presumir. */
  /** `lat`/`lng` desta parada são um PORTÃO específico marcado pelo motorista
   *  (e não o ponto do catálogo). A unidade continua sendo `destinoId`. */
  portaoEspecifico?: boolean;
  /** IDA: limite de chegada à escola (minuto do dia). */
  limiteChegadaMin?: number | null;
  /** IDA: a partir de que horas a escola recebe os alunos (abertura do portão).
   *  Chegando antes, a van espera. `null`/ausente = não informado. */
  aberturaMin?: number | null;
  /** VOLTA: horário de liberação dos alunos (minuto do dia). */
  liberacaoMin?: number | null;
  /** Tempo de atendimento do GRUPO na escola, em minutos (aceita fração). */
  atendimentoGrupoMin?: number | null;
}

/**
 * Escola que o motorista ACEITA INCLUIR numa rota, mesmo sem passageiros.
 * Pertence à rota (que já carrega período escolar, sentido e dias). NÃO é uma
 * parada: não gera parada obrigatória nem altera a duração atual da rota.
 */
export interface EscolaDisponivel {
  id: string;
  /** ID da unidade no catálogo (o mesmo usado pelas famílias). */
  destinoId: string;
  destinoNome?: string | null;
  /** Dias em que aceita (subconjunto dos dias da rota). `null` = todos os dias da rota. */
  dias: string[] | null;
  /** Portão específico (opcional). Sem ele, vale o ponto do catálogo. */
  portaoLat?: number | null;
  portaoLng?: number | null;
  /** Condições da visita, caso a escola entre na rota (todas opcionais). */
  limiteChegadaMin?: number | null;
  /** Abertura do portão (ida), quando informada. */
  aberturaMin?: number | null;
  liberacaoMin?: number | null;
  atendimentoGrupoMin?: number | null;
}

/** Origem da estimativa do tempo de atendimento (DEC-021). */
export type OrigemAtendimento = 'informado' | 'provisorio' | 'desconhecido';

export interface PassageiroRota {
  id: string;
  /** Nome curto/apelido — PRIVADO. Identificação é por `id`, não pelo nome. */
  identificacao: string;
  embarqueParadaId: string | null;
  desembarqueParadaId: string | null;
  destinoId?: string | null;
  /* ---- Compromisso de atendimento do aluno (DEC-012, DEC-020..023) ----
   * Pertencem ao ALUNO no seu sentido (ida: casa de embarque; volta: casa de
   * desembarque), não à parada — por isso ficam aqui, não em ParadaRota.
   * `null`/ausente = NÃO informado; nunca apresentar como confirmado. */
  /** Horário habitual de atendimento (minuto do dia 0..1439). */
  horarioHabitualMin?: number | null;
  /** Flexibilidade, em minutos, ANTES do horário habitual. 0 = sem
   *  flexibilidade (informado); `null` = não informado. */
  ajusteAntesMin?: number | null;
  /** Flexibilidade, em minutos, DEPOIS do horário habitual. 0 = sem
   *  flexibilidade (informado); `null` = não informado. */
  ajusteDepoisMin?: number | null;
  /** Duração do atendimento deste aluno na parada, em minutos. Aceita fração
   *  (0.5 = 30 s). 0 = zero informado; `null` = não informado. */
  atendimentoMin?: number | null;
  /** Origem de `atendimentoMin`. */
  atendimentoOrigem?: OrigemAtendimento | null;
}

export interface Rota {
  id: string;
  nome: string;
  /** Sentido (ida/volta) — independente do período escolar. */
  sentido: SentidoRota;
  /** PERÍODO ESCOLAR dos alunos. Uma volta ao meio-dia pode ser da manhã. */
  turno: Turno | null;
  /** O período foi confirmado pelo motorista (não apenas sugerido/legado). */
  periodoConfirmado?: boolean;
  dias: string[];
  veiculoId: string | null;
  monitor: boolean;
  monitorOcupaLugar: boolean;
  lugaresReservados: number;
  /** Limite do PONTO FINAL obrigatório da rota (a última parada). */
  ultimoDesembarqueMin: number | null;
  /** Horário habitual de saída da van (o endereço é a parada `saida`). */
  saidaHabitualMin?: number | null;
  /** Quanto o motorista autoriza ANTECIPAR a saída, em minutos.
   *  0 = não autoriza; `null` = não informado (não presumir). */
  limiteAntecipacaoMin: number | null;
  status: StatusRota;
  /** Publicada na busca pública pela família (ação explícita do motorista).
   *  "concluída" NÃO implica "publicada". Ausente/false = não aparece na busca. */
  isPublished?: boolean;
  /** Escolas JÁ PRESENTES no percurso são as paradas `escola` abaixo. */
  paradas: ParadaRota[];
  passageiros: PassageiroRota[];
  /** Escolas que o motorista ACEITA INCLUIR nesta rota (não são paradas). */
  escolasDisponiveis?: EscolaDisponivel[];
  /** O motorista já revisou a lista acima (vazia e revisada = nenhuma). */
  disponibilidadeRevisada?: boolean;
  atualizadoEm: string;
}
