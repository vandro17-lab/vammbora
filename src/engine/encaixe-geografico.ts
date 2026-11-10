/**
 * Motor determinístico de inserção. Não inventa deslocamentos: todos os arcos
 * devem vir de um provedor rodoviário ou de uma matriz de teste identificada.
 * A aprovação final requer reconsulta da matriz e versão atual da rota.
 */
export type Sentido = 'ida' | 'volta';
export interface PontoGeo { id: string; nome: string; lat: number; lng: number }
export interface Compromisso {
  id: string;
  ponto: PontoGeo;
  tipo: 'embarque' | 'desembarque' | 'escola';
  alunoId?: string;
  /** Horário contratualmente prometido para o passageiro existente. */
  horarioBaseMin?: number;
  /** Limite absoluto para chegar à escola; também vale para escolas intermediárias. */
  limiteEscolaMin?: number;
  /** Duração do atendimento em minutos. */
  atendimentoMin: number;
  /**
   * Janela CONTRATADA de chegada (minutos do dia). Embarque: se a van chega
   * antes de `inicioMin`, ESPERA; chegar depois de `fimMin` viola. Desembarque:
   * chegar fora da janela viola. Ausente = sem janela própria.
   */
  janela?: { inicioMin: number; fimMin: number };
  /** Embarque: id do ponto (escola) onde este aluno desce quando não há
   *  compromisso de desembarque explícito. Ausente = desce na 1ª escola visitada. */
  destinoPontoId?: string;
}
export interface Trecho { minutos: number; metros: number }
export interface MatrizViaria {
  origem: 'google-routes' | 'geoapify' | 'fixture-testada' | 'demonstracao' | 'outro-provedor';
  obter(de: PontoGeo, para: PontoGeo, partidaMin: number): Trecho | null;
}
export interface RotaOperacional {
  id: string;
  versao: number;
  sentido: Sentido;
  inicio: PontoGeo;
  partidaMin: number;
  capacidade: number;
  ocupacaoInicial: number;
  compromissos: Compromisso[];
  toleranciaMin?: number; // nunca maior que 10
  /** Margem de segurança contra atrasos: a van precisa chegar a cada escola
   *  pelo menos este tanto ANTES do horário-limite. Default 0. */
  margemSegurancaMin?: number;
  /** Tempo máximo a bordo por aluno (min). null/ausente = não verificado. */
  limiteABordoMin?: number | null;
}
export interface PedidoEncaixe {
  alunoId: string;
  casa: PontoGeo;
  escola: PontoGeo;
  /** Horário máximo de chegada à escola (ida) ou mínimo de saída da escola (volta). */
  horarioEscolaMin: number;
  atendimentoMin?: number;
}
export interface EventoCalculado {
  compromisso: Compromisso; chegadaMin: number; saidaMin: number; ocupacaoApos: number;
  /** Minutos que a van esperou pelo início da janela (só presente quando > 0). */
  esperaMin?: number;
}
/** Como o encaixe pode ser efetivado (ordem = preferência). */
export type ClasseEncaixe = 'imediato' | 'pre_autorizado' | 'aprovacao_motorista';
export interface PlanoCalculado { eventos: EventoCalculado[]; metros: number; fimMin: number; valido: boolean; motivos: string[] }
export interface OpcaoEncaixe {
  elegivel: boolean;
  sentido: Sentido;
  horarioBuscaMin: number;
  horarioEntregaMin: number;
  minutosABordo: number;
  distanciaABordoMetros: number;
  desvioMin: number;
  desvioMetros: number;
  posicaoEmbarque: number;
  posicaoDesembarque: number;
  alteracoes: { id: string; antesMin: number; depoisMin: number; diferencaMin: number }[];
  eventos: EventoCalculado[];
  /** Busca progressiva: partida usada, quanto antecipa a habitual e a classe. */
  partidaMin?: number;
  antecipacaoMin?: number;
  classe?: ClasseEncaixe;
  /** Menor folga (min) frente aos horários-limite de escola. null = sem limite na rota. */
  folgaMin?: number | null;
  /** Continua válido com os tempos CONSERVADORES? null = não avaliado. */
  robusta?: boolean | null;
}
const inteiro = (v: number) => Number.isFinite(v) && v >= 0;
const validoPonto = (p: PontoGeo) => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

export function simularRota(rota: RotaOperacional, matriz: MatrizViaria, compromissos = rota.compromissos): PlanoCalculado {
  const motivos: string[] = [];
  if (!validoPonto(rota.inicio) || !inteiro(rota.partidaMin) || !Number.isInteger(rota.capacidade) || rota.capacidade < 1 || !Number.isInteger(rota.ocupacaoInicial) || rota.ocupacaoInicial < 0 || rota.ocupacaoInicial > rota.capacidade) {
    return { eventos: [], metros: 0, fimMin: rota.partidaMin, valido: false, motivos: ['Dados iniciais da rota inválidos.'] };
  }
  let anterior = rota.inicio, tempo = rota.partidaMin, metros = 0, ocupacao = rota.ocupacaoInicial;
  const eventos: EventoCalculado[] = [];
  const margem = Math.max(0, rota.margemSegurancaMin ?? 0);
  const limiteBordo = rota.limiteABordoMin ?? null;
  // Quem está a bordo (aluno -> início do embarque / escola de destino).
  const aBordo = new Map<string, { desde: number; destino?: string }>();
  const comDesembarque = new Set(compromissos.filter((c) => c.tipo === 'desembarque' && c.alunoId).map((c) => c.alunoId!));
  const desce = (aluno: string, chegada: number, nome: string) => {
    const b = aBordo.get(aluno);
    if (!b) return;
    if (limiteBordo !== null && chegada - b.desde > limiteBordo) motivos.push('Tempo a bordo excedido: ' + nome);
    aBordo.delete(aluno);
  };
  for (const p of compromissos) {
    if (!validoPonto(p.ponto) || !inteiro(p.atendimentoMin)) { motivos.push('Parada sem localização ou duração válida.'); break; }
    const trecho = matriz.obter(anterior, p.ponto, tempo);
    if (!trecho || !inteiro(trecho.minutos) || !inteiro(trecho.metros)) { motivos.push('Falta tempo/distância rodoviária para um trecho.'); break; }
    tempo += trecho.minutos;
    metros += trecho.metros;
    const chegada = tempo;
    if (p.limiteEscolaMin !== undefined) {
      if (!inteiro(p.limiteEscolaMin) || chegada > p.limiteEscolaMin) motivos.push('Horário-limite de escola ultrapassado: ' + p.ponto.nome);
      else if (chegada > p.limiteEscolaMin - margem) motivos.push('Margem de segurança insuficiente: ' + p.ponto.nome);
    }
    let espera = 0;
    if (p.janela) {
      if (chegada > p.janela.fimMin) motivos.push('Janela de horário de passageiro excedida: ' + p.ponto.nome);
      else if (chegada < p.janela.inicioMin) {
        if (p.tipo === 'embarque') espera = p.janela.inicioMin - chegada; // a van espera o horário combinado
        else motivos.push('Janela de horário de passageiro excedida: ' + p.ponto.nome);
      }
    }
    tempo += espera;
    if (p.tipo === 'embarque') {
      ocupacao++;
      if (p.alunoId) aBordo.set(p.alunoId, { desde: tempo, destino: p.destinoPontoId });
    }
    if (p.tipo === 'desembarque') {
      ocupacao--;
      if (p.alunoId) desce(p.alunoId, chegada, p.ponto.nome);
    }
    // Ida: a visita à escola libera o assento de quem vai para ela e não tem
    // desembarque explícito na sequência (antes ficavam "a bordo" até o fim).
    if (p.tipo === 'escola' && rota.sentido === 'ida') {
      for (const [aluno, b] of [...aBordo]) {
        if (comDesembarque.has(aluno) || (b.destino !== undefined && b.destino !== p.ponto.id)) continue;
        ocupacao--;
        desce(aluno, chegada, p.ponto.nome);
      }
    }
    if (ocupacao > rota.capacidade || ocupacao < 0) motivos.push('Capacidade inválida no trecho: ' + p.ponto.nome);
    tempo += p.atendimentoMin;
    eventos.push({ compromisso: p, chegadaMin: chegada, saidaMin: tempo, ocupacaoApos: ocupacao, ...(espera > 0 ? { esperaMin: espera } : {}) });
    anterior = p.ponto;
  }
  return { eventos, metros, fimMin: tempo, valido: motivos.length === 0 && eventos.length === compromissos.length, motivos };
}

/** Examina todas as posições possíveis para embarque e desembarque, sem mudar a ordem dos antigos. */
export function encontrarEncaixes(rota: RotaOperacional, pedido: PedidoEncaixe, matriz: MatrizViaria): OpcaoEncaixe[] {
  if (!validoPonto(pedido.casa) || !validoPonto(pedido.escola) || !inteiro(pedido.horarioEscolaMin) || !pedido.alunoId || !Number.isInteger(rota.versao)) return [];
  if (!inteiro(pedido.atendimentoMin ?? 1) || !inteiro(rota.toleranciaMin ?? 10) || rota.compromissos.some(p => p.alunoId === pedido.alunoId) || new Set(rota.compromissos.map(p => p.id)).size !== rota.compromissos.length) return [];
  const base = simularRota(rota, matriz);
  if (!base.valido) return []; // nunca compara com uma rota-base inconsistente
  const tolerancia = Math.min(10, Math.max(0, rota.toleranciaMin ?? 10));
  const n = rota.compromissos.length;
  const busca: Compromisso = { id: 'novo:embarque:' + pedido.alunoId, ponto: rota.sentido === 'ida' ? pedido.casa : pedido.escola, tipo: 'embarque', alunoId: pedido.alunoId, atendimentoMin: pedido.atendimentoMin ?? 1 };
  const entrega: Compromisso = { id: 'novo:desembarque:' + pedido.alunoId, ponto: rota.sentido === 'ida' ? pedido.escola : pedido.casa, tipo: 'desembarque', alunoId: pedido.alunoId, atendimentoMin: pedido.atendimentoMin ?? 1, ...(rota.sentido === 'ida' ? { limiteEscolaMin: pedido.horarioEscolaMin } : {}) };
  const opcoes: OpcaoEncaixe[] = [];
  for (let i = 0; i <= n; i++) {
    for (let j = i + 1; j <= n + 1; j++) {
      // Para escola já presente na rota, a nova criança deve ser entregue
      // no momento daquela visita, jamais depois de passar pela escola.
      const indiceEscola = rota.compromissos.findIndex(p => p.ponto.id === pedido.escola.id && (p.tipo === 'escola' || p.tipo === 'desembarque' || p.tipo === 'embarque'));
      // O motor só aceita escolas efetivamente cadastradas no itinerário.
      if (indiceEscola < 0) continue;
      if (rota.sentido === 'ida' && (i > indiceEscola || j > indiceEscola + 1)) continue;
      if (rota.sentido === 'volta' && i > indiceEscola + 1) continue;
      const paradas = [...rota.compromissos];
      paradas.splice(i, 0, busca);
      paradas.splice(j, 0, entrega);
      const candidato = simularRota(rota, matriz, paradas);
      if (!candidato.valido) continue;
      const eventosBase = new Map(base.eventos.map(e => [e.compromisso.id, e]));
      const alteracoes: OpcaoEncaixe['alteracoes'] = [];
      let valido = true;
      for (const e of candidato.eventos) {
        const anterior = eventosBase.get(e.compromisso.id);
        if (!anterior) continue;
        const referencia = e.compromisso.horarioBaseMin ?? anterior.chegadaMin;
        const diferenca = e.chegadaMin - referencia;
        if (Math.abs(diferenca) > tolerancia) { valido = false; break; }
        alteracoes.push({ id: e.compromisso.id, antesMin: referencia, depoisMin: e.chegadaMin, diferencaMin: diferenca });
      }
      if (!valido) continue;
      const eb = candidato.eventos.find(e => e.compromisso.id === busca.id)!;
      const ed = candidato.eventos.find(e => e.compromisso.id === entrega.id)!;
      if (rota.sentido === 'volta' && eb.chegadaMin < pedido.horarioEscolaMin) continue;
      // Garantia: aluno novo nunca é desembarcado antes de embarcar.
      if (ed.chegadaMin < eb.saidaMin) continue;
      let distanciaABordoMetros = 0;
      for (let k = i + 1; k <= j; k++) {
        const anterior = k === 0 ? rota.inicio : paradas[k - 1].ponto;
        const destino = paradas[k].ponto;
        const partida = k === 0 ? rota.partidaMin : candidato.eventos[k - 1].saidaMin;
        distanciaABordoMetros += matriz.obter(anterior, destino, partida)?.metros ?? 0;
      }
      opcoes.push({
        elegivel: true, sentido: rota.sentido,
        horarioBuscaMin: eb.chegadaMin, horarioEntregaMin: ed.chegadaMin,
        minutosABordo: ed.chegadaMin - eb.saidaMin,
        distanciaABordoMetros,
        desvioMin: candidato.fimMin - base.fimMin,
        desvioMetros: candidato.metros - base.metros,
        posicaoEmbarque: i, posicaoDesembarque: j,
        alteracoes, eventos: candidato.eventos,
      });
    }
  }
  return opcoes.sort((a, b) => a.desvioMin - b.desvioMin || a.desvioMetros - b.desvioMetros || a.minutosABordo - b.minutosABordo);
}
export interface ResultadoIdaVolta { ida: OpcaoEncaixe | null; volta: OpcaoEncaixe | null; completo: boolean }
export function encontrarIdaVolta(ida: RotaOperacional, volta: RotaOperacional, pedido: PedidoEncaixe, matrizIda: MatrizViaria, matrizVolta: MatrizViaria, saidaEscolaMin: number): ResultadoIdaVolta {
  const melhorIda = ida.sentido === 'ida' ? encontrarEncaixes(ida, pedido, matrizIda)[0] ?? null : null;
  const melhorVolta = volta.sentido === 'volta' ? encontrarEncaixes(volta, { ...pedido, horarioEscolaMin: saidaEscolaMin }, matrizVolta)[0] ?? null : null;
  return { ida: melhorIda, volta: melhorVolta, completo: !!melhorIda && !!melhorVolta };
}

/* ============================================================================
 * BUSCA PROGRESSIVA (Fase 4 do "Algoritmo Supremo")
 * ----------------------------------------------------------------------------
 * Camadas, nesta ordem, sem nunca mexer na rota original e respeitando TODOS os
 * compromissos existentes (capacidade por trecho, janelas/tolerância, limites
 * de escola, precedência embarque->desembarque):
 *   1) INSERÇÃO SIMPLES — preserva a ordem atual (igual a `encontrarEncaixes`),
 *      podendo inserir uma ESCOLA NOVA (ausente do itinerário) como parada do
 *      novo aluno, com seu horário-limite.
 *   2) REORGANIZAÇÃO CONTROLADA — só quando a inserção simples não resolve:
 *      permuta as paradas de casa (lado-casa), descobrindo encaixes impossíveis
 *      com a sequência original. Cada candidata é recalculada por inteiro.
 * Reaproveita `simularRota` e as MESMAS regras — não é um motor paralelo.
 * Classificação honesta: `compativel`, `incompativel` (espaço esgotado, com
 * dados completos, nada válido) ou `indeterminado` (faltou dado viário OU o
 * orçamento de busca foi atingido — esgotar o limite NUNCA vira "impossível").
 * ========================================================================== */
export type ClassificacaoEncaixe = 'compativel' | 'incompativel' | 'indeterminado';

export interface OpcoesEncaixeProgressivo {
  /** Inserir a escola do aluno como nova parada quando ausente do itinerário. Default true. */
  inserirEscolaNova?: boolean;
  /** Horário-limite de chegada à escola nova (minuto). Default: `pedido.horarioEscolaMin`. */
  limiteEscolaNovaMin?: number;
  /** Testar reorganizações controladas quando a inserção simples falha. Default true. */
  reorganizar?: boolean;
  /** Orçamento máximo de candidatas simuladas. Default 4000. */
  maxCandidatas?: number;
  /**
   * Permite que a van SAIA MAIS CEDO para acomodar o novo aluno: cada candidata
   * é simulada com a maior partida que ainda cumpre TODOS os limites de escola
   * daquela sequência (recuo mínimo). A tolerância continua medida contra o
   * plano-base, então a antecipação fica limitada pela tolerância de quem já
   * está na rota. Default false (comportamento legado: partida fixa).
   */
  anteciparPartida?: boolean;
  /** Antecipação máxima absoluta da partida (min). Default 60. */
  antecipacaoMaxMin?: number;
  /** Antecipação que o motorista JÁ autorizou no cadastro (min). Até aqui o
   *  encaixe é 'pre_autorizado'; além disso, 'aprovacao_motorista'. Default 0. */
  antecipacaoAutorizadaMin?: number;
  /** Matriz com tempos CONSERVADORES (ex.: tempos × fator de atraso). Quando
   *  informada, as melhores opções são reavaliadas e marcadas `robusta`. */
  matrizConservadora?: MatrizViaria;
}

/**
 * Partida viável MAIS TARDIA em [tmin, tmax] para uma sequência, considerando
 * limites de escola (menos a margem), janelas e esperas. Nunca passa de `tmax`
 * (a partida habitual): antecipar é sair mais cedo, jamais mais tarde.
 * Retorna null quando falta dado viário.
 */
export function partidaMaisTardia(
  rota: RotaOperacional, matriz: MatrizViaria, compromissos: Compromisso[], tmin: number, tmax: number,
): number | null {
  if (tmin >= tmax) return tmax;
  const sim = simularRota({ ...rota, partidaMin: tmin }, matriz, compromissos);
  if (sim.eventos.length !== compromissos.length) return null;
  const margem = Math.max(0, rota.margemSegurancaMin ?? 0);
  let folga = Infinity, esperaAcumulada = 0;
  for (const e of sim.eventos) {
    const c = e.compromisso;
    const teto = Math.min(c.limiteEscolaMin !== undefined ? c.limiteEscolaMin - margem : Infinity, c.janela ? c.janela.fimMin : Infinity);
    // Atrasar a partida em d só atrasa esta chegada no que exceder as esperas anteriores.
    folga = Math.min(folga, esperaAcumulada + teto - e.chegadaMin);
    esperaAcumulada += e.esperaMin ?? 0;
  }
  if (!Number.isFinite(folga)) return tmax;
  return Math.max(tmin, Math.min(tmax, tmin + Math.floor(folga)));
}

/**
 * Maior partida (minuto do dia) que ainda cumpre TODOS os `limiteEscolaMin` de
 * uma sequência de compromissos — "o horário final manda", generalizado para
 * múltiplas escolas. Retorna null se faltar dado viário ou se a sequência não
 * tem nenhum limite (nada a ancorar).
 */
export function partidaParaSequencia(
  inicio: PontoGeo, compromissos: Compromisso[], matriz: MatrizViaria,
): number | null {
  let acc = 0; // minutos da partida até a CHEGADA no compromisso atual
  let anterior = inicio;
  const folgas: number[] = [];
  for (const c of compromissos) {
    const t = matriz.obter(anterior, c.ponto, 0);
    if (!t || !Number.isFinite(t.minutos)) return null;
    acc += t.minutos;
    if (c.limiteEscolaMin !== undefined && Number.isFinite(c.limiteEscolaMin)) {
      folgas.push(c.limiteEscolaMin - acc); // partida ≤ folga para cumprir este limite
    }
    acc += c.atendimentoMin;
    anterior = c.ponto;
  }
  if (!folgas.length) return null;
  return Math.min(...folgas);
}

export interface ResultadoEncaixeProgressivo {
  classificacao: ClassificacaoEncaixe;
  /** Opções VÁLIDAS, ordenadas (menor impacto primeiro). Vazio quando não compatível. */
  opcoes: OpcaoEncaixe[];
  /** true quando a escola do aluno foi inserida como NOVA parada (não estava no itinerário). */
  escolaInserida: boolean;
  /** Estratégia que produziu as opções: 'simples' (ordem preservada) ou 'reorganizacao'. */
  estrategia: 'nenhuma' | 'simples' | 'reorganizacao';
  /** Quantas sequências candidatas foram efetivamente simuladas. */
  candidatasAvaliadas: number;
  /** true quando o orçamento de busca foi atingido antes de concluir. */
  limiteAtingido: boolean;
  /** true quando faltou tempo/distância rodoviária para algum trecho necessário. */
  faltaDadoViario: boolean;
  /** Motivos CRUS coletados das candidatas rejeitadas / da base inválida (para
   *  diagnóstico honesto por quem chama; sem significado de aprovação). */
  motivos: string[];
  /** Em quantas posições testadas cada motivo (sem o nome da parada) apareceu. */
  contagemMotivos: Record<string, number>;
}

function indiceEscolaEm(compromissos: Compromisso[], escolaId: string): number {
  return compromissos.findIndex(
    (p) => p.ponto.id === escolaId && (p.tipo === 'escola' || p.tipo === 'desembarque' || p.tipo === 'embarque'),
  );
}

/** Precedência: cada aluno embarca ANTES de desembarcar na sequência dada. */
export function precedenciaValida(seq: Compromisso[]): boolean {
  const emb = new Map<string, number>();
  const des = new Map<string, number>();
  seq.forEach((c, i) => {
    if (!c.alunoId) return;
    if (c.tipo === 'embarque') emb.set(c.alunoId, i);
    else if (c.tipo === 'desembarque') des.set(c.alunoId, i);
  });
  for (const [aluno, e] of emb) {
    const d = des.get(aluno);
    if (d !== undefined && e >= d) return false;
  }
  return true;
}

/** Permutações (algoritmo de Heap) com teto de segurança: sequências grandes
 *  (> 8) não são reorganizadas (evita explosão combinatória). O orçamento de
 *  candidatas interrompe a exploração bem antes do teto em casos reais. */
function* permutacoes<T>(arr: T[], teto = 60000): Generator<T[]> {
  const n = arr.length;
  if (n <= 1 || n > 8) { yield arr.slice(); return; }
  const a = arr.slice();
  const c = new Array(n).fill(0);
  let count = 0;
  yield a.slice();
  let i = 0;
  while (i < n) {
    if (c[i] < i) {
      if (i % 2 === 0) [a[0], a[i]] = [a[i], a[0]];
      else [a[c[i]], a[i]] = [a[i], a[c[i]]];
      yield a.slice();
      if (++count >= teto) return;
      c[i] += 1;
      i = 0;
    } else {
      c[i] = 0;
      i += 1;
    }
  }
}

/** Compromissos EFETIVOS de uma candidata: quem já está na rota e não tem
 *  janela cadastrada fica protegido pela tolerância em torno do horário atual
 *  (embarque: a van espera se chegar cedo; desembarque cedo demais é recusado). */
export function protegerExistentes(rota: RotaOperacional, base: PlanoCalculado, paradas: Compromisso[], tolerancia: number): Compromisso[] {
  const eventosBase = new Map(base.eventos.map((e) => [e.compromisso.id, e]));
  return paradas.map((c) => {
    const antes = eventosBase.get(c.id);
    if (!antes || c.janela) return c;
    const ref = c.horarioBaseMin ?? antes.chegadaMin;
    // Escola na ida: o teto é o horário-limite (ou, sem limite, a tolerância);
    // chegar MUITO antes do habitual também quebra o combinado (portão fechado).
    const teto = rota.sentido === 'ida' && c.tipo !== 'embarque' && c.limiteEscolaMin !== undefined ? c.limiteEscolaMin : ref + tolerancia;
    return { ...c, janela: { inicioMin: Math.max(0, ref - tolerancia), fimMin: teto } };
  });
}

interface ConfigCandidata {
  tolerancia: number; horarioEscolaMin: number; tmin: number; autorizadaMin: number; reorganizada: boolean;
}

/** Valida UMA sequência candidata (já com o novo aluno) e constrói a opção.
 *  `faltaDado` = o trecho rodoviário estava ausente (resultado indeterminado). */
function construirOpcaoProgressiva(
  rota: RotaOperacional, base: PlanoCalculado, matriz: MatrizViaria,
  paradasCruas: Compromisso[], buscaId: string, entregaId: string, cfg: ConfigCandidata,
): { opcao: OpcaoEncaixe | null; faltaDado: boolean; motivos: string[] } {
  const paradas = protegerExistentes(rota, base, paradasCruas, cfg.tolerancia);
  const partidaMin = partidaMaisTardia(rota, matriz, paradas, cfg.tmin, rota.partidaMin);
  if (partidaMin === null) return { opcao: null, faltaDado: true, motivos: ['Falta tempo/distância rodoviária para um trecho.'] };
  const cand = simularRota({ ...rota, partidaMin }, matriz, paradas);
  if (!cand.valido) {
    return { opcao: null, faltaDado: cand.motivos.some((m) => m.includes('tempo/distância')), motivos: cand.motivos };
  }
  const eventosBase = new Map(base.eventos.map((e) => [e.compromisso.id, e]));
  const alteracoes: OpcaoEncaixe['alteracoes'] = [];
  let folgaMin: number | null = null;
  for (const e of cand.eventos) {
    const lim = e.compromisso.limiteEscolaMin;
    if (lim !== undefined) folgaMin = Math.min(folgaMin ?? Infinity, lim - e.chegadaMin);
    const anterior = eventosBase.get(e.compromisso.id);
    if (!anterior) continue;
    const ref = e.compromisso.horarioBaseMin ?? anterior.chegadaMin;
    const depois = e.chegadaMin + (e.esperaMin ?? 0);
    alteracoes.push({ id: e.compromisso.id, antesMin: ref, depoisMin: depois, diferencaMin: depois - ref });
  }
  const idxB = cand.eventos.findIndex((e) => e.compromisso.id === buscaId);
  const idxE = cand.eventos.findIndex((e) => e.compromisso.id === entregaId);
  if (idxB < 0 || idxE < 0) return { opcao: null, faltaDado: false, motivos: [] };
  const eb = cand.eventos[idxB], ed = cand.eventos[idxE];
  if (rota.sentido === 'volta' && eb.chegadaMin < cfg.horarioEscolaMin) return { opcao: null, faltaDado: false, motivos: ['A van sairia da escola antes do horário permitido.'] };
  if (ed.chegadaMin < eb.saidaMin) return { opcao: null, faltaDado: false, motivos: [] };
  let distanciaABordoMetros = 0;
  for (let k = idxB + 1; k <= idxE; k++) {
    const de = k === 0 ? rota.inicio : paradas[k - 1].ponto;
    const para = paradas[k].ponto;
    const partida = k === 0 ? partidaMin : cand.eventos[k - 1].saidaMin;
    distanciaABordoMetros += matriz.obter(de, para, partida)?.metros ?? 0;
  }
  const antecipacaoMin = rota.partidaMin - partidaMin;
  const classe: ClasseEncaixe = cfg.reorganizada ? 'aprovacao_motorista'
    : antecipacaoMin <= 0 ? 'imediato'
    : antecipacaoMin <= cfg.autorizadaMin ? 'pre_autorizado' : 'aprovacao_motorista';
  return {
    opcao: {
      elegivel: true, sentido: rota.sentido,
      horarioBuscaMin: eb.chegadaMin, horarioEntregaMin: ed.chegadaMin,
      minutosABordo: ed.chegadaMin - eb.saidaMin,
      distanciaABordoMetros,
      desvioMin: (cand.fimMin - partidaMin) - (base.fimMin - rota.partidaMin),
      desvioMetros: cand.metros - base.metros,
      posicaoEmbarque: idxB, posicaoDesembarque: idxE,
      alteracoes, eventos: cand.eventos,
      partidaMin, antecipacaoMin, classe, folgaMin, robusta: null,
    },
    faltaDado: false,
    motivos: [],
  };
}

const ORDEM_CLASSE: Record<ClasseEncaixe, number> = { imediato: 0, pre_autorizado: 1, aprovacao_motorista: 2 };

/**
 * Busca progressiva de encaixe de um novo aluno (um sentido). Reaproveita o
 * mesmo motor; inclui escola nova + reorganização controlada; não altera a rota.
 */
export function encontrarEncaixesProgressivo(
  rota: RotaOperacional, pedido: PedidoEncaixe, matriz: MatrizViaria, opcoes: OpcoesEncaixeProgressivo = {},
): ResultadoEncaixeProgressivo {
  const vazio = (
    classificacao: ClassificacaoEncaixe, extra: Partial<ResultadoEncaixeProgressivo> = {},
  ): ResultadoEncaixeProgressivo => ({
    classificacao, opcoes: [], escolaInserida: false, estrategia: 'nenhuma',
    candidatasAvaliadas: 0, limiteAtingido: false, faltaDadoViario: false, motivos: [], contagemMotivos: {}, ...extra,
  });

  // Guardas de entrada (iguais às de `encontrarEncaixes`): entrada inválida => indeterminado.
  if (!validoPonto(pedido.casa) || !validoPonto(pedido.escola) || !inteiro(pedido.horarioEscolaMin) || !pedido.alunoId || !Number.isInteger(rota.versao)) return vazio('indeterminado');
  if (!inteiro(pedido.atendimentoMin ?? 1) || !inteiro(rota.toleranciaMin ?? 10) || rota.compromissos.some((p) => p.alunoId === pedido.alunoId) || new Set(rota.compromissos.map((p) => p.id)).size !== rota.compromissos.length) return vazio('indeterminado');

  const base = simularRota(rota, matriz);
  if (!base.valido) return vazio('indeterminado', { faltaDadoViario: base.motivos.some((m) => m.includes('tempo/distância')), motivos: base.motivos });

  const tolerancia = Math.min(10, Math.max(0, rota.toleranciaMin ?? 10));
  const escolaNova = indiceEscolaEm(rota.compromissos, pedido.escola.id) < 0;
  if (escolaNova && opcoes.inserirEscolaNova === false) return vazio('indeterminado', { escolaInserida: false });

  const limiteEscola = escolaNova ? (opcoes.limiteEscolaNovaMin ?? pedido.horarioEscolaMin) : pedido.horarioEscolaMin;
  const busca: Compromisso = {
    id: 'novo:embarque:' + pedido.alunoId, ponto: rota.sentido === 'ida' ? pedido.casa : pedido.escola,
    tipo: 'embarque', alunoId: pedido.alunoId, atendimentoMin: pedido.atendimentoMin ?? 1,
  };
  const entrega: Compromisso = {
    id: 'novo:desembarque:' + pedido.alunoId, ponto: rota.sentido === 'ida' ? pedido.escola : pedido.casa,
    tipo: 'desembarque', alunoId: pedido.alunoId, atendimentoMin: pedido.atendimentoMin ?? 1,
    ...(rota.sentido === 'ida' ? { limiteEscolaMin: limiteEscola } : {}),
  };

  const maxCand = opcoes.maxCandidatas ?? 20000;
  const visitadas = new Set<string>();
  const estado = { avaliadas: 0, limite: false, faltaDado: false, motivos: new Set<string>(), contagem: {} as Record<string, number>, reorganizada: false };
  const tmin = opcoes.anteciparPartida
    ? Math.max(0, rota.partidaMin - Math.max(0, opcoes.antecipacaoMaxMin ?? 60))
    : rota.partidaMin;
  const autorizadaMin = Math.max(0, opcoes.antecipacaoAutorizadaMin ?? 0);

  // Gera e avalia todas as inserções (i,j) sobre uma dada ordenação de paradas.
  const gerar = (seq: Compromisso[]): OpcaoEncaixe[] => {
    const out: OpcaoEncaixe[] = [];
    const escolaIdxSeq = escolaNova ? -1 : indiceEscolaEm(seq, pedido.escola.id);
    const n = seq.length;
    for (let i = 0; i <= n; i++) {
      for (let j = i + 1; j <= n + 1; j++) {
        if (!escolaNova) {
          if (rota.sentido === 'ida' && (i > escolaIdxSeq || j > escolaIdxSeq + 1)) continue;
          if (rota.sentido === 'volta' && i > escolaIdxSeq + 1) continue;
        }
        const paradas = [...seq];
        paradas.splice(i, 0, busca);
        paradas.splice(j, 0, entrega);
        const assinatura = paradas.map((p) => p.id).join('>');
        if (visitadas.has(assinatura)) continue;
        visitadas.add(assinatura);
        if (estado.avaliadas >= maxCand) { estado.limite = true; return out; }
        estado.avaliadas++;
        // Antecipação: cada candidata usa a partida viável MAIS TARDIA, nunca
        // depois da habitual (corrige o defeito em que a "antecipação" atrasava).
        const { opcao, faltaDado, motivos } = construirOpcaoProgressiva(rota, base, matriz, paradas, busca.id, entrega.id,
          { tolerancia, horarioEscolaMin: limiteEscola, tmin, autorizadaMin, reorganizada: estado.reorganizada });
        if (faltaDado) estado.faltaDado = true;
        for (const m of motivos) estado.motivos.add(m);
        for (const k of new Set(motivos.map((m) => m.split(':')[0]))) estado.contagem[k] = (estado.contagem[k] ?? 0) + 1;
        if (opcao) out.push(opcao);
      }
    }
    return out;
  };

  // Fase 1: inserção simples (ordem original).
  let opcoesValidas = gerar(rota.compromissos);
  let estrategia: 'simples' | 'reorganizacao' = 'simples';

  // Fase 2: reorganização controlada (só quando a simples não resolveu).
  // Reordena o percurso inteiro respeitando a precedência embarque->desembarque
  // de cada aluno existente. Descobre encaixes impossíveis com a ordem original
  // (ex.: antecipar um desembarque para liberar assento). Rotas grandes (> 8
  // compromissos) não são reorganizadas: a busca é marcada como não concluída
  // (indeterminado), nunca como impossível.
  if (opcoesValidas.length === 0 && opcoes.reorganizar !== false && !estado.limite) {
    if (rota.compromissos.length > 8) {
      estado.limite = true; // reorganização não explorada por complexidade
    } else {
      estado.reorganizada = true;
      for (const perm of permutacoes(rota.compromissos)) {
        if (estado.limite) break;
        if (perm.every((c, idx) => c === rota.compromissos[idx])) continue; // identidade já coberta
        if (!precedenciaValida(perm)) continue;
        const r = gerar(perm);
        if (r.length) opcoesValidas = opcoesValidas.concat(r);
      }
      if (opcoesValidas.length) estrategia = 'reorganizacao';
    }
  }

  const chave = (a: OpcaoEncaixe, b: OpcaoEncaixe) =>
    ORDEM_CLASSE[a.classe ?? 'imediato'] - ORDEM_CLASSE[b.classe ?? 'imediato']
    || Number(a.robusta === false) - Number(b.robusta === false)
    || a.desvioMin - b.desvioMin || a.desvioMetros - b.desvioMetros || a.minutosABordo - b.minutosABordo;
  const ordenadas = opcoesValidas.sort(chave);
  // Confiabilidade (eixo separado da viabilidade): as melhores opções são
  // refeitas com tempos conservadores, na MESMA partida. Não elimina opções.
  if (opcoes.matrizConservadora) {
    for (const o of ordenadas.slice(0, 5)) {
      o.robusta = simularRota({ ...rota, partidaMin: o.partidaMin ?? rota.partidaMin }, opcoes.matrizConservadora, o.eventos.map((e) => e.compromisso)).valido;
    }
    ordenadas.sort(chave);
  }

  let classificacao: ClassificacaoEncaixe;
  if (ordenadas.length > 0) classificacao = 'compativel';
  else if (estado.faltaDado || estado.limite) classificacao = 'indeterminado';
  else classificacao = 'incompativel';

  return {
    classificacao, opcoes: ordenadas, escolaInserida: escolaNova,
    estrategia: ordenadas.length ? estrategia : 'nenhuma',
    candidatasAvaliadas: estado.avaliadas, limiteAtingido: estado.limite, faltaDadoViario: estado.faltaDado,
    motivos: [...estado.motivos], contagemMotivos: estado.contagem,
  };
}

const hhmm = (m: number) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.round(m) % 60).padStart(2, '0');

/** Explicação objetiva (pt-BR) de por que o encaixe foi aceito ou recusado. */
export function explicarEncaixe(r: ResultadoEncaixeProgressivo): string[] {
  const o = r.opcoes[0];
  if (!o) {
    const total = r.candidatasAvaliadas;
    const lista = Object.entries(r.contagemMotivos).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} (${n} de ${total} posições)`);
    if (r.classificacao === 'indeterminado') {
      return ['Resultado indeterminado — não significa que não cabe.',
        r.faltaDadoViario ? 'Faltou tempo de deslocamento para algum trecho.' : 'A busca não pôde ser concluída.', ...lista];
    }
    return [`Nenhuma das ${total} posições testadas é viável.`, ...lista];
  }
  const out = [
    `Há assento livre em todo o trecho. Embarque às ${hhmm(o.horarioBuscaMin)}, entrega às ${hhmm(o.horarioEntregaMin)} (${o.minutosABordo} min a bordo).`,
    `A rota fica ${o.desvioMin} min mais longa.`,
  ];
  if (r.escolaInserida) out.push('A escola do aluno entra como nova parada da rota.');
  if (r.estrategia === 'reorganizacao') out.push('Só cabe mudando a ordem das paradas atuais: depende de aprovação do motorista.');
  else if (o.classe === 'imediato') out.push('A partida habitual é mantida.');
  else if (o.classe === 'pre_autorizado') out.push(`Exige sair às ${hhmm(o.partidaMin!)}, ${o.antecipacaoMin} min antes do habitual — dentro do que o motorista já autorizou.`);
  else out.push(`Exige sair às ${hhmm(o.partidaMin!)}, ${o.antecipacaoMin} min antes do habitual: depende de aprovação do motorista.`);
  const maior = o.alteracoes.reduce((m, a) => Math.max(m, Math.abs(a.diferencaMin)), 0);
  out.push(maior > 0
    ? `Os alunos atuais mudam no máximo ${maior} min, dentro das janelas combinadas.`
    : 'Nenhum aluno atual tem o horário alterado.');
  if (o.folgaMin != null) out.push(`Menor folga até o horário de uma escola: ${o.folgaMin} min.`);
  if (o.robusta === false) out.push('Atenção: com tempos conservadores (trânsito pior) algum horário seria perdido — o encaixe consome a margem de segurança.');
  else if (o.robusta === true) out.push('O encaixe se sustenta também com tempos conservadores.');
  return out;
}
