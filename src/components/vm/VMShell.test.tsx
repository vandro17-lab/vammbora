import { describe, it, expect } from 'vitest';
import { TABS } from './VMShell';

/**
 * BLOCO F — resolução do 5º item da navegação inferior.
 * A referência alternava "Van"/"Mais"; adotamos "Mais" (hub) como 5º item, como
 * em /pro, mantendo Minha Van (/app/van) acessível de dentro do hub. Este teste
 * protege a decisão: 5 abas, a última é "Mais" → /app/mais, e todas vivem em /app.
 */
describe('BLOCO F — navegação inferior do app VanBora Motoristas', () => {
  it('tem exatamente 5 abas', () => {
    expect(TABS).toHaveLength(5);
  });

  it('o 5º item é "Mais" apontando para /app/mais', () => {
    const ultima = TABS[TABS.length - 1];
    expect(ultima.label).toBe('Mais');
    expect(ultima.to).toBe('/app/mais');
  });

  it('todas as abas apontam para rotas dentro de /app e sem destinos duplicados', () => {
    const destinos = TABS.map((t) => t.to);
    for (const to of destinos) expect(to.startsWith('/app')).toBe(true);
    expect(new Set(destinos).size).toBe(destinos.length);
  });

  it('inclui as abas essenciais (Início, Rotas, Oportunidades, Inteligência, Mais)', () => {
    const labels = TABS.map((t) => t.label);
    expect(labels).toEqual(['Início', 'Rotas', 'Oportunidades', 'Inteligência', 'Mais']);
  });

  it('apenas a aba Início faz match exato (end); as demais são prefixo', () => {
    const inicio = TABS.find((t) => t.to === '/app');
    expect(inicio?.end).toBe(true);
    for (const t of TABS.filter((x) => x.to !== '/app')) expect(t.end).toBe(false);
  });
});
