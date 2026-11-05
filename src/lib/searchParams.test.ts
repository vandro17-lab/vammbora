import { describe, it, expect } from 'vitest';
import { criteriosParaParams, paramsParaCriterios } from './searchParams';
import type { CriteriosBusca } from '@/types';

describe('searchParams (ida e volta)', () => {
  it('serializa e reconstrói os mesmos critérios', () => {
    const c: CriteriosBusca = {
      cidadeId: 'aracatuba-sp',
      endereco: 'Rua A, Centro',
      destinoId: 'esc-paineiras',
      turno: 'tarde',
      contratacao: 'avulso',
      dataAvulso: '2026-11-10',
      modalidade: 'ambos',
    };
    const voltou = paramsParaCriterios(new URLSearchParams(criteriosParaParams(c)));
    expect(voltou).toEqual(c);
  });

  it('leva e traz as coordenadas exatas da origem (autocomplete)', () => {
    const c: CriteriosBusca = {
      cidadeId: 'aracatuba-sp', endereco: 'Av. Prestes Maia, 1764', destinoId: null,
      turno: 'manha', contratacao: 'mensal', modalidade: 'ida', origemLat: -21.2089, origemLng: -50.4328,
    };
    const voltou = paramsParaCriterios(new URLSearchParams(criteriosParaParams(c)));
    expect(voltou.origemLat).toBeCloseTo(-21.2089, 4);
    expect(voltou.origemLng).toBeCloseTo(-50.4328, 4);
  });

  it('aplica valores padrão seguros para params ausentes', () => {
    const c = paramsParaCriterios(new URLSearchParams(''));
    expect(c.cidadeId).toBe('aracatuba-sp');
    expect(c.contratacao).toBe('mensal');
    expect(c.modalidade).toBe('ida');
    expect(c.turno).toBeNull();
    expect(c.destinoId).toBeNull();
  });

  it('ignora turno/modalidade inválidos', () => {
    const c = paramsParaCriterios(new URLSearchParams('turno=xpto&modalidade=foo'));
    expect(c.turno).toBeNull();
    expect(c.modalidade).toBe('ida');
  });
});
