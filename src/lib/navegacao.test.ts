import { describe, it, expect } from 'vitest';
import { falaManobra, montarGuia, pontoEm, projetarNaRota, proximaManobra, recorte, segundosAteFimDaPerna, setaDaManobra, textoDistancia, textoDuracao, textoManobra, metros, type RotaOSRM } from './navegacao';

// 0,001° de longitude em -21,2 ≈ 104 m; de latitude ≈ 111 m.
const LAT = -21.2, LNG = -50.44;
const passo = (tipo: string, modificador: string, name: string, coords: [number, number][], exit?: number) =>
  ({ name, maneuver: { type: tipo, modifier: modificador, exit }, geometry: { coordinates: coords } });
// Perna 1: leste por 3 trechos de ~104 m, vira à direita (sul) e anda ~111 m até a casa.
// Perna 2: segue ao sul ~222 m até a escola.
const ROTA: RotaOSRM = { legs: [
  { duration: 120, steps: [
    passo('depart', '', 'Rua A', [[LNG, LAT], [LNG + 0.001, LAT], [LNG + 0.002, LAT], [LNG + 0.003, LAT]]),
    passo('new name', 'straight', 'Rua A2', [[LNG + 0.003, LAT], [LNG + 0.003, LAT]]),
    passo('turn', 'right', 'Rua B', [[LNG + 0.003, LAT], [LNG + 0.003, LAT - 0.001]]),
    passo('arrive', '', 'Rua B', [[LNG + 0.003, LAT - 0.001]]),
  ] },
  { duration: 60, steps: [
    passo('depart', '', 'Rua B', [[LNG + 0.003, LAT - 0.001], [LNG + 0.003, LAT - 0.003]]),
    passo('arrive', '', 'Rua B', [[LNG + 0.003, LAT - 0.003]]),
  ] },
] };

describe('guia de navegação', () => {
  const guia = montarGuia(ROTA)!;
  it('junta a linha sem pontos repetidos e marca o fim de cada perna', () => {
    expect(guia.geometria).toHaveLength(6);
    expect(guia.pernas).toHaveLength(2);
    expect(guia.pernas[0].fimM).toBeCloseTo(3 * metros([LAT, LNG], [LAT, LNG + 0.001]) + metros([LAT, LNG], [LAT - 0.001, LNG]), 3);
    expect(guia.pernas[1].inicioM).toBe(guia.pernas[0].fimM);
    expect(guia.totalM).toBeCloseTo(guia.pernas[1].fimM, 6);
  });
  it('descarta manobras sem ação (troca de nome) e posiciona as demais ao longo da linha', () => {
    expect(guia.manobras.map((m) => m.tipo)).toEqual(['depart', 'turn', 'arrive', 'depart', 'arrive']);
    expect(guia.manobras[1].metros).toBeCloseTo(guia.acumulado[3], 6);
  });
  it('rota vazia ou sem geometria não vira guia', () => {
    expect(montarGuia(null)).toBeNull();
    expect(montarGuia({ legs: [{ steps: [] }] })).toBeNull();
  });
  it('encaixa a posição do GPS, mede o desvio e acha a próxima manobra', () => {
    const pos = projetarNaRota(guia, [LAT + 0.0001, LNG + 0.001]); // ~11 m ao norte da Rua A
    expect(pos.metros).toBeCloseTo(guia.acumulado[1], 0);
    expect(pos.desvioM).toBeGreaterThan(9); expect(pos.desvioM).toBeLessThan(13);
    expect(pos.rumo).toBeCloseTo(90, 0);
    const prox = proximaManobra(guia, pos.metros, 0)!;
    expect(prox.manobra.tipo).toBe('turn');
    expect(prox.distanciaM).toBeCloseTo(guia.acumulado[3] - guia.acumulado[1], 0);
    expect(proximaManobra(guia, guia.acumulado[3] + 20, 0)!.manobra.tipo).toBe('arrive');
    expect(proximaManobra(guia, guia.pernas[0].fimM, 0)).toBeNull();
  });
  it('fora da rota: desvio grande é informado', () => {
    expect(projetarNaRota(guia, [LAT + 0.002, LNG + 0.001], 100).desvioM).toBeGreaterThan(200);
  });
  it('rua percorrida duas vezes: a van não pula para a outra passagem', () => {
    // Vai 200 m a leste e volta pela mesma rua.
    const vaiEVolta = montarGuia({ legs: [{ duration: 60, steps: [
      passo('depart', '', 'Rua A', [[LNG, LAT], [LNG + 0.002, LAT]]),
      passo('turn', 'uturn', 'Rua A', [[LNG + 0.002, LAT], [LNG, LAT]]),
      passo('arrive', '', 'Rua A', [[LNG, LAT]]),
    ] }] })!;
    const meio: [number, number] = [LAT, LNG + 0.001];
    expect(projetarNaRota(vaiEVolta, meio, 50).metros).toBeCloseTo(vaiEVolta.totalM / 4, 0);
    expect(projetarNaRota(vaiEVolta, meio, vaiEVolta.totalM * 0.7).metros).toBeCloseTo(vaiEVolta.totalM * 0.75, 0);
  });
  it('ponto, recorte e tempo restante ao longo da linha', () => {
    expect(pontoEm(guia, 0).ponto).toEqual([LAT, LNG]);
    expect(pontoEm(guia, guia.totalM + 50).ponto[0]).toBeCloseTo(LAT - 0.003, 6);
    expect(pontoEm(guia, guia.acumulado[3] + 10).rumo).toBeCloseTo(180, 0);
    const linha = recorte(guia, 50, guia.acumulado[2] + 10);
    expect(linha).toHaveLength(4);
    expect(recorte(guia, 100, 100)).toEqual([]);
    expect(segundosAteFimDaPerna(guia, 0, guia.pernas[0].fimM / 2)).toBeCloseTo(60, 3);
    expect(segundosAteFimDaPerna(guia, 1, guia.totalM)).toBe(0);
  });
});

describe('instruções em português', () => {
  const m = (tipo: string, modificador: string, rua = 'Rua Santo André', saida?: number) => ({ tipo, modificador, rua, saida, metros: 0, perna: 0 });
  it('texto e seta de cada manobra', () => {
    expect(textoManobra(m('turn', 'right'))).toBe('Vire à direita na Rua Santo André');
    expect(textoManobra(m('end of road', 'left', ''))).toBe('Vire à esquerda');
    expect(textoManobra(m('fork', 'slight right', 'Avenida Brasília'))).toBe('Mantenha-se à direita na Avenida Brasília');
    expect(textoManobra(m('turn', 'uturn', ''))).toBe('Faça o retorno');
    expect(textoManobra(m('roundabout', 'right', 'Avenida Brasília', 2))).toBe('Na rotatória, pegue a segunda saída para a Avenida Brasília');
    expect(textoManobra(m('depart', '', 'Viaduto Central'))).toBe('Siga pelo Viaduto Central');
    expect(setaDaManobra(m('turn', 'sharp left'))).toBe('esquerda');
    expect(setaDaManobra(m('rotary', 'left'))).toBe('rotatoria');
    expect(setaDaManobra(m('arrive', ''))).toBe('chegada');
    expect(setaDaManobra(m('merge', 'straight'))).toBe('frente');
  });
  it('distância, duração e fala', () => {
    expect(textoDistancia(4)).toBe('10 m');
    expect(textoDistancia(187)).toBe('190 m');
    expect(textoDistancia(1240)).toBe('1,2 km');
    expect(textoDuracao(20)).toBe('1 min');
    expect(textoDuracao(3900)).toBe('1 h 05');
    expect(falaManobra(m('turn', 'right'), 230)).toBe('Em 250 metros, vire à direita na Rua Santo André');
    expect(falaManobra(m('turn', 'left', ''), 20)).toBe('Vire à esquerda');
    expect(falaManobra(m('turn', 'left', ''), 1500)).toBe('Em 1 vírgula 5 quilômetros, vire à esquerda');
    expect(falaManobra(m('arrive', ''), 200, 'casa de Duda')).toBe('Em 200 metros, você chega em casa de Duda');
    expect(falaManobra(m('arrive', ''), 10, 'casa de Duda')).toBe('Você chegou: casa de Duda');
  });
});
