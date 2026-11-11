import { describe, it, expect } from 'vitest';
import { simularEncaixeRota, type AlunoNovo, MARGEM_OPERACIONAL_MIN } from './rota-para-encaixe';
import type { MatrizViaria, PontoGeo } from '@/engine/encaixe-geografico';
import type { Rota, Veiculo, ParadaRota, PassageiroRota } from '@/types/motorista';

/* --------------------------- fixtures determinísticas --------------------------- */
// Matriz viária de teste: tempos por par de ids. `null` => trecho ausente.
function matriz(tempos: Record<string, number | null>): MatrizViaria {
  return {
    origem: 'fixture-testada',
    obter: (a, b) => {
      if (a.id === b.id) return { minutos: 0, metros: 0 };
      const k = a.id + '>' + b.id;
      const r = b.id + '>' + a.id;
      const t = k in tempos ? tempos[k] : r in tempos ? tempos[r] : 6;
      if (t === null) return null;
      return { minutos: t, metros: t * 300 };
    },
  };
}

const veiculo = (lugares: number): Veiculo => ({
  id: 'v1', modelo: 'Van', lugaresPassageiro: lugares,
  arCondicionado: true, acessivel: false, cintos: true, fotos: [],
});

let seq = 0;
const coordParada = (id: string, tipo: ParadaRota['tipo'], ordem: number, extra: Partial<ParadaRota> = {}): ParadaRota => ({
  id, ordem, tipo, rotulo: id, lat: -21.2 + (seq += 0.01), lng: -50.4 - seq, confirmado: true, ...extra,
});

const pax = (id: string, nome: string, emb: string | null, des: string | null, destinoId?: string): PassageiroRota => ({
  id, identificacao: nome, embarqueParadaId: emb, desembarqueParadaId: des, destinoId: destinoId ?? null,
});

// Ida: garagem -> casaA -> casaB -> escola(esc). Ana e Bruno vão à escola.
function rotaIda(): Rota {
  return {
    id: 'r-ida', nome: 'Ida', sentido: 'ida', turno: 'manha', dias: ['seg'], veiculoId: 'v1',
    monitor: false, monitorOcupaLugar: false, lugaresReservados: 0,
    ultimoDesembarqueMin: 420, limiteAntecipacaoMin: 30, status: 'concluida', atualizadoEm: '2026-11-04T00:00:00Z',
    paradas: [
      coordParada('s', 'saida', 0),
      coordParada('a', 'casa', 1),
      coordParada('b', 'casa', 2),
      coordParada('e', 'escola', 3, { destinoId: 'esc', destinoNome: 'Escola' }),
    ],
    passageiros: [pax('ana', 'Ana', 'a', 'e', 'esc'), pax('bruno', 'Bruno', 'b', 'e', 'esc')],
  };
}

// Volta: garagem -> escola(esc) -> casaA -> casaB.
function rotaVolta(): Rota {
  return {
    id: 'r-volta', nome: 'Volta', sentido: 'volta', turno: 'manha', dias: ['seg'], veiculoId: 'v1',
    monitor: false, monitorOcupaLugar: false, lugaresReservados: 0,
    ultimoDesembarqueMin: 720, limiteAntecipacaoMin: 30, status: 'concluida', atualizadoEm: '2026-11-04T00:00:00Z',
    paradas: [
      coordParada('s', 'saida', 0),
      coordParada('e', 'escola', 1, { destinoId: 'esc', destinoNome: 'Escola' }),
      coordParada('a', 'casa', 2),
      coordParada('b', 'casa', 3),
    ],
    passageiros: [pax('ana', 'Ana', 'e', 'a', 'esc'), pax('bruno', 'Bruno', 'e', 'b', 'esc')],
  };
}

const casaNova: PontoGeo = { id: 'nova', nome: 'Casa nova', lat: -21.25, lng: -50.5 };
const aluno = (over: Partial<AlunoNovo> = {}): AlunoNovo => ({ alunoId: 'novo', nome: 'Novo', casa: casaNova, escolaId: 'esc', ...over });

const temposIda = { 's>a': 5, 'a>b': 5, 'b>e': 7, 'a>nova': 3, 'nova>b': 4, 's>nova': 20, 'nova>e': 20, 'b>nova': 20 };
const temposVolta = { 's>e': 10, 'e>a': 6, 'a>b': 8, 'a>nova': 4, 'nova>b': 4, 'e>nova': 20, 'b>nova': 5 };

/* --------------------------------- cenários --------------------------------- */
describe('simularEncaixeRota — adaptador do simulador', () => {
  it('1+2+7+9: encaixe válido na ida; base válida; chegada planejada respeita a margem', () => {
    const r = simularEncaixeRota(rotaIda(), veiculo(5), aluno(), matriz(temposIda), { horarioEscolaMin: 420 });
    expect(r.elegivel).toBe(true);
    expect(r.opcao).not.toBeNull();
    expect(r.sentido).toBe('ida');
    expect(r.base?.valido).toBe(true);
    // Planejamento de trás para frente: a base chega à escola no horário planejado (limite - margem).
    const chegadaEscola = r.base!.eventos.find((e) => e.compromisso.ponto.id === 'esc')!.chegadaMin;
    expect(chegadaEscola).toBe(420 - MARGEM_OPERACIONAL_MIN);
    // A chegada do novo aluno à escola nunca ultrapassa o limite.
    expect(r.opcao!.horarioEntregaMin).toBeLessThanOrEqual(420);
  });

  it('3+18: encaixe válido na volta; aluno novo desce depois de embarcar', () => {
    const r = simularEncaixeRota(rotaVolta(), veiculo(5), aluno(), matriz(temposVolta), { horarioEscolaMin: 720 });
    expect(r.elegivel).toBe(true);
    expect(r.sentido).toBe('volta');
    expect(r.opcao!.horarioEntregaMin).toBeGreaterThan(r.opcao!.horarioBuscaMin);
  });

  it('4: ida viável e volta inviável avaliadas separadamente', () => {
    const ida = simularEncaixeRota(rotaIda(), veiculo(5), aluno(), matriz(temposIda), { horarioEscolaMin: 420 });
    // Volta sem trajeto rodoviário para a casa nova -> inviável.
    const volta = simularEncaixeRota(rotaVolta(), veiculo(5), aluno(), matriz({ ...temposVolta, 'a>nova': null, 'nova>b': null, 'e>nova': null, 'b>nova': null }), { horarioEscolaMin: 720 });
    expect(ida.elegivel).toBe(true);
    expect(volta.elegivel).toBe(false);
  });

  it('5: encaixe válido quando a capacidade é exatamente suficiente', () => {
    const r = simularEncaixeRota(rotaIda(), veiculo(3), aluno(), matriz(temposIda), { horarioEscolaMin: 420 });
    expect(r.elegivel).toBe(true);
    expect(r.opcao!.eventos.every((e) => e.ocupacaoApos <= 3)).toBe(true);
  });

  it('6: capacidade excedida no trecho em comum -> motivo de capacidade', () => {
    // Partida fixa (sem antecipar): não cabe no trecho em comum.
    const r = simularEncaixeRota(rotaIda(), veiculo(2), aluno(), matriz(temposIda), { horarioEscolaMin: 420, antecipacaoMaxMin: 0 });
    expect(r.elegivel).toBe(false);
    expect(r.codigos).toContain('capacidade');
    // VanBora 2.0: saindo mais cedo (dentro dos 30 min que o motorista cadastrou) a van
    // deixa o novo aluno na escola antes de buscar o Bruno — nenhum trecho passa de 2.
    const v2 = simularEncaixeRota(rotaIda(), veiculo(2), aluno(), matriz(temposIda), { horarioEscolaMin: 420 });
    expect(v2.elegivel).toBe(true);
    expect(v2.classe).toBe('pre_autorizado');
    expect(v2.opcao!.eventos.every((e) => e.ocupacaoApos <= 2)).toBe(true);
  });

  it('8: chegada após o limite -> motivo de atraso', () => {
    // Todos os trajetos da casa nova são muito longos: qualquer inserção atrasa a escola.
    const longe = { 's>a': 5, 'a>b': 5, 'b>e': 7, 'a>nova': 40, 'nova>b': 40, 's>nova': 40, 'nova>e': 40, 'b>nova': 40 };
    const r = simularEncaixeRota(rotaIda(), veiculo(5), aluno(), matriz(longe), { horarioEscolaMin: 420, antecipacaoMaxMin: 0 });
    expect(r.elegivel).toBe(false);
    expect(r.codigos).toContain('atraso');
    // VanBora 2.0: viável só saindo bem mais cedo que o autorizado (30) -> depende do motorista.
    const v2 = simularEncaixeRota(rotaIda(), veiculo(5), aluno(), matriz(longe), { horarioEscolaMin: 420 });
    expect(v2.elegivel).toBe(true);
    expect(v2.classe).toBe('aprovacao_motorista');
    expect(v2.antecipacaoMin!).toBeGreaterThan(30);
  });

  it('10: encaixe válido mantém cada aluno existente dentro de 10 minutos', () => {
    const r = simularEncaixeRota(rotaVolta(), veiculo(5), aluno(), matriz(temposVolta), { horarioEscolaMin: 720, toleranciaMin: 10 });
    expect(r.elegivel).toBe(true);
    expect(r.opcao!.alteracoes.every((a) => Math.abs(a.diferencaMin) <= 10)).toBe(true);
  });

  it('11+12: tolerância contratual 0 — só cabe sem mexer em NINGUÉM', () => {
    // Volta: embarcar na escola junto do grupo não muda horário de ninguém (o
    // tempo da escola é do grupo), e a casa nova só cabe no FIM da rota.
    const r = simularEncaixeRota(rotaVolta(), veiculo(5), aluno(), matriz(temposVolta), { horarioEscolaMin: 720, toleranciaMin: 0 });
    expect(r.elegivel).toBe(true);
    expect(r.opcao!.alteracoes.every((a) => a.diferencaMin === 0)).toBe(true);
    expect(r.opcao!.posicaoDesembarque).toBe(r.opcao!.eventos.length - 1);
    // Sem caminho até a casa nova a partir da última casa, a entrega teria de
    // entrar no meio e atrasar alguém: tolerância 0 bloqueia.
    const r0 = simularEncaixeRota(rotaVolta(), veiculo(5), aluno(), matriz({ ...temposVolta, 'b>nova': null }), { horarioEscolaMin: 720, toleranciaMin: 0 });
    expect(r0.elegivel).toBe(false);
    expect(r0.codigos).toContain('tolerancia');
  });

  it('13: escola fora do itinerário', () => {
    const r = simularEncaixeRota(rotaIda(), veiculo(5), aluno({ escolaId: 'outra-escola' }), matriz(temposIda), { horarioEscolaMin: 420 });
    expect(r.elegivel).toBe(false);
    expect(r.escolaNoItinerario).toBe(false);
    expect(r.codigos).toContain('escola_itinerario');
  });

  it('14: endereço do novo aluno sem coordenadas', () => {
    const semCoord = { ...casaNova, lat: NaN as unknown as number };
    const r = simularEncaixeRota(rotaIda(), veiculo(5), aluno({ casa: semCoord }), matriz(temposIda), { horarioEscolaMin: 420 });
    expect(r.elegivel).toBe(false);
    expect(r.codigos).toContain('localizacao');
  });

  it('14b: parada da rota sem coordenadas', () => {
    const r = rotaIda();
    r.paradas[1] = { ...r.paradas[1], lat: undefined, lng: undefined };
    const res = simularEncaixeRota(r, veiculo(5), aluno(), matriz(temposIda), { horarioEscolaMin: 420 });
    expect(res.elegivel).toBe(false);
    expect(res.codigos).toContain('localizacao');
  });

  it('16+20: trecho rodoviário ausente na rota-base', () => {
    const r = simularEncaixeRota(rotaIda(), veiculo(5), aluno(), matriz({ ...temposIda, 's>a': null }), { horarioEscolaMin: 420 });
    expect(r.elegivel).toBe(false);
    expect(r.codigos).toContain('trecho');
  });

  it('17: aluno duplicado', () => {
    const r = simularEncaixeRota(rotaIda(), veiculo(5), aluno({ alunoId: 'ana' }), matriz(temposIda), { horarioEscolaMin: 420 });
    expect(r.elegivel).toBe(false);
    expect(r.codigos).toContain('aluno_duplicado');
  });

  it('20b: rota-base acima da capacidade é tratada como inconsistente', () => {
    const r = simularEncaixeRota(rotaIda(), veiculo(1), aluno(), matriz(temposIda), { horarioEscolaMin: 420 });
    expect(r.elegivel).toBe(false);
    expect(r.codigos.some((c) => c === 'capacidade' || c === 'rota_base')).toBe(true);
  });

  it('21: a simulação não altera a rota de origem (sem persistência)', () => {
    const r = rotaIda();
    const antesPax = r.passageiros.length;
    const antesParadas = r.paradas.length;
    simularEncaixeRota(r, veiculo(5), aluno(), matriz(temposIda), { horarioEscolaMin: 420 });
    expect(r.passageiros.length).toBe(antesPax);
    expect(r.paradas.length).toBe(antesParadas);
  });

  it('25: recalcular após mudar o horário muda o resultado', () => {
    const cedo = simularEncaixeRota(rotaIda(), veiculo(5), aluno(), matriz(temposIda), { horarioEscolaMin: 420 });
    const maisCedo = simularEncaixeRota(rotaIda(), veiculo(5), aluno(), matriz(temposIda), { horarioEscolaMin: 405 });
    expect(cedo.partidaMin).not.toBe(maisCedo.partidaMin);
  });
});
