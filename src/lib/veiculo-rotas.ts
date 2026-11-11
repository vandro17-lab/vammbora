import type { Rota, Veiculo } from '@/types/motorista';
import { capacidadeAlunos, picoOcupacao } from '@/lib/ocupacao-rota';

/**
 * O QUE MUDA NAS ROTAS QUANDO A VAN MUDA (puro, sem rede).
 *
 * A capacidade de alunos de uma rota é sempre derivada da van no momento do
 * cálculo (lugares − monitor que ocupa lugar − reservas): não existe "vaga
 * guardada". Por isso, salvar a van com outro número de lugares já muda a
 * disponibilidade de TODAS as rotas que a usam, na próxima busca ou simulação.
 * Esta função só mostra ao motorista esse efeito — ela não altera rota nenhuma.
 */
export interface ImpactoNaRota {
  rotaId: string;
  nome: string;
  sentido: Rota['sentido'];
  /** Lugares para alunos antes e depois da mudança. */
  capacidadeAntes: number;
  capacidadeDepois: number;
  /** Maior número de alunos a bordo num trecho da rota (hoje). */
  pico: number;
  /**
   * - excede ........ já há mais alunos a bordo num trecho do que lugares: a
   *                   rota precisa ser revista (nenhum aluno é removido sozinho);
   * - sem_lugar ..... a rota fica sem lugar para aluno nenhum;
   * - menos_lugares . continua cabendo quem já está, mas com menos lugares livres;
   * - mais_lugares .. passa a ter mais lugares livres.
   */
  efeito: 'excede' | 'sem_lugar' | 'menos_lugares' | 'mais_lugares';
}

/** Rotas afetadas pela troca de `antes` por `depois` (mesma van, dados novos). */
export function impactoDaVanNasRotas(antes: Veiculo | null, depois: Veiculo, rotas: Rota[]): ImpactoNaRota[] {
  const out: ImpactoNaRota[] = [];
  for (const rota of rotas) {
    if (rota.veiculoId !== depois.id) continue;
    const capacidadeAntes = capacidadeAlunos(rota, antes);
    const capacidadeDepois = capacidadeAlunos(rota, depois);
    if (capacidadeAntes === capacidadeDepois) continue;
    const pico = picoOcupacao(rota);
    const efeito: ImpactoNaRota['efeito'] = pico > capacidadeDepois ? 'excede'
      : capacidadeDepois < 1 ? 'sem_lugar'
      : capacidadeDepois < capacidadeAntes ? 'menos_lugares' : 'mais_lugares';
    out.push({ rotaId: rota.id, nome: rota.nome || 'Rota', sentido: rota.sentido, capacidadeAntes, capacidadeDepois, pico, efeito });
  }
  // O que exige ação do motorista vem primeiro.
  const ordem = { excede: 0, sem_lugar: 1, menos_lugares: 2, mais_lugares: 3 } as const;
  return out.sort((a, b) => ordem[a.efeito] - ordem[b.efeito]);
}

/** Frase curta (pt-BR) de um impacto, para mostrar depois de salvar a van. */
export function textoDoImpacto(i: ImpactoNaRota): string {
  const nome = `“${i.nome}” (${i.sentido})`;
  if (i.efeito === 'excede') return `${nome}: há ${i.pico} alunos a bordo num trecho e a van passa a ter ${i.capacidadeDepois} lugar(es) para alunos. Revise a rota — nenhum aluno foi removido.`;
  if (i.efeito === 'sem_lugar') return `${nome}: a rota fica sem lugar para alunos e deixa de aparecer como opção nas buscas.`;
  return `${nome}: lugares para alunos passam de ${i.capacidadeAntes} para ${i.capacidadeDepois}. As próximas buscas e simulações já usam o novo número.`;
}
