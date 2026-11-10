import { describe, it, expect } from 'vitest';
import { sugerirRotaDoCadastro } from './otimizacao-rota';
import type { MatrizViaria } from '@/engine/encaixe-geografico';
import type { Rota, Veiculo, ParadaRota } from '@/types/motorista';

// Linha: saída 0 … casas cadastradas fora de ordem (c=12, a=4, b=8) … escola 16.
const X: Record<string, number> = { s: 0, a: 4, b: 8, c: 12, esc: 16 };
const matriz: MatrizViaria = { origem: 'fixture-testada', obter: (p, q) => ({ minutos: Math.abs(X[p.id] - X[q.id]), metros: 500 * Math.abs(X[p.id] - X[q.id]) }) };
const parada = (id: string, tipo: ParadaRota['tipo'], ordem: number, extra: Partial<ParadaRota> = {}): ParadaRota =>
  ({ id, ordem, tipo, rotulo: 'Parada ' + id, lat: -21.2, lng: -50.4 - X[id === 'e' ? 'esc' : id] / 1000, confirmado: true, ...extra });
const rota = (): Rota => ({
  id: 'r', nome: 'Ida', sentido: 'ida', turno: 'manha', dias: [], veiculoId: 'v', monitor: false, monitorOcupaLugar: false, lugaresReservados: 0,
  ultimoDesembarqueMin: 420, limiteAntecipacaoMin: null, status: 'concluida', atualizadoEm: '',
  paradas: [parada('s', 'saida', 0), parada('c', 'casa', 1), parada('a', 'casa', 2), parada('b', 'casa', 3), parada('e', 'escola', 4, { destinoId: 'esc', destinoNome: 'Escola' })],
  passageiros: ['c', 'a', 'b'].map((k) => ({ id: 'p' + k, identificacao: 'Aluno ' + k, embarqueParadaId: k, desembarqueParadaId: 'e' })),
});
const van: Veiculo = { id: 'v', modelo: 'Van', lugaresPassageiro: 3, arCondicionado: false, acessivel: false, cintos: true, fotos: [] };

describe('sugerirRotaDoCadastro — sugestão para o motorista', () => {
  it('propõe ordem mais curta dentro do combinado (±10 min) e não altera a rota', () => {
    const r = rota();
    const antes = JSON.stringify(r);
    const s = sugerirRotaDoCadastro(r, van, matriz);
    expect(s.sugestao?.melhorou).toBe(true);
    expect(s.exigeCombinarHorarios).toBe(false); // a: −10, b: −10, c: +9 — tudo dentro da tolerância
    expect(s.alunosComHorarioAlterado).toBe(3);
    expect(s.maiorMudancaMin).toBe(10);
    expect(s.paradas.map((p) => p.nome)).toEqual(['Parada a', 'Parada b', 'Parada c', 'Escola']);
    expect(s.sugestao!.economiaMin).toBe(16);
    expect(s.paradas.at(-1)!.chegadaMin).toBeLessThanOrEqual(415); // escola: limite 07:00 − margem de 5 min
    expect(s.paradas.at(-1)!.descem).toHaveLength(3);
    expect(JSON.stringify(r)).toBe(antes);
  });
  it('sem coordenadas não inventa sugestão', () => {
    const r = rota();
    r.paradas[2] = { ...r.paradas[2], lat: undefined };
    const s = sugerirRotaDoCadastro(r, van, matriz);
    expect(s.sugestao).toBeNull();
    expect(s.motivo).toBeTruthy();
  });
});
