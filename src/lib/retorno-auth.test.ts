import { describe, it, expect } from 'vitest';
import { hashDeAutenticacao, lerRetornoAuth, mensagemErroLogin, urlSemErroDeAuth } from '@/lib/retorno-auth';
import { caminhoSeguro } from '@/lib/auth';

const BASE = 'https://vammboraa.vercel.app';

describe('retorno do login na URL', () => {
  it('o hash da sessão ou do erro NÃO é âncora (causa da tela branca)', () => {
    expect(hashDeAutenticacao('#access_token=eyJ.a.b&expires_in=3600&refresh_token=x&token_type=bearer&type=signup')).toBe(true);
    expect(hashDeAutenticacao('#error=access_denied&error_description=The+user+denied')).toBe(true);
    expect(hashDeAutenticacao('#como-funciona')).toBe(false);
    expect(hashDeAutenticacao('')).toBe(false);
    // Prova do defeito: esse texto não é um seletor CSS válido.
    expect(/^#[A-Za-z][\w-]*$/.test('#access_token=eyJ.a.b&expires_in=3600')).toBe(false);
  });
  it('reconhece sessão e erro (no hash ou na query)', () => {
    expect(lerRetornoAuth(`${BASE}/app#access_token=abc&refresh_token=r&expires_in=3600&token_type=bearer`)).toEqual({ tipo: 'sessao' });
    expect(lerRetornoAuth(`${BASE}/app#error=access_denied&error_code=403&error_description=The+user+denied`))
      .toEqual({ tipo: 'erro', codigo: '403', descricao: 'The user denied' });
    expect(lerRetornoAuth(`${BASE}/familia/solicitacoes/nova?error=server_error&error_description=Database+error+saving+new+user`))
      .toMatchObject({ tipo: 'erro', descricao: 'Database error saving new user' });
    expect(lerRetornoAuth(`${BASE}/buscar#como-funciona`)).toBeNull();
    expect(lerRetornoAuth('não é url')).toBeNull();
  });
  it('mensagens compreensíveis, sem detalhe técnico', () => {
    expect(mensagemErroLogin({ tipo: 'erro', codigo: 'access_denied' })).toMatch(/cancelado/);
    expect(mensagemErroLogin({ tipo: 'erro', codigo: 'otp_expired', descricao: 'Email link is invalid or has expired' })).toMatch(/expirou/);
    expect(mensagemErroLogin({ tipo: 'erro', codigo: 'server_error', descricao: 'Database error saving new user' })).toMatch(/cadastro/);
    expect(mensagemErroLogin({ tipo: 'erro', descricao: 'qualquer coisa' })).toBe('Não foi possível entrar. Tente de novo em instantes.');
  });
  it('retira só o erro da URL, mantendo caminho e demais parâmetros', () => {
    expect(urlSemErroDeAuth(`${BASE}/app#error=access_denied&error_description=x`)).toBe(`${BASE}/app`);
    expect(urlSemErroDeAuth(`${BASE}/resultados?destino=e1&error=x&error_description=y`)).toBe(`${BASE}/resultados?destino=e1`);
  });
});

describe('destinos de retorno', () => {
  it('motorista e família voltam a caminhos internos; nunca a outro site ou localhost', () => {
    expect(caminhoSeguro('/app')).toBe('/app');
    expect(caminhoSeguro('/familia/solicitacoes/nova')).toBe('/familia/solicitacoes/nova');
    expect(caminhoSeguro('http://localhost:3000/app')).toBe('/painel');
    expect(caminhoSeguro('//localhost:3000')).toBe('/painel');
  });
});
