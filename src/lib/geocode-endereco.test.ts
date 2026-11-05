import { describe, it, expect } from 'vitest';
import { separarRuaNumero } from './geocode';

/**
 * Geocodificação estruturada: separar rua × número é o que faz o Geoapify
 * respeitar o número da casa (parâmetros `street` + `housenumber`).
 */
describe('separarRuaNumero', () => {
  it('usa o número do campo quando informado', () => {
    expect(separarRuaNumero('Rua Afonso Pena', '450')).toEqual({ rua: 'Rua Afonso Pena', num: '450' });
  });

  it('não duplica o número quando ele já está no texto', () => {
    expect(separarRuaNumero('Rua Afonso Pena, 450', '450')).toEqual({ rua: 'Rua Afonso Pena', num: '450' });
  });

  it('extrai o número embutido no texto quando o campo vem vazio', () => {
    expect(separarRuaNumero('Rua Afonso Pena, 450', '')).toEqual({ rua: 'Rua Afonso Pena', num: '450' });
  });

  it('entende "nº" antes do número', () => {
    expect(separarRuaNumero('Av. Brasília nº 1200', '')).toEqual({ rua: 'Av. Brasília', num: '1200' });
  });

  it('remove sufixos de cidade/estado/país', () => {
    expect(separarRuaNumero('Rua X, 10, Araçatuba, São Paulo, Brasil', '10')).toEqual({ rua: 'Rua X', num: '10' });
  });

  it('ignora caracteres não numéricos no campo número (s/n)', () => {
    expect(separarRuaNumero('Rua Sem Número', 's/n')).toEqual({ rua: 'Rua Sem Número', num: '' });
  });

  it('mantém a rua quando não há número algum', () => {
    expect(separarRuaNumero('Praça Nove de Julho', '')).toEqual({ rua: 'Praça Nove de Julho', num: '' });
  });
});
