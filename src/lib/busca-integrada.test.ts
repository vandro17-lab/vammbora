import { describe, it, expect } from 'vitest';
import {
  ancoraHorarioEscola, avaliarRotaDetalhada, avaliarRotaReal, avaliarRotaSegura, buscarEmRotasReais, candidatasParaBusca,
  origemDaEscola, pontosDoPedido, PROX_ESCOLA_M, type PedidoFamilia,
} from '@/lib/busca-rotas-reais';
import { criarMatrizDemo, haversineMetros, type MatrizViaria } from '@/lib/encaixe';
import { matrizDeTabelas } from '@/lib/matriz-viaria';
import { MatrizPorCoordenadas, pontosDistintos } from '@/lib/matriz-viaria-servidor';
import { escolasSimulaveis, seloDoResultado } from '@/lib/simulador-encaixe';
import { MARGEM_OPERACIONAL_MIN } from '@/lib/rota-para-encaixe';
import type { Rota } from '@/types/motorista';
import {
  HM, MATRIZ_SIMULADA, P, escolaAceita, pedido, pt, rotaIda, rotaVolta, tabelasSimuladas, van,
} from '@/lib/cidade-simulada.fixture';

/**
 * INTEGRAÇÃO DAS REGRAS DE ENCAIXE NA BUSCA DA FAMÍLIA E NO SIMULADOR.
 *
 * TESTES SIMULADOS: todos os tempos vêm da "cidade simulada" (malha fictícia,
 * 400 m/min, só horizontal/vertical — ver `cidade-simulada.fixture.ts`). Eles
 * provam as REGRAS com números conferíveis à mão; NÃO usam ruas reais.
 *
 * Referência (ida): garagem → casa 1 → casa 2 → escola, limite 7h00.
 * Sai 6h36 · casa 1 6h41 · casa 2 6h48 · escola 6h55. Van de 6 lugares, 2 alunos.
 */

const avaliar = (rota: Rota, p: PedidoFamilia, lugares = 6, m: MatrizViaria = MATRIZ_SIMULADA) => avaliarRotaDetalhada(rota, van(lugares), p, m);

describe('[simulado] onde a família mora em relação à rota', () => {
  it('MESMA COORDENADA de uma parada atual: nenhum percurso a mais, só o atendimento', () => {
    const { publico: r, simulacao } = avaliar(rotaIda(), pedido(P.casa1));
    expect(r.status).toBe('compativel');
    expect(r.passagemCasaMin).toBe(HM(6, 41));
    expect(r.horarioEscolaMin).toBe(HM(6, 55));
    // 2 min de atendimento do novo aluno, absorvidos saindo 2 min antes (autorizado: até 10).
    expect(r.desvioMin).toBe(2);
    expect(r.antecipacaoMin).toBe(2);
    expect(r.classe).toBe('pre_autorizado');
    expect(simulacao!.opcao!.desvioMetros).toBe(0);
  });

  it('MESMA RUA, entre duas paradas: o percurso não cresce (a casa fica no caminho)', () => {
    const { publico: r, simulacao } = avaliar(rotaIda(), pedido(pt(3000, 0)));
    expect(r.status).toBe('compativel');
    expect(simulacao!.opcao!.desvioMetros).toBe(0);
    expect(r.desvioMin).toBe(2);
    expect(r.passagemCasaMin).toBe(HM(6, 43) + 0.5); // 6h41 + 2 min atendendo a casa 1 + 2,5 min de rua, saindo 2 min antes
    expect(r.horarioEscolaMin).toBe(HM(6, 55));
  });

  it('PEQUENO DESVIO (400 m para fora do caminho): +800 m, +2 min de rua, +2 de atendimento', () => {
    const { publico: r, simulacao } = avaliar(rotaIda(), pedido(pt(3000, 400)));
    expect(r.status).toBe('compativel');
    expect(simulacao!.opcao!.desvioMetros).toBe(800);
    expect(r.desvioMin).toBe(4);
    expect(r.antecipacaoMin).toBe(4);
    // Quem já está na rota muda no máximo 4 min — dentro da flexibilidade cadastrada (10).
    expect(Math.max(...simulacao!.opcao!.alteracoes.map((a) => Math.abs(a.diferencaMin)))).toBeLessThanOrEqual(4);
  });

  it('desvio que excede o que o motorista autorizou: cabe só com aprovação — nunca "compatível"', () => {
    const { publico: r, simulacao } = avaliar(rotaIda(), pedido(pt(3000, 6000)));
    expect(r.status).toBe('sob_confirmacao');
    expect(simulacao!.aprovacoes.join(' ')).toContain('antes do habitual');
  });

  it('casa longe demais: INCOMPATÍVEL comprovado com a matriz; a MESMA conta por estimativa fica incompleta', () => {
    const longe = pedido(pt(3000, 30000));
    expect(avaliar(rotaIda(), longe).publico).toMatchObject({ status: 'incompativel', vagas: null });
    // Linha reta × fator não é percurso real: recusa por estimativa não é prova.
    const est = avaliar(rotaIda(), longe, 6, criarMatrizDemo()).publico;
    expect(est).toMatchObject({ status: 'indeterminado', pendencia: 'avaliacao_incompleta', temposEstimados: true });
    expect(est.codigos).toContain('sem_consulta_viaria');
    // E a estimativa nunca confirma nem recusa: no máximo "sob confirmação" (aqui, com a
    // rota sem horários individuais, ela "cabe" pela estimativa — e ainda assim não é confirmada).
    const livre = rotaIda({ saidaHabitualMin: null, passageiros: rotaIda().passageiros.map((x) => ({ ...x, horarioHabitualMin: null })) });
    expect(avaliar(livre, pedido(pt(3000, 0)), 6, criarMatrizDemo()).publico).toMatchObject({ status: 'sob_confirmacao', temposEstimados: true });
    expect(['compativel', 'incompativel']).not.toContain(avaliar(rotaIda(), pedido(pt(3000, 0)), 6, criarMatrizDemo()).publico.status);
  });
});

describe('[simulado] horário da família chega ao cálculo — chegada até 6h50 numa rota com limite 7h00', () => {
  const casa = pt(3000, 0);
  const ate650 = pedido(casa, { horarioFamiliaMin: HM(6, 50) });

  it('NÃO descarta a rota: calcula se dá para chegar até 6h50 antecipando a saída dentro do autorizado', () => {
    const { publico: r, simulacao } = avaliar(rotaIda(), ate650);
    expect(r.status).toBe('compativel');
    expect(r.horarioEscolaMin).toBe(HM(6, 50));
    expect(r.antecipacaoMin).toBe(7); // 5 min para chegar 6h50 em vez de 6h55 + 2 do atendimento
    expect(r.classe).toBe('pre_autorizado');
    // Sem prejudicar os atuais: todos dentro da flexibilidade cadastrada (10 min para antes).
    for (const a of simulacao!.opcao!.alteracoes) expect(Math.abs(a.diferencaMin)).toBeLessThanOrEqual(10);
  });

  it('a margem de segurança NÃO é aplicada duas vezes: 6h50 significa chegar até 6h50, não até 6h45', () => {
    const r = avaliar(rotaIda(), ate650).publico;
    expect(r.horarioEscolaMin).toBe(HM(6, 50));
    expect(r.horarioEscolaMin!).toBeGreaterThan(HM(6, 50) - MARGEM_OPERACIONAL_MIN);
    // Sem horário da família, vale o limite da ESCOLA com a margem da rota (7h00 − 5 = 6h55).
    expect(avaliar(rotaIda(), pedido(casa)).publico.horarioEscolaMin).toBe(HM(6, 55));
  });

  it('o horário da família é PRAZO, não preferência de horário: pedir "até 7h30" não atrasa ninguém nem muda a escola', () => {
    const r = avaliar(rotaIda(), pedido(casa, { horarioFamiliaMin: HM(7, 30) })).publico;
    expect(r).toMatchObject({ status: 'compativel', horarioEscolaMin: HM(6, 55), antecipacaoMin: 2 });
    // O horário da escola na rota continua sendo o do cadastro (não o da família).
    expect(ancoraHorarioEscola(rotaIda(), ate650)).toEqual({ min: HM(7), fonte: 'rota' });
  });

  it('motorista NÃO autorizou antecipar: continua possível, mas depende dele (sob confirmação) — não é incompatível', () => {
    const { publico: r, simulacao } = avaliar(rotaIda({ limiteAntecipacaoMin: 0 }), ate650);
    expect(r.status).toBe('sob_confirmacao');
    expect(r.horarioEscolaMin).toBe(HM(6, 50));
    expect(simulacao!.situacao).toBe('aprovacao');
  });

  it('alunos atuais SEM flexibilidade para antes: nenhum deles é adiantado para atender a família', () => {
    const { publico: r, simulacao } = avaliar(rotaIda({ flexAntes: 0 }), ate650);
    // A única saída é uma viagem à parte, bem mais cedo — só com aprovação do motorista.
    expect(r.status).not.toBe('compativel');
    if (simulacao?.opcao) for (const a of simulacao.opcao.alteracoes) expect(a.diferencaMin).toBeGreaterThanOrEqual(0);
  });

  it('ABERTURA da escola informada: abre 6h45 → chega 6h50; abre 6h55 → o prazo de 6h50 é impossível (comprovado)', () => {
    const abre645 = avaliar(rotaIda(), { ...ate650, aberturaEscolaMin: HM(6, 45) }).publico;
    expect(abre645).toMatchObject({ status: 'compativel', horarioEscolaMin: HM(6, 50) });
    const abre655 = avaliar(rotaIda(), { ...ate650, aberturaEscolaMin: HM(6, 55) }).publico;
    expect(abre655.status).toBe('incompativel');
    expect(abre655.codigos).toContain('prazo_familia');
    // Abertura cadastrada na parada da escola vale igual à informada no pedido.
    const cadastrada = rotaIda({ paradas: rotaIda().paradas.map((p) => (p.tipo === 'escola' ? { ...p, aberturaMin: HM(6, 55) } : p)) });
    expect(avaliar(cadastrada, ate650).publico.status).toBe('incompativel');
  });

  it('abertura depois da chegada habitual: a van ESPERA e a entrega conta a partir da abertura', () => {
    // Escola abre 6h58; a van chega 6h55 e espera 3 min. Sem prazo da família, cabe.
    const r = avaliar(rotaIda(), pedido(casa, { aberturaEscolaMin: HM(6, 58) })).publico;
    expect(r.status === 'compativel' || r.status === 'sob_confirmacao').toBe(true);
    expect(r.horarioEscolaMin!).toBeGreaterThanOrEqual(HM(6, 58));
  });
});

describe('[simulado] escola que o motorista ACEITA incluir, ainda sem parada', () => {
  // Escola nova a 3,5 km (linha reta) da parada mais próxima — fora do raio aproximado.
  const folgada = (over: Partial<Rota> = {}) => rotaIda({
    ultimoDesembarqueMin: HM(7, 30),
    paradas: rotaIda().paradas.map((p) => (p.tipo === 'escola' ? { ...p, limiteChegadaMin: HM(7, 30) } : p)),
    ...over,
  });
  const paraNova = pedido(pt(2000, 3000), { destinoId: 'esc-nova', escolaPonto: P.escolaNova });

  it('a escola aceita fica a mais de 3 km de qualquer parada: o raio aproximado NÃO a elimina', () => {
    const aceita = folgada({ escolasDisponiveis: [escolaAceita({ limiteChegadaMin: HM(7, 20) })] });
    const maisPerto = Math.min(...aceita.paradas.map((p) => haversineMetros({ lat: p.lat!, lng: p.lng! }, P.escolaNova)));
    expect(maisPerto).toBeGreaterThan(PROX_ESCOLA_M);
    expect(origemDaEscola(aceita, paraNova)).toBe('aceita');
    expect(candidatasParaBusca([{ rota: aceita, veiculo: van() }], paraNova)).toHaveLength(1);
  });

  it('casa e escola são calculadas JUNTAS: cabe, respeitando o limite que o motorista informou para a escola', () => {
    const aceita = folgada({ escolasDisponiveis: [escolaAceita({ limiteChegadaMin: HM(7, 20) })] });
    const { publico: r, simulacao } = avaliar(aceita, paraNova);
    expect(r).toMatchObject({ status: 'compativel', atendeEscola: false, origemEscola: 'aceita', fonteHorario: 'rota' });
    expect(simulacao!.escolaInserida).toBe(true);
    expect(r.horarioEscolaMin!).toBeLessThanOrEqual(HM(7, 20) - MARGEM_OPERACIONAL_MIN);
    // A escola atual da rota continua sendo o ponto final, dentro do limite dela.
    const eventos = simulacao!.opcao!.eventos;
    expect(eventos.at(-1)!.compromisso.ponto.id).toBe('esc-1');
    expect(eventos.at(-1)!.chegadaMin).toBeLessThanOrEqual(HM(7, 30));
  });

  it('com prazo da família (até 7h00) na escola aceita: chega até 7h00, sem margem em dobro', () => {
    const aceita = folgada({ escolasDisponiveis: [escolaAceita({ limiteChegadaMin: HM(7, 20) })] });
    const r = avaliar(aceita, { ...paraNova, horarioFamiliaMin: HM(7) }).publico;
    expect(r.status).toBe('compativel');
    expect(r.horarioEscolaMin!).toBeLessThanOrEqual(HM(7));
    expect(r.horarioEscolaMin!).toBeGreaterThan(HM(7) - MARGEM_OPERACIONAL_MIN);
  });

  it('aceita sem horário informado pelo motorista: vale o prazo da família; sem nenhum dos dois, fica sob confirmação', () => {
    const aceita = folgada({ escolasDisponiveis: [escolaAceita()] });
    expect(avaliar(aceita, { ...paraNova, horarioFamiliaMin: HM(7, 10) }).publico).toMatchObject({ status: 'compativel', fonteHorario: 'familia' });
    expect(avaliar(aceita, paraNova).publico).toMatchObject({ status: 'sob_confirmacao', fonteHorario: 'turno' });
  });

  it('portão informado na lista de aceitas é o ponto usado no cálculo (não o do catálogo)', () => {
    const portao = pt(2000, 3300);
    const aceita = folgada({ escolasDisponiveis: [escolaAceita({ limiteChegadaMin: HM(7, 20), portaoLat: portao.lat, portaoLng: portao.lng })] });
    const { pontos } = pontosDoPedido(aceita, paraNova);
    expect(pontos.find((p) => p.id === 'esc-nova')).toMatchObject(portao);
  });

  it('lista revisada SEM a escola: não é candidata. Cadastro antigo (lista nunca revisada): só o recorte aproximado, e depende de aprovação', () => {
    expect(candidatasParaBusca([{ rota: folgada(), veiculo: van() }], paraNova)).toHaveLength(0);
    const antiga = folgada({ disponibilidadeRevisada: false, escolasDisponiveis: [] });
    expect(candidatasParaBusca([{ rota: antiga, veiculo: van() }], paraNova)).toHaveLength(0); // longe: fora do recorte
    const perto = pedido(pt(3000, 0), { destinoId: 'esc-perto', escolaPonto: pt(5000, 300) });
    expect(origemDaEscola(antiga, perto)).toBe('proximidade');
    const r = avaliar(antiga, { ...perto, horarioFamiliaMin: HM(7, 10) });
    expect(r.publico.status).toBe('sob_confirmacao'); // incluir escola não autorizada depende do motorista
    expect(r.simulacao!.aprovacoes.join(' ')).toContain('escola');
  });

  it('o SIMULADOR oferece as mesmas escolas: as do percurso e as aceitas', () => {
    const aceita = folgada({ escolasDisponiveis: [escolaAceita()] });
    expect(escolasSimulaveis(aceita)).toEqual([
      { id: 'esc-1', nome: 'Escola Um', origem: 'percurso' },
      { id: 'esc-nova', nome: 'Escola Nova', origem: 'aceita' },
    ]);
  });
});

describe('[simulado] volta — a partir de quando o aluno está liberado', () => {
  const casa = pt(3000, 0);
  const volta = (over: Partial<PedidoFamilia> = {}) => pedido(casa, { sentido: 'volta', ...over });

  it('sem horário da família (ou liberado antes da saída da rota): embarca com o grupo', () => {
    const base = avaliar(rotaVolta(), volta()).publico;
    expect(base).toMatchObject({ status: 'compativel', horarioEscolaMin: HM(12, 3), classe: 'imediato' });
    expect(avaliar(rotaVolta(), volta({ horarioFamiliaMin: HM(11, 50) })).publico).toEqual(base);
  });

  it('liberado 12h05: a van espera 2 min por ele e os atuais continuam dentro do combinado', () => {
    const { publico: r, simulacao } = avaliar(rotaVolta(), volta({ horarioFamiliaMin: HM(12, 5) }));
    expect(r).toMatchObject({ status: 'compativel', horarioEscolaMin: HM(12, 5) });
    for (const a of simulacao!.opcao!.alteracoes) expect(Math.abs(a.diferencaMin)).toBeLessThanOrEqual(10);
  });

  it('liberado 12h20: esperar atrasaria os atuais além do combinado → incompatível (comprovado)', () => {
    expect(avaliar(rotaVolta(), volta({ horarioFamiliaMin: HM(12, 20) })).publico.status).toBe('incompativel');
  });

  it('ida e volta são rotas e horários independentes: cada pedido só casa com rotas do seu sentido', () => {
    const entradas = [{ rota: rotaIda(), veiculo: van() }, { rota: rotaVolta(), veiculo: van() }];
    const ida = buscarEmRotasReais(entradas, pedido(casa, { horarioFamiliaMin: HM(6, 50) }), MATRIZ_SIMULADA);
    const vol = buscarEmRotasReais(entradas, volta({ horarioFamiliaMin: HM(12, 5) }), MATRIZ_SIMULADA);
    expect(ida.resultados.map((r) => [r.rotaId, r.sentido, r.horarioEscolaMin])).toEqual([['rota-ida', 'ida', HM(6, 50)]]);
    expect(vol.resultados.map((r) => [r.rotaId, r.sentido, r.horarioEscolaMin])).toEqual([['rota-volta', 'volta', HM(12, 5)]]);
  });
});

describe('[simulado] vagas: o que vale é o trecho calculado, não o pico da rota', () => {
  it('van de 2 lugares lotada no pico: não vira "zero vagas" — ou há lugar no trecho calculado, ou é incompatível por capacidade', () => {
    const r = avaliar(rotaIda(), pedido(pt(3000, 0)), 2).publico;
    if (r.vagas !== null) expect(r.vagas).toBeGreaterThanOrEqual(1);
    else expect(r.status).toBe('incompativel');
    expect(r.vagas).not.toBe(0);
  });

  it('van de 3 lugares com 2 alunos no trecho: 1 lugar livre no trecho da família', () => {
    expect(avaliar(rotaIda(), pedido(pt(3000, 0)), 3).publico).toMatchObject({ status: 'compativel', vagas: 1 });
  });

  it('van sem lugar para aluno = incompatível; van não cadastrada = dados insuficientes (não é "sem vaga")', () => {
    expect(avaliarRotaReal(rotaIda({ lugaresReservados: 6 }), van(6), pedido(pt(3000, 0)), MATRIZ_SIMULADA)).toMatchObject({ status: 'incompativel', vagas: null });
    expect(avaliarRotaReal(rotaIda(), null, pedido(pt(3000, 0)), MATRIZ_SIMULADA)).toMatchObject({ status: 'indeterminado', pendencia: 'dados_insuficientes', vagas: null });
  });
});

describe('[simulado] categorias de resultado', () => {
  it('dados insuficientes x avaliação incompleta x incompatível são coisas diferentes', () => {
    const casa = pt(3000, 0);
    // Parada sem coordenada: falta dado no cadastro.
    const semCoord = rotaIda({ paradas: rotaIda().paradas.map((p) => (p.id === 'c2' ? { ...p, lat: undefined, lng: undefined } : p)) });
    expect(avaliar(semCoord, pedido(casa)).publico).toMatchObject({ status: 'indeterminado', pendencia: 'dados_insuficientes' });
    // Trecho que o provedor não devolveu: avaliação incompleta.
    const furada: MatrizViaria = { origem: 'geoapify', obter: (a, b, t) => (a.id === 'c2' || b.id === 'c2' ? null : MATRIZ_SIMULADA.obter(a, b, t)) };
    expect(avaliar(rotaIda(), pedido(casa), 6, furada).publico).toMatchObject({ status: 'indeterminado', pendencia: 'avaliacao_incompleta' });
    // Erro inesperado na avaliação de UMA rota não vira recusa nem derruba as demais.
    const quebrada: MatrizViaria = { origem: 'geoapify', obter: () => { throw new Error('falha simulada'); } };
    expect(avaliarRotaSegura(rotaIda(), van(), pedido(casa), quebrada)).toMatchObject({ status: 'indeterminado', pendencia: 'avaliacao_incompleta' });
    // Rota sem horário nenhum + escola nova: não há de onde calcular.
    const semHorario = rotaIda({ saidaHabitualMin: null, ultimoDesembarqueMin: null, escolasDisponiveis: [escolaAceita()],
      paradas: rotaIda().paradas.map((p) => ({ ...p, limiteChegadaMin: null })), passageiros: rotaIda().passageiros.map((x) => ({ ...x, horarioHabitualMin: null })) });
    const r = avaliar(semHorario, pedido(pt(2000, 3000), { destinoId: 'esc-nova', escolaPonto: P.escolaNova, horarioFamiliaMin: HM(7) })).publico;
    expect(r).toMatchObject({ status: 'indeterminado', pendencia: 'dados_insuficientes' });
    expect(r.codigos).toContain('sem_horarios');
  });

  it('o selo do simulador usa o mesmo veredito', () => {
    const casa = pt(3000, 0);
    expect(seloDoResultado(avaliar(rotaIda(), pedido(casa)).publico).titulo).toBe('Compatível');
    expect(seloDoResultado(avaliar(rotaIda({ limiteAntecipacaoMin: 0 }), pedido(casa)).publico).titulo).toBe('Cabe, sob confirmação');
    expect(seloDoResultado(avaliar(rotaIda(), pedido(pt(3000, 30000))).publico).titulo).toBe('Não encaixa nesta rota');
    expect(seloDoResultado(avaliarRotaReal(rotaIda(), null, pedido(casa), MATRIZ_SIMULADA)).titulo).toBe('Faltam dados para calcular');
  });
});

describe('[simulado] família e simulador: mesmo pedido, rota, regras e matriz → mesmo resultado', () => {
  const folgada = rotaIda({
    ultimoDesembarqueMin: HM(7, 30), escolasDisponiveis: [escolaAceita({ limiteChegadaMin: HM(7, 20), portaoLat: pt(2000, 3300).lat, portaoLng: pt(2000, 3300).lng })],
    paradas: rotaIda().paradas.map((p) => (p.tipo === 'escola' ? { ...p, limiteChegadaMin: HM(7, 30) } : p)),
  });
  const casos: [string, Rota, PedidoFamilia, number][] = [
    ['mesma coordenada', rotaIda(), pedido(P.casa1), 6],
    ['mesma rua', rotaIda(), pedido(pt(3000, 0)), 6],
    ['pequeno desvio', rotaIda(), pedido(pt(3000, 400)), 6],
    ['chegada até 6h50', rotaIda(), pedido(pt(3000, 0), { horarioFamiliaMin: HM(6, 50) }), 6],
    ['6h50 sem antecipação autorizada', rotaIda({ limiteAntecipacaoMin: 0 }), pedido(pt(3000, 0), { horarioFamiliaMin: HM(6, 50) }), 6],
    ['6h50 com abertura 6h55', rotaIda(), pedido(pt(3000, 0), { horarioFamiliaMin: HM(6, 50), aberturaEscolaMin: HM(6, 55) }), 6],
    ['casa longe demais', rotaIda(), pedido(pt(3000, 30000)), 6],
    ['van lotada no pico', rotaIda(), pedido(pt(3000, 0)), 2],
    ['escola aceita com portão', folgada, pedido(pt(2000, 3000), { destinoId: 'esc-nova', escolaPonto: P.escolaNova, horarioFamiliaMin: HM(7) }), 6],
    ['volta liberado 12h05', rotaVolta(), pedido(pt(3000, 0), { sentido: 'volta', horarioFamiliaMin: HM(12, 5) }), 6],
    ['volta liberado 12h20', rotaVolta(), pedido(pt(3000, 0), { sentido: 'volta', horarioFamiliaMin: HM(12, 20) }), 6],
  ];
  it.each(casos)('%s', (_nome, rota, p, lugares) => {
    const { pontos } = pontosDoPedido(rota, p);
    // SIMULADOR: matriz indexada pelos ids dos pontos (como `obterMatrizViaria` monta).
    const t = tabelasSimuladas(pontos, pontos);
    const doSimulador = matrizDeTabelas(pontos, t.tempos, t.distancias);
    // BUSCA DA FAMÍLIA: matriz indexada por coordenada (como o servidor monta).
    const distintos = pontosDistintos(pontos);
    const td = tabelasSimuladas(distintos, distintos);
    const doServidor = new MatrizPorCoordenadas();
    doServidor.adicionar(distintos, td.tempos, td.distancias);
    const simulador = avaliarRotaDetalhada(rota, van(lugares), p, doSimulador);
    const familia = avaliarRotaReal(rota, van(lugares), p, doServidor);
    expect(simulador.publico).toEqual(familia);
    expect(familia.temposEstimados).toBe(false);
  });
});
