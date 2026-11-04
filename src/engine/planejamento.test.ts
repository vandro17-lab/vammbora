import { describe, expect, it } from 'vitest';
import { avaliarRotaCandidata, planejarRota, type RotaPlanejamento } from './planejamento';
const rota = (): RotaPlanejamento => ({
  capacidadePassageiros: 3, assentosReservados: 1,
  saidaPermitida: { inicio: 300, fim: 430 }, chegadaFinalAte: 420, limiteABordoMin: 60,
  temposTrechosMin: [10, 10, 10, 10],
  paradas: [
    { id: 'casa1', embarques: ['a', 'b'], desembarques: [], atendimentoMin: 2 },
    { id: 'escola1', embarques: [], desembarques: ['a'], atendimentoMin: 1 },
    { id: 'casa2', embarques: ['c'], desembarques: [], atendimentoMin: 1 },
    { id: 'escola2', embarques: [], desembarques: ['b', 'c'], atendimentoMin: 0 },
  ],
});
describe('planejamento visual independente', () => {
  it('calcula de trás para frente e libera assento apenas após desembarque', () => {
    const p = planejarRota(rota());
    expect(p.valido).toBe(true);
    expect(p.saida).toBe(376);
    expect(p.paradas.map(x => x.chegada)).toEqual([386, 398, 409, 420]);
    expect(p.trechos.map(x => x.livres)).toEqual([2, 0, 1, 0]);
    expect(p.trechos.map(x => x.ocupados)).toEqual([1, 3, 2, 3]);
    expect(p.passageiros).toEqual([{ id: 'a', tempoABordoMin: 12 }, { id: 'b', tempoABordoMin: 34 }, { id: 'c', tempoABordoMin: 11 }]);
  });
  it('considera escola intermediária, não apenas a última', () => {
    const r = rota(); r.paradas[1].janela = { inicio: 380, fim: 390 };
    expect(planejarRota(r).saida).toBe(368);
    expect(planejarRota(r).paradas[3].chegada).toBe(412);
  });
  it('não antecipa uma família além da janela para atender outra escola', () => {
    const r = rota(); r.paradas[0].janela = { inicio: 386, fim: 390 }; r.paradas[1].janela = { inicio: 380, fim: 390 };
    expect(planejarRota(r).valido).toBe(false);
  });
  it('conta o monitor uma única vez e também funciona sem monitor', () => {
    const r = rota(); r.assentosReservados = 0;
    expect(planejarRota(r).trechos.map(t => t.livres)).toEqual([3, 1, 2, 1]);
  });
  it('bloqueia excesso antes da escola mesmo havendo vaga depois', () => {
    const r = rota(); r.capacidadePassageiros = 2;
    expect(planejarRota(r).erros).toContain('Capacidade excedida após casa1');
  });
  it('aceita desembarque e novo embarque no mesmo ponto', () => {
    const r = rota(); r.paradas[1].embarques = ['c']; r.paradas[2].embarques = [];
    expect(planejarRota(r).valido).toBe(true);
    expect(planejarRota(r).trechos[2].livres).toBe(0);
  });
  it('não conclui com aluno a bordo', () => {
    const r = rota(); r.paradas[3].desembarques = ['b'];
    expect(planejarRota(r).erros).toContain('Passageiros sem desembarque');
  });
  it('não conclui sem passageiros', () => {
    const r = rota(); r.paradas.forEach(p => { p.embarques = []; p.desembarques = []; });
    expect(planejarRota(r).valido).toBe(false);
  });
  it('detecta reordenação que desembarca antes de embarcar', () => {
    const r = rota(); [r.paradas[0], r.paradas[1]] = [r.paradas[1], r.paradas[0]];
    expect(planejarRota(r).valido).toBe(false);
  });
  it('não permite reutilizar id de passageiro após ele descer', () => {
    const r = rota(); r.paradas[2].embarques = ['a']; r.paradas[3].desembarques = ['b', 'a'];
    expect(planejarRota(r).valido).toBe(false);
  });
  it('valida limite a bordo de TODOS os passageiros', () => {
    const r = rota(); r.limiteABordoMin = 20;
    expect(planejarRota(r).erros).toContain('Tempo a bordo excedido: b');
  });
  it('limite desconhecido gera alerta sem inventar 60 minutos', () => {
    const r = rota(); r.limiteABordoMin = null;
    expect(planejarRota(r).alertas).toHaveLength(1);
  });
  it('aceita o limite exato de tempo a bordo', () => {
    const r = rota(); r.limiteABordoMin = 34;
    expect(planejarRota(r).valido).toBe(true);
  });
  it('serve também para volta, sem inferir função pela casa/escola', () => {
    const r = rota(); r.paradas[0].id = 'escola-origem'; r.paradas[3].id = 'ultima-casa';
    expect(planejarRota(r).valido).toBe(true);
  });
  it.each([null, {}, { paradas: [null] }])('rejeita entrada não tipada sem lançar exceção: %j', input => {
    expect(planejarRota(input as unknown as RotaPlanejamento).valido).toBe(false);
  });
  it.each([NaN, Infinity, -1])('rejeita tempo inválido %s', tempo => {
    const r = rota(); r.temposTrechosMin[0] = tempo;
    expect(planejarRota(r).valido).toBe(false);
  });
  it('não aceita trecho ausente', () => { const r = rota(); r.temposTrechosMin.pop(); expect(planejarRota(r).valido).toBe(false); });
  it('não cruza meia-noite implicitamente', () => { const r = rota(); r.chegadaFinalAte = 20; expect(planejarRota(r).valido).toBe(false); });
  it('rejeita assentos fracionários ou reservas acima da capacidade', () => {
    for (const x of [0.5, 4, -1]) { const r = rota(); r.assentosReservados = x; expect(planejarRota(r).valido).toBe(false); }
  });
  it('rejeita paradas repetidas e passageiros repetidos no mesmo embarque', () => {
    const r = rota(); r.paradas[1].id = 'casa1'; expect(planejarRota(r).valido).toBe(false);
    const s = rota(); s.paradas[0].embarques.push('a'); expect(planejarRota(s).valido).toBe(false);
  });
  it('não modifica os dados recebidos', () => { const r = rota(); const copy = JSON.stringify(r); planejarRota(r); expect(JSON.stringify(r)).toBe(copy); });
});
const baseSimples = (): RotaPlanejamento => ({
  capacidadePassageiros: 2, assentosReservados: 0, temposTrechosMin: [10, 10],
  saidaPermitida: { inicio: 300, fim: 420 }, chegadaFinalAte: 420, limiteABordoMin: 60,
  paradas: [
    { id: 'casa', embarques: ['a'], desembarques: [], atendimentoMin: 0 },
    { id: 'escola', embarques: [], desembarques: ['a'], atendimentoMin: 0 },
  ],
});
function candidata() {
  const r = baseSimples();
  r.paradas.unshift({ id: 'nova-casa', embarques: ['novo'], desembarques: [], atendimentoMin: 0 });
  r.paradas[2].desembarques.push('novo'); r.temposTrechosMin = [5, 10, 10];
  return r;
}
describe('candidata com antecipação limitada', () => {
  it('sai 5 minutos antes e preserva as chegadas originais', () => {
    const p = avaliarRotaCandidata(baseSimples(), candidata(), 5);
    expect(p.compativel).toBe(true); expect(p.antecipacaoMin).toBe(5);
    expect(p.plano.paradas.map(x => x.chegada)).toEqual([400, 410, 420]);
  });
  it('não extrapola o limite de antecipação', () => { expect(avaliarRotaCandidata(baseSimples(), candidata(), 4).compativel).toBe(false); });
  it('sair cedo não resolve desvio entre duas paradas com horários fixos', () => {
    const c = candidata(); c.temposTrechosMin = [5, 10, 15];
    expect(avaliarRotaCandidata(baseSimples(), c, 20).compativel).toBe(false);
  });
  it('usa janelas originais sem substituir pela janela mais larga da candidata', () => {
    const c = candidata(); c.temposTrechosMin = [5, 10, 15]; c.paradas.forEach(p => { p.janela = { inicio: 300, fim: 430 }; });
    expect(avaliarRotaCandidata(baseSimples(), c, 20).compativel).toBe(false);
  });
  it('permite horários dentro da janela contratada explícita', () => {
    const b = baseSimples(); b.paradas[0].janela = { inicio: 405, fim: 410 };
    const c = candidata(); c.temposTrechosMin = [5, 10, 15];
    expect(avaliarRotaCandidata(b, c, 10).compativel).toBe(true);
  });
  it('não permite remover passageiro existente para abrir vaga', () => {
    const c = candidata(); c.paradas[1].embarques = []; c.paradas[2].desembarques = ['novo'];
    expect(avaliarRotaCandidata(baseSimples(), c, 20).compativel).toBe(false);
  });
  it('não permite aumentar a capacidade ou remover monitor na candidata', () => {
    const c = candidata(); c.capacidadePassageiros = 3;
    expect(avaliarRotaCandidata(baseSimples(), c, 20).compativel).toBe(false);
  });
  it('não relaxa o limite de tempo a bordo', () => {
    const b = baseSimples(); b.limiteABordoMin = 10;
    expect(avaliarRotaCandidata(b, candidata(), 20).compativel).toBe(false);
  });
  it('limite pendente não vira disponibilidade confirmada', () => {
    const b = baseSimples(); b.limiteABordoMin = null;
    expect(avaliarRotaCandidata(b, candidata(), 20).nivel).toBe('sob_consulta');
  });
  it('revalida capacidade da candidata', () => {
    const b = baseSimples(); b.capacidadePassageiros = 1; const c = candidata(); c.capacidadePassageiros = 1;
    expect(avaliarRotaCandidata(b, c, 20).compativel).toBe(false);
  });
  it('não altera dados originais ao avaliar', () => {
    const b = baseSimples(), c = candidata(); const before = JSON.stringify([b,c]);
    avaliarRotaCandidata(b,c,10); expect(JSON.stringify([b,c])).toBe(before);
  });
});
