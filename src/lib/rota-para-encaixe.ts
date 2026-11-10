import type { Rota, Veiculo, ParadaRota } from '@/types/motorista';
import {
  encontrarEncaixesProgressivo,
  explicarEncaixe,
  partidaParaSequencia,
  simularRota,
  type Sentido,
  type PontoGeo,
  type Compromisso,
  type MatrizViaria,
  type RotaOperacional,
  type PedidoEncaixe,
  type PlanoCalculado,
  type OpcaoEncaixe,
  type ClasseEncaixe,
} from '@/engine/encaixe-geografico';
import { capacidadeAlunos } from '@/lib/ocupacao-rota';
import { ESTIMATIVAS_INICIAIS, matrizConservadora, type EstimativasOperacionais } from '@/lib/inteligencia-operacional';

/**
 * Adaptador do SIMULADOR de encaixe: converte a rota real do motorista
 * (cadastro/Supabase) na entrada do motor geográfico `encaixe-geografico`,
 * usando SEMPRE uma matriz viária (tempos/distâncias de ruas, nunca linha reta).
 *
 * Não altera `src/engine/`. Não inventa tempos: se faltarem coordenadas ou um
 * trecho rodoviário, a simulação é marcada inviável, com motivo compreensível.
 *
 * Planejamento de trás para frente: a saída da van é ancorada a partir do
 * horário final da escola (ida) ou do horário permitido de saída (volta).
 */

/** Horários de referência do projeto (minutos da meia-noite). Usados só quando
 *  NÃO houver horário cadastrado na rota/escola. Margem operacional de 5 min. */
export const MARGEM_OPERACIONAL_MIN = 5;
export const TOLERANCIA_MAX_MIN = 10;
export const ATENDIMENTO_PADRAO_MIN = 1;

export const LIMITE_CHEGADA_POR_TURNO: Record<string, number> = {
  manha: 7 * 60, // 07h00
  tarde: 12 * 60 + 30, // 12h30
  noite: 19 * 60, // 19h00
};

export interface AlunoNovo {
  alunoId: string;
  nome: string;
  casa: PontoGeo;
  /** Id do destino (escola) que o novo aluno frequenta. */
  escolaId: string;
  /** Coordenadas da escola (catálogo). Usadas para INSERIR a escola quando ela
   *  ainda não faz parte do itinerário da rota (Tier B — "passa perto"). */
  escolaPonto?: PontoGeo;
}

export interface ParametrosSimulacao {
  /** Ida: horário-limite de chegada à escola. Volta: horário permitido de saída da escola. */
  horarioEscolaMin: number;
  margemMin?: number;
  toleranciaMin?: number;
  atendimentoMin?: number;
  /** Quanto, no máximo, a partida pode ser antecipada (min). Default do motor: 60. */
  antecipacaoMaxMin?: number;
  /** Estimativas operacionais (fator conservador etc.). Default: iniciais explícitas. */
  estimativas?: EstimativasOperacionais;
}

export type CodigoMotivo =
  | 'localizacao'
  | 'escola_itinerario'
  | 'capacidade'
  | 'atraso'
  | 'tolerancia'
  | 'margem'
  | 'tempo_bordo'
  | 'saida_cedo'
  | 'trecho'
  | 'rota_base'
  | 'aluno_duplicado'
  | 'sem_encaixe'
  | 'dados';

export interface ResultadoSimulacao {
  sentido: Sentido;
  elegivel: boolean;
  opcao: OpcaoEncaixe | null;
  /** Motivos amigáveis (pt-BR) quando inviável; vazio quando viável. */
  motivos: string[];
  codigos: CodigoMotivo[];
  /** Plano da rota ATUAL (antes), para comparação; null se a base for inconsistente. */
  base: PlanoCalculado | null;
  partidaMin: number | null;
  /** Mapa id de compromisso -> nome amigável do aluno/parada. */
  nomePorCompromisso: Record<string, string>;
  escolaNoItinerario: boolean;
  /** Como o encaixe pode ser efetivado (imediato, já autorizado ou depende do motorista). */
  classe?: ClasseEncaixe;
  /** Minutos que a van precisaria sair antes do habitual (0 = mantém). */
  antecipacaoMin?: number;
  /** Explicação objetiva (pt-BR) da aceitação ou recusa. */
  explicacao?: string[];
}

const coord = (v: number | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

function nomeParada(p: ParadaRota): string {
  if (p.tipo === 'saida') return 'Saída';
  if (p.tipo === 'escola') return p.destinoNome || p.rotulo || 'Escola';
  return p.rotulo || 'Casa';
}

/** Id do ponto geográfico de uma parada. Escola usa o id do destino (para casar
 *  com a escola do novo aluno). Demais paradas usam o id da parada. */
function idDoPonto(p: ParadaRota): string {
  return p.tipo === 'escola' && p.destinoId ? p.destinoId : p.id;
}

function pontoDeParada(p: ParadaRota): PontoGeo | null {
  if (!coord(p.lat) || !coord(p.lng)) return null;
  return { id: idDoPonto(p), nome: nomeParada(p), lat: p.lat, lng: p.lng };
}

/** Lista de pontos (sem repetição por id) necessários para a matriz viária. */
export function coletarPontos(
  rota: Rota,
  aluno: AlunoNovo,
): { pontos: PontoGeo[]; faltamCoordenadas: string[] } {
  const faltamCoordenadas: string[] = [];
  const porId = new Map<string, PontoGeo>();
  const ordenadas = [...rota.paradas].sort((a, b) => a.ordem - b.ordem);
  for (const p of ordenadas) {
    const g = pontoDeParada(p);
    if (!g) faltamCoordenadas.push(nomeParada(p));
    else if (!porId.has(g.id)) porId.set(g.id, g);
  }
  if (!porId.has(aluno.casa.id)) porId.set(aluno.casa.id, aluno.casa);
  return { pontos: [...porId.values()], faltamCoordenadas };
}

const MAP_MOTIVO: Record<CodigoMotivo, string> = {
  localizacao: 'Faltam informações de localização de algum endereço (confirme os pontos no mapa).',
  escola_itinerario: 'A escola do novo aluno não faz parte do itinerário desta rota.',
  capacidade: 'A van ultrapassaria a capacidade de passageiros em algum trecho.',
  atraso: 'O aluno chegaria atrasado à escola.',
  tolerancia: 'Um aluno que já está na rota teria o horário alterado além do permitido.',
  margem: 'Caberia no horário, mas sem a margem de segurança contra atrasos.',
  tempo_bordo: 'Algum aluno ficaria tempo demais dentro da van.',
  saida_cedo: 'A van sairia da escola antes do horário permitido.',
  trecho: 'Não foi possível calcular um trecho rodoviário entre dois endereços.',
  rota_base: 'A rota atual apresenta inconsistências e precisa ser revista.',
  aluno_duplicado: 'Este aluno já faz parte desta rota.',
  sem_encaixe: 'Não há como encaixar sem quebrar os compromissos atuais (capacidade, horários ou tolerância).',
  dados: 'Faltam informações para calcular com segurança.',
};

function motivosDe(codigos: CodigoMotivo[]): string[] {
  const vistos = new Set<CodigoMotivo>();
  const out: string[] = [];
  for (const c of codigos) if (!vistos.has(c)) { vistos.add(c); out.push(MAP_MOTIVO[c]); }
  return out;
}

/** Limite de chegada de UMA parada de escola, HONESTO: horário declarado da
 *  própria escola; e só a ÚLTIMA escola da rota herda o `ultimoDesembarqueMin`
 *  (senão seria o horário de OUTRA escola). Escola intermediária sem horário
 *  fica SEM limite rígido — o motor não inventa o que não sabe. */
function limiteDaEscola(parada: ParadaRota, rota: Rota, ehUltimaEscola: boolean): number | undefined {
  if (parada.horarioChegadaMin != null && Number.isFinite(parada.horarioChegadaMin)) return parada.horarioChegadaMin;
  if (ehUltimaEscola && rota.ultimoDesembarqueMin != null && Number.isFinite(rota.ultimoDesembarqueMin)) return rota.ultimoDesembarqueMin;
  return undefined;
}

/** Monta a RotaOperacional do motor a partir do cadastro, com limite por escola
 *  e partida ancorada de trás pra frente (menor saída que cumpre os limites). */
function montarOperacional(
  rota: Rota, veiculo: Veiculo | null, matriz: MatrizViaria, tolerancia: number,
  atendimentoPadrao: number = ATENDIMENTO_PADRAO_MIN, nomes: Record<string, string> = {},
): RotaOperacional | null {
  const ordenadas = [...rota.paradas].sort((a, b) => a.ordem - b.ordem);
  const saida = ordenadas.find((p) => p.tipo === 'saida') ?? ordenadas[0];
  if (!saida) return null;
  const inicio = pontoDeParada(saida);
  if (!inicio) return null;
  const sequencia = ordenadas.filter((p) => p.id !== saida.id);
  const atendimentoDe = (pax: { atendimentoMin?: number | null }) => pax.atendimentoMin ?? atendimentoPadrao;
  const ultimaEscolaOrdem = ordenadas
    .filter((p) => p.tipo === 'escola')
    .reduce((m, p) => Math.max(m, p.ordem), Number.NEGATIVE_INFINITY);

  const compromissos: Compromisso[] = [];
  for (const parada of sequencia) {
    const ponto = pontoDeParada(parada);
    if (!ponto) return null;
    const ehEscola = parada.tipo === 'escola';
    const limiteEscola = ehEscola ? limiteDaEscola(parada, rota, parada.ordem === ultimaEscolaOrdem) : undefined;
    // Desembarques primeiro (liberam lugar antes de novos embarques no ponto).
    for (const pax of rota.passageiros.filter((x) => x.desembarqueParadaId === parada.id)) {
      compromissos.push({
        id: 'des:' + pax.id, ponto, tipo: 'desembarque', alunoId: pax.id,
        atendimentoMin: ehEscola && rota.sentido === 'ida' ? 0 : atendimentoDe(pax),
        ...(ehEscola && limiteEscola != null ? { limiteEscolaMin: limiteEscola } : {}),
      });
      nomes['des:' + pax.id] = pax.identificacao;
    }
    // Marcador de escola carrega o limite mesmo sem passageiro descendo nela.
    if (ehEscola) {
      compromissos.push({ id: 'escola:' + parada.id, ponto, tipo: 'escola', atendimentoMin: 0, ...(limiteEscola != null ? { limiteEscolaMin: limiteEscola } : {}) });
    }
    for (const pax of rota.passageiros.filter((x) => x.embarqueParadaId === parada.id)) {
      compromissos.push({ id: 'emb:' + pax.id, ponto, tipo: 'embarque', alunoId: pax.id, atendimentoMin: atendimentoDe(pax) });
      nomes['emb:' + pax.id] = pax.identificacao;
    }
  }

  const capacidade = Math.max(1, capacidadeAlunos(rota, veiculo) || veiculo?.lugaresPassageiro || 1);
  const partida = partidaParaSequencia(inicio, compromissos, matriz);
  return {
    id: rota.id || 'rota', versao: 1, sentido: rota.sentido, inicio,
    partidaMin: Math.max(0, partida ?? 0), capacidade, ocupacaoInicial: 0,
    compromissos, toleranciaMin: tolerancia,
  };
}

/** Converte os motivos crus do motor progressivo em códigos amigáveis. */
function codigosDoProgressivo(motivos: string[], faltaDado: boolean, limite: boolean): CodigoMotivo[] {
  const set = new Set<CodigoMotivo>();
  for (const m of motivos) {
    if (m.includes('tempo/distância')) set.add('trecho');
    else if (m.includes('Capacidade')) set.add('capacidade');
    else if (m.includes('Horário-limite')) set.add('atraso');
    else if (m.includes('Margem')) set.add('margem');
    else if (m.includes('Tolerância') || m.includes('Janela')) set.add('tolerancia');
    else if (m.includes('Tempo a bordo')) set.add('tempo_bordo');
    else if (m.includes('antes do horário')) set.add('saida_cedo');
    else if (m.includes('localização')) set.add('localizacao');
  }
  if (set.size === 0) {
    if (faltaDado) set.add('trecho');
    else if (limite) set.add('dados');
    else set.add('sem_encaixe');
  }
  return [...set];
}

/**
 * Simula o encaixe de um novo aluno usando o motor PROGRESSIVO (insere escola
 * nova, reorganiza casas intercaladas, antecipa a saída). Mesma saída
 * (`ResultadoSimulacao`) do adaptador simples, sem PII.
 */
export function simularEncaixeProgressivo(
  rota: Rota, veiculo: Veiculo | null, aluno: AlunoNovo, matriz: MatrizViaria, params: ParametrosSimulacao,
): ResultadoSimulacao {
  const sentido = rota.sentido;
  const tolerancia = Math.min(TOLERANCIA_MAX_MIN, Math.max(0, params.toleranciaMin ?? TOLERANCIA_MAX_MIN));
  const vazio = (codigos: CodigoMotivo[], extra?: Partial<ResultadoSimulacao>): ResultadoSimulacao => ({
    sentido, elegivel: false, opcao: null, motivos: motivosDe(codigos), codigos,
    base: null, partidaMin: null, nomePorCompromisso: {}, escolaNoItinerario: true, ...extra,
  });

  if (rota.passageiros.some((p) => p.id === aluno.alunoId)) return vazio(['aluno_duplicado']);

  const { faltamCoordenadas } = coletarPontos(rota, aluno);
  if (faltamCoordenadas.length > 0 || !coord(aluno.casa.lat) || !coord(aluno.casa.lng)) return vazio(['localizacao']);

  const nomePorCompromisso: Record<string, string> = {};
  const rotaBase = montarOperacional(rota, veiculo, matriz, tolerancia, params.atendimentoMin ?? ATENDIMENTO_PADRAO_MIN, nomePorCompromisso);
  if (!rotaBase) return vazio(['localizacao']);

  // Escola do novo aluno: já no itinerário (Tier A) ou inserir nova (Tier B).
  const existente = rotaBase.compromissos.find((c) => c.ponto.id === aluno.escolaId) ?? null;
  const escolaPonto = existente?.ponto ?? aluno.escolaPonto ?? null;
  if (!escolaPonto) return vazio(['escola_itinerario'], { escolaNoItinerario: false });

  // Ancoragem CONSISTENTE: a escola escolhida carrega o horário usado no cálculo
  // (declarado ou, na falta, do turno). Sem isso, uma rota sem limites ancararia
  // à meia-noite e o deslocamento falso estouraria a tolerância dos atuais.
  let compromissos = existente
    ? rotaBase.compromissos.map((c) =>
        c.ponto.id === aluno.escolaId && (c.tipo === 'escola' || c.tipo === 'desembarque')
          ? { ...c, limiteEscolaMin: params.horarioEscolaMin }
          : c)
    : rotaBase.compromissos;
  // Partida habitual = a mais tardia que cumpre todos os limites COM a margem
  // de segurança. A margem é exigida também de qualquer encaixe.
  // (Na volta a âncora é a SAÍDA da escola: não há horário-limite a proteger.)
  const margem = sentido === 'ida' ? Math.max(0, params.margemMin ?? MARGEM_OPERACIONAL_MIN) : 0;
  const ancora = partidaParaSequencia(rotaBase.inicio, compromissos, matriz);
  const partidaMin = Math.max(0, ancora != null ? ancora - margem : rotaBase.partidaMin);
  let rotaOp: RotaOperacional = { ...rotaBase, compromissos, partidaMin, margemSegurancaMin: margem };

  let base = simularRota(rotaOp, matriz);
  // Janelas de flexibilidade CADASTRADAS (horário habitual ± ajuste) dos alunos
  // atuais. Se o horário cadastrado diverge do plano calculado, a flexibilidade
  // (± ajuste) é aplicada em torno do horário calculado — nunca invalida a base.
  if (base.valido) {
    const chegada = new Map(base.eventos.map((e) => [e.compromisso.id, e.chegadaMin]));
    const paxPorComp = new Map(rota.passageiros.map((x) => [(sentido === 'ida' ? 'emb:' : 'des:') + x.id, x]));
    compromissos = compromissos.map((c) => {
      const pax = paxPorComp.get(c.id);
      const t = chegada.get(c.id);
      if (!pax || t == null || (pax.ajusteAntesMin == null && pax.ajusteDepoisMin == null)) return c;
      const antes = Math.max(0, pax.ajusteAntesMin ?? 0), depois = Math.max(0, pax.ajusteDepoisMin ?? 0);
      const h = pax.horarioHabitualMin;
      const ref = h != null && t >= h - antes && t <= h + depois ? h : t;
      return { ...c, janela: { inicioMin: Math.max(0, ref - antes), fimMin: ref + depois } };
    });
    rotaOp = { ...rotaOp, compromissos };
    base = simularRota(rotaOp, matriz);
  }

  const pedido: PedidoEncaixe = {
    alunoId: aluno.alunoId, casa: aluno.casa, escola: escolaPonto,
    horarioEscolaMin: params.horarioEscolaMin, atendimentoMin: params.atendimentoMin ?? ATENDIMENTO_PADRAO_MIN,
  };
  const res = encontrarEncaixesProgressivo(rotaOp, pedido, matriz, {
    anteciparPartida: true,
    ...(params.antecipacaoMaxMin != null ? { antecipacaoMaxMin: params.antecipacaoMaxMin } : {}),
    // Só o que o motorista cadastrou conta como já autorizado; o resto depende dele.
    antecipacaoAutorizadaMin: rota.limiteAntecipacaoMin ?? 0,
    inserirEscolaNova: !existente,
    limiteEscolaNovaMin: params.horarioEscolaMin,
    matrizConservadora: matrizConservadora(matriz, params.estimativas ?? ESTIMATIVAS_INICIAIS),
  });
  const explicacao = explicarEncaixe(res);

  if (res.opcoes.length > 0) {
    const op = res.opcoes[0];
    return {
      sentido, elegivel: true, opcao: op, motivos: [], codigos: [],
      base, partidaMin: rotaOp.partidaMin, nomePorCompromisso, escolaNoItinerario: !!existente,
      classe: op.classe, antecipacaoMin: op.antecipacaoMin ?? 0, explicacao,
    };
  }
  const codigos = codigosDoProgressivo(res.motivos, res.faltaDadoViario, res.limiteAtingido);
  return {
    sentido, elegivel: false, opcao: null, motivos: motivosDe(codigos), codigos,
    base, partidaMin: rotaOp.partidaMin, nomePorCompromisso, escolaNoItinerario: !!existente, explicacao,
  };
}

/**
 * Simulador do motorista. Usa o MESMO caminho da busca das famílias
 * (`simularEncaixeProgressivo`) para que as duas telas nunca se contradigam.
 */
export function simularEncaixeRota(
  rota: Rota, veiculo: Veiculo | null, aluno: AlunoNovo, matriz: MatrizViaria, params: ParametrosSimulacao,
): ResultadoSimulacao {
  return simularEncaixeProgressivo(rota, veiculo, aluno, matriz, params);
}

/** Horário-limite/padrão de chegada à escola conforme turno (fallback). */
export function limitePadraoDoTurno(turno: string | null): number | null {
  if (!turno) return null;
  return LIMITE_CHEGADA_POR_TURNO[turno] ?? null;
}
