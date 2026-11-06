import { describe, it, expect } from 'vitest';
import { rotaParaBanco, mapRotaDoBanco } from './motorista-store';
import type { Rota } from '@/types/motorista';

/**
 * FASE 1 — Teste de PROTEÇÃO (regressão) do contrato de persistência de rotas.
 * Protege a serialização `Rota` ⇄ banco (src/data/motorista-store.ts), que é o
 * contrato enviado à RPC `salvar_rota_completa` e lido de volta.
 *
 * Importa porque a RPC APAGA e RECRIA paradas/passageiros a cada salvamento
 * (ver 02/03/08): a preservação de IDs e dos 5 campos de compromisso depende de
 * o cliente REENVIAR esses dados. Estes testes travam exatamente isso.
 * DEVEM passar.
 */

function rotaCompleta(): Rota {
  return {
    id: 'rota-1', nome: 'Manhã ida', sentido: 'ida', turno: 'manha',
    dias: ['seg', 'ter'], veiculoId: 'veic-1',
    monitor: true, monitorOcupaLugar: false, lugaresReservados: 1,
    ultimoDesembarqueMin: 420, limiteAntecipacaoMin: 15, status: 'rascunho',
    atualizadoEm: '2026-11-05T00:00:00.000Z',
    paradas: [
      { id: 'stop-saida', ordem: 0, tipo: 'saida', rotulo: 'Garagem', lat: -21.2, lng: -50.4, confirmado: true, destinoId: null, tempoAteProximaMin: 5 },
      { id: 'stop-casa', ordem: 1, tipo: 'casa', rotulo: 'Rua X, 100', lat: -21.21, lng: -50.41, confirmado: true, destinoId: null, tempoAteProximaMin: 8 },
      { id: 'stop-escola', ordem: 2, tipo: 'escola', rotulo: 'Colégio', lat: -21.22, lng: -50.42, confirmado: true, destinoId: 'dest-9', tempoAteProximaMin: null },
    ],
    passageiros: [
      {
        id: 'pax-1', identificacao: 'Ana', embarqueParadaId: 'stop-casa', desembarqueParadaId: 'stop-escola', destinoId: 'dest-9',
        horarioHabitualMin: 420, ajusteAntesMin: 5, ajusteDepoisMin: 5, atendimentoMin: 2, atendimentoOrigem: 'informado',
      },
      {
        id: 'pax-2', identificacao: 'Bru', embarqueParadaId: 'stop-casa', desembarqueParadaId: 'stop-escola', destinoId: 'dest-9',
        horarioHabitualMin: null, ajusteAntesMin: null, ajusteDepoisMin: null, atendimentoMin: null, atendimentoOrigem: null,
      },
    ],
  };
}

/** Converte a saída de rotaParaBanco no formato de LINHA que mapRotaDoBanco espera
 *  (nomes de coleção do PostgREST: stops->route_stops, passengers->route_passengers). */
function comoLinhaDoBanco(banco: Record<string, unknown>): unknown {
  const { stops, passengers, direction, ...resto } = banco as Record<string, unknown>;
  return { ...resto, direction, updated_at: '2026-11-05T00:00:00.000Z', route_stops: stops, route_passengers: passengers };
}

describe('FASE 1 — contrato de persistência de rota (regressão)', () => {
  it('rotaParaBanco REENVIA o id de cada parada e passageiro (vital p/ RPC apaga-e-recria)', () => {
    const b = rotaParaBanco(rotaCompleta()) as { stops: Array<{ id: string }>; passengers: Array<{ id: string }> };
    expect(b.stops.map((s) => s.id)).toEqual(['stop-saida', 'stop-casa', 'stop-escola']);
    expect(b.passengers.map((p) => p.id)).toEqual(['pax-1', 'pax-2']);
  });

  it('rotaParaBanco envia os 5 campos de compromisso em snake_case', () => {
    const b = rotaParaBanco(rotaCompleta()) as { passengers: Array<Record<string, unknown>> };
    expect(b.passengers[0]).toMatchObject({
      horario_habitual_min: 420, ajuste_antes_min: 5, ajuste_depois_min: 5, atendimento_min: 2, atendimento_origem: 'informado',
    });
    // Ausentes continuam null — nunca viram 0 nem "confirmado".
    expect(b.passengers[1]).toMatchObject({
      horario_habitual_min: null, ajuste_antes_min: null, ajuste_depois_min: null, atendimento_min: null, atendimento_origem: null,
    });
  });

  it('round-trip Rota -> banco -> Rota preserva ids, vínculos e compromissos', () => {
    const original = rotaCompleta();
    const linha = comoLinhaDoBanco(rotaParaBanco(original) as Record<string, unknown>);
    const volta = mapRotaDoBanco(linha);

    expect(volta.paradas.map((p) => p.id)).toEqual(original.paradas.map((p) => p.id));
    expect(volta.passageiros.map((p) => p.id)).toEqual(['pax-1', 'pax-2']);
    // Vínculos embarque/desembarque preservados (FKs para route_stops.id).
    expect(volta.passageiros[0].embarqueParadaId).toBe('stop-casa');
    expect(volta.passageiros[0].desembarqueParadaId).toBe('stop-escola');
    // Compromisso individual preservado.
    expect(volta.passageiros[0].atendimentoMin).toBe(2);
    expect(volta.passageiros[0].atendimentoOrigem).toBe('informado');
    expect(volta.passageiros[1].atendimentoMin).toBeNull();
    // Campos estruturais da rota.
    expect(volta.sentido).toBe('ida');
    expect(volta.lugaresReservados).toBe(1);
    expect(volta.paradas[2].destinoId).toBe('dest-9');
  });
});
