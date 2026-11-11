import type { MatrizViaria, PontoGeo, Trecho } from '@/engine/encaixe-geografico';

/**
 * Matriz viária REAL para a BUSCA DAS FAMÍLIAS, montada NO SERVIDOR (a chave do
 * provedor nunca vai ao navegador). Consulta o Geoapify Route Matrix e indexa
 * os trechos por COORDENADA — assim serve a qualquer ponto que o motor monte
 * (parada, casa da família, escola do catálogo), sem depender de ids.
 *
 * Nunca inventa tempo: par não consultado ou sem trajeto devolve `null`, e o
 * motor recusa o encaixe ("trecho indisponível").
 */

export const LIMITE_PONTOS_MATRIZ = 25;

type Coord = { lat: number; lng: number };
const chave = (p: Coord): string => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
const valido = (p: Coord): boolean =>
  !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

/** Pontos distintos (por coordenada), na ordem recebida. */
export function pontosDistintos(pontos: Coord[]): Coord[] {
  const vistos = new Set<string>();
  const out: Coord[] = [];
  for (const p of pontos) {
    if (!valido(p)) continue;
    const k = chave(p);
    if (!vistos.has(k)) { vistos.add(k); out.push({ lat: p.lat, lng: p.lng }); }
  }
  return out;
}

/** Acumulador de trechos reais (várias rotas somam pares na mesma matriz). */
export class MatrizPorCoordenadas implements MatrizViaria {
  readonly origem = 'geoapify' as const;
  private readonly trechos = new Map<string, Trecho>();

  /** Registra as tabelas (linhas = origem, colunas = destino) de um conjunto de pontos. */
  adicionar(pontos: Coord[], tempos: (number | null)[][], distancias: (number | null)[][]): void {
    pontos.forEach((de, i) => pontos.forEach((para, j) => {
      const min = tempos[i]?.[j];
      const met = distancias[i]?.[j];
      if (i === j || typeof min !== 'number' || typeof met !== 'number' || !Number.isFinite(min) || !Number.isFinite(met)) return;
      this.trechos.set(`${chave(de)}>${chave(para)}`, { minutos: Math.max(0, Math.round(min * 100) / 100), metros: Math.max(0, Math.round(met)) });
    }));
  }

  obter(de: PontoGeo, para: PontoGeo): Trecho | null {
    if (!valido(de) || !valido(para)) return null;
    if (de.id === para.id || chave(de) === chave(para)) return { minutos: 0, metros: 0 };
    return this.trechos.get(`${chave(de)}>${chave(para)}`) ?? null;
  }
}

interface RespostaGeoapify {
  sources_to_targets?: Array<Array<{ source_index?: number; target_index?: number; distance?: number | null; time?: number | null }>>;
}

export interface TabelasViarias { tempos: (number | null)[][]; distancias: (number | null)[][] }

/** Rotas com mais pontos do que cabe em UMA consulta são calculadas em blocos
 *  (origens × destinos, cada lado com até `LIMITE_PONTOS_MATRIZ`). Acima deste
 *  teto a avaliação automática não é feita — e isso é "avaliação incompleta",
 *  nunca "não cabe". */
export const LIMITE_PONTOS_AVALIACAO = 50;

/** Quantas requisições ao provedor uma matriz de `n` pontos custa (0 = não calculável). */
export function consultasNecessarias(n: number): number {
  if (!Number.isInteger(n) || n < 2 || n > LIMITE_PONTOS_AVALIACAO) return 0;
  const grupos = Math.ceil(n / LIMITE_PONTOS_MATRIZ);
  return grupos * grupos;
}

/** Uma requisição ao provedor: tabela `origens` × `destinos`. `null` = falhou. */
export type ConsultaBloco = (origens: Coord[], destinos: Coord[]) => Promise<TabelasViarias | null>;

/**
 * Consulta o Geoapify Route Matrix para um BLOCO (origens × destinos, cada lado
 * com até `LIMITE_PONTOS_MATRIZ`) e devolve as tabelas de minutos/metros.
 * Devolve `null` em QUALQUER falha (sem chave, pontos demais, erro do provedor)
 * — o chamador decide o que fazer, mas nunca recebe um tempo inventado.
 */
export async function consultarBlocoViario(
  origens: Coord[],
  destinos: Coord[],
  apiKey: string | undefined,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 12000,
): Promise<TabelasViarias | null> {
  if (!apiKey || origens.length < 1 || destinos.length < 1 || origens.length > LIMITE_PONTOS_MATRIZ || destinos.length > LIMITE_PONTOS_MATRIZ
    || !origens.every(valido) || !destinos.every(valido)) return null;
  const url = new URL('https://api.geoapify.com/v1/routematrix');
  url.searchParams.set('apiKey', apiKey);
  const local = (p: Coord) => ({ location: [p.lng, p.lat] });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'drive', sources: origens.map(local), targets: destinos.map(local) }),
      signal: controller.signal,
    });
    if (!r.ok) return null;
    const linhas = ((await r.json()) as RespostaGeoapify).sources_to_targets;
    if (!Array.isArray(linhas) || linhas.length !== origens.length) return null;
    const tempos: (number | null)[][] = Array.from({ length: origens.length }, () => Array<number | null>(destinos.length).fill(null));
    const distancias: (number | null)[][] = Array.from({ length: origens.length }, () => Array<number | null>(destinos.length).fill(null));
    for (const linha of linhas) {
      for (const c of linha ?? []) {
        const i = c.source_index, j = c.target_index;
        if (typeof i !== 'number' || typeof j !== 'number' || i < 0 || j < 0 || i >= origens.length || j >= destinos.length) continue;
        if (typeof c.time === 'number' && Number.isFinite(c.time)) tempos[i][j] = Math.max(0, Math.round((c.time / 60) * 100) / 100); // fração de minuto: trecho curto não vira 1 min
        if (typeof c.distance === 'number' && Number.isFinite(c.distance)) distancias[i][j] = Math.max(0, Math.round(c.distance));
      }
    }
    return { tempos, distancias };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Matriz quadrada de até `LIMITE_PONTOS_MATRIZ` pontos numa única consulta. */
export async function consultarTabelasViarias(
  pontos: Coord[],
  apiKey: string | undefined,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 12000,
): Promise<TabelasViarias | null> {
  if (pontos.length < 2) return null;
  return consultarBlocoViario(pontos, pontos, apiKey, fetchFn, timeoutMs);
}

/**
 * Matriz COMPLETA de `pontos` (até `LIMITE_PONTOS_AVALIACAO`), em quantos
 * blocos forem necessários. Bloco que falha deixa as suas células `null` (o
 * motor trata como trecho sem dado — inconclusivo, nunca inventado) e é
 * contado em `blocosFalhos`. `null` = nenhum bloco respondeu ou pontos demais.
 */
export async function consultarTabelasEmBlocos(
  pontos: Coord[],
  consultar: ConsultaBloco,
): Promise<(TabelasViarias & { blocos: number; blocosFalhos: number }) | null> {
  const n = pontos.length;
  if (consultasNecessarias(n) === 0) return null;
  const grupos: number[][] = [];
  const tamanho = Math.ceil(n / Math.ceil(n / LIMITE_PONTOS_MATRIZ)); // grupos equilibrados
  for (let i = 0; i < n; i += tamanho) grupos.push(Array.from({ length: Math.min(tamanho, n - i) }, (_, k) => i + k));
  const tempos: (number | null)[][] = Array.from({ length: n }, () => Array<number | null>(n).fill(null));
  const distancias: (number | null)[][] = Array.from({ length: n }, () => Array<number | null>(n).fill(null));
  let blocos = 0, blocosFalhos = 0;
  await Promise.all(grupos.flatMap((go) => grupos.map(async (gd) => {
    blocos++;
    let t: TabelasViarias | null = null;
    try { t = await consultar(go.map((i) => pontos[i]), gd.map((j) => pontos[j])); } catch { t = null; }
    if (!t) { blocosFalhos++; return; }
    go.forEach((i, a) => gd.forEach((j, b) => {
      tempos[i][j] = t!.tempos[a]?.[b] ?? null;
      distancias[i][j] = t!.distancias[a]?.[b] ?? null;
    }));
  })));
  if (blocosFalhos === blocos) return null;
  return { tempos, distancias, blocos, blocosFalhos };
}
