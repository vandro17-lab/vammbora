import { describe, it, expect } from 'vitest';
import type { ParadaRota, PassageiroRota, Rota, Veiculo } from '@/types/motorista';
import { encontrarEncaixesProgressivo, type MatrizViaria, type PontoGeo, type RotaOperacional } from '@/engine/encaixe-geografico';
import { simularEncaixeProgressivo, type AlunoNovo, type ResultadoSimulacao } from './rota-para-encaixe';
import { candidatasParaBusca, avaliarRotaReal } from './busca-rotas-reais';

/**
 * INCLUIR UM ALUNO = ENCONTRAR UMA NOVA PROGRAMAÇÃO VIÁVEL PARA A VIAGEM INTEIRA.
 *
 * Cenário (uma avenida; a posição é o minuto de viagem desde a saída):
 *
 *   saída(0) → P1(5) → P2(9) → P3(14) → ESCOLA A(20) → P4(26) → ESCOLA B(34)
 *              sobe 1   sobe 2   sobe 3   descem 1 e 2    sobe 4   descem 3 e 4
 *
 * Viagem atual, saindo às 06:00 (360), 1 min por embarque, 3 min por escola:
 *   P1 06:05 · P2 06:10 · P3 06:16 · A 06:23 (limite 06:35) · P4 06:32 · B 06:41 (limite 07:00)
 * Ocupação por trecho: 1 · 2 · 3 · (A) 1 · 2 · (B) 0.
 */
const X: Record<string, number> = { s: 0, c1: 5, c2: 9, c3: 14, 'esc-a': 20, c4: 26, 'esc-b': 34 };
/** Matriz de teste: minutos = distância em "quarteirões" (|dx| + |dy|), com fração. */
const MATRIZ: MatrizViaria = {
  origem: 'fixture-testada',
  obter: (a, b) => {
    const min = Math.round((Math.abs(a.lng - b.lng) + Math.abs(a.lat - b.lat)) * 1000 * 100) / 100;
    return { minutos: min, metros: Math.round(min * 400) };
  },
};
const ponto = (id: string, x: number, y = 0): PontoGeo => ({ id, nome: id, lat: y / 1000, lng: x / 1000 });
const parada = (id: string, ordem: number, tipo: ParadaRota['tipo'], x: number, extra: Partial<ParadaRota> = {}): ParadaRota =>
  ({ id, ordem, tipo, rotulo: id, confirmado: true, lat: 0, lng: x / 1000, ...extra });
const pax = (id: string, casa: string, escolaParada: string, destinoId: string, extra: Partial<PassageiroRota> = {}): PassageiroRota =>
  ({ id, identificacao: id, embarqueParadaId: casa, desembarqueParadaId: escolaParada, destinoId, atendimentoMin: 1, atendimentoOrigem: 'informado', ...extra });

function rota(over: Partial<Rota> = {}, alunos: Partial<Record<'p1' | 'p2' | 'p3' | 'p4', Partial<PassageiroRota>>> = {}, escolas: { a?: Partial<ParadaRota>; b?: Partial<ParadaRota> } = {}): Rota {
  return {
    id: 'rota', nome: 'Manhã', sentido: 'ida', turno: 'manha', periodoConfirmado: true, dias: ['seg', 'ter', 'qua', 'qui', 'sex'], veiculoId: 'van',
    monitor: false, monitorOcupaLugar: false, lugaresReservados: 0, status: 'concluida', atualizadoEm: '',
    saidaHabitualMin: 360, limiteAntecipacaoMin: 0, ultimoDesembarqueMin: 420, disponibilidadeRevisada: true, escolasDisponiveis: [],
    paradas: [
      parada('s', 0, 'saida', X.s), parada('c1', 1, 'casa', X.c1), parada('c2', 2, 'casa', X.c2), parada('c3', 3, 'casa', X.c3),
      parada('eA', 4, 'escola', X['esc-a'], { destinoId: 'esc-a', destinoNome: 'Escola A', limiteChegadaMin: 395, atendimentoGrupoMin: 3, ...escolas.a }),
      parada('c4', 5, 'casa', X.c4),
      parada('eB', 6, 'escola', X['esc-b'], { destinoId: 'esc-b', destinoNome: 'Escola B', limiteChegadaMin: 420, atendimentoGrupoMin: 3, ...escolas.b }),
    ],
    passageiros: [
      pax('p1', 'c1', 'eA', 'esc-a', alunos.p1), pax('p2', 'c2', 'eA', 'esc-a', alunos.p2),
      pax('p3', 'c3', 'eB', 'esc-b', alunos.p3), pax('p4', 'c4', 'eB', 'esc-b', alunos.p4),
    ],
    ...over,
  };
}
const van = (lugares: number): Veiculo => ({ id: 'van', modelo: 'Van', lugaresPassageiro: lugares, arCondicionado: false, acessivel: false, cintos: true, fotos: [] });
const novo = (x: number, escolaId: string, y = 0, escolaX?: number): AlunoNovo => ({
  alunoId: 'novo', nome: 'Novo', casa: ponto('casa-nova', x, y), escolaId,
  ...(escolaX != null ? { escolaPonto: ponto(escolaId, escolaX) } : {}),
});
/** Simula com o limite da própria escola como âncora (padrão) e 1 min de embarque. */
const simular = (r: Rota, v: Veiculo | null, a: AlunoNovo, horarioEscolaMin: number, matriz = MATRIZ): ResultadoSimulacao =>
  simularEncaixeProgressivo(r, v, a, matriz, { horarioEscolaMin, atendimentoMin: 1 });
const chegada = (r: ResultadoSimulacao, id: string) => r.opcao!.eventos.find((e) => e.compromisso.id === id)!.chegadaMin;
const indice = (r: ResultadoSimulacao, id: string) => r.opcao!.eventos.findIndex((e) => e.compromisso.id === id);
const linha = (r: ResultadoSimulacao, nome: string) => r.trechos!.find((t) => t.nome === nome)!;

describe('viagem atual (base) recalculada trecho por trecho', () => {
  it('usa a saída habitual CADASTRADA e reproduz horários, atendimentos e ocupação', () => {
    const r = simular(rota(), van(5), novo(23, 'esc-b'), 420);
    expect(r.fontePartida).toBe('cadastrada');
    expect(r.partidaMin).toBe(360);
    const base = Object.fromEntries(r.base!.eventos.map((e) => [e.compromisso.id, [e.deslocamentoMin, e.chegadaMin, e.saidaMin, e.ocupacaoApos]]));
    expect(base['emb:p1']).toEqual([5, 365, 366, 1]);
    expect(base['emb:p2']).toEqual([4, 370, 371, 2]);
    expect(base['emb:p3']).toEqual([5, 376, 377, 3]);
    // Na escola: quem desce não soma tempo; o atendimento é do GRUPO, uma vez.
    expect(base['des:p1']).toEqual([6, 383, 383, 2]);
    expect(base['des:p2']).toEqual([0, 383, 383, 1]);
    expect(base['escola:eA']).toEqual([0, 383, 386, 1]);
    expect(base['emb:p4']).toEqual([6, 392, 393, 2]);
    expect(base['escola:eB']).toEqual([0, 401, 404, 0]);
  });

  it('cadastro antigo, sem saída habitual: a saída é calculada de trás para frente (e isso fica indicado)', () => {
    const r = simular(rota({ saidaHabitualMin: null }), van(5), novo(23, 'esc-b'), 420);
    expect(r.fontePartida).toBe('calculada');
    expect(r.elegivel).toBe(true);
  });
});

describe('vaga depois de um desembarque (capacidade por trecho)', () => {
  it('van de 3 lugares lotada até a escola A: aluno da escola B embarca DEPOIS de A, sem antecipar', () => {
    const r = simular(rota(), van(3), novo(23, 'esc-b'), 420);
    expect(r.situacao).toBe('viavel');
    expect(r.classe).toBe('imediato');
    expect(r.antecipacaoMin).toBe(0);
    // Embarca depois da visita à escola A, com 1 aluno (o 3) a bordo no trecho.
    expect(indice(r, 'novo:embarque:novo')).toBeGreaterThan(indice(r, 'escola:eA'));
    expect(linha(r, 'Novo aluno')).toMatchObject({ deslocamentoMin: 3, ocupacaoNoTrecho: 1, chegadaMin: 389, esperaMin: 0, atendimentoMin: 1, saidaMin: 390, ocupacaoApos: 2 });
    // Nunca mais gente do que lugares, em nenhum trecho.
    expect(Math.max(...r.trechos!.map((t) => t.ocupacaoApos))).toBe(3);
    // Impacto nos compromissos seguintes: aluno 4 e escola B ficam 1 min depois; antes dele, nada muda.
    expect(linha(r, 'p4').diferencaMin).toBe(1);
    expect(linha(r, 'Escola B')).toMatchObject({ chegadaMin: 402, diferencaMin: 1 });
    expect(r.trechos!.filter((t) => t.tipo === 'embarque' && ['p1', 'p2', 'p3'].includes(t.nome)).every((t) => t.diferencaMin === 0)).toBe(true);
    expect(r.opcao!.desvioMin).toBe(1);
  });

  it('aluno da escola A precisaria do trecho lotado: só cabe mudando a viagem — depende de aprovação', () => {
    // A única saída é passar na escola A antes de buscar o aluno 3 e sair mais cedo.
    const r = simular(rota(), van(3), novo(7, 'esc-a'), 395);
    expect(r.elegivel).toBe(true);
    expect(r.situacao).toBe('aprovacao');
    expect(r.antecipacaoMin).toBeGreaterThan(0);
    expect(r.aprovacoes.length).toBeGreaterThan(0);
    // Mesmo assim: nunca mais de 3 a bordo, limites das duas escolas cumpridos, viagem termina em B.
    expect(Math.max(...r.trechos!.map((t) => t.ocupacaoApos))).toBeLessThanOrEqual(3);
    expect(chegada(r, 'escola:eA')).toBeLessThanOrEqual(395);
    expect(r.opcao!.eventos.at(-1)!.compromisso.id).toBe('escola:eB');
    expect(chegada(r, 'escola:eB')).toBeLessThanOrEqual(420);
  });

  it('com o aluno 1 de horário fixo e no máximo 15 min de antecipação, nem mudando a viagem cabe: incompatibilidade COMPROVADA', () => {
    const r = simularEncaixeProgressivo(rota({}, { p1: { horarioHabitualMin: 365, ajusteAntesMin: 0, ajusteDepoisMin: 0 } }), van(3), novo(7, 'esc-a'), MATRIZ,
      { horarioEscolaMin: 395, atendimentoMin: 1, antecipacaoMaxMin: 15 });
    expect(r.elegivel).toBe(false);
    expect(r.situacao).toBe('incompativel');
    expect(r.codigos).toContain('capacidade');
    expect(r.codigos).not.toContain('busca_incompleta'); // todas as posições e ordens foram calculadas
  });

  it('com um lugar a mais, o aluno da escola A cabe no começo da viagem', () => {
    const r = simular(rota(), van(4), novo(7, 'esc-a'), 395);
    expect(r.situacao).toBe('viavel');
    expect(indice(r, 'novo:embarque:novo')).toBeLessThan(indice(r, 'emb:p2'));
    expect(indice(r, 'novo:desembarque:novo')).toBeLessThan(indice(r, 'escola:eA') + 1);
  });

  it('monitor e lugares reservados contam: van de 4 com 1 reservado volta a não caber; capacidade zero é zero', () => {
    const p1Fixo = { p1: { horarioHabitualMin: 365, ajusteAntesMin: 0, ajusteDepoisMin: 0 } };
    const sim = (r: Rota) => simularEncaixeProgressivo(r, van(4), novo(7, 'esc-a'), MATRIZ, { horarioEscolaMin: 395, atendimentoMin: 1, antecipacaoMaxMin: 15 });
    expect(sim(rota({}, p1Fixo)).situacao).toBe('viavel');
    expect(sim(rota({ lugaresReservados: 1 }, p1Fixo)).situacao).toBe('incompativel');
    expect(sim(rota({ monitor: true, monitorOcupaLugar: true }, p1Fixo)).situacao).toBe('incompativel');
    const zero = simular(rota({ monitor: true, monitorOcupaLugar: true, passageiros: [] }), van(1), novo(23, 'esc-b'), 420);
    expect(zero).toMatchObject({ elegivel: false, situacao: 'incompativel', codigos: ['capacidade'] });
    // Sem van cadastrada não se inventa lugar: inconclusivo.
    expect(simular(rota(), null, novo(23, 'esc-b'), 420)).toMatchObject({ situacao: 'inconclusivo', codigos: ['van'] });
  });
});

describe('janelas individuais: o horário combinado não é deslocado em silêncio', () => {
  const fixos = { p1: { horarioHabitualMin: 365, ajusteAntesMin: 0, ajusteDepoisMin: 0 }, p2: { horarioHabitualMin: 370, ajusteAntesMin: 0, ajusteDepoisMin: 0 }, p3: { horarioHabitualMin: 376, ajusteAntesMin: 0, ajusteDepoisMin: 0 } };

  it('horário FIXO: 1 min de embarque a mais no começo exige sair 1 min antes — e isso depende de aprovação', () => {
    const r = simular(rota({ limiteAntecipacaoMin: 0 }, fixos), van(5), novo(2, 'esc-a'), 395);
    expect(r.elegivel).toBe(true);
    expect(r.situacao).toBe('aprovacao');
    expect(r.antecipacaoMin).toBe(1);
    expect(r.opcao!.partidaMin).toBe(359);
    expect(r.aprovacoes.join(' ')).toMatch(/Sair 1 min antes do habitual \(nenhuma antecipação foi autorizada/);
    // Os três alunos de horário fixo continuam exatamente no horário combinado.
    for (const [id, h] of [['emb:p1', 365], ['emb:p2', 370], ['emb:p3', 376]] as const) expect(chegada(r, id)).toBe(h);
    expect(r.trechos!.filter((t) => ['p1', 'p2', 'p3'].includes(t.nome)).every((t) => t.diferencaMin === 0)).toBe(true);
  });

  it('a mesma antecipação, quando o motorista autorizou 5 min, é viável sem pedir nada', () => {
    const r = simular(rota({ limiteAntecipacaoMin: 5 }, fixos), van(5), novo(2, 'esc-a'), 395);
    expect(r).toMatchObject({ situacao: 'viavel', classe: 'pre_autorizado', antecipacaoMin: 1, aprovacoes: [] });
  });

  it('antecipação não informada no cadastro: nada é presumido — depende de aprovação', () => {
    const r = simular(rota({ limiteAntecipacaoMin: null }, fixos), van(5), novo(2, 'esc-a'), 395);
    expect(r.situacao).toBe('aprovacao');
  });

  it('flexibilidade ASSIMÉTRICA: "pode ser até 3 min depois" aceita o atraso; "só antes" não aceita', () => {
    // Aluno 1 pode atrasar até 3 min (nunca adiantar): o novo embarca antes dele, sem antecipar.
    const depois = simular(rota({}, { p1: { horarioHabitualMin: 365, ajusteAntesMin: 0, ajusteDepoisMin: 3 } }), van(5), novo(2, 'esc-a'), 395);
    expect(depois.situacao).toBe('viavel');
    expect(depois.antecipacaoMin).toBe(0);
    expect(chegada(depois, 'emb:p1')).toBe(366);
    expect(linha(depois, 'p1').diferencaMin).toBe(1);
    // Aluno 1 só pode ADIANTAR (até 3 min), nunca atrasar: em nenhuma opção ele é atendido depois das 06:05.
    const antes = simular(rota({}, { p1: { horarioHabitualMin: 365, ajusteAntesMin: 3, ajusteDepoisMin: 0 } }), van(5), novo(2, 'esc-a'), 395);
    expect(antes.elegivel).toBe(true);
    expect(chegada(antes, 'emb:p1')).toBeLessThanOrEqual(365);
    expect(linha(antes, 'p1').diferencaMin).toBeLessThanOrEqual(0);
  });

  it('rota cuja saída cadastrada não cumpre o próprio combinado fica inconclusiva (precisa de revisão), nunca "não cabe"', () => {
    const r = simular(rota({}, { p1: { horarioHabitualMin: 362, ajusteAntesMin: 0, ajusteDepoisMin: 0 } }), van(5), novo(23, 'esc-b'), 420);
    expect(r).toMatchObject({ elegivel: false, situacao: 'inconclusivo' });
    expect(r.codigos[0]).toBe('rota_base');
  });
});

describe('antecipação realmente necessária (folgas e esperas)', () => {
  // Casa fora da avenida: saída→casa 6 min, casa→P1 8 min (em vez de 5): desvio de 9 + 1 de embarque = 10 min.
  const desvio10 = novo(1.5, 'esc-a', 4.5);
  const p1Fixo = { p1: { horarioHabitualMin: 365, ajusteAntesMin: 0, ajusteDepoisMin: 0 } };
  const apertada = { b: { limiteChegadaMin: 406 } }; // escola B sem folga além da margem

  it('desvio de 10 min com a van saindo 5 min mais cedo do que precisa: a espera absorve 5 — antecipa 5, não 10', () => {
    // Saída habitual 05:55: a van chega ao aluno 1 às 06:00 e ESPERA até 06:05 (horário fixo).
    const r = simular(rota({ saidaHabitualMin: 355, limiteAntecipacaoMin: 10 }, p1Fixo, apertada), van(5), desvio10, 395);
    expect(r.base!.eventos.find((e) => e.compromisso.id === 'emb:p1')).toMatchObject({ chegadaMin: 360, esperaMin: 5, saidaMin: 366 });
    expect(r.elegivel).toBe(true);
    expect(r.opcao!.acrescimoMin).toBe(10); // percurso + atendimento a mais
    expect(r.opcao!.desvioMin).toBe(5); // a viagem só fica 5 min mais longa: os outros 5 eram espera
    expect(r.antecipacaoNecessariaMin).toBe(5);
    expect(r.antecipacaoMin).toBe(5);
    expect(r.opcao!.partidaMin).toBe(350);
    expect(r.situacao).toBe('viavel'); // 5 ≤ 10 autorizados
    // Depois de recalcular, a espera some e o aluno 1 é atendido no horário combinado.
    expect(linha(r, 'p1')).toMatchObject({ chegadaMin: 365, esperaMin: 0, diferencaMin: 5 });
    expect(r.explicacao!.join(' ')).toMatch(/5 min antes do habitual — a necessidade calculada é de 5 min, não os 10 min que a inclusão acrescenta/);
  });

  it('o mesmo desvio com a saída "justa" (06:00) exige os 10 min — acima do autorizado, depende de aprovação', () => {
    const r = simular(rota({ saidaHabitualMin: 360, limiteAntecipacaoMin: 5 }, p1Fixo, apertada), van(5), desvio10, 395);
    expect(r.antecipacaoMin).toBe(10);
    expect(r.situacao).toBe('aprovacao');
    expect(r.aprovacoes.join(' ')).toMatch(/Sair 10 min antes do habitual \(o motorista autorizou até 5 min\)/);
  });

  it('folga na escola também conta: sem horários fixos, 1 min a mais não exige antecipar nada', () => {
    const r = simular(rota(), van(5), novo(2, 'esc-a'), 395);
    expect(r).toMatchObject({ situacao: 'viavel', antecipacaoMin: 0, antecipacaoNecessariaMin: 0 });
    expect(r.explicacao!.join(' ')).toMatch(/partida habitual é mantida: as folgas e esperas da rota absorvem/);
  });
});

describe('limites de TODAS as escolas e ponto final', () => {
  it('quem manda é o limite da escola INTERMEDIÁRIA: sem folga em A, embarcar antes dela exige antecipar', () => {
    // Escola A com limite 06:28 (chegada atual 06:23 = só a margem de 5). A escola B tem 19 min de folga.
    const justaEmA = rota({ limiteAntecipacaoMin: 3 }, {}, { a: { limiteChegadaMin: 388 } });
    const r = simular(justaEmA, van(5), novo(7, 'esc-b'), 420);
    expect(r.elegivel).toBe(true);
    expect(indice(r, 'novo:embarque:novo')).toBeLessThan(indice(r, 'escola:eA'));
    expect(r.antecipacaoMin).toBe(1);
    expect(chegada(r, 'escola:eA')).toBe(383); // a escola A continua sendo atendida no mesmo horário
    // Com folga em A (limite 06:35), o mesmo aluno entra sem antecipar.
    expect(simular(rota(), van(5), novo(7, 'esc-b'), 420).antecipacaoMin).toBe(0);
  });

  it('ponto final obrigatório: a viagem continua terminando na escola B, dentro do limite dela', () => {
    const r = simular(rota(), van(5), novo(23, 'esc-b'), 420);
    const ultimo = r.opcao!.eventos.at(-1)!;
    expect(ultimo.compromisso.id).toBe('escola:eB');
    expect(ultimo.chegadaMin).toBeLessThanOrEqual(420);
  });

  it('escola aceita que ficaria DEPOIS do ponto final não entra depois dele; se não cabe antes, é incompatível', () => {
    const aceitaE = { escolasDisponiveis: [{ id: 'd', destinoId: 'esc-e', dias: null }] };
    // Com folga em B, a escola nova é visitada ANTES do ponto final (ida e volta até ela): B continua por último.
    const comFolga = simular(rota(aceitaE), van(5), novo(23, 'esc-e', 0, 40), 430);
    expect(comFolga.elegivel).toBe(true);
    expect(indice(comFolga, 'novo:desembarque:novo')).toBeLessThan(indice(comFolga, 'des:p3'));
    expect(comFolga.opcao!.eventos.at(-1)!.compromisso.id).toBe('escola:eB');
    expect(chegada(comFolga, 'escola:eB')).toBeLessThanOrEqual(415); // limite 07:00 menos a margem
    // Sem folga em B (limite 06:50), não há como ir e voltar: incompatível — e nunca "depois de B".
    const r = simular(rota(aceitaE, {}, { b: { limiteChegadaMin: 410 } }), van(5), novo(23, 'esc-e', 0, 40), 430);
    expect(r.elegivel).toBe(false);
    expect(r.situacao).toBe('incompativel');
  });
});

describe('escola aceita, mas ainda não visitada: casa e escola avaliadas juntas', () => {
  const aceitaC = { escolasDisponiveis: [{ id: 'd', destinoId: 'esc-c', dias: null, limiteChegadaMin: 415, atendimentoGrupoMin: 2 }], disponibilidadeRevisada: true };

  it('entra como parada nova, com o tempo do grupo informado, sem depender de aprovação', () => {
    const r = simular(rota(aceitaC), van(5), novo(23, 'esc-c', 0, 30), 420);
    expect(r).toMatchObject({ situacao: 'viavel', escolaInserida: true, escolaNoItinerario: false, antecipacaoMin: 0 });
    const escolaNova = r.opcao!.eventos.find((e) => e.compromisso.id === 'novo:desembarque:novo')!;
    expect(escolaNova.compromisso.ponto.id).toBe('esc-c');
    expect(escolaNova.saidaMin - escolaNova.chegadaMin).toBe(2); // atendimento do grupo, uma vez
    expect(escolaNova.chegadaMin).toBeLessThanOrEqual(415); // limite informado pelo motorista
    // 1 min de embarque + 2 min na escola nova: a escola B fica 3 min depois, ainda no limite.
    expect(linha(r, 'Escola B')).toMatchObject({ chegadaMin: 404, diferencaMin: 3 });
    expect(r.opcao!.eventos.at(-1)!.compromisso.id).toBe('escola:eB');
  });

  it('a autorização permite AVALIAR, mas não garante: limite do aluno impossível = incompatível', () => {
    // Chegar às 04:50 exigiria sair mais de 1 h antes do habitual: fora de qualquer ajuste.
    const r = simular(rota(aceitaC), van(5), novo(23, 'esc-c', 0, 30), 290);
    expect(r).toMatchObject({ elegivel: false, situacao: 'incompativel' });
    // Limite apertado, mas alcançável saindo bem mais cedo: só com aprovação — nunca "garantido".
    const cedo = simular(rota(aceitaC), van(5), novo(23, 'esc-c', 0, 30), 380);
    expect(cedo.situacao).toBe('aprovacao');
    expect(cedo.antecipacaoMin).toBeGreaterThan(30);
  });

  it('lista revisada sem a escola: o motorista não aceita — nem é avaliada', () => {
    const r = simular(rota(), van(5), novo(23, 'esc-c', 0, 30), 420);
    expect(r).toMatchObject({ elegivel: false, situacao: 'incompativel', codigos: ['escola_nao_aceita'] });
    const pedido = { origem: { lat: 0, lng: 0.023 }, destinoId: 'esc-c', escolaPonto: { lat: 0, lng: 0.03 }, sentido: 'ida' as const };
    expect(candidatasParaBusca([{ rota: rota(), veiculo: van(5) }], pedido)).toHaveLength(0);
    expect(candidatasParaBusca([{ rota: rota(aceitaC), veiculo: van(5) }], pedido)).toHaveLength(1);
  });

  it('cadastro antigo (lista nunca revisada): avalia, mas incluir a escola depende de aprovação', () => {
    const r = simular(rota({ disponibilidadeRevisada: false, escolasDisponiveis: [] }), van(5), novo(23, 'esc-c', 0, 30), 420);
    expect(r.elegivel).toBe(true);
    expect(r.situacao).toBe('aprovacao');
    expect(r.aprovacoes.join(' ')).toMatch(/escola que o motorista ainda não informou se aceita/);
    // Na busca das famílias isso aparece como "sob confirmação", nunca como vaga garantida.
    const busca = avaliarRotaReal(rota({ disponibilidadeRevisada: false, escolasDisponiveis: [] }), van(5),
      { origem: { lat: 0, lng: 0.023 }, destinoId: 'esc-c', escolaPonto: { lat: 0, lng: 0.03 }, sentido: 'ida', horarioEscolaMin: 420 }, MATRIZ);
    expect(busca.status).toBe('sob_confirmacao');
  });
});

describe('precisão: trecho curto não vira 1 minuto; mesma coordenada = 0 de deslocamento', () => {
  it('novo aluno na MESMA casa do aluno 2: deslocamento 0, mas o atendimento (30 s) soma', () => {
    const r = simularEncaixeProgressivo(rota(), van(5), novo(9, 'esc-a'), MATRIZ, { horarioEscolaMin: 395, atendimentoMin: 0.5 });
    expect(r.situacao).toBe('viavel');
    expect(linha(r, 'Novo aluno')).toMatchObject({ atendimentoMin: 0.5 });
    // Entre o aluno 2 e o novo (mesmo ponto) não há deslocamento, em qualquer ordem.
    const iNovo = indice(r, 'novo:embarque:novo'), i2 = indice(r, 'emb:p2');
    expect(r.opcao!.eventos[Math.max(iNovo, i2)].deslocamentoMin).toBe(0);
    expect(r.opcao!.desvioMin).toBe(0.5);
    expect(linha(r, 'p3').diferencaMin).toBe(0.5);
  });

  it('desvio de 0,4 min (24 s) é somado como 0,4 — não arredondado para 1', () => {
    const r = simularEncaixeProgressivo(rota(), van(5), novo(23, 'esc-b', 0.2), MATRIZ, { horarioEscolaMin: 420, atendimentoMin: 0.5 });
    expect(r.opcao!.desvioMin).toBeCloseTo(0.9, 5); // 0,2 de ida + 0,2 de volta + 0,5 de embarque
    expect(linha(r, 'Escola B').chegadaMin).toBeCloseTo(401.9, 5);
  });
});

describe('inconclusivo não é impossível', () => {
  it('falta o tempo de um trecho até a casa nova: inconclusivo', () => {
    const semTrecho: MatrizViaria = { origem: 'fixture-testada', obter: (a, b, t) => (a.id === 'casa-nova' || b.id === 'casa-nova' ? null : MATRIZ.obter(a, b, t)) };
    const r = simular(rota(), van(5), novo(23, 'esc-b'), 420, semTrecho);
    expect(r).toMatchObject({ elegivel: false, situacao: 'inconclusivo' });
    expect(r.codigos).toContain('trecho');
  });

  it('limite computacional atingido na reorganização: inconclusivo, com o motivo explícito', () => {
    // Mesmo caso comprovadamente incompatível acima, mas sem orçamento para testar as outras ordens.
    const P = (id: string) => ponto(id, X[id]);
    const rotaOp: RotaOperacional = {
      id: 'r', versao: 1, sentido: 'ida', inicio: P('s'), partidaMin: 360, capacidade: 3, ocupacaoInicial: 0, pontoFinalId: 'esc-b',
      compromissos: [
        { id: 'e1', ponto: P('c1'), tipo: 'embarque', alunoId: '1', atendimentoMin: 1 }, { id: 'e2', ponto: P('c2'), tipo: 'embarque', alunoId: '2', atendimentoMin: 1 },
        { id: 'e3', ponto: P('c3'), tipo: 'embarque', alunoId: '3', atendimentoMin: 1 },
        { id: 'd1', ponto: P('esc-a'), tipo: 'desembarque', alunoId: '1', atendimentoMin: 0 }, { id: 'd2', ponto: P('esc-a'), tipo: 'desembarque', alunoId: '2', atendimentoMin: 0 },
        { id: 'A', ponto: P('esc-a'), tipo: 'escola', atendimentoMin: 3, limiteEscolaMin: 395 },
        { id: 'e4', ponto: P('c4'), tipo: 'embarque', alunoId: '4', atendimentoMin: 1 },
        { id: 'd3', ponto: P('esc-b'), tipo: 'desembarque', alunoId: '3', atendimentoMin: 0 }, { id: 'd4', ponto: P('esc-b'), tipo: 'desembarque', alunoId: '4', atendimentoMin: 0 },
        { id: 'B', ponto: P('esc-b'), tipo: 'escola', atendimentoMin: 3, limiteEscolaMin: 420 },
      ],
    };
    const pedido = { alunoId: 'n', casa: ponto('n', 7), escola: P('esc-a'), horarioEscolaMin: 395, atendimentoMin: 1 };
    const completo = encontrarEncaixesProgressivo(rotaOp, pedido, MATRIZ);
    expect(completo).toMatchObject({ situacao: 'incompativel', limiteAtingido: false });
    const cortado = encontrarEncaixesProgressivo(rotaOp, pedido, MATRIZ, { maxOrdensReorganizacao: 3 });
    expect(cortado).toMatchObject({ situacao: 'inconclusivo', classificacao: 'indeterminado', limiteAtingido: true });
  });
});

describe('reorganizar paradas: só com aprovação, preservando precedência e destino final', () => {
  it('rota com 13 compromissos (3 paradas): inverter duas casas abre espaço no horário — depende de aprovação', () => {
    // saída(0) → Q1(12) → Q2(4) → ESCOLA S(20): a ordem atual volta para trás.
    const P = (id: string, x: number) => ponto(id, x);
    const emb = (id: string, casa: PontoGeo) => ({ id: 'e' + id, ponto: casa, tipo: 'embarque' as const, alunoId: id, atendimentoMin: 0.25 });
    const des = (id: string) => ({ id: 'd' + id, ponto: P('S', 20), tipo: 'desembarque' as const, alunoId: id, atendimentoMin: 0 });
    const q1 = ['a', 'b', 'c', 'd'], q2 = ['e', 'f'];
    const rotaOp: RotaOperacional = {
      id: 'r', versao: 1, sentido: 'ida', inicio: P('G', 0), partidaMin: 360, capacidade: 8, ocupacaoInicial: 0, pontoFinalId: 'S', toleranciaMin: 10,
      compromissos: [...q1.map((i) => emb(i, P('Q1', 12))), ...q2.map((i) => emb(i, P('Q2', 4))), ...[...q1, ...q2].map(des),
        { id: 'S', ponto: P('S', 20), tipo: 'escola', atendimentoMin: 2, limiteEscolaMin: 398 }],
    };
    // Atual: Q1 06:12 · Q2 06:21 · S 06:37,5 (limite 06:38). Um embarque de 2 min não cabe sem mexer em nada.
    const pedido = { alunoId: 'n', casa: P('N', 2), escola: P('S', 20), horarioEscolaMin: 398, atendimentoMin: 2 };
    const r = encontrarEncaixesProgressivo(rotaOp, pedido, MATRIZ);
    expect(r.estrategia).toBe('reorganizacao');
    expect(r.situacao).toBe('aprovacao');
    const o = r.opcoes[0];
    expect(o.ordemAlterada).toBe(true);
    expect(o.aprovacoes).toContain('Mudar a ordem das paradas atuais.');
    // Destino final preservado e ninguém desce antes de embarcar.
    expect(o.eventos.at(-1)!.compromisso.id).toBe('S');
    const pos = new Map(o.eventos.map((e, i) => [e.compromisso.id, i]));
    for (const i of [...q1, ...q2]) expect(pos.get('e' + i)!).toBeLessThan(pos.get('d' + i)!);
    expect(o.eventos.at(-1)!.chegadaMin).toBeLessThanOrEqual(398);
    // Os alunos atuais ficam dentro da tolerância em torno do horário de hoje.
    expect(Math.max(...o.alteracoes.map((a) => Math.abs(a.diferencaMin)))).toBeLessThanOrEqual(10);
  });
});




describe('volta: a van espera a liberação dos alunos', () => {
  // saída(0) 11:55 → ESCOLA V(5), liberação 12:05, 2 min para o grupo → casa do aluno 1 (10).
  const volta = (p1: Partial<PassageiroRota> = {}, over: Partial<Rota> = {}): Rota => ({
    id: 'volta', nome: 'Volta', sentido: 'volta', turno: 'manha', periodoConfirmado: true, dias: ['seg'], veiculoId: 'van',
    monitor: false, monitorOcupaLugar: false, lugaresReservados: 0, status: 'concluida', atualizadoEm: '',
    saidaHabitualMin: 715, limiteAntecipacaoMin: 0, ultimoDesembarqueMin: 745, disponibilidadeRevisada: true, escolasDisponiveis: [],
    paradas: [parada('s', 0, 'saida', 0), parada('eV', 1, 'escola', 5, { destinoId: 'esc-v', destinoNome: 'Escola V', liberacaoMin: 725, atendimentoGrupoMin: 2 }), parada('c1', 2, 'casa', 10)],
    passageiros: [{ id: 'p1', identificacao: 'p1', embarqueParadaId: 'eV', desembarqueParadaId: 'c1', destinoId: 'esc-v', atendimentoMin: 1, atendimentoOrigem: 'informado', ...p1 }],
    ...over,
  });
  const sim = (r: Rota, horarioAlunoMin: number) => simularEncaixeProgressivo(r, van(5), novo(8, 'esc-v'), MATRIZ, { horarioEscolaMin: 725, horarioAlunoMin, atendimentoMin: 1 });

  it('chegando 5 min antes da liberação, a van espera; o novo aluno embarca na escola e desce no caminho', () => {
    const r = sim(volta(), 725);
    expect(r.base!.eventos.find((e) => e.compromisso.id === 'escola:eV')).toMatchObject({ chegadaMin: 720, esperaMin: 5, saidaMin: 727 });
    expect(r.situacao).toBe('viavel');
    expect(linha(r, 'Escola V')).toMatchObject({ chegadaMin: 720, esperaMin: 5 });
    // Casa nova no caminho (8): 1 min de desembarque a mais para o aluno 1.
    expect(linha(r, 'Novo aluno')).toMatchObject({ tipo: 'desembarque', chegadaMin: 730, atendimentoMin: 1 });
    expect(linha(r, 'p1').diferencaMin === 0 || r.trechos!.some((t) => t.nome === 'p1' && t.tipo === 'desembarque' && t.diferencaMin === 1)).toBe(true);
    expect(r.opcao!.eventos.every((e) => e.chegadaMin <= 745)).toBe(true); // última entrega até 12:25
  });

  it('novo aluno liberado só às 12:10: a van espera por ele e o atraso recai sobre quem já está na rota', () => {
    const r = sim(volta(), 730);
    expect(r.elegivel).toBe(true);
    expect(r.opcao!.eventos.find((e) => e.compromisso.id === 'novo:embarque:novo')!.saidaMin).toBeGreaterThanOrEqual(730);
    expect(r.trechos!.find((t) => t.nome === 'p1' && t.tipo === 'desembarque')!.diferencaMin).toBeGreaterThanOrEqual(3);
    // Se a entrega do aluno 1 é de horário FIXO (12:12), esperar não cabe: incompatível (antecipar não ajuda).
    const fixo = sim(volta({ horarioHabitualMin: 732, ajusteAntesMin: 0, ajusteDepoisMin: 0 }), 730);
    expect(fixo).toMatchObject({ elegivel: false, situacao: 'incompativel' });
  });

  it('limite do ponto final ("última entrega até"): desvio que estoura o limite não é aceito', () => {
    // Casa nova longe (y = 9): a última entrega passaria das 12:17.
    const longe = simularEncaixeProgressivo(volta({}, { ultimoDesembarqueMin: 737 }), van(5), novo(8, 'esc-v', 9), MATRIZ, { horarioEscolaMin: 725, horarioAlunoMin: 725, atendimentoMin: 1 });
    expect(longe).toMatchObject({ elegivel: false, situacao: 'incompativel' });
    expect(longe.codigos).toContain('atraso');
  });
});
