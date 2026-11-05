import { describe, it, expect } from 'vitest';
import {
  ALUNOS_DEMO, INDICADORES_DEMO, VAN_DEMO, OPORTUNIDADES_DEMO,
  rotaDemoManha, pedidoDaOportunidade,
} from './motorista-demo';
import { criarMatrizDemo, rotaOperacionalDeCadastro, partidaRetroativa, encontrarEncaixes, simularRota } from '@/lib/encaixe';

const FOLGA = 8;
function baseOperacional() {
  const matriz = criarMatrizDemo();
  const base0 = rotaOperacionalDeCadastro(rotaDemoManha(), { capacidade: VAN_DEMO.lugares, partidaMin: 0 })!;
  const latest = partidaRetroativa(base0, matriz)!;
  return { matriz, base: { ...base0, partidaMin: latest - FOLGA } };
}

describe('dados demonstrativos do Vambora Pro (motor viário #7)', () => {
  it('os indicadores batem com as listas (sem números soltos)', () => {
    expect(INDICADORES_DEMO.alunos).toBe(ALUNOS_DEMO.length);
    expect(INDICADORES_DEMO.capacidade).toBe(VAN_DEMO.lugares);
    expect(INDICADORES_DEMO.vagas).toBe(VAN_DEMO.lugares - ALUNOS_DEMO.length);
  });

  it('a rota demo base é válida no motor real e chega até o horário final', () => {
    const { matriz, base } = baseOperacional();
    const plano = simularRota(base, matriz);
    expect(plano.valido).toBe(true);
    expect(plano.eventos.at(-1)!.chegadaMin).toBeLessThanOrEqual(420);
  });

  it('o simulador usa o MESMO motor da busca e devolve resultado coerente', () => {
    const { matriz, base } = baseOperacional();
    for (const op of OPORTUNIDADES_DEMO) {
      const opcoes = encontrarEncaixes(base, pedidoDaOportunidade(op), matriz);
      // Toda opção respeita o horário final e a variação de 10 min dos antigos.
      for (const o of opcoes) {
        expect(o.horarioEntregaMin).toBeLessThanOrEqual(op.limiteEscolaMin);
        expect(o.alteracoes.every((a) => Math.abs(a.diferencaMin) <= 10)).toBe(true);
        expect(o.horarioBuscaMin).toBeLessThan(o.horarioEntregaMin);
      }
    }
  });

  it('distingue honestamente quem cabe de quem fica longe da rota (sem forçar)', () => {
    const { matriz, base } = baseOperacional();
    const porRegiao = (r: string) => encontrarEncaixes(base, pedidoDaOportunidade(OPORTUNIDADES_DEMO.find((o) => o.regiao === r)!), matriz);
    // Centro e Vila Mendonça fazem parte da rota -> cabem.
    expect(porRegiao('Centro').length).toBeGreaterThan(0);
    expect(porRegiao('Vila Mendonça').length).toBeGreaterThan(0);
    // Água Branca fica fora do alcance sem atrasar os outros -> não cabe.
    expect(porRegiao('Água Branca')).toEqual([]);
  });
});
