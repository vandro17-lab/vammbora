import { describe, it, expect, vi } from 'vitest';
import { MatrizPorCoordenadas, consultarTabelasViarias, pontosDistintos } from './matriz-viaria-servidor';

const A = { lat: -21.2, lng: -50.44 }, B = { lat: -21.21, lng: -50.43 }, X = { lat: -21.3, lng: -50.5 };
const pt = (id: string, c: { lat: number; lng: number }) => ({ id, nome: id, ...c });

describe('matriz viária do servidor (busca das famílias)', () => {
  it('devolve o trecho real por coordenada e NUNCA inventa par não consultado', () => {
    const m = new MatrizPorCoordenadas();
    m.adicionar([A, B], [[0, 7], [9, 0]], [[0, 2100], [2600, 0]]);
    expect(m.origem).toBe('geoapify');
    expect(m.obter(pt('casa', A), pt('escola', B))).toEqual({ minutos: 7, metros: 2100 });
    expect(m.obter(pt('escola', B), pt('casa', A))).toEqual({ minutos: 9, metros: 2600 });
    expect(m.obter(pt('casa', A), pt('outro', X))).toBeNull();
    expect(m.obter(pt('p1', A), pt('p2', A))).toEqual({ minutos: 0, metros: 0 });
  });

  it('par sem trajeto no provedor fica indisponível', () => {
    const m = new MatrizPorCoordenadas();
    m.adicionar([A, B], [[0, null], [9, 0]], [[0, null], [2600, 0]]);
    expect(m.obter(pt('a', A), pt('b', B))).toBeNull();
  });

  it('sem chave, com erro do provedor ou pontos demais => null (sem tempo fictício)', async () => {
    const ok = vi.fn(async () => ({ ok: true, json: async () => ({ sources_to_targets: [[{ source_index: 0, target_index: 1, time: 125, distance: 800 }], []] }) }));
    expect(await consultarTabelasViarias([A, B], undefined, ok as never)).toBeNull();
    expect(ok).not.toHaveBeenCalled();
    const falha = vi.fn(async () => ({ ok: false, json: async () => ({}) }));
    expect(await consultarTabelasViarias([A, B], 'k', falha as never)).toBeNull();
    expect(await consultarTabelasViarias(Array.from({ length: 26 }, (_, i) => ({ lat: -21 - i / 1000, lng: -50 })), 'k', ok as never)).toBeNull();
    const t = await consultarTabelasViarias([A, B], 'k', ok as never);
    expect(t?.tempos[0][1]).toBe(2.08); // 125 s = 2,08 min: trecho curto não é arredondado para o minuto cheio
    expect(t?.tempos[1][0]).toBeNull();
  });

  it('pontosDistintos remove coordenadas repetidas e inválidas', () => {
    expect(pontosDistintos([A, { ...A }, B, { lat: NaN, lng: 0 }])).toEqual([A, B]);
  });
});
