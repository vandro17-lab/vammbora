import { describe, it, expect } from 'vitest';
// @ts-expect-error mjs sem tipos
import { gerarBaseDemo, haversineMetros } from '../../scripts/demo-aracatuba/gerar.mjs';
// @ts-expect-error mjs sem tipos
import { DESTINOS, PONTOS } from '../../scripts/demo-aracatuba/dados.mjs';
import { buscarEmRotasReais, avaliarRotaReal, type EntradaBuscaReal } from '@/lib/busca-rotas-reais';
import { compararOpcoes, type OpcaoEncaixe } from '@/engine/encaixe-geografico';
import type { Rota, Veiculo } from '@/types/motorista';

/**
 * Regressão da correção do "embarque excessivamente antecipado":
 * a busca da família deve escolher, entre os encaixes VÁLIDOS, o de MENOR TEMPO
 * do aluno a bordo (§3/§4) — e não o de menor desvio do motorista.
 */

const BASE = gerarBaseDemo() as {
  routesDomain: Array<{ rota: Rota; veiculo: Veiculo }>;
  routesDb: Array<{ id: string; direction: string; stops: Array<{ type: string; destination_id: string | null; habitual_arrival_min: number | null; lat: number; lng: number }> }>;
};
const ENTRADAS = BASE.routesDomain as unknown as EntradaBuscaReal[];
const destino = (id: string) => DESTINOS.find((d: { id: string }) => d.id === id)!;
const pontoPertoDe = (d: { lat: number; lng: number }, min = 200, max = 1200) =>
  PONTOS.map((p: { lat: number; lng: number }) => ({ p, dist: haversineMetros(d, p) }))
    .filter((x: { dist: number }) => x.dist >= min && x.dist <= max)
    .sort((a: { dist: number }, b: { dist: number }) => a.dist - b.dist)[0]?.p;

const op = (minutosABordo: number, desvioMin: number): OpcaoEncaixe =>
  ({ minutosABordo, desvioMin, desvioMetros: 0, distanciaABordoMetros: 0 } as OpcaoEncaixe);

describe('compararOpcoes (motor)', () => {
  it("'tempoABordo' prioriza menor tempo a bordo; 'desvio' prioriza menor desvio", () => {
    const a = op(5, 30); // pouco tempo a bordo, muito desvio
    const b = op(40, 0); // muito tempo a bordo, nenhum desvio
    expect(compararOpcoes(a, b, 'tempoABordo')).toBeLessThan(0); // a antes de b
    expect(compararOpcoes(a, b, 'desvio')).toBeGreaterThan(0);   // b antes de a
    // default = legado ('desvio')
    expect(compararOpcoes(a, b)).toBeGreaterThan(0);
  });
});

describe('Busca: ordenação por tempo a bordo vs legado', () => {
  it('o padrão da busca é tempoABordo e nunca piora o tempo do aluno frente ao legado', () => {
    let pior = 0; let melhor = 0; let n = 0;
    // Amostra representativa (mantém o teste rápido): 1 em cada 4 escolas.
    const amostra = (DESTINOS as { id: string; lat: number; lng: number }[]).filter((_, i) => i % 4 === 0);
    for (const esc of amostra) {
      const o = pontoPertoDe(esc); if (!o) continue;
      const pedido = { origem: { lat: o.lat, lng: o.lng }, destinoId: esc.id, escolaPonto: { lat: esc.lat, lng: esc.lng }, sentido: 'ida' as const, turno: null, contratacao: 'mensal' as const };
      const legado = buscarEmRotasReais(ENTRADAS, pedido, undefined, { ordenarPor: 'desvio' }).resultados.find((r) => r.status === 'compativel');
      const padrao = buscarEmRotasReais(ENTRADAS, pedido).resultados.find((r) => r.status === 'compativel'); // default
      if (!legado || !padrao || legado.minutosABordo == null || padrao.minutosABordo == null) continue;
      n++;
      if (padrao.minutosABordo < legado.minutosABordo) melhor++;
      if (padrao.minutosABordo > legado.minutosABordo) pior++;
    }
    expect(n).toBeGreaterThan(6);
    expect(pior).toBe(0);        // o proposto nunca aumenta o tempo do aluno
    expect(melhor).toBeGreaterThan(0); // e melhora em muitos casos
  });
});

describe('Horário máximo de chegada (§3)', () => {
  it('exclui rota que chega à escola DEPOIS do limite e aceita quando o limite comporta', () => {
    // pega uma rota de ida com horário de chegada conhecido na escola.
    const rota = BASE.routesDb.find((r) => r.direction === 'ida' && r.stops.some((s) => s.type === 'escola' && s.habitual_arrival_min != null))!;
    const escStop = rota.stops.find((s) => s.type === 'escola' && s.habitual_arrival_min != null)!;
    const chegada = escStop.habitual_arrival_min!;
    const esc = destino(escStop.destination_id!);
    const entrada = BASE.routesDomain.find((e) => e.rota.id === (rota as { id: string }).id)!;
    const origem = pontoPertoDe({ lat: esc.lat, lng: esc.lng }, 200, 1600);
    const base = { origem: { lat: origem.lat, lng: origem.lng }, destinoId: esc.id, escolaPonto: { lat: esc.lat, lng: esc.lng }, sentido: 'ida' as const, turno: null, contratacao: 'mensal' as const };

    const comLimiteApertado = avaliarRotaReal(entrada.rota, entrada.veiculo, { ...base, horarioMaxChegadaMin: chegada - 10 });
    expect(comLimiteApertado.status).toBe('incompativel');
    expect(comLimiteApertado.codigos).toContain('atraso');

    const comLimiteFolgado = avaliarRotaReal(entrada.rota, entrada.veiculo, { ...base, horarioMaxChegadaMin: chegada + 10 });
    expect(comLimiteFolgado.status === 'compativel' || comLimiteFolgado.status === 'sob_confirmacao').toBe(true);
  });
});
