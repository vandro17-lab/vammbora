import { describe, it, expect } from 'vitest';
import { gerarAvaliacoesDemo } from './avaliacoes-demo';

describe('avaliacoes-demo (conjunto demonstrativo determinístico)', () => {
  it('é determinístico para o mesmo motorista', () => {
    const a = gerarAvaliacoesDemo('VB-001', 'Tio João');
    const b = gerarAvaliacoesDemo('VB-001', 'Tio João');
    expect(a).toEqual(b);
  });

  it('varia entre motoristas diferentes', () => {
    const a = gerarAvaliacoesDemo('VB-001', 'Tio João');
    const b = gerarAvaliacoesDemo('VB-007', 'Fernanda');
    expect(a.comentarios).not.toEqual(b.comentarios);
  });

  it('produz média coerente com a distribuição por estrela', () => {
    const a = gerarAvaliacoesDemo('VB-003', 'José');
    const [c5, c4, c3, c2, c1] = a.distribuicao;
    const total = c5 + c4 + c3 + c2 + c1;
    const mediaCalc = (5 * c5 + 4 * c4 + 3 * c3 + 2 * c2 + 1 * c1) / total;
    expect(total).toBe(a.total);
    expect(a.media).toBeCloseTo(Math.round(mediaCalc * 10) / 10, 5);
    expect(a.media).toBeGreaterThanOrEqual(1);
    expect(a.media).toBeLessThanOrEqual(5);
  });

  it('gera 4 critérios no intervalo 4.2–5.0 e comentários sem repetição de texto', () => {
    const a = gerarAvaliacoesDemo('VB-012', 'Patrícia');
    expect(a.criterios).toHaveLength(4);
    for (const c of a.criterios) {
      expect(c.nota).toBeGreaterThanOrEqual(4.2);
      expect(c.nota).toBeLessThanOrEqual(5);
    }
    expect(a.comentarios.length).toBeGreaterThanOrEqual(1);
    const textos = a.comentarios.map((c) => c.texto);
    expect(new Set(textos).size).toBe(textos.length);
    for (const c of a.comentarios) expect([4, 5]).toContain(c.nota);
  });
});
