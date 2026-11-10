import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ABERTURA_EXIBIDA_S, ABERTURA_ORIGINAL_S, BUSCA_MINIMO_MS,
  tempoOriginalDaAbertura, opacidadeFundoAbertura, esperaRestanteDaBusca,
  URL_ABERTURA, URL_BUSCA,
} from './animacoes';
import { buscaOverlay } from './busca-overlay';

describe('abertura: 4,2 s originais comprimidos em ~2,5 s, sem cortes', () => {
  it('é proporcional do início ao fim', () => {
    expect(ABERTURA_EXIBIDA_S).toBe(2.5);
    expect(tempoOriginalDaAbertura(0)).toBe(0);
    expect(tempoOriginalDaAbertura(1.25)).toBeCloseTo(2.1, 6);
    expect(tempoOriginalDaAbertura(2.5)).toBeCloseTo(ABERTURA_ORIGINAL_S, 6);
  });
  it('nunca passa do fim nem volta antes do início', () => {
    expect(tempoOriginalDaAbertura(9)).toBeCloseTo(ABERTURA_ORIGINAL_S, 6);
    expect(tempoOriginalDaAbertura(-1)).toBe(0);
  });
  it('fundo opaco durante o logo e transparente no encerramento', () => {
    expect(opacidadeFundoAbertura(0)).toBe(1);
    expect(opacidadeFundoAbertura(3.72)).toBe(1);
    expect(opacidadeFundoAbertura(3.96)).toBeCloseTo(0.5, 6);
    expect(opacidadeFundoAbertura(4.2)).toBe(0);
  });
});

describe('busca: mínimo de 3 s na tela', () => {
  it('consulta rápida espera completar 3 s; consulta lenta não espera mais nada', () => {
    expect(BUSCA_MINIMO_MS).toBe(3000);
    expect(esperaRestanteDaBusca(1000, 1400)).toBe(2600);
    expect(esperaRestanteDaBusca(1000, 4000)).toBe(0);
    expect(esperaRestanteDaBusca(1000, 9000)).toBe(0);
    expect(esperaRestanteDaBusca(5000, 1000)).toBe(3000); // relógio ajustado: nunca mais que o mínimo
  });
});

describe('estado da tela de busca', () => {
  beforeEach(() => buscaOverlay.fechar());
  it('abrir duas vezes não reinicia a contagem (sem busca duplicada na tela)', () => {
    buscaOverlay.abrir(100);
    buscaOverlay.abrir(900);
    expect(buscaOverlay.obter()).toEqual({ aberta: true, iniciadaEm: 100 });
  });
  it('cancelar interrompe a etapa em andamento, fecha e não dispara de novo', () => {
    const interromper = vi.fn();
    const ouvinte = vi.fn();
    const sair = buscaOverlay.assinar(ouvinte);
    buscaOverlay.abrir(1);
    buscaOverlay.definirCancelamento(interromper);
    buscaOverlay.cancelar();
    buscaOverlay.cancelar();
    sair();
    expect(interromper).toHaveBeenCalledTimes(1);
    expect(buscaOverlay.obter().aberta).toBe(false);
    expect(ouvinte).toHaveBeenCalledTimes(2); // abriu, fechou
  });
  it('fechar sempre fecha, mesmo se o cancelamento falhar (nunca fica presa)', () => {
    buscaOverlay.abrir(1);
    buscaOverlay.definirCancelamento(() => { throw new Error('falha'); });
    expect(() => buscaOverlay.cancelar()).toThrow();
    expect(buscaOverlay.obter().aberta).toBe(false);
  });
});

describe('arquivos originais das animações', () => {
  const ler = (url: string) => readFileSync('public' + url.split('?')[0], 'utf8');
  it('abertura expõe renderAt/DURATION de 4,2 s e o modo conduzido de fora', () => {
    const html = ler(URL_ABERTURA);
    expect(html).toContain('const TB = 4.2;');
    expect(html).toContain('window.renderAt = t =>');
    expect(html).toContain("Q.has('capture')");
  });
  it('busca é a versão A em loop de 10 s', () => {
    const html = ler(URL_BUSCA);
    expect(URL_BUSCA).toContain('v=A');
    expect(html).toContain('const T = 10;');
  });
});
