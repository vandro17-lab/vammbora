import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ContextoInteresse } from '@/lib/contexto-interesse';

/**
 * Gravação do pedido de interesse COM contexto.
 * TESTE SIMULADO: o Supabase é um objeto de mentira (não comprova o banco real
 * nem a migração 0017, que não foi aplicada).
 */
const chamadas: { fn: string; args: Record<string, unknown> }[] = [];
const respostas: Record<string, { data: unknown; error: { code?: string; message: string } | null }> = {};

vi.mock('@/lib/supabase', () => ({
  USE_SUPABASE: true, DEMO_MOTORISTA: false, DEMO_BUSCA: false,
  supabase: { rpc: async (fn: string, args: Record<string, unknown>) => { chamadas.push({ fn, args }); return respostas[fn] ?? { data: null, error: { code: 'PGRST202', message: 'função não encontrada' } }; } },
}));

import { registrarInteresse } from '@/data/source';

const contexto: ContextoInteresse = {
  destinoId: 'esc-1', contratacao: 'mensal', trechos: [{ sentido: 'ida', horarioMin: 410 }],
  rota: { rotaId: 'r-1', sentido: 'ida', status: 'sob_confirmacao', origemEscola: 'visita', passagemCasaMin: 398, horarioEscolaMin: 410, versao: 'v9', temposEstimados: false, condicao: 'depende do motorista' },
};
const base = { cidadeId: 'aracatuba', nome: 'Ana', whatsapp: '18999990000', consentimento: true, regiao: 'Centro', destinoId: 'esc-1', turno: 'manha' as const };

beforeEach(() => { chamadas.length = 0; for (const k of Object.keys(respostas)) delete respostas[k]; });

describe('[simulado] registrarInteresse com contexto', () => {
  it('com a migração 0017: o contexto vai inteiro, no campo próprio, numa única gravação', async () => {
    respostas.registrar_interesse_v2 = { data: 'id-1', error: null };
    const r = await registrarInteresse({ ...base, contexto });
    expect(r).toMatchObject({ ok: true, id: 'id-1', contexto: 'completo' });
    expect(chamadas.map((c) => c.fn)).toEqual(['registrar_interesse_v2']);
    expect(chamadas[0].args).toMatchObject({ p_region: 'Centro', p_context: contexto });
  });

  it('banco ainda sem a função nova: grava pela antiga com um RESUMO do contexto junto da região (não se perde)', async () => {
    respostas.registrar_interesse = { data: 'id-2', error: null };
    const r = await registrarInteresse({ ...base, contexto });
    expect(r).toMatchObject({ ok: true, id: 'id-2', contexto: 'resumido' });
    expect(chamadas.map((c) => c.fn)).toEqual(['registrar_interesse_v2', 'registrar_interesse']);
    expect(chamadas[1].args.p_region).toBe('Centro [ida até 06h50 · rota r-1 v:v9 sob_confirmacao]');
  });

  it('erro REAL na função nova (não é "função ausente") aparece — não é mascarado nem gravado em dobro', async () => {
    respostas.registrar_interesse_v2 = { data: null, error: { code: '23514', message: 'Contexto do pedido inválido.' } };
    const r = await registrarInteresse({ ...base, contexto });
    expect(r).toEqual({ ok: false, erro: 'Contexto do pedido inválido.' });
    expect(chamadas.map((c) => c.fn)).toEqual(['registrar_interesse_v2']);
  });

  it('pedido sem contexto: comportamento anterior, sem tocar na região', async () => {
    respostas.registrar_interesse = { data: 'id-3', error: null };
    const r = await registrarInteresse(base);
    expect(r).toMatchObject({ ok: true, contexto: 'nenhum' });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].args.p_region).toBe('Centro');
  });
});
