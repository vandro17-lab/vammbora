import { describe, it, expect } from 'vitest';
import { createRoutesFromElements, matchRoutes } from 'react-router-dom';
import {
  LINKS_ENTRADA_MOTORISTA,
  REDIRECIONAMENTOS_MOTORISTA,
  rotasRedirecionamentoMotorista,
} from './navegacao-motorista';

/**
 * FASE 2 — testes de navegação e redirecionamento (nível de configuração/rotas).
 * Usam `matchRoutes` (puro, sem DOM) sobre a MESMA configuração que o App usa.
 * Protegem a unificação: a entrada leva ao app REAL (não à demo) e os aliases
 * canônicos resolvem sem quebrar os caminhos antigos.
 *
 * (Render-level e2e de navegação exigiria jsdom + Testing Library, não incluídos
 * neste projeto; por isso o fluxo visual completo fica "não verificado" aqui.)
 */

describe('FASE 2 — entrada do Vambora Motoristas leva ao app real (não à demo)', () => {
  it('o botão principal "Entrar" aponta para a autenticação existente, nunca para /pro', () => {
    expect(LINKS_ENTRADA_MOTORISTA.entrar).toBe('/motorista/conta');
    expect(LINKS_ENTRADA_MOTORISTA.entrar).not.toBe(LINKS_ENTRADA_MOTORISTA.demonstracao);
  });

  it('o app operacional real é /painel e a demonstração é /pro (claramente separados)', () => {
    expect(LINKS_ENTRADA_MOTORISTA.app).toBe('/painel');
    expect(LINKS_ENTRADA_MOTORISTA.demonstracao).toBe('/pro');
    expect(LINKS_ENTRADA_MOTORISTA.voltar).toBe('/');
  });
});

describe('FASE 2 — redirecionamentos canônicos (aditivos, sem quebrar links antigos)', () => {
  const routes = createRoutesFromElements(<>{rotasRedirecionamentoMotorista()}</>);

  it('não há `de` duplicado e todo alias tem destino', () => {
    const des = REDIRECIONAMENTOS_MOTORISTA.map((r) => r.de);
    expect(new Set(des).size).toBe(des.length);
    for (const r of REDIRECIONAMENTOS_MOTORISTA) {
      expect(r.para.startsWith('/')).toBe(true);
      expect(r.de).not.toBe(r.para);
    }
  });

  it('inclui os aliases esperados do Vambora Motoristas', () => {
    const mapa = Object.fromEntries(REDIRECIONAMENTOS_MOTORISTA.map((r) => [r.de, r.para]));
    expect(mapa['/motoristas']).toBe('/motorista');
    expect(mapa['/vambora-motoristas']).toBe('/motorista');
    expect(mapa['/app']).toBe('/painel');
  });

  it('cada alias resolve na configuração de rotas e redireciona para o alvo correto', () => {
    for (const r of REDIRECIONAMENTOS_MOTORISTA) {
      const m = matchRoutes(routes, r.de);
      expect(m, `alias ${r.de} deve existir`).not.toBeNull();
      const encontrado = m![m!.length - 1].route;
      expect(encontrado.path).toBe(r.de);
      // O elemento da rota é um <Navigate to={para} replace/>.
      const el = encontrado.element as { props?: { to?: string; replace?: boolean } } | undefined;
      expect(el?.props?.to).toBe(r.para);
      expect(el?.props?.replace).toBe(true);
    }
  });

  it('um alias desconhecido NÃO resolve (não captura rotas alheias)', () => {
    expect(matchRoutes(routes, '/painel')).toBeNull();
    expect(matchRoutes(routes, '/motorista')).toBeNull();
    expect(matchRoutes(routes, '/pro')).toBeNull();
  });
});
