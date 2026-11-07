import { describe, it, expect } from 'vitest';
import {
  avaliarRotaReal,
  buscarEmRotasReais,
  rotaElegivelParaBusca,
  rotaAtendeDestino,
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
  it('aceita rota concluída, não-demo, com casa e escola', () => {
    expect(rotaElegivelParaBusca(rotaIda())).toBe(true);
  });
  it('aceita concluída SEM publicação manual (regra definitiva: não exige publicar)', () => {
    // publicação não é mais exigida — qualquer concluída é avaliada
    expect(rotaElegivelParaBusca({ ...rotaIda(), status: 'concluida' })).toBe(true);
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

describe('buscarEmRotasReais — agregação por sentido + vaga', () => {
  it('avalia só rotas do sentido pedido, COM vaga, e ordena compatíveis primeiro', () => {
    const entradas = [
      { rota: rotaIda(), veiculo: veiculo(4) }, // 2 ocupados em 4 → 2 vagas
      { rota: rotaVolta(), veiculo: veiculo(4) }, // outro sentido → fora
      { rota: { ...rotaIda(), id: 'ida-lotada' }, veiculo: veiculo(2) }, // 2 ocupados em 2 → 0 vaga → fora
    ];
    const out = buscarEmRotasReais(entradas, pedidoIda());
    expect(out.totalRotasAvaliadas).toBe(1); // ida com vaga; a lotada e a de volta saem
    expect(out.resultados[0].status).toBe('compativel');
    expect(out.resultados[0].rotaId).toBe('rota-ida');
    expect(out.resultados.every((r) => r.sentido === 'ida')).toBe(true);
  });
});

/* ----- Lógica robusta: escola escolhida é o 1º recorte e a âncora de horário ----- */

/** Rota IDA com DUAS escolas: casaA → escX(07:00) → casaB → escY(08:00). */
function rotaIdaDuasEscolas(opts: { horaX?: number | null; horaY?: number | null; ultimo?: number | null } = {}): Rota {
  const paradas: ParadaRota[] = [
    { id: 's', ordem: 0, tipo: 'saida', rotulo: 'Garagem', confirmado: true, lat: C.garagem.lat, lng: C.garagem.lng },
    { id: 'a', ordem: 1, tipo: 'casa', rotulo: 'Rua A, 1', confirmado: true, lat: C.casaA.lat, lng: C.casaA.lng },
    { id: 'ex', ordem: 2, tipo: 'escola', rotulo: 'Escola X', destinoId: 'escX', destinoNome: 'Escola X', confirmado: true, lat: C.escola.lat, lng: C.escola.lng, horarioChegadaMin: opts.horaX === undefined ? 7 * 60 : opts.horaX },
    { id: 'b', ordem: 3, tipo: 'casa', rotulo: 'Rua B, 2', confirmado: true, lat: C.casaB.lat, lng: C.casaB.lng },
    { id: 'ey', ordem: 4, tipo: 'escola', rotulo: 'Escola Y', destinoId: 'escY', destinoNome: 'Escola Y', confirmado: true, lat: C.casaB.lat, lng: C.casaB.lng, horarioChegadaMin: opts.horaY === undefined ? 8 * 60 : opts.horaY },
  ];
  const passageiros: PassageiroRota[] = [
    { id: 'p1', identificacao: 'A', embarqueParadaId: 'a', desembarqueParadaId: 'ex', destinoId: 'escX' },
  ];
  return {
    id: 'rota-2esc', nome: 'Rota 2 escolas', sentido: 'ida', turno: 'manha', dias: ['seg'],
    veiculoId: 'v1', monitor: false, monitorOcupaLugar: false, lugaresReservados: 0,
    ultimoDesembarqueMin: opts.ultimo === undefined ? 8 * 60 : opts.ultimo,
    limiteAntecipacaoMin: null, status: 'concluida', isPublished: true, paradas, passageiros, atualizadoEm: '2026-11-06T00:00:00Z',
  };
}

describe('rotaAtendeDestino — 1º recorte por escola', () => {
  it('reconhece a escola que a rota atende e descarta as demais', () => {
    const r = rotaIdaDuasEscolas();
    expect(rotaAtendeDestino(r, 'escX')).toBe(true);
    expect(rotaAtendeDestino(r, 'escY')).toBe(true);
    expect(rotaAtendeDestino(r, 'esc-outra')).toBe(false);
  });

  it('buscarEmRotasReais só considera rotas que passam pela escola pedida', () => {
    const entradas = [
      { rota: rotaIda(), veiculo: veiculo(4) }, // atende esc1
      { rota: rotaIdaDuasEscolas(), veiculo: veiculo(4) }, // atende escX/escY, NÃO esc1
    ];
    const out = buscarEmRotasReais(entradas, pedidoIda()); // destino esc1
    expect(out.totalRotasAvaliadas).toBe(1);
    expect(out.resultados.every((r) => r.rotaId === 'rota-ida')).toBe(true);
  });
});

describe('âncora de horário é a da escola ESCOLHIDA (menos erro)', () => {
  it('escola intermediária SEM horário não herda o último desembarque de outra escola', () => {
    // escX (intermediária) sem horário; só o último desembarque (escY, 08:00)
    // está preenchido. Antes, isso virava âncora errada; agora não: sem turno,
    // fica indeterminado em vez de calcular com o horário de outra escola.
    const r = rotaIdaDuasEscolas({ horaX: null, horaY: null, ultimo: 8 * 60 });
    const semTurno = { ...r, turno: null as Rota['turno'] };
    const res = avaliarRotaReal(semTurno, veiculo(4), pedidoIda({ destinoId: 'escX', turno: null }));
    expect(res.status).toBe('indeterminado');
    expect(res.horarioEscolaMin).toBeNull();
  });

  it('escola escolhida COM horário próprio ancora nela (fonte real)', () => {
    const res = avaliarRotaReal(rotaIdaDuasEscolas(), veiculo(4), pedidoIda({ destinoId: 'escX' }));
    // Chega em escX no máximo às 07:00 (horário declarado dessa escola), nunca às 08:00.
    expect(res.fonteHorario).toBe('rota');
    if (res.horarioEscolaMin != null) expect(res.horarioEscolaMin).toBeLessThanOrEqual(7 * 60);
  });
});
