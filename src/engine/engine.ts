// ============================================================================
// ÓRFÃO (auditoria "Algoritmo Supremo", Fase 1) — AVALIADOR ALTERNATIVO
// ----------------------------------------------------------------------------
// `avaliarEncaixe` é um modelo de encaixe baseado em ÍNDICES/buffer, distinto do
// motor ativo (`src/engine/encaixe-geografico.ts` + `src/engine/planejamento.ts`).
// Hoje NÃO tem consumidores no app — só `engine.test.ts` o usa. Mantido sem
// remover; é candidato a aposentadoria na Fase 8, após confirmar zero
// dependências. NÃO adicionar novos consumidores: use o motor geográfico.
// ============================================================================
import type { ResultadoEncaixe, RotaInstancia, SolicitacaoAluno } from './types';

const turnos = ['manha', 'tarde', 'noite', 'integral'];
const registro = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
    ? v as Record<string, unknown> : {};
const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const positivo = (v: unknown): v is number => numero(v) && v > 0;
const naoNegativo = (v: unknown): v is number => numero(v) && v >= 0;
const inteiro = (v: unknown): v is number => naoNegativo(v) && Number.isInteger(v);
const minuto = (v: unknown): v is number => naoNegativo(v) && v < 1440;
const texto = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

// Valida a data civil sem relógio, fuso ou normalização de datas impossíveis.
function dataCivil(v: unknown): boolean {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [ano, mes, dia] = v.split('-').map(Number);
  const bissexto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0);
  const dias = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return ano > 0 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= dias[mes - 1];
}

/** Dados vindos de formulário/API também são validados em tempo de execução. */
function validar(rota: unknown, solicitacao: unknown): string[] {
  const r = registro(rota), s = registro(solicitacao);
  const d = registro(r.destino), ins = registro(s.insercao);
  const faltas: string[] = [];
  const exigir = (ok: boolean, campo: string) => { if (!ok) faltas.push(campo); };
  exigir(texto(r.id), 'rota.id');
  exigir(turnos.includes(String(r.turno)), 'rota.turno');
  exigir(texto(d.id), 'rota.destino.id');
  exigir(minuto(d.horarioInicioAula) && positivo(d.horarioInicioAula), 'rota.destino.horarioInicioAula');
  exigir(naoNegativo(d.margemChegadaMin), 'rota.destino.margemChegadaMin');
  exigir(inteiro(r.capacidadeVeiculo) && positivo(r.capacidadeVeiculo), 'rota.capacidadeVeiculo');
  exigir(minuto(r.chegadaPlanejadaDestino), 'rota.chegadaPlanejadaDestino');
  exigir(naoNegativo(r.bufferPiorCasoMin), 'rota.bufferPiorCasoMin');
  exigir(r.limiteTempoABordoMin === null || positivo(r.limiteTempoABordoMin), 'rota.limiteTempoABordoMin');
  exigir(texto(s.destinoId), 'solicitacao.destinoId');
  exigir(turnos.includes(String(s.turno)), 'solicitacao.turno');
  exigir(s.contratacao === 'mensal' || s.contratacao === 'avulso', 'solicitacao.contratacao');
  exigir(minuto(ins.horarioPassagemPlanejado), 'solicitacao.insercao.horarioPassagemPlanejado');
  exigir(naoNegativo(ins.atrasoAdicionalMin), 'solicitacao.insercao.atrasoAdicionalMin');
  exigir(Array.isArray(r.pontos), 'rota.pontos');
  const pontos: unknown[] = Array.isArray(r.pontos) ? r.pontos : [];
  exigir(inteiro(ins.indice) && ins.indice <= pontos.length, 'solicitacao.insercao.indice');
  const ids = new Set<string>();
  pontos.forEach((p, i) => {
    const ponto = registro(p), prefixo = `rota.pontos[${i}]`;
    exigir(texto(ponto.id) && !ids.has(ponto.id), `${prefixo}.id`);
    if (texto(ponto.id)) ids.add(ponto.id);
    exigir(minuto(ponto.horarioPlanejado), `${prefixo}.horarioPlanejado`);
    exigir(inteiro(ponto.ocupacaoTrechoSeguinte), `${prefixo}.ocupacaoTrechoSeguinte`);
    exigir(naoNegativo(ponto.toleranciaAtrasoMin), `${prefixo}.toleranciaAtrasoMin`);
    const anterior = registro(pontos[i - 1]).horarioPlanejado;
    if (numero(ponto.horarioPlanejado) && numero(anterior)) {
      exigir(ponto.horarioPlanejado >= anterior, `${prefixo}.ordemCronologica`);
    }
    if (numero(ponto.horarioPlanejado) && numero(r.chegadaPlanejadaDestino)) {
      exigir(ponto.horarioPlanejado <= r.chegadaPlanejadaDestino, `${prefixo}.antesDoDestino`);
    }
  });
  if (s.janelaDesejada !== undefined) {
    const j = registro(s.janelaDesejada);
    exigir(minuto(j.desejadoMin), 'solicitacao.janelaDesejada.desejadoMin');
    exigir(naoNegativo(j.antesMin), 'solicitacao.janelaDesejada.antesMin');
    exigir(naoNegativo(j.depoisMin), 'solicitacao.janelaDesejada.depoisMin');
  }
  if (s.contratacao === 'avulso') {
    exigir(dataCivil(s.dataAvulso), 'solicitacao.dataAvulso');
    exigir(inteiro(s.folgaAvulsoAssentos), 'solicitacao.folgaAvulsoAssentos');
  }
  // A inserção acontece ANTES do ponto de mesmo índice; length significa após o último.
  if (inteiro(ins.indice) && minuto(ins.horarioPassagemPlanejado) && naoNegativo(ins.atrasoAdicionalMin)) {
    const anterior = registro(pontos[ins.indice - 1]).horarioPlanejado;
    const seguinte = ins.indice < pontos.length
      ? registro(pontos[ins.indice]).horarioPlanejado : r.chegadaPlanejadaDestino;
    if (numero(anterior)) exigir(ins.horarioPassagemPlanejado >= anterior, 'solicitacao.insercao.ordemCronologica');
    if (numero(seguinte)) exigir(ins.horarioPassagemPlanejado <= seguinte + ins.atrasoAdicionalMin, 'solicitacao.insercao.antesDoProximoPonto');
  }
  return faltas;
}

export function avaliarEncaixe(rota: RotaInstancia, solicitacao: SolicitacaoAluno): ResultadoEncaixe {
  const vazio: ResultadoEncaixe = {
    elegivel: false, nivel: 'sob_consulta', motivos: [], precisaRenegociacao: false, dadosFaltantes: [],
  };
  const r = registro(rota), s = registro(solicitacao), d = registro(r.destino);
  // Só compara campos conhecidos; ausência não é incompatibilidade comprovada.
  if ((turnos.includes(String(r.turno)) && turnos.includes(String(s.turno)) && r.turno !== s.turno)
    || (texto(d.id) && texto(s.destinoId) && d.id !== s.destinoId)) {
    return { ...vazio, nivel: 'indisponivel', motivos: ['Turno ou destino incompatível'] };
  }
  const dadosFaltantes = validar(rota, solicitacao);
  // Falta de data/folga do avulso não impede calcular impacto ou detectar falhas duras.
  const faltasCalculo = dadosFaltantes.filter(c => c !== 'solicitacao.dataAvulso' && c !== 'solicitacao.folgaAvulsoAssentos');
  if (faltasCalculo.length) {
    return { ...vazio, dadosFaltantes, motivos: ['Dados ausentes ou inválidos para avaliar o encaixe'] };
  }
  const { indice, horarioPassagemPlanejado, atrasoAdicionalMin } = solicitacao.insercao;
  const passagemEstimada = horarioPassagemPlanejado + rota.bufferPiorCasoMin;
  const chegadaAntes = rota.chegadaPlanejadaDestino + rota.bufferPiorCasoMin;
  const chegadaEstimadaDestino = chegadaAntes + atrasoAdicionalMin;
  const tempoABordoMin = chegadaEstimadaDestino - passagemEstimada;
  // Evita que somas extremas produzam Infinity e aparentem um resultado válido.
  if (![passagemEstimada, chegadaAntes, chegadaEstimadaDestino, tempoABordoMin].every(Number.isFinite)) {
    return { ...vazio, dadosFaltantes: [...dadosFaltantes, 'temposCalculados'], motivos: ['Tempos calculados fora do intervalo numérico válido'] };
  }
  const motivos: string[] = [];
  let bloqueado = false, condicional = false, precisaRenegociacao = false;
  const bloquear = (motivo: string) => { bloqueado = true; motivos.push(motivo); };
  // Inclui a parte do trecho anterior dividida pelo novo embarque.
  if (rota.pontos.slice(Math.max(0, indice - 1)).some(p => p.ocupacaoTrechoSeguinte + 1 > rota.capacidadeVeiculo)) {
    bloquear('Sem assento em um dos trechos');
  }
  if (chegadaEstimadaDestino > rota.destino.horarioInicioAula - rota.destino.margemChegadaMin) {
    bloquear('Chegaria tarde demais para a aula');
  }
  if (rota.pontos.slice(indice).some(p => atrasoAdicionalMin > p.toleranciaAtrasoMin)) {
    precisaRenegociacao = true;
    motivos.push('Depende de renegociar o horário de outro passageiro');
  }
  const j = solicitacao.janelaDesejada;
  if (j && (passagemEstimada < j.desejadoMin - j.antesMin || passagemEstimada > j.desejadoMin + j.depoisMin)) {
    precisaRenegociacao = true;
    motivos.push('Fora da janela desejada do aluno');
  }
  if (rota.limiteTempoABordoMin === null) {
    condicional = true;
    motivos.push('Limite de tempo a bordo pendente de validação legal');
  } else if (tempoABordoMin > rota.limiteTempoABordoMin) {
    bloquear('Tempo a bordo acima do limite');
  }
  if (solicitacao.contratacao === 'avulso') {
    condicional = true;
    if (solicitacao.folgaAvulsoAssentos === 0) bloquear('Sem folga de assentos para avulso');
    motivos.push('Avulso depende de confirmação do dia');
  }
  if (dadosFaltantes.length) motivos.push('Dados ausentes ou inválidos para confirmar o encaixe');
  const nivel = bloqueado ? 'indisponivel'
    : condicional || precisaRenegociacao || dadosFaltantes.length ? 'sob_consulta' : 'disponivel';
  if (!motivos.length) motivos.push('Encaixe compatível com os dados informados');
  return {
    elegivel: nivel !== 'indisponivel' && dadosFaltantes.length === 0,
    nivel, motivos, dadosFaltantes, precisaRenegociacao,
    passagemEstimada, chegadaEstimadaDestino, tempoABordoMin,
    impacto: {
      chegadaAntes, chegadaDepois: chegadaEstimadaDestino,
      folgaAntesMin: rota.destino.horarioInicioAula - chegadaAntes,
      folgaDepoisMin: rota.destino.horarioInicioAula - chegadaEstimadaDestino,
    },
  };
}

/** O chamador deve fornecer o estado atual; não reserva assento nem consulta banco. */
export function revalidarAntesDeConfirmar(rota: RotaInstancia, solicitacao: SolicitacaoAluno): ResultadoEncaixe {
  return avaliarEncaixe(rota, solicitacao);
}
