import { describe, it, expect } from 'vitest';
import {
  ALUNOS_DEMO, INDICADORES_DEMO, VAN_DEMO, OPORTUNIDADES_DEMO,
  rotaDemoManha, rotaComOportunidade, VEICULO_DEMO,
} from './motorista-demo';
import { montarEntradaMotor, avaliarRotaCandidata } from '@/lib/rota-para-motor';
import { planejarRota } from '@/engine/planejamento';

describe('dados demonstrativos do Vambora Pro', () => {
  it('os indicadores batem com as listas (sem números soltos)', () => {
    expect(INDICADORES_DEMO.alunos).toBe(ALUNOS_DEMO.length);
    expect(INDICADORES_DEMO.capacidade).toBe(VAN_DEMO.lugares);
    expect(INDICADORES_DEMO.vagas).toBe(VAN_DEMO.lugares - ALUNOS_DEMO.length);
  });

  it('a rota demo base é um plano válido no motor real', () => {
    const plano = planejarRota(montarEntradaMotor(rotaDemoManha(), VEICULO_DEMO));
    expect(plano.valido).toBe(true);
    expect(plano.saida).toBeTypeOf('number');
  });

  it('o simulador de impacto devolve um nível coerente para cada oportunidade', () => {
    const base = rotaDemoManha();
    const baseEntrada = montarEntradaMotor(base, VEICULO_DEMO);
    for (const op of OPORTUNIDADES_DEMO) {
      const candidata = montarEntradaMotor(rotaComOportunidade(base, op), VEICULO_DEMO);
      const r = avaliarRotaCandidata(baseEntrada, candidata, base.limiteAntecipacaoMin ?? 0);
      expect(['disponivel', 'sob_consulta', 'indisponivel']).toContain(r.nivel);
      expect(r.motivos.length).toBeGreaterThan(0);
    }
  });

  it('distingue honestamente quem está na rota de quem exige desvio (sem forçar resultado)', () => {
    const base = rotaDemoManha();
    const baseEntrada = montarEntradaMotor(base, VEICULO_DEMO);
    const regioesNaRota = new Set(base.paradas.filter((p) => p.tipo === 'casa').map((p) => p.rotulo));
    for (const op of OPORTUNIDADES_DEMO) {
      const r = avaliarRotaCandidata(
        baseEntrada,
        montarEntradaMotor(rotaComOportunidade(base, op), VEICULO_DEMO),
        base.limiteAntecipacaoMin ?? 0,
      );
      if (regioesNaRota.has(op.regiao)) {
        // Embarca numa parada existente (sem desvio): o motor não descarta.
        expect(r.nivel).not.toBe('indisponivel');
      } else {
        // Região fora da rota exige desvio: sem tolerância informada, o motor recusa.
        expect(r.nivel).toBe('indisponivel');
      }
    }
  });
});
