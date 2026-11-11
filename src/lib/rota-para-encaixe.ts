import { ATENDIMENTO_CASA_PADRAO_MIN, PARADA_ESCOLA_MIN } from '@/lib/tempos-parada';
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
import { capacidadeAlunos, picoOcupacao } from '@/lib/ocupacao-rota';
import { ESTIMATIVAS_INICIAIS, matrizConservadora, type EstimativasOperacionais } from '@/lib/inteligencia-operacional';
import { atendimentoGrupo, horarioDaEscola } from '@/lib/cadastro-rota';

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
/** Atendimento por aluno na casa quando não informado (regra única: `tempos-parada`). */
export const ATENDIMENTO_PADRAO_MIN = ATENDIMENTO_CASA_PADRAO_MIN;

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
  /** Âncora da ROTA na escola escolhida. Ida: horário-limite de chegada.
   *  Volta: horário permitido de saída. */
  horarioEscolaMin: number;
  /** Exigência do NOVO ALUNO, separada da âncora da rota: ida = até que horas
   *  ele precisa chegar; volta = a partir de que horas pode sair da escola.
   *  Ausente = a mesma da rota. Nunca altera os compromissos dos atuais. */
  horarioAlunoMin?: number | null;
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
  | 'van'
  | 'busca_incompleta'
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
  van: 'A van desta rota não está cadastrada: não dá para saber quantos lugares há.',
  busca_incompleta: 'A avaliação desta rota não foi concluída (rota extensa) — não significa que não cabe.',
  dados: 'Faltam informações para calcular com segurança.',
};

function motivosDe(codigos: CodigoMotivo[]): string[] {
  const vistos = new Set<CodigoMotivo>();
  const out: string[] = [];
  for (const c of codigos) if (!vistos.has(c)) { vistos.add(c); out.push(MAP_MOTIVO[c]); }
  return out;
}

/** Limite de chegada de UMA parada de escola, HONESTO: horário declarado da
 *  própria escola (ida: limite de chegada; volta: liberação — no cadastro
 *  antigo, o horário habitual da parada); e só a ÚLTIMA escola da rota herda o `ultimoDesembarqueMin`
 *  (senão seria o horário de OUTRA escola). Escola intermediária sem horário
 *  fica SEM limite rígido — o motor não inventa o que não sabe. */
function limiteDaEscola(parada: ParadaRota, rota: Rota, ehUltimaEscola: boolean): number | undefined {
  const declarado = horarioDaEscola(parada, rota.sentido);
  if (declarado != null) return declarado;
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
        atendimentoMin: ehEscola ? 0 : atendimentoDe(pax),
        ...(ehEscola && limiteEscola != null ? { limiteEscolaMin: limiteEscola } : {}),
      });
      nomes['des:' + pax.id] = pax.identificacao;
    }
    // Marcador de escola carrega o limite mesmo sem passageiro descendo nela e
    // o tempo parado na escola (uma vez, para o grupo — não por aluno).
    if (ehEscola) {
      compromissos.push({ id: 'escola:' + parada.id, ponto, tipo: 'escola', atendimentoMin: atendimentoGrupo(parada), ...(limiteEscola != null ? { limiteEscolaMin: limiteEscola } : {}) });
    }
    for (const pax of rota.passageiros.filter((x) => x.embarqueParadaId === parada.id)) {
      compromissos.push({ id: 'emb:' + pax.id, ponto, tipo: 'embarque', alunoId: pax.id, atendimentoMin: ehEscola ? 0 : atendimentoDe(pax) });
      nomes['emb:' + pax.id] = pax.identificacao;
    }
  }

  // Capacidade HONESTA: a da van cadastrada (zero é zero). Sem van, não há como
  // validar lugares: usa a ocupação atual só para a base fechar; quem simula um
  // aluno novo trata "sem van" como indeterminado (ver simularEncaixeProgressivo).
  const capacidade = veiculo ? capacidadeAlunos(rota, veiculo) : Math.max(1, picoOcupacao(rota));
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
  // Busca não concluída ou trecho sem dado viário NUNCA somem atrás de outros
  // motivos: o resultado é inconclusivo, não uma impossibilidade provada.
  const out: CodigoMotivo[] = [];
  if (limite) out.push('busca_incompleta');
  if (faltaDado) out.push('trecho');
  if (set.size === 0 && out.length === 0) set.add('sem_encaixe');
  return [...out, ...set];
}

export interface RotaAncorada {
  rotaOp: RotaOperacional;
  base: PlanoCalculado;
  nomePorCompromisso: Record<string, string>;
  /** Ponto da escola `escolaId` quando ela já está no itinerário. */
  escolaExistente: PontoGeo | null;
}

/**
 * Rota do cadastro -> rota do motor, pronta para simular: limites por escola,
 * partida habitual ancorada de trás para frente COM margem de segurança e
 * janelas de flexibilidade cadastradas. É a ÚNICA montagem usada pelo simulador
 * do motorista, pela busca das famílias e pelo otimizador de rota.
 * `escolaId` (opcional): escola cujo horário é dado por `params.horarioEscolaMin`.
 */
export function montarRotaAncorada(
  rota: Rota, veiculo: Veiculo | null, matriz: MatrizViaria,
  params: Partial<ParametrosSimulacao> = {}, escolaId?: string,
): RotaAncorada | null {
  const sentido = rota.sentido;
  const tolerancia = Math.min(TOLERANCIA_MAX_MIN, Math.max(0, params.toleranciaMin ?? TOLERANCIA_MAX_MIN));
  const nomePorCompromisso: Record<string, string> = {};
  const rotaBase = montarOperacional(rota, veiculo, matriz, tolerancia, params.atendimentoMin ?? ATENDIMENTO_PADRAO_MIN, nomePorCompromisso);
  if (!rotaBase) return null;
  const existente = escolaId ? rotaBase.compromissos.find((c) => c.ponto.id === escolaId) ?? null : null;

  // Ancoragem CONSISTENTE: a escola escolhida carrega o horário usado no cálculo
  // (declarado ou, na falta, do turno). Sem isso, uma rota sem limites ancoraria
  // à meia-noite e o deslocamento falso estouraria a tolerância dos atuais.
  let compromissos = existente && params.horarioEscolaMin != null
    ? rotaBase.compromissos.map((c) =>
        c.ponto.id === escolaId && (c.tipo === 'escola' || c.tipo === 'desembarque')
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
  // Compromissos CADASTRADOS dos alunos atuais (horário habitual ± ajustes).
  // O horário combinado com a família é a referência — nunca é deslocado para
  // o horário que a conta deu. Se o plano não cumpre o combinado, a rota-base
  // fica inválida e a simulação informa que a rota precisa de revisão, em vez
  // de fingir que está tudo certo.
  if (base.valido) {
    const chegada = new Map(base.eventos.map((e) => [e.compromisso.id, e.chegadaMin]));
    const paxPorComp = new Map(rota.passageiros.map((x) => [(sentido === 'ida' ? 'emb:' : 'des:') + x.id, x]));
    compromissos = compromissos.map((c) => {
      const pax = paxPorComp.get(c.id);
      const t = chegada.get(c.id);
      if (!pax || t == null) return c;
      const h = pax.horarioHabitualMin;
      const temAjuste = pax.ajusteAntesMin != null || pax.ajusteDepoisMin != null;
      if (h == null && !temAjuste) return c;
      const antes = Math.max(0, pax.ajusteAntesMin ?? 0), depois = Math.max(0, pax.ajusteDepoisMin ?? 0);
      // Horário combinado sem ajustes informados: vale a tolerância geral da
      // rota em torno dele (o motor protege com `horarioBaseMin` ± tolerância).
      if (h != null && !temAjuste) return { ...c, horarioBaseMin: h };
      const ref = h ?? t; // sem horário combinado, a flexibilidade é em torno do calculado
      return { ...c, janela: { inicioMin: Math.max(0, ref - antes), fimMin: ref + depois } };
    });
    rotaOp = { ...rotaOp, compromissos };
    base = simularRota(rotaOp, matriz);
  }
  return { rotaOp, base, nomePorCompromisso, escolaExistente: existente?.ponto ?? null };
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
  const vazio = (codigos: CodigoMotivo[], extra?: Partial<ResultadoSimulacao>): ResultadoSimulacao => ({
    sentido, elegivel: false, opcao: null, motivos: motivosDe(codigos), codigos,
    base: null, partidaMin: null, nomePorCompromisso: {}, escolaNoItinerario: true, ...extra,
  });

  if (rota.passageiros.some((p) => p.id === aluno.alunoId)) return vazio(['aluno_duplicado']);

  const { faltamCoordenadas } = coletarPontos(rota, aluno);
  if (faltamCoordenadas.length > 0 || !coord(aluno.casa.lat) || !coord(aluno.casa.lng)) return vazio(['localizacao']);

  // Sem van cadastrada não há como validar lugares; van sem lugar para aluno
  // (ex.: 1 lugar ocupado pelo monitor) não cabe ninguém.
  if (!veiculo) return vazio(['van']);
  if (capacidadeAlunos(rota, veiculo) < 1) return vazio(['capacidade']);

  const montada = montarRotaAncorada(rota, veiculo, matriz, params, aluno.escolaId);
  if (!montada) return vazio(['localizacao']);
  const { rotaOp, base, nomePorCompromisso, escolaExistente: existente } = montada;
  const escolaPonto = existente ?? aluno.escolaPonto ?? null;
  if (!escolaPonto) return vazio(['escola_itinerario'], { escolaNoItinerario: false });
  // Rota-base que não fecha (trecho sem dado viário ou compromisso atual
  // descumprido) é inconclusiva: ninguém é recusado por causa dela.
  if (!base.valido) {
    const faltaDado = base.motivos.some((m) => m.includes('tempo/distância'));
    const detalhes = codigosDoProgressivo(base.motivos, faltaDado, false).filter((c) => c !== 'sem_encaixe');
    return vazio([faltaDado ? 'trecho' : 'rota_base', ...detalhes.filter((c) => c !== 'trecho')], { base, partidaMin: rotaOp.partidaMin, nomePorCompromisso, escolaNoItinerario: !!existente });
  }

  const horarioAluno = params.horarioAlunoMin != null && Number.isFinite(params.horarioAlunoMin) ? params.horarioAlunoMin : params.horarioEscolaMin;
  const pedido: PedidoEncaixe = {
    alunoId: aluno.alunoId, casa: aluno.casa, escola: escolaPonto,
    // Exigência do novo aluno (a âncora da rota continua nos compromissos atuais).
    horarioEscolaMin: horarioAluno,
    atendimentoMin: params.atendimentoMin ?? ATENDIMENTO_PADRAO_MIN,
    atendimentoEscolaNovaMin: PARADA_ESCOLA_MIN,
  };
  const res = encontrarEncaixesProgressivo(rotaOp, pedido, matriz, {
    anteciparPartida: true,
    ...(params.antecipacaoMaxMin != null ? { antecipacaoMaxMin: params.antecipacaoMaxMin } : {}),
    // Limite de antecipação cadastrado pelo motorista. Sem cadastro, só um ajuste
    // pequeno (até a tolerância dos passageiros, máx. 10 min) é tratado como já
    // aceito — suposição inicial explícita; acima disso depende do motorista.
    antecipacaoAutorizadaMin: rota.limiteAntecipacaoMin ?? Math.min(TOLERANCIA_MAX_MIN, Math.max(0, params.toleranciaMin ?? TOLERANCIA_MAX_MIN)),
    inserirEscolaNova: !existente,
    // Escola nova no itinerário: o único horário conhecido é o do novo aluno.
    limiteEscolaNovaMin: horarioAluno,
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
