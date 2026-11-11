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
  type SituacaoEncaixe,
} from '@/engine/encaixe-geografico';
import { capacidadeAlunos, picoOcupacao } from '@/lib/ocupacao-rota';
import { ESTIMATIVAS_INICIAIS, matrizConservadora, type EstimativasOperacionais } from '@/lib/inteligencia-operacional';
import { atendimentoGrupo, duracaoMin, horarioDaEscola, minutoDoDia } from '@/lib/cadastro-rota';

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
  | 'escola_nao_aceita'
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
  /** Situação final: viável, depende de aprovação, incompatível (comprovado)
   *  ou inconclusivo (faltou dado / busca não concluída — não é "não cabe"). */
  situacao: SituacaoEncaixe;
  /** O que depende de aprovação do motorista (vazio = nada). */
  aprovacoes: string[];
  /** De onde veio a saída habitual da van: do cadastro ou calculada de trás
   *  para frente a partir dos horários das escolas (cadastro sem saída). */
  fontePartida?: 'cadastrada' | 'calculada';
  /** Antecipação EXATA exigida (min, com fração), após folgas e esperas. */
  antecipacaoNecessariaMin?: number;
  /** A escola do novo aluno entra como parada nova (casa e escola avaliadas juntas). */
  escolaInserida?: boolean;
  /** Viagem recalculada, trecho por trecho, comparada com a atual. */
  trechos?: TrechoRecalculado[];
}

/** Uma linha do recálculo: um atendimento da viagem com o novo aluno. */
export interface TrechoRecalculado {
  /** Nome amigável (aluno ou escola). PRIVADO: só para o motorista. */
  nome: string;
  tipo: 'embarque' | 'desembarque' | 'escola';
  /** É do novo aluno (ou a escola nova dele). */
  novo: boolean;
  /** Deslocamento pelas ruas até aqui (min; 0 = mesmo ponto) e alunos a bordo no trecho. */
  deslocamentoMin: number;
  ocupacaoNoTrecho: number;
  chegadaMin: number;
  /** Espera da van até o horário combinado/liberação (0 = sem espera). */
  esperaMin: number;
  atendimentoMin: number;
  saidaMin: number;
  ocupacaoApos: number;
  /** Chegada na viagem ATUAL (null para o que é novo) e a diferença. */
  chegadaAntesMin: number | null;
  diferencaMin: number | null;
}

const INCONCLUSIVOS: CodigoMotivo[] = ['localizacao', 'trecho', 'rota_base', 'dados', 'van', 'busca_incompleta'];
/** Recusa com dados completos é incompatibilidade; faltou dado/busca = inconclusivo. */
export const situacaoDeCodigos = (codigos: CodigoMotivo[]): SituacaoEncaixe =>
  codigos.some((c) => INCONCLUSIVOS.includes(c)) ? 'inconclusivo' : 'incompativel';

/** Monta a tabela trecho a trecho de uma opção, comparando com a viagem atual. */
export function detalharTrechos(opcao: OpcaoEncaixe, base: PlanoCalculado | null, nomes: Record<string, string>): TrechoRecalculado[] {
  const antes = new Map((base?.eventos ?? []).map((e) => [e.compromisso.id, e.chegadaMin]));
  return opcao.eventos.map((e) => {
    const c = e.compromisso;
    const a = antes.get(c.id) ?? null;
    return {
      // Novo aluno: na casa dele, "Novo aluno"; na escola, "Novo aluno — <escola>".
      nome: nomes[c.id] ?? (c.id.startsWith('novo:')
        ? ((c.tipo === 'embarque') === (opcao.sentido === 'ida') ? 'Novo aluno' : `Novo aluno — ${c.ponto.nome}`) : c.ponto.nome),
      tipo: c.tipo, novo: c.id.startsWith('novo:'),
      deslocamentoMin: e.deslocamentoMin, ocupacaoNoTrecho: e.ocupacaoNoTrecho,
      chegadaMin: e.chegadaMin, esperaMin: e.esperaMin ?? 0, atendimentoMin: c.atendimentoMin, saidaMin: e.saidaMin, ocupacaoApos: e.ocupacaoApos,
      chegadaAntesMin: a, diferencaMin: a == null ? null : Math.round((e.chegadaMin - a) * 100) / 100,
    };
  });
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
  escola_nao_aceita: 'O motorista informou que não aceita incluir esta escola nesta rota.',
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
    // VOLTA com liberação cadastrada: a escola não tem "chegar até" e sim "não
    // sair antes de" — se a van chega cedo, ESPERA a liberação dos alunos.
    const liberacao = ehEscola && rota.sentido === 'volta' ? minutoDoDia(parada.liberacaoMin) : null;
    const limiteEscola = ehEscola && liberacao == null ? limiteDaEscola(parada, rota, parada.ordem === ultimaEscolaOrdem) : undefined;
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
      compromissos.push({ id: 'escola:' + parada.id, ponto, tipo: 'escola', atendimentoMin: atendimentoGrupo(parada), ...(limiteEscola != null ? { limiteEscolaMin: limiteEscola } : {}), ...(liberacao != null ? { naoAntesMin: liberacao } : {}) });
      nomes['escola:' + parada.id] = nomeParada(parada);
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
  // PONTO FINAL obrigatório: na ida, a viagem termina na última escola; o seu
  // limite (deixar o último aluno até) vale para a viagem inteira.
  const ultima = sequencia[sequencia.length - 1];
  // (Só é "obrigatório" quando tem limite informado: sem ele, não há o que proteger.)
  const pontoFinal = rota.sentido === 'ida' && ultima?.tipo === 'escola' && limiteDaEscola(ultima, rota, true) != null ? pontoDeParada(ultima) : null;
  // Limite do ponto final:
  //  - IDA: é o limite da última escola (o dela ou, na falta, "deixar o último
  //    aluno até") — já está no compromisso dessa escola, acima.
  //  - VOLTA: "última entrega até" vale para a viagem inteira, mas só quando as
  //    escolas têm liberação cadastrada (no cadastro antigo esse mesmo campo
  //    fazia o papel de horário de saída da escola).
  const escolas = sequencia.filter((p) => p.tipo === 'escola');
  const limiteFim = rota.sentido === 'volta' && escolas.length > 0 && escolas.every((p) => minutoDoDia(p.liberacaoMin) != null)
    ? minutoDoDia(rota.ultimoDesembarqueMin) : null;
  return {
    id: rota.id || 'rota', versao: 1, sentido: rota.sentido, inicio,
    partidaMin: Math.max(0, partida ?? 0), capacidade, ocupacaoInicial: 0,
    compromissos, toleranciaMin: tolerancia,
    ...(pontoFinal ? { pontoFinalId: pontoFinal.id } : {}),
    ...(limiteFim != null ? { limiteFimMin: limiteFim } : {}),
  };
}

/** Converte os motivos crus do motor progressivo em códigos amigáveis. */
function codigosDoProgressivo(motivos: string[], faltaDado: boolean, limite: boolean): CodigoMotivo[] {
  const set = new Set<CodigoMotivo>();
  for (const m of motivos) {
    if (m.includes('tempo/distância')) set.add('trecho');
    else if (m.includes('Capacidade')) set.add('capacidade');
    else if (m.includes('Horário-limite') || m.includes('ponto final')) set.add('atraso');
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
  /** Saída habitual usada: a do cadastro ou a calculada pelos horários das escolas. */
  fontePartida: 'cadastrada' | 'calculada';
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
        // (escola com liberação cadastrada na volta já tem o seu "não antes de")
        c.ponto.id === escolaId && (c.tipo === 'escola' || c.tipo === 'desembarque') && c.naoAntesMin === undefined
          ? { ...c, limiteEscolaMin: params.horarioEscolaMin }
          : c)
    : rotaBase.compromissos;
  // Partida habitual = a mais tardia que cumpre todos os limites COM a margem
  // de segurança. A margem é exigida também de qualquer encaixe.
  // (Na volta a âncora é a SAÍDA da escola: não há horário-limite a proteger.)
  let margem = sentido === 'ida' ? Math.max(0, params.margemMin ?? MARGEM_OPERACIONAL_MIN) : 0;
  const ancora = partidaParaSequencia(rotaBase.inicio, compromissos, matriz);
  let partidaMin = Math.max(0, ancora != null ? ancora - margem : rotaBase.partidaMin);
  let fontePartida: RotaAncorada['fontePartida'] = 'calculada';
  // SAÍDA HABITUAL CADASTRADA manda: é dela que se mede qualquer antecipação.
  // A margem exigida do encaixe nunca é maior que a folga que a própria rotina
  // do motorista já tem (senão toda rota "justa" pareceria inválida).
  const saidaCadastrada = minutoDoDia(rota.saidaHabitualMin);
  if (saidaCadastrada != null) {
    partidaMin = saidaCadastrada;
    fontePartida = 'cadastrada';
    const rotina = simularRota({ ...rotaBase, compromissos, partidaMin, margemSegurancaMin: 0 }, matriz);
    if (rotina.eventos.length === compromissos.length) {
      const folgas = rotina.eventos.filter((e) => e.compromisso.limiteEscolaMin !== undefined).map((e) => e.compromisso.limiteEscolaMin! - e.chegadaMin);
      if (folgas.length) margem = Math.min(margem, Math.max(0, Math.floor(Math.min(...folgas) + 1e-6)));
    }
  }
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
  return { rotaOp, base, nomePorCompromisso, escolaExistente: existente?.ponto ?? null, fontePartida };
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
    base: null, partidaMin: null, nomePorCompromisso: {}, escolaNoItinerario: true,
    situacao: situacaoDeCodigos(codigos), aprovacoes: [], ...extra,
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
  const { rotaOp, base, nomePorCompromisso, escolaExistente: existente, fontePartida } = montada;
  // ESCOLA AINDA NÃO VISITADA: a lista de escolas aceitas da rota decide se dá
  // para AVALIAR (nunca garante o encaixe). Lista revisada sem a escola = o
  // motorista não aceita. Cadastro antigo (lista nunca revisada): avalia, mas
  // incluir a escola depende de aprovação.
  const aceita = existente ? null : (rota.escolasDisponiveis ?? []).find((e) => e.destinoId === aluno.escolaId) ?? null;
  if (!existente && !aceita && rota.disponibilidadeRevisada) return vazio(['escola_nao_aceita'], { escolaNoItinerario: false, fontePartida });
  const portao = aceita && coord(aceita.portaoLat ?? undefined) && coord(aceita.portaoLng ?? undefined)
    ? { id: aluno.escolaId, nome: aluno.escolaPonto?.nome ?? 'Escola', lat: aceita.portaoLat as number, lng: aceita.portaoLng as number } : null;
  const escolaPonto = existente ?? portao ?? aluno.escolaPonto ?? null;
  if (!escolaPonto) return vazio(['escola_itinerario'], { escolaNoItinerario: false, fontePartida });
  // Rota-base que não fecha (trecho sem dado viário ou compromisso atual
  // descumprido) é inconclusiva: ninguém é recusado por causa dela.
  if (!base.valido) {
    const faltaDado = base.motivos.some((m) => m.includes('tempo/distância'));
    const detalhes = codigosDoProgressivo(base.motivos, faltaDado, false).filter((c) => c !== 'sem_encaixe');
    return vazio([faltaDado ? 'trecho' : 'rota_base', ...detalhes.filter((c) => c !== 'trecho')], { base, partidaMin: rotaOp.partidaMin, nomePorCompromisso, escolaNoItinerario: !!existente, fontePartida });
  }

  const horarioAluno = params.horarioAlunoMin != null && Number.isFinite(params.horarioAlunoMin) ? params.horarioAlunoMin : params.horarioEscolaMin;
  const pedido: PedidoEncaixe = {
    alunoId: aluno.alunoId, casa: aluno.casa, escola: escolaPonto,
    // Exigência do novo aluno (a âncora da rota continua nos compromissos atuais).
    horarioEscolaMin: horarioAluno,
    atendimentoMin: params.atendimentoMin ?? ATENDIMENTO_PADRAO_MIN,
    // Escola nova: o tempo do GRUPO informado na lista de aceitas; senão o padrão.
    atendimentoEscolaNovaMin: duracaoMin(aceita?.atendimentoGrupoMin) ?? PARADA_ESCOLA_MIN,
  };
  // Condições que o motorista informou para a escola aceita valem junto com as da família.
  const limiteAceita = sentido === 'ida' ? minutoDoDia(aceita?.limiteChegadaMin) : null;
  const liberacaoAceita = sentido === 'volta' ? minutoDoDia(aceita?.liberacaoMin) : null;
  const res = encontrarEncaixesProgressivo(rotaOp, pedido, matriz, {
    anteciparPartida: true,
    ...(params.antecipacaoMaxMin != null ? { antecipacaoMaxMin: params.antecipacaoMaxMin } : {}),
    // Antecipação AUTORIZADA no cadastro (0 = não autoriza).
    //  - Saída habitual CADASTRADA e antecipação não informada: nada é presumido;
    //    qualquer saída mais cedo depende de aprovação do motorista.
    //  - Saída apenas CALCULADA (cadastro antigo): ela é a mais tardia possível,
    //    então toda inclusão a recua um pouco; esse recuo não é uma antecipação
    //    real conhecida. Vale a regra anterior: até a tolerância dos passageiros
    //    (máx. 10 min) é tratado como ajuste aceito; acima disso, aprovação.
    antecipacaoAutorizadaMin: Math.max(0, rota.limiteAntecipacaoMin
      ?? (fontePartida === 'cadastrada' ? 0 : Math.min(TOLERANCIA_MAX_MIN, Math.max(0, params.toleranciaMin ?? TOLERANCIA_MAX_MIN)))),
    inserirEscolaNova: !existente,
    escolaNovaExigeAprovacao: !existente && !aceita,
    // Escola nova: vale o horário do novo aluno e, se houver, o limite do motorista.
    limiteEscolaNovaMin: limiteAceita != null ? Math.min(horarioAluno, limiteAceita) : horarioAluno,
    ...(liberacaoAceita != null ? { liberacaoNovoAlunoMin: liberacaoAceita } : {}),
    matrizConservadora: matrizConservadora(matriz, params.estimativas ?? ESTIMATIVAS_INICIAIS),
  });
  const explicacao = explicarEncaixe(res);

  if (res.opcoes.length > 0) {
    const op = res.opcoes[0];
    return {
      sentido, elegivel: true, opcao: op, motivos: [], codigos: [],
      base, partidaMin: rotaOp.partidaMin, nomePorCompromisso, escolaNoItinerario: !!existente,
      classe: op.classe, antecipacaoMin: op.antecipacaoMin ?? 0, explicacao,
      situacao: res.situacao, aprovacoes: op.aprovacoes ?? [], fontePartida,
      antecipacaoNecessariaMin: op.antecipacaoNecessariaMin ?? 0, escolaInserida: res.escolaInserida,
      trechos: detalharTrechos(op, base, nomePorCompromisso),
    };
  }
  const codigos = codigosDoProgressivo(res.motivos, res.faltaDadoViario, res.limiteAtingido);
  return {
    sentido, elegivel: false, opcao: null, motivos: motivosDe(codigos), codigos,
    base, partidaMin: rotaOp.partidaMin, nomePorCompromisso, escolaNoItinerario: !!existente, explicacao,
    situacao: res.situacao, aprovacoes: [], fontePartida, escolaInserida: res.escolaInserida,
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
