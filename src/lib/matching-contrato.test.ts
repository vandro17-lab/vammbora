import { describe, it, expect } from 'vitest';
import { buscarMotoristas } from './matching';
import type { Motorista, CriteriosBusca } from '@/types';

/**
 * FASE 1 — Teste de PROTEÇÃO (regressão) do contrato de busca do marketplace.
 * Protege `buscarMotoristas` (src/lib/matching.ts), que alimenta a vitrine
 * pública (SearchResultsPage). Estes testes DEVEM passar: travam o comportamento
 * atual para que o redesign do app do motorista não quebre a busca das famílias.
 *
 * Contrato protegido (verificado no código): filtra por cidade, destino, turno e
 * vaga > 0; ordena disponíveis antes de sob-consulta; avulso vira sob-consulta.
 */

function motorista(over: Partial<Motorista> = {}): Motorista {
  const base: Motorista = {
    id: 'm1', slug: 'm1', nome: 'Motorista Teste',
    fotoUrl: '', vanFotoUrl: '', descricao: '',
    cidadeId: 'aracatuba', bairrosAtendidos: [],
    destinosIds: ['esc-1'], turnos: ['manha'],
    capacidadeTotal: 12, vagasDisponiveis: 3,
    recursos: { arCondicionado: false, monitor: false, cintoTresPontos: true, acessibilidade: false },
    preco: { tipo: 'a_combinar', mensal: 300, avulso: 30 },
    avaliacao: { media: 4.5, quantidade: 10 },
    janela: { horario: '06:40', toleranciaAntesMin: 3, toleranciaDepoisMin: 7 },
    documentacaoVerificada: false, whatsapp: '', demo: true,
  };
  return { ...base, ...over, recursos: { ...base.recursos, ...(over.recursos ?? {}) } };
}

const criterios = (over: Partial<CriteriosBusca> = {}): CriteriosBusca => ({
  cidadeId: 'aracatuba', endereco: '', destinoId: null, turno: null,
  contratacao: 'mensal', modalidade: 'ida', ...over,
});

describe('FASE 1 — contrato de busca do marketplace (regressão)', () => {
  it('filtra por cidade: motorista de outra cidade não aparece nem é consultado', () => {
    const lista = [motorista({ id: 'a', cidadeId: 'aracatuba' }), motorista({ id: 'b', cidadeId: 'outra' })];
    const r = buscarMotoristas(criterios(), lista, []);
    expect(r.totalConsultados).toBe(1);
    expect(r.elegiveis.map((e) => e.motorista.id)).toEqual(['a']);
  });

  it('filtra por destino: só quem atende o destino informado', () => {
    const lista = [motorista({ id: 'a', destinosIds: ['esc-1'] }), motorista({ id: 'b', destinosIds: ['esc-2'] })];
    const r = buscarMotoristas(criterios({ destinoId: 'esc-1' }), lista, []);
    expect(r.elegiveis.map((e) => e.motorista.id)).toEqual(['a']);
  });

  it('filtra por turno: só quem cobre o turno informado', () => {
    const lista = [motorista({ id: 'a', turnos: ['manha'] }), motorista({ id: 'b', turnos: ['tarde'] })];
    const r = buscarMotoristas(criterios({ turno: 'manha' }), lista, []);
    expect(r.elegiveis.map((e) => e.motorista.id)).toEqual(['a']);
  });

  it('vaga > 0 => disponível; vaga 0 => sob_consulta (não some, mas muda o nível)', () => {
    const lista = [motorista({ id: 'cheio', vagasDisponiveis: 0 }), motorista({ id: 'livre', vagasDisponiveis: 2 })];
    const r = buscarMotoristas(criterios(), lista, []);
    const porId = Object.fromEntries(r.elegiveis.map((e) => [e.motorista.id, e.nivel]));
    expect(porId['livre']).toBe('disponivel');
    expect(porId['cheio']).toBe('sob_consulta');
    // Ordenação: disponível antes de sob_consulta.
    expect(r.elegiveis[0].motorista.id).toBe('livre');
  });

  it('contratação avulsa é sempre sob_consulta (depende de folga no dia)', () => {
    const r = buscarMotoristas(criterios({ contratacao: 'avulso' }), [motorista({ vagasDisponiveis: 5 })], []);
    expect(r.elegiveis[0].nivel).toBe('sob_consulta');
  });

  it('não inventa tempo a bordo: passagem vem do horário do motorista, tempoABordoMin ausente', () => {
    const r = buscarMotoristas(criterios(), [motorista({ janela: { horario: '06:40', toleranciaAntesMin: 3, toleranciaDepoisMin: 7 } })], []);
    expect(r.elegiveis[0].passagemAproximada).toBe('06:40');
    expect('tempoABordoMin' in r.elegiveis[0]).toBe(false);
  });
});

describe('FASE 1 — GAP-2 documentado: recursos da van NÃO filtram a busca (comportamento atual)', () => {
  // Este teste PASSA porque documenta o estado atual verdadeiro (ver 02-MAPA-INTEGRACOES).
  // NÃO é o comportamento final desejado; a correção (se o produto quiser filtrar por
  // recurso) é desenvolvimento de fase futura. Mantido como regressão até lá.
  it('um motorista SEM acessibilidade ainda aparece, pois recurso não é critério de filtro', () => {
    const semAcesso = motorista({ id: 'sem', recursos: { arCondicionado: false, monitor: false, cintoTresPontos: true, acessibilidade: false } });
    const r = buscarMotoristas(criterios(), [semAcesso], []);
    expect(r.elegiveis.map((e) => e.motorista.id)).toEqual(['sem']);
  });
});
