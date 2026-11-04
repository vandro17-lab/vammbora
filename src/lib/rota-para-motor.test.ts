import { describe, it, expect } from 'vitest';
import { planejarRotaDoCadastro } from './rota-para-motor';
import type { Rota, Veiculo } from '@/types/motorista';

const veiculo: Veiculo = {
  id: 'v1', modelo: 'Sprinter', lugaresPassageiro: 15,
  arCondicionado: true, acessivel: false, cintos: true, fotos: [],
};

// saída(0) -> casa A(1) -> casa B(2) -> escola(3); João e Maria vão à escola.
function rotaCompleta(): Rota {
  return {
    id: 'r1', nome: 'Rota', sentido: 'ida', turno: 'manha', dias: ['seg'],
    veiculoId: 'v1', monitor: false, monitorOcupaLugar: false, lugaresReservados: 0,
    ultimoDesembarqueMin: 420, limiteAntecipacaoMin: 10, status: 'rascunho',
    atualizadoEm: '2026-11-04T00:00:00Z',
    paradas: [
      { id: 's', ordem: 0, tipo: 'saida', rotulo: 'Garagem', confirmado: true, tempoAteProximaMin: 8 },
      { id: 'a', ordem: 1, tipo: 'casa', rotulo: 'Casa A', confirmado: true, tempoAteProximaMin: 6 },
      { id: 'b', ordem: 2, tipo: 'casa', rotulo: 'Casa B', confirmado: true, tempoAteProximaMin: 10 },
      { id: 'e', ordem: 3, tipo: 'escola', rotulo: 'Escola', confirmado: true, destinoId: 'esc1', destinoNome: 'Escola' },
    ],
    passageiros: [
      { id: 'p1', identificacao: 'João', embarqueParadaId: 'a', desembarqueParadaId: 'e', destinoId: 'esc1' },
      { id: 'p2', identificacao: 'Maria', embarqueParadaId: 'b', desembarqueParadaId: 'e', destinoId: 'esc1' },
    ],
  };
}

describe('planejarRotaDoCadastro (adaptador -> motor real)', () => {
  it('rota completa produz um plano válido do motor', () => {
    const { plano, dadosFaltantes } = planejarRotaDoCadastro(rotaCompleta(), veiculo);
    expect(dadosFaltantes).toEqual([]);
    expect(plano?.valido).toBe(true);
    expect(plano?.paradas.length).toBe(3); // casa A, casa B, escola (saída não é parada do plano)
  });

  it('sem os tempos entre paradas, NÃO inventa: informa o que falta', () => {
    const r = rotaCompleta();
    r.paradas = r.paradas.map((p) => ({ ...p, tempoAteProximaMin: null }));
    const { plano, dadosFaltantes } = planejarRotaDoCadastro(r, veiculo);
    expect(plano?.valido).toBe(false);
    expect(dadosFaltantes.some((m) => m.includes('minutos entre as paradas'))).toBe(true);
  });

  it('sem horário de deixar o último aluno, informa o que falta', () => {
    const r = rotaCompleta();
    r.ultimoDesembarqueMin = null;
    const { dadosFaltantes } = planejarRotaDoCadastro(r, veiculo);
    expect(dadosFaltantes.some((m) => m.includes('deixar o último aluno'))).toBe(true);
  });
});
