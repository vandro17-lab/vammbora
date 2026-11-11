import { describe, it, expect } from 'vitest';
import { avaliarComTemposReais } from '@/lib/busca-avaliacao-servidor';
import { consultarBlocoViario } from '@/lib/matriz-viaria-servidor';
import { HM, P, pedido, pt, rotaIda, trechoSimulado, van } from '@/lib/cidade-simulada.fixture';

/**
 * RUAS REAIS — único teste que consulta o provedor viário de verdade
 * (Geoapify Route Matrix, o mesmo da produção).
 *
 * Só roda com `RUAS_REAIS=1` e `GEOAPIFY_API_KEY` definidos; caso contrário é
 * PULADO (aparece como "skipped"). Todos os outros testes do projeto são
 * simulados. Rodar:  RUAS_REAIS=1 GEOAPIFY_API_KEY=... npx vitest run src/lib/ruas-reais.test.ts
 *
 * Usa pontos públicos e fictícios de Araçatuba (nenhum endereço de usuário).
 * Não fixa horários exatos — o trânsito e o mapa mudam; confere o que precisa
 * valer SEMPRE com ruas de verdade.
 */
const chave = process.env.GEOAPIFY_API_KEY;
const ligado = process.env.RUAS_REAIS === '1' && !!chave;

describe.skipIf(!ligado)('[RUAS REAIS] Geoapify — Araçatuba', () => {
  it('o provedor devolve tempos reais para o bloco pedido, e eles não são a linha reta', async () => {
    const pontos = [P.garagem, P.casa1, P.casa2, P.escola];
    const t = await consultarBlocoViario(pontos, pontos, chave);
    expect(t).not.toBeNull();
    const real = t!.tempos[0][3]!;
    expect(real).toBeGreaterThan(0);
    // Pelas ruas nunca é mais curto do que a linha reta entre os dois pontos.
    expect(t!.distancias[0][3]!).toBeGreaterThanOrEqual(Math.hypot(6000, 0) * 0.98);
    // E difere da malha simulada usada nos outros testes (que não é o mapa de verdade).
    console.info(`[ruas reais] garagem→escola: ${real} min (malha simulada: ${trechoSimulado(pontos[0], pontos[3]).minutos} min)`);
  }, 30000);

  it('busca completa com tempos reais: sai veredito conclusivo (não estimado) e o prazo da família é respeitado', async () => {
    // Rota com folga larga para não depender do traçado exato das ruas.
    const rota = rotaIda({ saidaHabitualMin: null, limiteAntecipacaoMin: 30, passageiros: rotaIda().passageiros.map((x) => ({ ...x, horarioHabitualMin: null })) });
    const r = await avaliarComTemposReais([{ rota, veiculo: van(6) }], pedido(pt(3000, 0), { horarioFamiliaMin: HM(6, 50) }), {
      consultar: (o, d) => consultarBlocoViario(o, d, chave), maxConsultas: 4,
    });
    const res = r.resultados[0];
    expect(res.temposEstimados).toBe(false);
    expect(res.pendencia).toBeUndefined();
    if (res.status === 'compativel' || res.status === 'sob_confirmacao') expect(res.horarioEscolaMin!).toBeLessThanOrEqual(HM(6, 50));
    console.info(`[ruas reais] veredito: ${res.status}; chegada à escola: ${res.horarioEscolaMin}`);
  }, 30000);
});
