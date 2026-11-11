import type { RespostaBuscaReal, SituacaoSentido } from '@/lib/busca-rotas-reais-cliente';

/**
 * Textos da busca das famílias (puros, sem tela). Cada situação tem a SUA
 * frase — nunca uma mensagem só para coisas diferentes:
 *  - ausência de oferta ... nenhuma rota deste sentido visita/aceita a escola;
 *  - incompatibilidade .... calculado pelas ruas: não cabe neste endereço/horário;
 *  - dados insuficientes .. falta cadastro na rota (repetir não resolve);
 *  - avaliação incompleta . ainda não calculado (continuar/tentar de novo resolve).
 * Nenhum texto cita aluno, endereço ou horário de quem já está na rota.
 */

export type TipoAviso = 'sem_oferta' | 'incompativel' | 'dados_insuficientes' | 'avaliacao_incompleta' | 'erro' | 'reavaliada' | 'so_demonstracao';
export interface AvisoBusca { tipo: TipoAviso; texto: string; acao?: 'continuar' | 'tentar' }

const rotas = (n: number) => (n === 1 ? '1 rota' : `${n} rotas`);
const nomeSentido = (s: 'ida' | 'volta') => (s === 'ida' ? 'ida' : 'volta');

export function avisosDoSentido(s: SituacaoSentido): AvisoBusca[] {
  if (s.estado === 'erro') {
    return [{ tipo: 'erro', acao: 'tentar', texto: `Não foi possível consultar as rotas de ${nomeSentido(s.sentido)} agora. O que já apareceu continua valendo.` }];
  }
  if (s.estado !== 'ok') return [];
  const out: AvisoBusca[] = [];
  if (s.reavaliada) {
    out.push({ tipo: 'reavaliada', texto: `As rotas de ${nomeSentido(s.sentido)} foram alteradas pelos motoristas enquanto você olhava. Descartamos o cálculo anterior e refizemos a avaliação com os dados atuais.` });
  }
  if (s.candidatas === 0) {
    return [...out, { tipo: 'sem_oferta', texto: `Ainda não há rota de ${nomeSentido(s.sentido)} cadastrada que visite esta escola ou aceite incluí-la.` }];
  }
  if (s.demonstrativas > 0 && s.encontradas === 0) {
    out.push({ tipo: 'so_demonstracao', texto: `As rotas de ${nomeSentido(s.sentido)} mostradas são de demonstração (fictícias): não representam vaga real nem recebem pedidos.` });
  }
  if (s.avaliacaoIncompleta > 0) {
    const n = s.avaliacaoIncompleta;
    out.push({
      tipo: 'avaliacao_incompleta',
      ...(s.semProvedor ? {} : { acao: s.continuacao ? 'continuar' as const : 'tentar' as const }),
      texto: `${rotas(n)} que ${n === 1 ? 'atende' : 'atendem'} esta escola ainda não ${n === 1 ? 'foi calculada' : 'foram calculadas'} com os trajetos reais das ruas`
        + (s.semProvedor ? ' (o cálculo pelas ruas não está disponível neste ambiente).' : '.')
        + ' Isso não significa que não há vaga.',
    });
  }
  if (s.dadosInsuficientes > 0) {
    const n = s.dadosInsuficientes;
    out.push({ tipo: 'dados_insuficientes', texto: `${rotas(n)} não ${n === 1 ? 'pôde' : 'puderam'} ser ${n === 1 ? 'avaliada' : 'avaliadas'} porque o cadastro do motorista está incompleto (van, endereço ou horário). Tentar de novo não muda isso.` });
  }
  if (s.incompativeis > 0) {
    const n = s.incompativeis;
    out.push({ tipo: 'incompativel', texto: `${rotas(n)} ${n === 1 ? 'foi calculada' : 'foram calculadas'} e não ${n === 1 ? 'encaixa' : 'encaixam'} neste endereço e horário sem prejudicar quem já usa a van.` });
  }
  return out;
}

/**
 * Aviso de PACOTE para "ida e volta": só há pacote quando os DOIS sentidos têm
 * opção. Uma ida válida sozinha nunca é apresentada como ida e volta.
 */
export function avisoIdaEVolta(r: RespostaBuscaReal): string | null {
  const ida = r.sentidos.find((s) => s.sentido === 'ida');
  const volta = r.sentidos.find((s) => s.sentido === 'volta');
  if (!ida || !volta) return null;
  const temIda = ida.encontradas > 0, temVolta = volta.encontradas > 0;
  if (temIda && temVolta) return 'Ida e volta são rotas independentes, cada uma com o seu horário (podem ser de motoristas diferentes). Confirme os dois trechos antes de fechar.';
  if (temIda) return 'Só encontramos opção para a IDA. Não há volta calculada para este pedido — o que aparece abaixo não é um pacote de ida e volta.';
  if (temVolta) return 'Só encontramos opção para a VOLTA. Não há ida calculada para este pedido — o que aparece abaixo não é um pacote de ida e volta.';
  return null;
}
