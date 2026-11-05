import { describe, it, expect } from 'vitest';
import { matrizDeTabelas, obterMatrizViaria, FalhaMatriz } from './matriz-viaria';
import type { PontoGeo } from '@/engine/encaixe-geografico';

const p = (id: string): PontoGeo => ({ id, nome: id, lat: -21.2, lng: -50.4 });

describe('matriz viária', () => {
  it('monta trechos a partir das tabelas e trata o mesmo ponto como zero', () => {
    const pontos = [p('a'), p('b')];
    const m = matrizDeTabelas(pontos, [[0, 10], [12, 0]], [[0, 3000], [3200, 0]]);
    expect(m.obter(p('a'), p('a'), 0)).toEqual({ minutos: 0, metros: 0 });
    expect(m.obter(p('a'), p('b'), 0)).toEqual({ minutos: 10, metros: 3000 });
  });

  it('15/16: devolve null (nunca linha reta) quando falta o trecho', () => {
    const pontos = [p('a'), p('b')];
    const m = matrizDeTabelas(pontos, [[0, null], [12, 0]], [[0, null], [3200, 0]]);
    expect(m.obter(p('a'), p('b'), 0)).toBeNull();
    // Ponto desconhecido também não é inventado.
    expect(m.obter(p('a'), p('z'), 0)).toBeNull();
  });

  it('15: sem sessão de motorista, falha com motivo claro', async () => {
    await expect(obterMatrizViaria([p('a'), p('b')])).rejects.toBeInstanceOf(FalhaMatriz);
  });
});
