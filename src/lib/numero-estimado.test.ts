import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { estimarPorVizinhos, metrosEntre } from './numero-estimado';
import { estimarNumeroNaRua, reiniciarGeocodificacao } from './geocode';
import { avisoEndereco, escolherPonto } from './endereco';

// Rua reta, de oeste para leste: nº 100 em -50.4400 … nº 500 em -50.4360.
const LAT = -21.21;
const casa = (num: number) => ({ num, lat: LAT, lng: -50.44 + ((num - 100) / 400) * 0.004 });

describe('posição do número pelos vizinhos da rua', () => {
  it('fica entre o vizinho menor e o maior, na proporção dos números', () => {
    const p = estimarPorVizinhos(300, [casa(100), casa(500)]);
    expect(p?.exato).toBe(false);
    expect(p?.vizinhos).toEqual([100, 500]);
    expect(p!.lng).toBeCloseTo(-50.438, 6);
    expect(p!.lat).toBeCloseTo(LAT, 6);
  });
  it('usa os vizinhos MAIS PRÓXIMOS e prefere o mesmo lado da rua (par/ímpar)', () => {
    const impar = { num: 451, lat: LAT + 0.0002, lng: casa(451).lng };
    const p = estimarPorVizinhos(450, [casa(100), casa(400), impar, casa(500), casa(900)]);
    expect(p?.vizinhos).toEqual([400, 500]);
    expect(p!.lat).toBeCloseTo(LAT, 6); // não foi puxado para o lado ímpar
  });
  it('o mapa já tinha o número: é exato, não estimativa', () => {
    expect(estimarPorVizinhos(500, [casa(100), casa(500)])).toMatchObject({ exato: true, lng: casa(500).lng });
  });
  it('além do último número: vizinho de porta vale; perto, continua no mesmo ritmo; longe, não inventa', () => {
    expect(estimarPorVizinhos(520, [casa(100), casa(500)])).toMatchObject({ vizinhos: [500], lng: casa(500).lng });
    const p = estimarPorVizinhos(700, [casa(100), casa(500)]);
    expect(p!.lng).toBeCloseTo(casa(700).lng, 6);
    expect(metrosEntre(p!, casa(500))).toBeLessThan(400);
    expect(estimarPorVizinhos(4000, [casa(100), casa(500)])).toBeNull();
    expect(estimarPorVizinhos(300, [casa(100)])).toBeNull();
    expect(estimarPorVizinhos(300, [])).toBeNull();
  });
  it('vizinhos absurdamente distantes não geram estimativa', () => {
    expect(estimarPorVizinhos(300, [casa(100), { num: 500, lat: LAT + 0.1, lng: -50.44 }])).toBeNull();
  });
});

describe('estimativa com os imóveis numerados do mapa (rede simulada)', () => {
  beforeEach(() => reiniciarGeocodificacao());
  afterEach(() => vi.unstubAllGlobals());
  const BASE = { lat: LAT, lng: -50.438, rotulo: 'Rua José Geraldo, Centro, Araçatuba' };
  const el = (rua: string, num: string, c: { lat: number; lng: number }) => ({ type: 'node', lat: c.lat, lon: c.lng, tags: { 'addr:street': rua, 'addr:housenumber': num } });
  function rede(elements: unknown[], status = 200) {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (u: unknown) => { urls.push(decodeURIComponent(String(u))); return { ok: status === 200, status, json: async () => ({ elements }) }; }));
    return urls;
  }

  it('número ausente => ponto ESTIMADO entre os vizinhos da mesma rua (digitado sem acento)', async () => {
    const urls = rede([
      el('Rua José Geraldo', '100', casa(100)),
      { type: 'way', center: { lat: LAT, lon: casa(500).lng }, tags: { 'addr:street': 'Rua José Geraldo', 'addr:housenumber': '500' } },
      el('Rua Josi Giraldi', '300', { lat: LAT + 0.01, lng: -50.43 }), // outra rua que passou no filtro folgado
      el('Rua José Geraldo', 's/n', casa(300)),
    ]);
    const p = await estimarNumeroNaRua('rua jose geraldo, 300', BASE);
    expect(p).toMatchObject({ precisao: 'estimado', rotulo: 'Rua José Geraldo, 300' });
    expect(p!.lng).toBeCloseTo(-50.438, 6);
    expect(p!.lat).toBeCloseTo(LAT, 6);
    expect(urls[0]).toContain('overpass');
    expect(urls[0]).toContain(`around:5000,${LAT},-50.438`);
    await estimarNumeroNaRua('rua jose geraldo, 300', BASE);
    expect(urls).toHaveLength(1); // não consulta de novo
  });
  it('número presente entre os imóveis => exato', async () => {
    rede([el('Rua José Geraldo', '300', casa(300)), el('Rua José Geraldo', '100', casa(100))]);
    expect(await estimarNumeroNaRua('Rua José Geraldo, 300', BASE)).toMatchObject({ precisao: 'exato' });
  });
  it('rua sem números no mapa, serviço fora ou endereço sem número => null (fica o ponto da rua)', async () => {
    rede([]);
    expect(await estimarNumeroNaRua('Rua José Geraldo, 300', BASE)).toBeNull();
    reiniciarGeocodificacao();
    rede([], 429);
    expect(await estimarNumeroNaRua('Rua José Geraldo, 300', BASE)).toBeNull();
    const urls = rede([]);
    expect(await estimarNumeroNaRua('Rua José Geraldo', BASE)).toBeNull();
    expect(urls).toHaveLength(0);
  });
});

describe('regras do endereço com posição estimada', () => {
  const est = { rotulo: 'Rua X, 450', lat: -21.2, lng: -50.4, precisao: 'estimado' as const };
  it('estimativa vale mais que o ponto da rua, menos que o número confirmado', () => {
    expect(escolherPonto(est, { lat: -21.3, lng: -50.5 }).precisao).toBe('estimado');
    expect(escolherPonto(est, { lat: -21.3, lng: -50.5, temNumero: true })).toMatchObject({ precisao: 'exato', coord: { lat: -21.3 } });
  });
  it('avisa que é estimativa e, enquanto procura, que a rua já está marcada', () => {
    const c = { lat: -21.2, lng: -50.4 };
    expect(avisoEndereco({ texto: 'Rua X, 450', coord: c, precisao: 'estimado', validando: false })?.texto).toMatch(/posição estimada pelos números vizinhos/);
    expect(avisoEndereco({ texto: 'Rua X, 450', coord: c, precisao: 'rua', validando: false, refinando: true })?.texto).toMatch(/Procurando a posição do número 450/);
  });
});
