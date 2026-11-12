import { supabase, USE_SUPABASE } from '@/lib/supabase';
import {
  primeiroPassoComProblema, solicitacaoDoBanco, solicitacaoParaBanco, cidadeDaSolicitacao, fonteDoMunicipio,
  type LinhaSolicitacao, type MotivoEncerramento, type RascunhoSolicitacao, type Solicitacao, type StatusSolicitacao,
} from '@/lib/solicitacao';

/**
 * Solicitações da FAMÍLIA logada (tabela transport_requests, migração
 * 20261112224903). A RLS garante no servidor que cada conta só lê e altera as
 * próprias; o app nunca envia id de outra conta. Sem Supabase (ambiente de
 * demonstração), guarda no navegador.
 */
const K_LOCAL = 'vanbora.demo.solicitacoes';
const COLUNAS = 'id,chave_envio,city_id,origem_municipio_ibge,origem_municipio_fonte,destination_id,origem_endereco,origem_lat,origem_lng,sentido,horario_ida_min,horario_volta_min,turno,etapa_ensino,quantidade_alunos,precisa_acessibilidade,observacoes,status,motivo_encerramento,created_at,updated_at';

export const SOLICITACOES_NO_SERVIDOR = USE_SUPABASE && !!supabase;

/** Erro do servidor → mensagem simples; o detalhe técnico fica no console. */
export function erroDaSolicitacao(e: { code?: string; message?: string }): Error {
  const real = e.message || '';
  if (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST202') {
    return new Error('As solicitações ainda não foram liberadas no servidor. Tente de novo mais tarde.');
  }
  if (e.code === '42501') return new Error('Sua sessão expirou. Entre de novo na sua conta.');
  if (e.code === 'P0001') return new Error(real); // regra do servidor, já em português
  if (e.code === '23503') return new Error('A escola escolhida não está mais disponível. Escolha outra.');
  if (e.code === '23514') return new Error('Algum dado não foi aceito. Confira os campos e tente de novo.');
  if (/fetch|network/i.test(real)) return new Error('Sem conexão. Verifique a internet e tente de novo.');
  console.warn('[solicitacoes] erro do servidor:', e.code, real);
  return new Error('Não foi possível concluir agora. Tente de novo em instantes.');
}

/* ------------------------------ modo local ------------------------------ */
function lerLocal(): Solicitacao[] {
  try { return JSON.parse(localStorage.getItem(K_LOCAL) || '[]') as Solicitacao[]; } catch { return []; }
}
function gravarLocal(lista: Solicitacao[]) {
  try { localStorage.setItem(K_LOCAL, JSON.stringify(lista)); } catch { /* sem armazenamento */ }
}

/* ------------------------------- leituras ------------------------------- */
export async function listarMinhasSolicitacoes(): Promise<Solicitacao[]> {
  if (SOLICITACOES_NO_SERVIDOR && supabase) {
    const { data, error } = await supabase.from('transport_requests').select(COLUNAS).order('created_at', { ascending: false });
    if (error) throw erroDaSolicitacao(error);
    return ((data ?? []) as unknown as LinhaSolicitacao[]).map(solicitacaoDoBanco);
  }
  return lerLocal().sort((a, b) => (a.criadaEm < b.criadaEm ? 1 : -1));
}

export async function obterSolicitacao(id: string): Promise<Solicitacao | null> {
  if (SOLICITACOES_NO_SERVIDOR && supabase) {
    const { data, error } = await supabase.from('transport_requests').select(COLUNAS).eq('id', id).maybeSingle();
    if (error) throw erroDaSolicitacao(error);
    return data ? solicitacaoDoBanco(data as unknown as LinhaSolicitacao) : null;
  }
  return lerLocal().find((s) => s.id === id) ?? null;
}

/* ------------------------------- escritas ------------------------------- */
/** Confere o rascunho e devolve a cidade identificada pelo ponto confirmado. */
function conferir(r: RascunhoSolicitacao): string {
  const p = primeiroPassoComProblema(r);
  if (p) throw new Error(p.erro);
  const cidade = cidadeDaSolicitacao(r);
  if (!cidade) throw new Error('Esse endereço fica fora das cidades atendidas. Confira o ponto no mapa.');
  if (!r.municipioIbge || !fonteDoMunicipio(r)) throw new Error('Confirme a cidade do embarque.');
  return cidade;
}

/**
 * Cria a solicitação (só depois da confirmação da família). O mesmo envio
 * repetido (mesma `chave`) devolve a solicitação já criada, sem duplicar.
 */
export async function criarSolicitacao(r: RascunhoSolicitacao): Promise<Solicitacao> {
  const linha = solicitacaoParaBanco(r, conferir(r));
  if (SOLICITACOES_NO_SERVIDOR && supabase) {
    const { data: sessao } = await supabase.auth.getSession();
    const dono = sessao.session?.user?.id;
    if (!dono) throw new Error('Entre na sua conta para confirmar a solicitação.');
    const ins = await supabase.from('transport_requests')
      .upsert({ ...linha, owner_id: dono }, { onConflict: 'owner_id,chave_envio', ignoreDuplicates: true });
    if (ins.error) throw erroDaSolicitacao(ins.error);
    const { data, error } = await supabase.from('transport_requests').select(COLUNAS).eq('owner_id', dono).eq('chave_envio', r.chave).maybeSingle();
    if (error) throw erroDaSolicitacao(error);
    if (!data) throw new Error('O servidor não confirmou a solicitação. Tente de novo.');
    return solicitacaoDoBanco(data as unknown as LinhaSolicitacao);
  }
  const lista = lerLocal();
  const existente = lista.find((s) => s.chave === r.chave);
  if (existente) return existente;
  const agora = new Date().toISOString();
  const nova: Solicitacao = {
    id: r.chave, chave: r.chave, cidadeId: linha.city_id,
    municipioIbge: linha.origem_municipio_ibge as number, municipioFonte: linha.origem_municipio_fonte as Solicitacao['municipioFonte'],
    destinoId: linha.destination_id, endereco: linha.origem_endereco,
    lat: linha.origem_lat as number, lng: linha.origem_lng as number, sentido: r.sentido,
    horarioIdaMin: linha.horario_ida_min, horarioVoltaMin: linha.horario_volta_min,
    turno: linha.turno as Solicitacao['turno'], etapa: linha.etapa_ensino as Solicitacao['etapa'],
    quantidadeAlunos: linha.quantidade_alunos, acessibilidade: linha.precisa_acessibilidade, observacoes: linha.observacoes,
    status: 'ativa', motivoEncerramento: null, criadaEm: agora, atualizadaEm: agora,
  };
  gravarLocal([nova, ...lista]);
  return nova;
}

/** Edita os dados (a RLS só deixa alterar as da própria conta). */
export async function atualizarSolicitacao(id: string, r: RascunhoSolicitacao): Promise<Solicitacao> {
  const { chave_envio: _chave, ...campos } = solicitacaoParaBanco(r, conferir(r));
  void _chave;
  return gravar(id, campos);
}

/** Pausar, reativar ou encerrar. Encerrar é definitivo. */
export async function mudarStatus(id: string, status: StatusSolicitacao, motivo: MotivoEncerramento | null = null): Promise<Solicitacao> {
  return gravar(id, { status, motivo_encerramento: status === 'encerrada' ? motivo : null });
}

async function gravar(id: string, campos: Record<string, unknown>): Promise<Solicitacao> {
  if (SOLICITACOES_NO_SERVIDOR && supabase) {
    const { data, error } = await supabase.from('transport_requests').update(campos).eq('id', id).select(COLUNAS).maybeSingle();
    if (error) throw erroDaSolicitacao(error);
    if (!data) throw new Error('Solicitação não encontrada na sua conta.');
    return solicitacaoDoBanco(data as unknown as LinhaSolicitacao);
  }
  const lista = lerLocal();
  const i = lista.findIndex((s) => s.id === id);
  if (i < 0) throw new Error('Solicitação não encontrada na sua conta.');
  if (lista[i].status === 'encerrada') throw new Error('Esta solicitação foi encerrada e não pode mais ser alterada.');
  const c = campos as Partial<Record<string, unknown>>;
  const atual = lista[i];
  const novo: Solicitacao = {
    ...atual,
    ...(c.destination_id !== undefined ? {
      destinoId: c.destination_id as string, endereco: c.origem_endereco as string, lat: c.origem_lat as number, lng: c.origem_lng as number,
      sentido: c.sentido as Solicitacao['sentido'], horarioIdaMin: c.horario_ida_min as number | null, horarioVoltaMin: c.horario_volta_min as number | null,
      turno: c.turno as Solicitacao['turno'], etapa: c.etapa_ensino as Solicitacao['etapa'],
      cidadeId: c.city_id as string, quantidadeAlunos: c.quantidade_alunos as number,
      municipioIbge: c.origem_municipio_ibge as number, municipioFonte: c.origem_municipio_fonte as Solicitacao['municipioFonte'],
      acessibilidade: !!c.precisa_acessibilidade, observacoes: c.observacoes as string | null,
    } : {}),
    ...(c.status !== undefined ? { status: c.status as StatusSolicitacao, motivoEncerramento: (c.motivo_encerramento as MotivoEncerramento | null) ?? null } : {}),
    atualizadaEm: new Date().toISOString(),
  };
  lista[i] = novo;
  gravarLocal(lista);
  return novo;
}
