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
}
export interface Trecho { minutos: number; metros: number }
export interface MatrizViaria {
  origem: 'google-routes' | 'fixture-testada' | 'outro-provedor';
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
}
export interface PedidoEncaixe {
  alunoId: string;
  casa: PontoGeo;
  escola: PontoGeo;
  /** Horário máximo de chegada à escola (ida) ou mínimo de saída da escola (volta). */
  horarioEscolaMin: number;
  atendimentoMin?: number;
}
export interface EventoCalculado { compromisso: Compromisso; chegadaMin: number; saidaMin: number; ocupacaoApos: number }
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
  for (const p of compromissos) {
    if (!validoPonto(p.ponto) || !inteiro(p.atendimentoMin)) { motivos.push('Parada sem localização ou duração válida.'); break; }
    const trecho = matriz.obter(anterior, p.ponto, tempo);
    if (!trecho || !inteiro(trecho.minutos) || !inteiro(trecho.metros)) { motivos.push('Falta tempo/distância rodoviária para um trecho.'); break; }
    tempo += trecho.minutos;
    metros += trecho.metros;
    const chegada = tempo;
    if (p.limiteEscolaMin !== undefined && (!inteiro(p.limiteEscolaMin) || chegada > p.limiteEscolaMin)) motivos.push('Horário-limite de escola ultrapassado: ' + p.ponto.nome);
    if (p.tipo === 'embarque') ocupacao++;
    if (p.tipo === 'desembarque') ocupacao--;
    if (ocupacao > rota.capacidade || ocupacao < 0) motivos.push('Capacidade inválida no trecho: ' + p.ponto.nome);
    tempo += p.atendimentoMin;
    eventos.push({ compromisso: p, chegadaMin: chegada, saidaMin: tempo, ocupacaoApos: ocupacao });
    anterior = p.ponto;
  }
  return { eventos, metros, fimMin: tempo, valido: motivos.length === 0 && eventos.length === compromissos.length, motivos };
}

/** Examina todas as posições possíveis para embarque e desembarque, sem mudar a ordem dos antigos. */
export function encontrarEncaixes(rota: RotaOperacional, pedido: PedidoEncaixe, matriz: MatrizViaria): OpcaoEncaixe[] {
  if (!validoPonto(pedido.casa) || !validoPonto(pedido.escola) || !inteiro(pedido.horarioEscolaMin) || !pedido.alunoId || !Number.isInteger(rota.versao)) return [];
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
      if (indiceEscola >= 0 && rota.sentido === 'ida' && (i > indiceEscola || j > indiceEscola + 1)) continue;
      if (indiceEscola >= 0 && rota.sentido === 'volta' && i > indiceEscola + 1) continue;
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
