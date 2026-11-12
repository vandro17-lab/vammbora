import { describe, it, expect } from 'vitest';
import { createRoutesFromElements, matchRoutes, Route } from 'react-router-dom';
import { createElement } from 'react';
import {
  DADOS_VAZIOS, ROTAS_PRE_LANCAMENTO, POLITICA_PRIVACIDADE_VERSAO,
  digitosNacionais, emailValido, erroWhatsApp, limparTexto, mascararWhatsApp,
  normalizarNumeroEndereco, normalizarWhatsApp, validarInteresse,
  type DadosInteresse,
} from './interesse';

const motorista = (extra: Partial<DadosInteresse> = {}): DadosInteresse => ({
  ...DADOS_VAZIOS, nome: 'Maria Teste Silva', whatsapp: '(18) 99876-5432', consentimento: true, ...extra,
});
const familia = (extra: Partial<DadosInteresse> = {}): DadosInteresse => ({
  ...motorista(), rua: 'Rua das Flores', numero: '123', bairro: 'Centro', escola: 'EE Exemplo', periodo: 'manha', ...extra,
});

describe('WhatsApp — máscara', () => {
  it('formata progressivamente como (DD) 9XXXX-XXXX', () => {
    expect(mascararWhatsApp('1')).toBe('(1');
    expect(mascararWhatsApp('18')).toBe('(18');
    expect(mascararWhatsApp('189')).toBe('(18) 9');
    expect(mascararWhatsApp('1899876')).toBe('(18) 99876');
    expect(mascararWhatsApp('18998765432')).toBe('(18) 99876-5432');
  });
  it('não aceita letras e limita a 11 dígitos', () => {
    expect(mascararWhatsApp('abc')).toBe('');
    expect(mascararWhatsApp('18a9b9c8d7e6f5g4h3i2')).toBe('(18) 99876-5432');
    expect(mascararWhatsApp('189987654329999')).toBe('(18) 99876-5432');
  });
  it('aceita colar com pontuação, +55, 55 e 0 antes do DDD', () => {
    for (const v of ['18 99876-5432', '(18)99876.5432', '+55 18 99876-5432', '+5518998765432', '5518998765432', '018998765432', '+55 (18) 9 9876-5432']) {
      expect(digitosNacionais(v)).toBe('18998765432');
    }
  });
  it('não confunde o DDD 55 (RS) com o código do país', () => {
    expect(digitosNacionais('55998765432')).toBe('55998765432');
    expect(normalizarWhatsApp('(55) 99876-5432')).toBe('+5555998765432');
    expect(normalizarWhatsApp('+55 55 99876-5432')).toBe('+5555998765432');
  });
});

describe('WhatsApp — validação e normalização E.164', () => {
  it('normaliza números válidos', () => {
    expect(normalizarWhatsApp('(18) 99876-5432')).toBe('+5518998765432');
    expect(normalizarWhatsApp('+55 11 91234-5678')).toBe('+5511912345678');
    expect(erroWhatsApp('(18) 99876-5432')).toBeNull();
  });
  it('recusa vazio, incompleto, fixo, DDD inexistente e sequência repetida', () => {
    expect(normalizarWhatsApp('')).toBeNull();
    expect(erroWhatsApp('')).toMatch(/Informe/);
    expect(normalizarWhatsApp('(18) 9987-543')).toBeNull();
    expect(erroWhatsApp('(18) 9987-543')).toMatch(/incompleto/);
    expect(normalizarWhatsApp('(18) 3622-12345')).toBeNull();       // não começa com 9
    expect(erroWhatsApp('18362212345')).toMatch(/começa com 9/);
    expect(normalizarWhatsApp('(20) 99876-5432')).toBeNull();       // DDD 20 não existe
    expect(normalizarWhatsApp('(00) 99876-5432')).toBeNull();
    expect(erroWhatsApp('(20) 99876-5432')).toMatch(/DDD/);
    expect(normalizarWhatsApp('(18) 99999-9999')).toBeNull();
    expect(normalizarWhatsApp(18998765432 as unknown)).toBeNull();  // não-texto
  });
});

describe('e-mail (opcional)', () => {
  it('valida formato quando preenchido', () => {
    expect(emailValido('a@b.co')).toBe(true);
    expect(emailValido('nome.sobrenome+tag@exemplo.com.br')).toBe(true);
    for (const ruim of ['a', 'a@b', 'a@b.', '@b.com', 'a b@c.com', 'a@@b.com', 'a..b@c.com', '.a@b.com', 'a@b.c']) expect(emailValido(ruim)).toBe(false);
  });
  it('vazio não bloqueia; inválido bloqueia', () => {
    expect(validarInteresse('motorista', motorista({ email: '' })).ok).toBe(true);
    expect(validarInteresse('motorista', motorista({ email: '   ' })).ok).toBe(true);
    const r = validarInteresse('motorista', motorista({ email: 'nao-e-email' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.email).toBeTruthy();
  });
  it('normaliza para minúsculas', () => {
    const r = validarInteresse('motorista', motorista({ email: '  Maria@Exemplo.COM ' }));
    expect(r.ok && r.payload.email).toBe('maria@exemplo.com');
  });
});

describe('nome completo', () => {
  it('remove espaços excessivos', () => {
    expect(limparTexto('  Maria   Teste \t Silva ')).toBe('Maria Teste Silva');
    const r = validarInteresse('motorista', motorista({ nome: '  José   d’Ávila  ' }));
    expect(r.ok && r.payload.full_name).toBe('José d’Ávila');
  });
  it('exige nome e sobrenome, tamanho e só letras', () => {
    for (const ruim of ['', '   ', 'Ana', 'Maria', 'Jo S', 'Maria 123', 'Maria <b>', 'A'.repeat(60) + ' ' + 'B'.repeat(61)]) {
      const r = validarInteresse('motorista', motorista({ nome: ruim }));
      expect(r.ok, ruim).toBe(false);
      if (!r.ok) expect(r.erros.nome).toBeTruthy();
    }
  });
});

describe('motorista — campos obrigatórios e consentimento', () => {
  it('cadastro válido gera payload normalizado, sem endereço/escola', () => {
    const r = validarInteresse('motorista', motorista({ rua: 'ignorar', escola: 'ignorar', periodo: 'manha' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload).toEqual({
      lead_type: 'motorista', full_name: 'Maria Teste Silva', whatsapp_e164: '+5518998765432', email: null,
      street_address: null, address_number: null, neighborhood: null, address_complement: null, city: null, state: null,
      school_name: null, school_shift: null, transport_direction: null,
      consent_accepted: true, privacy_policy_version: POLITICA_PRIVACIDADE_VERSAO, source: 'site',
    });
  });
  it('sem consentimento não passa', () => {
    const r = validarInteresse('motorista', motorista({ consentimento: false }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.consentimento).toBeTruthy();
    // "true" como texto não vale como consentimento
    expect(validarInteresse('motorista', { ...motorista(), consentimento: 'true' }).ok).toBe(false);
  });
  it('formulário vazio aponta todos os obrigatórios', () => {
    const r = validarInteresse('motorista', DADOS_VAZIOS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.erros).sort()).toEqual(['consentimento', 'nome', 'whatsapp']);
  });
  it('entrada não confiável (tipos errados) é recusada sem lançar erro', () => {
    for (const lixo of [null, undefined, 'x', 42, [], { nome: 1, whatsapp: {}, consentimento: 1 }]) {
      expect(validarInteresse('motorista', lixo).ok).toBe(false);
    }
  });
});

describe('família — endereço, escola e período', () => {
  it('cadastro válido inclui cidade inicial e normaliza campos', () => {
    const r = validarInteresse('familia', familia({ numero: ' 123a ', complemento: '  Casa  2 ', transporte: 'ida_volta' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload).toMatchObject({
      lead_type: 'familia', street_address: 'Rua das Flores', address_number: '123A', neighborhood: 'Centro',
      address_complement: 'Casa 2', city: 'Araçatuba', state: 'SP', school_name: 'EE Exemplo', school_shift: 'manha', transport_direction: 'ida_volta',
    });
  });
  it('formulário vazio aponta todos os obrigatórios (complemento, e-mail e transporte não)', () => {
    const r = validarInteresse('familia', DADOS_VAZIOS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.erros).sort()).toEqual(['bairro', 'consentimento', 'escola', 'nome', 'numero', 'periodo', 'rua', 'whatsapp']);
  });
  it('transporte e complemento são opcionais; período é obrigatório e restrito', () => {
    const ok = validarInteresse('familia', familia());
    expect(ok.ok && ok.payload.transport_direction).toBeNull();
    expect(ok.ok && ok.payload.address_complement).toBeNull();
    expect(validarInteresse('familia', familia({ periodo: '' })).ok).toBe(false);
    expect(validarInteresse('familia', familia({ periodo: 'integral' })).ok).toBe(false);
    expect(validarInteresse('familia', familia({ transporte: 'qualquer' })).ok).toBe(false);
    for (const p of ['manha', 'tarde', 'noite']) expect(validarInteresse('familia', familia({ periodo: p })).ok).toBe(true);
  });
  it('número do endereço: dígitos, letra final ou S/N', () => {
    expect(normalizarNumeroEndereco('123')).toBe('123');
    expect(normalizarNumeroEndereco('45b')).toBe('45B');
    expect(normalizarNumeroEndereco('s/n')).toBe('S/N');
    expect(normalizarNumeroEndereco('SN')).toBe('S/N');
    for (const ruim of ['', 'abc', '12 34 56 78', '1234567', '=1+1']) expect(normalizarNumeroEndereco(ruim)).toBeNull();
  });
  it('escola aceita digitação livre (não exige cadastro prévio)', () => {
    const r = validarInteresse('familia', familia({ escola: 'Colégio Que Não Está Na Lista' }));
    expect(r.ok && r.payload.school_name).toBe('Colégio Que Não Está Na Lista');
  });
});

describe('rotas públicas do pré-lançamento', () => {
  const rotas = createRoutesFromElements(
    createElement(Route, null,
      ...Object.values(ROTAS_PRE_LANCAMENTO).map((path) => createElement(Route, { key: path, path, element: null }))),
  );
  it('acesso direto às URLs resolve', () => {
    for (const url of ['/', '/interesse/motorista', '/interesse/familia', '/privacidade']) {
      expect(matchRoutes(rotas, url)?.at(-1)?.route.path, url).toBe(url);
    }
  });
});
