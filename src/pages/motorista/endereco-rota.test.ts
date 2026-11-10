import { describe, it, expect } from 'vitest';
import { resolverPontoEndereco } from './RotaBuilderPage';

describe('seleção de endereço no construtor de rotas', () => {
  const sugestao = { lat: -21.2101, lng: -50.4319 };
  it('usa o ponto exato quando a geocodificação encontra o número', () => {
    expect(resolverPontoEndereco({ lat: -21.2102, lng: -50.432, precisao: 'exato', rotulo: 'Rua X, 580' }, sugestao))
      .toEqual({ coord: { lat: -21.2102, lng: -50.432 }, precisao: 'exato', rotulo: 'Rua X, 580' });
  });
  it('se o número não é encontrado, mantém a latitude/longitude da sugestão escolhida', () => {
    expect(resolverPontoEndereco(null, sugestao)).toEqual({ coord: sugestao, precisao: 'rua', rotulo: null });
  });
  it('sem sugestão e sem geocodificação não inventa ponto', () => {
    expect(resolverPontoEndereco(null, null).coord).toBeNull();
  });
});
