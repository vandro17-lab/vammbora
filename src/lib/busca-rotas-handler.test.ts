import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Teste ISOLADO do handler server-side (api/buscar-rotas) com MOCK do Supabase
 * (claramente identificado como mock — NÃO comprova o banco de produção).
 * Verifica a cola: elegibilidade (anúncio ativo), uso do motor e AUSÊNCIA DE PII.
 */

const estado: { canned: Record<string, unknown[]>; erros: Record<string, { message: string } | undefined> } = { canned: {}, erros: {} };

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      const self = () => b;
      b.select = self; b.eq = self; b.in = self; b.limit = self; b.order = self; b.range = self;
      b.then = (resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => void) =>
        resolve(estado.erros[table] ? { data: null, error: estado.erros[table]! } : { data: estado.canned[table] ?? [], error: null });
      return b;
    },
  }),
}));

import handler from '../../api/buscar-rotas';

function fakeReq(body: unknown) {
  const texto = JSON.stringify(body);
  return {
    method: 'POST', headers: {},
    async *[Symbol.asyncIterator]() { yield Buffer.from(texto); },
  } as never;
}
function fakeRes() {
  const r: { statusCode: number; body: string; setHeader: () => void; end: (s: string) => void } = {
    statusCode: 0, body: '', setHeader: () => {}, end: (s: string) => { r.body = s; },
  };
  return r;
}

const C = { familia: { lat: -21.2010, lng: -50.4388 }, casaA: { lat: -21.1995, lng: -50.4402 }, casaB: { lat: -21.2100, lng: -50.4300 }, garagem: { lat: -21.2050, lng: -50.4400 }, escola: { lat: -21.2089, lng: -50.4328 } };

function rotaRealCanon() {
  return {
    id: 'rota-1', name: 'Rota do Teste', owner_id: 'owner-1', vehicle_id: 'veic-1', direction: 'ida', turno: 'manha',
    monitor: false, monitor_ocupa_lugar: false, reserved_seats: 0, last_dropoff_min: 7 * 60, status: 'concluida', is_demo: false, is_published: true, price_month: 450, price_type: 'fixo',
    route_stops: [
      { id: 's', ordem: 0, type: 'saida', label: 'Garagem', lat: C.garagem.lat, lng: C.garagem.lng, confirmed: true, destination_id: null, leg_time_min: null, habitual_arrival_min: null },
      { id: 'a', ordem: 1, type: 'casa', label: 'Rua Secreta A, 123', lat: C.casaA.lat, lng: C.casaA.lng, confirmed: true, destination_id: null, leg_time_min: null, habitual_arrival_min: null },
      { id: 'b', ordem: 2, type: 'casa', label: 'Rua Secreta B, 456', lat: C.casaB.lat, lng: C.casaB.lng, confirmed: true, destination_id: null, leg_time_min: null, habitual_arrival_min: null },
      { id: 'e', ordem: 3, type: 'escola', label: 'Escola', lat: C.escola.lat, lng: C.escola.lng, confirmed: true, destination_id: 'esc1', leg_time_min: null, habitual_arrival_min: null },
    ],
    route_passengers: [
      { id: 'p1', identificacao: 'MarianaSegredo', board_stop_id: 'a', alight_stop_id: 'e', destination_id: 'esc1', horario_habitual_min: null },
    ],
  };
}

/** MOCK do provedor viário (Geoapify Route Matrix): 3 min / 900 m por par. */
function mockProvedorViario(ok = true) {
  const fetchMock = vi.fn(async (_url: unknown, init?: { body?: string }) => {
    if (!ok) return { ok: false, status: 502, json: async () => ({}) };
    const n = (JSON.parse(init?.body ?? '{}').sources ?? []).length as number;
    const sources_to_targets = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => ({ source_index: i, target_index: j, time: i === j ? 0 : 180, distance: i === j ? 0 : 900 })));
    return { ok: true, status: 200, json: async () => ({ sources_to_targets }) };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  process.env.VITE_SUPABASE_URL = 'https://exemplo.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key-teste';
  process.env.GEOAPIFY_API_KEY = 'geo-key-teste';
  estado.canned = {};
  estado.erros = {};
  delete process.env.BUSCAR_ROTAS_MAX_VIARIAS;
});
afterEach(() => { vi.unstubAllGlobals(); });

const pedido = { origem: C.familia, destinoId: 'esc1', sentido: 'ida', turno: 'manha', contratacao: 'mensal' };

describe('api/buscar-rotas (handler, mock Supabase)', () => {
  it('503 quando falta a service role', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = fakeRes();
    await handler(fakeReq(pedido), res as never);
    expect(res.statusCode).toBe(503);
  });

  it('rota publicada e concluída => compatível, com nome/van e SEM PII', async () => {
    const provedor = mockProvedorViario();
    estado.canned = {
      routes: [rotaRealCanon()],
      vehicles: [{ id: 'veic-1', seats_passenger: 6 }],
    };
    const res = fakeRes();
    await handler(fakeReq(pedido), res as never);
    expect(res.statusCode).toBe(200);
    const out = JSON.parse(res.body);
    expect(out.totalRotasAvaliadas).toBe(1);
    expect(out.resultados).toHaveLength(1);
    expect(out.resultados[0].rotaNome).toBe('Rota do Teste');
    expect(out.resultados[0].vanLugares).toBe(6);
    expect(out.resultados[0].status).toBe('compativel');
    // Confirmado com tempos REAIS do provedor viário (não com a estimativa).
    expect(out.resultados[0].temposEstimados).toBe(false);
    expect(provedor).toHaveBeenCalledTimes(1);
    expect(String(provedor.mock.calls[0][0])).toContain('routematrix');
    // Preço por aluno (valor fixo por aluno da van) é devolvido para o cartão.
    expect(out.resultados[0].precoMensal).toBe(450);
    expect(out.resultados[0].precoTipo).toBe('fixo');
    // SEM PII: nenhum nome de aluno nem endereço de casa na resposta.
    expect(res.body).not.toContain('Segredo');
    expect(res.body).not.toContain('Secreta');
    expect(res.body).not.toContain('identificacao');
  });

  it('sem chave do provedor viário => tempos estimados NUNCA confirmam (sob confirmação)', async () => {
    delete process.env.GEOAPIFY_API_KEY;
    const provedor = mockProvedorViario();
    estado.canned = { routes: [rotaRealCanon()], vehicles: [{ id: 'veic-1', seats_passenger: 6 }] };
    const res = fakeRes();
    await handler(fakeReq(pedido), res as never);
    const out = JSON.parse(res.body);
    expect(provedor).not.toHaveBeenCalled();
    expect(out.resultados).toHaveLength(1);
    expect(out.resultados[0].status).toBe('sob_confirmacao');
    expect(out.resultados[0].temposEstimados).toBe(true);
  });

  it('provedor viário fora do ar => idem: sob confirmação, nunca compatível', async () => {
    mockProvedorViario(false);
    estado.canned = { routes: [rotaRealCanon()], vehicles: [{ id: 'veic-1', seats_passenger: 6 }] };
    const res = fakeRes();
    await handler(fakeReq(pedido), res as never);
    const out = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(out.resultados[0].status).toBe('sob_confirmacao');
    expect(out.resultados[0].temposEstimados).toBe(true);
  });

  it('rota de outro turno (ida) não é avaliada', async () => {
    mockProvedorViario();
    estado.canned = { routes: [{ ...rotaRealCanon(), turno: 'tarde' }], vehicles: [{ id: 'veic-1', seats_passenger: 6 }] };
    const res = fakeRes();
    await handler(fakeReq(pedido), res as never);
    const out = JSON.parse(res.body);
    expect(out.resultados).toHaveLength(0);
    expect(out.totalRotasAvaliadas).toBe(0);
  });

  it('sem rotas => vazio (não vaza rota)', async () => {
    estado.canned = { routes: [], vehicles: [] };
    const res = fakeRes();
    await handler(fakeReq(pedido), res as never);
    expect(res.statusCode).toBe(200);
    const out = JSON.parse(res.body);
    expect(out.resultados).toHaveLength(0);
    expect(out.totalRotasAvaliadas).toBe(0);
  });

  it('origem ausente => 400', async () => {
    const res = fakeRes();
    await handler(fakeReq({ ...pedido, origem: null }), res as never);
    expect(res.statusCode).toBe(400);
  });

  /* ---------------- Regressões da auditoria de 10/11/2026 ---------------- */

  it('F05: o horário informado pela família chega ao servidor e é usado como exigência do novo aluno', async () => {
    mockProvedorViario();
    estado.canned = { routes: [rotaRealCanon()], vehicles: [{ id: 'veic-1', seats_passenger: 6 }] };
    // Precisa chegar às 06:00: a rota (limite 07:00) teria de sair cedo demais → não confirma.
    const cedo = fakeRes();
    await handler(fakeReq({ ...pedido, horarioMin: 6 * 60 }), cedo as never);
    const outCedo = JSON.parse(cedo.body);
    expect(outCedo.resultados[0].status).not.toBe('compativel');
    // Precisa chegar às 07:30: o horário da rota (até 07:00) atende → compatível, e a chegada mostrada respeita a rota.
    const tarde = fakeRes();
    await handler(fakeReq({ ...pedido, horarioMin: 7 * 60 + 30 }), tarde as never);
    const outTarde = JSON.parse(tarde.body);
    expect(outTarde.resultados[0].status).toBe('compativel');
    expect(outTarde.resultados[0].horarioEscolaMin).toBeLessThanOrEqual(7 * 60);
    // Valor inválido é ignorado (não derruba a busca).
    const invalido = fakeRes();
    await handler(fakeReq({ ...pedido, horarioMin: 99999 }), invalido as never);
    expect(invalido.statusCode).toBe(200);
  });

  it('F02: rota fora do orçamento viário fica INCONCLUSIVA (nunca "incompatível" por estimativa)', async () => {
    process.env.BUSCAR_ROTAS_MAX_VIARIAS = '1';
    mockProvedorViario();
    // Duas rotas iguais; a família mora LONGE: pela estimativa nenhuma cabe.
    estado.canned = { routes: [rotaRealCanon(), { ...rotaRealCanon(), id: 'rota-2', name: 'Rota Dois' }], vehicles: [{ id: 'veic-1', seats_passenger: 6 }] };
    const res = fakeRes();
    await handler(fakeReq({ ...pedido, origem: { lat: -21.7, lng: -50.95 } }), res as never);
    const out = JSON.parse(res.body);
    expect(out.totalRotasAvaliadas).toBe(2);
    const semMatriz = out.resultados.find((r: { temposEstimados: boolean }) => r.temposEstimados);
    expect(semMatriz).toBeTruthy();
    expect(semMatriz.status).toBe('indeterminado');
    expect(out.inconclusivas).toBeGreaterThanOrEqual(1);
  });

  it('F02: provedor viário fora do ar + estimativa negativa => inconclusivo, não recusa', async () => {
    mockProvedorViario(false);
    estado.canned = { routes: [rotaRealCanon()], vehicles: [{ id: 'veic-1', seats_passenger: 6 }] };
    const res = fakeRes();
    await handler(fakeReq({ ...pedido, origem: { lat: -21.7, lng: -50.95 } }), res as never);
    const out = JSON.parse(res.body);
    expect(out.resultados[0].status).toBe('indeterminado');
    expect(out.inconclusivas).toBe(1);
  });

  it('F10: erro ao consultar as vans é ERRO (500), não "nenhuma rota"', async () => {
    mockProvedorViario();
    estado.canned = { routes: [rotaRealCanon()] };
    estado.erros = { vehicles: { message: 'falha simulada' } };
    const res = fakeRes();
    await handler(fakeReq(pedido), res as never);
    expect(res.statusCode).toBe(500);
  });

  it('F10/F07: rota cuja van não veio do banco sai como inconclusiva (não some em silêncio)', async () => {
    mockProvedorViario();
    estado.canned = { routes: [rotaRealCanon()], vehicles: [] };
    const res = fakeRes();
    await handler(fakeReq(pedido), res as never);
    const out = JSON.parse(res.body);
    expect(out.resultados[0].status).toBe('indeterminado');
    expect(out.inconclusivas).toBe(1);
  });
});
