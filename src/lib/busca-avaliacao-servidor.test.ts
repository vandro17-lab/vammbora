import { describe, it, expect } from 'vitest';
import { avaliarComTemposReais, type AvaliacaoServidor } from '@/lib/busca-avaliacao-servidor';
import { type EntradaBuscaReal } from '@/lib/busca-rotas-reais';
import { LIMITE_PONTOS_AVALIACAO, LIMITE_PONTOS_MATRIZ, consultarTabelasEmBlocos, consultasNecessarias } from '@/lib/matriz-viaria-servidor';
import type { ParadaRota, PassageiroRota, Rota } from '@/types/motorista';
import { HM, P, pedido, provedorSimulado, pt, rotaIda, van } from '@/lib/cidade-simulada.fixture';

/**
 * FILA DE AVALIAÇÃO DO SERVIDOR (seleção preliminar, orçamento de consultas,
 * matrizes em blocos e falhas externas).
 *
 * TESTES SIMULADOS: o provedor viário é o `provedorSimulado` (malha fictícia,
 * sem rede). Provam o comportamento da FILA e das FALHAS — não usam ruas reais.
 */

const casa = pt(3000, 0);
const P650 = pedido(casa, { horarioFamiliaMin: HM(6, 50) });
const entrada = (rota: Rota, lugares = 6): EntradaBuscaReal => ({ rota, veiculo: van(lugares) });
/** Rota que "cabe" já pela estimativa (sem horários individuais): vai para a frente da fila. */
const livre = (id: string) => rotaIda({ id, saidaHabitualMin: null, passageiros: rotaIda().passageiros.map((x) => ({ ...x, horarioHabitualMin: null })) });
const ids = (r: AvaliacaoServidor) => r.resultados.map((x) => x.rotaId).sort();
const de = (r: AvaliacaoServidor, id: string) => r.resultados.find((x) => x.rotaId === id);

/** Ida longa: garagem → N casas (150 m entre elas) → escola. Sem horários individuais. */
function rotaLonga(id: string, casas: number): Rota {
  const paradas: ParadaRota[] = [{ id: 's', ordem: 0, tipo: 'saida', rotulo: 'saida', confirmado: true, ...P.garagem }];
  const passageiros: PassageiroRota[] = [];
  for (let i = 1; i <= casas; i++) {
    paradas.push({ id: `c${i}`, ordem: i, tipo: 'casa', rotulo: `Rua Reservada ${i}`, confirmado: true, ...pt(150 * i, 0) });
    passageiros.push({ id: `p${i}`, identificacao: `AlunoReservado-${i}`, embarqueParadaId: `c${i}`, desembarqueParadaId: 'e', destinoId: 'esc-1' });
  }
  paradas.push({ id: 'e', ordem: casas + 1, tipo: 'escola', rotulo: 'escola', confirmado: true, destinoId: 'esc-1', destinoNome: 'Escola Um', limiteChegadaMin: HM(8), ...pt(150 * casas + 1000, 0) });
  return { ...rotaIda(), id, saidaHabitualMin: null, ultimoDesembarqueMin: HM(8), paradas, passageiros };
}

describe('[simulado] ausência de oferta x o resto', () => {
  it('nenhuma rota visita nem aceita a escola: zero candidatas, zero consultas', async () => {
    const consultar = provedorSimulado();
    const r = await avaliarComTemposReais([entrada(rotaIda())], pedido(casa, { destinoId: 'esc-outra', escolaPonto: pt(20000, 20000) }), { consultar, maxConsultas: 8 });
    expect(r).toMatchObject({ totalRotasAvaliadas: 0, resultados: [], aguardando: 0, continuacao: null });
    expect(r.resumo.candidatas).toBe(0);
    expect(consultar.chamadas).toBe(0);
  });

  it('o que não depende de trajeto é definitivo e NÃO gasta consulta (van sem cadastro, van sem lugar, parada sem coordenada)', async () => {
    const consultar = provedorSimulado();
    const semCoord = rotaIda({ id: 'sem-coord', paradas: rotaIda().paradas.map((p) => (p.id === 'c2' ? { ...p, lat: undefined, lng: undefined } : p)) });
    const r = await avaliarComTemposReais([
      { rota: rotaIda({ id: 'sem-van' }), veiculo: null },
      entrada(semCoord),
      entrada(rotaIda({ id: 'ok' })),
    ], P650, { consultar, maxConsultas: 8 });
    expect(consultar.chamadas).toBe(1); // só a rota que realmente depende das ruas
    expect(de(r, 'sem-van')).toMatchObject({ status: 'indeterminado', pendencia: 'dados_insuficientes' });
    expect(de(r, 'sem-coord')).toMatchObject({ status: 'indeterminado', pendencia: 'dados_insuficientes' });
    expect(de(r, 'ok')).toMatchObject({ status: 'compativel', horarioEscolaMin: HM(6, 50), temposEstimados: false });
    expect(r.resumo).toMatchObject({ candidatas: 3, compativeis: 1, dadosInsuficientes: 2, avaliacaoIncompleta: 0, incompativeis: 0 });
  });
});

describe('[simulado] sem consulta real nada é confirmado nem recusado', () => {
  it('sem provedor configurado: todas as que dependem das ruas ficam como avaliação incompleta, sem horários', async () => {
    const r = await avaliarComTemposReais([entrada(livre('a')), entrada(rotaIda({ id: 'b' }))], P650, { consultar: null, maxConsultas: 8 });
    expect(r.semProvedor).toBe(true);
    expect(r.continuacao).toBeNull();
    for (const x of r.resultados) expect(x).toMatchObject({ status: 'indeterminado', pendencia: 'avaliacao_incompleta', passagemCasaMin: null, horarioEscolaMin: null, vagas: null });
    expect(r.resumo).toMatchObject({ compativeis: 0, sobConfirmacao: 0, incompativeis: 0, avaliacaoIncompleta: 2 });
  });

  it('provedor fora do ar: avaliação incompleta + continuação para repetir; quando volta, o resultado sai', async () => {
    let fora = true;
    const consultar = provedorSimulado({ falhar: () => fora });
    const r1 = await avaliarComTemposReais([entrada(rotaIda())], P650, { consultar, maxConsultas: 8 });
    expect(r1.resultados[0]).toMatchObject({ status: 'indeterminado', pendencia: 'avaliacao_incompleta' });
    expect(r1.continuacao).toMatchObject({ inicio: 1, repetir: ['rota-ida'] });
    fora = false;
    const r2 = await avaliarComTemposReais([entrada(rotaIda())], P650, { consultar, maxConsultas: 8, continuacao: r1.continuacao });
    expect(r2.resultados[0]).toMatchObject({ status: 'compativel', horarioEscolaMin: HM(6, 50) });
    expect(r2.continuacao).toBeNull();
  });
});

describe('[simulado] candidata viável FORA do primeiro lote', () => {
  // 4 rotas que "cabem" pela estimativa + 1 que a estimativa reprova, mas que
  // CABE pelas ruas (a rota de referência, com horários cadastrados).
  const entradas = () => [entrada(rotaIda({ id: 'v-viavel' })), ...['a1', 'a2', 'a3', 'a4'].map((id) => entrada(livre(id)))];

  it('a estimativa só ORDENA: a viável fica no fim da fila, e mesmo assim é calculada na continuação', async () => {
    const consultar = provedorSimulado();
    const r1 = await avaliarComTemposReais(entradas(), P650, { consultar, maxConsultas: 2 });
    expect(ids(r1)).toEqual(['a1', 'a2']);
    expect(r1.aguardando).toBe(3);
    expect(r1.totalRotasAvaliadas).toBe(5);
    expect(r1.inconclusivas).toBe(3); // aguardando conta como "ainda sem veredito", nunca como recusa
    expect(r1.continuacao).toMatchObject({ inicio: 2, repetir: [] });

    const r2 = await avaliarComTemposReais(entradas(), P650, { consultar, maxConsultas: 2, continuacao: r1.continuacao });
    expect(ids(r2)).toEqual(['a3', 'a4']);
    expect(r2.continuacao).toMatchObject({ inicio: 4, repetir: [] });

    const r3 = await avaliarComTemposReais(entradas(), P650, { consultar, maxConsultas: 2, continuacao: r2.continuacao });
    expect(de(r3, 'v-viavel')).toMatchObject({ status: 'compativel', horarioEscolaMin: HM(6, 50), temposEstimados: false });
    expect(r3.aguardando).toBe(0);
    expect(r3.continuacao).toBeNull();
    expect(consultar.chamadas).toBe(5); // uma consulta por rota — nenhuma refeita
  });

  it('"tentar de novo" do zero repetiria sempre o mesmo lote — por isso existe a continuação', async () => {
    const a = await avaliarComTemposReais(entradas(), P650, { consultar: provedorSimulado(), maxConsultas: 2 });
    const b = await avaliarComTemposReais(entradas(), P650, { consultar: provedorSimulado(), maxConsultas: 2 });
    expect(ids(b)).toEqual(ids(a)); // ordem estável: é ela que torna o cursor confiável
    expect(de(a, 'v-viavel')).toBeUndefined();
  });

  it('rotas que SEMPRE falham não travam a fila: as novas vêm primeiro; as que falharam são repetidas com o que sobrar', async () => {
    // O provedor nunca responde para a1 e a2. Como as rotas têm a mesma geometria, a
    // falha é associada à rota pela ordem das consultas do lote (uma consulta por rota).
    const falhas = new Set(['a1', 'a2']);
    const porRota = (id: string) => provedorSimulado({ falhar: () => falhas.has(id) });
    const rodar = async (continuacao: { inicio: number; repetir: string[] } | null, ordemDoLote: string[]) => {
      let i = 0;
      const consultar = (async (o, d) => porRota(ordemDoLote[i++])(o, d)) as ReturnType<typeof provedorSimulado>;
      return avaliarComTemposReais(entradas(), P650, { consultar, maxConsultas: 2, continuacao });
    };
    const r1 = await rodar(null, ['a1', 'a2']);
    expect(r1.resultados.map((x) => x.pendencia)).toEqual(['avaliacao_incompleta', 'avaliacao_incompleta']);
    expect(r1.continuacao).toMatchObject({ inicio: 2, repetir: ['a1', 'a2'] });
    // 2ª chamada: NÃO insiste em a1/a2 — avança para a3 e a4.
    const r2 = await rodar(r1.continuacao, ['a3', 'a4']);
    expect(ids(r2)).toEqual(['a3', 'a4']);
    expect(r2.continuacao).toMatchObject({ inicio: 4, repetir: ['a1', 'a2'] });
    // 3ª chamada: a viável (nova) primeiro; com o que sobra, repete a1.
    const r3 = await rodar(r2.continuacao, ['v-viavel', 'a1']);
    expect(de(r3, 'v-viavel')).toMatchObject({ status: 'compativel' });
    expect(de(r3, 'a1')).toMatchObject({ status: 'indeterminado', pendencia: 'avaliacao_incompleta' });
    expect(r3.continuacao).toMatchObject({ inicio: 5, repetir: ['a1', 'a2'] });
  });
});

describe('[simulado] matriz PARCIAL', () => {
  it('trecho que o provedor não devolve numa rota: ela fica incompleta; a outra rota mantém o resultado válido', async () => {
    const casaIsolada = pt(4000, 200);
    const b = rotaIda({ id: 'b-furada', paradas: rotaIda().paradas.map((p) => (p.id === 'c2' ? { ...p, ...casaIsolada } : p)) });
    const mesmo = (x: { lat: number; lng: number }, y: { lat: number; lng: number }) => Math.abs(x.lat - y.lat) < 1e-9 && Math.abs(x.lng - y.lng) < 1e-9;
    const consultar = provedorSimulado({ semTrajeto: (o, d) => mesmo(o, casaIsolada) || mesmo(d, casaIsolada) });
    const r = await avaliarComTemposReais([entrada(rotaIda({ id: 'a-inteira' })), entrada(b)], P650, { consultar, maxConsultas: 8 });
    expect(de(r, 'a-inteira')).toMatchObject({ status: 'compativel', horarioEscolaMin: HM(6, 50) });
    expect(de(r, 'b-furada')).toMatchObject({ status: 'indeterminado', pendencia: 'avaliacao_incompleta', horarioEscolaMin: null });
    expect(de(r, 'b-furada')!.status).not.toBe('incompativel');
    expect(r.resumo).toMatchObject({ compativeis: 1, avaliacaoIncompleta: 1, incompativeis: 0 });
  });

  it('trecho ausente que o cálculo NÃO precisa (da casa da família de volta à garagem) não atrapalha', async () => {
    const mesmo = (x: { lat: number; lng: number }, y: { lat: number; lng: number }) => Math.abs(x.lat - y.lat) < 1e-9 && Math.abs(x.lng - y.lng) < 1e-9;
    const consultar = provedorSimulado({ semTrajeto: (o, d) => mesmo(d, P.garagem) && !mesmo(o, P.garagem) });
    const r = await avaliarComTemposReais([entrada(rotaIda())], P650, { consultar, maxConsultas: 8 });
    expect(r.resultados[0]).toMatchObject({ status: 'compativel', horarioEscolaMin: HM(6, 50) });
  });
});

describe('[simulado] EXCESSO DE PONTOS', () => {
  it('quantas requisições cada matriz custa', () => {
    expect(consultasNecessarias(LIMITE_PONTOS_MATRIZ)).toBe(1);
    expect(consultasNecessarias(LIMITE_PONTOS_MATRIZ + 1)).toBe(4);
    expect(consultasNecessarias(LIMITE_PONTOS_AVALIACAO)).toBe(4);
    expect(consultasNecessarias(LIMITE_PONTOS_AVALIACAO + 1)).toBe(0);
  });

  it('rota com 33 pontos (mais do que cabe em uma consulta) é calculada em blocos — e sai com veredito', async () => {
    const consultar = provedorSimulado();
    const longa = rotaLonga('longa', 30); // garagem + 30 casas + escola + casa da família = 33 pontos
    const r = await avaliarComTemposReais([{ rota: longa, veiculo: van(40) }], pedido(pt(2000, 100), { horarioFamiliaMin: HM(7, 40) }), { consultar, maxConsultas: 8 });
    expect(consultar.chamadas).toBe(4);
    expect(r.resultados[0].status === 'compativel' || r.resultados[0].status === 'sob_confirmacao').toBe(true);
    expect(r.resultados[0].temposEstimados).toBe(false);
    expect(r.resultados[0].horarioEscolaMin!).toBeLessThanOrEqual(HM(7, 40));
  });

  it('os blocos montam exatamente a mesma matriz de uma consulta única', async () => {
    const pontos = Array.from({ length: 33 }, (_, i) => pt(137 * i, 59 * (i % 5)));
    const t = await consultarTabelasEmBlocos(pontos, provedorSimulado());
    expect(t).toMatchObject({ blocos: 4, blocosFalhos: 0 });
    const inteiro = await provedorSimulado()(pontos, pontos);
    expect(t!.tempos).toEqual(inteiro!.tempos);
    expect(t!.distancias).toEqual(inteiro!.distancias);
  });

  it('um bloco falha: a rota fica incompleta e volta na continuação (não vira recusa)', async () => {
    const consultar = provedorSimulado({ falhar: (_o, _d, chamada) => chamada === 2 });
    const longa = rotaLonga('longa', 30);
    const p = pedido(pt(2000, 100), { horarioFamiliaMin: HM(7, 40) });
    const r1 = await avaliarComTemposReais([{ rota: longa, veiculo: van(40) }], p, { consultar, maxConsultas: 8 });
    expect(r1.resultados[0]).toMatchObject({ status: 'indeterminado', pendencia: 'avaliacao_incompleta' });
    expect(r1.continuacao).toMatchObject({ inicio: 1, repetir: ['longa'] });
    const r2 = await avaliarComTemposReais([{ rota: longa, veiculo: van(40) }], p, { consultar, maxConsultas: 8, continuacao: r1.continuacao });
    expect(r2.resultados[0].status === 'compativel' || r2.resultados[0].status === 'sob_confirmacao').toBe(true);
    expect(r2.continuacao).toBeNull();
  });

  it('rota acima do teto de pontos: avaliação incompleta com motivo próprio — nunca "incompatível", e sem gastar consulta', async () => {
    const consultar = provedorSimulado();
    const enorme = rotaLonga('enorme', 55);
    const r = await avaliarComTemposReais([{ rota: enorme, veiculo: van(60) }, entrada(rotaIda({ id: 'normal' }))], pedido(casa), { consultar, maxConsultas: 8 });
    expect(de(r, 'enorme')).toMatchObject({ status: 'indeterminado', pendencia: 'avaliacao_incompleta' });
    expect(de(r, 'enorme')!.motivo).toContain('pontos demais');
    expect(de(r, 'normal')!.status).toBe('compativel');
    expect(consultar.chamadas).toBe(1);
    expect(r.continuacao).toBeNull(); // repetir não muda uma rota grande demais
  });

  it('o orçamento conta REQUISIÇÕES: uma rota de 4 blocos não deixa passar outras além do limite', async () => {
    const consultar = provedorSimulado();
    const p = pedido(pt(2000, 100), { horarioFamiliaMin: HM(7, 40) });
    const entradas = [{ rota: rotaLonga('l1', 30), veiculo: van(40) }, { rota: rotaLonga('l2', 30), veiculo: van(40) }, { rota: rotaLonga('l3', 30), veiculo: van(40) }];
    const r = await avaliarComTemposReais(entradas, p, { consultar, maxConsultas: 8 });
    expect(consultar.chamadas).toBe(8);
    expect(ids(r)).toEqual(['l1', 'l2']);
    expect(r.aguardando).toBe(1);
    // Orçamento menor que o custo de uma rota: ainda assim ela é calculada (a 1ª do lote).
    const pequeno = provedorSimulado();
    const r2 = await avaliarComTemposReais(entradas, p, { consultar: pequeno, maxConsultas: 2 });
    expect(pequeno.chamadas).toBe(4);
    expect(ids(r2)).toEqual(['l1']);
  });
});
