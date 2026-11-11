/**
 * OTIMIZADOR DE ROTA (VanBora 2.0) — sugere uma ORDEM melhor para as paradas de
 * UMA rota, sem nunca alterá-la. Usa o MESMO simulador e as MESMAS regras do
 * encaixe (capacidade por trecho, limites de escola + margem, janelas, tempo a
 * bordo, embarque antes do desembarque).
 *
 * Método (um só, escolhido para o tamanho das rotas do VanBora, 6–25 paradas):
 *  - até 7 paradas: enumeração EXATA de todas as ordens (prova o ótimo);
 *  - acima disso: busca local determinística (mover parada, trocar duas,
 *    inverter trecho) até não haver melhora.
 * A sugestão nunca é pior que a rota atual: sem ganho, devolve `melhorou: false`.
 */
import {
  simularRota, partidaMaisTardia, protegerExistentes, precedenciaValida,
  type Compromisso, type MatrizViaria, type RotaOperacional, type PlanoCalculado,
} from './encaixe-geografico';

export interface OpcoesOtimizacao {
  /**
   * Quanto o horário de cada aluno atual pode mudar (min). Default: tolerância
   * da rota (máx. 10). `null` = horários de casa LIVRES (só valem escolas,
   * janelas cadastradas e capacidade) — a sugestão então exige combinar com as famílias.
   */
  toleranciaMin?: number | null;
  /** Teto de sequências simuladas. Default 60000. */
  maxAvaliacoes?: number;
}

export interface ResumoRota { partidaMin: number; fimMin: number; duracaoMin: number; metros: number }

export interface SugestaoRota {
  melhorou: boolean;
  /** true = todas as ordens foram testadas (a sugestão é a melhor possível). */
  provadoOtimo: boolean;
  antes: ResumoRota;
  depois: ResumoRota;
  economiaMin: number;
  economiaMetros: number;
  /** Nova ordem dos compromissos (igual à atual quando `melhorou` é false). */
  compromissos: Compromisso[];
  plano: PlanoCalculado;
  /** Mudança de horário de cada compromisso atual (depois − antes). */
  alteracoes: { id: string; antesMin: number; depoisMin: number; diferencaMin: number }[];
  avaliadas: number;
  /** Preenchido quando não foi possível otimizar (rota-base inválida etc.). */
  motivo?: string;
}

/** Agrupa compromissos consecutivos no mesmo ponto: cada bloco é uma parada. */
function blocos(compromissos: Compromisso[]): Compromisso[][] {
  const out: Compromisso[][] = [];
  for (const c of compromissos) {
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo[0].ponto.id === c.ponto.id) ultimo.push(c);
    else out.push([c]);
  }
  return out;
}

const resumo = (p: PlanoCalculado, partidaMin: number): ResumoRota =>
  ({ partidaMin, fimMin: p.fimMin, duracaoMin: p.fimMin - partidaMin, metros: p.metros });

export function sugerirRotaMelhor(rota: RotaOperacional, matriz: MatrizViaria, opcoes: OpcoesOtimizacao = {}): SugestaoRota {
  const base = simularRota(rota, matriz);
  const atual = resumo(base, rota.partidaMin);
  const semGanho = (motivo?: string, avaliadas = 0, provadoOtimo = false): SugestaoRota => ({
    melhorou: false, provadoOtimo, antes: atual, depois: atual, economiaMin: 0, economiaMetros: 0,
    compromissos: rota.compromissos, plano: base, alteracoes: [], avaliadas, ...(motivo ? { motivo } : {}),
  });
  if (!base.valido) return semGanho('A rota atual tem inconsistências; corrija-a antes de otimizar.');

  const tolerancia = opcoes.toleranciaMin === null ? null : Math.min(10, Math.max(0, opcoes.toleranciaMin ?? rota.toleranciaMin ?? 10));
  const maxAval = opcoes.maxAvaliacoes ?? 60000;
  const inicial = blocos(rota.compromissos);
  const n = inicial.length;
  if (n < 3) return semGanho(undefined, 0, true);

  let avaliadas = 0;
  type Avaliada = { seq: Compromisso[]; plano: PlanoCalculado; partidaMin: number; custo: number };
  /** Simula uma ordem; null = viola alguma regra. Custo = duração total, desempate por metros. */
  const avaliar = (ordem: Compromisso[][]): Avaliada | null => {
    const crua = ordem.flat();
    if (!precedenciaValida(crua)) return null;
    // Ponto final obrigatório (mesma regra do encaixe): nenhuma ordem sugerida
    // deixa outra parada depois dele.
    if (rota.pontoFinalId && crua[crua.length - 1].ponto.id !== rota.pontoFinalId) return null;
    avaliadas++;
    const seq = tolerancia === null ? crua : protegerExistentes(rota, base, crua, tolerancia);
    // Rota mais curta pode sair MAIS TARDE e chegar à escola no mesmo horário.
    const partidaMin = partidaMaisTardia(rota, matriz, seq, rota.partidaMin, rota.partidaMin + 180);
    if (partidaMin === null) return null;
    const plano = simularRota({ ...rota, partidaMin }, matriz, seq);
    if (!plano.valido) return null;
    return { seq: crua, plano, partidaMin, custo: (plano.fimMin - partidaMin) * 1e6 + plano.metros };
  };

  // Referência: a ordem ATUAL avaliada pelas mesmas regras (partida mais tardia).
  let melhor = avaliar(inicial);
  if (!melhor) return semGanho('A rota atual não cumpre as próprias janelas de horário.');
  const custoAtual = melhor.custo;
  let ordem = inicial;
  let provadoOtimo = false;

  if (n <= 7) {
    // Enumeração exata (n! ≤ 5040).
    const usar = (prefixo: Compromisso[][], resto: Compromisso[][]) => {
      if (!resto.length) {
        const a = avaliar(prefixo);
        if (a && a.custo < melhor!.custo) { melhor = a; ordem = prefixo; }
        return;
      }
      for (let i = 0; i < resto.length; i++) usar([...prefixo, resto[i]], [...resto.slice(0, i), ...resto.slice(i + 1)]);
    };
    usar([], inicial);
    provadoOtimo = true;
  } else {
    let houveMelhora = true;
    while (houveMelhora && avaliadas < maxAval) {
      houveMelhora = false;
      const vizinhas: Compromisso[][][] = [];
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const mover = [...ordem]; const [b] = mover.splice(i, 1); mover.splice(j, 0, b); vizinhas.push(mover);
          if (i < j) {
            const trocar = [...ordem]; [trocar[i], trocar[j]] = [trocar[j], trocar[i]]; vizinhas.push(trocar);
            vizinhas.push([...ordem.slice(0, i), ...ordem.slice(i, j + 1).reverse(), ...ordem.slice(j + 1)]);
          }
        }
      }
      for (const v of vizinhas) {
        if (avaliadas >= maxAval) break;
        const a = avaliar(v);
        if (a && a.custo < melhor.custo) { melhor = a; ordem = v; houveMelhora = true; }
      }
    }
  }

  if (melhor.custo >= custoAtual) return semGanho(undefined, avaliadas, provadoOtimo);
  const depois = resumo(melhor.plano, melhor.partidaMin);
  const antes = new Map(base.eventos.map((e) => [e.compromisso.id, e.chegadaMin]));
  return {
    melhorou: true, provadoOtimo, antes: atual, depois,
    economiaMin: atual.duracaoMin - depois.duracaoMin, economiaMetros: atual.metros - depois.metros,
    compromissos: melhor.seq, plano: melhor.plano,
    alteracoes: melhor.plano.eventos.map((e) => {
      const a = antes.get(e.compromisso.id) ?? e.chegadaMin, d = e.chegadaMin + (e.esperaMin ?? 0);
      return { id: e.compromisso.id, antesMin: a, depoisMin: d, diferencaMin: d - a };
    }),
    avaliadas,
  };
}
