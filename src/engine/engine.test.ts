import { describe, expect, it } from 'vitest';
import { avaliarEncaixe, revalidarAntesDeConfirmar } from './engine';
import type { RotaInstancia, SolicitacaoAluno } from './types';

function cenario() {
  const rota: RotaInstancia = {
    id: 'r1', turno: 'manha', destino: { id: 'esc1', horarioInicioAula: 430, margemChegadaMin: 10 },
    capacidadeVeiculo: 15,
    pontos: [
      { id: 'p1', horarioPlanejado: 380, ocupacaoTrechoSeguinte: 5, toleranciaAtrasoMin: 7 },
      { id: 'p2', horarioPlanejado: 390, ocupacaoTrechoSeguinte: 8, toleranciaAtrasoMin: 7 },
      { id: 'p3', horarioPlanejado: 400, ocupacaoTrechoSeguinte: 10, toleranciaAtrasoMin: 7 },
    ],
    chegadaPlanejadaDestino: 410, bufferPiorCasoMin: 8, limiteTempoABordoMin: 60,
  };
  const solicitacao: SolicitacaoAluno = {
    destinoId: 'esc1', turno: 'manha', contratacao: 'mensal',
    insercao: { indice: 2, horarioPassagemPlanejado: 390, atrasoAdicionalMin: 2 },
  };
  return { rota, solicitacao };
}

function avulso() {
  const c = cenario();
  c.solicitacao.contratacao = 'avulso';
  c.solicitacao.dataAvulso = '2026-11-09';
  c.solicitacao.folgaAvulsoAssentos = 2;
  return c;
}

describe('motor de encaixe', () => {
  it('encaixa no limite da margem e calcula passagem, bordo e impacto', () => {
    const { rota, solicitacao } = cenario();
    expect(avaliarEncaixe(rota, solicitacao)).toMatchObject({
      nivel: 'disponivel', elegivel: true, dadosFaltantes: [], precisaRenegociacao: false,
      passagemEstimada: 398, chegadaEstimadaDestino: 420, tempoABordoMin: 22,
      impacto: { chegadaAntes: 418, chegadaDepois: 420, folgaAntesMin: 12, folgaDepoisMin: 10 },
    });
  });
  it('o exemplo antigo é indisponível: aula às 7h exige chegada às 6h50', () => {
    const { rota, solicitacao } = cenario(); rota.destino.horarioInicioAula = 420;
    expect(avaliarEncaixe(rota, solicitacao).nivel).toBe('indisponivel');
    rota.destino.margemChegadaMin = 0;
    expect(avaliarEncaixe(rota, solicitacao).nivel).toBe('disponivel');
  });
  it('bloqueia atraso além da margem e preserva o impacto', () => {
    const { rota, solicitacao } = cenario(); solicitacao.insercao.atrasoAdicionalMin = 10;
    const r = avaliarEncaixe(rota, solicitacao);
    expect(r.nivel).toBe('indisponivel'); expect(r.elegivel).toBe(false);
    expect(r.motivos).toContain('Chegaria tarde demais para a aula');
    expect(r.impacto?.chegadaDepois).toBe(428);
  });
  it.each([14, 15])('capacidade no trecho posterior com %i ocupantes', ocupacao => {
    const { rota, solicitacao } = cenario(); rota.pontos[2].ocupacaoTrechoSeguinte = ocupacao;
    expect(avaliarEncaixe(rota, solicitacao).nivel).toBe(ocupacao === 14 ? 'disponivel' : 'indisponivel');
  });
  it('ignora trecho completamente anterior ao embarque', () => {
    const { rota, solicitacao } = cenario(); rota.pontos[0].ocupacaoTrechoSeguinte = 15;
    expect(avaliarEncaixe(rota, solicitacao).nivel).toBe('disponivel');
  });
  it('verifica o trecho anterior que o embarque divide', () => {
    const { rota, solicitacao } = cenario(); rota.pontos[1].ocupacaoTrechoSeguinte = 15;
    expect(avaliarEncaixe(rota, solicitacao).motivos).toContain('Sem assento em um dos trechos');
  });
  it('verifica capacidade mesmo após a última parada', () => {
    const { rota, solicitacao } = cenario(); solicitacao.insercao.indice = 3;
    solicitacao.insercao.horarioPassagemPlanejado = 405; rota.pontos[2].ocupacaoTrechoSeguinte = 15;
    expect(avaliarEncaixe(rota, solicitacao).nivel).toBe('indisponivel');
  });
  it('inserção antes da primeira parada verifica todos os trechos', () => {
    const { rota, solicitacao } = cenario(); solicitacao.insercao.indice = 0;
    solicitacao.insercao.horarioPassagemPlanejado = 375; rota.pontos[0].ocupacaoTrechoSeguinte = 15;
    expect(avaliarEncaixe(rota, solicitacao).nivel).toBe('indisponivel');
  });
  it('rota vazia explícita permite um aluno em veículo de um assento', () => {
    const { rota, solicitacao } = cenario(); rota.pontos = []; rota.capacidadeVeiculo = 1;
    solicitacao.insercao.indice = 0;
    expect(avaliarEncaixe(rota, solicitacao).nivel).toBe('disponivel');
  });
  it.each(['turno', 'destino'] as const)('rejeita %s incompatível', campo => {
    const { rota, solicitacao } = cenario();
    if (campo === 'turno') solicitacao.turno = 'tarde'; else solicitacao.destinoId = 'outra';
    expect(avaliarEncaixe(rota, solicitacao)).toMatchObject({ nivel: 'indisponivel', elegivel: false, motivos: ['Turno ou destino incompatível'] });
  });
  it.each([7, 9])('tolerância inclusiva com desvio %i', atraso => {
    const { rota, solicitacao } = cenario(); rota.destino.horarioInicioAula = 450;
    solicitacao.insercao.atrasoAdicionalMin = atraso;
    const r = avaliarEncaixe(rota, solicitacao);
    expect(r.precisaRenegociacao).toBe(atraso > 7);
    expect(r.nivel).toBe(atraso > 7 ? 'sob_consulta' : 'disponivel');
    expect(r.elegivel).toBe(true);
  });
  it('protege o passageiro do mesmo índice, agora posterior à inserção', () => {
    const { rota, solicitacao } = cenario(); rota.pontos[2].toleranciaAtrasoMin = 1;
    expect(avaliarEncaixe(rota, solicitacao).precisaRenegociacao).toBe(true);
  });
  it('não renegocia passageiros anteriores nem após a última parada', () => {
    const { rota, solicitacao } = cenario(); rota.pontos.forEach(p => { p.toleranciaAtrasoMin = 0; });
    solicitacao.insercao.indice = 3; solicitacao.insercao.horarioPassagemPlanejado = 405;
    expect(avaliarEncaixe(rota, solicitacao).precisaRenegociacao).toBe(false);
  });
  it.each([397, 398, 400])('janela termina em %i, passagem às 398', fim => {
    const { rota, solicitacao } = cenario(); solicitacao.janelaDesejada = { desejadoMin: 390, antesMin: 3, depoisMin: fim - 390 };
    expect(avaliarEncaixe(rota, solicitacao).precisaRenegociacao).toBe(fim < 398);
  });
  it.each([398, 399])('janela inicia em %i', inicio => {
    const { rota, solicitacao } = cenario(); solicitacao.janelaDesejada = { desejadoMin: inicio, antesMin: 0, depoisMin: 10 };
    expect(avaliarEncaixe(rota, solicitacao).precisaRenegociacao).toBe(inicio > 398);
  });
  it.each([20, 22, 60, null])('limite a bordo %s', limite => {
    const { rota, solicitacao } = cenario(); rota.limiteTempoABordoMin = limite;
    const r = avaliarEncaixe(rota, solicitacao);
    expect(r.nivel).toBe(limite === null ? 'sob_consulta' : limite < 22 ? 'indisponivel' : 'disponivel');
    if (limite === null) expect(r.motivos).toContain('Limite de tempo a bordo pendente de validação legal');
  });
  it.each([0, 2, undefined])('avulso com folga %s', folga => {
    const { rota, solicitacao } = avulso(); solicitacao.folgaAvulsoAssentos = folga;
    const r = avaliarEncaixe(rota, solicitacao);
    expect(r.nivel).toBe(folga === 0 ? 'indisponivel' : 'sob_consulta');
    expect(r.elegivel).toBe(folga === 2); expect(r.impacto).toBeDefined();
    if (folga === undefined) expect(r.dadosFaltantes).toContain('solicitacao.folgaAvulsoAssentos');
  });
  it.each(['2024-02-29', '2026-02-29', '2026-04-31', '', '2026-13-01', '0000-01-01'])('valida data civil %s', data => {
    const { rota, solicitacao } = avulso(); solicitacao.dataAvulso = data;
    expect(avaliarEncaixe(rota, solicitacao).elegivel).toBe(data === '2024-02-29');
  });
  it('mensal ignora campos exclusivos do avulso', () => {
    const { rota, solicitacao } = cenario(); solicitacao.dataAvulso = ''; solicitacao.folgaAvulsoAssentos = -1;
    expect(avaliarEncaixe(rota, solicitacao).nivel).toBe('disponivel');
  });
  it('falha dura prevalece sobre renegociação, limite pendente e avulso incompleto', () => {
    const { rota, solicitacao } = avulso(); rota.pontos[2].ocupacaoTrechoSeguinte = 15;
    rota.limiteTempoABordoMin = null; rota.pontos[2].toleranciaAtrasoMin = 0;
    solicitacao.folgaAvulsoAssentos = undefined;
    const r = avaliarEncaixe(rota, solicitacao);
    expect(r.nivel).toBe('indisponivel'); expect(r.elegivel).toBe(false); expect(r.precisaRenegociacao).toBe(true);
  });
  it('revalida com a mesma lógica e com o estado atualizado', () => {
    const { rota, solicitacao } = cenario();
    expect(revalidarAntesDeConfirmar(rota, solicitacao)).toEqual(avaliarEncaixe(rota, solicitacao));
    rota.pontos[2].ocupacaoTrechoSeguinte = 15;
    expect(revalidarAntesDeConfirmar(rota, solicitacao).nivel).toBe('indisponivel');
  });
  it('não modifica entradas congeladas e é determinístico', () => {
    const { rota, solicitacao } = cenario(); const antes = JSON.stringify({ rota, solicitacao });
    rota.pontos.forEach(Object.freeze); Object.freeze(rota.pontos); Object.freeze(rota.destino); Object.freeze(rota);
    Object.freeze(solicitacao.insercao); Object.freeze(solicitacao);
    const a = avaliarEncaixe(rota, solicitacao), b = avaliarEncaixe(rota, solicitacao);
    expect(a).toEqual(b); expect(JSON.stringify({ rota, solicitacao })).toBe(antes);
  });
});

describe('dados ausentes, inválidos e cronologia', () => {
  const invalidos: [string, (r: RotaInstancia, s: SolicitacaoAluno) => void][] = [
    ['aula zero', r => { r.destino.horarioInicioAula = 0; }],
    ['capacidade zero', r => { r.capacidadeVeiculo = 0; }],
    ['capacidade fracionária', r => { r.capacidadeVeiculo = 1.5; }],
    ['buffer NaN', r => { r.bufferPiorCasoMin = NaN; }],
    ['buffer infinito', r => { r.bufferPiorCasoMin = Infinity; }],
    ['desvio negativo', (_, s) => { s.insercao.atrasoAdicionalMin = -1; }],
    ['índice negativo', (_, s) => { s.insercao.indice = -1; }],
    ['índice fracionário', (_, s) => { s.insercao.indice = 1.5; }],
    ['índice fora da rota', (_, s) => { s.insercao.indice = 4; }],
    ['ocupação negativa', r => { r.pontos[0].ocupacaoTrechoSeguinte = -1; }],
    ['ocupação fracionária', r => { r.pontos[0].ocupacaoTrechoSeguinte = 2.5; }],
    ['tolerância negativa', r => { r.pontos[2].toleranciaAtrasoMin = -1; }],
    ['limite zero', r => { r.limiteTempoABordoMin = 0; }],
    ['pontos invertidos', r => { r.pontos[1].horarioPlanejado = 370; }],
    ['parada após destino', r => { r.pontos[2].horarioPlanejado = 420; }],
    ['embarque antes da parada anterior', (_, s) => { s.insercao.horarioPassagemPlanejado = 385; }],
    ['embarque após destino', (_, s) => { s.insercao.horarioPassagemPlanejado = 500; }],
    ['ID repetido', r => { r.pontos[1].id = 'p1'; }],
    ['janela inválida', (_, s) => { s.janelaDesejada = { desejadoMin: 390, antesMin: -1, depoisMin: 2 }; }],
  ];
  it.each(invalidos)('%s nunca libera vaga', (_, mudar) => {
    const { rota, solicitacao } = cenario(); mudar(rota, solicitacao);
    const r = avaliarEncaixe(rota, solicitacao);
    expect(r.nivel).toBe('sob_consulta'); expect(r.elegivel).toBe(false); expect(r.dadosFaltantes.length).toBeGreaterThan(0);
  });
  it.each([null, {}, { pontos: [null] }])('aceita falha de contrato em runtime sem lançar: %j', entrada => {
    const { solicitacao } = cenario();
    expect(avaliarEncaixe(entrada as unknown as RotaInstancia, solicitacao).elegivel).toBe(false);
  });
  it('solicitação sem inserção não lança', () => {
    const { rota } = cenario();
    const r = avaliarEncaixe(rota, { destinoId: 'esc1', turno: 'manha', contratacao: 'mensal' } as SolicitacaoAluno);
    expect(r.dadosFaltantes).toContain('solicitacao.insercao.indice');
  });
  it('rejeita overflow de tempos', () => {
    const { rota, solicitacao } = cenario(); rota.bufferPiorCasoMin = Number.MAX_VALUE;
    solicitacao.insercao.atrasoAdicionalMin = Number.MAX_VALUE;
    expect(avaliarEncaixe(rota, solicitacao).dadosFaltantes).toContain('temposCalculados');
  });
});
