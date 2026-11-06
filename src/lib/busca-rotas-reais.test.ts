import { describe, it, expect } from 'vitest';
import {
  avaliarRotaReal,
  buscarEmRotasReais,
  rotaElegivelParaBusca,
  type PedidoFamilia,
} from './busca-rotas-reais';
import type { Rota, Veiculo, ParadaRota, PassageiroRota } from '@/types/motorista';

/* Coordenadas reais aproximadas de Araçatuba (dados de TESTE, sem PII real). */
const C = {
  garagem: { lat: -21.2050, lng: -50.4400 },
  casaA: { lat: -21.1995, lng: -50.4402 },
  casaB: { lat: -21.2100, lng: -50.4300 },
  escola: { lat: -21.2089, lng: -50.4328 },
  familia: { lat: -21.2010, lng: -50.4388 },
  longe: { lat: -22.9, lng: -47.0 }, // outra cidade
};

function veiculo(lugares = 4): Veiculo {
  return { id: 'v1', modelo: 'Van', lugaresPassageiro: lugares, arCondicionado: false, acessivel: false, cintos: true, fotos: [] };
}

/** Rota IDA real e concluída: garagem → casaA → casaB → escola(esc1). */
function rotaIda(opts: { ultimoDesembarqueMin?: number | null; escolaHorarioMin?: number | null; turno?: Rota['turno'] } = {}): Rota {
  const paradas: ParadaRota[] = [
    { id: 's', ordem: 0, tipo: 'saida', rotulo: 'Garagem', confirmado: true, lat: C.garagem.lat, lng: C.garagem.lng },
    { id: 'a', ordem: 1, tipo: 'casa', rotulo: 'Rua Secreta A, 123', confirmado: true, lat: C.casaA.lat, lng: C.casaA.lng },
    { id: 'b', ordem: 2, tipo: 'casa', rotulo: 'Rua Secreta B, 456', confirmado: true, lat: C.casaB.lat, lng: C.casaB.lng },
    { id: 'e', ordem: 3, tipo: 'escola', rotulo: 'Escola', destinoId: 'esc1', destinoNome: 'Colégio Teste', confirmado: true, lat: C.escola.lat, lng: C.escola.lng, horarioChegadaMin: opts.escolaHorarioMin ?? null },
  ];
  const passageiros: PassageiroRota[] = [
    { id: 'p1', identificacao: 'MarianaSegredo', embarqueParadaId: 'a', desembarqueParadaId: 'e', destinoId: 'esc1' },
    { id: 'p2', identificacao: 'PedroSegredo', embarqueParadaId: 'b', desembarqueParadaId: 'e', destinoId: 'esc1' },
  ];
  return {
    id: 'rota-ida', nome: 'Rota Ida', sentido: 'ida', turno: opts.turno === undefined ? 'manha' : opts.turno, dias: ['seg'],
    veiculoId: 'v1', monitor: false, monitorOcupaLugar: false, lugaresReservados: 0,
    ultimoDesembarqueMin: opts.ultimoDesembarqueMin === undefined ? 7 * 60 : opts.ultimoDesembarqueMin,
    limiteAntecipacaoMin: null, status: 'concluida', paradas, passageiros, atualizadoEm: '2026-11-06T00:00:00Z',
  };
}

/** Rota VOLTA real: garagem → escola(esc1) → casaA → casaB. */
function rotaVolta(): Rota {
  const paradas: ParadaRota[] = [
    { id: 's', ordem: 0, tipo: 'saida', rotulo: 'Garagem', confirmado: true, lat: C.garagem.lat, lng: C.garagem.lng },
    { id: 'e', ordem: 1, tipo: 'escola', rotulo: 'Escola', destinoId: 'esc1', destinoNome: 'Colégio Teste', confirmado: true, lat: C.escola.lat, lng: C.escola.lng, horarioChegadaMin: 12 * 60 },
    { id: 'a', ordem: 2, tipo: 'casa', rotulo: 'Rua Secreta A, 123', confirmado: true, lat: C.casaA.lat, lng: C.casaA.lng },
    { id: 'b', ordem: 3, tipo: 'casa', rotulo: 'Rua Secreta B, 456', confirmado: true, lat: C.casaB.lat, lng: C.casaB.lng },
  ];
  const passageiros: PassageiroRota[] = [
    { id: 'p1', identificacao: 'MarianaSegredo', embarqueParadaId: 'e', desembarqueParadaId: 'a', destinoId: 'esc1' },
    { id: 'p2', identificacao: 'PedroSegredo', embarqueParadaId: 'e', desembarqueParadaId: 'b', destinoId: 'esc1' },
  ];
  return {
    id: 'rota-volta', nome: 'Rota Volta', sentido: 'volta', turno: 'tarde', dias: ['seg'],
    veiculoId: 'v1', monitor: false, monitorOcupaLugar: false, lugaresReservados: 0,
    ultimoDesembarqueMin: null, limiteAntecipacaoMin: null, status: 'concluida', paradas, passageiros,
    atualizadoEm: '2026-11-06T00:00:00Z',
  };
}

const pedidoIda = (over: Partial<PedidoFamilia> = {}): PedidoFamilia => ({
  origem: C.familia, destinoId: 'esc1', sentido: 'ida', turno: 'manha', contratacao: 'mensal', ...over,
});

describe('elegibilidade de rota', () => {
  it('aceita rota concluída não-demo com casa e escola', () => {
    expect(rotaElegivelParaBusca({ ...rotaIda() })).toBe(true);
  });
  it('rejeita rascunho', () => {
    expect(rotaElegivelParaBusca({ ...rotaIda(), status: 'rascunho' })).toBe(false);
  });
  it('rejeita rota demo', () => {
    expect(rotaElegivelParaBusca({ ...rotaIda(), isDemo: true })).toBe(false);
  });
});

describe('avaliarRotaReal — IDA (T07, T12)', () => {
  it('família compatível recebe horário de coleta e de chegada à escola', () => {
    const r = avaliarRotaReal(rotaIda(), veiculo(4), pedidoIda());
    expect(r.status).toBe('compativel');
    expect(r.sentido).toBe('ida');
    expect(r.passagemCasaMin).not.toBeNull();
    expect(r.horarioEscolaMin).not.toBeNull();
    // chegada à escola não passa do limite da rota (07:00)
    expect(r.horarioEscolaMin!).toBeLessThanOrEqual(7 * 60);
    // coleta acontece antes da chegada à escola
    expect(r.passagemCasaMin!).toBeLessThan(r.horarioEscolaMin!);
    expect(r.fonteHorario).toBe('rota');
  });
});

describe('avaliarRotaReal — capacidade por trecho (T08)', () => {
  it('rejeita quando um trecho já excede a capacidade da van', () => {
    // Capacidade 1: o trecho casaB→escola já leva 2 alunos > 1 → sem encaixe honesto.
    const r = avaliarRotaReal(rotaIda(), veiculo(1), pedidoIda());
    expect(r.status).toBe('incompativel');
    expect(r.codigos).toContain('capacidade');
    expect(r.passagemCasaMin).toBeNull();
  });

  it('capacidade folgada (4) aceita a família', () => {
    expect(avaliarRotaReal(rotaIda(), veiculo(4), pedidoIda()).status).toBe('compativel');
  });
});

describe('avaliarRotaReal — endereço distante / sem origem (T02, T03)', () => {
  it('origem ausente => indeterminado, sem horário inventado', () => {
    const r = avaliarRotaReal(rotaIda(), veiculo(4), pedidoIda({ origem: null }));
    expect(r.status).toBe('indeterminado');
    expect(r.passagemCasaMin).toBeNull();
    expect(r.horarioEscolaMin).toBeNull();
  });
});

describe('avaliarRotaReal — escola fora do itinerário (T04)', () => {
  it('destino que a rota não atende => incompatível, nunca falso encaixe', () => {
    const r = avaliarRotaReal(rotaIda(), veiculo(4), pedidoIda({ destinoId: 'esc-outra' }));
    expect(r.status).toBe('incompativel');
    expect(r.codigos).toContain('escola_itinerario');
  });
});

describe('avaliarRotaReal — horário insuficiente (T16)', () => {
  it('sem horário real nem turno => indeterminado', () => {
    const r = avaliarRotaReal(
      rotaIda({ ultimoDesembarqueMin: null, escolaHorarioMin: null, turno: null }),
      veiculo(4),
      pedidoIda({ turno: null }),
    );
    expect(r.status).toBe('indeterminado');
    expect(r.horarioEscolaMin).toBeNull();
  });
  it('apenas padrão de turno => no máximo "sob confirmação", nunca confirmado', () => {
    const r = avaliarRotaReal(
      rotaIda({ ultimoDesembarqueMin: null, escolaHorarioMin: null, turno: 'manha' }),
      veiculo(4),
      pedidoIda({ turno: 'manha' }),
    );
    expect(['sob_confirmacao', 'indeterminado']).toContain(r.status);
    if (r.status === 'sob_confirmacao') expect(r.fonteHorario).toBe('turno');
  });
});

describe('avaliarRotaReal — avulso (T19)', () => {
  it('contratação avulsa não vira vaga confirmada', () => {
    const r = avaliarRotaReal(rotaIda(), veiculo(4), pedidoIda({ contratacao: 'avulso' }));
    expect(r.status).toBe('sob_confirmacao');
  });
});

describe('avaliarRotaReal — VOLTA (T13)', () => {
  it('escola embarca, casa desembarca: entrega em casa depois da saída da escola', () => {
    const r = avaliarRotaReal(rotaVolta(), veiculo(4), pedidoIda({ sentido: 'volta', turno: 'tarde' }));
    expect(['compativel', 'sob_confirmacao']).toContain(r.status);
    if (r.status !== 'indeterminado' && r.status !== 'incompativel') {
      expect(r.passagemCasaMin).not.toBeNull(); // entrega em casa
      expect(r.horarioEscolaMin).not.toBeNull(); // saída da escola
      expect(r.horarioEscolaMin!).toBeLessThanOrEqual(r.passagemCasaMin!); // sai da escola antes de deixar em casa
    }
  });

  it('pedir ida numa rota de volta => incompatível (sentidos independentes)', () => {
    const r = avaliarRotaReal(rotaVolta(), veiculo(4), pedidoIda({ sentido: 'ida' }));
    expect(r.status).toBe('incompativel');
  });
});

describe('avaliarRotaReal — SEM PII (T21)', () => {
  it('a saída não contém nomes de alunos nem endereços de casa', () => {
    const r = avaliarRotaReal(rotaIda(), veiculo(4), pedidoIda());
    const json = JSON.stringify(r);
    expect(json).not.toContain('Segredo'); // nomes dos alunos existentes
    expect(json).not.toContain('Secreta'); // labels das casas
    expect(Object.keys(r)).not.toContain('identificacao');
    expect(Object.keys(r)).not.toContain('paradas');
  });
});

describe('buscarEmRotasReais — agregação por sentido', () => {
  it('avalia só rotas do sentido pedido e ordena compatíveis primeiro', () => {
    const entradas = [
      { rota: rotaIda(), veiculo: veiculo(4) },
      { rota: rotaVolta(), veiculo: veiculo(4) },
      { rota: { ...rotaIda(), id: 'ida-lotada' }, veiculo: veiculo(2) },
    ];
    const out = buscarEmRotasReais(entradas, pedidoIda());
    expect(out.totalRotasAvaliadas).toBe(2); // só as 2 de ida
    expect(out.resultados[0].status).toBe('compativel'); // a viável vem primeiro
    expect(out.resultados.every((r) => r.sentido === 'ida')).toBe(true);
  });
});
