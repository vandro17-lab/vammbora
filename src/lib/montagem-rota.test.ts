import { describe, it, expect } from 'vitest';
import { embarcarAluno, desembarcarAlunos } from './montagem-rota';
import { ocupacaoPorTrecho, validarRota, podeFinalizar, aBordoEm } from './ocupacao-rota';
import type { Rota, Veiculo, ParadaRota } from '@/types/motorista';

const veiculo: Veiculo = {
  id: 'v1', modelo: 'Kombi', lugaresPassageiro: 4,
  arCondicionado: false, acessivel: false, cintos: true, fotos: [],
};

function rotaVazia(sentido: Rota['sentido']): Rota {
  return {
    id: 'r', nome: '', sentido, turno: 'manha', dias: ['seg'], veiculoId: 'v1',
    monitor: false, monitorOcupaLugar: false, lugaresReservados: 0,
    ultimoDesembarqueMin: null, limiteAntecipacaoMin: null, status: 'rascunho',
    paradas: [], passageiros: [], atualizadoEm: '2026-11-06T00:00:00.000Z',
  };
}

function addParada(rota: Rota, p: Omit<ParadaRota, 'ordem'>): Rota {
  return { ...rota, paradas: [...rota.paradas, { ...p, ordem: rota.paradas.length }] };
}

describe('montagem-rota — IDA (casa embarca, escola desembarca)', () => {
  it('monta uma rota de ida válida com ocupação por trecho correta', () => {
    let r = rotaVazia('ida');
    r = addParada(r, { id: 'saida', tipo: 'saida', rotulo: 'Garagem', confirmado: true });
    r = addParada(r, { id: 'casaA', tipo: 'casa', rotulo: 'Casa A', confirmado: true, horarioChegadaMin: 6 * 60 + 30 });
    r = embarcarAluno(r, 'casaA', 'Ana');
    r = addParada(r, { id: 'casaB', tipo: 'casa', rotulo: 'Casa B', confirmado: true });
    r = embarcarAluno(r, 'casaB', 'Bia');
    r = addParada(r, { id: 'esc', tipo: 'escola', rotulo: 'Escola', confirmado: true, destinoId: 'd1', destinoNome: 'Escola' });
    const ids = r.passageiros.map((p) => p.id);
    r = desembarcarAlunos(r, 'esc', ids);

    // saída:0, casaA:1, casaB:2, escola:0 (todos descem)
    expect(ocupacaoPorTrecho(r).map((o) => o.ocupacao)).toEqual([0, 1, 2, 0]);
    expect(podeFinalizar(r, veiculo)).toBe(true);
    // Embarque na casa; herda o horário habitual da parada; destino fixado na escola.
    const ana = r.passageiros.find((p) => p.identificacao === 'Ana')!;
    expect(ana.embarqueParadaId).toBe('casaA');
    expect(ana.desembarqueParadaId).toBe('esc');
    expect(ana.horarioHabitualMin).toBe(6 * 60 + 30);
    expect(ana.destinoId).toBe('d1');
  });
});

describe('montagem-rota — VOLTA (escola embarca, casa desembarca)', () => {
  it('monta uma rota de volta válida: alunos embarcam na escola e descem em casa', () => {
    let r = rotaVazia('volta');
    r = addParada(r, { id: 'saida', tipo: 'saida', rotulo: 'Garagem', confirmado: true });
    r = addParada(r, { id: 'esc', tipo: 'escola', rotulo: 'Escola', confirmado: true, destinoId: 'd1', destinoNome: 'Escola' });
    r = embarcarAluno(r, 'esc', 'Ana');
    r = embarcarAluno(r, 'esc', 'Bia');
    // Casa 1 deixa a Ana; casa 2 deixa a Bia.
    r = addParada(r, { id: 'casaA', tipo: 'casa', rotulo: 'Casa A', confirmado: true });
    const ana = r.passageiros.find((p) => p.identificacao === 'Ana')!;
    r = desembarcarAlunos(r, 'casaA', [ana.id]);
    r = addParada(r, { id: 'casaB', tipo: 'casa', rotulo: 'Casa B', confirmado: true });
    const bia = r.passageiros.find((p) => p.identificacao === 'Bia')!;
    r = desembarcarAlunos(r, 'casaB', [bia.id]);

    // saída:0, escola:2 (ambos sobem), casaA:1 (Ana desce), casaB:0
    expect(ocupacaoPorTrecho(r).map((o) => o.ocupacao)).toEqual([0, 2, 1, 0]);
    expect(podeFinalizar(r, veiculo)).toBe(true);

    const anaFinal = r.passageiros.find((p) => p.identificacao === 'Ana')!;
    expect(anaFinal.embarqueParadaId).toBe('esc'); // embarca na escola (volta)
    expect(anaFinal.desembarqueParadaId).toBe('casaA'); // desce em casa
    expect(anaFinal.destinoId).toBe('d1'); // escola de origem fica como destino

    // Depois da escola, os dois estão a bordo; depois da casa A, só a Bia.
    expect(aBordoEm(r, 1).map((p) => p.identificacao).sort()).toEqual(['Ana', 'Bia']);
    expect(aBordoEm(r, 2).map((p) => p.identificacao)).toEqual(['Bia']);
  });

  it('não confunde a lógica de ida: na volta um aluno sem casa fica "a bordo" e bloqueia finalizar', () => {
    let r = rotaVazia('volta');
    r = addParada(r, { id: 'saida', tipo: 'saida', rotulo: 'Garagem', confirmado: true });
    r = addParada(r, { id: 'esc', tipo: 'escola', rotulo: 'Escola', confirmado: true, destinoId: 'd1' });
    r = embarcarAluno(r, 'esc', 'Ana');
    // Ainda não deixou a Ana em casa.
    expect(validarRota(r, veiculo).some((p) => p.tipo === 'a_bordo')).toBe(true);
    expect(podeFinalizar(r, veiculo)).toBe(false);
  });

  it('herda o horário habitual da casa de desembarque quando o aluno ainda não tem um (volta)', () => {
    let r = rotaVazia('volta');
    r = addParada(r, { id: 'esc', tipo: 'escola', rotulo: 'Escola', confirmado: true, destinoId: 'd1' });
    r = embarcarAluno(r, 'esc', 'Ana');
    r = addParada(r, { id: 'casaA', tipo: 'casa', rotulo: 'Casa A', confirmado: true, horarioChegadaMin: 12 * 60 });
    const ana = r.passageiros[0];
    r = desembarcarAlunos(r, 'casaA', [ana.id]);
    expect(r.passageiros[0].horarioHabitualMin).toBe(12 * 60);
  });
});

describe('montagem-rota — invariantes', () => {
  it('embarcar com nome vazio não altera a rota', () => {
    const r = addParada(rotaVazia('ida'), { id: 'casaA', tipo: 'casa', rotulo: 'A', confirmado: true });
    expect(embarcarAluno(r, 'casaA', '   ').passageiros).toHaveLength(0);
  });
  it('desembarcar sem ids não altera a rota', () => {
    let r = addParada(rotaVazia('ida'), { id: 'casaA', tipo: 'casa', rotulo: 'A', confirmado: true });
    r = embarcarAluno(r, 'casaA', 'Ana');
    expect(desembarcarAlunos(r, 'esc', [])).toBe(r);
  });
});
