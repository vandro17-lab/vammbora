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
  id: 'd1', slug: 'tio-ze', nome: 'Tio Zé', descricao: null, cidade_id: 'aracatuba-sp', whatsapp: '5518999990000',
  contato_whatsapp_ativo: false, anuncio_ativo: true, suspenso: false, rotas_disponiveis: 0, visivel: true,
};
const rascunho = { nome: '  Tio Zé  ', cidadeId: 'aracatuba-sp', apresentacao: '  ', whatsapp: '(18) 99999-0000', contatoDireto: false };

beforeEach(() => { srv.chamadas = []; srv.resposta = {}; });

describe('perfil do motorista — acesso ao servidor', () => {
  it('usuário sem perfil: leitura devolve null (estado vazio verdadeiro)', async () => {
    srv.resposta.meu_perfil_motorista = { data: null, error: null };
    expect(await obterMeuPerfil()).toBeNull();
  });

  it('perfil existente é mapeado com a situação vinda do servidor', async () => {
    srv.resposta.meu_perfil_motorista = { data: linha, error: null };
    const p = await obterMeuPerfil();
    // publicado e visível mesmo SEM rota disponível; contato direto desligado
    expect(p).toMatchObject({ slug: 'tio-ze', nome: 'Tio Zé', temPerfil: true, rotasDisponiveis: 0, visivel: true, contatoWhatsappAtivo: false, local: false });
  });

  it('salvar envia SÓ os campos do perfil (nunca id, dono, selo ou nota); WhatsApp sempre, contato DESLIGADO por padrão', async () => {
    srv.resposta.salvar_perfil_motorista = { data: linha, error: null };
    srv.resposta.meu_perfil_motorista = { data: linha, error: null };
    await salvarMeuPerfil(rascunho);
    const chamada = srv.chamadas.find((c) => c.fn === 'salvar_perfil_motorista');
    expect(chamada?.args).toEqual({ p_nome: 'Tio Zé', p_descricao: null, p_city_id: 'aracatuba-sp', p_whatsapp: '5518999990000', p_contato_whatsapp_ativo: false });
  });

  it('contato direto é uma escolha separada do WhatsApp obrigatório', async () => {
    srv.resposta.salvar_perfil_motorista = { data: linha, error: null };
    await salvarMeuPerfil({ ...rascunho, contatoDireto: true });
    expect(srv.chamadas[0].args).toMatchObject({ p_whatsapp: '5518999990000', p_contato_whatsapp_ativo: true });
  });

  it('sem WhatsApp, ou inválido, nem chega ao servidor', async () => {
    await expect(salvarMeuPerfil({ ...rascunho, whatsapp: '' })).rejects.toThrow(/Confira o WhatsApp/);
    await expect(salvarMeuPerfil({ ...rascunho, whatsapp: '123' })).rejects.toThrow(/Confira o WhatsApp/);
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
