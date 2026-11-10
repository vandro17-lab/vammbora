import { describe, it, expect } from 'vitest';
import { encontrarEncaixesProgressivo, simularRota, type Compromisso, type PontoGeo, type RotaOperacional } from './encaixe-geografico';

/**
 * VanBora 2.0 — reprodução dos dois defeitos apontados pela pesquisa (sondas E8):
 *  D1) `anteciparPartida` ATRASAVA a partida quando a rota tinha folga;
 *  D2) parada do tipo 'escola' não liberava os assentos de quem desce nela.
 * Malha em linha (1 unidade = 1 min): G0 A4 B8 N10 C12 S1(16) P17 S2(20).
 */
const X: Record<string, number> = { G: 0, A: 4, B: 8, C: 12, S1: 16, S2: 20, N: 10, P: 17 };
const pt = (n: string): PontoGeo => ({ id: n, nome: n, lat: 0, lng: X[n] / 1000 });
const matriz = { origem: 'fixture-testada' as const, obter: (a: PontoGeo, b: PontoGeo) => ({ minutos: Math.abs(X[a.id] - X[b.id]), metros: 500 * Math.abs(X[a.id] - X[b.id]) }) };
const emb = (al: string, onde: string, h: number): Compromisso => ({ id: 'e' + al, ponto: pt(onde), tipo: 'embarque', alunoId: al, horarioBaseMin: h, atendimentoMin: 1 });
const des = (al: string, onde: string, lim: number): Compromisso => ({ id: 'd' + al, ponto: pt(onde), tipo: 'desembarque', alunoId: al, limiteEscolaMin: lim, atendimentoMin: 0 });
const rota = (lim: number, cap = 6): RotaOperacional => ({
  id: 'r', versao: 1, sentido: 'ida', inicio: pt('G'), partidaMin: 360, capacidade: cap, ocupacaoInicial: 0, toleranciaMin: 10,
  compromissos: [emb('a', 'A', 364), emb('b', 'B', 369), emb('c', 'C', 374), des('a', 'S1', lim), des('b', 'S1', lim), des('c', 'S1', lim)],
});
const ped = (casa: string, escola: string, h: number) => ({ alunoId: 'novo', casa: pt(casa), escola: pt(escola), horarioEscolaMin: h, atendimentoMin: 1 });

describe('D1 — antecipação da partida', () => {
  it('com folga grande, ligar a antecipação não pode eliminar um encaixe que já cabia', () => {
    const sem = encontrarEncaixesProgressivo(rota(420), ped('N', 'S1', 420), matriz, { reorganizar: false });
    const com = encontrarEncaixesProgressivo(rota(420), ped('N', 'S1', 420), matriz, { reorganizar: false, anteciparPartida: true });
    expect(sem.classificacao).toBe('compativel');
    expect(com.classificacao).toBe('compativel');
  });
  it('a partida de uma candidata nunca é DEPOIS da partida habitual', () => {
    const com = encontrarEncaixesProgressivo(rota(387), ped('N', 'S1', 387), matriz, { reorganizar: false, anteciparPartida: true });
    expect(com.opcoes.length).toBeGreaterThan(0);
    // 1º embarque (A) fica a 4 min da garagem: chegada − 4 = partida usada.
    for (const o of com.opcoes) expect(o.eventos[0].chegadaMin - X[o.eventos[0].compromisso.ponto.id]).toBeLessThanOrEqual(360);
  });
});

describe('D2 — escola libera assentos', () => {
  const comEscola = (): RotaOperacional => ({
    ...rota(420, 3),
    compromissos: [emb('a', 'A', 364), emb('b', 'B', 369), emb('c', 'C', 374), { id: 'esc', ponto: pt('S1'), tipo: 'escola', limiteEscolaMin: 420, atendimentoMin: 1 }],
  });
  it('quem não tem desembarque explícito desce na parada da escola', () => {
    expect(simularRota(comEscola(), matriz).eventos.map((e) => e.ocupacaoApos)).toEqual([1, 2, 3, 0]);
  });
  it('van cheia até a escola 1 aceita aluno que embarca depois dela rumo à escola 2', () => {
    const r = encontrarEncaixesProgressivo(comEscola(), ped('P', 'S2', 450), matriz, { reorganizar: false });
    expect(r.classificacao).toBe('compativel');
    // Mesmo resultado do modelo com desembarques explícitos (controle).
    expect(encontrarEncaixesProgressivo(rota(420, 3), ped('P', 'S2', 450), matriz, { reorganizar: false }).classificacao).toBe('compativel');
  });
});
