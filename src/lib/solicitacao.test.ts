import { describe, it, expect } from 'vitest';
import {
  rascunhoVazio, rascunhoDaBusca, rascunhoDaSolicitacao, validarPasso, primeiroPassoComProblema,
  solicitacaoParaBanco, solicitacaoDoBanco, cidadeDaSolicitacao, textoHorarios, acoesDoStatus, precisaEntrarParaConfirmar,
  type RascunhoSolicitacao, type LinhaSolicitacao,
} from '@/lib/solicitacao';
import { paramsParaCriterios, criteriosParaParams } from '@/lib/searchParams';
import type { CriteriosBusca } from '@/types';
import { dentroDeAracatuba } from '@/lib/geocode';
import { CIDADES } from '@/data/cidades';

const completo = (m: Partial<RascunhoSolicitacao> = {}): RascunhoSolicitacao => ({
  ...rascunhoVazio('chave-1'),
  endereco: { texto: 'Rua José Geraldo, 450', coord: { lat: -21.2, lng: -50.44 }, precisao: 'exato', validando: false },
  destinoId: 'esc-1', sentido: 'ida', horarioIda: '07:00',
  ...m,
});

describe('validação da solicitação (mesmas regras do banco)', () => {
  it('rascunho completo passa em todos os passos', () => {
    expect(primeiroPassoComProblema(completo())).toBeNull();
  });
  it('endereço sem texto, ainda localizando ou sem ponto no mapa não avança', () => {
    expect(validarPasso('endereco', completo({ endereco: { texto: 'Rua', coord: null, validando: false } }))).toMatch(/número/);
    expect(validarPasso('endereco', completo({ endereco: { texto: 'Rua A, 10', coord: null, validando: true } }))).toMatch(/localizando/);
    expect(validarPasso('endereco', completo({ endereco: { texto: 'Rua A, 10', coord: null, validando: false } }))).toMatch(/mapa/);
  });
  it('escola e horário exigidos conforme o trajeto', () => {
    expect(validarPasso('escola', completo({ destinoId: '' }))).toMatch(/escola/);
    expect(validarPasso('escola', completo({ horarioIda: '' }))).toMatch(/chegar/);
    expect(validarPasso('escola', completo({ sentido: 'volta', horarioIda: '', horarioVolta: '' }))).toMatch(/sai da escola/);
    expect(validarPasso('escola', completo({ sentido: 'ambos', horarioVolta: '' }))).toMatch(/sai da escola/);
    expect(validarPasso('escola', completo({ sentido: 'ambos', horarioVolta: '12:15' }))).toBeNull();
    expect(validarPasso('escola', completo({ horarioIda: '25:00' }))).not.toBeNull();
  });
  it('observações acima do limite são recusadas', () => {
    expect(validarPasso('detalhes', completo({ observacoes: 'x'.repeat(501) }))).toMatch(/500/);
    expect(validarPasso('detalhes', completo({ observacoes: 'x'.repeat(500) }))).toBeNull();
  });
  it('primeiro passo com problema aponta para onde corrigir', () => {
    expect(primeiroPassoComProblema(completo({ destinoId: '' }))?.passo).toBe('escola');
  });
});

describe('cidade e número de alunos', () => {
  it('a cidade vem do ponto confirmado, não de um valor fixo', () => {
    expect(cidadeDaSolicitacao(completo())).toBe('aracatuba-sp');
    expect(cidadeDaSolicitacao(completo({ endereco: { texto: 'Rua A, 10', coord: null, validando: false } }))).toBeNull();
  });
  it('a área da cidade é a mesma em que o app localiza endereços', () => {
    const a = CIDADES[0].area!;
    for (const [lat, lng] of [[a.latMin, a.lngMin], [a.latMax, a.lngMax], [-21.2, -50.44]]) expect(dentroDeAracatuba(lat, lng)).toBe(true);
    for (const [lat, lng] of [[a.latMin - 0.01, -50.4], [-21.2, a.lngMax + 0.01]]) expect(dentroDeAracatuba(lat, lng)).toBe(false);
  });
  it('ponto fora das cidades atendidas não avança', () => {
    const fora = completo({ endereco: { texto: 'Av. Paulista, 1000', coord: { lat: -23.56, lng: -46.65 }, precisao: 'ajustado', validando: false } });
    expect(cidadeDaSolicitacao(fora)).toBeNull();
    expect(validarPasso('endereco', fora)).toMatch(/fora das cidades atendidas/);
  });
  it('de 1 a 8 alunos; padrão 1; vai para o banco', () => {
    expect(rascunhoVazio('k').quantidadeAlunos).toBe(1);
    expect(validarPasso('detalhes', completo({ quantidadeAlunos: 0 }))).toMatch(/1 a 8/);
    expect(validarPasso('detalhes', completo({ quantidadeAlunos: 9 }))).toMatch(/1 a 8/);
    expect(validarPasso('detalhes', completo({ quantidadeAlunos: 3 }))).toBeNull();
    expect(solicitacaoParaBanco(completo({ quantidadeAlunos: 3 }), 'aracatuba-sp').quantidade_alunos).toBe(3);
  });
});

describe('começar pela busca (nada inventado)', () => {
  const busca: CriteriosBusca = {
    cidadeId: 'aracatuba', endereco: 'Rua José Geraldo, 450', destinoId: 'esc-1', turno: 'manha', contratacao: 'mensal',
    modalidade: 'ambos', origemLat: -21.2, origemLng: -50.44, horario: '07:10', horarioVolta: '12:20',
  };
  it('leva endereço, ponto, escola, trajeto, horários e turno da busca', () => {
    const r = rascunhoDaBusca(paramsParaCriterios(new URLSearchParams(criteriosParaParams(busca))), 'k');
    expect(r.endereco.texto).toBe('Rua José Geraldo, 450');
    expect(r.endereco.coord).toEqual({ lat: -21.2, lng: -50.44 });
    expect(r).toMatchObject({ destinoId: 'esc-1', sentido: 'ambos', horarioIda: '07:10', horarioVolta: '12:20', turno: 'manha', chave: 'k' });
    expect(r).toMatchObject({ etapa: '', acessibilidade: false, observacoes: '' });
  });
  it('sem ponto no mapa, o endereço precisa ser confirmado de novo', () => {
    const r = rascunhoDaBusca({ ...busca, origemLat: undefined, origemLng: undefined, modalidade: 'ida' }, 'k');
    expect(r.endereco.coord).toBeNull();
    expect(r.horarioVolta).toBe('');
    expect(validarPasso('endereco', r)).toMatch(/mapa/);
  });
});

describe('ida e volta do banco', () => {
  it('converte para a linha do banco sem dono nem status (definidos no servidor)', () => {
    const l = solicitacaoParaBanco(completo({ observacoes: '  dois irmãos  ', turno: 'manha' }), 'aracatuba');
    expect(l).toMatchObject({ chave_envio: 'chave-1', city_id: 'aracatuba', destination_id: 'esc-1', horario_ida_min: 420, horario_volta_min: null, observacoes: 'dois irmãos', turno: 'manha' });
    expect(l).not.toHaveProperty('owner_id');
    expect(l).not.toHaveProperty('status');
  });
  it('horário do sentido não usado vai nulo', () => {
    const l = solicitacaoParaBanco(completo({ sentido: 'volta', horarioIda: '07:00', horarioVolta: '12:30' }), 'aracatuba');
    expect(l.horario_ida_min).toBeNull();
    expect(l.horario_volta_min).toBe(750);
  });
  it('lê do banco e volta ao rascunho para editar, mantendo a chave', () => {
    const linha: LinhaSolicitacao = {
      id: 'id-1', chave_envio: 'chave-1', city_id: 'aracatuba', destination_id: 'esc-1', origem_endereco: 'Rua A, 10',
      origem_lat: -21.2, origem_lng: -50.44, sentido: 'ambos', horario_ida_min: 425, horario_volta_min: 740,
      turno: null, etapa_ensino: 'medio', quantidade_alunos: 2, precisa_acessibilidade: true, observacoes: null,
      status: 'pausada', motivo_encerramento: null, created_at: '2026-11-12T10:00:00Z', updated_at: '2026-11-12T10:00:00Z',
    };
    const s = solicitacaoDoBanco(linha);
    expect(s).toMatchObject({ id: 'id-1', status: 'pausada', etapa: 'medio', acessibilidade: true, quantidadeAlunos: 2 });
    expect(textoHorarios(s)).toBe('Ida: chegar à escola até 07:05. Volta: sair da escola a partir de 12:20');
    const r = rascunhoDaSolicitacao(s);
    expect(r).toMatchObject({ chave: 'chave-1', horarioIda: '07:05', horarioVolta: '12:20', etapa: 'medio', turno: '', quantidadeAlunos: 2 });
    expect(primeiroPassoComProblema(r)).toBeNull();
  });
});

describe('estado e conta', () => {
  it('encerrada não tem ações; pausada só reativa', () => {
    expect(acoesDoStatus('encerrada')).toEqual({ editar: false, pausar: false, reativar: false, encerrar: false });
    expect(acoesDoStatus('ativa')).toEqual({ editar: true, pausar: true, reativar: false, encerrar: true });
    expect(acoesDoStatus('pausada')).toEqual({ editar: true, pausar: false, reativar: true, encerrar: true });
  });
  it('conta só é exigida para confirmar no servidor sem sessão', () => {
    expect(precisaEntrarParaConfirmar(true, false)).toBe(true);
    expect(precisaEntrarParaConfirmar(true, true)).toBe(false);
    expect(precisaEntrarParaConfirmar(false, false)).toBe(false);
  });
});
