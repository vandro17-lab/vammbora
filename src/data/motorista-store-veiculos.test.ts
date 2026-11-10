import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Veiculo } from '@/types/motorista';

/**
 * Cadastro de vans contra um Supabase SIMULADO em memória (tabela `vehicles` +
 * sessão). Prova o contrato da store — criar, reler, editar sem duplicar, erros
 * reais. NÃO prova a gravação no banco de produção (RLS/colunas reais).
 */
type Linha = Record<string, unknown> & { id: string; owner_id: string; is_demo: boolean; created_at: number };
const banco = vi.hoisted(() => ({
  linhas: [] as Record<string, unknown>[],
  usuario: null as string | null,
  falha: null as { message: string; code?: string } | null,
  seq: 0,
}));

vi.mock('@/lib/supabase', () => {
  const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  function consulta() {
    let op: 'select' | 'insert' | 'update' = 'select';
    let payload: Record<string, unknown> = {};
    const filtros: [string, unknown][] = [];
    let um: 'single' | 'maybe' | null = null;
    const executar = () => {
      if (banco.falha) return { data: null, error: banco.falha };
      const linhas = banco.linhas as Linha[];
      const casa = (l: Linha) => filtros.every(([c, v]) => l[c] === v);
      let res: Linha[];
      if (op === 'insert') {
        // RLS: with check (owner_id = auth.uid())
        if (payload.owner_id !== banco.usuario) return { data: null, error: { message: 'new row violates row-level security policy for table "vehicles"', code: '42501' } };
        const nova = { is_demo: false, ...payload, id: (payload.id as string) ?? uuid(++banco.seq), created_at: banco.seq } as Linha;
        linhas.push(nova); res = [nova];
      } else if (op === 'update') {
        res = linhas.filter((l) => casa(l) && l.owner_id === banco.usuario);
        res.forEach((l) => Object.assign(l, payload));
      } else {
        // RLS de leitura: dono OU van de demonstração.
        res = linhas.filter((l) => (l.owner_id === banco.usuario || l.is_demo) && casa(l)).sort((a, b) => a.created_at - b.created_at);
      }
      if (um === 'single') return res.length === 1 ? { data: res[0], error: null } : { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } };
      if (um === 'maybe') return { data: res[0] ?? null, error: null };
      return { data: res, error: null };
    };
    const q: Record<string, unknown> = {
      select: () => q, order: () => q,
      eq: (c: string, v: unknown) => { filtros.push([c, v]); return q; },
      insert: (p: Record<string, unknown>) => { op = 'insert'; payload = p; return q; },
      update: (p: Record<string, unknown>) => { op = 'update'; payload = p; return q; },
      single: () => { um = 'single'; return q; },
      maybeSingle: () => { um = 'maybe'; return q; },
      then: (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(executar()).then(ok, ko),
    };
    return q;
  }
  return {
    USE_SUPABASE: true,
    DEMO_MOTORISTA: false,
    supabase: {
      from: () => consulta(),
      auth: { getSession: async () => ({ data: { session: banco.usuario ? { user: { id: banco.usuario } } : null } }) },
    },
  };
});

import { listarVeiculos, salvarVeiculo, validarVeiculo, veiculoParaBanco } from './motorista-store';

const van = (over: Partial<Veiculo> = {}): Veiculo => ({
  id: '', modelo: 'Renault Master', ano: 2020, placa: 'abc1d23', lugaresPassageiro: 15,
  arCondicionado: true, acessivel: false, cintos: true, fotos: [], ...over,
});

beforeEach(() => { banco.linhas = []; banco.usuario = 'user-1'; banco.falha = null; banco.seq = 0; });

describe('cadastro de vans (Supabase simulado)', () => {
  it('cadastra com os campos existentes e recupera após "recarregar"', async () => {
    const salva = await salvarVeiculo(van());
    expect(salva.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(banco.linhas[0]).toMatchObject({ owner_id: 'user-1', model: 'Renault Master', year: 2020, plate: 'ABC1D23', seats_passenger: 15, feature_ac: true, feature_seatbelt: true, feature_accessible: false });
    // Nova leitura, do zero, como após recarregar a página.
    expect(await listarVeiculos()).toEqual([{ ...van(), id: salva.id, placa: 'ABC1D23' }]);
  });

  it('editar atualiza a mesma van, sem criar duplicata', async () => {
    const a = await salvarVeiculo(van());
    const b = await salvarVeiculo({ ...a, modelo: 'Fiat Ducato', lugaresPassageiro: 18, ano: undefined, placa: '' });
    expect(b.id).toBe(a.id);
    expect(banco.linhas).toHaveLength(1);
    const lista = await listarVeiculos();
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ id: a.id, modelo: 'Fiat Ducato', lugaresPassageiro: 18, ano: undefined, placa: undefined });
  });

  it('id do cenário de exemplo (não-UUID) vira cadastro novo, uma única vez', async () => {
    const a = await salvarVeiculo(van({ id: 'van-vm-demo' }));
    expect(a.id).not.toBe('van-vm-demo');
    await salvarVeiculo({ ...a, modelo: 'Sprinter' });
    expect(banco.linhas).toHaveLength(1);
  });

  it('lista só as vans do próprio motorista (nem demonstração, nem de outro dono)', async () => {
    banco.linhas.push(
      { id: 'd1', owner_id: 'outro', is_demo: true, model: 'Demo', seats_passenger: 10, created_at: -2 },
      { id: 'o1', owner_id: 'outro', is_demo: false, model: 'Alheia', seats_passenger: 10, created_at: -1 },
    );
    await salvarVeiculo(van());
    expect((await listarVeiculos()).map((v) => v.modelo)).toEqual(['Renault Master']);
  });

  it('não assume a van de outra pessoa ao salvar com o id dela', async () => {
    const alheia = '11111111-1111-4111-8111-111111111111';
    banco.linhas.push({ id: alheia, owner_id: 'outro', is_demo: false, model: 'Alheia', seats_passenger: 10, created_at: -1 });
    const r = await salvarVeiculo(van({ id: alheia }));
    expect(r.id).not.toBe(alheia);
    expect(banco.linhas.find((l) => l.id === alheia)).toMatchObject({ owner_id: 'outro', model: 'Alheia' });
  });

  it('sem login: não salva e diz o motivo; lista vazia', async () => {
    banco.usuario = null;
    await expect(salvarVeiculo(van())).rejects.toThrow('Faça login para salvar a van.');
    expect(await listarVeiculos()).toEqual([]);
    expect(banco.linhas).toHaveLength(0);
  });

  it('falha do banco aparece com o motivo real (salvar e listar)', async () => {
    banco.falha = { message: 'new row violates row-level security policy for table "vehicles"', code: '42501' };
    await expect(salvarVeiculo(van())).rejects.toThrow(/Sem permissão.*row-level security/);
    banco.falha = { message: 'column vehicles.is_demo does not exist', code: '42703' };
    await expect(listarVeiculos()).rejects.toThrow('column vehicles.is_demo does not exist');
  });

  it('valida antes de gravar', async () => {
    expect(validarVeiculo(van())).toBeNull();
    await expect(salvarVeiculo(van({ modelo: '   ' }))).rejects.toThrow('Informe o modelo da van.');
    await expect(salvarVeiculo(van({ lugaresPassageiro: 0 }))).rejects.toThrow(/lugares/);
    await expect(salvarVeiculo(van({ ano: 20 }))).rejects.toThrow('Confira o ano da van.');
    expect(banco.linhas).toHaveLength(0);
    expect(veiculoParaBanco(van({ ano: 0, placa: '  ' }), 'u')).toMatchObject({ year: null, plate: null });
  });
});
