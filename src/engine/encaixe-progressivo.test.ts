import { describe, it, expect } from 'vitest';
import {
  encontrarEncaixes, encontrarEncaixesProgressivo,
  type RotaOperacional, type MatrizViaria, type PontoGeo,
} from './encaixe-geografico';

/**
 * Fase 4 — busca progressiva: escola nova, reorganização controlada, validação
 * integral e classificação (compatível / incompatível / indeterminado).
 * Matrizes determinísticas; números auditáveis.
 */

const p = (id: string): PontoGeo => ({ id, nome: id, lat: -21.2, lng: -50.4 });

/** Matriz por pares de id (minutos); `pad` para pares não listados; `null` = trecho ausente. */
function M(t: Record<string, number | null>, pad = 3): MatrizViaria {
  return {
    origem: 'fixture-testada',
    obter: (a, b) => {
      if (a.id === b.id) return { minutos: 0, metros: 0 };
      const k = a.id + '>' + b.id, r = b.id + '>' + a.id;
      const v = k in t ? t[k] : r in t ? t[r] : pad;
      return v === null ? null : { minutos: v, metros: v * 100 };
    },
  };
}

/* ======================= 1) ESCOLA NOVA ======================= */
describe('escola nova (não atendida) é inserida com horário-limite', () => {
  // Rota ida só com a escola S1 (aluno a). Novo aluno vai para S2 (ausente da rota).
  const rota: RotaOperacional = {
    id: 'r', versao: 1, sentido: 'ida', inicio: p('G'), partidaMin: 700, capacidade: 5, ocupacaoInicial: 0, toleranciaMin: 10,
    compromissos: [
      { id: 'a', ponto: p('A'), tipo: 'embarque', alunoId: 'a', atendimentoMin: 1 },
      { id: 'S1', ponto: p('S1'), tipo: 'escola', atendimentoMin: 0, limiteEscolaMin: 760 },
      { id: 'da', ponto: p('S1'), tipo: 'desembarque', alunoId: 'a', atendimentoMin: 0, limiteEscolaMin: 760 },
    ],
  };
  const pedido = { alunoId: 'novo', casa: p('N'), escola: p('S2'), horarioEscolaMin: 760 };

  it('o motor antigo NÃO atende escola fora do itinerário (contraste)', () => {
    expect(encontrarEncaixes(rota, pedido, M({}))).toEqual([]);
  });

  it('o motor progressivo INSERE a escola nova e encontra encaixe', () => {
    const r = encontrarEncaixesProgressivo(rota, pedido, M({}), {});
    expect(r.classificacao).toBe('compativel');
    expect(r.escolaInserida).toBe(true);
    expect(r.opcoes.length).toBeGreaterThan(0);
    // A escola nova (S2) passa a constar da sequência do encaixe.
    expect(r.opcoes[0].eventos.some((e) => e.compromisso.ponto.id === 'S2')).toBe(true);
    // A entrega do novo aluno respeita o horário-limite informado.
    expect(r.opcoes[0].horarioEntregaMin).toBeLessThanOrEqual(760);
  });

  it('com inserirEscolaNova=false, a escola ausente fica indeterminada (não avaliada)', () => {
    const r = encontrarEncaixesProgressivo(rota, pedido, M({}), { inserirEscolaNova: false });
    expect(r.classificacao).toBe('indeterminado');
    expect(r.opcoes).toEqual([]);
  });
});

/* ============== 2) REORGANIZAÇÃO VÁLIDA / INVÁLIDA ============== */
// Ida, duas escolas: a->S1, b->S2 (deadline apertado). Novo N->S1 (casa perto de A).
// Reordenar B antes de A adianta b em 6 min e só assim ele cumpre o limite de S2.
const matrizDuas = M({
  'G>A': 3, 'G>B': 1, 'A>B': 3, 'B>S1': 3, 'A>S1': 3, 'S1>S2': 3,
  'B>A': 3, 'N>A': 2, 'N>S1': 2, 'G>N': 5, 'A>N': 2, 'S1>N': 2,
}, 20);
function rotaDuas(limS2: number): RotaOperacional {
  return {
    id: 'r', versao: 1, sentido: 'ida', inicio: p('G'), partidaMin: 700, capacidade: 9, ocupacaoInicial: 0, toleranciaMin: 10,
    compromissos: [
      { id: 'a', ponto: p('A'), tipo: 'embarque', alunoId: 'a', atendimentoMin: 1 },
      { id: 'b', ponto: p('B'), tipo: 'embarque', alunoId: 'b', atendimentoMin: 1 },
      { id: 'S1', ponto: p('S1'), tipo: 'escola', atendimentoMin: 0, limiteEscolaMin: 760 },
      { id: 'da', ponto: p('S1'), tipo: 'desembarque', alunoId: 'a', atendimentoMin: 0, limiteEscolaMin: 760 },
      { id: 'S2', ponto: p('S2'), tipo: 'escola', atendimentoMin: 0, limiteEscolaMin: limS2 },
      { id: 'db', ponto: p('S2'), tipo: 'desembarque', alunoId: 'b', atendimentoMin: 0, limiteEscolaMin: limS2 },
    ],
  };
}
const pedidoDuas = { alunoId: 'novo', casa: p('N'), escola: p('S1'), horarioEscolaMin: 760 };

describe('reorganização controlada', () => {
  it('VÁLIDA: impossível mantendo a ordem, possível reorganizando (dentro da tolerância)', () => {
    const r = rotaDuas(715);
    const simples = encontrarEncaixesProgressivo(r, pedidoDuas, matrizDuas, { reorganizar: false });
    expect(simples.classificacao).toBe('incompativel'); // nenhuma inserção simples cabe
    expect(simples.opcoes).toEqual([]);

    const full = encontrarEncaixesProgressivo(r, pedidoDuas, matrizDuas, { reorganizar: true });
    expect(full.classificacao).toBe('compativel');
    expect(full.estrategia).toBe('reorganizacao');
    expect(full.opcoes.length).toBeGreaterThan(0);
    // Todos os alunos existentes permanecem DENTRO da tolerância (10 min).
    for (const op of full.opcoes) {
      for (const alt of op.alteracoes) expect(Math.abs(alt.diferencaMin)).toBeLessThanOrEqual(10);
    }
  });

  it('INVÁLIDA: deadline apertado demais — nem reorganizando cabe (incompatível comprovado)', () => {
    // Mesmo limite do caso válido (714), mas o novo aluno demora 1 min a mais
    // na casa: nem reorganizando cabe. (O tempo dele na escola é o do grupo —
    // não soma; por isso o aperto vem da casa.)
    const r = rotaDuas(714);
    const full = encontrarEncaixesProgressivo(r, { ...pedidoDuas, atendimentoMin: 2 }, matrizDuas, { reorganizar: true });
    expect(full.classificacao).toBe('incompativel');
    expect(full.opcoes).toEqual([]);
    expect(full.limiteAtingido).toBe(false);
    expect(full.faltaDadoViario).toBe(false);
  });
});

/* ======================= 3) LIMITE EXATO ======================= */
describe('limite de horário é inclusivo no limite e exclusivo um minuto antes', () => {
  // Ida simples: 1 aluno a->S; novo N->S. Matriz uniforme (3 min por trecho).
  const rota: RotaOperacional = {
    id: 'r', versao: 1, sentido: 'ida', inicio: p('G'), partidaMin: 700, capacidade: 5, ocupacaoInicial: 0, toleranciaMin: 10,
    compromissos: [
      { id: 'a', ponto: p('A'), tipo: 'embarque', alunoId: 'a', atendimentoMin: 1 },
      { id: 'S', ponto: p('S'), tipo: 'escola', atendimentoMin: 0, limiteEscolaMin: 900 },
      { id: 'da', ponto: p('S'), tipo: 'desembarque', alunoId: 'a', atendimentoMin: 0, limiteEscolaMin: 900 },
    ],
  };
  // Primeiro descobre a chegada MÍNIMA possível do novo aluno à escola, com folga.
  const generoso = encontrarEncaixesProgressivo(rota, { alunoId: 'novo', casa: p('N'), escola: p('S'), horarioEscolaMin: 900 }, M({}), {});
  const melhorEntrega = Math.min(...generoso.opcoes.map((o) => o.horarioEntregaMin));

  it('no limite exato => compatível', () => {
    const r = encontrarEncaixesProgressivo(rota, { alunoId: 'novo', casa: p('N'), escola: p('S'), horarioEscolaMin: melhorEntrega }, M({}), {});
    expect(r.classificacao).toBe('compativel');
    expect(r.opcoes.some((o) => o.horarioEntregaMin === melhorEntrega)).toBe(true);
  });

  it('um minuto antes do limite => incompatível', () => {
    const r = encontrarEncaixesProgressivo(rota, { alunoId: 'novo', casa: p('N'), escola: p('S'), horarioEscolaMin: melhorEntrega - 1 }, M({}), {});
    expect(r.classificacao).toBe('incompativel');
  });
});

/* ======================= 4) CAPACIDADE ======================= */
describe('capacidade por trecho bloqueia quando não há como liberar assento', () => {
  // cap=2, a e b já ocupam a van; tolerância curta (2 min) impede desvios para encaixar o 3º.
  const rota: RotaOperacional = {
    id: 'r', versao: 1, sentido: 'ida', inicio: p('G'), partidaMin: 700, capacidade: 2, ocupacaoInicial: 0, toleranciaMin: 2,
    compromissos: [
      { id: 'a', ponto: p('A'), tipo: 'embarque', alunoId: 'a', atendimentoMin: 1 },
      { id: 'b', ponto: p('B'), tipo: 'embarque', alunoId: 'b', atendimentoMin: 1 },
      { id: 'S', ponto: p('S'), tipo: 'escola', atendimentoMin: 0, limiteEscolaMin: 720 },
      { id: 'da', ponto: p('S'), tipo: 'desembarque', alunoId: 'a', atendimentoMin: 0, limiteEscolaMin: 720 },
      { id: 'db', ponto: p('S'), tipo: 'desembarque', alunoId: 'b', atendimentoMin: 0, limiteEscolaMin: 720 },
    ],
  };
  it('van cheia + tolerância curta => incompatível', () => {
    const r = encontrarEncaixesProgressivo(rota, { alunoId: 'novo', casa: p('N'), escola: p('S'), horarioEscolaMin: 720 }, M({ 'G>N': 9, 'N>S': 9, 'A>N': 9, 'B>N': 9 }), {});
    expect(r.classificacao).toBe('incompativel');
    expect(r.opcoes).toEqual([]);
  });
});

/* ======================= 5) INDETERMINADO ======================= */
describe('resultados indeterminados são distintos de incompatível', () => {
  const rota: RotaOperacional = {
    id: 'r', versao: 1, sentido: 'ida', inicio: p('G'), partidaMin: 700, capacidade: 5, ocupacaoInicial: 0, toleranciaMin: 10,
    compromissos: [
      { id: 'a', ponto: p('A'), tipo: 'embarque', alunoId: 'a', atendimentoMin: 1 },
      { id: 'S', ponto: p('S'), tipo: 'escola', atendimentoMin: 0, limiteEscolaMin: 760 },
      { id: 'da', ponto: p('S'), tipo: 'desembarque', alunoId: 'a', atendimentoMin: 0, limiteEscolaMin: 760 },
    ],
  };
  const pedido = { alunoId: 'novo', casa: p('N'), escola: p('S'), horarioEscolaMin: 760 };

  it('falta de dado viário (trecho ausente) => indeterminado, não impossível', () => {
    const r = encontrarEncaixesProgressivo(rota, pedido, M({ 'N>S': null, 'A>N': null, 'G>N': null, 'S>N': null, 'B>N': null }), {});
    expect(r.classificacao).toBe('indeterminado');
    expect(r.faltaDadoViario).toBe(true);
  });

  it('orçamento de busca esgotado => indeterminado (nunca "impossível")', () => {
    // Deadline impossível por inserção simples, mas com orçamento 1 a busca não conclui.
    const apertada = rotaDuas(714);
    const r = encontrarEncaixesProgressivo(apertada, pedidoDuas, matrizDuas, { maxCandidatas: 1 });
    expect(r.limiteAtingido).toBe(true);
    expect(r.classificacao).toBe('indeterminado');
  });
});

/* =============== 6) ROTA ORIGINAL INTACTA =============== */
describe('a busca não altera a rota original (nenhuma otimização automática)', () => {
  it('as paradas e compromissos de entrada permanecem os mesmos', () => {
    const r = rotaDuas(715);
    const antes = r.compromissos.map((c) => c.id).join(',');
    encontrarEncaixesProgressivo(r, pedidoDuas, matrizDuas, { reorganizar: true });
    expect(r.compromissos.map((c) => c.id).join(',')).toBe(antes);
  });
});
