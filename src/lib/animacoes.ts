/**
 * Integração das animações ORIGINAIS da marca (arquivos em /public/animacoes,
 * usados sem modificação, dentro de <iframe>). Aqui ficam só as regras de
 * tempo — puras e testáveis.
 */

export const URL_ABERTURA = '/animacoes/vanbora-abertura.html?capture&bg=transparent';
export const URL_BUSCA = '/animacoes/vanbora-animacao.html?v=A';

/** Duração original da abertura (s) e a duração que o app exibe (s). */
export const ABERTURA_ORIGINAL_S = 4.2;
export const ABERTURA_EXIBIDA_S = 2.5;
/** Se a animação não ficar pronta nesse prazo, o app segue sem ela. */
export const ABERTURA_ESPERA_MAX_MS = 2000;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Tempo ORIGINAL (0–4,2 s) correspondente ao tempo decorrido na tela. A
 * reprodução é comprimida proporcionalmente (4,2 s → 2,5 s): nada é cortado,
 * do desenho do símbolo ao encerramento em tela vazia.
 */
export function tempoOriginalDaAbertura(decorridoS: number): number {
  return clamp01(decorridoS / ABERTURA_EXIBIDA_S) * ABERTURA_ORIGINAL_S;
}

/**
 * Opacidade do fundo preto atrás da abertura. Acompanha o encerramento da
 * própria animação (3,72–4,2 s do original, mesma curva), para a interface ser
 * revelada junto com o desaparecimento do logo.
 */
export function opacidadeFundoAbertura(tempoOriginalS: number): number {
  const t = clamp01((tempoOriginalS - 3.72) / (ABERTURA_ORIGINAL_S - 3.72));
  return 1 - t * t * (3 - 2 * t);
}

/** Tempo mínimo da animação de busca na tela (ms). */
export const BUSCA_MINIMO_MS = 3000;
/** Limite de espera pela consulta: depois disso vira erro (nunca fica presa). */
export const BUSCA_LIMITE_MS = 30000;

/** Quanto ainda falta (ms) para a animação de busca completar o mínimo. */
export function esperaRestanteDaBusca(iniciadaEm: number, agora: number, minimoMs = BUSCA_MINIMO_MS): number {
  return Math.max(0, Math.min(minimoMs, minimoMs - (agora - iniciadaEm)));
}
