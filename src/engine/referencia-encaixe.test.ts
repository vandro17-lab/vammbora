import { describe, it, expect } from 'vitest';
import {
  encontrarEncaixes, simularRota,
  type RotaOperacional, type MatrizViaria, type PontoGeo, type OpcaoEncaixe,
} from '@/engine/encaixe-geografico';
import { simularEncaixeRota, type AlunoNovo } from '@/lib/rota-para-encaixe';
import type { Rota, Veiculo, ParadaRota, PassageiroRota } from '@/types/motorista';

/**
 * TESTES DE REFERÊNCIA (golden) — Fase 1 do "Algoritmo Supremo".
 *
 * Objetivo: TRAVAR os números exatos que o motor produz HOJE, antes das
 * próximas fases (escola nova + reorganização controlada) mexerem no núcleo.
 * Os testes existentes checam o comportamento de forma estrutural (>, <, <=);
 * aqui fixamos os VALORES exatos (horários, desvios, ordem das opções) num
 * cenário com matriz viária determinística e consistente, para qualquer
 * regressão futura ser detectada de imediato.
 *
 * Matriz de referência: todo trecho entre pontos distintos custa um valor fixo
 * (3 min / 1000 m, exceto onde indicado). Assim os horários são auditáveis à mão.
 */

const p = (id: string): PontoGeo => ({ id, nome: id, lat: -21.2, lng: -50.4 });
const matrizFixa: MatrizViaria = {
  origem: 'fixture-testada',
  obter: (a, b) => ({ minutos: a.id === b.id ? 0 : 3, metros: a.id === b.id ? 0 : 1000 }),
};

function rotaRef(sentido: 'ida' | 'volta' = 'ida'): RotaOperacional {
  return {
    id: 'r', versao: 1, sentido, inicio: p('garagem'), partidaMin: sentido === 'ida' ? 390 : 720,
    capacidade: 3, ocupacaoInicial: 0, toleranciaMin: 10,
    compromissos: sentido === 'ida' ? [
      { id: 'a', ponto: p('a'), tipo: 'embarque', alunoId: 'a', atendimentoMin: 1 },
      { id: 'b', ponto: p('b'), tipo: 'embarque', alunoId: 'b', atendimentoMin: 1 },
      { id: 'escola', ponto: p('escola'), tipo: 'escola', atendimentoMin: 1, limiteEscolaMin: 420 },
      { id: 'd-a', ponto: p('escola'), tipo: 'desembarque', alunoId: 'a', atendimentoMin: 0, limiteEscolaMin: 420 },
      { id: 'd-b', ponto: p('escola'), tipo: 'desembarque', alunoId: 'b', atendimentoMin: 0, limiteEscolaMin: 420 },
    ] : [
      { id: 'e-a', ponto: p('escola'), tipo: 'embarque', alunoId: 'a', atendimentoMin: 1 },
      { id: 'e-b', ponto: p('escola'), tipo: 'embarque', alunoId: 'b', atendimentoMin: 1 },
      { id: 'd-a', ponto: p('a'), tipo: 'desembarque', alunoId: 'a', atendimentoMin: 1 },
      { id: 'd-b', ponto: p('b'), tipo: 'desembarque', alunoId: 'b', atendimentoMin: 1 },
    ],
  };
}
const pedidoRef = { alunoId: 'novo', casa: p('casa'), escola: p('escola'), horarioEscolaMin: 420 };

/** Projeção estável e legível de uma opção de encaixe, para o snapshot. */
const projetar = (o: OpcaoEncaixe) => ({
  embarque: o.posicaoEmbarque, desembarque: o.posicaoDesembarque,
  buscaMin: o.horarioBuscaMin, entregaMin: o.horarioEntregaMin,
  minutosABordo: o.minutosABordo, desvioMin: o.desvioMin, desvioMetros: o.desvioMetros,
  alteracoes: o.alteracoes.map((a) => ({ id: a.id, dif: a.diferencaMin })),
});

describe('referência do motor geográfico (valores exatos travados)', () => {
  it('âncora aritmética: a rota-base ida chega à escola às 401 (partida 390)', () => {
    const base = simularRota(rotaRef('ida'), matrizFixa);
    expect(base.valido).toBe(true);
    // 390 +3(gar→a)+1(at) +3(a→b)+1 +3(b→escola) = 401 na chegada à escola.
    expect(base.eventos.find((e) => e.compromisso.id === 'escola')!.chegadaMin).toBe(401);
    expect(base.eventos.find((e) => e.compromisso.id === 'a')!.chegadaMin).toBe(393);
    expect(base.eventos.find((e) => e.compromisso.id === 'b')!.chegadaMin).toBe(397);
  });

  it('golden — todas as opções de encaixe na IDA (ordem e horários)', () => {
    const ops = encontrarEncaixes(rotaRef('ida'), pedidoRef, matrizFixa);
    expect(ops.length).toBeGreaterThan(0);
    expect({ total: ops.length, opcoes: ops.map(projetar) }).toMatchSnapshot();
  });

  it('golden — todas as opções de encaixe na VOLTA (ordem e horários)', () => {
    const ops = encontrarEncaixes(rotaRef('volta'), { ...pedidoRef, horarioEscolaMin: 720 }, matrizFixa);
    expect({ total: ops.length, opcoes: ops.map(projetar) }).toMatchSnapshot();
  });
});

/* ------- golden ponta a ponta do adaptador real (simularEncaixeRota) ------- */
const veiculoRef = (lugares: number): Veiculo => ({
  id: 'v1', modelo: 'Van', lugaresPassageiro: lugares,
  arCondicionado: true, acessivel: false, cintos: true, fotos: [],
});
let s = 0;
const parada = (id: string, tipo: ParadaRota['tipo'], ordem: number, extra: Partial<ParadaRota> = {}): ParadaRota => ({
  id, ordem, tipo, rotulo: id, lat: -21.2 + (s += 0.01), lng: -50.4 - s, confirmado: true, ...extra,
});
const passageiro = (id: string, nome: string, emb: string | null, des: string | null): PassageiroRota => ({
  id, identificacao: nome, embarqueParadaId: emb, desembarqueParadaId: des, destinoId: 'esc',
});
function rotaIdaReal(): Rota {
  return {
    id: 'r-ida', nome: 'Ida', sentido: 'ida', turno: 'manha', dias: ['seg'], veiculoId: 'v1',
    monitor: false, monitorOcupaLugar: false, lugaresReservados: 0,
    ultimoDesembarqueMin: 420, limiteAntecipacaoMin: 30, status: 'concluida', atualizadoEm: '2026-11-04T00:00:00Z',
    paradas: [
      parada('s', 'saida', 0), parada('a', 'casa', 1), parada('b', 'casa', 2),
      parada('e', 'escola', 3, { destinoId: 'esc', destinoNome: 'Escola' }),
    ],
    passageiros: [passageiro('ana', 'Ana', 'a', 'e'), passageiro('bruno', 'Bruno', 'b', 'e')],
  };
}
// Matriz id→id determinística (minutos); pares ausentes = 6 min.
const matrizReal: MatrizViaria = {
  origem: 'fixture-testada',
  obter: (a, b) => {
    if (a.id === b.id) return { minutos: 0, metros: 0 };
    const t: Record<string, number> = { 's>a': 5, 'a>b': 5, 'b>esc': 7, 'a>nova': 3, 'nova>b': 4 };
    const k = a.id + '>' + b.id, r = b.id + '>' + a.id;
    const m = k in t ? t[k] : r in t ? t[r] : 6;
    return { minutos: m, metros: m * 300 };
  },
};

describe('referência do adaptador real (simularEncaixeRota)', () => {
  it('golden — encaixe de novo aluno na ida (horários exatos)', () => {
    const aluno: AlunoNovo = { alunoId: 'novo', nome: 'Novo', casa: { id: 'nova', nome: 'Casa nova', lat: -21.25, lng: -50.5 }, escolaId: 'esc' };
    const r = simularEncaixeRota(rotaIdaReal(), veiculoRef(5), aluno, matrizReal, { horarioEscolaMin: 420 });
    expect(r.elegivel).toBe(true);
    expect({
      elegivel: r.elegivel, sentido: r.sentido, partidaMin: r.partidaMin,
      chegadaEscolaBase: r.base?.eventos.find((e) => e.compromisso.ponto.id === 'esc')?.chegadaMin ?? null,
      opcao: r.opcao ? projetar(r.opcao) : null,
    }).toMatchSnapshot();
  });
});
