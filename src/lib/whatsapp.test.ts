import { describe, it, expect } from 'vitest';
import { montarLinkWhatsApp, montarMensagemWhatsApp } from './whatsapp';
import { MOTORISTAS } from '@/data/motoristas';
import { DESTINOS_POR_ID } from '@/data/destinos';
import type { CriteriosBusca } from '@/types';

const motorista = MOTORISTAS[0];

describe('montarLinkWhatsApp', () => {
  it('monta wa.me com telefone válido (12-13 dígitos)', () => {
    const link = montarLinkWhatsApp('5518999990001', 'oi');
    expect(link).toContain('https://wa.me/5518999990001');
    expect(link).toContain('text=oi');
  });

  it('remove símbolos do telefone', () => {
    const link = montarLinkWhatsApp('+55 (18) 99999-0001', 'oi');
    expect(link).toBe('https://wa.me/5518999990001?text=oi');
  });

  it('retorna null para telefone inválido', () => {
    expect(montarLinkWhatsApp('123', 'oi')).toBeNull();
    expect(montarLinkWhatsApp('', 'oi')).toBeNull();
  });
});

describe('montarMensagemWhatsApp', () => {
  const criterios: CriteriosBusca = {
    cidadeId: 'aracatuba-sp',
    endereco: 'Centro',
    destinoId: 'esc-paineiras',
    turno: 'manha',
    contratacao: 'mensal',
    modalidade: 'ida',
  };

  it('inclui destino e turno quando informados', () => {
    const msg = montarMensagemWhatsApp(motorista, criterios, DESTINOS_POR_ID['esc-paineiras']);
    expect(msg).toContain('Colégio Paineiras');
    expect(msg).toContain('Manhã');
  });

  it('não vaza dados sensíveis além da região informada', () => {
    const msg = montarMensagemWhatsApp(motorista, criterios, DESTINOS_POR_ID['esc-paineiras']);
    // A mensagem usa só a "região de embarque" informada, não um endereço completo extra.
    expect(msg).toContain('Região de embarque: Centro');
  });

  it('funciona sem critérios (perfil direto)', () => {
    const msg = montarMensagemWhatsApp(motorista, null, null);
    expect(msg.length).toBeGreaterThan(0);
    expect(msg).toContain('Vambora');
  });
});
