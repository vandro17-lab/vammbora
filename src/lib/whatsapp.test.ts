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
    endereco: 'Rua das Flores, 123, Centro',
    destinoId: 'esc-paineiras',
    turno: 'manha',
    contratacao: 'avulso',
    dataAvulso: '2026-11-10',
    modalidade: 'ambos',
  };

  it('inclui os critérios: destino, turno, contratação/data e trajeto', () => {
    const msg = montarMensagemWhatsApp(motorista, criterios, DESTINOS_POR_ID['esc-paineiras']);
    expect(msg).toContain('Colégio Paineiras');
    expect(msg).toContain('Manhã');
    expect(msg).toContain('avulso');
    expect(msg).toContain('10/11/2026');
    expect(msg).toContain('ida e volta');
  });

  it('NÃO envia o endereço livre automaticamente (privacidade)', () => {
    const msg = montarMensagemWhatsApp(motorista, criterios, DESTINOS_POR_ID['esc-paineiras']);
    // O endereço digitado (que pode ser completo) não vai na mensagem.
    expect(msg).not.toContain('Rua das Flores');
    expect(msg).not.toContain('123');
    expect(msg.toLowerCase()).not.toContain('região de embarque');
    // A família é convidada a combinar o ponto de embarque na conversa.
    expect(msg.toLowerCase()).toContain('ponto de embarque');
  });

  it('inclui "somente ida" quando a modalidade é ida', () => {
    const msg = montarMensagemWhatsApp(
      motorista,
      { ...criterios, modalidade: 'ida' },
      DESTINOS_POR_ID['esc-paineiras'],
    );
    expect(msg).toContain('somente ida');
  });

  it('funciona sem critérios (perfil direto)', () => {
    const msg = montarMensagemWhatsApp(motorista, null, null);
    expect(msg.length).toBeGreaterThan(0);
    expect(msg).toContain('Vambora');
  });
});
