import { describe, it, expect } from 'vitest';
import { SLOTS, slotPorId, slotsPorGrupo, aspecto, FORMATOS_TRANSP } from './slots';

/**
 * Protege o registro de espaços editáveis (gerenciador de artes). Falhar aqui
 * significa que um slot ficou inconsistente (id duplicado, dimensão inválida,
 * formato ausente) — o que quebraria o admin e/ou os componentes com fallback.
 */
describe('Registro de slots de arte (app_assets)', () => {
  it('não há ids duplicados', () => {
    const ids = SLOTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todo slot tem dimensões positivas, formatos e aspecto > 0', () => {
    for (const s of SLOTS) {
      expect(s.largura, s.id).toBeGreaterThan(0);
      expect(s.altura, s.id).toBeGreaterThan(0);
      expect(s.formatos.length, s.id).toBeGreaterThan(0);
      expect(aspecto(s), s.id).toBeGreaterThan(0);
    }
  });

  it('inclui os espaços combinados: van, clube e 8 ícones da Mais', () => {
    expect(slotPorId('header.van')?.kind).toBe('ilustracao');
    expect(slotPorId('clube.art')?.kind).toBe('ilustracao');
    const icones = SLOTS.filter((s) => s.kind === 'icone');
    expect(icones).toHaveLength(8);
    for (const id of ['icon.minhaVan', 'icon.calendario', 'icon.manutencao', 'icon.combustivel', 'icon.relatorios', 'icon.documentacao', 'icon.ajuda', 'icon.config']) {
      expect(slotPorId(id), id).toBeTruthy();
    }
  });

  it('ícones são quadrados e pedem transparência', () => {
    for (const s of SLOTS.filter((x) => x.kind === 'icone')) {
      expect(aspecto(s), s.id).toBe(1);
      expect(s.transparencia, s.id).toBe(true);
      expect(s.formatos, s.id).toEqual(FORMATOS_TRANSP);
    }
  });

  it('o agrupamento cobre todos os slots sem perder nenhum', () => {
    const total = slotsPorGrupo().reduce((n, g) => n + g.itens.length, 0);
    expect(total).toBe(SLOTS.length);
  });

  it('slotPorId devolve undefined para id inexistente', () => {
    expect(slotPorId('nao.existe')).toBeUndefined();
  });
});
