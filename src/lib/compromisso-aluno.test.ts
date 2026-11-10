import { describe, it, expect } from 'vitest';
import { mapRotaDoBanco, rotaParaBanco } from '@/data/motorista-store';
import { montarEntradaMotor } from '@/lib/rota-para-motor';
import { rotaOperacionalDeCadastro } from '@/lib/encaixe';
import type { Rota, Veiculo, ParadaRota, PassageiroRota } from '@/types/motorista';

/**
 * Fase 2 — os campos do compromisso por aluno (horário habitual, tolerância
 * antes/depois, atendimento, origem) persistem (mappers) e CHEGAM aos motores
 * (atendimento somado por parada; janela individual por interseção).
 */

const veiculo: Veiculo = { id: 'v', modelo: 'Van', lugaresPassageiro: 15, arCondicionado: true, acessivel: false, cintos: true, fotos: [] };
const parada = (id: string, tipo: ParadaRota['tipo'], ordem: number, extra: Partial<ParadaRota> = {}): ParadaRota =>
  ({ id, ordem, tipo, rotulo: id, lat: -21.2 - ordem / 100, lng: -50.4 - ordem / 100, confirmado: true, ...extra });
const pax = (id: string, emb: string | null, des: string | null, extra: Partial<PassageiroRota> = {}): PassageiroRota =>
  ({ id, identificacao: id, embarqueParadaId: emb, desembarqueParadaId: des, destinoId: null, ...extra });

// Ida: saída -> casa A (2 alunos) -> escola E.
function rotaIda(): Rota {
  return {
    id: 'r', nome: 'Ida', sentido: 'ida', turno: 'manha', dias: ['seg'], veiculoId: 'v',
    monitor: false, monitorOcupaLugar: false, lugaresReservados: 0,
    ultimoDesembarqueMin: 420, limiteAntecipacaoMin: 10, status: 'rascunho', atualizadoEm: '2026-11-04T00:00:00Z',
    paradas: [parada('s', 'saida', 0, { tempoAteProximaMin: 5 }), parada('A', 'casa', 1, { tempoAteProximaMin: 5 }), parada('E', 'escola', 2, { destinoId: 'esc', destinoNome: 'Escola' })],
    passageiros: [
      pax('ana', 'A', 'E', { atendimentoMin: 2, atendimentoOrigem: 'informado', horarioHabitualMin: 420, ajusteAntesMin: 5, ajusteDepoisMin: 5 }),
      pax('bru', 'A', 'E', { atendimentoMin: 3, atendimentoOrigem: 'informado', horarioHabitualMin: 418, ajusteAntesMin: 4, ajusteDepoisMin: 4 }),
    ],
  };
}

describe('persistência (mappers) do compromisso por aluno', () => {
  it('rotaParaBanco envia os 5 campos no JSON da RPC', () => {
    const banco = rotaParaBanco(rotaIda()) as { passengers: Array<Record<string, unknown>> };
    const ana = banco.passengers.find((p) => p.id === 'ana')!;
    expect(ana.horario_habitual_min).toBe(420);
    expect(ana.ajuste_antes_min).toBe(5);
    expect(ana.ajuste_depois_min).toBe(5);
    expect(ana.atendimento_min).toBe(2);
    expect(ana.atendimento_origem).toBe('informado');
  });

  it('mapRotaDoBanco lê os 5 campos; dois alunos na MESMA parada preservam valores distintos', () => {
    const linha = {
      id: 'r', name: 'Ida', direction: 'ida', turno: 'manha', days: ['seg'], vehicle_id: 'v',
      monitor: false, monitor_ocupa_lugar: false, reserved_seats: 0, last_dropoff_min: 420,
      early_leave_limit_min: 10, status: 'rascunho', updated_at: '2026-11-04T00:00:00Z',
      route_stops: [{ id: 'A', ordem: 1, type: 'casa', label: 'A', lat: -21.2, lng: -50.4, confirmed: true, destination_id: null, leg_time_min: 5 }],
      route_passengers: [
        { id: 'ana', identificacao: 'ana', board_stop_id: 'A', alight_stop_id: 'E', destination_id: null, horario_habitual_min: 420, ajuste_antes_min: 5, ajuste_depois_min: 5, atendimento_min: 2, atendimento_origem: 'informado' },
        { id: 'bru', identificacao: 'bru', board_stop_id: 'A', alight_stop_id: 'E', destination_id: null, horario_habitual_min: 418, ajuste_antes_min: 4, ajuste_depois_min: 4, atendimento_min: 3, atendimento_origem: 'provisorio' },
      ],
    };
    const r = mapRotaDoBanco(linha);
    const ana = r.passageiros.find((p) => p.id === 'ana')!;
    const bru = r.passageiros.find((p) => p.id === 'bru')!;
    expect(ana.atendimentoMin).toBe(2);
    expect(bru.atendimentoMin).toBe(3); // mesmo endereço, valor DIFERENTE preservado
    expect(ana.atendimentoOrigem).toBe('informado');
    expect(bru.atendimentoOrigem).toBe('provisorio');
  });

  it('valores ausentes continuam NULL (não viram confirmados)', () => {
    const linha = {
      id: 'r', name: '', direction: 'ida', turno: null, days: [], vehicle_id: null, monitor: false,
      monitor_ocupa_lugar: false, reserved_seats: 0, last_dropoff_min: null, early_leave_limit_min: null,
      status: 'rascunho', updated_at: '', route_stops: [],
      route_passengers: [{ id: 'x', identificacao: 'x', board_stop_id: 'A', alight_stop_id: 'E', destination_id: null }],
    };
    const r = mapRotaDoBanco(linha);
    const x = r.passageiros[0];
    expect(x.atendimentoMin).toBeNull();
    expect(x.atendimentoOrigem).toBeNull();
    expect(x.horarioHabitualMin).toBeNull();
  });
});

describe('os dados chegam ao motor de planejamento (rota-para-motor)', () => {
  it('atendimento por parada = SOMA sequencial dos alunos atendidos (sem dupla contagem)', () => {
    const entrada = montarEntradaMotor(rotaIda(), veiculo);
    const pa = entrada.paradas.find((p) => p.id === 'A')!;
    expect(pa.atendimentoMin).toBe(5); // 2 (ana) + 3 (bru)
    const pe = entrada.paradas.find((p) => p.id === 'E')!;
    expect(pe.atendimentoMin).toBe(3); // escola: tempo fixo da parada (grupo), não por aluno
  });

  it('atendimento ausente usa o provisório de 2 min (nunca apresentado como confirmado)', () => {
    const r = rotaIda();
    r.passageiros = [pax('semdado', 'A', 'E')]; // sem atendimentoMin
    const entrada = montarEntradaMotor(r, veiculo);
    expect(entrada.paradas.find((p) => p.id === 'A')!.atendimentoMin).toBe(2);
  });

  it('janela individual por interseção das tolerâncias dos alunos da parada', () => {
    const entrada = montarEntradaMotor(rotaIda(), veiculo);
    // ana [415,425] ∩ bru [414,422] = [415,422]
    expect(entrada.paradas.find((p) => p.id === 'A')!.janela).toEqual({ inicio: 415, fim: 422 });
    expect(entrada.paradas.find((p) => p.id === 'E')!.janela).toBeUndefined();
  });

  it('sem horário habitual informado, a parada não ganha janela', () => {
    const r = rotaIda();
    r.passageiros = [pax('ana', 'A', 'E', { atendimentoMin: 2 })];
    const entrada = montarEntradaMotor(r, veiculo);
    expect(entrada.paradas.find((p) => p.id === 'A')!.janela).toBeUndefined();
  });
});

describe('os dados chegam ao motor geográfico (rota-para-encaixe/encaixe)', () => {
  it('o atendimento do aluno vai para o compromisso do motor', () => {
    const r = rotaIda();
    r.passageiros = [pax('ana', 'A', 'E', { atendimentoMin: 4 })];
    const op = rotaOperacionalDeCadastro(r, { capacidade: 10, partidaMin: 400 })!;
    const emb = op.compromissos.find((c) => c.id === 'emb:ana')!;
    expect(emb.atendimentoMin).toBe(4);
  });

  it('atendimento ausente usa o provisório de 2 min no motor geográfico', () => {
    const r = rotaIda();
    r.passageiros = [pax('ana', 'A', 'E')];
    const op = rotaOperacionalDeCadastro(r, { capacidade: 10, partidaMin: 400 })!;
    expect(op.compromissos.find((c) => c.id === 'emb:ana')!.atendimentoMin).toBe(2);
    expect(op.compromissos.find((c) => c.tipo === 'escola')!.atendimentoMin).toBe(3);
  });
});
