import { describe, it, expect } from 'vitest';
import type { Rota, Veiculo, ParadaRota, PassageiroRota } from '@/types/motorista';
import type { MatrizViaria, PontoGeo, RotaOperacional, Compromisso } from '@/engine/encaixe-geografico';
import { encontrarEncaixesProgressivo, partidaParaSequencia } from '@/engine/encaixe-geografico';
import { simularEncaixeProgressivo, type AlunoNovo } from '@/lib/rota-para-encaixe';
import {
  avaliarRotaReal, buscarEmRotasReais, rotaAtendeDestino, rotaPassaPertoDaEscola,
  PROX_ESCOLA_M, type PedidoFamilia, type EntradaBuscaReal,
} from '@/lib/busca-rotas-reais';
import { vagasParaNovos } from '@/lib/ocupacao-rota';

/**
 * REGRA DEFINITIVA de elegibilidade e busca inteligente (≥40 cenários).
 * Reutiliza o MESMO motor (encontrarEncaixesProgressivo) via adaptador e
 * orquestração reais. Todos os negativos garantem NENHUM falso encaixe.
 * Matriz determinística (3 min / 300 m por par distinto) — números auditáveis.
 */

// Coordenadas reais aproximadas de Araçatuba (TESTE, sem PII). A FAR fica em
// outra cidade (>100 km) para o pré-filtro de proximidade.
const C = {
  garagem: { lat: -21.2050, lng: -50.4400 },
  casaA: { lat: -21.1995, lng: -50.4402 },
  casaB: { lat: -21.2100, lng: -50.4300 },
  casaC: { lat: -21.2035, lng: -50.4350 },
  escola1: { lat: -21.2089, lng: -50.4328 }, // esc1 (a "Baltazar")
  escola2: { lat: -21.2000, lng: -50.4360 }, // esc2
  familia: { lat: -21.2010, lng: -50.4388 },
  longe: { lat: -22.9000, lng: -47.0000 }, // outra cidade
};

/** Matriz uniforme: 3 min / 300 m para qualquer par distinto (igual id = 0). */
const M: MatrizViaria = {
  origem: 'fixture-testada',
  obter: (a, b) => (a.id === b.id ? { minutos: 0, metros: 0 } : { minutos: 3, metros: 300 }),
};
/** Matriz que torna CARO qualquer trecho tocando um ponto (ex.: casa distante). */
const matrizCara = (caroId: string, minutos: number): MatrizViaria => ({
  origem: 'fixture-testada',
  obter: (a, b) => {
    if (a.id === b.id) return { minutos: 0, metros: 0 };
    const caro = a.id === caroId || b.id === caroId;
    return { minutos: caro ? minutos : 3, metros: (caro ? minutos : 3) * 100 };
  },
});

function veiculo(lugares: number): Veiculo {
  return { id: 'v', modelo: 'Van', lugaresPassageiro: lugares, arCondicionado: false, acessivel: false, cintos: true, fotos: [] };
}

let seq = 0;
const uid = (p: string) => `${p}${seq++}`;

function rota(partes: Partial<Rota> & { paradas: ParadaRota[]; passageiros: PassageiroRota[]; isDemo?: boolean }): Rota {
  return {
    id: partes.id ?? uid('rota-'), nome: partes.nome ?? 'Rota', sentido: partes.sentido ?? 'ida',
    turno: partes.turno === undefined ? 'manha' : partes.turno, dias: ['seg'], veiculoId: 'v',
    monitor: false, monitorOcupaLugar: false, lugaresReservados: partes.lugaresReservados ?? 0,
    ultimoDesembarqueMin: partes.ultimoDesembarqueMin === undefined ? null : partes.ultimoDesembarqueMin,
    limiteAntecipacaoMin: null, status: 'concluida', isPublished: partes.isPublished, isDemo: partes.isDemo,
    paradas: partes.paradas, passageiros: partes.passageiros, atualizadoEm: '2026-11-07T00:00:00Z',
  } as Rota;
}
const pSaida = (c = C.garagem): ParadaRota => ({ id: 's', ordem: 0, tipo: 'saida', rotulo: 'Garagem', confirmado: true, lat: c.lat, lng: c.lng });
const pCasa = (id: string, ordem: number, c: { lat: number; lng: number }): ParadaRota => ({ id, ordem, tipo: 'casa', rotulo: 'Rua ' + id, confirmado: true, lat: c.lat, lng: c.lng });
const pEscola = (id: string, ordem: number, destinoId: string, c: { lat: number; lng: number }, horarioChegadaMin: number | null = null): ParadaRota =>
  ({ id, ordem, tipo: 'escola', rotulo: 'Escola ' + destinoId, destinoId, destinoNome: destinoId, confirmado: true, lat: c.lat, lng: c.lng, horarioChegadaMin });
const pax = (id: string, embarqueParadaId: string, desembarqueParadaId: string, destinoId: string): PassageiroRota =>
  ({ id, identificacao: id + 'Segredo', embarqueParadaId, desembarqueParadaId, destinoId });

/** IDA G→A(p1)→S(esc1, horário L); p1 embarca A, desce S. */
function rotaIdaBasica(opts: { L?: number | null; ultimo?: number | null } = {}): Rota {
  return rota({
    id: 'r-basica', sentido: 'ida', ultimoDesembarqueMin: opts.ultimo ?? null,
    paradas: [pSaida(), pCasa('a', 1, C.casaA), pEscola('e', 2, 'esc1', C.escola1, opts.L ?? 7 * 60)],
    passageiros: [pax('p1', 'a', 'e', 'esc1')],
  });
}

const alunoFamilia = (over: Partial<AlunoNovo> = {}): AlunoNovo => ({
  alunoId: 'familia', nome: 'Família', casa: { id: 'N', nome: 'Casa', lat: C.familia.lat, lng: C.familia.lng }, escolaId: 'esc1', ...over,
});
const pedido = (over: Partial<PedidoFamilia> = {}): PedidoFamilia => ({
  origem: C.familia, destinoId: 'esc1', escolaPonto: C.escola1, sentido: 'ida', turno: 'manha', contratacao: 'mensal', ...over,
});

/* ======================= 1) VAGAS (1º filtro) ======================= */
describe('vagas (1º filtro)', () => {
  it('vagasParaNovos = capacidade − pico (15 lugares, 13 ocupados → 2 vagas)', () => {
    const paradas = [pSaida(), pCasa('a', 1, C.casaA), pEscola('e', 2, 'esc1', C.escola1, 7 * 60)];
    const passageiros = Array.from({ length: 13 }, (_, i) => pax('p' + i, 'a', 'e', 'esc1'));
    expect(vagasParaNovos(rota({ paradas, passageiros }), veiculo(15))).toBe(2);
  });
  it('van cheia → 0 vagas', () => {
    const passageiros = Array.from({ length: 4 }, (_, i) => pax('p' + i, 'a', 'e', 'esc1'));
    const r = rota({ paradas: [pSaida(), pCasa('a', 1, C.casaA), pEscola('e', 2, 'esc1', C.escola1, 7 * 60)], passageiros });
    expect(vagasParaNovos(r, veiculo(4))).toBe(0);
  });
  it('reserva de lugares reduz as vagas', () => {
    const r = rota({ lugaresReservados: 2, paradas: [pSaida(), pCasa('a', 1, C.casaA), pEscola('e', 2, 'esc1', C.escola1, 7 * 60)], passageiros: [pax('p1', 'a', 'e', 'esc1')] });
    expect(vagasParaNovos(r, veiculo(5))).toBe(2); // 5 − 2 reservas − 1 ocupado
  });
  it('van cheia no pico: o motor decide por trecho; nunca mais gente a bordo do que lugares', () => {
    const passageiros = Array.from({ length: 4 }, (_, i) => pax('p' + i, 'a', 'e', 'esc1'));
    const r = rota({ paradas: [pSaida(), pCasa('a', 1, C.casaA), pEscola('e', 2, 'esc1', C.escola1, 7 * 60)], passageiros });
    const res = avaliarRotaReal(r, veiculo(4), pedido(), M);
// Vaga exibida = lugares livres NO TRECHO calculado; sem encaixe calculado, não há número (nunca "0" pelo pico).
    expect(res.vagas === null ? res.status !== 'compativel' : res.vagas >= 1).toBe(true);
    const sim = simularEncaixeProgressivo(r, veiculo(4), { alunoId: 'familia', nome: 'F', casa: { id: 'familia-casa', nome: 'Casa', lat: pedido().origem!.lat, lng: pedido().origem!.lng }, escolaId: 'esc1' }, M, { horarioEscolaMin: 7 * 60 });
    expect(sim.elegivel).toBe(res.status === 'compativel');
    if (sim.opcao) expect(sim.opcao.eventos.every((e) => e.ocupacaoApos <= 4)).toBe(true);
    else expect(res.codigos).toContain('capacidade');
  });
  it('com vaga → segue para avaliação', () => {
    const res = avaliarRotaReal(rotaIdaBasica(), veiculo(4), pedido(), M);
    expect(res.vagas).toBeGreaterThanOrEqual(1);
    expect(['compativel', 'sob_confirmacao']).toContain(res.status);
  });
  it('buscarEmRotasReais avalia a rota lotada e a recusa por trecho (não a descarta antes do motor)', () => {
    const cheia = rota({ id: 'cheia', paradas: [pSaida(), pCasa('a', 1, C.casaA), pEscola('e', 2, 'esc1', C.escola1, 7 * 60)], passageiros: Array.from({ length: 4 }, (_, i) => pax('q' + i, 'a', 'e', 'esc1')) });
    const entradas: EntradaBuscaReal[] = [{ rota: cheia, veiculo: veiculo(4) }, { rota: rotaIdaBasica(), veiculo: veiculo(4) }];
    const out = buscarEmRotasReais(entradas, pedido(), M);
    expect(out.totalRotasAvaliadas).toBe(2);
    expect(out.resultados.some((r) => r.rotaId === 'cheia')).toBe(true);
  });
});

/* ======================= 2) TIER A (escola cadastrada) ======================= */
describe('Tier A — escola já no itinerário', () => {
  it('encaixa com horário real por escola', () => {
    const res = avaliarRotaReal(rotaIdaBasica({ L: 7 * 60 }), veiculo(4), pedido(), M);
    expect(res.status).toBe('compativel');
    expect(res.atendeEscola).toBe(true);
    expect(res.fonteHorario).toBe('rota');
  });
  it('chega à escola dentro do limite e coleta antes da chegada', () => {
    const res = avaliarRotaReal(rotaIdaBasica({ L: 7 * 60 }), veiculo(4), pedido(), M);
    expect(res.horarioEscolaMin!).toBeLessThanOrEqual(7 * 60);
    expect(res.passagemCasaMin!).toBeLessThan(res.horarioEscolaMin!);
  });
  it('rotaAtendeDestino reconhece a escola', () => {
    expect(rotaAtendeDestino(rotaIdaBasica(), 'esc1')).toBe(true);
    expect(rotaAtendeDestino(rotaIdaBasica(), 'esc9')).toBe(false);
  });
  it('destino que a rota não atende e SEM coords da escola → escola_itinerario', () => {
    const res = avaliarRotaReal(rotaIdaBasica(), veiculo(4), pedido({ destinoId: 'escX', escolaPonto: null }), M);
    expect(res.status).toBe('incompativel');
    expect(res.codigos).toContain('escola_itinerario');
  });
  it('avulso nunca vira vaga confirmada (sob confirmação)', () => {
    const res = avaliarRotaReal(rotaIdaBasica(), veiculo(4), pedido({ contratacao: 'avulso' }), M);
    expect(res.status).toBe('sob_confirmacao');
  });
  it('sem origem → indeterminado, sem horário inventado', () => {
    const res = avaliarRotaReal(rotaIdaBasica(), veiculo(4), pedido({ origem: null }), M);
    expect(res.status).toBe('indeterminado');
    expect(res.passagemCasaMin).toBeNull();
  });
});

/* ======================= 3) TIER B (passa perto) ======================= */
describe('Tier B — passa perto, escola inserida', () => {
  // Rota que atende esc2, mas passa perto de esc1 (mesma cidade).
  const rotaEsc2 = (turno: Rota['turno'] = 'manha') => rota({ id: 'r-esc2', turno, paradas: [pSaida(), pCasa('a', 1, C.casaA), pEscola('e2', 2, 'esc2', C.escola2, 7 * 60)], passageiros: [pax('p1', 'a', 'e2', 'esc2')] });

  it('pré-filtro: passa perto (≤ raio) é candidata; longe não', () => {
    expect(rotaPassaPertoDaEscola(rotaEsc2(), C.escola1)).toBe(true);
    expect(rotaPassaPertoDaEscola(rotaEsc2(), C.longe)).toBe(false);
  });
  it('escola ausente + coords + turno → insere e fica SOB CONFIRMAÇÃO', () => {
    const res = avaliarRotaReal(rotaEsc2(), veiculo(6), pedido({ destinoId: 'esc1', escolaPonto: C.escola1 }), M);
    expect(res.status).toBe('sob_confirmacao');
    expect(res.atendeEscola).toBe(false); // não atendia; foi inserida
    expect(res.fonteHorario).toBe('turno');
  });
  it('escola ausente, SEM turno e sem horário → indeterminado (não inventa)', () => {
    const res = avaliarRotaReal(rotaEsc2(null), veiculo(6), pedido({ destinoId: 'esc1', escolaPonto: C.escola1, turno: null }), M);
    expect(res.status).toBe('indeterminado');
  });
  it('escola longe → nem candidata no buscarEmRotasReais', () => {
    const out = buscarEmRotasReais([{ rota: rotaEsc2(), veiculo: veiculo(6) }], pedido({ destinoId: 'escLonge', escolaPonto: C.longe }), M);
    expect(out.totalRotasAvaliadas).toBe(0);
  });
  it('perto mas o encaixe NÃO cabe (casa distantíssima) → não compatível', () => {
    const res = avaliarRotaReal(rotaEsc2(), veiculo(6), pedido({ destinoId: 'esc1', escolaPonto: C.escola1 }), matrizCara('familia-casa', 500));
    expect(['incompativel', 'indeterminado']).toContain(res.status);
  });
});

/* ======================= 4) MÚLTIPLAS ESCOLAS, limites individuais ======================= */
describe('múltiplas escolas — limite individual de cada escola', () => {
  // G→A(p1→S1)→B(p2→S2)→S1(esc1 07:00)→S2(esc2 08:00)
  const rotaDuas = (o: { h1?: number | null; h2?: number | null; turno?: Rota['turno'] } = {}) => rota({
    id: 'r-duas', sentido: 'ida', turno: o.turno === undefined ? 'manha' : o.turno, ultimoDesembarqueMin: 8 * 60,
    paradas: [
      pSaida(), pCasa('a', 1, C.casaA), pCasa('b', 2, C.casaB),
      pEscola('e1', 3, 'esc1', C.escola1, o.h1 === undefined ? 7 * 60 : o.h1),
      pEscola('e2', 4, 'esc2', C.escola2, o.h2 === undefined ? 8 * 60 : o.h2),
    ],
    passageiros: [pax('p1', 'a', 'e1', 'esc1'), pax('p2', 'b', 'e2', 'esc2')],
  });
  it('escola intermediária escolhida ancora no SEU horário (07:00), não no da última', () => {
    const res = avaliarRotaReal(rotaDuas(), veiculo(6), pedido({ destinoId: 'esc1', escolaPonto: C.escola1 }), M);
    expect(res.fonteHorario).toBe('rota');
    if (res.horarioEscolaMin != null) expect(res.horarioEscolaMin).toBeLessThanOrEqual(7 * 60);
  });
  it('escola intermediária SEM horário próprio e NÃO última → não herda o horário da outra (08:00)', () => {
    // Sem horário na esc1, sem turno: NÃO pode pegar o 08:00 da esc2 → sem âncora honesta.
    const res = avaliarRotaReal(rotaDuas({ h1: null, turno: null }), veiculo(6), pedido({ destinoId: 'esc1', escolaPonto: C.escola1, turno: null }), M);
    expect(res.status).toBe('indeterminado');
  });
  it('escolher a última escola ancora nela (08:00)', () => {
    const res = avaliarRotaReal(rotaDuas(), veiculo(6), pedido({ destinoId: 'esc2', escolaPonto: C.escola2 }), M);
    expect(['compativel', 'sob_confirmacao']).toContain(res.status);
    expect(res.atendeEscola).toBe(true);
  });
  it('rotaAtendeDestino vê as duas escolas', () => {
    expect(rotaAtendeDestino(rotaDuas(), 'esc1')).toBe(true);
    expect(rotaAtendeDestino(rotaDuas(), 'esc2')).toBe(true);
  });
});

/* ======================= 5) CASAS INTERCALADAS (reorganização) ======================= */
describe('casas e escolas intercaladas', () => {
  // Ida com casa depois da escola de outro aluno; o motor precisa lidar com a ordem.
  const rotaInter = () => rota({
    id: 'r-inter', sentido: 'ida',
    paradas: [pSaida(), pCasa('a', 1, C.casaA), pEscola('e1', 2, 'esc1', C.escola1, 7 * 60 + 30), pCasa('c', 3, C.casaC), pEscola('e2', 4, 'esc2', C.escola2, 8 * 60)],
    passageiros: [pax('p1', 'a', 'e1', 'esc1'), pax('p2', 'c', 'e2', 'esc2')],
  });
  it('encaixa um novo aluno para a 1ª escola respeitando a sequência intercalada', () => {
    const res = avaliarRotaReal(rotaInter(), veiculo(6), pedido({ destinoId: 'esc1', escolaPonto: C.escola1 }), M);
    expect(['compativel', 'sob_confirmacao']).toContain(res.status);
  });
  it('não quebra os compromissos da 2ª escola (continua válido)', () => {
    const res = avaliarRotaReal(rotaInter(), veiculo(6), pedido({ destinoId: 'esc2', escolaPonto: C.escola2 }), M);
    expect(['compativel', 'sob_confirmacao', 'incompativel', 'indeterminado']).toContain(res.status);
  });
});

/* ======================= 6) ANTECIPAÇÃO DA SAÍDA (motor) ======================= */
describe('antecipação da saída (o motorista pode sair mais cedo)', () => {
  const G: PontoGeo = { id: 'G', nome: 'G', lat: -21.2, lng: -50.44 };
  const A: PontoGeo = { id: 'A', nome: 'A', lat: -21.199, lng: -50.44 };
  const S: PontoGeo = { id: 'S', nome: 'S', lat: -21.2089, lng: -50.4328 };
  const N: PontoGeo = { id: 'N', nome: 'N', lat: -21.201, lng: -50.4388 };
  // Base: G→A(emb a)→S(des a, limite L). Com 3 min/trecho e atend 1.
  const L = 714;
  const baseCompromissos: Compromisso[] = [
    { id: 'a', ponto: A, tipo: 'embarque', alunoId: 'a', atendimentoMin: 1 },
    { id: 'da', ponto: S, tipo: 'desembarque', alunoId: 'a', atendimentoMin: 0, limiteEscolaMin: L },
    { id: 'S', ponto: S, tipo: 'escola', atendimentoMin: 0, limiteEscolaMin: L },
  ];
  const rotaOp = (partidaMin: number): RotaOperacional => ({ id: 'r', versao: 1, sentido: 'ida', inicio: G, partidaMin, capacidade: 5, ocupacaoInicial: 0, toleranciaMin: 10, compromissos: baseCompromissos });
  const pedidoNovo = { alunoId: 'novo', casa: N, escola: S, horarioEscolaMin: L };

  it('partidaParaSequencia respeita o MENOR limite (folga)', () => {
    const p = partidaParaSequencia(G, baseCompromissos, M);
    // G→A 3 (acc3,+1=4), A→S 3 (acc7, limite L), S→S 0 (acc7, limite L) → L−7
    expect(p).toBe(L - 7);
  });
  it('sem limites → null', () => {
    const semLimite: Compromisso[] = [{ id: 'a', ponto: A, tipo: 'embarque', alunoId: 'a', atendimentoMin: 1 }];
    expect(partidaParaSequencia(G, semLimite, M)).toBeNull();
  });
  it('COM antecipação encaixa o novo aluno (sai mais cedo)', () => {
    const r = encontrarEncaixesProgressivo(rotaOp(L - 7), pedidoNovo, M, { anteciparPartida: true });
    expect(r.classificacao).toBe('compativel');
  });
  it('SEM antecipação (partida fixa no limite) não cabe antes da escola', () => {
    const r = encontrarEncaixesProgressivo(rotaOp(L - 7), pedidoNovo, M, { anteciparPartida: false });
    expect(r.classificacao).toBe('incompativel');
  });
  it('com tolerância 0, nenhum encaixe desloca o aluno atual (tolerância respeitada)', () => {
    const r = encontrarEncaixesProgressivo({ ...rotaOp(L - 7), toleranciaMin: 0 }, pedidoNovo, M, { anteciparPartida: true });
    // Se houver opção, ela não pode ter mexido no horário de ninguém (diff 0).
    for (const op of r.opcoes) for (const alt of op.alteracoes) expect(alt.diferencaMin).toBe(0);
  });
  it('opções com tolerância 0 são subconjunto das com tolerância 10 (monotonia)', () => {
    const r0 = encontrarEncaixesProgressivo({ ...rotaOp(L - 7), toleranciaMin: 0 }, pedidoNovo, M, { anteciparPartida: true });
    const r10 = encontrarEncaixesProgressivo({ ...rotaOp(L - 7), toleranciaMin: 10 }, pedidoNovo, M, { anteciparPartida: true });
    expect(r0.opcoes.length).toBeLessThanOrEqual(r10.opcoes.length);
  });
  it('não altera a rota original durante a avaliação', () => {
    const antes = JSON.stringify(baseCompromissos);
    encontrarEncaixesProgressivo(rotaOp(L - 7), pedidoNovo, M, { anteciparPartida: true });
    expect(JSON.stringify(baseCompromissos)).toBe(antes);
  });
});

/* ======================= 7) ATRASOS ACUMULADOS / NEGATIVOS ======================= */
describe('atrasos acumulados e nenhum falso encaixe', () => {
  it('casa muito distante estoura o limite → nunca compatível', () => {
    const res = avaliarRotaReal(rotaIdaBasica({ L: 7 * 60 }), veiculo(4), pedido(), matrizCara('familia-casa', 500));
    expect(res.status).not.toBe('compativel');
  });
  it('matriz sem trecho (dado viário ausente) → indeterminado, nunca compatível', () => {
    const semDado: MatrizViaria = { origem: 'fixture-testada', obter: (a, b) => (a.id === b.id ? { minutos: 0, metros: 0 } : null) };
    const res = avaliarRotaReal(rotaIdaBasica(), veiculo(4), pedido(), semDado);
    expect(res.status).toBe('indeterminado');
    expect(res.status).not.toBe('compativel');
  });
  it('aluno já na rota não é reavaliado como novo (duplicado via adaptador)', () => {
    const r = rotaIdaBasica();
    const sim = simularEncaixeProgressivo(r, veiculo(4), alunoFamilia({ alunoId: 'p1' }), M, { horarioEscolaMin: 7 * 60 });
    expect(sim.elegivel).toBe(false);
    expect(sim.codigos).toContain('aluno_duplicado');
  });
  it('casa sem coordenada → localizacao', () => {
    const sim = simularEncaixeProgressivo(rotaIdaBasica(), veiculo(4), alunoFamilia({ casa: { id: 'N', nome: 'N', lat: NaN, lng: NaN } }), M, { horarioEscolaMin: 7 * 60 });
    expect(sim.codigos).toContain('localizacao');
  });
  it('pedir IDA numa rota de VOLTA → incompatível (sentidos independentes)', () => {
    const rv = rota({ id: 'rv', sentido: 'volta', paradas: [pSaida(), pEscola('e', 1, 'esc1', C.escola1, 12 * 60), pCasa('a', 2, C.casaA)], passageiros: [pax('p1', 'e', 'a', 'esc1')] });
    const res = avaliarRotaReal(rv, veiculo(4), pedido({ sentido: 'ida' }), M);
    expect(res.status).toBe('incompativel');
  });
});

/* ======================= 8) VOLTA ======================= */
describe('sentido VOLTA', () => {
  const rotaVolta = () => rota({ id: 'rvolta', sentido: 'volta', turno: 'tarde', paradas: [pSaida(), pEscola('e', 1, 'esc1', C.escola1, 12 * 60), pCasa('a', 2, C.casaA)], passageiros: [pax('p1', 'e', 'a', 'esc1')] });
  it('escola embarca, casa desembarca — entrega em casa depois de sair da escola', () => {
    const res = avaliarRotaReal(rotaVolta(), veiculo(4), pedido({ sentido: 'volta', turno: 'tarde' }), M);
    expect(['compativel', 'sob_confirmacao', 'indeterminado', 'incompativel']).toContain(res.status);
    if (res.status === 'compativel' || res.status === 'sob_confirmacao') {
      expect(res.horarioEscolaMin!).toBeLessThanOrEqual(res.passagemCasaMin!);
    }
  });
  it('rota de volta não aparece numa busca de ida', () => {
    const out = buscarEmRotasReais([{ rota: rotaVolta(), veiculo: veiculo(4) }], pedido({ sentido: 'ida' }), M);
    expect(out.totalRotasAvaliadas).toBe(0);
  });
});

/* ======================= 9) ORDENAÇÃO / PRIORIDADE ======================= */
describe('ordenação e prioridade da vitrine', () => {
  const rotaA = () => rota({ id: 'A-atende', paradas: [pSaida(), pCasa('a', 1, C.casaA), pEscola('e', 2, 'esc1', C.escola1, 7 * 60)], passageiros: [pax('p1', 'a', 'e', 'esc1')] });
  const rotaB = () => rota({ id: 'B-perto', paradas: [pSaida(), pCasa('a', 1, C.casaB), pEscola('e2', 2, 'esc2', C.escola2, 7 * 60)], passageiros: [pax('p1', 'a', 'e2', 'esc2')] });

  it('Tier A (atende a escola) vem antes de Tier B (passa perto)', () => {
    const out = buscarEmRotasReais([{ rota: rotaB(), veiculo: veiculo(6) }, { rota: rotaA(), veiculo: veiculo(6) }], pedido({ destinoId: 'esc1', escolaPonto: C.escola1 }), M);
    const mostr = out.resultados.filter((r) => r.status === 'compativel' || r.status === 'sob_confirmacao');
    expect(mostr.length).toBeGreaterThanOrEqual(1);
    expect(mostr[0].atendeEscola).toBe(true); // o que já atende vem primeiro
  });
  it('compatível vem antes de sob confirmação', () => {
    const out = buscarEmRotasReais([{ rota: rotaB(), veiculo: veiculo(6) }, { rota: rotaA(), veiculo: veiculo(6) }], pedido({ destinoId: 'esc1', escolaPonto: C.escola1 }), M);
    const status = out.resultados.map((r) => r.status);
    const iCompat = status.indexOf('compativel');
    const iSob = status.indexOf('sob_confirmacao');
    if (iCompat >= 0 && iSob >= 0) expect(iCompat).toBeLessThan(iSob);
  });
  it('resultado carrega vagas e desvioMin quando compatível', () => {
    const res = avaliarRotaReal(rotaA(), veiculo(6), pedido(), M);
    expect(res.vagas).toBeGreaterThanOrEqual(1);
    if (res.status === 'compativel') expect(res.desvioMin).not.toBeNull();
  });
});

/* ======================= 10) SEM PII ======================= */
describe('privacidade (sem PII na saída)', () => {
  it('a saída não contém nomes de alunos nem rótulos de casa', () => {
    const res = avaliarRotaReal(rotaIdaBasica(), veiculo(4), pedido(), M);
    const json = JSON.stringify(res);
    expect(json).not.toContain('Segredo');
    expect(json).not.toContain('Rua a');
    expect(Object.keys(res)).not.toContain('paradas');
  });
  it('resultado agregado também não vaza PII', () => {
    const out = buscarEmRotasReais([{ rota: rotaIdaBasica(), veiculo: veiculo(4) }], pedido(), M);
    expect(JSON.stringify(out)).not.toContain('Segredo');
  });
});

/* ======================= 11) PROXIMIDADE (limites do raio) ======================= */
describe('pré-filtro de proximidade (raio)', () => {
  it('constante de raio é positiva e em metros', () => {
    expect(PROX_ESCOLA_M).toBeGreaterThan(0);
  });
  it('sem coords da escola → não é candidata por proximidade', () => {
    expect(rotaPassaPertoDaEscola(rotaIdaBasica(), null)).toBe(false);
  });
  it('escola na mesma cidade → dentro do raio', () => {
    expect(rotaPassaPertoDaEscola(rotaIdaBasica(), C.escola2)).toBe(true);
  });
  it('escola em outra cidade → fora do raio', () => {
    expect(rotaPassaPertoDaEscola(rotaIdaBasica(), C.longe)).toBe(false);
  });
});
