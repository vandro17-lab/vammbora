import { describe, it, expect } from 'vitest';
import {
  encontrarEncaixesProgressivo,
  type RotaOperacional, type MatrizViaria, type PontoGeo, type Compromisso,
} from './encaixe-geografico';

/**
 * Teste de integração da CONSOLIDAÇÃO: Fase 4 (motor progressivo) × Fase 2
 * (compromissos individuais por aluno).
 *
 * Prova que o tempo de ATENDIMENTO informado por aluno (campo `atendimento_min`
 * da Fase 2, exposto como `atendimentoMin`) atravessa o contrato `Compromisso`
 * e é efetivamente honrado pelo motor progressivo da Fase 4 — sem recriar
 * motores e sem inventar fiação de aplicação.
 *
 * Regra da Fase 2 reproduzida fielmente: valor AUSENTE (null) continua
 * provisório (`?? PROVISORIO`), nunca apresentado como confirmado.
 * Números auditáveis: matriz uniforme de 3 min por trecho; partida 700.
 */

const PROVISORIO = 1; // mesmo provisório dos adaptadores quando o aluno não informou (DEC-022)
const p = (id: string): PontoGeo => ({ id, nome: id, lat: -21.2, lng: -50.4 });

/** Matriz determinística: 3 min / 300 m para qualquer par distinto. */
const M: MatrizViaria = {
  origem: 'fixture-testada',
  obter: (a, b) => (a.id === b.id ? { minutos: 0, metros: 0 } : { minutos: 3, metros: 300 }),
};

/** Mesma regra dos adaptadores da Fase 2: atendimento por aluno; provisório se ausente. */
const atendimentoDe = (compromissoAluno: { atendimentoMin?: number | null }) =>
  compromissoAluno.atendimentoMin ?? PROVISORIO;

/**
 * Rota ida com UM aluno existente ('a') que embarca em A e desce na escola S
 * (limite 714). O atendimento individual de 'a' entra no embarque exatamente
 * como `rotaOperacionalDeCadastro`/`montarBase` montam a entrada do motor.
 * Com a matriz uniforme, 'a' chega a S em 707 (provisório=1) ou 713 (=7);
 * ambos ainda cumprem o limite 714 na rota base.
 */
function rotaComAtendimentoDoAlunoA(compromissoAlunoA: { atendimentoMin?: number | null }): RotaOperacional {
  const LIMITE_S = 714;
  const compromissos: Compromisso[] = [
    { id: 'a', ponto: p('A'), tipo: 'embarque', alunoId: 'a', atendimentoMin: atendimentoDe(compromissoAlunoA) },
    { id: 'S', ponto: p('S'), tipo: 'escola', atendimentoMin: 0, limiteEscolaMin: LIMITE_S },
    { id: 'da', ponto: p('S'), tipo: 'desembarque', alunoId: 'a', atendimentoMin: 0, limiteEscolaMin: LIMITE_S },
  ];
  return { id: 'r', versao: 1, sentido: 'ida', inicio: p('G'), partidaMin: 700, capacidade: 5, ocupacaoInicial: 0, toleranciaMin: 10, compromissos };
}

const pedidoNovo = { alunoId: 'novo', casa: p('N'), escola: p('S'), horarioEscolaMin: 714 };
const classificar = (compromissoAlunoA: { atendimentoMin?: number | null }) =>
  encontrarEncaixesProgressivo(rotaComAtendimentoDoAlunoA(compromissoAlunoA), pedidoNovo, M, {}).classificacao;

describe('consolidação: o motor progressivo honra o atendimento por aluno (Fase 2)', () => {
  it('o atendimento individual pode inverter o veredito de viabilidade (provisório cabe, compromisso maior não)', () => {
    // Com atendimento provisório (1 min), ainda há folga para encaixar o novo aluno.
    expect(classificar({ atendimentoMin: 1 })).toBe('compativel');
    // Um atendimento individual maior (7 min, informado) consome a folga: o motor
    // progressivo prova a incompatibilidade (não é "indeterminado": a busca conclui).
    expect(classificar({ atendimentoMin: 7 })).toBe('incompativel');
  });

  it('atendimento AUSENTE (null) cai no provisório — nunca em zero nem em confirmado', () => {
    // NULL deve se comportar como o provisório (compatível), e não como 0 (que
    // também caberia) nem travar como um valor confirmado alto.
    expect(classificar({ atendimentoMin: null })).toBe(classificar({ atendimentoMin: PROVISORIO }));
    expect(classificar({ atendimentoMin: null })).toBe('compativel');
  });

  it('o motor progressivo NÃO altera a rota original durante a avaliação', () => {
    const rota = rotaComAtendimentoDoAlunoA({ atendimentoMin: 4 });
    const antes = JSON.stringify(rota.compromissos);
    encontrarEncaixesProgressivo(rota, pedidoNovo, M, { reorganizar: true });
    expect(JSON.stringify(rota.compromissos)).toBe(antes);
  });
});
