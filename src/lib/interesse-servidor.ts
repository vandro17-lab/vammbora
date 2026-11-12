/**
 * PRÉ-LANÇAMENTO — núcleo do endpoint /api/interesse (sem dependência de
 * plataforma: recebe a requisição já lida e as dependências por parâmetro,
 * para poder ser testado sem rede e sem banco).
 *
 * Fluxo: método → origem → tipo de conteúdo → tamanho → JSON → isca anti-robô →
 * validação (mesmas regras do formulário) → gravação → resposta.
 * Só responde sucesso DEPOIS de o banco confirmar a gravação.
 */
import { CAMPO_ISCA, ehTipoInteresse, validarInteresse, type ErrosInteresse, type PayloadInteresse } from './interesse';

/** Tamanho máximo do corpo aceito (o formulário inteiro cabe em ~1 KB). */
export const CORPO_MAX_BYTES = 8 * 1024;

export interface RequisicaoInteresse {
  metodo: string | undefined;
  /** Cabeçalho Origin (navegadores sempre enviam em POST). */
  origem: string | null;
  /** Host público da requisição (x-forwarded-host ou host). */
  host: string | null;
  tipoConteudo: string | null;
  corpo: string;
  ip: string;
}

export type ResultadoGravacao =
  | { ok: true }
  | { ok: false; erro: 'limite' | 'invalido' | 'indisponivel' };

export interface DependenciasInteresse {
  /** false = servidor sem configuração (sem chave do banco). */
  configurado: boolean;
  /** Limite rápido em memória (primeira barreira; o limite confiável é o do banco). */
  rajadaExcedida(ip: string): boolean;
  hashIp(ip: string): string;
  gravar(payload: PayloadInteresse, ipHash: string): Promise<ResultadoGravacao>;
}

export interface RespostaInteresse {
  status: number;
  corpo: { ok: true } | { ok: false; erro: string; mensagem: string; campos?: ErrosInteresse };
}

const MSG = {
  metodo: 'Método não permitido.',
  origem: 'Origem não autorizada.',
  conteudo: 'Envie os dados em JSON.',
  grande: 'Envio grande demais.',
  json: 'Não foi possível ler os dados enviados.',
  validacao: 'Confira os campos destacados e tente novamente.',
  limite: 'Recebemos muitos envios em pouco tempo. Aguarde alguns minutos e tente novamente.',
  indisponivel: 'Não foi possível registrar seu interesse agora. Seus dados não foram salvos — tente novamente em instantes.',
} as const;

const falha = (status: number, erro: string, mensagem: string, campos?: ErrosInteresse): RespostaInteresse =>
  ({ status, corpo: campos ? { ok: false, erro, mensagem, campos } : { ok: false, erro, mensagem } });

/** Mesma origem? Compara o host do cabeçalho Origin com o host da requisição. */
function origemPermitida(origem: string | null, host: string | null): boolean {
  if (!origem) return true; // chamadas fora de navegador não enviam Origin; CORS não se aplica
  if (!host) return false;
  try { return new URL(origem).host.toLowerCase() === host.toLowerCase(); }
  catch { return false; }
}

export async function processarInteresse(req: RequisicaoInteresse, deps: DependenciasInteresse): Promise<RespostaInteresse> {
  if (req.metodo !== 'POST') return falha(405, 'metodo', MSG.metodo);
  // Sem cabeçalhos CORS: outra origem não consegue ler a resposta; aqui também
  // recusamos gravar pedidos vindos de páginas de terceiros.
  if (!origemPermitida(req.origem, req.host)) return falha(403, 'origem', MSG.origem);
  if (!(req.tipoConteudo ?? '').toLowerCase().includes('application/json')) return falha(415, 'conteudo', MSG.conteudo);
  if (new TextEncoder().encode(req.corpo).length > CORPO_MAX_BYTES) return falha(413, 'grande', MSG.grande);
  if (deps.rajadaExcedida(req.ip)) return falha(429, 'limite', MSG.limite);

  let dados: unknown;
  try { dados = JSON.parse(req.corpo || 'null'); } catch { return falha(400, 'json', MSG.json); }
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return falha(400, 'json', MSG.json);
  const d = dados as Record<string, unknown>;

  // Robô preencheu o campo invisível: responde como sucesso e NÃO grava nada
  // (não ensina o robô a contornar). Pessoas não veem nem alcançam esse campo.
  if (typeof d[CAMPO_ISCA] === 'string' && d[CAMPO_ISCA].trim() !== '') return { status: 201, corpo: { ok: true } };

  if (!ehTipoInteresse(d.tipo)) return falha(422, 'validacao', MSG.validacao);
  const v = validarInteresse(d.tipo, d.dados);
  if (!v.ok) return falha(422, 'validacao', MSG.validacao, v.erros);

  if (!deps.configurado) return falha(503, 'indisponivel', MSG.indisponivel);

  let r: ResultadoGravacao;
  try { r = await deps.gravar(v.payload, deps.hashIp(req.ip)); }
  catch { return falha(503, 'indisponivel', MSG.indisponivel); }

  if (r.ok) return { status: 201, corpo: { ok: true } };
  if (r.erro === 'limite') return falha(429, 'limite', MSG.limite);
  if (r.erro === 'invalido') return falha(422, 'validacao', MSG.validacao);
  return falha(503, 'indisponivel', MSG.indisponivel);
}

/** Interpreta o retorno da função registrar_interesse_lancamento. */
export function interpretarRetornoBanco(data: unknown, erro: unknown): ResultadoGravacao {
  if (erro || !data || typeof data !== 'object') return { ok: false, erro: 'indisponivel' };
  const r = data as { ok?: unknown; erro?: unknown; resultado?: unknown };
  // Sucesso só com confirmação explícita de gravação (novo registro ou reenvio registrado).
  if (r.ok === true && (r.resultado === 'criado' || r.resultado === 'reenviado')) return { ok: true };
  if (r.ok === false && r.erro === 'limite') return { ok: false, erro: 'limite' };
  if (r.ok === false && r.erro === 'invalido') return { ok: false, erro: 'invalido' };
  return { ok: false, erro: 'indisponivel' };
}

/** Limitador simples por IP em memória (por instância). */
export function criarLimitadorRajada(max = 10, janelaMs = 60_000, agora: () => number = Date.now) {
  const baldes = new Map<string, { n: number; fim: number }>();
  return (ip: string): boolean => {
    const t = agora();
    if (baldes.size > 5000) for (const [k, b] of baldes) if (t > b.fim) baldes.delete(k);
    const b = baldes.get(ip);
    if (!b || t > b.fim) { baldes.set(ip, { n: 1, fim: t + janelaMs }); return false; }
    b.n += 1;
    return b.n > max;
  };
}
