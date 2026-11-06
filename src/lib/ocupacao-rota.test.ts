import { describe, it, expect } from 'vitest';
import {
  capacidadeAlunos,
  ocupacaoPorTrecho,
  picoOcupacao,
  aBordoEm,
  estadoDaVanPorTrecho,
  validarRota,
  podeFinalizar,
} from './ocupacao-rota';
import type { Rota, Veiculo } from '@/types/motorista';

const veiculo: Veiculo = {
  id: 'v1',
  modelo: 'Sprinter',
  lugaresPassageiro: 15,
  arCondicionado: true,
  acessivel: false,
  cintos: true,
  fotos: [],
};

function rotaBase(): Rota {
  // saída(0) -> casa A(1) -> casa B(2) -> escola(3)
  return {
    id: 'r1',
    nome: 'Rota teste',
    sentido: 'ida',
    turno: 'manha',
    dias: ['seg'],
    veiculoId: 'v1',
    monitor: false,
    monitorOcupaLugar: false,
    lugaresReservados: 0,
    ultimoDesembarqueMin: null,
    limiteAntecipacaoMin: null,
    status: 'rascunho',
    atualizadoEm: '2026-11-04T00:00:00.000Z',
    paradas: [
      { id: 's', ordem: 0, tipo: 'saida', rotulo: 'Garagem', confirmado: true },
      { id: 'a', ordem: 1, tipo: 'casa', rotulo: 'Casa A', confirmado: true },
      { id: 'b', ordem: 2, tipo: 'casa', rotulo: 'Casa B', confirmado: true },
      { id: 'e', ordem: 3, tipo: 'escola', rotulo: 'Escola', confirmado: true, destinoId: 'esc1', destinoNome: 'Escola' },
    ],
    passageiros: [
      { id: 'p1', identificacao: 'João', embarqueParadaId: 'a', desembarqueParadaId: 'e', destinoId: 'esc1' },
      { id: 'p2', identificacao: 'João', embarqueParadaId: 'b', desembarqueParadaId: 'e', destinoId: 'esc1' },
    ],
  };
}

describe('capacidadeAlunos', () => {
  it('desconta monitor que ocupa lugar e lugares reservados', () => {
    const r = { ...rotaBase(), monitor: true, monitorOcupaLugar: true, lugaresReservados: 1 };
    expect(capacidadeAlunos(r, veiculo)).toBe(13); // 15 - 1 (monitor) - 1 (reservado)
  });
  it('monitor que NÃO ocupa lugar não desconta', () => {
    const r = { ...rotaBase(), monitor: true, monitorOcupaLugar: false };
    expect(capacidadeAlunos(r, veiculo)).toBe(15);
  });
  it('sem veículo, capacidade 0', () => {
    expect(capacidadeAlunos(rotaBase(), null)).toBe(0);
  });
});

describe('ocupacaoPorTrecho', () => {
  it('conta do embarque (inclusive) ao desembarque (exclusive)', () => {
    const occ = ocupacaoPorTrecho(rotaBase());
    // saída:0, casa A:1 (João1 embarcou), casa B:2 (João1+João2), escola:3 (ambos descem -> 0)
    expect(occ.map((o) => o.ocupacao)).toEqual([0, 1, 2, 0]);
  });
  it('pico de ocupação é 2', () => {
    expect(picoOcupacao(rotaBase())).toBe(2);
  });
  it('desembarque parcial libera lugares depois', () => {
    const r = rotaBase();
    // adiciona 2ª escola e move João2 para descer lá
    r.paradas.push({ id: 'e2', ordem: 4, tipo: 'escola', rotulo: 'Escola 2', confirmado: true, destinoId: 'esc2', destinoNome: 'Escola 2' });
    r.passageiros[1].desembarqueParadaId = 'e2';
    const occ = ocupacaoPorTrecho(r);
    // ...escola1(3): João2 ainda a bordo -> 1 ; escola2(4): 0
    expect(occ.find((o) => o.ordem === 3)?.ocupacao).toBe(1);
    expect(occ.find((o) => o.ordem === 4)?.ocupacao).toBe(0);
  });
});

describe('aBordoEm', () => {
  it('desembarque na escola libera assentos no trecho seguinte', () => {
    expect(aBordoEm(rotaBase(), 2).map((p) => p.id).sort()).toEqual(['p1', 'p2']);
    expect(aBordoEm(rotaBase(), 3)).toEqual([]);
  });
});

describe('validarRota / podeFinalizar', () => {
  it('rota válida pode finalizar', () => {
    expect(podeFinalizar(rotaBase(), veiculo)).toBe(true);
  });
  it('bloqueia quando há aluno sem desembarque (ainda a bordo)', () => {
    const r = rotaBase();
    r.passageiros[0].desembarqueParadaId = null;
    const probs = validarRota(r, veiculo);
    expect(probs.some((p) => p.tipo === 'a_bordo')).toBe(true);
    expect(podeFinalizar(r, veiculo)).toBe(false);
  });
  it('detecta capacidade excedida no trecho', () => {
    const r = rotaBase();
    const vPequeno = { ...veiculo, lugaresPassageiro: 1 };
    expect(validarRota(r, vPequeno).some((p) => p.tipo === 'capacidade')).toBe(true);
  });
  it('detecta desembarque antes do embarque', () => {
    const r = rotaBase();
    r.passageiros[0].desembarqueParadaId = 's'; // ordem 0, antes do embarque (1)
    expect(validarRota(r, veiculo).some((p) => p.tipo === 'desembarque_antes')).toBe(true);
  });
  it('dois alunos com mesmo nome têm ids distintos', () => {
    const r = rotaBase();
    expect(r.passageiros[0].identificacao).toBe(r.passageiros[1].identificacao);
    expect(r.passageiros[0].id).not.toBe(r.passageiros[1].id);
  });
});

describe('estadoDaVanPorTrecho', () => {
  it('mantém nomes e vagas sincronizados com a ocupação após cada parada', () => {
    const r = rotaBase();
    const estados = estadoDaVanPorTrecho(r, veiculo);
    expect(estados.map((e) => e.ocupados)).toEqual([0, 1, 2, 0]);
    expect(estados.map((e) => e.livres)).toEqual([15, 14, 13, 15]);
    expect(estados[2].passageiros.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(estados[3].passageiros).toEqual([]);
  });

  it('reaproveita vagas após escola para embarque posterior', () => {
    const r = rotaBase();
    r.paradas.push({ id: 'c', ordem: 4, tipo: 'casa', rotulo: 'Casa C', confirmado: true });
    r.paradas.push({ id: 'e2', ordem: 5, tipo: 'escola', rotulo: 'Escola 2', confirmado: true, destinoId: 'esc2' });
    r.passageiros.push({ id: 'p3', identificacao: 'Maria', embarqueParadaId: 'c', desembarqueParadaId: 'e2', destinoId: 'esc2' });
    const estados = estadoDaVanPorTrecho(r, veiculo);
    expect(estados.map((e) => e.ocupados)).toEqual([0, 1, 2, 0, 1, 0]);
    expect(estados[4].passageiros.map((p) => p.identificacao)).toEqual(['Maria']);
    expect(estados[4].livres).toBe(14);
  });

  it('considera monitor e assentos reservados sem oferecer lugares inexistentes', () => {
    const r = { ...rotaBase(), monitor: true, monitorOcupaLugar: true, lugaresReservados: 2 };
    expect(estadoDaVanPorTrecho(r, veiculo).map((e) => e.livres)).toEqual([12, 11, 10, 12]);
  });
});
