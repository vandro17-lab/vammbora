import { describe, it, expect } from 'vitest';
// @ts-expect-error — módulo .mjs sem tipos (gerador determinístico do pacote demo).
import { gerarBaseDemo, haversineMetros } from '../../scripts/demo-aracatuba/gerar.mjs';
// @ts-expect-error — dados .mjs sem tipos.
import { DESTINOS, PONTOS } from '../../scripts/demo-aracatuba/dados.mjs';
import * as nucleo from '@/lib/busca-rotas-reais';
import { type EntradaBuscaReal, type PedidoFamilia } from '@/lib/busca-rotas-reais';
import { criarMatrizDemo, type MatrizViaria } from '@/lib/encaixe';
import { picoOcupacao, capacidadeAlunos } from '@/lib/ocupacao-rota';
import type { Rota, Veiculo } from '@/types/motorista';

/** Matriz de TESTE (origem 'fixture-testada'): mesmos números determinísticos
 *  da estimativa por coordenadas, mas declarada como fixture — o núcleo não tem
 *  matriz padrão e rebaixa a origem 'demonstracao' para "sob confirmação". */
const FIXTURE: MatrizViaria = { ...criarMatrizDemo(), origem: 'fixture-testada' };
const avaliarRotaReal = (r: Rota, v: Veiculo | null, p: PedidoFamilia, m: MatrizViaria = FIXTURE) => nucleo.avaliarRotaReal(r, v, p, m);
const buscarEmRotasReais = (e: EntradaBuscaReal[], p: PedidoFamilia, m: MatrizViaria = FIXTURE) => nucleo.buscarEmRotasReais(e, p, m);

/**
 * Testes de INTEGRAÇÃO da base demonstrativa (pacote VB150) contra o MESMO motor
 * usado pelo endpoint público `/api/buscar-rotas` (buscarEmRotasReais). Provam a
 * base gerada (§9) e que a busca calcula encaixes de verdade (§6.2/§9.1).
 */

type Entrada = EntradaBuscaReal;
const BASE = gerarBaseDemo() as {
  drivers: unknown[]; vehicles: unknown[]; driverDestinations: { driver_id: string; destination_id: string }[];
  routesDb: Array<{ id: string; direction: string; vehicle_id: string; monitor_ocupa_lugar: boolean; reserved_seats: number; stops: Array<{ id: string; type: string; habitual_arrival_min: number | null; lat: number; lng: number; destination_id: string | null }>; passengers: Array<{ board_stop_id: string; alight_stop_id: string }> }>;
  routesDomain: Array<{ rota: Rota; veiculo: Veiculo }>;
  meta: { nMotoristas: number; nVeiculos: number; nRotas: number };
};
const ENTRADAS = BASE.routesDomain as unknown as Entrada[];
const BBOX = { s: -21.27, n: -21.14, w: -50.52, e: -50.38 };
const destino = (id: string) => DESTINOS.find((d: { id: string }) => d.id === id)!;
const pontoPertoDe = (d: { lat: number; lng: number }, min = 300, max = 1200) =>
  PONTOS.map((p: { lat: number; lng: number }) => ({ p, dist: haversineMetros(d, p) }))
    .filter((x: { dist: number }) => x.dist >= min && x.dist <= max)
    .sort((a: { dist: number }, b: { dist: number }) => a.dist - b.dist)[0]?.p ?? null;

describe('Base demonstrativa VB150 — integridade dos dados (§9)', () => {
  it('150 motoristas, 150 veículos, 300 rotas (150 ida + 150 volta)', () => {
    expect(BASE.drivers.length).toBe(150);
    expect(BASE.vehicles.length).toBe(150);
    expect(BASE.routesDb.length).toBe(300);
    expect(BASE.routesDb.filter((r) => r.direction === 'ida').length).toBe(150);
    expect(BASE.routesDb.filter((r) => r.direction === 'volta').length).toBe(150);
  });

  it('todos os 41 destinos escolares reais têm cobertura (rota + vínculo)', () => {
    const viaRota = new Set<string>();
    for (const r of BASE.routesDb) for (const s of r.stops) if (s.type === 'escola' && s.destination_id) viaRota.add(s.destination_id);
    const viaVinc = new Set(BASE.driverDestinations.map((d) => d.destination_id));
    for (const d of DESTINOS as { id: string }[]) {
      expect(viaRota.has(d.id), `rota cobre ${d.id}`).toBe(true);
      expect(viaVinc.has(d.id), `vínculo cobre ${d.id}`).toBe(true);
    }
  });

  it('cada motorista tem ao menos uma ida e uma volta', () => {
    const porDriver = new Map<string, Set<string>>();
    for (const r of BASE.routesDb) {
      const did = (r as { driver_id?: string }).driver_id!;
      if (!porDriver.has(did)) porDriver.set(did, new Set());
      porDriver.get(did)!.add(r.direction);
    }
    expect(porDriver.size).toBe(150);
    for (const [, dirs] of porDriver) { expect(dirs.has('ida')).toBe(true); expect(dirs.has('volta')).toBe(true); }
  });

  it('coordenadas dentro da região de Araçatuba; pontos de embarque têm fonte OSM', () => {
    for (const r of BASE.routesDb) for (const s of r.stops) {
      expect(s.lat > BBOX.s && s.lat < BBOX.n && s.lng > BBOX.w && s.lng < BBOX.e, `bbox ${s.id}`).toBe(true);
    }
    // nenhum ponto de embarque (casa/saida) está SOBRE a coordenada da escola.
    for (const r of BASE.routesDb) {
      const escolas = r.stops.filter((s) => s.type === 'escola');
      for (const s of r.stops.filter((x) => x.type !== 'escola')) {
        for (const e of escolas) expect(s.lat !== e.lat || s.lng !== e.lng).toBe(true);
      }
    }
    // todo ponto OSM da base é verificável e não é escola.
    expect(PONTOS.every((p: { osm_id: string; tipo: string }) => p.osm_id && p.tipo !== 'school')).toBe(true);
  });

  it('nenhum passageiro sem rota; embarque/desembarque válidos; sem parada órfã', () => {
    for (const r of BASE.routesDb) {
      expect(r.passengers.length).toBeGreaterThan(0);
      const ids = new Set(r.stops.map((s) => s.id));
      for (const p of r.passengers) {
        expect(ids.has(p.board_stop_id)).toBe(true);
        expect(ids.has(p.alight_stop_id)).toBe(true);
        expect(p.board_stop_id).not.toBe(p.alight_stop_id);
      }
    }
  });

  it('horários crescentes conforme a sequência das paradas', () => {
    for (const r of BASE.routesDb) {
      const hs = r.stops.map((s) => s.habitual_arrival_min).filter((v): v is number => v != null);
      for (let i = 1; i < hs.length; i++) expect(hs[i]).toBeGreaterThanOrEqual(hs[i - 1]);
    }
  });

  it('capacidade respeitada no pico e ocupação variada (lotadas e com vaga)', () => {
    let lotadas = 0; let comVaga = 0;
    for (const { rota, veiculo } of BASE.routesDomain) {
      const cap = capacidadeAlunos(rota, veiculo);
      expect(picoOcupacao(rota)).toBeLessThanOrEqual(cap);
      const vagas = cap - picoOcupacao(rota);
      if (vagas === 0) lotadas++; else comVaga++;
    }
    expect(lotadas).toBeGreaterThan(0);
    expect(comVaga).toBeGreaterThan(0);
  });
});

describe('Busca real com o motor do endpoint (§6.2/§9.1)', () => {
  // Cenários: origem = ponto público real perto da escola; destino = escola real.
  const cenarios = [
    { destinoId: 'geo-20261105-007', nome: 'EE José Cândido (Higienópolis)', sentido: 'ida' as const },
    { destinoId: 'geo-20261105-004', nome: 'EE Jorge Corrêa (Jardim Sumaré)', sentido: 'ida' as const },
    { destinoId: 'geo-20261105-039', nome: 'UNESP (Vila Mendonça)', sentido: 'ida' as const },
    { destinoId: 'geo-20261105-013', nome: 'EMEB Alvino Barbosa (Etemp/norte)', sentido: 'ida' as const },
    { destinoId: 'geo-20261105-007', nome: 'EE José Cândido (Higienópolis)', sentido: 'volta' as const },
  ];

  for (const c of cenarios) {
    it(`encontra encaixes viáveis para ${c.nome} [${c.sentido}]`, () => {
      const esc = destino(c.destinoId);
      const origem = pontoPertoDe(esc, 300, 1400);
      expect(origem, 'há ponto público perto da escola').toBeTruthy();
      const pedido: PedidoFamilia = {
        origem: { lat: origem.lat, lng: origem.lng }, destinoId: c.destinoId,
        escolaPonto: { lat: esc.lat, lng: esc.lng }, sentido: c.sentido, turno: null, contratacao: 'mensal',
      };
      const { resultados, totalRotasAvaliadas } = buscarEmRotasReais(ENTRADAS, pedido);
      const viaveis = resultados.filter((r) => r.status === 'compativel' || r.status === 'sob_confirmacao');
      const melhor = viaveis[0];
      // Relatório honesto do cenário (aparece no output do teste).
      // eslint-disable-next-line no-console
      console.log(`[CENARIO] ${c.nome} ${c.sentido} | origem=(${origem.lat.toFixed(5)},${origem.lng.toFixed(5)}) | avaliadas=${totalRotasAvaliadas} | viaveis=${viaveis.length}` +
        (melhor ? ` | melhor: rota=${melhor.rotaId.slice(0, 13)} vagas=${melhor.vagas} aBordo=${melhor.minutosABordo}min status=${melhor.status} motivo="${melhor.motivo}"` : ' | (nenhum)'));
      expect(totalRotasAvaliadas).toBeGreaterThan(0);
      expect(viaveis.length).toBeGreaterThan(0);
      expect(melhor.minutosABordo == null || melhor.minutosABordo >= 0).toBe(true);
      expect(melhor.vagas).toBeGreaterThan(0);
    });
  }

  it('ordena pela MELHOR experiência do aluno: menor tempo a bordo primeiro (§6.3)', () => {
    const esc = destino('geo-20261105-004');
    const origem = pontoPertoDe(esc, 300, 1400);
    const { resultados } = buscarEmRotasReais(ENTRADAS, {
      origem: { lat: origem.lat, lng: origem.lng }, destinoId: 'geo-20261105-004',
      escolaPonto: { lat: esc.lat, lng: esc.lng }, sentido: 'ida', turno: null, contratacao: 'mensal',
    });
    const comp = resultados.filter((r) => r.status === 'compativel' && r.minutosABordo != null);
    // dentro do mesmo status, minutosABordo deve ser não-decrescente.
    for (let i = 1; i < comp.length; i++) {
      expect(comp[i].minutosABordo!).toBeGreaterThanOrEqual(comp[i - 1].minutosABordo!);
    }
  });

  it('origens/escolas diferentes produzem resultados diferentes', () => {
    const a = destino('geo-20261105-013'); // norte (Etemp)
    const b = destino('geo-20261105-005'); // sul (Jardim Alvorada)
    const pa = pontoPertoDe(a), pb = pontoPertoDe(b);
    const resA = buscarEmRotasReais(ENTRADAS, { origem: { lat: pa.lat, lng: pa.lng }, destinoId: a.id, escolaPonto: { lat: a.lat, lng: a.lng }, sentido: 'ida', turno: null, contratacao: 'mensal' });
    const resB = buscarEmRotasReais(ENTRADAS, { origem: { lat: pb.lat, lng: pb.lng }, destinoId: b.id, escolaPonto: { lat: b.lat, lng: b.lng }, sentido: 'ida', turno: null, contratacao: 'mensal' });
    // O melhor resultado (rota de topo) de cada busca é diferente, e os conjuntos
    // de rotas compatíveis não são idênticos.
    const compatA = resA.resultados.filter((r) => r.status === 'compativel').map((r) => r.rotaId);
    const compatB = resB.resultados.filter((r) => r.status === 'compativel').map((r) => r.rotaId);
    expect(compatA[0]).not.toBe(compatB[0]);
    expect(JSON.stringify(compatA)).not.toBe(JSON.stringify(compatB));
  });

  it('rejeita encaixe inviável por CAPACIDADE: rota lotada → incompatível (não vira compatível)', () => {
    // Pega uma rota demo lotada (vagas 0) e avalia direto no motor um aluno novo
    // para a escola dela: deve recusar por capacidade, nunca "compatível".
    const lotada = BASE.routesDomain.find(({ rota, veiculo }) => {
      const cap = capacidadeAlunos(rota, veiculo);
      return rota.sentido === 'ida' && cap - picoOcupacao(rota) === 0 && rota.paradas.some((p) => p.tipo === 'escola');
    });
    expect(lotada, 'há ao menos uma rota de ida lotada').toBeTruthy();
    const esc = lotada!.rota.paradas.find((p) => p.tipo === 'escola')!;
    const origem = pontoPertoDe({ lat: esc.lat!, lng: esc.lng! }, 300, 1400);
    const r = avaliarRotaReal(lotada!.rota, lotada!.veiculo, {
      origem: { lat: origem.lat, lng: origem.lng }, destinoId: esc.destinoId!,
      escolaPonto: { lat: esc.lat!, lng: esc.lng! }, sentido: 'ida', turno: null, contratacao: 'mensal',
    });
    expect(r.status).not.toBe('compativel');
    expect(r.vagas).toBe(0);
    expect(r.codigos).toContain('capacidade');
  });

  it('a experiência do aluno difere com a origem: origem distante = mais tempo a bordo', () => {
    const esc = destino('geo-20261105-007');
    const perto = pontoPertoDe(esc, 300, 1200);
    const longe = { lat: -21.1580, lng: -50.4503 }; // ~6 km ao norte
    const rPerto = buscarEmRotasReais(ENTRADAS, { origem: { lat: perto.lat, lng: perto.lng }, destinoId: esc.id, escolaPonto: { lat: esc.lat, lng: esc.lng }, sentido: 'ida', turno: null, contratacao: 'mensal' });
    const rLonge = buscarEmRotasReais(ENTRADAS, { origem: longe, destinoId: esc.id, escolaPonto: { lat: esc.lat, lng: esc.lng }, sentido: 'ida', turno: null, contratacao: 'mensal' });
    const melhorPerto = rPerto.resultados.find((r) => r.status === 'compativel' && r.minutosABordo != null)!;
    const melhorLonge = rLonge.resultados.find((r) => r.status === 'compativel' && r.minutosABordo != null)!;
    // O motor calcula de verdade: mais perto da escola ⇒ menos tempo a bordo.
    expect(melhorPerto.minutosABordo!).toBeLessThan(melhorLonge.minutosABordo!);
  });

  it('rotas lotadas (sem vaga) não entram como candidatas', () => {
    // escolhe uma escola e confirma que nenhuma rota avaliada tem vagas 0.
    const esc = destino('geo-20261105-029');
    const origem = pontoPertoDe(esc, 300, 1600);
    const { resultados } = buscarEmRotasReais(ENTRADAS, {
      origem: { lat: origem.lat, lng: origem.lng }, destinoId: esc.id, escolaPonto: { lat: esc.lat, lng: esc.lng }, sentido: 'ida', turno: null, contratacao: 'mensal',
    });
    for (const r of resultados) expect(r.vagas).toBeGreaterThan(0);
  });

  it('performance: busca sobre as 300 rotas conclui rapidamente (§10)', () => {
    const esc = destino('geo-20261105-010');
    const origem = pontoPertoDe(esc, 300, 1600);
    const t0 = Date.now();
    for (const sentido of ['ida', 'volta'] as const) {
      buscarEmRotasReais(ENTRADAS, { origem: { lat: origem.lat, lng: origem.lng }, destinoId: esc.id, escolaPonto: { lat: esc.lat, lng: esc.lng }, sentido, turno: null, contratacao: 'mensal' });
    }
    const ms = Date.now() - t0;
    // eslint-disable-next-line no-console
    console.log(`[PERF] duas buscas (ida+volta) sobre 300 rotas em ${ms}ms`);
    expect(ms).toBeLessThan(4000);
  });
});
