import { describe, it, expect } from 'vitest';
import {
  capacidadeAlunos,
  ocupacaoPorTrecho,
  picoOcupacao,
  aBordoEm,
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
  it('mostra quem está a bordo numa escola (ambos no ponto da escola)', () => {
    const a = aBordoEm(rotaBase(), 3);
    expect(a.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
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
