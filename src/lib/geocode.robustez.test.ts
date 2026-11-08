import { describe, it, expect, vi, afterEach } from 'vitest';
import { dentroDeAracatuba } from './geocode';

/**
 * SIMULAÇÕES do pipeline de geocodificação de endereço.
 *
 * Reproduzem as respostas típicas dos serviços de mapa para um endereço COM
 * número de casa, incluindo o caso mais comum em Araçatuba: o serviço encontra
 * a RUA, mas não o número exato. O ponto da rua é mais que suficiente (o ponto
 * de embarque exato é combinado com o motorista), então a busca NUNCA deve
 * ficar sem coordenada por falta do número.
 */

const ARA = { lat: -21.2089, lng: -50.4328 };

function resp(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

type Handler = (url: string, init?: { body?: string }) => Response;

function instalarFetch(handler: Handler) {
  vi.stubGlobal('fetch', vi.fn(async (input: unknown, init?: { body?: string }) => {
    const url = typeof input === 'string' ? input : String((input as { url?: string })?.url ?? input);
    return handler(url, init);
  }));
}

/** Importa o módulo zerado (reseta o estado interno `proxyIndisponivel`). */
async function geocodeLimpo() {
  vi.resetModules();
  return await import('./geocode');
}

afterEach(() => vi.unstubAllGlobals());

describe('geocodificarPreciso — robustez com número de casa', () => {
  it('A) proxy acha só a RUA (sem número exato) → devolve o ponto da rua, não null', async () => {
    instalarFetch((url, init) => {
      if (url === '/api/mapas') {
        const body = JSON.parse(init?.body ?? '{}');
        if (body.operacao === 'geocodificar') {
          return resp({ ponto: { rotulo: 'Rua José Geraldo, Centro', lat: ARA.lat, lng: ARA.lng, precisao: 'rua' } });
        }
        return resp({});
      }
      return resp([]);
    });
    const { geocodificarPreciso } = await geocodeLimpo();
    const p = await geocodificarPreciso('Rua José Geraldo, 450', '');
    expect(p).not.toBeNull();
    expect(dentroDeAracatuba(p!.lat, p!.lng)).toBe(true);
  });

  it('B) sem proxy; Photon acha a rua sem housenumber → ponto da rua, não null', async () => {
    instalarFetch((url) => {
      if (url === '/api/mapas') return resp({}, 503);
      if (url.includes('nominatim')) return resp([]); // não achou o número exato
      if (url.includes('photon')) {
        return resp({ features: [{ geometry: { coordinates: [ARA.lng, ARA.lat] }, properties: { street: 'Rua José Geraldo', city: 'Araçatuba' } }] });
      }
      return resp([]);
    });
    const { geocodificarPreciso } = await geocodeLimpo();
    const p = await geocodificarPreciso('Rua José Geraldo, 450', '');
    expect(p).not.toBeNull();
    expect(p!.precisao).toBe('rua');
    expect(dentroDeAracatuba(p!.lat, p!.lng)).toBe(true);
  });

  it('C) sem proxy; Nominatim acha o número exato → ponto exato', async () => {
    instalarFetch((url) => {
      if (url === '/api/mapas') return resp({}, 503);
      if (url.includes('nominatim')) {
        return resp([{ lat: String(ARA.lat), lon: String(ARA.lng), address: { house_number: '450', road: 'Rua José Geraldo', city: 'Araçatuba' } }]);
      }
      return resp([]);
    });
    const { geocodificarPreciso } = await geocodeLimpo();
    const p = await geocodificarPreciso('Rua José Geraldo, 450', '');
    expect(p).not.toBeNull();
    expect(p!.precisao).toBe('exato');
  });

  it('D) endereço SEM número (bairro) → ponto aproximado da área, não null', async () => {
    instalarFetch((url) => {
      if (url === '/api/mapas') return resp({}, 503);
      if (url.includes('photon')) {
        return resp({ features: [{ geometry: { coordinates: [ARA.lng, ARA.lat] }, properties: { name: 'Centro', city: 'Araçatuba' } }] });
      }
      return resp([]);
    });
    const { geocodificarPreciso } = await geocodeLimpo();
    const p = await geocodificarPreciso('Centro', '');
    expect(p).not.toBeNull();
    expect(dentroDeAracatuba(p!.lat, p!.lng)).toBe(true);
  });

  it('E) todos os serviços falham → null (único caso legítimo de falha)', async () => {
    instalarFetch((url) => {
      if (url === '/api/mapas') return resp({}, 503);
      return resp([]); // nominatim e photon sem resultado
    });
    const { geocodificarPreciso } = await geocodeLimpo();
    const p = await geocodificarPreciso('Rua Inexistente ZZZ, 999', '');
    expect(p).toBeNull();
  });
});
