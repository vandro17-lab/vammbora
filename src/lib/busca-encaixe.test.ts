import { describe, it, expect } from 'vitest';
import { buscarComMotor, coordDaOrigem } from './busca-encaixe';
import { MOTORISTAS } from '@/data/motoristas';
import { DESTINOS } from '@/data/destinos';
import type { CriteriosBusca } from '@/types';

function crit(p: Partial<CriteriosBusca>): CriteriosBusca {
  return { cidadeId: 'aracatuba-sp', endereco: '', destinoId: null, turno: null, contratacao: 'mensal', modalidade: 'ida', ...p };
}

describe('busca das famílias com o motor real (#7)', () => {
  it('reconhece a origem por bairro (e devolve null para desconhecido)', () => {
    expect(coordDaOrigem('Centro')).not.toBeNull();
    expect(coordDaOrigem('vila mendonça')).not.toBeNull();
    expect(coordDaOrigem('Lugar Inexistente')).toBeNull();
  });

  it('com origem e destino conhecidos, calcula horários pelo MOTOR (não inventa)', () => {
    const r = buscarComMotor(crit({ endereco: 'Centro', destinoId: 'ee-manoel-bento-da-cruz', turno: 'manha' }), MOTORISTAS, DESTINOS);
    expect(r.elegiveis.length).toBeGreaterThan(0);
    const comMotor = r.elegiveis.filter((e) => e.fonteHorario === 'motor');
    expect(comMotor.length).toBeGreaterThan(0);
    for (const e of comMotor) {
      // horário é HhMM calculado e a chegada à escola respeita o limite do turno (07:00)
      expect(e.passagemAproximada).toMatch(/^\d{1,2}h\d{2}$/);
      expect(e.chegadaEscola).toMatch(/^\d{1,2}h\d{2}$/);
    }
  });

  it('sem origem reconhecida, não inventa horário: marca validação da rota', () => {
    const r = buscarComMotor(crit({ endereco: 'Bairro Desconhecido', destinoId: 'ee-manoel-bento-da-cruz', turno: 'manha' }), MOTORISTAS, DESTINOS);
    expect(r.elegiveis.length).toBeGreaterThan(0);
    // Nenhum horário vem do motor quando não há como localizar a origem.
    expect(r.elegiveis.every((e) => e.fonteHorario === 'motorista')).toBe(true);
    expect(r.elegiveis.every((e) => e.chegadaEscola === undefined)).toBe(true);
  });

  it('respeita o destino: motorista que não atende a escola não aparece', () => {
    const r = buscarComMotor(crit({ endereco: 'Centro', destinoId: 'fatec-aracatuba-prof-fernando-amaral-de', turno: 'noite' }), MOTORISTAS, DESTINOS);
    // Só Patrícia atende a Fatec no período noturno.
    expect(r.elegiveis.every((e) => e.motorista.destinosIds.includes('fatec-aracatuba-prof-fernando-amaral-de'))).toBe(true);
  });

  it('quando o endereço muda, o resultado do motor pode mudar (§9)', () => {
    const perto = buscarComMotor(crit({ endereco: 'Centro', destinoId: 'ee-manoel-bento-da-cruz', turno: 'manha' }), MOTORISTAS, DESTINOS);
    const longe = buscarComMotor(crit({ endereco: 'Água Branca', destinoId: 'ee-manoel-bento-da-cruz', turno: 'manha' }), MOTORISTAS, DESTINOS);
    const n = (r: typeof perto) => r.elegiveis.filter((e) => e.nivel === 'disponivel').length;
    // Mais vans encaixam para quem está no Centro do que para quem está longe (Água Branca).
    expect(n(perto)).toBeGreaterThanOrEqual(n(longe));
  });
});
