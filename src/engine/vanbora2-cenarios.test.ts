import { describe, it, expect } from 'vitest';
import * as motor from './encaixe-geografico';
import { rodarCenarios, type ResumoCenario } from './vanbora2-cenarios';
import { sugerirRotaMelhor } from './otimizador-rota';

const r = rodarCenarios(motor) as Record<string, ResumoCenario> & { mesma_escola_ocupacao: number[]; liberacao_assentos: number[] };

describe('VanBora 2.0 — cenários representativos do encaixe', () => {
  it('encaixe simples mantém a partida habitual', () => {
    expect(r.encaixe_simples).toMatchObject({ classificacao: 'compativel', classe: 'imediato', partida: 360, busca: 372, entrega: 380 });
  });
  it('vários alunos na mesma escola: todos descem e a van esvazia', () => {
    expect(Math.max(...r.mesma_escola_ocupacao)).toBe(4);
    expect(r.mesma_escola_ocupacao.at(-1)).toBe(0);
  });
  it('escola libera assentos; capacidade vale por trecho', () => {
    expect(r.liberacao_assentos).toEqual([1, 2, 3, 0]);
    expect(r.capacidade_trecho_livre.classificacao).toBe('compativel');
    expect(r.capacidade_trecho_cheio.classificacao).toBe('incompativel');
  });
  it('antecipação nunca atrasa a partida', () => {
    expect(r.antecipacao_com_folga).toMatchObject({ classificacao: 'compativel', classe: 'imediato', partida: 360 });
    expect(r.antecipacao_folga_8min).toMatchObject({ classificacao: 'compativel', partida: 360 });
  });
  it('janela cadastrada (horário fixo) é respeitada; sair antes preserva o combinado', () => {
    expect(r.janela_fixa_partida_fixa.classificacao).toBe('incompativel');
    expect(r.janela_fixa_antecipando).toMatchObject({ classificacao: 'compativel', classe: 'pre_autorizado', partida: 359 });
  });
  it('escola adicional entra como nova parada', () => {
    expect(r.escola_adicional).toMatchObject({ classificacao: 'compativel', escolaInserida: true });
    expect(r.escola_adicional.entrega!).toBeLessThanOrEqual(450);
  });
  it('rota impossível é recusada; falta de dado viário é indeterminado, não recusa', () => {
    expect(r.impossivel.classificacao).toBe('incompativel');
    expect(r.indeterminado_sem_trecho.classificacao).toBe('indeterminado');
  });
  it('viável com autorização: classe depende do que o motorista cadastrou', () => {
    expect(r.autorizacao_nao_cadastrada).toMatchObject({ classificacao: 'compativel', classe: 'aprovacao_motorista', partida: 358 });
    expect(r.autorizacao_cadastrada).toMatchObject({ classificacao: 'compativel', classe: 'pre_autorizado', partida: 358 });
  });
  it('margem de segurança é exigida; sem margem o encaixe é sinalizado como frágil', () => {
    expect(r.margem_exigida).toMatchObject({ classificacao: 'compativel', partida: 358, entrega: 378 }); // 6 min antes do limite 384
    expect(r.sem_margem).toMatchObject({ classificacao: 'compativel', robusta: false });
  });
  it('explica aceitação e recusa em linguagem direta', () => {
    const X: Record<string, number> = { G: 0, A: 4, S1: 16, N: 10 };
    const pt = (n: string) => ({ id: n, nome: n, lat: 0, lng: X[n] / 1000 });
    const mz: motor.MatrizViaria = { origem: 'fixture-testada', obter: (a, b) => ({ minutos: Math.abs(X[a.id] - X[b.id]), metros: 0 }) };
    const rota: motor.RotaOperacional = { id: 'r', versao: 1, sentido: 'ida', inicio: pt('G'), partidaMin: 360, capacidade: 1, ocupacaoInicial: 0,
      compromissos: [{ id: 'ea', ponto: pt('A'), tipo: 'embarque', alunoId: 'a', atendimentoMin: 1 }, { id: 'da', ponto: pt('S1'), tipo: 'desembarque', alunoId: 'a', limiteEscolaMin: 420, atendimentoMin: 0 }] };
    const recusa = motor.explicarEncaixe(motor.encontrarEncaixesProgressivo(rota, { alunoId: 'n', casa: pt('N'), escola: pt('S1'), horarioEscolaMin: 420 }, mz, { reorganizar: false }));
    expect(recusa.join(' ')).toMatch(/Nenhuma das \d+ posições.*Capacidade inválida no trecho \(\d+ de \d+ posições\)/);
    const aceite = motor.explicarEncaixe(motor.encontrarEncaixesProgressivo({ ...rota, capacidade: 2 }, { alunoId: 'n', casa: pt('N'), escola: pt('S1'), horarioEscolaMin: 420 }, mz, { reorganizar: false }));
    expect(aceite.join(' ')).toMatch(/Embarque às 06:11.*partida habitual é mantida/);
  });
});

describe('VanBora 2.0 — otimizador de rota', () => {
  // Linha: G0 … casas fora de ordem (C12, A4, B8) … escola S1(16), limite 07:00.
  const X: Record<string, number> = { G: 0, A: 4, B: 8, C: 12, S1: 16 };
  const pt = (n: string) => ({ id: n, nome: n, lat: 0, lng: X[n] / 1000 });
  const mz: motor.MatrizViaria = { origem: 'fixture-testada', obter: (a, b) => ({ minutos: Math.abs(X[a.id] - X[b.id]), metros: 500 * Math.abs(X[a.id] - X[b.id]) }) };
  const emb = (al: string, onde: string): motor.Compromisso => ({ id: 'e' + al, ponto: pt(onde), tipo: 'embarque', alunoId: al, atendimentoMin: 1 });
  const des = (al: string): motor.Compromisso => ({ id: 'd' + al, ponto: pt('S1'), tipo: 'desembarque', alunoId: al, limiteEscolaMin: 420, atendimentoMin: 0 });
  // Ordem ruim: C, A, B, escola = 12+8+4+8 = 32 min de direção (+3 de embarque). Partida 06:25 chega 07:00.
  const rota: motor.RotaOperacional = { id: 'r', versao: 1, sentido: 'ida', inicio: pt('G'), partidaMin: 385, capacidade: 3, ocupacaoInicial: 0, toleranciaMin: 10,
    compromissos: [emb('c', 'C'), emb('a', 'A'), emb('b', 'B'), des('c'), des('a'), des('b')] };

  it('com horários livres acha a ordem ótima, mais curta, sem perder a escola', () => {
    const original = JSON.stringify(rota);
    const s = sugerirRotaMelhor(rota, mz, { toleranciaMin: null });
    expect(s.melhorou).toBe(true);
    expect(s.provadoOtimo).toBe(true);
    expect(s.compromissos.slice(0, 3).map((c) => c.id)).toEqual(['ea', 'eb', 'ec']);
    expect(s.antes.duracaoMin).toBe(35);
    expect(s.depois.duracaoMin).toBe(19);
    expect(s.economiaMin).toBe(16);
    expect(s.plano.valido).toBe(true);
    expect(s.plano.eventos.at(-1)!.chegadaMin).toBeLessThanOrEqual(420);
    expect(JSON.stringify(rota)).toBe(original); // nunca altera a rota cadastrada
  });
  it('preservando os horários combinados (±10 min) não propõe o que quebraria o combinado', () => {
    const s = sugerirRotaMelhor(rota, mz);
    for (const a of s.alteracoes) expect(Math.abs(a.diferencaMin)).toBeLessThanOrEqual(10);
    expect(s.depois.duracaoMin).toBeLessThanOrEqual(s.antes.duracaoMin);
  });
  it('rota já ótima: não inventa sugestão; capacidade nunca é violada', () => {
    const boa = { ...rota, partidaMin: 401, capacidade: 3, compromissos: [emb('a', 'A'), emb('b', 'B'), emb('c', 'C'), des('a'), des('b'), des('c')] };
    const s = sugerirRotaMelhor(boa, mz, { toleranciaMin: null });
    expect(s.melhorou).toBe(false);
    expect(s.provadoOtimo).toBe(true);
  });
  it('rota grande (10 paradas) usa busca local e nunca piora', () => {
    const Y: Record<string, number> = { G: 0, S1: 40 };
    const casas = [30, 5, 25, 10, 35, 15, 20, 2, 28];
    casas.forEach((x, i) => { Y['H' + i] = x; });
    const p = (n: string) => ({ id: n, nome: n, lat: 0, lng: Y[n] / 1000 });
    const m2: motor.MatrizViaria = { origem: 'fixture-testada', obter: (a, b) => ({ minutos: Math.abs(Y[a.id] - Y[b.id]), metros: 500 * Math.abs(Y[a.id] - Y[b.id]) }) };
    const grande: motor.RotaOperacional = { id: 'g', versao: 1, sentido: 'ida', inicio: p('G'), partidaMin: 200, capacidade: 12, ocupacaoInicial: 0,
      compromissos: [...casas.map((_, i): motor.Compromisso => ({ id: 'e' + i, ponto: p('H' + i), tipo: 'embarque', alunoId: 'x' + i, atendimentoMin: 1 })),
        ...casas.map((_, i): motor.Compromisso => ({ id: 'd' + i, ponto: p('S1'), tipo: 'desembarque', alunoId: 'x' + i, limiteEscolaMin: 420, atendimentoMin: 0 }))] };
    const s = sugerirRotaMelhor(grande, m2, { toleranciaMin: null });
    expect(s.melhorou).toBe(true);
    expect(s.depois.duracaoMin).toBe(49); // 40 de direção em linha + 9 embarques = ótimo
    expect(s.plano.valido).toBe(true);
  });
});
