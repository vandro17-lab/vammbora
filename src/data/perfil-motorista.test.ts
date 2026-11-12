import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Contrato do acesso ao perfil contra um Supabase SIMULADO (só as RPCs).
 * Prova o que o app envia e como trata as respostas. NÃO prova o banco:
 * as regras do servidor (dono, duplicidade, publicação) são testadas em
 * supabase/tests/perfil_motorista.sql.
 */
const srv = vi.hoisted(() => ({
  chamadas: [] as { fn: string; args: unknown }[],
  resposta: {} as Record<string, { data: unknown; error: { code?: string; message: string } | null }>,
}));

vi.mock('@/lib/supabase', () => ({
  USE_SUPABASE: true,
  DEMO_MOTORISTA: false,
  supabase: {
    rpc: async (fn: string, args?: unknown) => {
      srv.chamadas.push({ fn, args });
      return srv.resposta[fn] ?? { data: null, error: null };
    },
  },
}));
vi.mock('@/data/motorista-store', () => ({ listarRotas: async () => [], listarVeiculos: async () => [] }));

import { obterMeuPerfil, salvarMeuPerfil, publicarMeuPerfil, erroDoPerfil } from './perfil-motorista';

const linha = {
  id: 'd1', slug: 'tio-ze', nome: 'Tio Zé', descricao: null, cidade_id: 'aracatuba-sp', whatsapp_contato: null,
  anuncio_ativo: false, suspenso: false, rota_concluida_com_van: true, visivel: false,
};
const rascunho = { nome: '  Tio Zé  ', cidadeId: 'aracatuba-sp', apresentacao: '  ', aceitaWhatsapp: false, whatsapp: '(18) 99999-0000' };

beforeEach(() => { srv.chamadas = []; srv.resposta = {}; });

describe('perfil do motorista — acesso ao servidor', () => {
  it('usuário sem perfil: leitura devolve null (estado vazio verdadeiro)', async () => {
    srv.resposta.meu_perfil_motorista = { data: null, error: null };
    expect(await obterMeuPerfil()).toBeNull();
  });

  it('perfil existente é mapeado com a situação vinda do servidor', async () => {
    srv.resposta.meu_perfil_motorista = { data: linha, error: null };
    const p = await obterMeuPerfil();
    expect(p).toMatchObject({ slug: 'tio-ze', nome: 'Tio Zé', temPerfil: true, rotaConcluidaComVan: true, visivel: false, local: false });
  });

  it('salvar envia SÓ os campos do perfil (nunca id, dono, selo ou nota)', async () => {
    srv.resposta.salvar_perfil_motorista = { data: linha, error: null };
    srv.resposta.meu_perfil_motorista = { data: linha, error: null };
    await salvarMeuPerfil(rascunho);
    const chamada = srv.chamadas.find((c) => c.fn === 'salvar_perfil_motorista');
    expect(chamada?.args).toEqual({ p_nome: 'Tio Zé', p_descricao: null, p_city_id: 'aracatuba-sp', p_whatsapp_contato: null });
  });

  it('WhatsApp só vai quando o motorista aceita contato, já normalizado', async () => {
    srv.resposta.salvar_perfil_motorista = { data: linha, error: null };
    await salvarMeuPerfil({ ...rascunho, aceitaWhatsapp: true });
    expect((srv.chamadas[0].args as Record<string, unknown>).p_whatsapp_contato).toBe('5518999990000');
  });

  it('WhatsApp inválido nem chega ao servidor', async () => {
    await expect(salvarMeuPerfil({ ...rascunho, aceitaWhatsapp: true, whatsapp: '123' })).rejects.toThrow(/Confira o WhatsApp/);
    expect(srv.chamadas).toHaveLength(0);
  });

  it('publicar e despublicar chamam a RPC do próprio perfil', async () => {
    await publicarMeuPerfil(true);
    await publicarMeuPerfil(false);
    expect(srv.chamadas.map((c) => c.args)).toEqual([{ p_ativo: true }, { p_ativo: false }]);
  });

  it('erros reais aparecem em linguagem simples (sem fingir sucesso)', async () => {
    srv.resposta.salvar_perfil_motorista = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
    await expect(salvarMeuPerfil(rascunho)).rejects.toThrow(/ainda não foi liberado no servidor/);
    srv.resposta.publicar_perfil_motorista = { data: null, error: { code: 'P0002', message: 'Crie seu perfil profissional antes de publicar.' } };
    await expect(publicarMeuPerfil(true)).rejects.toThrow(/Crie seu perfil/);
    expect(erroDoPerfil({ code: '23505', message: 'duplicate key' }).message).toMatch(/já tem um perfil/);
    expect(erroDoPerfil({ code: '42501', message: 'x' }).message).toMatch(/sessão expirou/);
  });

  it('servidor sem confirmação de gravação não vira sucesso', async () => {
    srv.resposta.salvar_perfil_motorista = { data: null, error: null };
    await expect(salvarMeuPerfil(rascunho)).rejects.toThrow(/não confirmou/);
  });
});
