import { describe, it, expect } from 'vitest';
import { buscarMotoristas } from './matching';
import { MOTORISTAS } from '@/data/motoristas';
import { DESTINOS } from '@/data/destinos';
import type { CriteriosBusca } from '@/types';

const base: CriteriosBusca = {
  cidadeId: 'aracatuba-sp',
  endereco: 'Centro',
  destinoId: null,
  turno: null,
  contratacao: 'mensal',
  modalidade: 'ida',
};

describe('buscarMotoristas (adaptador simulado)', () => {
  it('não retorna motoristas de outra cidade', () => {
    const r = buscarMotoristas({ ...base, cidadeId: 'inexistente' }, MOTORISTAS, DESTINOS);
    expect(r.elegiveis).toHaveLength(0);
    expect(r.totalConsultados).toBe(0);
  });

  it('filtra por destino: só aparece quem atende aquele destino', () => {
    const r = buscarMotoristas({ ...base, destinoId: 'fac-unifatec' }, MOTORISTAS, DESTINOS);
    expect(r.elegiveis.length).toBeGreaterThan(0);
    for (const res of r.elegiveis) {
      expect(res.motorista.destinosIds).toContain('fac-unifatec');
    }
  });

  it('filtra por turno incompatível (demanda incompatível não é elegível)', () => {
    const r = buscarMotoristas({ ...base, turno: 'noite' }, MOTORISTAS, DESTINOS);
    for (const res of r.elegiveis) {
      expect(res.motorista.turnos).toContain('noite');
    }
  });

  it('marca "sob_consulta" quando não há vaga', () => {
    const semVaga = buscarMotoristas(
      { ...base, destinoId: 'esc-sao-joao' },
      MOTORISTAS,
      DESTINOS,
    );
    const joao = semVaga.elegiveis.find((r) => r.motorista.id === 'mot-4');
    expect(joao?.nivel).toBe('sob_consulta');
  });

  it('avulso nunca é marcado como "disponivel" automaticamente', () => {
    const r = buscarMotoristas({ ...base, contratacao: 'avulso' }, MOTORISTAS, DESTINOS);
    for (const res of r.elegiveis) {
      expect(res.nivel).not.toBe('disponivel');
    }
  });

  it('ordena disponíveis antes de sob_consulta', () => {
    const r = buscarMotoristas(base, MOTORISTAS, DESTINOS);
    const niveis = r.elegiveis.map((x) => x.nivel);
    const primeiroSobConsulta = niveis.indexOf('sob_consulta');
    const ultimoDisponivel = niveis.lastIndexOf('disponivel');
    if (primeiroSobConsulta !== -1 && ultimoDisponivel !== -1) {
      expect(ultimoDisponivel).toBeLessThan(primeiroSobConsulta);
    }
  });

  it('usa o horário real de cadastro como passagem aproximada (não inventa)', () => {
    const r = buscarMotoristas(base, MOTORISTAS, DESTINOS);
    const primeiro = r.elegiveis[0];
    expect(primeiro.passagemAproximada).toBe(primeiro.motorista.janela.horario);
    // Nunca inventamos tempo a bordo no adaptador simulado.
    expect(primeiro.tempoABordoMin).toBeUndefined();
  });
});
