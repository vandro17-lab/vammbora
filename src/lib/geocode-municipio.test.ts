import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { municipioDoPonto, ufDoEstado, geocodificarPreciso, buscarEnderecos, reiniciarGeocodificacao } from '@/lib/geocode';
import { municipioDaConsulta } from '../../api/mapas';

/** Pedidos feitos aos provedores (o serviço de mapas é simulado: sem rede). */
let pedidos: { url: string; corpo?: Record<string, unknown> }[] = [];
function simular(resposta: (url: string, corpo?: Record<string, unknown>) => unknown) {
  vi.stubGlobal('fetch', vi.fn(async (u: string | URL, init?: RequestInit) => {
    const url = String(u);
    const corpo = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    pedidos.push({ url, corpo });
    const r = resposta(url, corpo);
    return r === 503 ? new Response('', { status: 503 }) : new Response(JSON.stringify(r), { status: 200 });
  }));
}
beforeEach(() => { pedidos = []; reiniciarGeocodificacao(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('UF do provedor', () => {
  it('aceita sigla, nome com ou sem acento e ISO', () => {
    expect(ufDoEstado('SP')).toBe('SP');
    expect(ufDoEstado('São Paulo')).toBe('SP');
    expect(ufDoEstado('sao paulo')).toBe('SP');
    expect(ufDoEstado('BR-MS')).toBe('MS');
    expect(ufDoEstado('Narnia')).toBeNull();
    expect(ufDoEstado(undefined)).toBeNull();
  });
});

describe('município do ponto confirmado', () => {
  it('usa o município e a UF que o proxy devolve', async () => {
    simular(() => ({ rotulo: 'Rua Saudades, 300, Birigui', cidade: 'Birigui', uf: 'SP' }));
    expect(await municipioDoPonto(-21.29, -50.34)).toEqual({ nome: 'Birigui', uf: 'SP' });
  });
  it('sem proxy, usa o Photon (cidade + estado por extenso)', async () => {
    simular((url) => (url.includes('/api/mapas') ? 503 : { features: [{ properties: { city: 'Birigui', state: 'São Paulo' } }] }));
    expect(await municipioDoPonto(-21.29, -50.34)).toEqual({ nome: 'Birigui', uf: 'SP' });
  });
  it('sem cidade ou UF reconhecível: null (a família confirma)', async () => {
    simular((url) => (url.includes('/api/mapas') ? 503 : { features: [{ properties: { state: 'São Paulo' } }] }));
    expect(await municipioDoPonto(-21.29, -50.34)).toBeNull();
  });
});

describe('busca do endereço na cidade escolhida', () => {
  it('sem município: o padrão de sempre (busca e motorista não mudam)', async () => {
    simular(() => ({ ponto: { rotulo: 'Rua A, 10', lat: -21.2, lng: -50.44, precisao: 'exato' } }));
    await geocodificarPreciso('Rua A, 10', '', undefined, { aceitarSemNumero: true });
    expect(pedidos[0].corpo).not.toHaveProperty('cidade');
  });
  it('com município: o proxy e o Photon recebem a cidade escolhida', async () => {
    simular((url) => (url.includes('/api/mapas') ? 503 : { features: [] }));
    await buscarEnderecos('Rua Saudades', undefined, { nome: 'Birigui', uf: 'SP' });
    expect(pedidos[0].corpo).toMatchObject({ cidade: 'Birigui', uf: 'SP' });
    expect(pedidos.some((p) => p.url.includes('photon') && new URL(p.url).searchParams.get('q') === 'Rua Saudades, Birigui')).toBe(true);
  });
});

describe('proxy de mapas: município da consulta', () => {
  it('aceita cidade e UF válidas; qualquer outra coisa volta ao padrão', () => {
    expect(municipioDaConsulta('Birigui', 'sp')).toEqual({ cidade: 'Birigui', estado: 'São Paulo' });
    expect(municipioDaConsulta("Santa Bárbara d'Oeste", 'SP')).toEqual({ cidade: "Santa Bárbara d'Oeste", estado: 'São Paulo' });
    for (const [c, u] of [['Birigui', 'XX'], ['<script>', 'SP'], ['', 'SP'], [undefined, undefined], ['a'.repeat(61), 'SP']]) {
      expect(municipioDaConsulta(c, u)).toEqual({ cidade: 'Araçatuba', estado: 'São Paulo' });
    }
  });
});
