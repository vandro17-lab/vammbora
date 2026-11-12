/**
 * PRÉ-LANÇAMENTO — envio do formulário para /api/interesse.
 *
 * Só devolve `ok: true` quando o servidor responde 201 com `{ ok: true }`, ou
 * seja, depois de o banco confirmar a gravação. Qualquer outra situação
 * (sem rede, servidor fora, resposta inesperada) é erro — nunca sucesso.
 */
import { CAMPO_ISCA, type DadosInteresse, type ErrosInteresse, type TipoInteresse } from './interesse';

export type ResultadoEnvio =
  | { ok: true }
  | { ok: false; motivo: 'validacao' | 'limite' | 'indisponivel' | 'rede'; mensagem: string; campos?: ErrosInteresse };

export const MENSAGEM_REDE =
  'Sem conexão com o servidor. Verifique sua internet e tente novamente — seus dados continuam preenchidos.';
export const MENSAGEM_INDISPONIVEL =
  'Não foi possível registrar seu interesse agora. Seus dados continuam preenchidos — tente novamente em instantes.';

const TEMPO_MAX_MS = 20_000;

export async function enviarInteresse(
  tipo: TipoInteresse,
  dados: DadosInteresse,
  isca = '',
  buscar: typeof fetch = fetch,
): Promise<ResultadoEnvio> {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TEMPO_MAX_MS);
  let resposta: Response;
  try {
    resposta = await buscar('/api/interesse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, dados, [CAMPO_ISCA]: isca }),
      signal: controle.signal,
      cache: 'no-store',
    });
  } catch {
    return { ok: false, motivo: 'rede', mensagem: MENSAGEM_REDE };
  } finally {
    clearTimeout(relogio);
  }

  let corpo: { ok?: unknown; mensagem?: unknown; campos?: unknown } | null = null;
  try { corpo = await resposta.json(); } catch { corpo = null; }

  if (resposta.status === 201 && corpo?.ok === true) return { ok: true };

  const mensagem = typeof corpo?.mensagem === 'string' ? corpo.mensagem : MENSAGEM_INDISPONIVEL;
  if (resposta.status === 422) {
    const campos = corpo?.campos && typeof corpo.campos === 'object' ? (corpo.campos as ErrosInteresse) : undefined;
    return { ok: false, motivo: 'validacao', mensagem, campos };
  }
  if (resposta.status === 429) return { ok: false, motivo: 'limite', mensagem };
  return { ok: false, motivo: 'indisponivel', mensagem: resposta.status >= 500 && typeof corpo?.mensagem === 'string' ? mensagem : MENSAGEM_INDISPONIVEL };
}
