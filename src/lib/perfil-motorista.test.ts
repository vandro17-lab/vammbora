import { describe, it, expect } from 'vitest';
import {
  normalizarWhatsapp, mascararWhatsapp, validarEtapa, primeiraEtapaComProblema,
  rascunhoInicial, itensDePublicacao, textoDaSituacao, APRESENTACAO_MAX, type RascunhoPerfil,
} from './perfil-motorista';

const base: RascunhoPerfil = { nome: 'Tio João', cidadeId: 'aracatuba-sp', apresentacao: '', aceitaWhatsapp: false, whatsapp: '' };
const situacao = { temPerfil: true, anuncioAtivo: false, rotaConcluidaComVan: false, suspenso: false, visivel: false };

describe('WhatsApp do motorista', () => {
  it('normaliza celular com ou sem 55 e com máscara', () => {
    expect(normalizarWhatsapp('(18) 99999-0000')).toBe('5518999990000');
    expect(normalizarWhatsapp('18999990000')).toBe('5518999990000');
    expect(normalizarWhatsapp('+55 18 99999-0000')).toBe('5518999990000');
  });
  it('recusa fixo, DDD inválido e números curtos (mesma regra do servidor)', () => {
    expect(normalizarWhatsapp('(18) 3333-0000')).toBeNull();
    expect(normalizarWhatsapp('(01) 99999-0000')).toBeNull();
    expect(normalizarWhatsapp('1234')).toBeNull();
    expect(normalizarWhatsapp('')).toBeNull();
  });
  it('máscara progressiva (DD) 9XXXX-XXXX', () => {
    expect(mascararWhatsapp('1')).toBe('(1');
    expect(mascararWhatsapp('1899')).toBe('(18) 99');
    expect(mascararWhatsapp('18999990000')).toBe('(18) 99999-0000');
    expect(mascararWhatsapp('5518999990000')).toBe('(18) 99999-0000');
    expect(mascararWhatsapp('189999900001234')).toBe('(18) 99999-0000');
  });
});

describe('validação por etapa', () => {
  it('nome obrigatório de 2 a 60 letras e cidade escolhida', () => {
    expect(validarEtapa('nome', { ...base, nome: ' Z ' })).toMatch(/pelo menos 2/);
    expect(validarEtapa('nome', { ...base, nome: 'x'.repeat(61) })).toMatch(/no máximo 60/);
    expect(validarEtapa('nome', { ...base, cidadeId: '' })).toMatch(/cidade/);
    expect(validarEtapa('nome', base)).toBeNull();
  });
  it('apresentação é opcional, com limite', () => {
    expect(validarEtapa('apresentacao', base)).toBeNull();
    expect(validarEtapa('apresentacao', { ...base, apresentacao: 'a'.repeat(APRESENTACAO_MAX + 1) })).toMatch(/no máximo/);
  });
  it('WhatsApp só é exigido quando o motorista aceita contato', () => {
    expect(validarEtapa('contato', { ...base, aceitaWhatsapp: false, whatsapp: 'lixo' })).toBeNull();
    expect(validarEtapa('contato', { ...base, aceitaWhatsapp: true, whatsapp: '123' })).toMatch(/Confira o WhatsApp/);
    expect(validarEtapa('contato', { ...base, aceitaWhatsapp: true, whatsapp: '(18) 99999-0000' })).toBeNull();
  });
  it('a revisão aponta a primeira etapa com problema', () => {
    expect(primeiraEtapaComProblema({ ...base, nome: '', aceitaWhatsapp: true, whatsapp: '1' })?.etapa).toBe('nome');
    expect(primeiraEtapaComProblema({ ...base, aceitaWhatsapp: true, whatsapp: '1' })?.etapa).toBe('contato');
    expect(primeiraEtapaComProblema(base)).toBeNull();
  });
});

describe('rascunho inicial', () => {
  it('perfil salvo é editado como está (WhatsApp mascarado)', () => {
    const r = rascunhoInicial({ nome: 'Tia Ana', cidadeId: 'aracatuba-sp', descricao: 'Oi', whatsappContato: '5518999990000' }, { nome: 'Outro', cidadeId: 'x' });
    expect(r).toEqual({ nome: 'Tia Ana', cidadeId: 'aracatuba-sp', apresentacao: 'Oi', aceitaWhatsapp: true, whatsapp: '(18) 99999-0000' });
  });
  it('sem perfil começa com o nome da conta, sem WhatsApp e sem texto inventado', () => {
    expect(rascunhoInicial(null, { nome: '  Maria Souza ', cidadeId: 'aracatuba-sp' }))
      .toEqual({ nome: 'Maria Souza', cidadeId: 'aracatuba-sp', apresentacao: '', aceitaWhatsapp: false, whatsapp: '' });
    expect(rascunhoInicial(null, { cidadeId: 'aracatuba-sp' }).nome).toBe('');
  });
});

describe('publicação (mesma regra do servidor, sem documentos)', () => {
  it('lista o que falta, sem exigir documento', () => {
    const itens = itensDePublicacao(situacao);
    expect(itens.map((i) => i.id)).toEqual(['perfil', 'rota', 'publicado']);
    expect(itens.map((i) => i.texto).join(' ')).not.toMatch(/document/i);
  });
  it('frase honesta para cada situação', () => {
    expect(textoDaSituacao({ ...situacao, temPerfil: false })).toMatch(/Crie seu perfil/);
    expect(textoDaSituacao(situacao)).toMatch(/conclua uma rota/);
    expect(textoDaSituacao({ ...situacao, rotaConcluidaComVan: true })).toMatch(/Publicar/);
    expect(textoDaSituacao({ ...situacao, rotaConcluidaComVan: true, anuncioAtivo: true, visivel: true })).toMatch(/visível/);
    expect(textoDaSituacao({ ...situacao, suspenso: true, visivel: false })).toMatch(/suspenso/);
  });
});
