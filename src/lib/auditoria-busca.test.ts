import { describe, it, expect, vi, afterEach } from 'vitest';
import { avaliarRotaReal as avaliarRotaRealNucleo, buscarEmRotasReais as buscarEmRotasReaisNucleo, candidatasParaBusca, distanciaAoSegmentoM, rotaPassaPertoDaEscola, type PedidoFamilia } from './busca-rotas-reais';
import { montarRotaAncorada, simularEncaixeProgressivo } from './rota-para-encaixe';
import { criarMatrizDemo, type MatrizViaria } from './encaixe';
import { buscarRotasReais } from './busca-rotas-reais-cliente';
import { criteriosParaParams, horaParaMinutoDoDia, paramsParaCriterios } from './searchParams';
import { PARADA_ESCOLA_MIN } from './tempos-parada';
import type { Rota, Veiculo, ParadaRota, PassageiroRota } from '@/types/motorista';

/**
 * Regressões da auditoria técnica da busca (10/11/2026): cada defeito
 * reproduzido lá vira aqui o comportamento DESEJADO.
 */

const FIXTURE: MatrizViaria = { ...criarMatrizDemo(), origem: 'fixture-testada' };
const avaliarRotaReal = (r: Rota, v: Veiculo | null, p: PedidoFamilia, m: MatrizViaria = FIXTURE) => avaliarRotaRealNucleo(r, v, p, m);
const buscarEmRotasReais = (e: Parameters<typeof buscarEmRotasReaisNucleo>[0], p: PedidoFamilia, m: MatrizViaria = FIXTURE) => buscarEmRotasReaisNucleo(e, p, m);
/** Origem longe demais para caber em qualquer antecipação (≈60 km). */
const LONGE = { lat: -21.7, lng: -50.95 };
const C = {
  garagem: { lat: -21.2050, lng: -50.4400 }, casaA: { lat: -21.1995, lng: -50.4402 }, casaB: { lat: -21.2100, lng: -50.4300 },
  escola: { lat: -21.2089, lng: -50.4328 }, familia: { lat: -21.2010, lng: -50.4388 },
};
const van = (lugares: number): Veiculo => ({ id: 'v1', modelo: 'Van', lugaresPassageiro: lugares, arCondicionado: false, acessivel: false, cintos: true, fotos: [] });
const parada = (id: string, ordem: number, tipo: ParadaRota['tipo'], c: { lat: number; lng: number }, extra: Partial<ParadaRota> = {}): ParadaRota =>
  ({ id, ordem, tipo, rotulo: id, confirmado: true, lat: c.lat, lng: c.lng, ...extra });
const pax = (id: string, emb: string, des: string, extra: Partial<PassageiroRota> = {}): PassageiroRota => ({ id, identificacao: id, embarqueParadaId: emb, desembarqueParadaId: des, destinoId: 'esc1', ...extra });
function rotaIda(over: Partial<Rota> = {}): Rota {
  return {
    id: 'rota-ida', nome: 'Ida', sentido: 'ida', turno: 'manha', dias: ['seg'], veiculoId: 'v1', monitor: false, monitorOcupaLugar: false,
    lugaresReservados: 0, ultimoDesembarqueMin: 7 * 60, limiteAntecipacaoMin: null, status: 'concluida', atualizadoEm: '',
    paradas: [parada('s', 0, 'saida', C.garagem), parada('a', 1, 'casa', C.casaA), parada('b', 2, 'casa', C.casaB), parada('e', 3, 'escola', C.escola, { destinoId: 'esc1', destinoNome: 'Escola' })],
    passageiros: [pax('p1', 'a', 'e'), pax('p2', 'b', 'e')],
    ...over,
  };
}
const pedido = (over: Partial<PedidoFamilia> = {}): PedidoFamilia => ({ origem: C.familia, destinoId: 'esc1', sentido: 'ida', turno: 'manha', contratacao: 'mensal', ...over });
const familia = { alunoId: 'familia', nome: 'F', casa: { id: 'familia-casa', nome: 'Casa', ...C.familia }, escolaId: 'esc1' };

describe('F01/F07 — capacidade: por trecho, nunca por pico; zero é zero', () => {
  it('van de 1 lugar: aluno atual até a escola X; família embarca DEPOIS de X e desce em Y → cabe', () => {
    const rota = rotaIda({
      paradas: [parada('s', 0, 'saida', C.garagem), parada('a', 1, 'casa', C.casaA), parada('ex', 2, 'escola', C.escola, { destinoId: 'escX', destinoNome: 'X' }), parada('b', 3, 'casa', C.casaB), parada('ey', 4, 'escola', { lat: -21.2150, lng: -50.4250 }, { destinoId: 'escY', destinoNome: 'Y', horarioChegadaMin: 7 * 60 + 30 })],
      passageiros: [pax('p1', 'a', 'ex', { destinoId: 'escX' })],
    });
    const r = avaliarRotaReal(rota, van(1), pedido({ destinoId: 'escY', origem: C.casaB }));
    expect(r.vagas).toBe(0);
    expect(r.status).toBe('compativel');
    expect(candidatasParaBusca([{ rota, veiculo: van(1) }], pedido({ destinoId: 'escY' }))).toHaveLength(1);
  });
  it('monitor ocupando o único lugar: capacidade ZERO não vira 1 no simulador', () => {
    const rota = rotaIda({ monitor: true, monitorOcupaLugar: true, passageiros: [] });
    const sim = simularEncaixeProgressivo(rota, van(1), familia, FIXTURE, { horarioEscolaMin: 7 * 60 });
    expect(sim.elegivel).toBe(false);
    expect(sim.codigos).toEqual(['capacidade']);
    expect(candidatasParaBusca([{ rota, veiculo: van(1) }], pedido())).toHaveLength(0);
  });
  it('sem van cadastrada o simulador não inventa lugares: inconclusivo', () => {
    const sim = simularEncaixeProgressivo(rotaIda(), null, familia, FIXTURE, { horarioEscolaMin: 7 * 60 });
    expect(sim.elegivel).toBe(false);
    expect(sim.codigos).toEqual(['van']);
  });
});

describe('F02 — estimativa nunca prova impossibilidade', () => {
  it('matriz de demonstração + recusa por horário → indeterminado; recusa estrutural continua incompatível', () => {
    const longe = avaliarRotaReal(rotaIda(), van(4), pedido({ origem: LONGE }), criarMatrizDemo());
    expect(longe.status).toBe('indeterminado');
    expect(longe.temposEstimados).toBe(true);
    const outraEscola = avaliarRotaReal(rotaIda(), van(4), pedido({ destinoId: 'esc-outra' }), criarMatrizDemo());
    expect(outraEscola.status).toBe('incompativel');
    expect(outraEscola.codigos).toContain('escola_itinerario');
  });
});

describe('F03 — busca não concluída é inconclusiva, mesmo com outros motivos', () => {
  it('rota extensa (> 8 compromissos) sem inserção simples → indeterminado com busca_incompleta', () => {
    // 8 casas distantes entre si + escola: a inserção simples não cabe no horário e a reorganização não é explorada.
    const casas = Array.from({ length: 8 }, (_, i) => parada('c' + i, i + 1, 'casa', { lat: -21.19 - i * 0.004, lng: -50.47 + i * 0.004 }));
    const rota = rotaIda({
      paradas: [parada('s', 0, 'saida', C.garagem), ...casas, parada('e', 9, 'escola', C.escola, { destinoId: 'esc1', destinoNome: 'Escola', horarioChegadaMin: 7 * 60 })],
      passageiros: casas.map((c, i) => pax('p' + i, c.id, 'e')),
      limiteAntecipacaoMin: 0,
    });
    const r = avaliarRotaReal(rota, van(20), pedido({ origem: LONGE }));
    expect(r.status).toBe('indeterminado');
    expect(r.codigos[0]).toBe('busca_incompleta');
    expect(buscarEmRotasReais([{ rota, veiculo: van(20) }], pedido({ origem: LONGE })).inconclusivas).toBe(1);
  });
});

describe('F04 — o cliente separa "inconclusivas" de "nenhuma rota"', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('resposta com rota indeterminada → zero cartões, mas inconclusivas = 1', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ resultados: [{ rotaId: 'r', rotaNome: 'R', status: 'indeterminado', sentido: 'ida', vagas: 1, atendeEscola: true, passagemCasaMin: null, horarioEscolaMin: null, minutosABordo: null, motivo: 'x', vanLugares: 4 }], inconclusivas: 1 }) })));
    const r = await buscarRotasReais({ cidadeId: 'c', endereco: 'x', destinoId: 'esc1', turno: 'manha', contratacao: 'mensal', modalidade: 'ida', origemLat: -21.2, origemLng: -50.4, horario: '07:30' });
    expect(r.estado).toBe('ok');
    expect(r.resultados).toHaveLength(0);
    expect(r.inconclusivas).toBe(1);
    // F05: o horário vai no corpo da requisição, em minutos.
    const corpo = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as { body: string }).body);
    expect(corpo.horarioMin).toBe(450);
  });
});

describe('F05 — horário da família na URL e no cálculo', () => {
  it('vai e volta pela URL e vira minuto do dia', () => {
    const c = paramsParaCriterios(new URLSearchParams(criteriosParaParams({ cidadeId: 'c', endereco: 'x', destinoId: 'esc1', turno: null, contratacao: 'mensal', modalidade: 'volta', horario: '12:15' })));
    expect(c.horario).toBe('12:15');
    expect(horaParaMinutoDoDia(c.horario)).toBe(735);
    expect(horaParaMinutoDoDia('25:00')).toBeNull();
  });
  it('ida: exigência da família mais cedo que a âncora da rota muda o veredito; mais tarde não afrouxa a rota', () => {
    const base = avaliarRotaReal(rotaIda(), van(4), pedido());
    expect(base.status).toBe('compativel');
    const cedo = avaliarRotaReal(rotaIda(), van(4), pedido({ horarioFamiliaMin: 6 * 60 }));
    expect(cedo.status).not.toBe('compativel');
    const tarde = avaliarRotaReal(rotaIda(), van(4), pedido({ horarioFamiliaMin: 8 * 60 }));
    expect(tarde.status).toBe('compativel');
    expect(tarde.horarioEscolaMin!).toBeLessThanOrEqual(7 * 60); // a rota continua chegando até 07:00
  });
  it('volta: a família só pode sair da escola a partir do horário informado', () => {
    const volta = rotaIda({
      id: 'rota-volta', sentido: 'volta', ultimoDesembarqueMin: null,
      paradas: [parada('s', 0, 'saida', C.garagem), parada('e', 1, 'escola', C.escola, { destinoId: 'esc1', destinoNome: 'Escola', horarioChegadaMin: 12 * 60 }), parada('a', 2, 'casa', C.casaA), parada('b', 3, 'casa', C.casaB)],
      passageiros: [pax('p1', 'e', 'a'), pax('p2', 'e', 'b')],
    });
    const ok = avaliarRotaReal(volta, van(4), pedido({ sentido: 'volta', turno: 'tarde', horarioFamiliaMin: 11 * 60 + 50 }));
    expect(ok.status).toBe('compativel');
    expect(ok.horarioEscolaMin!).toBeGreaterThanOrEqual(11 * 60 + 50);
    const tarde = avaliarRotaReal(volta, van(4), pedido({ sentido: 'volta', turno: 'tarde', horarioFamiliaMin: 13 * 60 }));
    expect(tarde.status).not.toBe('compativel');
  });
});

describe('F06 — o horário combinado com a família atual não é deslocado', () => {
  it('aluno com 06:00 ± 0 numa rota que só passa às ~06:50: a rota-base fica inválida e a busca não recusa ninguém por isso', () => {
    const rota = rotaIda({ passageiros: [pax('p1', 'a', 'e', { horarioHabitualMin: 6 * 60, ajusteAntesMin: 0, ajusteDepoisMin: 0 }), pax('p2', 'b', 'e')] });
    const montada = montarRotaAncorada(rota, van(4), FIXTURE, { horarioEscolaMin: 7 * 60 }, 'esc1')!;
    const emb = montada.rotaOp.compromissos.find((c) => c.id === 'emb:p1')!;
    expect(emb.janela).toEqual({ inicioMin: 360, fimMin: 360 });
    expect(montada.base.valido).toBe(false);
    const r = avaliarRotaReal(rota, van(4), pedido());
    expect(r.status).toBe('indeterminado');
    expect(r.codigos).toContain('rota_base');
  });
  it('horário combinado SEM ajustes informados vale como referência (tolerância da rota), não é ignorado', () => {
    const rota = rotaIda({ passageiros: [pax('p1', 'a', 'e', { horarioHabitualMin: 6 * 60 + 50 }), pax('p2', 'b', 'e')] });
    const montada = montarRotaAncorada(rota, van(4), FIXTURE, { horarioEscolaMin: 7 * 60 }, 'esc1')!;
    expect(montada.rotaOp.compromissos.find((c) => c.id === 'emb:p1')!.horarioBaseMin).toBe(410);
  });
});

describe('F08 — escola no CORREDOR entre duas paradas distantes é candidata', () => {
  it('distância ao segmento e pré-filtro', () => {
    const a = { lat: -21.20, lng: -50.50 }, b = { lat: -21.20, lng: -50.40 };
    const noMeio = { lat: -21.205, lng: -50.45 }; // ~550 m ao sul do corredor
    expect(distanciaAoSegmentoM(noMeio, a, b)).toBeLessThan(700);
    expect(distanciaAoSegmentoM({ lat: -21.20, lng: -50.30 }, a, b)).toBeGreaterThan(9000);
    const rota = rotaIda({ paradas: [parada('s', 0, 'saida', a), parada('a', 1, 'casa', a), parada('e', 2, 'escola', b, { destinoId: 'esc1', destinoNome: 'E' })], passageiros: [pax('p1', 'a', 'e')] });
    expect(rotaPassaPertoDaEscola(rota, noMeio)).toBe(true);
    expect(rotaPassaPertoDaEscola(rota, { lat: -21.26, lng: -50.45 })).toBe(false);
  });
});

describe('F09 — tempo na escola é do grupo: o novo aluno não soma', () => {
  it('escola já no itinerário: desvio do encaixe não inclui tempo extra na escola; escola nova inclui a parada escolar uma vez', () => {
    const noItinerario = simularEncaixeProgressivo(rotaIda(), van(4), familia, FIXTURE, { horarioEscolaMin: 7 * 60 })!;
    const evEscola = noItinerario.opcao!.eventos.find((e) => e.compromisso.id === 'novo:desembarque:familia')!;
    expect(evEscola.saidaMin - evEscola.chegadaMin).toBe(0);
    const outraEscola = { ...familia, escolaId: 'esc2', escolaPonto: { id: 'esc2', nome: 'Nova', lat: -21.2150, lng: -50.4250 } };
    const nova = simularEncaixeProgressivo(rotaIda({ ultimoDesembarqueMin: null }), van(4), outraEscola, FIXTURE, { horarioEscolaMin: 7 * 60 + 40 });
    expect(nova.elegivel).toBe(true);
    const evNova = nova.opcao!.eventos.find((e) => e.compromisso.id === 'novo:desembarque:familia')!;
    expect(evNova.saidaMin - evNova.chegadaMin).toBe(PARADA_ESCOLA_MIN);
  });
});

describe('F11 — matriz estimada: mesma coordenada com ids diferentes = 0 min', () => {
  it('duas casas no mesmo ponto não ganham 1 minuto artificial', () => {
    const m = criarMatrizDemo();
    expect(m.obter({ id: 'x', nome: 'x', lat: -21.2, lng: -50.4 }, { id: 'y', nome: 'y', lat: -21.2, lng: -50.4 }, 0)).toEqual({ minutos: 0, metros: 0 });
  });
});
