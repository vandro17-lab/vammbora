import type { CriteriosBusca, Motorista, Destino } from '@/types';
import { TURNO_LABEL } from '@/lib/utils';

/**
 * Monta a mensagem pronta de WhatsApp SEM expor dados sensíveis desnecessários.
 * Nunca inclui endereço completo do aluno — apenas a região/bairro informado.
 */
export function montarMensagemWhatsApp(
  motorista: Motorista,
  criterios: CriteriosBusca | null,
  destino: Destino | null,
): string {
  const linhas: string[] = [];
  linhas.push(`Olá, ${motorista.nome.split(' ')[0]}! Encontrei sua van no Vambora.`);

  if (destino) {
    linhas.push(`Preciso de transporte para: ${destino.nome}.`);
  }
  if (criterios?.turno) {
    linhas.push(`Turno: ${TURNO_LABEL[criterios.turno]}.`);
  }
  if (criterios?.contratacao) {
    linhas.push(
      criterios.contratacao === 'mensal'
        ? 'Contratação: mensal.'
        : `Contratação: avulso${criterios.dataAvulso ? ` (${formatarData(criterios.dataAvulso)})` : ''}.`,
    );
  }
  if (criterios?.endereco) {
    // Apenas região/referência — a pessoa decide o que detalhar na conversa.
    linhas.push(`Região de embarque: ${criterios.endereco}.`);
  }
  linhas.push('Essa rota tem vaga e passa perto? Podemos combinar os detalhes por aqui?');

  return linhas.join('\n');
}

function formatarData(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Monta a URL wa.me com a mensagem codificada. Retorna null se telefone inválido. */
export function montarLinkWhatsApp(telefone: string, mensagem: string): string | null {
  const limpo = telefone.replace(/\D/g, '');
  // Telefone BR internacional: 55 + DDD(2) + número(8/9) = 12 ou 13 dígitos.
  if (limpo.length < 12 || limpo.length > 13) return null;
  return `https://wa.me/${limpo}?text=${encodeURIComponent(mensagem)}`;
}
