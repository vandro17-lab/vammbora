import type { CriteriosBusca, Motorista, Destino, ModalidadeTrajeto } from '@/types';
import { TURNO_LABEL } from '@/lib/utils';
import { contextoDoInteresse, linhasDoContexto } from '@/lib/contexto-interesse';

const MODALIDADE_LABEL: Record<ModalidadeTrajeto, string> = {
  ida: 'somente ida',
  volta: 'somente volta',
  ambos: 'ida e volta',
};

/**
 * Monta a mensagem pronta de WhatsApp, incluindo os critérios da busca
 * (escola, turno, mensal/avulso + data, ida/volta).
 *
 * PRIVACIDADE: NÃO inclui o endereço/ponto de embarque automaticamente. Mesmo que
 * a família tenha digitado um endereço livre na busca, ele NÃO é enviado — a
 * própria família decide o que revelar ao combinar o embarque na conversa.
 * A mensagem é só uma sugestão: a família revisa e envia por conta própria —
 * o app nunca envia nada sozinho. Ela leva o contexto do que foi buscado
 * (sentido e o horário de cada sentido) e deixa claro que contato não reserva vaga.
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
  if (criterios?.modalidade) {
    linhas.push(`Trajeto: ${MODALIDADE_LABEL[criterios.modalidade]}.`);
    // Horário de CADA sentido (ida: chegar até; volta: liberado a partir de).
    const comHorario = contextoDoInteresse(criterios).trechos.some((t) => t.horarioMin != null);
    if (comHorario) linhas.push(...linhasDoContexto(contextoDoInteresse(criterios)));
  }
  // Não enviamos o endereço: a família combina o ponto de embarque na conversa.
  linhas.push('Essa rota tem vaga e passa perto de mim? Combino o ponto de embarque por aqui.');
  linhas.push('Sei que esta mensagem ainda não reserva a vaga.');

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
