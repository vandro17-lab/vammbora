import type { Rota } from '@/types/motorista';
import type { ResultadoRotaReal } from '@/lib/busca-rotas-reais';
import { nomeDestinoParaExibicao } from '@/lib/utils';

/**
 * Regras do SIMULADOR do motorista que não dependem de tela. O veredito em si
 * vem de `avaliarRotaDetalhada` (busca-rotas-reais) — a mesma função da busca
 * das famílias; aqui ficam só a lista de escolas simuláveis e o selo exibido.
 */

export interface EscolaOpcao {
  id: string; nome: string;
  /** Já é parada da rota, ou é uma escola que o motorista ACEITA incluir (ainda sem parada). */
  origem: 'percurso' | 'aceita';
}

/** Escolas simuláveis nesta rota: as do percurso e as que o motorista aceita
 *  incluir — as mesmas que a busca das famílias considera. */
export function escolasSimulaveis(rota: Rota, nomeDoCatalogo: (destinoId: string) => string | undefined = () => undefined): EscolaOpcao[] {
  const vistos = new Map<string, EscolaOpcao>();
  for (const p of rota.paradas) {
    if (p.tipo === 'escola' && p.destinoId && !vistos.has(p.destinoId)) {
      vistos.set(p.destinoId, { id: p.destinoId, origem: 'percurso', nome: nomeDestinoParaExibicao(p.destinoNome || nomeDoCatalogo(p.destinoId) || p.rotulo || 'Escola') });
    }
  }
  for (const e of rota.escolasDisponiveis ?? []) {
    if (e.destinoId && !vistos.has(e.destinoId)) {
      vistos.set(e.destinoId, { id: e.destinoId, origem: 'aceita', nome: nomeDestinoParaExibicao(e.destinoNome || nomeDoCatalogo(e.destinoId) || 'Escola') });
    }
  }
  return [...vistos.values()];
}

/** Selo com o MESMO veredito que a família recebe na busca para este pedido. */
export function seloDoResultado(p: ResultadoRotaReal): { titulo: string; subtitulo: string; tom: 'ok' | 'atencao' | 'neutro' } {
  if (p.status === 'compativel') return { tom: 'ok', titulo: 'Compatível', subtitulo: 'Sem passar do horário da escola e respeitando quem já está na rota.' };
  if (p.status === 'sob_confirmacao') return { tom: 'atencao', titulo: 'Cabe, sob confirmação', subtitulo: p.motivo };
  if (p.status === 'incompativel') return { tom: 'neutro', titulo: 'Não encaixa nesta rota', subtitulo: 'Calculado com os trajetos das ruas e os compromissos atuais.' };
  if (p.pendencia === 'avaliacao_incompleta') return { tom: 'atencao', titulo: 'Avaliação incompleta', subtitulo: 'O cálculo não foi concluído — isso não significa que o aluno não cabe.' };
  return { tom: 'atencao', titulo: 'Faltam dados para calcular', subtitulo: 'Complete o cadastro da rota para avaliar este aluno.' };
}

/* ------------------------- confirmação da inclusão ------------------------- */

/**
 * A CONFIRMAÇÃO DEFINITIVA do encaixe (gravar o novo aluno na rota a partir de
 * uma simulação) está DESATIVADA. Não ligue esta chave sem cumprir TODOS os
 * requisitos abaixo — a função `confirmar_encaixe_rota` da migração 0009 não os
 * cumpre (ver `docs/REVISAO-FLUXOS-AFETADOS.md`, seção "Confirmação").
 */
export const CONFIRMACAO_DE_ENCAIXE_HABILITADA = false as const;

/** O que falta para a confirmação poder ser ligada com segurança. */
export const REQUISITOS_DA_CONFIRMACAO: readonly string[] = [
  'Revalidar no SERVIDOR a versão da rota e da van usadas na simulação (rota, alunos, escolas, horários, lugares, reservas e monitor).',
  'Recalcular no SERVIDOR horários e capacidade por trecho com trajetos reais imediatamente antes de gravar — hoje a validação é só do navegador.',
  'Gravar de forma atômica a parada (ou as paradas, quando a escola entra junto), a renumeração da ordem e o aluno, com os campos de compromisso (horário, flexibilidade, atendimento).',
  'Bloquear duas inclusões simultâneas na mesma última vaga (trava da rota + conferência de versão + capacidade conferida dentro da transação).',
  'Registrar a aprovação do motorista quando o encaixe depende dela (sair mais cedo, mudar a ordem, incluir escola).',
  'Não alterar viagens em andamento: a rota confirmada vale a partir da próxima viagem.',
];
