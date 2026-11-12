import { describe, it, expect } from 'vitest';
import { caminhoSeguro } from '@/lib/auth';

describe('retorno depois de entrar (sem redirecionamento aberto)', () => {
  it('aceita só caminhos internos do app', () => {
    expect(caminhoSeguro('/familia/solicitacoes/nova')).toBe('/familia/solicitacoes/nova');
    expect(caminhoSeguro('/familia/solicitacoes/abc?x=1')).toBe('/familia/solicitacoes/abc?x=1');
  });
  it('recusa outros sites e formatos perigosos', () => {
    for (const ruim of ['//evil.example', 'https://evil.example', 'javascript:alert(1)', '/\\evil.example', 'familia', '/a b', '', null, undefined]) {
      expect(caminhoSeguro(ruim, '/familia/solicitacoes')).toBe('/familia/solicitacoes');
    }
  });
  it('sem retorno informado, o motorista continua indo para o painel', () => {
    expect(caminhoSeguro(null)).toBe('/painel');
  });
});
