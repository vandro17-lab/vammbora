import type { Rota, StatusRota, Veiculo } from '@/types/motorista';
import { validarRota } from '@/lib/ocupacao-rota';

/**
 * O que o botão "Salvar" do construtor faz (Etapa 2C).
 *
 * - Rota em RASCUNHO: continua rascunho (concluir é outro botão, com revisão).
 * - Rota já CONCLUÍDA (o motorista está administrando passageiros): se os dados
 *   ESTRUTURAIS continuam válidos, salva e CONTINUA concluída — segue oferecida
 *   na busca sem nenhuma etapa extra de publicação. "Estruturais" = as mesmas
 *   regras que já bloqueiam a conclusão (`validarRota`): capacidade por trecho,
 *   embarque antes do desembarque, todo aluno com destino, escola do catálogo,
 *   paradas confirmadas e ao menos um aluno.
 * - Concluída, mas com problema estrutural: NÃO rebaixa sozinha para rascunho
 *   (a rota sumiria da busca sem o motorista saber). Pede uma escolha explícita.
 *
 * Horários que "não fecham" NÃO entram aqui: são avisos (decisão de produto) e
 * a busca já os trata com cautela. Nenhum cálculo de encaixe é feito/alterado.
 */
export type DecisaoSalvar =
  | { tipo: 'salvar'; status: StatusRota; continuaConcluida: boolean }
  | { tipo: 'escolher'; problemas: string[] };

export function decidirSalvar(rota: Rota, veiculo: Veiculo | null): DecisaoSalvar {
  if (rota.status !== 'concluida') return { tipo: 'salvar', status: 'rascunho', continuaConcluida: false };
  const problemas = validarRota(rota, veiculo);
  if (problemas.length === 0) return { tipo: 'salvar', status: 'concluida', continuaConcluida: true };
  return { tipo: 'escolher', problemas: [...new Set(problemas.map((p) => p.mensagem))] };
}

/** Mensagem depois de salvar uma rota que continua concluída. */
export function avisoRotaConcluidaSalva(rota: Pick<Rota, 'ofertaPausada'>): string {
  return rota.ofertaPausada
    ? 'Rota salva. Ela continua concluída, com a oferta pausada.'
    : 'Rota salva. Vagas recalculadas; ela continua oferecida na busca.';
}
