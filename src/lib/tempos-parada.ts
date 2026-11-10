/**
 * TEMPO PARADO NAS PARADAS — regra única do app (minutos).
 *
 * Toda conta de horário (duração da rota, plano de horários do motorista,
 * sugestão de ordem, simulador de encaixe e o horário estimado que a família
 * vê na busca) soma o tempo de DIREÇÃO com o tempo PARADO, pela mesma regra:
 *
 *  - CASA: o tempo de atendimento informado de cada aluno; sem informação,
 *    `ATENDIMENTO_CASA_PADRAO_MIN` por aluno. Vários alunos na mesma casa
 *    somam (um de cada vez).
 *  - ESCOLA: `PARADA_ESCOLA_MIN` por parada de escola, para o grupo todo
 *    embarcar ou desembarcar — não por aluno.
 *
 * Os padrões são provisórios: valem só enquanto não houver dado informado.
 */
export const ATENDIMENTO_CASA_PADRAO_MIN = 2;
export const PARADA_ESCOLA_MIN = 3;

/** Tempo de atendimento de um aluno na casa dele. */
export const atendimentoNaCasa = (aluno: { atendimentoMin?: number | null }): number =>
  typeof aluno.atendimentoMin === 'number' && aluno.atendimentoMin >= 0 ? aluno.atendimentoMin : ATENDIMENTO_CASA_PADRAO_MIN;
