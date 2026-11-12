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

let seqIp = 0;
function fakeReq(body: unknown) {
  const texto = JSON.stringify(body);
  return {
    // IP distinto por requisição: o limite por IP do endpoint não é o que está em teste.
    method: 'POST', headers: { 'x-forwarded-for': `10.0.${Math.floor(++seqIp / 250)}.${seqIp % 250}` },
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

  it('Etapa 2C: rota com a oferta PAUSADA não é avaliada nem devolvida; a não pausada é', async () => {
    mockProvedorViario();
    estado.canned = {
      routes: [{ ...rotaRealCanon(), id: 'rota-pausada', oferta_pausada: true }, { ...rotaRealCanon(), oferta_pausada: false }],
      vehicles: [{ id: 'veic-1', seats_passenger: 6 }],
    };
    const res = fakeRes();
    await handler(fakeReq(pedido), res as never);
    const out = JSON.parse(res.body);
    expect(out.totalRotasAvaliadas).toBe(1);
    expect(out.resultados.map((r: { rotaId: string }) => r.rotaId)).toEqual(['rota-1']);
  });

  it('Etapa 2C: "is_published" legado não esconde rota concluída (sem publicação extra)', async () => {
    mockProvedorViario();
    estado.canned = { routes: [{ ...rotaRealCanon(), is_published: false }], vehicles: [{ id: 'veic-1', seats_passenger: 6 }] };
    const res = fakeRes();
    await handler(fakeReq(pedido), res as never);
    expect(JSON.parse(res.body).resultados).toHaveLength(1);
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

  it('sem chave do provedor viário => nada é confirmado NEM recusado por estimativa: avaliação incompleta', async () => {
    delete process.env.GEOAPIFY_API_KEY;
    const provedor = mockProvedorViario();
    estado.canned = { routes: [rotaRealCanon()], vehicles: [{ id: 'veic-1', seats_passenger: 6 }] };
    const res = fakeRes();
    await handler(fakeReq(pedido), res as never);
    const out = JSON.parse(res.body);
    expect(provedor).not.toHaveBeenCalled();
    expect(out.resultados).toHaveLength(1);
    // Estimativa não é prova de viabilidade: sem consulta às ruas não há cartão com horário.
    expect(out.resultados[0]).toMatchObject({ status: 'indeterminado', pendencia: 'avaliacao_incompleta', passagemCasaMin: null, horarioEscolaMin: null, vagas: null });
    expect(out.semProvedor).toBe(true);
    expect(out.continuacao).toBeNull();
    expect(out.resumo).toMatchObject({ candidatas: 1, avaliacaoIncompleta: 1, incompativeis: 0 });
  });

  it('provedor viário fora do ar => avaliação incompleta (com continuação para tentar de novo), nunca compatível nem incompatível', async () => {
    mockProvedorViario(false);
    estado.canned = { routes: [rotaRealCanon()], vehicles: [{ id: 'veic-1', seats_passenger: 6 }] };
    const res = fakeRes();
    await handler(fakeReq(pedido), res as never);
    const out = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(out.resultados[0]).toMatchObject({ status: 'indeterminado', pendencia: 'avaliacao_incompleta', horarioEscolaMin: null });
    expect(out.continuacao).toMatchObject({ inicio: 1, repetir: ['rota-1'] });
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
    // Só uma coube no orçamento desta chamada; a outra AGUARDA (não vira recusa nem some).
    expect(out.resultados).toHaveLength(1);
    expect(out.aguardando).toBe(1);
    expect(out.continuacao).toMatchObject({ inicio: 1, repetir: [] });
    expect(out.inconclusivas).toBeGreaterThanOrEqual(1);
    expect(out.resultados.some((r: { status: string; temposEstimados: boolean }) => r.status === 'incompativel' && r.temposEstimados)).toBe(false);
    // Continuar calcula a que ficou de fora — e a fila acaba.
    const res2 = fakeRes();
    await handler(fakeReq({ ...pedido, origem: { lat: -21.7, lng: -50.95 }, continuacao: out.continuacao }), res2 as never);
    const out2 = JSON.parse(res2.body);
    expect(out2.resultados).toHaveLength(1);
    expect(out2.resultados[0].rotaId).not.toBe(out.resultados[0].rotaId);
    expect(out2.aguardando).toBe(0);
    expect(out2.continuacao).toBeNull();
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

  it('NENHUM dado de quem já está na rota sai na resposta — em qualquer situação (cabe, não cabe, incompleta, dados insuficientes)', async () => {
    const privados = ['Segredo', 'Secreta', 'identificacao', 'board_stop_id', 'route_passengers', 'route_stops', 'owner', 'codigos', 'aprovacoes', 'alteracoes', 'eventos', 'trechos',
      String(C.casaA.lat), String(C.casaA.lng), String(C.casaB.lat), String(C.casaB.lng), String(C.garagem.lat)];
    const conferir = (corpo: string) => { for (const p of privados) expect(corpo, `vazou "${p}"`).not.toContain(p); };
    const campos = ['rotaId', 'rotaNome', 'demo', 'precoMensal', 'precoTipo', 'vanLugares', 'vagas', 'atendeEscola', 'origemEscola', 'sentido', 'status', 'pendencia',
      'passagemCasaMin', 'horarioEscolaMin', 'minutosABordo', 'fonteHorario', 'temposEstimados', 'motivo',
      'versao'].sort(); // `versao`: resumo opaco da rota + van avaliadas (não revela dado; serve para invalidar avaliação antiga)
    const rodar = async (corpo: unknown) => { const res = fakeRes(); await handler(fakeReq(corpo), res as never); conferir(res.body); return JSON.parse(res.body); };

    estado.canned = { routes: [rotaRealCanon()], vehicles: [{ id: 'veic-1', seats_passenger: 6 }] };
    mockProvedorViario();
    const cabe = await rodar(pedido);
    expect(cabe.resultados[0].status).toBe('compativel');
    expect(Object.keys(cabe.resultados[0]).sort()).toEqual(campos); // lista fechada de campos públicos
    // Precisa chegar até 4h00: exigiria sair mais de 1 h antes do habitual → não cabe (calculado).
    const naoCabe = await rodar({ ...pedido, horarioMin: 4 * 60 });
    expect(naoCabe.resultados[0].status).toBe('incompativel');
    mockProvedorViario(false);
    expect((await rodar(pedido)).resultados[0].pendencia).toBe('avaliacao_incompleta');
    estado.canned = { routes: [rotaRealCanon()], vehicles: [] };
    expect((await rodar(pedido)).resultados[0].pendencia).toBe('dados_insuficientes');
  });

  it('vaga exibida é a do TRECHO calculado: van lotada no pico não devolve "0 vagas"', async () => {
    mockProvedorViario();
    // 1 aluno a bordo; van de 2 lugares → pico não lotado; van de 1 lugar → lotada no pico.
    for (const lugares of [2, 1]) {
      estado.canned = { routes: [rotaRealCanon()], vehicles: [{ id: 'veic-1', seats_passenger: lugares }] };
      const res = fakeRes();
      await handler(fakeReq(pedido), res as never);
      const r = JSON.parse(res.body).resultados[0];
      expect(r.vagas).not.toBe(0);
      if (r.status === 'compativel' || r.status === 'sob_confirmacao') expect(r.vagas).toBeGreaterThanOrEqual(1);
      else expect(r.vagas).toBeNull();
    }
  });

  it('continuação malformada vinda do navegador é ignorada (não amplia nem derruba a busca)', async () => {
    mockProvedorViario();
    estado.canned = { routes: [rotaRealCanon()], vehicles: [{ id: 'veic-1', seats_passenger: 6 }] };
    for (const continuacao of ['x', { inicio: -5, repetir: 'rota-1' }, { inicio: 1e9, repetir: [1, null, 'a'.repeat(500)] }, null]) {
      const res = fakeRes();
      await handler(fakeReq({ ...pedido, continuacao }), res as never);
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).resultados[0].status).toBe('compativel');
    }
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
