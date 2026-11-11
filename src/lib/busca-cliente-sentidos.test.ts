import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buscarRotasReais, continuarBuscaReal, podeContinuar, type CartaoRotaRealDados,
} from '@/lib/busca-rotas-reais-cliente';
import { avisoIdaEVolta, avisosDoSentido } from '@/lib/busca-mensagens';
import { criteriosParaParams, horarioDoSentido, paramsParaCriterios } from '@/lib/searchParams';
import type { CriteriosBusca } from '@/types';

/**
 * CLIENTE DA BUSCA: múltiplos sentidos, horários separados, preservação de
 * resultados válidos e continuação.
 *
 * TESTES SIMULADOS: o servidor (`/api/buscar-rotas`) é um `fetch` de mentira.
 * Provam o que a tela faz com cada resposta — não usam ruas reais nem o banco.
 */

const criterios = (over: Partial<CriteriosBusca> = {}): CriteriosBusca => ({
  cidadeId: 'aracatuba', endereco: 'Rua A, 1', destinoId: 'esc-1', turno: 'manha', contratacao: 'mensal',
  modalidade: 'ambos', origemLat: -21.2, origemLng: -50.44, horario: '06:50', horarioVolta: '12:05', ...over,
});
const escola = { lat: -21.21, lng: -50.43 };
const cartao = (rotaId: string, sentido: 'ida' | 'volta', over: Partial<CartaoRotaRealDados> = {}): CartaoRotaRealDados => ({
  rotaId, rotaNome: rotaId, vanLugares: 6, vagas: 2, atendeEscola: true, origemEscola: 'visita', sentido, status: 'compativel',
  passagemCasaMin: 400, horarioEscolaMin: 410, minutosABordo: 10, temposEstimados: false, motivo: 'ok', ...over,
});
const pendente = (rotaId: string, sentido: 'ida' | 'volta', pendencia: 'avaliacao_incompleta' | 'dados_insuficientes' = 'avaliacao_incompleta') =>
  cartao(rotaId, sentido, { status: 'indeterminado', pendencia, vagas: null, passagemCasaMin: null, horarioEscolaMin: null, minutosABordo: null });

type Resposta = { status?: number; corpo?: unknown; lancar?: boolean };
/** Servidor de mentira: responde conforme o sentido (e a continuação) do corpo recebido. */
function servidor(responder: (corpo: { sentido: 'ida' | 'volta'; horarioMin: number | null; continuacao?: unknown }) => Resposta) {
  const corpos: { sentido: 'ida' | 'volta'; horarioMin: number | null; continuacao?: unknown }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: { body?: string }) => {
    const corpo = JSON.parse(init?.body ?? '{}');
    corpos.push(corpo);
    const r = responder(corpo);
    if (r.lancar) throw new Error('rede fora');
    return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.corpo ?? {} };
  }));
  return corpos;
}
afterEach(() => vi.unstubAllGlobals());

describe('[simulado] horários separados para ida e volta', () => {
  it('cada sentido recebe o SEU horário: ida = chegar até; volta = liberado a partir de', async () => {
    const corpos = servidor(() => ({ corpo: { resultados: [], totalRotasAvaliadas: 0 } }));
    await buscarRotasReais(criterios(), escola);
    expect(corpos.map((c) => [c.sentido, c.horarioMin])).toEqual([['ida', 6 * 60 + 50], ['volta', 12 * 60 + 5]]);
  });

  it('"ida e volta" sem horário de volta: a volta vai SEM exigência (não reaproveita o horário de chegada da manhã)', async () => {
    const corpos = servidor(() => ({ corpo: { resultados: [] } }));
    await buscarRotasReais(criterios({ horarioVolta: undefined }), escola);
    expect(corpos.map((c) => [c.sentido, c.horarioMin])).toEqual([['ida', 410], ['volta', null]]);
  });

  it('"só volta": o horário único é o de liberação; "só ida": é o prazo de chegada', () => {
    expect(horarioDoSentido(criterios({ modalidade: 'volta', horario: '12:10', horarioVolta: undefined }), 'volta')).toBe('12:10');
    expect(horarioDoSentido(criterios({ modalidade: 'volta', horario: '12:10' }), 'ida')).toBeUndefined();
    expect(horarioDoSentido(criterios({ modalidade: 'ida' }), 'ida')).toBe('06:50');
    expect(horarioDoSentido(criterios({ modalidade: 'ida' }), 'volta')).toBeUndefined();
  });

  it('os dois horários sobrevivem à URL (busca recarregável/compartilhável)', () => {
    const volta = paramsParaCriterios(new URLSearchParams(criteriosParaParams(criterios())));
    expect([volta.horario, volta.horarioVolta, volta.modalidade]).toEqual(['06:50', '12:05', 'ambos']);
    // Fora de "ida e volta" o horário de volta não vai para a URL.
    expect(criteriosParaParams(criterios({ modalidade: 'ida' }))).not.toContain('horarioVolta');
  });
});

describe('[simulado] múltiplos sentidos: um não apaga o outro, e ida sozinha não é pacote', () => {
  it('a consulta da VOLTA falha: os resultados válidos da IDA são preservados e a falha fica só na volta', async () => {
    servidor((c) => (c.sentido === 'ida' ? { corpo: { resultados: [cartao('r1', 'ida')], totalRotasAvaliadas: 1 } } : { status: 500 }));
    const r = await buscarRotasReais(criterios(), escola);
    expect(r.estado).toBe('ok');
    expect(r.resultados.map((x) => x.rotaId)).toEqual(['r1']);
    expect(r.sentidos.map((s) => [s.sentido, s.estado, s.encontradas])).toEqual([['ida', 'ok', 1], ['volta', 'erro', 0]]);
    expect(avisosDoSentido(r.sentidos[1])).toEqual([expect.objectContaining({ tipo: 'erro', acao: 'tentar' })]);
    expect(avisoIdaEVolta(r)).toContain('não é um pacote de ida e volta');
    expect(podeContinuar(r)).toBe(true);
  });

  it('rede fora na ida e volta ok: mesma coisa no outro sentido', async () => {
    servidor((c) => (c.sentido === 'ida' ? { lancar: true } : { corpo: { resultados: [cartao('v1', 'volta')], totalRotasAvaliadas: 1 } }));
    const r = await buscarRotasReais(criterios(), escola);
    expect(r.resultados.map((x) => x.rotaId)).toEqual(['v1']);
    expect(avisoIdaEVolta(r)).toContain('Só encontramos opção para a VOLTA');
  });

  it('ida encontrada e volta SEM oferta: aviso de que não é pacote + "sem oferta" só na volta', async () => {
    servidor((c) => (c.sentido === 'ida' ? { corpo: { resultados: [cartao('r1', 'ida')], totalRotasAvaliadas: 1 } } : { corpo: { resultados: [], totalRotasAvaliadas: 0 } }));
    const r = await buscarRotasReais(criterios(), escola);
    expect(avisoIdaEVolta(r)).toContain('Só encontramos opção para a IDA');
    expect(avisosDoSentido(r.sentidos[0])).toEqual([]);
    expect(avisosDoSentido(r.sentidos[1]).map((a) => a.tipo)).toEqual(['sem_oferta']);
  });

  it('ida e volta encontradas: avisa que são trechos independentes; os dois sentidos falham: erro geral', async () => {
    servidor((c) => ({ corpo: { resultados: [cartao('r-' + c.sentido, c.sentido)], totalRotasAvaliadas: 1 } }));
    expect(avisoIdaEVolta(await buscarRotasReais(criterios(), escola))).toContain('independentes');
    servidor(() => ({ status: 500 }));
    expect((await buscarRotasReais(criterios(), escola)).estado).toBe('erro');
    servidor(() => ({ status: 503 }));
    expect((await buscarRotasReais(criterios(), escola)).estado).toBe('nao_configurado');
  });

  it('busca de um sentido só não gera aviso de pacote', async () => {
    servidor(() => ({ corpo: { resultados: [cartao('r1', 'ida')], totalRotasAvaliadas: 1 } }));
    expect(avisoIdaEVolta(await buscarRotasReais(criterios({ modalidade: 'ida' }), escola))).toBeNull();
  });
});

describe('[simulado] as quatro situações têm textos diferentes', () => {
  it('ausência de oferta, incompatibilidade, dados insuficientes e avaliação incompleta', async () => {
    servidor(() => ({ corpo: {
      totalRotasAvaliadas: 6, aguardando: 2, continuacao: { inicio: 4, repetir: [] },
      resultados: [cartao('ok', 'ida'), cartao('nao', 'ida', { status: 'incompativel', vagas: null }), pendente('dados', 'ida', 'dados_insuficientes'), pendente('inc', 'ida')],
    } }));
    const r = await buscarRotasReais(criterios({ modalidade: 'ida' }), escola);
    const s = r.sentidos[0];
    expect(s).toMatchObject({ candidatas: 6, encontradas: 1, incompativeis: 1, dadosInsuficientes: 1, avaliacaoIncompleta: 3, aguardando: 2 });
    const avisos = avisosDoSentido(s);
    expect(avisos.map((a) => a.tipo)).toEqual(['avaliacao_incompleta', 'dados_insuficientes', 'incompativel']);
    expect(avisos[0]).toMatchObject({ acao: 'continuar' });
    expect(avisos[0].texto).toContain('3 rotas');
    expect(avisos[0].texto).toContain('não significa que não há vaga');
    expect(avisos[1].texto).toContain('cadastro do motorista está incompleto');
    expect(avisos[2].texto).toContain('não encaixa');
    expect(new Set(avisos.map((a) => a.texto)).size).toBe(3);
    // Só os exibíveis viram cartão; "inconclusivas" nunca inclui as incompatíveis.
    expect(r.resultados.map((x) => x.rotaId)).toEqual(['ok']);
    expect(r.inconclusivas).toBe(4);
  });

  it('sem provedor viário no ambiente: explica e não oferece "continuar"', async () => {
    servidor(() => ({ corpo: { totalRotasAvaliadas: 1, semProvedor: true, resultados: [pendente('a', 'ida')] } }));
    const [aviso] = avisosDoSentido((await buscarRotasReais(criterios({ modalidade: 'ida' }), escola)).sentidos[0]);
    expect(aviso.acao).toBeUndefined();
    expect(aviso.texto).toContain('não está disponível neste ambiente');
  });
});

describe('[simulado] continuar a avaliação preserva o que já é válido', () => {
  it('pede o PRÓXIMO lote (com a continuação), soma os novos e mantém os anteriores', async () => {
    const corpos = servidor((c) => (c.continuacao
      ? { corpo: { totalRotasAvaliadas: 3, aguardando: 0, continuacao: null, resultados: [cartao('r3', 'ida')] } }
      : { corpo: { totalRotasAvaliadas: 3, aguardando: 1, continuacao: { inicio: 2, repetir: [] }, resultados: [cartao('r1', 'ida'), cartao('r2', 'ida', { status: 'incompativel', vagas: null })] } }));
    const c = criterios({ modalidade: 'ida' });
    const r1 = await buscarRotasReais(c, escola);
    expect(r1.resultados.map((x) => x.rotaId)).toEqual(['r1']);
    expect(podeContinuar(r1)).toBe(true);
    const r2 = await continuarBuscaReal(c, escola, r1);
    expect(corpos[1].continuacao).toEqual({ inicio: 2, repetir: [] });
    expect(r2.resultados.map((x) => x.rotaId).sort()).toEqual(['r1', 'r3']);
    expect(r2.sentidos[0]).toMatchObject({ encontradas: 2, incompativeis: 1, avaliacaoIncompleta: 0, continuacao: null });
    expect(podeContinuar(r2)).toBe(false);
  });

  it('a continuação FALHA: nada do que já estava na tela é perdido, e dá para tentar de novo', async () => {
    let chamada = 0;
    servidor(() => (++chamada === 1
      ? { corpo: { totalRotasAvaliadas: 2, aguardando: 1, continuacao: { inicio: 1, repetir: [] }, resultados: [cartao('r1', 'ida')] } }
      : { status: 500 }));
    const c = criterios({ modalidade: 'ida' });
    const r1 = await buscarRotasReais(c, escola);
    const r2 = await continuarBuscaReal(c, escola, r1);
    expect(r2.resultados.map((x) => x.rotaId)).toEqual(['r1']);
    expect(r2.sentidos[0]).toMatchObject({ estado: 'ok', aguardando: 1, continuacao: { inicio: 1, repetir: [] } });
  });

  it('rota repetida que volta a falhar não derruba o resultado válido que ela já tinha', async () => {
    servidor((c) => (c.continuacao
      ? { corpo: { totalRotasAvaliadas: 2, aguardando: 0, continuacao: { inicio: 2, repetir: ['r2'] }, resultados: [pendente('r1', 'ida'), pendente('r2', 'ida')] } }
      : { corpo: { totalRotasAvaliadas: 2, aguardando: 0, continuacao: { inicio: 2, repetir: ['r2'] }, resultados: [cartao('r1', 'ida'), pendente('r2', 'ida')] } }));
    const c = criterios({ modalidade: 'ida' });
    const r2 = await continuarBuscaReal(c, escola, await buscarRotasReais(c, escola));
    expect(r2.resultados.map((x) => x.rotaId)).toEqual(['r1']); // r1 continua válido
    expect(r2.sentidos[0]).toMatchObject({ encontradas: 1, avaliacaoIncompleta: 1 });
  });

  it('sentido que tinha falhado é refeito do zero; o outro sentido não é consultado de novo', async () => {
    let voltaOk = false;
    const corpos = servidor((c) => (c.sentido === 'ida'
      ? { corpo: { resultados: [cartao('r1', 'ida')], totalRotasAvaliadas: 1 } }
      : voltaOk ? { corpo: { resultados: [cartao('v1', 'volta')], totalRotasAvaliadas: 1 } } : { status: 500 }));
    const r1 = await buscarRotasReais(criterios(), escola);
    voltaOk = true;
    const r2 = await continuarBuscaReal(criterios(), escola, r1);
    expect(corpos.map((c) => c.sentido)).toEqual(['ida', 'volta', 'volta']);
    expect(r2.resultados.map((x) => x.rotaId).sort()).toEqual(['r1', 'v1']);
    expect(avisoIdaEVolta(r2)).toContain('independentes');
  });
});
