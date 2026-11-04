import { describe, it, expect } from 'vitest';
import { formatBRL, plural, horaParaMinutos, minutosParaTextoHora } from './utils';

describe('utils', () => {
  it('formatBRL formata em reais sem centavos', () => {
    expect(formatBRL(320)).toContain('320');
    expect(formatBRL(320)).toContain('R$');
  });

  it('plural concorda em número', () => {
    expect(plural(1, 'vaga', 'vagas')).toBe('1 vaga');
    expect(plural(3, 'vaga', 'vagas')).toBe('3 vagas');
  });

  it('converte hora <-> minutos', () => {
    expect(horaParaMinutos('06:38')).toBe(398);
    expect(minutosParaTextoHora(398)).toBe('6h38');
    expect(minutosParaTextoHora(425)).toBe('7h05');
  });
});
