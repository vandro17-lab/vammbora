import type { CriteriosBusca, Turno } from '@/types';
import type { EnderecoCampo } from '@/lib/endereco';
import { ENDERECO_VAZIO } from '@/lib/endereco';
import { horarioDoSentido, horaParaMinutoDoDia } from '@/lib/searchParams';
import { CIDADES, cidadeDoPonto } from '@/data/cidades';
import { MUNICIPIOS_COBERTURA } from '@/data/municipios-cobertura';
import { normalizarTexto, type MunicipioUF } from '@/lib/geocode';

/**
 * SOLICITAÇÃO DE TRANSPORTE DA FAMÍLIA (Etapa 3A) — regras puras.
 *
 * As mesmas regras são conferidas de novo no banco (constraints e gatilho da
 * migração 20261112230000). Pesquisar NÃO cria solicitação: ela só existe
 * depois que a família revisa e confirma.
 */

export type SentidoSolicitacao = 'ida' | 'volta' | 'ambos';
export type StatusSolicitacao = 'ativa' | 'pausada' | 'encerrada';
export type EtapaEnsino = 'infantil' | 'fundamental_1' | 'fundamental_2' | 'medio' | 'universitario';
export type MotivoEncerramento = 'contratou_vanbora' | 'contratou_fora' | 'desistiu' | 'outro';
export type PassoSolicitacao = 'endereco' | 'escola' | 'detalhes' | 'revisao';
/** 'mapa': o mapa identificou o município; 'familia': a família confirmou. */
export type FonteMunicipio = 'mapa' | 'familia';

export const OBSERVACOES_MAX = 500;
/** Alunos por solicitação (irmãos com a mesma origem e escola). */
export const ALUNOS_MIN = 1;
export const ALUNOS_MAX = 8;

export const PASSOS_SOLICITACAO: { id: PassoSolicitacao; nome: string }[] = [
  { id: 'endereco', nome: 'Endereço' },
  { id: 'escola', nome: 'Escola' },
  { id: 'detalhes', nome: 'Detalhes' },
  { id: 'revisao', nome: 'Revisão' },
];

export const ETAPAS_ENSINO: { id: EtapaEnsino; nome: string }[] = [
  { id: 'infantil', nome: 'Creche ou educação infantil' },
  { id: 'fundamental_1', nome: 'Ensino fundamental (1º ao 5º ano)' },
  { id: 'fundamental_2', nome: 'Ensino fundamental (6º ao 9º ano)' },
  { id: 'medio', nome: 'Ensino médio' },
  { id: 'universitario', nome: 'Faculdade ou curso' },
];

export const SENTIDOS: { id: SentidoSolicitacao; nome: string }[] = [
  { id: 'ida', nome: 'Só ida' },
  { id: 'volta', nome: 'Só volta' },
  { id: 'ambos', nome: 'Ida e volta' },
];

export const MOTIVOS_ENCERRAMENTO: { id: MotivoEncerramento; nome: string }[] = [
  { id: 'contratou_vanbora', nome: 'Contratei um transporte pelo VanBora' },
  { id: 'contratou_fora', nome: 'Contratei um transporte por fora' },
  { id: 'desistiu', nome: 'Não preciso mais' },
  { id: 'outro', nome: 'Outro motivo' },
];

export const TEXTO_STATUS: Record<StatusSolicitacao, string> = {
  ativa: 'Ativa',
  pausada: 'Pausada',
  encerrada: 'Encerrada',
};

/** O que a família preenche. */
export interface RascunhoSolicitacao {
  /** Identifica ESTE envio: o mesmo envio repetido não cria outra solicitação. */
  chave: string;
  endereco: EnderecoCampo;
  /** Município do embarque (código IBGE), escolhido ou identificado pelo mapa. */
  municipioIbge: number | null;
  /** O que o mapa disse sobre o município DESTE ponto (null = não identificou). */
  municipioDoMapa: { lat: number; lng: number; resultado: MunicipioUF | null } | null;
  /** A família confirmou o município quando o mapa não identificou ou divergiu. */
  municipioConfirmado: boolean;
  destinoId: string;
  sentido: SentidoSolicitacao;
  /** "HH:MM" ou vazio. Ida: chegar à escola até. Volta: liberado a partir de. */
  horarioIda: string;
  horarioVolta: string;
  turno: Turno | '';
  etapa: EtapaEnsino | '';
  quantidadeAlunos: number;
  acessibilidade: boolean;
  observacoes: string;
}

/** Solicitação gravada (só a dona e a equipe leem). */
export interface Solicitacao {
  id: string;
  chave: string;
  cidadeId: string;
  municipioIbge: number;
  municipioFonte: FonteMunicipio;
  destinoId: string;
  endereco: string;
  lat: number;
  lng: number;
  sentido: SentidoSolicitacao;
  horarioIdaMin: number | null;
  horarioVoltaMin: number | null;
  turno: Turno | null;
  etapa: EtapaEnsino | null;
  quantidadeAlunos: number;
  acessibilidade: boolean;
  observacoes: string | null;
  status: StatusSolicitacao;
  motivoEncerramento: MotivoEncerramento | null;
  criadaEm: string;
  atualizadaEm: string;
}

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const usaIda = (s: SentidoSolicitacao) => s !== 'volta';
const usaVolta = (s: SentidoSolicitacao) => s !== 'ida';

export function rascunhoVazio(chave: string): RascunhoSolicitacao {
  return { chave, endereco: ENDERECO_VAZIO, municipioIbge: null, municipioDoMapa: null, municipioConfirmado: false, destinoId: '', sentido: 'ida', horarioIda: '', horarioVolta: '', turno: '', etapa: '', quantidadeAlunos: 1, acessibilidade: false, observacoes: '' };
}

/**
 * Começa a solicitação com o que a família JÁ informou na busca (nada é
 * inventado: o que não veio da busca fica em branco).
 */
export function rascunhoDaBusca(c: CriteriosBusca, chave: string): RascunhoSolicitacao {
  const temCoord = typeof c.origemLat === 'number' && typeof c.origemLng === 'number' && Number.isFinite(c.origemLat) && Number.isFinite(c.origemLng);
  const sentido: SentidoSolicitacao = c.modalidade === 'volta' ? 'volta' : c.modalidade === 'ambos' ? 'ambos' : 'ida';
  return {
    ...rascunhoVazio(chave),
    endereco: c.endereco.trim()
      ? { texto: c.endereco.trim(), coord: temCoord ? { lat: c.origemLat as number, lng: c.origemLng as number } : null, precisao: temCoord ? 'ajustado' : undefined, validando: false }
      : ENDERECO_VAZIO,
    destinoId: c.destinoId ?? '',
    sentido,
    horarioIda: usaIda(sentido) ? horarioDoSentido(c, 'ida') ?? '' : '',
    horarioVolta: usaVolta(sentido) ? horarioDoSentido(c, 'volta') ?? '' : '',
    turno: c.turno ?? '',
  };
}

/** Rascunho para EDITAR uma solicitação gravada. */
export function rascunhoDaSolicitacao(s: Solicitacao): RascunhoSolicitacao {
  const hora = (m: number | null) => (m == null ? '' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  return {
    chave: s.chave,
    endereco: { texto: s.endereco, coord: { lat: s.lat, lng: s.lng }, precisao: 'ajustado', validando: false },
    // Já conferido ao gravar: só volta a conferir se o ponto ou a cidade mudarem.
    municipioIbge: s.municipioIbge,
    municipioDoMapa: s.municipioFonte === 'mapa' ? { lat: s.lat, lng: s.lng, resultado: municipioPorCodigo(s.municipioIbge) } : null,
    municipioConfirmado: s.municipioFonte === 'familia',
    destinoId: s.destinoId, sentido: s.sentido,
    horarioIda: hora(s.horarioIdaMin), horarioVolta: hora(s.horarioVoltaMin),
    turno: s.turno ?? '', etapa: s.etapa ?? '', quantidadeAlunos: s.quantidadeAlunos, acessibilidade: s.acessibilidade, observacoes: s.observacoes ?? '',
  };
}

/** Município da lista (sede numa área atendida) pelo código IBGE. */
export function municipioPorCodigo(ibge: number | null | undefined): MunicipioUF & { ibge: number } | null {
  const m = MUNICIPIOS_COBERTURA.find((x) => x.ibge === ibge);
  return m ? { ibge: m.ibge, nome: m.nome, uf: m.uf } : null;
}

/** Código IBGE do município que o mapa devolveu, se estiver na lista. */
export function codigoDoMunicipio(m: MunicipioUF | null | undefined): number | null {
  if (!m) return null;
  const n = normalizarTexto(m.nome);
  return MUNICIPIOS_COBERTURA.find((x) => x.uf === m.uf && normalizarTexto(x.nome) === n)?.ibge ?? null;
}

export const textoMunicipio = (m: MunicipioUF | null) => (m ? `${m.nome}/${m.uf}` : '');

/**
 * Situação do município do embarque:
 * - 'falta': a família ainda não escolheu (e o mapa não identificou);
 * - 'conferindo': consultando o mapa para ESTE ponto;
 * - 'confere': o mapa devolveu o mesmo município escolhido;
 * - 'diverge': o mapa devolveu outro município;
 * - 'sem_mapa': o mapa não identificou com segurança.
 */
export type SituacaoMunicipio = 'falta' | 'conferindo' | 'confere' | 'diverge' | 'sem_mapa';
export function situacaoMunicipio(r: RascunhoSolicitacao): SituacaoMunicipio {
  if (!r.municipioIbge) return 'falta';
  const c = r.endereco.coord;
  const m = r.municipioDoMapa;
  if (!c || !m || m.lat !== c.lat || m.lng !== c.lng) return 'conferindo';
  if (!m.resultado) return 'sem_mapa';
  return codigoDoMunicipio(m.resultado) === r.municipioIbge ? 'confere' : 'diverge';
}

/** Origem do município para o banco; null = ainda não pode gravar. */
export function fonteDoMunicipio(r: RascunhoSolicitacao): FonteMunicipio | null {
  const s = situacaoMunicipio(r);
  if (s === 'confere') return 'mapa';
  if ((s === 'diverge' || s === 'sem_mapa') && r.municipioConfirmado) return 'familia';
  return null;
}

/** Problema do passo, em linguagem simples; null = pode continuar. */
export function validarPasso(passo: PassoSolicitacao, r: RascunhoSolicitacao, escolasDisponiveis?: ReadonlySet<string>): string | null {
  if (passo === 'endereco') {
    if (!r.municipioIbge && !r.endereco.coord) return 'Escolha a cidade do embarque.';
    if (r.endereco.texto.trim().length < 5) return 'Digite o endereço de embarque com o número.';
    if (r.endereco.validando) return 'Aguarde: estamos localizando o endereço no mapa.';
    if (!r.endereco.coord) return 'Confirme o endereço no mapa. Se precisar, arraste o alfinete até a sua casa.';
    if (!cidadeDoPonto(r.endereco.coord.lat, r.endereco.coord.lng)) {
      return `Esse endereço fica fora das cidades atendidas (${CIDADES.map((c) => `${c.nome}/${c.uf}`).join(', ')}). Confira o ponto no mapa.`;
    }
    const sit = situacaoMunicipio(r);
    const escolhido = textoMunicipio(municipioPorCodigo(r.municipioIbge));
    if (sit === 'falta') return 'Escolha a cidade do embarque.';
    if (sit === 'conferindo') return 'Aguarde: estamos conferindo a cidade no mapa.';
    if (sit === 'diverge' && !r.municipioConfirmado) {
      return `O mapa indica que este ponto fica em ${textoMunicipio(r.municipioDoMapa?.resultado ?? null)}, não em ${escolhido}. Confira o ponto e a cidade ou confirme abaixo.`;
    }
    if (sit === 'sem_mapa' && !r.municipioConfirmado) return `Não conseguimos conferir a cidade pelo mapa. Confirme abaixo que o endereço fica em ${escolhido}.`;
  }
  if (passo === 'escola') {
    if (!r.destinoId) return 'Escolha a escola ou o destino.';
    if (escolasDisponiveis && !escolasDisponiveis.has(r.destinoId)) return 'Essa escola não está mais disponível. Escolha outra na lista.';
    if (usaIda(r.sentido) && !HORA_RE.test(r.horarioIda)) return 'Informe até que horas o aluno precisa chegar à escola.';
    if (usaVolta(r.sentido) && !HORA_RE.test(r.horarioVolta)) return 'Informe a partir de que horas o aluno sai da escola.';
  }
  if (passo === 'detalhes') {
    if (!Number.isInteger(r.quantidadeAlunos) || r.quantidadeAlunos < ALUNOS_MIN || r.quantidadeAlunos > ALUNOS_MAX) {
      return `Informe de ${ALUNOS_MIN} a ${ALUNOS_MAX} alunos.`;
    }
    if (r.observacoes.trim().length > OBSERVACOES_MAX) return `As observações podem ter no máximo ${OBSERVACOES_MAX} caracteres.`;
  }
  return null;
}

export function primeiroPassoComProblema(r: RascunhoSolicitacao, escolasDisponiveis?: ReadonlySet<string>): { passo: PassoSolicitacao; erro: string } | null {
  for (const { id } of PASSOS_SOLICITACAO) {
    const erro = validarPasso(id, r, escolasDisponiveis);
    if (erro) return { passo: id, erro };
  }
  return null;
}

/** Cidade da solicitação: a do ponto confirmado (o servidor confere de novo). */
export function cidadeDaSolicitacao(r: RascunhoSolicitacao): string | null {
  return r.endereco.coord ? cidadeDoPonto(r.endereco.coord.lat, r.endereco.coord.lng)?.id ?? null : null;
}

/** Linha para o banco (owner_id e status são definidos no servidor). */
export function solicitacaoParaBanco(r: RascunhoSolicitacao, cidadeId: string) {
  return {
    chave_envio: r.chave,
    city_id: cidadeId,
    origem_municipio_ibge: r.municipioIbge,
    origem_municipio_fonte: fonteDoMunicipio(r),
    destination_id: r.destinoId,
    origem_endereco: r.endereco.texto.trim(),
    origem_lat: r.endereco.coord?.lat ?? null,
    origem_lng: r.endereco.coord?.lng ?? null,
    sentido: r.sentido,
    horario_ida_min: usaIda(r.sentido) ? horaParaMinutoDoDia(r.horarioIda) : null,
    horario_volta_min: usaVolta(r.sentido) ? horaParaMinutoDoDia(r.horarioVolta) : null,
    turno: r.turno || null,
    etapa_ensino: r.etapa || null,
    quantidade_alunos: r.quantidadeAlunos,
    precisa_acessibilidade: r.acessibilidade,
    observacoes: r.observacoes.trim() || null,
  };
}

export interface LinhaSolicitacao {
  id: string; chave_envio: string; city_id: string; origem_municipio_ibge: number; origem_municipio_fonte: string; destination_id: string; origem_endereco: string;
  origem_lat: number; origem_lng: number; sentido: string; horario_ida_min: number | null; horario_volta_min: number | null;
  turno: string | null; etapa_ensino: string | null; quantidade_alunos: number; precisa_acessibilidade: boolean; observacoes: string | null;
  status: string; motivo_encerramento: string | null; created_at: string; updated_at: string;
}

export function solicitacaoDoBanco(l: LinhaSolicitacao): Solicitacao {
  return {
    id: l.id, chave: l.chave_envio, cidadeId: l.city_id,
    municipioIbge: l.origem_municipio_ibge, municipioFonte: l.origem_municipio_fonte as FonteMunicipio, destinoId: l.destination_id, endereco: l.origem_endereco,
    lat: l.origem_lat, lng: l.origem_lng, sentido: l.sentido as SentidoSolicitacao,
    horarioIdaMin: l.horario_ida_min, horarioVoltaMin: l.horario_volta_min,
    turno: (l.turno as Turno | null) ?? null, etapa: (l.etapa_ensino as EtapaEnsino | null) ?? null,
    quantidadeAlunos: l.quantidade_alunos ?? 1, acessibilidade: !!l.precisa_acessibilidade, observacoes: l.observacoes ?? null,
    status: l.status as StatusSolicitacao, motivoEncerramento: (l.motivo_encerramento as MotivoEncerramento | null) ?? null,
    criadaEm: l.created_at, atualizadaEm: l.updated_at,
  };
}

/** "07:30" a partir do minuto do dia. */
export function textoHora(min: number | null): string {
  return min == null ? '—' : `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** Resumo dos horários pedidos, em português simples. */
export function textoHorarios(s: Pick<Solicitacao, 'sentido' | 'horarioIdaMin' | 'horarioVoltaMin'>): string {
  const ida = `chegar à escola até ${textoHora(s.horarioIdaMin)}`;
  const volta = `sair da escola a partir de ${textoHora(s.horarioVoltaMin)}`;
  if (s.sentido === 'ida') return `Só ida: ${ida}`;
  if (s.sentido === 'volta') return `Só volta: ${volta}`;
  return `Ida: ${ida}. Volta: ${volta}`;
}

/** A conta precisa entrar antes de CONFIRMAR? (Pesquisar e preencher não exigem.) */
export function precisaEntrarParaConfirmar(usaServidor: boolean, temSessao: boolean): boolean {
  return usaServidor && !temSessao;
}

/** Ações possíveis para cada estado (encerrada é definitiva). */
export function acoesDoStatus(status: StatusSolicitacao): { editar: boolean; pausar: boolean; reativar: boolean; encerrar: boolean } {
  return {
    editar: status !== 'encerrada',
    pausar: status === 'ativa',
    reativar: status === 'pausada',
    encerrar: status !== 'encerrada',
  };
}
