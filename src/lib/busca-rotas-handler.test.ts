import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Teste ISOLADO do handler server-side (api/buscar-rotas) com MOCK do Supabase
 * (claramente identificado como mock — NÃO comprova o banco de produção).
 * Verifica a cola: elegibilidade (anúncio ativo), uso do motor e AUSÊNCIA DE PII.
 */

const estado: { canned: Record<string, unknown[]> } = { canned: {} };

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      const self = () => b;
      b.select = self; b.eq = self; b.in = self; b.limit = self; b.order = self; b.range = self;
      b.then = (resolve: (v: { data: unknown[]; error: null }) => void) =>
        resolve({ data: estado.canned[table] ?? [], error: null });
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

beforeEach(() => {
  process.env.VITE_SUPABASE_URL = 'https://exemplo.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key-teste';
  estado.canned = {};
});

const pedido = { origem: C.familia, destinoId: 'esc1', sentido: 'ida', turno: 'manha', contratacao: 'mensal' };

describe('api/buscar-rotas (handler, mock Supabase)', () => {
  it('503 quando falta a service role', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = fakeRes();
    await handler(fakeReq(pedido), res as never);
    expect(res.statusCode).toBe(503);
  });

  it('rota publicada e concluída => compatível, com nome/van e SEM PII', async () => {
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
    // Preço por aluno (valor fixo por aluno da van) é devolvido para o cartão.
    expect(out.resultados[0].precoMensal).toBe(450);
    expect(out.resultados[0].precoTipo).toBe('fixo');
    // SEM PII: nenhum nome de aluno nem endereço de casa na resposta.
    expect(res.body).not.toContain('Segredo');
    expect(res.body).not.toContain('Secreta');
    expect(res.body).not.toContain('identificacao');
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
});
