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
  /** Quando tipo === 'escola'. */
  destinoId?: string | null;
  destinoNome?: string | null;
  /** Minutos estimados até a PRÓXIMA parada (informado pelo motorista; opcional).
   *  Usado pelo motor para calcular horários/ocupação; nunca inventado pelo app. */
  tempoAteProximaMin?: number | null;
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
  /** Tolerância, em minutos, ANTES do horário habitual (Fixo = 0). */
  ajusteAntesMin?: number | null;
  /** Tolerância, em minutos, DEPOIS do horário habitual (Fixo = 0). */
  ajusteDepoisMin?: number | null;
  /** Duração do atendimento deste aluno na parada (minutos). */
  atendimentoMin?: number | null;
  /** Origem de `atendimentoMin`. */
  atendimentoOrigem?: OrigemAtendimento | null;
}

export interface Rota {
  id: string;
  nome: string;
  sentido: SentidoRota;
  turno: Turno | null;
  dias: string[];
  veiculoId: string | null;
  monitor: boolean;
  monitorOcupaLugar: boolean;
  lugaresReservados: number;
  ultimoDesembarqueMin: number | null;
  limiteAntecipacaoMin: number | null;
  status: StatusRota;
  paradas: ParadaRota[];
  passageiros: PassageiroRota[];
  atualizadoEm: string;
}
