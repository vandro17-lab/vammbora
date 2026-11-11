import { describe, it, expect } from 'vitest';
import { ESTIMATIVAS_INICIAIS, AMOSTRAS_MINIMAS, aprenderEstimativas, matrizComFator, type ObservacaoOperacional } from './inteligencia-operacional';

describe('inteligência operacional — estimativas explícitas, sem aprendizado inventado', () => {
  it('sem histórico suficiente devolve as estimativas INICIAIS, marcadas como tal', () => {
    expect(aprenderEstimativas([])).toBe(ESTIMATIVAS_INICIAIS);
    const poucas: ObservacaoOperacional[] = Array.from({ length: AMOSTRAS_MINIMAS - 1 }, () => ({ tipo: 'viagem', previstoMin: 10, realMin: 20 }));
    expect(aprenderEstimativas(poucas).origem).toBe('inicial');
  });
  it('com histórico aprende mediana e quantil conservador, ignorando registros impossíveis', () => {
    const obs: ObservacaoOperacional[] = [
      ...Array.from({ length: 30 }, (_, i): ObservacaoOperacional => ({ tipo: 'viagem', previstoMin: 10, realMin: i < 24 ? 12 : 15 })),
      { tipo: 'viagem', previstoMin: 10, realMin: 0.5 }, // toque duplo: descartado
      ...Array.from({ length: 25 }, (): ObservacaoOperacional => ({ tipo: 'embarque', realMin: 2 })),
    ];
    const e = aprenderEstimativas(obs);
    expect(e.origem).toBe('aprendido');
    expect(e.fatorViagem).toBeCloseTo(1.2);
    expect(e.fatorViagemConservador).toBeCloseTo(1.5);
    expect(e.embarqueMin).toBe(2);
    expect(e.desembarqueMin).toBe(ESTIMATIVAS_INICIAIS.desembarqueMin); // sem dados: mantém o inicial
    expect(e.amostras).toBe(55);
  });
  it('matriz com fator multiplica só os tempos', () => {
    const m = matrizComFator({ origem: 'fixture-testada', obter: () => ({ minutos: 10, metros: 3000 }) }, 1.15);
    const p = { id: 'a', nome: '', lat: 0, lng: 0 };
    expect(m.obter(p, p, 0)).toEqual({ minutos: 11.5, metros: 3000 }); // 10 × 1,15, com fração de minuto
  });
});
