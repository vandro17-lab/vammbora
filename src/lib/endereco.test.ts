import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  numeroDoEndereco, rotuloTemNumero, comporComNumero, escolherPonto, avisoEndereco,
} from './endereco';
import { buscarEnderecos, geocodificarPreciso, reiniciarGeocodificacao, type PontoPreciso } from './geocode';

describe('número do imóvel no texto do endereço', () => {
  it.each([
    ['Rua José Geraldo, 450', 'Rua José Geraldo', '450'],
    ['Rua José Geraldo 450', 'Rua José Geraldo', '450'],
    ['rua jose geraldo 450 ', 'rua jose geraldo', '450'],
    ['Rua José Geraldo, 450 - Centro', 'Rua José Geraldo', '450'],
    ['Rua José Geraldo, 450, Centro, Araçatuba, SP, 16010-000, Brasil', 'Rua José Geraldo', '450'],
    ['Av. Brasília nº 1200', 'Av. Brasília', '1200'],
    ['Rua 9 de Julho, 300', 'Rua 9 de Julho', '300'],
    ['Rua 9 de Julho 300', 'Rua 9 de Julho', '300'],
  ])('%s', (texto, rua, num) => {
    expect(numeroDoEndereco(texto)).toEqual({ rua, num });
  });
  it.each(['Rua José Geraldo', 'Rua 9 de Julho', 'Avenida 2', 'Rua José Geraldo, Centro, Araçatuba, 16010-000', 'Centro (bairro)'])(
    'sem número de imóvel: %s', (texto) => { expect(numeroDoEndereco(texto).num).toBe(''); },
  );
});

describe('escolher uma sugestão depois de digitar o número', () => {
  it('o campo fica com a rua da sugestão e o número digitado', () => {
    expect(comporComNumero('Rua José Geraldo, Centro, Araçatuba', '450')).toBe('Rua José Geraldo, 450, Centro, Araçatuba');
  });
  it('troca o número de OUTRO imóvel que veio na sugestão', () => {
    expect(comporComNumero('Rua José Geraldo, 100, Centro', '450')).toBe('Rua José Geraldo, 450, Centro');
  });
  it('não mexe quando a sugestão já é do número, nem quando não há número', () => {
    expect(comporComNumero('Rua José Geraldo, 450, Centro', '450')).toBe('Rua José Geraldo, 450, Centro');
    expect(comporComNumero('Rua José Geraldo, Centro', '')).toBe('Rua José Geraldo, Centro');
    expect(rotuloTemNumero('Rua José Geraldo, 450, Centro', '450')).toBe(true);
    expect(rotuloTemNumero('Rua José Geraldo, 100, Centro', '450')).toBe(false);
  });
});

describe('qual ponto vale para o endereço', () => {
  const sug = { lat: -21.2101, lng: -50.4319 };
  const exato: PontoPreciso = { rotulo: 'Rua X, 580', lat: -21.2102, lng: -50.432, precisao: 'exato' };
  const rua: PontoPreciso = { rotulo: 'Rua X', lat: -21.2105, lng: -50.4325, precisao: 'rua' };
  const vago: PontoPreciso = { rotulo: 'Araçatuba', lat: -21.2089, lng: -50.4328, precisao: 'aproximado' };

  it('número confirmado pelo provedor vence tudo', () => {
    expect(escolherPonto(exato, sug)).toEqual({ coord: { lat: -21.2102, lng: -50.432 }, precisao: 'exato', rotulo: 'Rua X, 580' });
  });
  it('número não encontrado: mantém a latitude/longitude da sugestão escolhida, como RUA', () => {
    expect(escolherPonto(null, sug)).toEqual({ coord: sug, precisao: 'rua', rotulo: null });
    expect(escolherPonto(rua, sug).coord).toEqual(sug);
  });
  it('resultado vago (bairro/cidade) NUNCA substitui a sugestão escolhida nem vira ponto sozinho', () => {
    expect(escolherPonto(vago, sug).coord).toEqual(sug);
    expect(escolherPonto(vago, null).coord).toBeNull();
  });
  it('sem sugestão: aceita o ponto da rua, sem promover a exato', () => {
    expect(escolherPonto(rua, null)).toEqual({ coord: { lat: -21.2105, lng: -50.4325 }, precisao: 'rua', rotulo: 'Rua X' });
  });
  it('sugestão que já era do número pedido é exata', () => {
    expect(escolherPonto(null, { ...sug, temNumero: true }).precisao).toBe('exato');
  });
  it('sem nada confiável não inventa ponto', () => {
    expect(escolherPonto(null, null)).toEqual({ coord: null, precisao: undefined, rotulo: null });
  });
});

describe('aviso de situação (mesma mensagem em todas as telas)', () => {
  const c = { lat: -21.2, lng: -50.4 };
  it('informa quando o mapa só tem a rua e manda ajustar no mapa', () => {
    const a = avisoEndereco({ texto: 'Rua X, 450', coord: c, precisao: 'rua', validando: false });
    expect(a?.tom).toBe('alerta');
    expect(a?.texto).toMatch(/não tem o número 450/);
    expect(a?.texto).toMatch(/ajuste no mapa/);
  });
  it('número localizado, ponto marcado à mão, não localizado e consultando', () => {
    expect(avisoEndereco({ texto: 'Rua X, 450', coord: c, precisao: 'exato', validando: false })?.texto).toMatch(/Número 450 localizado/);
    expect(avisoEndereco({ texto: 'Rua X, 450', coord: c, precisao: 'ajustado', validando: false })?.tom).toBe('ok');
    expect(avisoEndereco({ texto: 'Rua Inexistente 99999', coord: null, validando: false })?.texto).toMatch(/Não localizamos/);
    expect(avisoEndereco({ texto: 'Rua X', coord: null, validando: true })?.texto).toMatch(/Localizando/);
    expect(avisoEndereco({ texto: 'Ru', coord: null, validando: false })).toBeNull();
  });
});

/* ---------------- serviço de geocodificação (rede simulada) ---------------- */
type Resposta = { status?: number; json: unknown; atrasoMs?: number };
function simularRede(responder: (url: string, corpo: Record<string, string>) => Resposta) {
  const chamadas: { url: string; corpo: Record<string, string> }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (entrada: unknown, init?: { body?: string; signal?: AbortSignal }) => {
    const url = String(entrada);
    const corpo = init?.body ? JSON.parse(init.body) : {};
    chamadas.push({ url, corpo });
    const r = responder(url, corpo);
    if (r.atrasoMs) await new Promise((ok) => setTimeout(ok, r.atrasoMs));
    if (init?.signal?.aborted) throw new DOMException('abortada', 'AbortError');
    const status = r.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: async () => r.json };
  }));
  return chamadas;
}
const VAZIO_EXTERNO: Resposta = { json: { features: [] } };

describe('geocodificação: número, só a rua e endereço inexistente', () => {
  beforeEach(() => reiniciarGeocodificacao());
  afterEach(() => vi.unstubAllGlobals());

  it('rua com número encontrado => exato', async () => {
    const chamadas = simularRede((url, corpo) => url === '/api/mapas' && corpo.operacao === 'geocodificar'
      ? { json: { ponto: { rotulo: 'Rua José Geraldo, 450, Centro', lat: -21.21, lng: -50.43, precisao: 'exato' } } } : VAZIO_EXTERNO);
    const p = await geocodificarPreciso('Rua José Geraldo, 450, Centro, Araçatuba', '', undefined, { aceitarSemNumero: true });
    expect(p?.precisao).toBe('exato');
    // O número é separado do texto mesmo no meio do endereço (formato das sugestões).
    expect(chamadas[0].corpo).toMatchObject({ operacao: 'geocodificar', texto: 'Rua José Geraldo', numero: '450' });
  });

  it('rua encontrada sem o número => ponto da RUA (nunca exato); sem a opção, null', async () => {
    simularRede((url, corpo) => url === '/api/mapas' && corpo.operacao === 'geocodificar'
      ? { json: { ponto: { rotulo: 'Rua José Geraldo, Centro', lat: -21.21, lng: -50.43, precisao: 'rua' } } }
      : url.includes('nominatim') ? { json: [] } : VAZIO_EXTERNO);
    const p = await geocodificarPreciso('Rua José Geraldo, 9999', '', undefined, { aceitarSemNumero: true });
    expect(p).toEqual({ rotulo: 'Rua José Geraldo, Centro', lat: -21.21, lng: -50.43, precisao: 'rua' });
    reiniciarGeocodificacao();
    expect(await geocodificarPreciso('Rua José Geraldo, 9999', '')).toBeNull();
  });

  it('provedor alternativo devolve OUTRO número => não é exato', async () => {
    simularRede((url) => url === '/api/mapas' ? { status: 503, json: {} }
      : url.includes('nominatim') ? { json: [{ lat: '-21.21', lon: '-50.43', address: { house_number: '100', road: 'Rua José Geraldo', city: 'Araçatuba' } }] }
      : { json: { features: [{ geometry: { coordinates: [-50.43, -21.21] }, properties: { street: 'Rua José Geraldo', housenumber: '120', city: 'Araçatuba' } }] } });
    const p = await geocodificarPreciso('Rua José Geraldo, 450', '', undefined, { aceitarSemNumero: true });
    expect(p?.precisao).toBe('rua');
    expect(p?.rotulo).not.toMatch(/450|120|100/); // não afirma número algum
  });

  it('endereço inexistente => null (não inventa coordenada)', async () => {
    simularRede((url) => url === '/api/mapas' ? { json: { ponto: null } } : url.includes('nominatim') ? { json: [] } : VAZIO_EXTERNO);
    expect(await geocodificarPreciso('Rua Que Não Existe, 12', '', undefined, { aceitarSemNumero: true })).toBeNull();
  });

  it('resultado vago do provedor (bairro/cidade) não vira ponto de rua', async () => {
    simularRede((url) => url === '/api/mapas' ? { json: { ponto: { rotulo: 'Araçatuba', lat: -21.2089, lng: -50.4328, precisao: 'aproximado' } } }
      : url.includes('nominatim') ? { json: [] } : VAZIO_EXTERNO);
    expect(await geocodificarPreciso('Rua Qualquer, 12', '', undefined, { aceitarSemNumero: true })).toBeNull();
  });
});

describe('sugestões: número digitado, região e consultas repetidas', () => {
  beforeEach(() => reiniciarGeocodificacao());
  afterEach(() => vi.unstubAllGlobals());
  const RUA = { rotulo: 'Rua José Geraldo, Centro, Araçatuba', lat: -21.21, lng: -50.43 };

  it('mapa sem o número: a lista NÃO some — volta a rua para a pessoa escolher', async () => {
    const chamadas = simularRede((url, corpo) => url === '/api/mapas'
      ? { json: { resultados: corpo.texto === 'Rua José Geraldo' ? [RUA] : [] } } : VAZIO_EXTERNO);
    expect(await buscarEnderecos('Rua José Geraldo 450')).toEqual([RUA]);
    expect(chamadas.filter((c) => c.url === '/api/mapas').map((c) => c.corpo.texto)).toEqual(['Rua José Geraldo 450', 'Rua José Geraldo']);
  });

  it('descarta sugestões de fora da região atendida', async () => {
    simularRede((url) => url === '/api/mapas'
      ? { json: { resultados: [{ rotulo: 'Rua José Geraldo, São Paulo', lat: -23.55, lng: -46.63 }, RUA] } } : VAZIO_EXTERNO);
    expect(await buscarEnderecos('Rua José Geraldo')).toEqual([RUA]);
  });

  it('redigitar o mesmo trecho não consulta de novo', async () => {
    const chamadas = simularRede((url) => (url === '/api/mapas' ? { json: { resultados: [RUA] } } : VAZIO_EXTERNO));
    await buscarEnderecos('Rua José Geraldo');
    await buscarEnderecos('rua jose geraldo ');
    expect(chamadas).toHaveLength(1);
  });

  it('consulta abortada (digitação rápida) não devolve nem guarda resultado antigo', async () => {
    const chamadas = simularRede((url, corpo) => url === '/api/mapas'
      ? { json: { resultados: [{ ...RUA, rotulo: `resposta de ${corpo.texto}` }] }, atrasoMs: corpo.texto === 'Rua Jo' ? 40 : 5 } : VAZIO_EXTERNO);
    const antiga = new AbortController();
    const lenta = buscarEnderecos('Rua Jo', antiga.signal);
    antiga.abort(); // a pessoa continuou digitando
    const nova = await buscarEnderecos('Rua José');
    expect(nova[0].rotulo).toBe('resposta de Rua José');
    expect(await lenta).toEqual([]);
    // "Rua Jo" não ficou em memória com resposta de consulta cancelada.
    await buscarEnderecos('Rua Jo');
    expect(chamadas.filter((c) => c.corpo.texto === 'Rua Jo').length).toBe(2);
  });
});
