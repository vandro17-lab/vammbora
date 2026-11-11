import { describe, it, expect, vi, afterEach } from 'vitest';
import { avaliarComTemposReais } from '@/lib/busca-avaliacao-servidor';
import {
  avaliarRotaDetalhada, avaliarRotaReal, candidatasParaBusca, origemDaEscola, versaoDaAvaliacao, type EntradaBuscaReal,
} from '@/lib/busca-rotas-reais';
import { buscarRotasReais, continuarBuscaReal, type CartaoRotaRealDados } from '@/lib/busca-rotas-reais-cliente';
import { avisosDoSentido } from '@/lib/busca-mensagens';
import { contextoDoInteresse, linhasDoContexto, resumoDoContexto } from '@/lib/contexto-interesse';
import {
  adicionarAluno, adicionarEscola, atualizarAluno, definirSaida, escolasEsvaziadas, escolasSemAlunos, excluirParada, moverParada,
  removerAlunoDaRota, resolverEscolaSemAlunos,
} from '@/lib/edicao-rota';
import { criarMatrizDemo } from '@/lib/encaixe';
import { montarRotaAncorada } from '@/lib/rota-para-encaixe';
import {
  distanciaPelasRuas, pendenciasParaConcluirVolta, pontosParaOrdenarVolta, removerAluno as removerAlunoDaVolta, sugerirVolta,
} from '@/lib/rota-volta';
import { CONFIRMACAO_DE_ENCAIXE_HABILITADA, REQUISITOS_DA_CONFIRMACAO } from '@/lib/simulador-encaixe';
import { impactoDaVanNasRotas, textoDoImpacto } from '@/lib/veiculo-rotas';
import { simularEncaixe, OPORTUNIDADES_VM } from '@/lib/vm/encaixe';
import { cenarioDemo, calcularIndicadores } from '@/lib/vm/cenario';
import { montarMensagemWhatsApp } from '@/lib/whatsapp';
import { sugerirRotaMelhor } from '@/engine/otimizador-rota';
import { assinaturaDaSequencia, finalizarViagem, iniciarViagem, registrarEvento, rotaDaViagem, viagemSimulada } from '@/data/viagem-store';
import type { CriteriosBusca, Motorista } from '@/types';
import type { Rota } from '@/types/motorista';
import { HM, MATRIZ_SIMULADA, P, escolaAceita, pedido, provedorSimulado, pt, rotaIda, rotaVolta, trechoSimulado, van } from '@/lib/cidade-simulada.fixture';

/**
 * REVISÃO DOS FLUXOS AFETADOS pela integração das regras de encaixe.
 *
 * TESTES SIMULADOS: tempos da malha fictícia (`cidade-simulada.fixture.ts`),
 * provedor viário e servidor de mentira. Nenhum usa ruas reais nem o banco.
 */

let seq = 0;
const novoId = () => `id-${++seq}`;
const entrada = (rota: Rota, lugares = 6): EntradaBuscaReal => ({ rota, veiculo: van(lugares) });
const casa = pt(3000, 0);

describe('1. editar rota ou van invalida avaliações antigas', () => {
  const base = rotaIda();
  const v0 = versaoDaAvaliacao(base, van(6));
  const mudancas: [string, Rota, number][] = [
    ['passageiro removido', removerAlunoDaRota(base, 'p2'), 6],
    ['horário de um aluno', { ...base, passageiros: base.passageiros.map((x) => (x.id === 'p1' ? { ...x, horarioHabitualMin: HM(6, 40) } : x)) }, 6],
    ['flexibilidade de um aluno', { ...base, passageiros: base.passageiros.map((x) => (x.id === 'p1' ? { ...x, ajusteAntesMin: 0 } : x)) }, 6],
    ['limite da escola', { ...base, paradas: base.paradas.map((p) => (p.tipo === 'escola' ? { ...p, limiteChegadaMin: HM(7, 10) } : p)) }, 6],
    ['abertura da escola', { ...base, paradas: base.paradas.map((p) => (p.tipo === 'escola' ? { ...p, aberturaMin: HM(6, 50) } : p)) }, 6],
    ['escola aceita incluída', { ...base, escolasDisponiveis: [escolaAceita()] }, 6],
    ['saída habitual', { ...base, saidaHabitualMin: HM(6, 30) }, 6],
    ['antecipação autorizada', { ...base, limiteAntecipacaoMin: 0 }, 6],
    ['troca de veículo', { ...base, veiculoId: 'van-2' }, 6],
    ['lugares da van', base, 5],
    ['lugares reservados', { ...base, lugaresReservados: 1 }, 6],
    ['monitor que ocupa lugar', { ...base, monitor: true, monitorOcupaLugar: true }, 6],
    ['parada movida no mapa', { ...base, paradas: base.paradas.map((p) => (p.id === 'c2' ? { ...p, ...pt(4000, 100) } : p)) }, 6],
  ];
  it.each(mudancas)('%s muda a versão da avaliação', (_n, rota, lugares) => {
    expect(versaoDaAvaliacao(rota, van(lugares))).not.toBe(v0);
  });

  it('o que não altera o encaixe (nome da rota) não invalida nada; e a versão não revela dados', () => {
    expect(versaoDaAvaliacao({ ...base, nome: 'Outro nome' }, van(6))).toBe(v0);
    expect(v0).toMatch(/^[0-9a-z]{4,16}$/);
    expect(v0).not.toContain('AlunoReservado');
  });

  it('SERVIDOR: continuação de uma versão antiga das rotas não vale — a fila recomeça e avisa', async () => {
    const consultar = provedorSimulado();
    const p = pedido(casa, { horarioFamiliaMin: HM(6, 50) });
    const antes = [entrada(rotaIda({ id: 'a' })), entrada(rotaIda({ id: 'b' }))];
    const r1 = await avaliarComTemposReais(antes, p, { consultar, maxConsultas: 1 });
    expect(r1.reiniciada).toBe(false);
    expect(r1.continuacao).toMatchObject({ inicio: 1 });
    // O motorista da rota "a" tira a antecipação autorizada enquanto a família olha.
    const depois = [entrada(rotaIda({ id: 'a', limiteAntecipacaoMin: 0 })), entrada(rotaIda({ id: 'b' }))];
    const r2 = await avaliarComTemposReais(depois, p, { consultar, maxConsultas: 2, continuacao: r1.continuacao });
    expect(r2.reiniciada).toBe(true);
    expect(r2.resultados.map((x) => x.rotaId).sort()).toEqual(['a', 'b']); // recomeçou do zero
    expect(r2.resultados.find((x) => x.rotaId === 'a')).toMatchObject({ status: 'sob_confirmacao' }); // já com o dado novo
    expect(r2.resultados.find((x) => x.rotaId === 'a')!.versao).not.toBe(r1.resultados[0].versao);
    // Sem mudança, a continuação vale normalmente.
    const r3 = await avaliarComTemposReais(antes, p, { consultar, maxConsultas: 1, continuacao: r1.continuacao });
    expect(r3.reiniciada).toBe(false);
    expect(r3.resultados.map((x) => x.rotaId)).toEqual(['b']);
  });

  it('SERVIDOR: mudar os lugares da van (Minha Van) também invalida a continuação', async () => {
    const consultar = provedorSimulado();
    const p = pedido(casa);
    const rotas = [rotaIda({ id: 'a' }), rotaIda({ id: 'b' })];
    const r1 = await avaliarComTemposReais(rotas.map((r) => entrada(r, 6)), p, { consultar, maxConsultas: 1 });
    const r2 = await avaliarComTemposReais(rotas.map((r) => entrada(r, 2)), p, { consultar, maxConsultas: 2, continuacao: r1.continuacao });
    expect(r2.reiniciada).toBe(true);
    expect(r2.resultados).toHaveLength(2);
  });

  it('Minha Van: mudar lugares mostra o efeito em cada rota — e não altera rota nenhuma', () => {
    const rotas = [rotaIda({ id: 'ida', nome: 'Manhã' }), rotaVolta({ id: 'volta', nome: 'Meio-dia', lugaresReservados: 1 }), rotaIda({ id: 'outra', veiculoId: 'van-9' })];
    const copia = JSON.stringify(rotas);
    const menos = impactoDaVanNasRotas(van(6), van(4), rotas);
    expect(menos.map((i) => [i.rotaId, i.capacidadeAntes, i.capacidadeDepois, i.efeito])).toEqual([['ida', 6, 4, 'menos_lugares'], ['volta', 5, 3, 'menos_lugares']]);
    const excede = impactoDaVanNasRotas(van(6), van(1), rotas);
    expect(excede.map((i) => i.efeito)).toEqual(['excede', 'excede']);
    expect(textoDoImpacto(excede[0])).toContain('nenhum aluno foi removido');
    expect(impactoDaVanNasRotas(van(6), van(8), rotas).every((i) => i.efeito === 'mais_lugares')).toBe(true);
    expect(impactoDaVanNasRotas(van(6), { ...van(6), modelo: 'Outra' }, rotas)).toEqual([]); // nada que mude a capacidade
    expect(JSON.stringify(rotas)).toBe(copia);
    // E a disponibilidade é recalculada com a van nova: 2 alunos a bordo, 2 lugares → não cabe mais um.
    expect(avaliarRotaReal(rotas[0], van(6), pedido(casa), MATRIZ_SIMULADA).status).toBe('compativel');
    expect(avaliarRotaReal(rotas[0], van(2), pedido(casa), MATRIZ_SIMULADA).status).not.toBe('compativel');
  });
});

describe('2. último aluno de uma escola sai: a intenção do motorista não é apagada em silêncio', () => {
  // Ida com DUAS escolas: p1 → escola A (intermediária), p2 → escola B (final).
  const duas = (): Rota => {
    const r = rotaIda();
    return {
      ...r,
      paradas: [
        r.paradas[0], r.paradas[1],
        { id: 'ea', ordem: 2, tipo: 'escola', rotulo: 'Escola A', confirmado: true, destinoId: 'esc-a', destinoNome: 'Escola A', limiteChegadaMin: HM(6, 50), aberturaMin: HM(6, 30), atendimentoGrupoMin: 2, portaoEspecifico: true, ...pt(3000, 0) },
        { ...r.paradas[2], ordem: 3 }, { ...r.paradas[3], ordem: 4 },
      ],
      passageiros: [{ ...r.passageiros[0], desembarqueParadaId: 'ea', destinoId: 'esc-a', horarioHabitualMin: null }, { ...r.passageiros[1], horarioHabitualMin: null }],
      saidaHabitualMin: null,
    };
  };
  const paraA = pedido(pt(2500, 0), { destinoId: 'esc-a', escolaPonto: pt(3000, 0) });

  it('tirar o último aluno da escola NÃO remove a visita: a escola fica marcada para decisão', () => {
    const antes = duas();
    const depois = removerAlunoDaRota(antes, 'p1');
    expect(depois.paradas.some((p) => p.id === 'ea')).toBe(true);
    expect(escolasEsvaziadas(antes, depois).map((p) => p.id)).toEqual(['ea']);
    expect(escolasSemAlunos(antes)).toEqual([]);
  });

  it('as outras edições que esvaziam uma escola também são percebidas (trocar de escola, excluir a casa)', () => {
    const antes = duas();
    expect(escolasEsvaziadas(antes, atualizarAluno(antes, 'p1', { escolaParadaId: 'e' }, novoId)).map((p) => p.id)).toEqual(['ea']);
    expect(escolasEsvaziadas(antes, excluirParada(antes, 'c1')).map((p) => p.id)).toEqual(['ea']);
    // Escola que já estava vazia antes da edição não é "esvaziada" de novo.
    const jaVazia = removerAlunoDaRota(antes, 'p1');
    expect(escolasEsvaziadas(jaVazia, removerAlunoDaRota(jaVazia, 'p2')).map((p) => p.id)).toEqual(['e']);
  });

  it('MANTER a visita: nada muda — a van continua passando e famílias dessa escola seguem encontrando a rota como "visita"', () => {
    const vazia = removerAlunoDaRota(duas(), 'p1');
    const mantida = resolverEscolaSemAlunos(vazia, 'ea', 'manter', novoId);
    expect(mantida).toBe(vazia);
    expect(origemDaEscola(mantida, paraA)).toBe('visita');
    // A visita continua no cálculo (com o limite dela), mesmo sem aluno.
    const op = montarRotaAncorada(mantida, van(), MATRIZ_SIMULADA)!.rotaOp;
    expect(op.compromissos.find((c) => c.id === 'escola:ea')).toMatchObject({ limiteEscolaMin: HM(6, 50) });
  });

  it('REMOVER a visita: a escola sai do percurso e NÃO vira disponibilidade', () => {
    const vazia = { ...removerAlunoDaRota(duas(), 'p1'), disponibilidadeRevisada: true };
    const sem = resolverEscolaSemAlunos(vazia, 'ea', 'remover', novoId);
    expect(sem.paradas.map((p) => p.id)).toEqual(['s', 'c2', 'e']);
    expect(sem.paradas.map((p) => p.ordem)).toEqual([0, 1, 2]);
    expect(sem.escolasDisponiveis).toEqual([]);
    expect(candidatasParaBusca([entrada(sem)], paraA)).toHaveLength(0);
    expect(sem.passageiros).toEqual(vazia.passageiros); // ninguém mais é tocado
  });

  it('PRESERVAR SÓ A DISPONIBILIDADE: sai do percurso, entra na lista de aceitas com portão, limite, abertura e tempo do grupo', () => {
    const vazia = { ...removerAlunoDaRota(duas(), 'p1'), disponibilidadeRevisada: true };
    const disp = resolverEscolaSemAlunos(vazia, 'ea', 'disponibilidade', novoId);
    expect(disp.paradas.some((p) => p.id === 'ea')).toBe(false);
    expect(disp.escolasDisponiveis).toEqual([expect.objectContaining({
      destinoId: 'esc-a', destinoNome: 'Escola A', dias: null, limiteChegadaMin: HM(6, 50), aberturaMin: HM(6, 30), atendimentoGrupoMin: 2,
      portaoLat: pt(3000, 0).lat, portaoLng: pt(3000, 0).lng,
    })]);
    // A família dessa escola continua encontrando a rota — agora como "aceita", avaliada com o limite preservado.
    expect(origemDaEscola(disp, paraA)).toBe('aceita');
    const r = avaliarRotaDetalhada(disp, van(), paraA, MATRIZ_SIMULADA);
    expect(r.ancora).toEqual({ min: HM(6, 50), fonte: 'rota' });
    expect(r.simulacao?.escolaInserida).toBe(true);
  });

  it('só resolve escola realmente vazia; escola já aceita ou repetida no percurso não é duplicada', () => {
    const cheia = duas();
    expect(resolverEscolaSemAlunos(cheia, 'ea', 'remover', novoId)).toBe(cheia);
    const vazia = { ...removerAlunoDaRota(duas(), 'p1'), escolasDisponiveis: [escolaAceita({ destinoId: 'esc-a' })] };
    expect(resolverEscolaSemAlunos(vazia, 'ea', 'disponibilidade', novoId).escolasDisponiveis).toHaveLength(1);
  });

  it('VOLTA: tirar o último aluno de uma escola não apaga mais a visita (só a casa vazia sai)', () => {
    const v = rotaVolta();
    const sem = removerAlunoDaVolta(removerAlunoDaVolta(v, 'p1'), 'p2');
    expect(sem.paradas.map((p) => p.tipo)).toEqual(['saida', 'escola']);
    expect(escolasEsvaziadas(v, sem).map((p) => p.id)).toEqual(['e']);
    expect(removerAlunoDaVolta(v, 'p1').paradas.map((p) => p.id)).toEqual(['s', 'e', 'c2']);
  });
});

describe('3. contato, WhatsApp e lista de interesse levam o contexto — e não reservam vaga', () => {
  const criterios = (over: Partial<CriteriosBusca> = {}): CriteriosBusca => ({
    cidadeId: 'aracatuba', endereco: 'Rua das Flores, 123', destinoId: 'esc-1', turno: 'manha', contratacao: 'mensal',
    modalidade: 'ambos', origemLat: -21.2, origemLng: -50.44, horario: '06:50', horarioVolta: '12:05', ...over,
  });
  const cartao: CartaoRotaRealDados = {
    rotaId: '11111111-1111-4111-8111-111111111111', rotaNome: 'Ida manhã', vanLugares: 6, vagas: 4, atendeEscola: false, origemEscola: 'aceita', sentido: 'ida',
    status: 'sob_confirmacao', passagemCasaMin: HM(6, 38), horarioEscolaMin: HM(6, 50), minutosABordo: 11, temposEstimados: false, motivo: 'Cabe na rota, mas depende do motorista.', versao: 'abc123',
  };

  it('pedido geral de ida e volta: cada sentido com o SEU horário', () => {
    const c = contextoDoInteresse(criterios());
    expect(c.trechos).toEqual([{ sentido: 'ida', horarioMin: 410 }, { sentido: 'volta', horarioMin: 725 }]);
    expect(linhasDoContexto(c)).toEqual(['Ida: chegar à escola até 06h50.', 'Volta: liberado na escola a partir de 12h05.']);
  });

  it('interesse numa rota: só o sentido DELA, com rota, versão e condições do encaixe (ida válida não vira ida e volta)', () => {
    const c = contextoDoInteresse(criterios(), cartao);
    expect(c.trechos).toEqual([{ sentido: 'ida', horarioMin: 410 }]);
    expect(c.rota).toMatchObject({ rotaId: cartao.rotaId, sentido: 'ida', status: 'sob_confirmacao', origemEscola: 'aceita', versao: 'abc123', horarioEscolaMin: HM(6, 50) });
    const linhas = linhasDoContexto(c).join(' ');
    expect(linhas).toContain('chega à escola por volta de 06h50');
    expect(linhas).toContain('sob confirmação do motorista');
    expect(linhas).toContain('aceita incluí-la');
    expect(linhas).not.toContain('Volta');
  });

  it('o contexto NÃO leva o endereço da família nem dado de terceiros', () => {
    const texto = JSON.stringify(contextoDoInteresse(criterios(), cartao)) + resumoDoContexto(contextoDoInteresse(criterios(), cartao));
    expect(texto).not.toContain('Flores');
    expect(texto).not.toContain('-21.2');
    expect(Object.keys(contextoDoInteresse(criterios(), cartao).rota!).sort()).toEqual(
      ['condicao', 'horarioEscolaMin', 'origemEscola', 'passagemCasaMin', 'rotaId', 'sentido', 'status', 'temposEstimados', 'versao']);
  });

  it('resumo de reserva (banco sem a migração 0017): sentido, horário, rota e versão cabem num texto curto', () => {
    const r = resumoDoContexto(contextoDoInteresse(criterios(), cartao));
    expect(r).toBe('[ida até 06h50 · rota 11111111-1111-4111-8111-111111111111 v:abc123 sob_confirmacao]');
    expect(resumoDoContexto(contextoDoInteresse(criterios()))).toBe('[ida até 06h50 · volta a partir de 12h05]');
    expect(r.length).toBeLessThanOrEqual(160);
  });

  it('mensagem de WhatsApp: leva os horários por sentido, avisa que não reserva vaga e continua sem o endereço', () => {
    const motorista = { nome: 'Manoel Bento' } as Motorista;
    const msg = montarMensagemWhatsApp(motorista, criterios(), null);
    expect(msg).toContain('Ida: chegar à escola até 06h50.');
    expect(msg).toContain('Volta: liberado na escola a partir de 12h05.');
    expect(msg).toContain('ainda não reserva a vaga');
    expect(msg).not.toContain('Flores');
    // Só volta: o horário único é o de liberação, não um prazo de chegada.
    const soVolta = montarMensagemWhatsApp(motorista, criterios({ modalidade: 'volta', horario: '12:10', horarioVolta: undefined }), null);
    expect(soVolta).toContain('Volta: liberado na escola a partir de 12h10.');
    expect(soVolta).not.toContain('Ida:');
  });
});

describe('4. confirmação da inclusão continua desativada, com a limitação explícita', () => {
  it('a chave está desligada e os requisitos que faltam estão listados', () => {
    expect(CONFIRMACAO_DE_ENCAIXE_HABILITADA).toBe(false);
    const texto = REQUISITOS_DA_CONFIRMACAO.join(' ');
    for (const exigido of ['versão', 'horários e capacidade', 'atômica', 'última vaga', 'aprovação do motorista', 'viagens em andamento']) expect(texto).toContain(exigido);
  });
});

describe('5. navegação: a viagem segue a sequência com que começou', () => {
  afterEach(() => vi.unstubAllGlobals());
  const memoria = () => {
    const dados = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => dados.get(k) ?? null, setItem: (k: string, v: string) => void dados.set(k, v), removeItem: (k: string) => void dados.delete(k) });
    return dados;
  };

  it('sem viagem em andamento: usa a rota salva', () => {
    const salva = rotaIda();
    expect(rotaDaViagem(null, salva)).toEqual({ rota: salva, alterada: false });
  });

  it('rota editada (novo aluno, ordem trocada) no meio da viagem: a viagem NÃO muda e a tela é avisada', () => {
    const doInicio = rotaIda();
    const comNovo = adicionarAluno(doInicio, { nome: 'Novo', endereco: { rotulo: 'Rua Nova, 1', ponto: casa }, escolaParadaId: 'e' }, novoId).rota;
    const r = rotaDaViagem(doInicio, comNovo);
    expect(r.alterada).toBe(true);
    expect(r.rota).toBe(doInicio);
    expect(r.rota.paradas.map((p) => p.id)).toEqual(['s', 'c1', 'c2', 'e']);
    expect(r.rota.passageiros).toHaveLength(2);
  });

  it('mudança que não toca a operação (horário de limite, nome) não acusa alteração; simular um encaixe não toca na rota', () => {
    const doInicio = rotaIda();
    expect(rotaDaViagem(doInicio, { ...doInicio, nome: 'x', ultimoDesembarqueMin: HM(7, 5) }).alterada).toBe(false);
    const antes = assinaturaDaSequencia(doInicio);
    avaliarRotaDetalhada(doInicio, van(), pedido(casa, { horarioFamiliaMin: HM(6, 50) }), MATRIZ_SIMULADA);
    expect(assinaturaDaSequencia(doInicio)).toBe(antes);
  });

  it('percurso de SIMULAÇÃO não grava nada no histórico; viagem real grava', () => {
    const dados = memoria();
    const rota = rotaIda();
    const sim = iniciarViagem(rota, new Date(), { simulada: true });
    expect(viagemSimulada(sim)).toBe(true);
    registrarEvento(sim, { tipo: 'chegada', parada: rota.paradas[1], em: new Date() });
    finalizarViagem(sim);
    expect(dados.size).toBe(0);
    const real = iniciarViagem(rota);
    expect(viagemSimulada(real)).toBe(false);
    registrarEvento(real, { tipo: 'embarque', parada: rota.paradas[1], aluno: rota.passageiros[0], em: new Date() });
    const gravado = JSON.parse([...dados.values()][0]) as { linha: Record<string, unknown> }[];
    expect(gravado).toHaveLength(2);
    // O evento guarda uma CÓPIA do nome/endereço do momento: editar a rota depois não reescreve o histórico.
    expect(gravado[1].linha).toMatchObject({ stop_label: rota.paradas[1].rotulo, passenger_name: rota.passageiros[0].identificacao, stop_order: 1 });
  });
});

describe('6. montagem da volta: não é a ida invertida nem copia o que é da ida', () => {
  const ida = rotaIda({ limiteAntecipacaoMin: 15, escolasDisponiveis: [escolaAceita()] });

  it('não copia horários, flexibilidade, atendimento, saída, antecipação nem escolas aceitas', () => {
    const v = sugerirVolta({ ...ida, passageiros: ida.passageiros.map((x) => ({ ...x, atendimentoMin: 1.5, atendimentoOrigem: 'informado' as const })) });
    expect(v).toMatchObject({ sentido: 'volta', status: 'rascunho', saidaHabitualMin: null, limiteAntecipacaoMin: null, ultimoDesembarqueMin: null, escolasDisponiveis: [], disponibilidadeRevisada: false, periodoConfirmado: false });
    for (const x of v.passageiros) expect(x).toMatchObject({ horarioHabitualMin: null, ajusteAntesMin: null, ajusteDepoisMin: null, atendimentoMin: null, atendimentoOrigem: null });
    for (const p of v.paradas) expect(p).toMatchObject({ horarioChegadaMin: null, limiteChegadaMin: null, liberacaoMin: null, atendimentoGrupoMin: null, tempoAteProximaMin: null });
    expect(v.paradas[0].tipo).toBe('escola');
  });

  it('a ordem das entregas vem dos trajetos das RUAS: com mão única, a ordem muda em relação à linha reta', () => {
    const reta = sugerirVolta(ida);
    const casasPorId = new Map(ida.paradas.map((p) => [`${p.lat},${p.lng}`, p.id]));
    const ordem = (v: Rota) => v.paradas.filter((p) => p.tipo === 'casa').map((p) => casasPorId.get(`${p.lat},${p.lng}`));
    expect(ordem(reta)).toEqual(['c2', 'c1']); // saindo da escola, a casa 2 é a mais próxima em linha reta
    // Ruas (simuladas) com mão única: da escola não se chega direto à casa 2 — só dando a volta.
    const maoUnica = { obter: (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const t = trechoSimulado(a, b);
      const daEscolaParaCasa2 = Math.abs(a.lng - P.escola.lng) < 1e-9 && Math.abs(b.lng - P.casa2.lng) < 1e-9;
      return { minutos: t.minutos + (daEscolaParaCasa2 ? 30 : 0) };
    } };
    const ruas = distanciaPelasRuas(maoUnica);
    expect(ordem(sugerirVolta(ida, { distancia: ruas.distancia }))).toEqual(['c1', 'c2']);
    expect(ruas.completa()).toBe(true);
    // Trecho que o mapa não devolveu: a ordenação não quebra, mas NÃO é anunciada como "pelas ruas".
    const furada = distanciaPelasRuas({ obter: () => null });
    sugerirVolta(ida, { distancia: furada.distancia });
    expect(furada.completa()).toBe(false);
    expect(pontosParaOrdenarVolta(ida)).toHaveLength(4); // garagem, 2 casas e a escola
  });

  it('volta sem a liberação informada NÃO é concluída — e, se for buscada, é "dados insuficientes" (não usa horário da ida)', () => {
    const v = sugerirVolta(ida);
    expect(pendenciasParaConcluirVolta(v)).toContain('informar o horário de liberação da escola');
    const r = avaliarRotaReal({ ...v, id: 'volta-x', status: 'concluida' }, van(), pedido(casa, { sentido: 'volta' }), MATRIZ_SIMULADA);
    expect(r).toMatchObject({ status: 'indeterminado', pendencia: 'dados_insuficientes', horarioEscolaMin: null });
    const pronta = { ...v, paradas: v.paradas.map((p) => (p.tipo === 'escola' ? { ...p, liberacaoMin: HM(12) } : p)) };
    expect(pendenciasParaConcluirVolta(pronta)).toEqual([]);
  });

  it('volta SEM parada de saída: a visita à escola e a liberação continuam no cálculo (ocupação e ruas recalculadas)', () => {
    const v = sugerirVolta(ida);
    const pronta: Rota = { ...v, id: 'volta-x', status: 'concluida', paradas: v.paradas.map((p) => (p.tipo === 'escola' ? { ...p, liberacaoMin: HM(12) } : p)) };
    const { publico, simulacao } = avaliarRotaDetalhada(pronta, van(3), pedido(casa, { sentido: 'volta', horarioFamiliaMin: HM(12, 2) }), MATRIZ_SIMULADA);
    expect(publico).toMatchObject({ atendeEscola: true, origemEscola: 'visita', fonteHorario: 'rota' });
    expect(publico.status === 'compativel' || publico.status === 'sob_confirmacao').toBe(true);
    expect(simulacao!.escolaInserida).toBe(false); // a escola da volta NÃO é tratada como escola nova
    expect(publico.horarioEscolaMin!).toBeGreaterThanOrEqual(HM(12, 2)); // espera a liberação do aluno
    expect(publico.vagas).toBe(1); // 3 lugares, 2 alunos a bordo desde a escola
    // Com 2 lugares a volta está lotada desde a escola: não cabe (por capacidade, no trecho).
    expect(avaliarRotaReal(pronta, van(2), pedido(casa, { sentido: 'volta' }), MATRIZ_SIMULADA).status).toBe('incompativel');
  });
});

describe('7. oportunidades, planejamento e otimização seguem a mesma regra', () => {
  it('oportunidade demonstrativa: mesma regra da busca, sempre ESTIMATIVA — nunca "compatível"', () => {
    const dados = cenarioDemo();
    for (const op of OPORTUNIDADES_VM) {
      const r = simularEncaixe(dados, op);
      expect(r.estimado).toBe(true);
      expect(r.status).not.toBe('compativel');
      const direto = avaliarRotaDetalhada(dados.rotas[0], dados.veiculo, { origem: op.casa, destinoId: 'esc-paineiras', escolaPonto: { lat: -21.21, lng: -50.425 }, sentido: 'ida', turno: 'manha', contratacao: 'mensal', horarioFamiliaMin: op.limiteEscolaMin }, criarMatrizDemo());
      expect(r.status).toBe(direto.publico.status);
    }
  });

  it('custo: só o trajeto AVALIADO entra — a volta não é suposta igual à ida', () => {
    const dados = cenarioDemo();
    const cabem = OPORTUNIDADES_VM.map((op) => simularEncaixe(dados, op)).filter((r) => r.cabe);
    for (const r of cabem) {
      const c = r.comparativo;
      expect(c.kmExtraIda).not.toBeNull();
      // A volta do cenário de exemplo não fecha encaixe: fica "não avaliada" e fora do total.
      expect(c.kmDiaDepois - c.kmDiaAntes).toBeCloseTo((c.kmExtraIda ?? 0) + (c.kmExtraVolta ?? 0), 6);
      if (c.kmExtraVolta === null) expect(c.kmDiaDepois - c.kmDiaAntes).toBeCloseTo(c.kmExtraIda!, 6);
    }
    // Sem encaixe: nenhum custo inventado, nenhum aluno a mais, nenhuma receita.
    const semRota = simularEncaixe({ ...dados, rotas: [] }, OPORTUNIDADES_VM[0]);
    expect(semRota).toMatchObject({ cabe: false, compatibilidadePct: 0 });
    expect(semRota.comparativo).toMatchObject({ kmExtraIda: null, kmExtraVolta: null, custoExtraDia: 0, receitaExtraMes: 0 });
  });

  it('ida e volta avaliadas cada uma na sua rota dão desvios diferentes', () => {
    // Malha simulada: a casa da família fica no caminho da ida, mas fora de mão para a volta.
    const dados = { demo: true, veiculo: van(6), rotas: [rotaIda(), rotaVolta()], precoDiesel: 6, consumoKmL: 8, mensalidade: 300 };
    const op = { ...OPORTUNIDADES_VM[0], escola: 'Escola Um', casa: pt(1000, 0), limiteEscolaMin: HM(7) };
    const ida = avaliarRotaDetalhada(dados.rotas[0], dados.veiculo, { origem: op.casa, destinoId: 'esc-1', escolaPonto: P.escola, sentido: 'ida', horarioFamiliaMin: HM(7) }, MATRIZ_SIMULADA);
    const volta = avaliarRotaDetalhada(dados.rotas[1], dados.veiculo, { origem: op.casa, destinoId: 'esc-1', escolaPonto: P.escola, sentido: 'volta' }, MATRIZ_SIMULADA);
    expect(ida.simulacao!.opcao!.desvioMetros).toBe(0); // no caminho da ida
    expect(volta.simulacao!.opcao!.desvioMetros).toBeGreaterThan(0); // a volta termina na casa 1: precisa esticar
  });

  it('painel: vagas usam o monitor e as reservas de CADA rota', () => {
    const dados = { demo: false, veiculo: van(6), rotas: [rotaIda(), rotaVolta({ lugaresReservados: 3 })], precoDiesel: 6, consumoKmL: 8, mensalidade: 300 };
    expect(calcularIndicadores(dados).vagas).toBe(1); // ida: 6−2 = 4; volta: (6−3)−2 = 1 → o menor
  });

  it('otimizador não sugere ordem que deixe parada depois do ponto final obrigatório', () => {
    // Casa "depois" da escola seria mais curta, mas a escola (com limite) é o ponto final.
    const r = rotaIda({ saidaHabitualMin: null, passageiros: rotaIda().passageiros.map((x) => ({ ...x, horarioHabitualMin: null, ajusteAntesMin: null, ajusteDepoisMin: null })),
      paradas: rotaIda().paradas.map((p) => (p.id === 'c1' ? { ...p, ...pt(5000, 0) } : p.id === 'c2' ? { ...p, ...pt(1000, 0) } : p)) });
    const { rotaOp } = montarRotaAncorada(r, van(), MATRIZ_SIMULADA)!;
    expect(rotaOp.pontoFinalId).toBe('esc-1');
    const s = sugerirRotaMelhor(rotaOp, MATRIZ_SIMULADA, { toleranciaMin: null });
    expect(s.compromissos.at(-1)!.ponto.id).toBe('esc-1');
    expect(s.melhorou).toBe(true); // casa a 1 km antes da casa a 5 km
  });
});

describe('8. demonstração separada da disponibilidade real', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('rota de demonstração aparece rotulada, mas não conta como oferta real', async () => {
    const demo: CartaoRotaRealDados = { rotaId: 'd1', rotaNome: 'Demo', demo: true, vanLugares: 6, vagas: 2, atendeEscola: true, sentido: 'ida', status: 'compativel', passagemCasaMin: 400, horarioEscolaMin: 410, minutosABordo: 10, motivo: 'ok' };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ totalRotasAvaliadas: 1, resultados: [demo] }) })));
    const r = await buscarRotasReais({ cidadeId: 'a', endereco: '', destinoId: 'esc-1', turno: null, contratacao: 'mensal', modalidade: 'ida', origemLat: -21.2, origemLng: -50.44 }, null);
    expect(r.sentidos[0]).toMatchObject({ encontradas: 0, demonstrativas: 1 });
    expect(avisosDoSentido(r.sentidos[0]).map((a) => a.tipo)).toContain('so_demonstracao');
  });

  it('CLIENTE: se o servidor recomeçou a fila (rotas editadas), os resultados antigos do sentido são descartados', async () => {
    const cartao = (rotaId: string, over: Partial<CartaoRotaRealDados> = {}): CartaoRotaRealDados => ({ rotaId, rotaNome: rotaId, vanLugares: 6, vagas: 2, atendeEscola: true, sentido: 'ida', status: 'compativel', passagemCasaMin: 400, horarioEscolaMin: 410, minutosABordo: 10, motivo: 'ok', ...over });
    let n = 0;
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => (++n === 1
      ? { totalRotasAvaliadas: 2, aguardando: 1, continuacao: { inicio: 1, repetir: [], assinatura: 'v1' }, resultados: [cartao('a')] }
      : { totalRotasAvaliadas: 1, aguardando: 0, continuacao: null, reiniciada: true, resultados: [cartao('b', { status: 'sob_confirmacao' })] }) })));
    const c: CriteriosBusca = { cidadeId: 'a', endereco: '', destinoId: 'esc-1', turno: null, contratacao: 'mensal', modalidade: 'ida', origemLat: -21.2, origemLng: -50.44 };
    const r1 = await buscarRotasReais(c, null);
    const r2 = await continuarBuscaReal(c, null, r1);
    expect(r2.resultados.map((x) => x.rotaId)).toEqual(['b']); // "a" era de uma versão antiga: saiu
    expect(r2.sentidos[0]).toMatchObject({ reavaliada: true, candidatas: 1, encontradas: 1 });
    expect(avisosDoSentido(r2.sentidos[0])[0]).toMatchObject({ tipo: 'reavaliada' });
  });
});

describe('percurso completo: cadastro → busca → simulador → proposta → operação [simulado]', () => {
  it('uma família é encontrada, simulada com o mesmo resultado, vira proposta sem reserva e não altera a viagem em andamento', async () => {
    // CADASTRO — rota montada pelas mesmas operações do construtor.
    let rota: Rota = { ...rotaIda(), id: 'rota-cadastro', paradas: [], passageiros: [], escolasDisponiveis: [], disponibilidadeRevisada: true };
    rota = definirSaida(rota, { rotulo: 'Garagem', ponto: P.garagem }, novoId);
    const a1 = adicionarAluno(rota, { nome: 'Aluno Um', endereco: { rotulo: 'Rua Reservada 1', ponto: P.casa1 }, escolaParadaId: null, horarioHabitualMin: HM(6, 41), ajusteAntesMin: 10, ajusteDepoisMin: 10 }, novoId);
    const a2 = adicionarAluno(a1.rota, { nome: 'Aluno Dois', endereco: { rotulo: 'Rua Reservada 2', ponto: P.casa2 }, escolaParadaId: null, horarioHabitualMin: HM(6, 48), ajusteAntesMin: 10, ajusteDepoisMin: 10 }, novoId);
    rota = adicionarEscola(a2.rota, { destinoId: 'esc-1', nome: 'Escola Um', pontoCatalogo: P.escola, limiteChegadaMin: HM(7), atendimentoGrupoMin: 3, descemIds: [a1.alunoId, a2.alunoId] }, novoId).rota;
    rota = { ...rota, status: 'concluida' };
    expect(rota.paradas.map((p) => p.tipo)).toEqual(['saida', 'casa', 'casa', 'escola']);

    // BUSCA — a família pede ida, chegar até 6h50.
    const p = pedido(casa, { horarioFamiliaMin: HM(6, 50) });
    const busca = await avaliarComTemposReais([entrada(rota)], p, { consultar: provedorSimulado(), maxConsultas: 4 });
    const achada = busca.resultados[0];
    expect(achada).toMatchObject({ rotaId: 'rota-cadastro', status: 'compativel', horarioEscolaMin: HM(6, 50), vagas: 4 });

    // SIMULADOR — o motorista simula o mesmo pedido: mesmo veredito e mesmos horários.
    const sim = avaliarRotaDetalhada(rota, van(), p, MATRIZ_SIMULADA);
    expect({ ...sim.publico, versao: achada.versao }).toEqual(achada);

    // PROPOSTA — o interesse leva rota, sentido, horário e versão; não reserva nada e não muda a rota.
    const cartao: CartaoRotaRealDados = { ...achada, rotaNome: rota.nome, vanLugares: 6 };
    const criterios: CriteriosBusca = { cidadeId: 'aracatuba', endereco: 'Rua da Família, 9', destinoId: 'esc-1', turno: 'manha', contratacao: 'mensal', modalidade: 'ida', origemLat: casa.lat, origemLng: casa.lng, horario: '06:50' };
    const contexto = contextoDoInteresse(criterios, cartao);
    expect(contexto.rota).toMatchObject({ rotaId: 'rota-cadastro', versao: achada.versao, status: 'compativel' });
    expect(versaoDaAvaliacao(rota, van())).toBe(achada.versao); // nada foi reservado nem alterado
    expect(CONFIRMACAO_DE_ENCAIXE_HABILITADA).toBe(false);

    // OPERAÇÃO — a viagem do dia começa; no meio dela o motorista inclui o aluno no construtor.
    const doInicio = rota;
    // (casa nova entre as duas atuais e saída 2 min mais cedo, para o atendimento dele)
    const inclusao = adicionarAluno(rota, { nome: 'Novo', endereco: { rotulo: 'Rua da Família, 9', ponto: casa }, escolaParadaId: rota.paradas.find((x) => x.tipo === 'escola')!.id }, novoId);
    const editada = { ...moverParada(inclusao.rota, inclusao.paradaId, -1), saidaHabitualMin: HM(6, 34) };
    expect(editada.paradas.map((x) => x.tipo)).toEqual(['saida', 'casa', 'casa', 'casa', 'escola']);
    expect(rotaDaViagem(doInicio, editada)).toMatchObject({ alterada: true, rota: doInicio });
    // A proposta foi calculada sobre a versão ANTERIOR: quem a atender percebe pela versão.
    expect(versaoDaAvaliacao(editada, van())).not.toBe(contexto.rota!.versao);
    // E uma nova busca já enxerga a rota com um lugar a menos no trecho.
    const depois = await avaliarComTemposReais([entrada(editada)], pedido(pt(3500, 0)), { consultar: provedorSimulado(), maxConsultas: 4 });
    expect(depois.resultados[0].vagas).toBe(3);
  });
});

describe('7b. construtor: a rota é conferida pelas MESMAS regras do encaixe', () => {
  // Trechos do mapa (minutos) gravados nas paradas, como o construtor faz.
  const comTrechos = (r: Rota, minutos: number[]): Rota => ({ ...r, paradas: [...r.paradas].sort((a, b) => a.ordem - b.ordem).map((p, i) => ({ ...p, tempoAteProximaMin: i < minutos.length ? minutos[i] : null })) });

  it('rota de referência fecha — e o veredito bate com a base usada na busca', async () => {
    const { conferirRotaDoCadastro } = await import('@/lib/rota-para-encaixe');
    const r = comTrechos(rotaIda(), [5, 5, 5]);
    expect(conferirRotaDoCadastro(r, van())).toMatchObject({ situacao: 'ok', problemas: [], partidaMin: HM(6, 36), fontePartida: 'cadastrada' });
    expect(montarRotaAncorada(r, van(), MATRIZ_SIMULADA)!.base.valido).toBe(true);
  });

  it('saída tarde demais, aluno fora do combinado e van pequena são apontados em linguagem simples', async () => {
    const { conferirRotaDoCadastro } = await import('@/lib/rota-para-encaixe');
    const tarde = conferirRotaDoCadastro(comTrechos(rotaIda({ saidaHabitualMin: HM(6, 50), flexDepois: 30 }), [5, 5, 5]), van());
    expect(tarde.situacao).toBe('inconsistente');
    expect(tarde.problemas.join(' ')).toContain('horário-limite da escola');
    const combinado = conferirRotaDoCadastro(comTrechos(rotaIda({ flexDepois: 0 }), [5, 9, 1]), van());
    expect(combinado.problemas.join(' ')).toContain('horário combinado com um aluno');
    expect(conferirRotaDoCadastro(comTrechos(rotaIda(), [5, 5, 5]), van(1)).problemas.join(' ')).toContain('mais alunos a bordo do que lugares');
    // É a mesma rota que a busca chama de "dados insuficientes" (não recusa ninguém).
    expect(avaliarRotaReal(rotaIda({ saidaHabitualMin: HM(6, 50), flexDepois: 30 }), van(), pedido(casa), MATRIZ_SIMULADA)).toMatchObject({ status: 'indeterminado', pendencia: 'dados_insuficientes' });
  });

  it('sem os trechos do mapa (ou sem nenhum horário) não afirma nada', async () => {
    const { conferirRotaDoCadastro } = await import('@/lib/rota-para-encaixe');
    expect(conferirRotaDoCadastro(rotaIda(), van()).situacao).toBe('sem_dados');
    const semHorario = comTrechos(rotaIda({ saidaHabitualMin: null, ultimoDesembarqueMin: null, paradas: rotaIda().paradas.map((p) => ({ ...p, limiteChegadaMin: null })), passageiros: rotaIda().passageiros.map((x) => ({ ...x, horarioHabitualMin: null })) }), [5, 5, 5]);
    expect(conferirRotaDoCadastro(semHorario, van())).toMatchObject({ situacao: 'sem_dados' });
  });
});
