import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RascunhoSolicitacao } from '@/lib/solicitacao';
import { rascunhoVazio } from '@/lib/solicitacao';

/**
 * Cliente das solicitações contra um Supabase SIMULADO que reproduz o que a
 * migração 20261112230000 garante: RLS por dono, (owner_id, chave_envio) único
 * e gatilho que força status 'ativa' na criação e trava a encerrada.
 * NÃO grava no banco real — prova o contrato do cliente.
 */
const db = vi.hoisted(() => ({
  usuario: 'conta-a' as string | null,
  linhas: [] as Record<string, unknown>[],
  upserts: [] as { linha: Record<string, unknown>; opcoes: Record<string, unknown> }[],
  seq: 0,
  falha: null as null | { code: string; message: string },
}));

vi.mock('@/lib/supabase', () => {
  class Consulta {
    private filtros: [string, unknown][] = [];
    private alteracao: Record<string, unknown> | null = null;
    eq(c: string, v: unknown) { this.filtros.push([c, v]); return this; }
    order() { return this; }
    select() { return this; }
    update(c: Record<string, unknown>) { this.alteracao = c; return this; }
    private visiveis() {
      return db.linhas.filter((l) => l.owner_id === db.usuario && this.filtros.every(([c, v]) => l[c] === v));
    }
    private executar() {
      if (db.falha) return { data: null, error: db.falha };
      const alvo = this.visiveis();
      if (this.alteracao) {
        for (const l of alvo) {
          if (l.status === 'encerrada') return { data: null, error: { code: 'P0001', message: 'Esta solicitação foi encerrada e não pode mais ser alterada.' } };
          Object.assign(l, this.alteracao, { owner_id: l.owner_id, chave_envio: l.chave_envio });
        }
      }
      return { data: alvo, error: null };
    }
    async maybeSingle() { const r = this.executar(); return { data: r.data?.[0] ?? null, error: r.error }; }
    then<T>(ok: (v: { data: unknown; error: unknown }) => T) { return Promise.resolve(this.executar()).then(ok); }
  }
  const supabase = {
    auth: { getSession: async () => ({ data: { session: db.usuario ? { user: { id: db.usuario } } : null } }) },
    from: () => ({
      select: () => new Consulta(),
      update: (c: Record<string, unknown>) => new Consulta().update(c),
      upsert: async (linha: Record<string, unknown>, opcoes: Record<string, unknown>) => {
        db.upserts.push({ linha, opcoes });
        if (db.falha) return { error: db.falha };
        if (linha.owner_id !== db.usuario) return { error: { code: '42501', message: 'new row violates row-level security policy' } };
        const existe = db.linhas.some((l) => l.owner_id === linha.owner_id && l.chave_envio === linha.chave_envio);
        if (!existe) {
          db.linhas.push({ ...linha, id: `id-${++db.seq}`, status: 'ativa', motivo_encerramento: null, created_at: '2026-11-12T10:00:00Z', updated_at: '2026-11-12T10:00:00Z' });
        }
        return { error: null };
      },
    }),
  };
  return { supabase, USE_SUPABASE: true };
});

import { criarSolicitacao, listarMinhasSolicitacoes, obterSolicitacao, atualizarSolicitacao, mudarStatus, erroDaSolicitacao } from '@/data/solicitacoes';

const rascunho = (chave = 'chave-1'): RascunhoSolicitacao => ({
  ...rascunhoVazio(chave),
  endereco: { texto: 'Rua José Geraldo, 450', coord: { lat: -21.2, lng: -50.44 }, precisao: 'exato', validando: false },
  municipioIbge: 3502804, municipioDoMapa: { lat: -21.2, lng: -50.44, resultado: { nome: 'Araçatuba', uf: 'SP' } },
  destinoId: 'esc-1', sentido: 'ida', horarioIda: '07:00',
});

beforeEach(() => { db.usuario = 'conta-a'; db.linhas = []; db.upserts = []; db.seq = 0; db.falha = null; });

describe('criar solicitação', () => {
  it('cria pela conta logada, sem duplicar o mesmo envio (cliques repetidos)', async () => {
    const a = await criarSolicitacao(rascunho());
    const b = await criarSolicitacao(rascunho());
    expect(b.id).toBe(a.id);
    expect(db.linhas).toHaveLength(1);
    expect(db.upserts[0].opcoes).toEqual({ onConflict: 'owner_id,chave_envio', ignoreDuplicates: true });
    expect(db.upserts[0].linha.owner_id).toBe('conta-a');
    expect(db.upserts[0].linha).not.toHaveProperty('status');
    expect(a.status).toBe('ativa');
  });
  it('sem sessão não envia nada', async () => {
    db.usuario = null;
    await expect(criarSolicitacao(rascunho())).rejects.toThrow(/Entre na sua conta/);
    expect(db.upserts).toHaveLength(0);
  });
  it('grava a cidade do ponto confirmado e o número de alunos', async () => {
    await criarSolicitacao({ ...rascunho(), quantidadeAlunos: 2 });
    expect(db.upserts[0].linha).toMatchObject({ city_id: 'aracatuba-sp', quantidade_alunos: 2, origem_municipio_ibge: 3502804, origem_municipio_fonte: 'mapa' });
  });
  it('município não conferido nem confirmado não chega ao servidor', async () => {
    await expect(criarSolicitacao({ ...rascunho(), municipioDoMapa: { lat: -21.2, lng: -50.44, resultado: null } })).rejects.toThrow(/Confirme/);
    expect(db.upserts).toHaveLength(0);
  });
  it('ponto fora das cidades atendidas não chega ao servidor', async () => {
    const fora = { ...rascunho(), endereco: { texto: 'Av. Paulista, 1000', coord: { lat: -23.56, lng: -46.65 }, precisao: 'ajustado' as const, validando: false } };
    await expect(criarSolicitacao(fora)).rejects.toThrow(/fora das cidades atendidas/);
    expect(db.upserts).toHaveLength(0);
  });
  it('rascunho incompleto não chega ao servidor', async () => {
    await expect(criarSolicitacao({ ...rascunho(), destinoId: '' })).rejects.toThrow(/escola/);
    expect(db.upserts).toHaveLength(0);
  });
});

describe('isolamento entre contas', () => {
  it('a outra conta não vê, não abre e não altera', async () => {
    const a = await criarSolicitacao(rascunho());
    db.usuario = 'conta-b';
    expect(await listarMinhasSolicitacoes()).toEqual([]);
    expect(await obterSolicitacao(a.id)).toBeNull();
    await expect(mudarStatus(a.id, 'encerrada')).rejects.toThrow(/não encontrada/);
    db.usuario = 'conta-a';
    expect((await obterSolicitacao(a.id))?.status).toBe('ativa');
  });
});

describe('editar e mudar estado', () => {
  it('edita sem trocar a chave do envio', async () => {
    const a = await criarSolicitacao(rascunho());
    const e = await atualizarSolicitacao(a.id, { ...rascunho('outra-chave'), horarioIda: '07:30' });
    expect(e.horarioIdaMin).toBe(450);
    expect(e.chave).toBe('chave-1');
  });
  it('pausa, reativa e encerra; encerrada não volta', async () => {
    const a = await criarSolicitacao(rascunho());
    expect((await mudarStatus(a.id, 'pausada')).status).toBe('pausada');
    expect((await mudarStatus(a.id, 'ativa')).status).toBe('ativa');
    const fim = await mudarStatus(a.id, 'encerrada', 'desistiu');
    expect(fim).toMatchObject({ status: 'encerrada', motivoEncerramento: 'desistiu' });
    await expect(mudarStatus(a.id, 'ativa')).rejects.toThrow(/encerrada/);
  });
  it('motivo só é gravado ao encerrar', async () => {
    const a = await criarSolicitacao(rascunho());
    expect((await mudarStatus(a.id, 'pausada', 'desistiu')).motivoEncerramento).toBeNull();
  });
});

describe('mensagens de erro', () => {
  it('tabela ausente, sessão, regra do servidor e falha de rede viram texto simples', () => {
    expect(erroDaSolicitacao({ code: 'PGRST205' }).message).toMatch(/ainda não foram liberadas/);
    expect(erroDaSolicitacao({ code: '42501' }).message).toMatch(/sessão/);
    expect(erroDaSolicitacao({ code: 'P0001', message: 'Você já tem 10 solicitações abertas.' }).message).toBe('Você já tem 10 solicitações abertas.');
    expect(erroDaSolicitacao({ message: 'TypeError: Failed to fetch' }).message).toMatch(/conexão/);
  });
  it('erro desconhecido não vaza detalhe técnico', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(erroDaSolicitacao({ code: 'XX000', message: 'relation internal secret' }).message).not.toMatch(/secret/);
    warn.mockRestore();
  });
  it('falha do servidor ao criar é repassada sem gravar', async () => {
    db.falha = { code: '42P01', message: 'relation "transport_requests" does not exist' };
    await expect(criarSolicitacao(rascunho())).rejects.toThrow(/ainda não foram liberadas/);
    expect(db.linhas).toHaveLength(0);
  });
});
