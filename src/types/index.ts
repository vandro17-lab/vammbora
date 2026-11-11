/**
 * Tipos de domínio do Vambora.
 *
 * Estes tipos refletem o núcleo do modelo de dados (ver docs/MODELO-DE-DADOS.md)
 * e já foram pensados para evoluir até o Supabase sem reescrita das telas.
 */

export type Turno = 'manha' | 'tarde' | 'noite' | 'integral';

export type TipoDestino = 'escola' | 'faculdade' | 'curso_livre';

export type ModalidadeTrajeto = 'ida' | 'volta' | 'ambos';

export type Contratacao = 'mensal' | 'avulso';

export type TipoPreco = 'fixo' | 'dinamico' | 'a_combinar';

/** Nível de compatibilidade devolvido pelo adaptador do motor de encaixe. */
export type NivelCompatibilidade = 'disponivel' | 'sob_consulta' | 'indisponivel';

export interface Cidade {
  id: string;
  nome: string;
  uf: string;
}

export type RedeEnsino = 'estadual' | 'municipal' | 'privada' | 'federal';

export type NivelEnsino =
  | 'infantil'
  | 'fundamental_anos_iniciais'
  | 'fundamental_anos_finais'
  | 'medio'
  | 'tecnico'
  | 'eja'
  | 'superior';

export interface Destino {
  id: string;
  tipo: TipoDestino;
  nome: string;
  bairro: string;
  cidadeId: string;
  /** Código INEP quando for escola oficial; null para faculdade/curso. */
  codigoInep: string | null;
  turnos: Turno[];
  /** Fonte/origem do dado — exigência de honestidade (INEP, cadastro manual, demo). */
  fonte: string;
  /** Coordenadas; `null` quando ainda não geocodificadas (endereço real já consta). */
  lat: number | null;
  lng: number | null;
  /** Rede de ensino (quando conhecida). */
  rede?: RedeEnsino;
  /** Níveis de ensino atendidos (quando informados). */
  nivel?: NivelEnsino[];
  /** Endereço real por extenso (para exibição e geocodificação). */
  endereco?: string;
}

export interface Preco {
  tipo: TipoPreco;
  /** Valor mensal de referência em R$ (quando aplicável). */
  mensal?: number;
  /** Valor por dia para contratação avulsa (quando aplicável). */
  avulso?: number;
}

export interface Avaliacao {
  media: number; // 0..5
  quantidade: number;
}

export interface RecursoVeiculo {
  arCondicionado: boolean;
  monitor: boolean;
  cintoTresPontos: boolean;
  acessibilidade: boolean;
}

export interface JanelaEmbarque {
  /** Horário de referência de passagem no ponto, formato "HH:MM". */
  horario: string;
  /** Tolerância contratada em minutos (referência -3/+7). */
  toleranciaAntesMin: number;
  toleranciaDepoisMin: number;
}

export interface Motorista {
  id: string;
  slug: string;
  nome: string;
  fotoUrl: string;
  vanFotoUrl: string;
  descricao: string;
  cidadeId: string;
  bairrosAtendidos: string[];
  /** IDs de destinos que atende. */
  destinosIds: string[];
  turnos: Turno[];
  capacidadeTotal: number;
  vagasDisponiveis: number;
  recursos: RecursoVeiculo;
  preco: Preco;
  avaliacao: Avaliacao;
  janela: JanelaEmbarque;
  /** Verdadeiro só quando houver verificação documental REAL registrada. */
  documentacaoVerificada: boolean;
  /** Telefone em formato internacional sem símbolos, ex: "5518999999999". */
  whatsapp: string;
  /** Marca o registro como dado de demonstração (Ideathon). */
  demo: boolean;
}

/** Critérios que a família informa na busca guiada. */
export interface CriteriosBusca {
  cidadeId: string;
  endereco: string;
  destinoId: string | null;
  turno: Turno | null;
  contratacao: Contratacao;
  /** Data (YYYY-MM-DD) quando contratacao === 'avulso'. */
  dataAvulso?: string;
  modalidade: ModalidadeTrajeto;
  /** Coordenadas exatas da origem, quando a família escolhe um endereço do
   *  autocomplete (geocodificado). Quando ausentes, estima-se pela região. */
  origemLat?: number;
  origemLng?: number;
  /** Horário informado pela família (HH:MM). Ida: precisa chegar à escola até
   *  esse horário. Volta: sai da escola a partir dele. */
  horario?: string;
}

/** Resultado de uma avaliação de compatibilidade para um motorista. */
export interface ResultadoCompatibilidade {
  motorista: Motorista;
  nivel: NivelCompatibilidade;
  /** Mensagem curta e honesta sobre o encaixe. */
  resumo: string;
  /** Horário aproximado de passagem, quando calculável. Ex: "passa por volta de 6h38". */
  passagemAproximada?: string;
  /** Horário estimado de chegada à escola (HhMM), quando o motor calcula. */
  chegadaEscola?: string;
  /** Tempo estimado a bordo em minutos, quando calculável pelo motor. */
  tempoABordoMin?: number;
  /** Origem do horário: 'motor' (calculado pelo motor de encaixe, estimativa pela
   *  região) ou 'motorista' (horário informado no cadastro). Para rótulo honesto. */
  fonteHorario?: 'motor' | 'motorista';
}

/** Registro de interesse quando não há resultado (lista de espera). */
export interface InteresseWaitlist {
  cidadeId: string;
  regiao: string;
  destinoId: string | null;
  turno: Turno | null;
  contatoNome: string;
  contatoWhatsapp: string;
  consentimento: boolean;
}
