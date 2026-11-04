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
