/** Contrato independente de telas/banco. Tempos são fornecidos pelo adaptador, nunca inventados. */
export interface ParadaPlanejamento {
  id: string;
  embarques: string[];
  desembarques: string[];
  /** Tempo de atendimento APÓS chegada e ANTES de sair desta parada. */
  atendimentoMin: number;
  /** Janela ORIGINAL contratada de chegada, inclusive nas escolas (já descontar margem). */
  janela?: { inicio: number; fim: number };
}
export interface RotaPlanejamento {
  capacidadePassageiros: number;
  assentosReservados: number;
  paradas: ParadaPlanejamento[];
  /** Saída -> parada 0, parada 0 -> parada 1, ...; inclui trânsito conservador por trecho. */
  temposTrechosMin: number[];
  /** Última chegada deve acontecer até este minuto do mesmo dia. */
  chegadaFinalAte: number;
  saidaPermitida: { inicio: number; fim: number };
  /** Parâmetro operacional fornecido pelo chamador, não uma afirmação legal. */
  limiteABordoMin: number | null;
}
export interface PlanoRota {
  valido: boolean;
  /** Falhas estruturais ou operacionais; não há plano parcial utilizável em caso de falha. */
  erros: string[];
  alertas: string[];
  saida?: number;
  paradas: { id: string; chegada: number; saida: number; aBordo: string[] }[];
  /** Inclui saída -> primeira parada. Última parada não cria trecho fictício. */
  trechos: { de: string | null; ate: string; ocupados: number; livres: number }[];
  passageiros: { id: string; tempoABordoMin: number }[];
}
const obj = (x: unknown): Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : {};
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const inteiro = (x: unknown): x is number => num(x) && Number.isInteger(x);
const minuto = (x: unknown): x is number => num(x) && x < 1440;
const id = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;
const janelaValida = (x: unknown) => { const j = obj(x); return minuto(j.inicio) && minuto(j.fim) && j.inicio <= j.fim; };
const listaIds = (x: unknown): x is string[] => Array.isArray(x) && x.every(id) && new Set(x).size === x.length;
const falha = (erros: string[]): PlanoRota => ({ valido: false, erros, alertas: [], paradas: [], trechos: [], passageiros: [] });

/** Sem espera deliberada: horários avançam por deslocamento + atendimento explícitos.
 * Intersecta todas as janelas e escolhe a saída MAIS TARDE que ainda atende cada limite.
 */
export function planejarRota(entrada: RotaPlanejamento): PlanoRota {
  const r = obj(entrada);
  const erros: string[] = [];
  if (!inteiro(r.capacidadePassageiros) || r.capacidadePassageiros === 0) erros.push('capacidadePassageiros');
  if (!inteiro(r.assentosReservados) || (inteiro(r.capacidadePassageiros) && r.assentosReservados > r.capacidadePassageiros)) erros.push('assentosReservados');
  if (!minuto(r.chegadaFinalAte)) erros.push('chegadaFinalAte');
  if (!janelaValida(r.saidaPermitida)) erros.push('saidaPermitida');
  if (!(r.limiteABordoMin === null || (num(r.limiteABordoMin) && r.limiteABordoMin > 0))) erros.push('limiteABordoMin');
  if (!Array.isArray(r.paradas) || r.paradas.length < 2) erros.push('paradas');
  const ps: unknown[] = Array.isArray(r.paradas) ? r.paradas : [];
  if (!Array.isArray(r.temposTrechosMin) || r.temposTrechosMin.length !== ps.length || !r.temposTrechosMin.every(num)) erros.push('temposTrechosMin');
  const ids = new Set<string>();
  ps.forEach((raw, i) => {
    const p = obj(raw);
    if (!id(p.id) || ids.has(p.id)) erros.push(`paradas[${i}].id`);
    if (id(p.id)) ids.add(p.id);
    if (!listaIds(p.embarques) || !listaIds(p.desembarques)) erros.push(`paradas[${i}].passageiros`);
    if (!num(p.atendimentoMin)) erros.push(`paradas[${i}].atendimentoMin`);
    if (p.janela !== undefined && !janelaValida(p.janela)) erros.push(`paradas[${i}].janela`);
  });
  if (erros.length) return falha(erros);
  const rota = entrada;
  const offsets: number[] = [];
  let acumulado = 0;
  rota.paradas.forEach((p, i) => {
    acumulado += rota.temposTrechosMin[i];
    offsets.push(acumulado);
    acumulado += p.atendimentoMin;
  });
  if (!Number.isFinite(acumulado)) return falha(['temposCalculados']);
  let inicio = rota.saidaPermitida.inicio;
  let fim = Math.min(rota.saidaPermitida.fim, rota.chegadaFinalAte - offsets[offsets.length - 1]);
  rota.paradas.forEach((p, i) => {
    if (p.janela) {
      inicio = Math.max(inicio, p.janela.inicio - offsets[i]);
      fim = Math.min(fim, p.janela.fim - offsets[i]);
    }
  });
  if (fim < inicio || fim + acumulado >= 1440) return falha(['Nenhum horário de saída atende todas as janelas no mesmo dia']);
  const plano: PlanoRota = { valido: true, erros: [], alertas: [], saida: fim, paradas: [], trechos: [], passageiros: [] };
  const aBordo = new Map<string, number>();
  const vistos = new Set<string>();
  const capacidade = rota.capacidadePassageiros - rota.assentosReservados;
  rota.paradas.forEach((p, i) => {
    const chegada = fim + offsets[i];
    plano.trechos.push({ de: i ? rota.paradas[i - 1].id : null, ate: p.id, ocupados: aBordo.size + rota.assentosReservados, livres: capacidade - aBordo.size });
    // Desembarques liberam lugares ANTES de embarques no mesmo ponto.
    for (const aluno of p.desembarques) {
      const embarcou = aBordo.get(aluno);
      if (embarcou === undefined) erros.push(`Desembarque sem embarque anterior: ${aluno}`);
      else {
        const tempo = chegada - embarcou;
        plano.passageiros.push({ id: aluno, tempoABordoMin: tempo });
        if (rota.limiteABordoMin !== null && tempo > rota.limiteABordoMin) erros.push(`Tempo a bordo excedido: ${aluno}`);
        aBordo.delete(aluno);
      }
    }
    for (const aluno of p.embarques) {
      if (vistos.has(aluno) || p.desembarques.includes(aluno)) erros.push(`Embarque duplicado ou inconsistente: ${aluno}`);
      vistos.add(aluno);
      // Conservador: inclui atendimento do ponto de embarque no tempo a bordo.
      aBordo.set(aluno, chegada);
    }
    if (aBordo.size > capacidade) erros.push(`Capacidade excedida após ${p.id}`);
    plano.paradas.push({ id: p.id, chegada, saida: chegada + p.atendimentoMin, aBordo: [...aBordo.keys()] });
  });
  if (!vistos.size) erros.push('Rota sem passageiros');
  if (aBordo.size) erros.push('Passageiros sem desembarque');
  if (erros.length) return falha(erros);
  if (rota.limiteABordoMin === null) plano.alertas.push('Limite de tempo a bordo não informado; validar antes de confirmar serviço');
  return plano;
}

export interface AvaliacaoCandidata {
  compativel: boolean;
  nivel: 'disponivel' | 'sob_consulta' | 'indisponivel';
  motivos: string[];
  antecipacaoMin?: number;
  plano: PlanoRota;
}
/** Compara uma sequência candidata JÁ construída pelo adaptador. Não busca endereços,
 * não escolhe inserções, não reserva vaga e não substitui a aprovação documental.
 * Janelas originais são preservadas. Sem janela, fixa a chegada do plano de referência.
 */
export function avaliarRotaCandidata(base: RotaPlanejamento, candidata: RotaPlanejamento, antecipacaoMaxMin: number): AvaliacaoCandidata {
  const antes = planejarRota(base), pre = planejarRota(candidata);
  const negar = (motivos: string[]): AvaliacaoCandidata => ({ compativel: false, nivel: 'indisponivel', motivos, plano: falha(motivos) });
  if (!antes.valido || !pre.valido) return negar([...antes.erros, ...pre.erros]);
  if (!num(antecipacaoMaxMin)) return negar(['antecipacaoMaxMin']);
  if (base.capacidadePassageiros !== candidata.capacidadePassageiros || base.assentosReservados !== candidata.assentosReservados) return negar(['Veículo ou lugares reservados alterados']);
  const idsBase = new Set(base.paradas.map(p => p.id));
  if (candidata.paradas.filter(p => idsBase.has(p.id)).map(p => p.id).join('\0') !== base.paradas.map(p => p.id).join('\0')) return negar(['Paradas existentes removidas ou reordenadas']);
  const eventos = (rota: RotaPlanejamento) => {
    const m = new Map<string, string>();
    for (const p of rota.paradas) {
      for (const x of p.embarques) m.set(`e:${x}`, p.id);
      for (const x of p.desembarques) m.set(`d:${x}`, p.id);
    }
    return m;
  };
  const futuros = eventos(candidata);
  for (const [evento, parada] of eventos(base)) if (futuros.get(evento) !== parada) return negar(['Embarque ou destino de passageiro existente alterado']);
  const saida = antes.saida!;
  const paradas = candidata.paradas.map(p => {
    const i = base.paradas.findIndex(x => x.id === p.id);
    if (i < 0) return p;
    const original = base.paradas[i].janela ?? { inicio: antes.paradas[i].chegada, fim: antes.paradas[i].chegada };
    return { ...p, janela: { inicio: Math.max(original.inicio, p.janela?.inicio ?? 0), fim: Math.min(original.fim, p.janela?.fim ?? 1439) } };
  });
  const plano = planejarRota({ ...candidata, paradas,
    chegadaFinalAte: Math.min(base.chegadaFinalAte, candidata.chegadaFinalAte),
    limiteABordoMin: base.limiteABordoMin === null ? candidata.limiteABordoMin : candidata.limiteABordoMin === null ? base.limiteABordoMin : Math.min(base.limiteABordoMin, candidata.limiteABordoMin),
    saidaPermitida: { inicio: Math.max(base.saidaPermitida.inicio, candidata.saidaPermitida.inicio, saida - antecipacaoMaxMin), fim: Math.min(saida, candidata.saidaPermitida.fim) },
  });
  if (!plano.valido) return negar(plano.erros);
  const pendente = base.limiteABordoMin === null || candidata.limiteABordoMin === null;
  return { compativel: !pendente, nivel: pendente ? 'sob_consulta' : 'disponivel', motivos: pendente ? ['Limite de tempo a bordo pendente'] : ['Sequência compatível com tempos e janelas fornecidos'], antecipacaoMin: saida - plano.saida!, plano };
}
