import { describe, it, expect, vi } from 'vitest';
import { geocodificarPreciso, separarRuaNumero } from './geocode';

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

describe('geocodificarPreciso com Photon', () => {
  it('ignora a rua sem número e encontra o resultado posterior com o número solicitado', async () => {
    const photon = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [
        { geometry: { coordinates: [-50.432, -21.208] }, properties: { street: 'Rua Teste', city: 'Araçatuba' } },
        { geometry: { coordinates: [-50.433, -21.209] }, properties: { street: 'Rua Teste', housenumber: '450', district: 'Centro', city: 'Araçatuba' } },
      ] }),
    });
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/mapas') return Promise.resolve({ status: 503 });
      if (url.startsWith('https://nominatim.openstreetmap.org/')) return Promise.resolve({ ok: true, json: async () => [] });
      if (url.startsWith('https://photon.komoot.io/')) return photon(input);
      throw new Error(`URL inesperada no teste: ${url}`);
    }));

    const ponto = await geocodificarPreciso('Rua Teste, 450', '');

    expect(photon).toHaveBeenCalledOnce();
    expect(new URL(String(photon.mock.calls[0][0])).searchParams.get('limit')).toBe('8');
    expect(ponto).toMatchObject({ lat: -21.209, lng: -50.433, precisao: 'exato' });
    expect(ponto?.rotulo).toContain('450');
    vi.unstubAllGlobals();
  });
});
