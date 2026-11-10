import type { Destino } from '@/types';
import { nomeDestinoParaExibicao } from '@/lib/utils';
import { numeroDoEndereco } from '@/lib/endereco';
import { estimarPorVizinhos, type NumeroConhecido } from '@/lib/numero-estimado';

export interface SugestaoEndereco { rotulo: string; lat: number; lng: number }

/**
 * Precisão de um ponto geográfico. 'ajustado' = movido à mão; 'estimado' = o
 * mapa não tem o número, a posição foi calculada pelos números vizinhos da rua.
 */
export type Precisao = 'exato' | 'estimado' | 'rua' | 'aproximado' | 'ajustado';
export interface PontoPreciso { rotulo: string; lat: number; lng: number; precisao: Precisao }

/**
 * Separa a rua do número do endereço (espelha a lógica do proxy). Puro e
 * testável: usado no fallback sem chave e para montar a consulta.
 */
export function separarRuaNumero(texto: string, numero: string): { rua: string; num: string } {
  let rua = texto
    .replace(/,?\s*(ara[cç]atuba|s[aã]o paulo|\bsp\b|brasil|brazil)\b.*$/i, '')
    .trim();
  let num = String(numero ?? '').replace(/\D/g, '');
  if (num) {
    rua = rua.replace(new RegExp(`(?:,?\\s*n[º°o]?\\.?\\s*)?\\b${num}\\b`, 'i'), '').replace(/[,\s]+$/, '').trim();
  } else {
    const m = rua.match(/(?:,?\s*n[º°o]?\.?\s*)?(\d{1,6})\s*$/);
    if (m) { num = m[1]; rua = rua.slice(0, m.index).replace(/[,\s]+$/, '').trim(); }
  }
  return { rua: rua || texto.trim(), num };
}

// Centro aproximado de Araçatuba e caixa (bbox) para filtrar resultados.
export const ARACATUBA = { lat: -21.2089, lng: -50.4328 };
const BBOX = { latMin: -21.7, latMax: -20.7, lngMin: -51.0, lngMax: -49.9 };
export const dentroDeAracatuba = (lat: number, lng: number) =>
  lat >= BBOX.latMin && lat <= BBOX.latMax && lng >= BBOX.lngMin && lng <= BBOX.lngMax;

export function normalizarTexto(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Monta sugestões locais (bairros e escolas/faculdades) a partir dos destinos. */
export function locaisDeDestinos(destinos: Destino[]): SugestaoEndereco[] {
  const porBairro = new Map<string, { lat: number; lng: number; n: number }>();
  const escolas: SugestaoEndereco[] = [];
  for (const d of destinos) {
    const lat = d.lat;
    const lng = d.lng;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat === 0 && lng === 0) continue;
    escolas.push({ rotulo: `${nomeDestinoParaExibicao(d.nome)} — ${d.bairro}`, lat, lng });
    if (d.bairro) {
      const c = porBairro.get(d.bairro) ?? { lat: 0, lng: 0, n: 0 };
      porBairro.set(d.bairro, { lat: c.lat + lat, lng: c.lng + lng, n: c.n + 1 });
    }
  }
  const bairros: SugestaoEndereco[] = [...porBairro.entries()]
    .map(([b, v]) => ({ rotulo: `${b} (bairro)`, lat: v.lat / v.n, lng: v.lng / v.n }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  return [...bairros, ...escolas];
}

// Se o proxy /api/mapas não estiver configurado, paramos de tentá-lo (evita
// uma chamada 503 a cada tecla). Vale para toda a sessão da página.
let proxyIndisponivel = false;

// Memória curta das consultas já respondidas: digitar, apagar e redigitar o
// mesmo trecho não gasta novas consultas (o proxy limita por IP e, quando
// estoura, a busca caía para outro provedor com resultados diferentes).
const MEMORIA_MAX = 120;
const memoriaSugestoes = new Map<string, SugestaoEndereco[]>();
const memoriaPontos = new Map<string, PontoPreciso | null>();
const memoriaEstimativas = new Map<string, PontoPreciso | null>();
function lembrar<V>(mapa: Map<string, V>, chave: string, valor: V): V {
  if (mapa.size >= MEMORIA_MAX) mapa.delete(mapa.keys().next().value as string);
  mapa.set(chave, valor);
  return valor;
}
/** Só para testes: esquece consultas e o estado do proxy. */
export function reiniciarGeocodificacao(): void {
  memoriaSugestoes.clear(); memoriaPontos.clear(); memoriaEstimativas.clear(); proxyIndisponivel = false;
}

/**
 * Sugestões de endereço. Se o texto traz o NÚMERO do imóvel e o mapa não tem
 * esse número, repete a busca só com a rua — a pessoa continua vendo (e podendo
 * escolher) a rua, em vez de a lista sumir ao digitar o número.
 */
export async function buscarEnderecos(q: string, signal?: AbortSignal): Promise<SugestaoEndereco[]> {
  const chave = normalizarTexto(q);
  const memo = memoriaSugestoes.get(chave);
  if (memo) return memo;
  let achados = await consultarSugestoes(q, signal);
  if (achados.length === 0 && !signal?.aborted) {
    const { rua, num } = numeroDoEndereco(q);
    if (num && rua.length >= 3) achados = await consultarSugestoes(rua, signal);
  }
  return achados.length && !signal?.aborted ? lembrar(memoriaSugestoes, chave, achados) : achados;
}

/** Uma consulta de sugestões: proxy privado (Geoapify); se faltar, Photon (sem chave). */
async function consultarSugestoes(q: string, signal?: AbortSignal): Promise<SugestaoEndereco[]> {
  // 1) Proxy privado Geoapify (melhor qualidade + privacidade), se configurado.
  if (!proxyIndisponivel) {
    try {
      const r = await fetch('/api/mapas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operacao: 'autocompletar', texto: q }), signal,
      });
      if (r.status === 503) {
        proxyIndisponivel = true; // sem GEOAPIFY_API_KEY: cai para o Photon
      } else if (r.ok) {
        const d = (await r.json()) as { resultados?: SugestaoEndereco[] };
        // Mesma regra do provedor alternativo: só endereços da região atendida.
        const daRegiao = (Array.isArray(d.resultados) ? d.resultados : [])
          .filter((x) => x && typeof x.rotulo === 'string' && Number.isFinite(x.lat) && Number.isFinite(x.lng) && dentroDeAracatuba(x.lat, x.lng));
        if (daRegiao.length) return daRegiao;
      }
    } catch {
      /* segue para o fallback */
    }
  }

  // 2) Fallback SEM CHAVE: Photon (OpenStreetMap), enviesado para Araçatuba.
  try {
    const u = new URL('https://photon.komoot.io/api/');
    u.searchParams.set('q', `${q}, Araçatuba`);
    u.searchParams.set('lat', String(ARACATUBA.lat));
    u.searchParams.set('lon', String(ARACATUBA.lng));
    u.searchParams.set('limit', '8');
    const r = await fetch(u, { signal });
    if (!r.ok) return [];
    const d = (await r.json()) as {
      features?: Array<{ geometry: { coordinates: [number, number] }; properties: Record<string, string> }>;
    };
    const out: SugestaoEndereco[] = [];
    const vistos = new Set<string>();
    for (const f of d.features ?? []) {
      const [lng, lat] = f.geometry?.coordinates ?? [NaN, NaN];
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !dentroDeAracatuba(lat, lng)) continue;
      const p = f.properties ?? {};
      const via = p.street || p.name || '';
      const linha = via ? `${via}${p.housenumber ? ', ' + p.housenumber : ''}` : (p.name || '');
      const rotulo = [linha, p.district || p.suburb, p.city].filter(Boolean).join(', ');
      if (!rotulo || vistos.has(rotulo)) continue;
      vistos.add(rotulo);
      out.push({ rotulo, lat, lng });
      if (out.length >= 6) break;
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Geocodificação PRECISA que respeita o número da casa (geocodificação
 * estruturada do Geoapify via proxy). Sem chave, cai para o Photon lendo o
 * `housenumber` quando disponível. Devolve o ponto e a precisão, ou null.
 *
 * Com número no endereço, só devolve 'exato' quando o provedor CONFIRMOU o
 * número. `aceitarSemNumero`: se nenhum provedor tiver o número, devolve o
 * ponto da RUA com precisão 'rua' (nunca como exato) em vez de null — quem
 * chama informa a limitação e deixa ajustar no mapa.
 */
export async function geocodificarPreciso(
  texto: string, numero: string, signal?: AbortSignal, opcoes: { aceitarSemNumero?: boolean } = {},
): Promise<PontoPreciso | null> {
  const chave = `${normalizarTexto(texto)}|${numero}|${opcoes.aceitarSemNumero ? 1 : 0}`;
  if (memoriaPontos.has(chave)) return memoriaPontos.get(chave) ?? null;
  const ponto = await geocodificarSemMemoria(texto, numero, signal, opcoes);
  // Só guarda resposta de consulta concluída (nunca de uma consulta abortada).
  return signal?.aborted ? ponto : lembrar(memoriaPontos, chave, ponto);
}

async function geocodificarSemMemoria(
  texto: string, numero: string, signal: AbortSignal | undefined, opcoes: { aceitarSemNumero?: boolean },
): Promise<PontoPreciso | null> {
  const rua = texto.trim();
  if (rua.length < 3) return null;
  // Número em campo próprio: regra antiga. Tudo no mesmo texto: acha o número
  // onde ele estiver ("Rua X, 450, Centro" — formato das próprias sugestões).
  const estruturado = numero ? separarRuaNumero(rua, numero) : numeroDoEndereco(rua);
  const exigeNumeroExato = Boolean(estruturado.num);
  // Melhor ponto SEM o número confirmado (nível de rua), guardado para o fim.
  let soDaRua: PontoPreciso | null = null;
  const guardarRua = (p: { rotulo: string; lat: number; lng: number; precisao: Precisao }) => {
    if (!soDaRua && p.precisao !== 'aproximado' && dentroDeAracatuba(p.lat, p.lng)) soDaRua = { rotulo: p.rotulo, lat: p.lat, lng: p.lng, precisao: 'rua' };
  };
  const fim = (): PontoPreciso | null => (opcoes.aceitarSemNumero ? soDaRua : null);

  if (!proxyIndisponivel) {
    try {
      const r = await fetch('/api/mapas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operacao: 'geocodificar', texto: estruturado.rua, numero: estruturado.num }), signal,
      });
      if (r.status === 503) {
        proxyIndisponivel = true;
      } else if (r.ok) {
        const d = (await r.json()) as { ponto?: PontoPreciso | null };
        if (d.ponto && Number.isFinite(d.ponto.lat) && Number.isFinite(d.ponto.lng)) {
          if (!exigeNumeroExato || d.ponto.precisao === 'exato') return d.ponto;
          guardarRua(d.ponto); // achou a rua, não o número
        }
        // Proxy respondeu sem o número: ainda tentamos os fallbacks abaixo.
      }
    } catch {
      /* segue para o fallback */
    }
  }

  const { rua: via, num } = estruturado;

  // Fallback SEM CHAVE (1): Nominatim estruturado — resolve o NÚMERO da casa
  // melhor que o Photon (interpolação do OpenStreetMap), quando há número.
  if (num) {
    try {
      const u = new URL('https://nominatim.openstreetmap.org/search');
      u.searchParams.set('format', 'json');
      u.searchParams.set('addressdetails', '1');
      u.searchParams.set('limit', '1');
      u.searchParams.set('countrycodes', 'br');
      u.searchParams.set('city', 'Araçatuba');
      u.searchParams.set('street', `${num} ${via}`);
      const r = await fetch(u, { signal, headers: { Accept: 'application/json' } });
      if (r.ok) {
        const arr = (await r.json()) as Array<{ lat: string; lon: string; address?: Record<string, string> }>;
        const f = arr?.[0];
        const lat = f ? Number(f.lat) : NaN;
        const lng = f ? Number(f.lon) : NaN;
        if (f && Number.isFinite(lat) && Number.isFinite(lng) && dentroDeAracatuba(lat, lng)) {
          const hn = f.address?.house_number;
          const viaNome = f.address?.road || via;
          const bairro = f.address?.suburb || f.address?.neighbourhood || f.address?.city_district;
          const cidade = f.address?.city || f.address?.town || f.address?.municipality;
          const rotulo = [`${viaNome}${hn ? ', ' + hn : (num ? ', ' + num : '')}`, bairro, cidade].filter(Boolean).join(', ');
          // Só é exato se o mapa devolveu O número pedido (não um vizinho).
          if (hn && hn.replace(/\D/g, '') === num) return { rotulo, lat, lng, precisao: 'exato' };
        }
      }
    } catch {
      /* segue para o Photon */
    }
  }

  // Fallback SEM CHAVE (2): Photon. Lê housenumber para classificar a precisão.
  try {
    const u = new URL('https://photon.komoot.io/api/');
    u.searchParams.set('q', `${[via, num].filter(Boolean).join(' ')}, Araçatuba`);
    u.searchParams.set('lat', String(ARACATUBA.lat));
    u.searchParams.set('lon', String(ARACATUBA.lng));
    u.searchParams.set('limit', '1');
    const r = await fetch(u, { signal });
    if (!r.ok) return fim();
    const d = (await r.json()) as { features?: Array<{ geometry: { coordinates: [number, number] }; properties: Record<string, string> }> };
    const f = d.features?.[0];
    const [lng, lat] = f?.geometry?.coordinates ?? [NaN, NaN];
    if (!f || !Number.isFinite(lat) || !Number.isFinite(lng) || !dentroDeAracatuba(lat, lng)) return fim();
    const p = f.properties ?? {};
    // Com número pedido, só vale o MESMO número; sem pedido, qualquer número do mapa.
    const temNumero = !!p.housenumber && (!num || String(p.housenumber).replace(/\D/g, '') === num);
    const viaNome = p.street || p.name || via;
    if (exigeNumeroExato && !temNumero) {
      // Rua encontrada, número não: o rótulo NÃO afirma o número digitado.
      if (p.street || p.osm_key === 'highway') guardarRua({ rotulo: [viaNome, p.district || p.suburb, p.city].filter(Boolean).join(', '), lat, lng, precisao: 'rua' });
      return fim();
    }
    const rotulo = [`${viaNome}${temNumero ? ', ' + p.housenumber : ''}`, p.district || p.suburb, p.city].filter(Boolean).join(', ');
    return { rotulo, lat, lng, precisao: temNumero ? 'exato' : 'rua' };
  } catch {
    return fim();
  }
}

/**
 * NÚMERO QUE O MAPA NÃO TEM: estima a posição pelos números vizinhos.
 *
 * Busca no OpenStreetMap (Overpass, sem chave) os imóveis NUMERADOS da mesma
 * rua, perto do ponto já encontrado, e calcula onde o número pedido fica entre
 * eles (ver `estimarPorVizinhos`). Devolve 'exato' se o número aparecer entre
 * os imóveis, 'estimado' se foi calculado, ou null se a rua não tem números
 * suficientes no mapa (fica valendo o ponto da rua).
 */
export async function estimarNumeroNaRua(
  texto: string, base: { lat: number; lng: number; rotulo?: string | null }, signal?: AbortSignal,
): Promise<PontoPreciso | null> {
  const { rua, num } = numeroDoEndereco(texto);
  if (!num || !Number.isFinite(base.lat) || !Number.isFinite(base.lng)) return null;
  const primeiroTrecho = (t: string) => t.split(/[,(–—]| - /)[0].trim();
  // Nome da rua como o mapa a reconhece (com acentos) e como foi digitada.
  const nomes = [...new Set([primeiroTrecho(base.rotulo ?? ''), primeiroTrecho(rua)].filter((n) => n.length >= 3))];
  if (!nomes.length) return null;
  const chave = `${nomes.map(normalizarTexto).join('|')}|${num}|${base.lat.toFixed(3)},${base.lng.toFixed(3)}`;
  if (memoriaEstimativas.has(chave)) return memoriaEstimativas.get(chave) ?? null;

  // Filtro folgado no servidor (vogais/acentos viram curinga); a conferência
  // exata do nome é feita aqui, depois.
  const padrao = nomes.map((n) => n.replace(/[^A-Za-z0-9 ]|[aeiouc]/gi, '.{1,2}')).join('|');
  const consulta = `[out:json][timeout:8];nwr["addr:housenumber"]["addr:street"~"^(${padrao})$",i](around:5000,${base.lat},${base.lng});out center tags 300;`;
  const ctrl = new AbortController();
  const abortar = () => ctrl.abort();
  signal?.addEventListener('abort', abortar);
  const limite = setTimeout(abortar, 9000);
  try {
    const u = new URL('https://overpass-api.de/api/interpreter');
    u.searchParams.set('data', consulta);
    const r = await fetch(u, { signal: ctrl.signal });
    if (!r.ok) return null; // serviço ocupado: não guarda, tenta de novo depois
    const d = (await r.json()) as { elements?: Array<{ lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> };
    const aceitos = new Set(nomes.map(normalizarTexto));
    const conhecidos: NumeroConhecido[] = [];
    let nomeNoMapa = '';
    for (const e of d.elements ?? []) {
      const via = e.tags?.['addr:street'] ?? '';
      if (!aceitos.has(normalizarTexto(via))) continue;
      const n = Number.parseInt(e.tags?.['addr:housenumber'] ?? '', 10);
      const lat = e.lat ?? e.center?.lat ?? NaN;
      const lng = e.lon ?? e.center?.lon ?? NaN;
      if (!Number.isFinite(n) || !Number.isFinite(lat) || !Number.isFinite(lng) || !dentroDeAracatuba(lat, lng)) continue;
      conhecidos.push({ num: n, lat, lng });
      nomeNoMapa ||= via;
    }
    const pos = estimarPorVizinhos(Number(num), conhecidos);
    const ponto: PontoPreciso | null = pos
      ? { rotulo: `${nomeNoMapa || nomes[0]}, ${num}`, lat: pos.lat, lng: pos.lng, precisao: pos.exato ? 'exato' : 'estimado' }
      : null;
    return lembrar(memoriaEstimativas, chave, ponto);
  } catch {
    return null;
  } finally {
    clearTimeout(limite);
    signal?.removeEventListener('abort', abortar);
  }
}

/** Geocodificação reversa: endereço aproximado de um ponto (após arrastar o alfinete). */
export async function reverseGeocodificar(lat: number, lng: number, signal?: AbortSignal): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!proxyIndisponivel) {
    try {
      const r = await fetch('/api/mapas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operacao: 'reverso', ponto: { lat, lng } }), signal,
      });
      if (r.status === 503) {
        proxyIndisponivel = true;
      } else if (r.ok) {
        const d = (await r.json()) as { rotulo?: string };
        if (d.rotulo) return d.rotulo;
      }
    } catch {
      /* segue para o fallback */
    }
  }
  try {
    const u = new URL('https://photon.komoot.io/reverse');
    u.searchParams.set('lat', String(lat));
    u.searchParams.set('lon', String(lng));
    u.searchParams.set('limit', '1');
    const r = await fetch(u, { signal });
    if (!r.ok) return null;
    const d = (await r.json()) as { features?: Array<{ properties: Record<string, string> }> };
    const p = d.features?.[0]?.properties;
    if (!p) return null;
    const via = p.street || p.name || '';
    const linha = via ? `${via}${p.housenumber ? ', ' + p.housenumber : ''}` : (p.name || '');
    return [linha, p.district || p.suburb, p.city].filter(Boolean).join(', ') || null;
  } catch {
    return null;
  }
}

export interface TrajetoRota {
  /** Geometria do trajeto pelas ruas, em pares [lat, lng]. */
  geometria: [number, number][];
  /** Minutos por trecho (do ponto i ao i+1). */
  temposMin: number[];
  /** Metros por trecho (do ponto i ao i+1). */
  distanciasMetros: number[];
}

/**
 * Calcula o trajeto pelas ruas (OSRM público, sem chave) ligando os pontos na
 * ordem dada. Devolve a geometria e o tempo de cada trecho. Null em caso de
 * falha — quem chama desenha uma linha reta como alternativa.
 */
export async function trajetoOSRM(
  pontos: { lat: number; lng: number }[],
  signal?: AbortSignal,
): Promise<TrajetoRota | null> {
  if (pontos.length < 2) return null;
  const coords = pontos.map((p) => `${p.lng},${p.lat}`).join(';');
  const u = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  try {
    const r = await fetch(u, { signal });
    if (!r.ok) return null;
    const d = (await r.json()) as {
      routes?: Array<{ geometry: { coordinates: [number, number][] }; legs: Array<{ duration: number; distance: number }> }>;
    };
    const rota = d.routes?.[0];
    if (!rota) return null;
    const geometria = (rota.geometry?.coordinates ?? []).map(([lng, lat]) => [lat, lng] as [number, number]);
    const temposMin = (rota.legs ?? []).map((l) => Math.max(1, Math.round(l.duration / 60)));
    const distanciasMetros = (rota.legs ?? []).map((l) => Math.max(0, Math.round(l.distance ?? 0)));
    return { geometria, temposMin, distanciasMetros };
  } catch {
    return null;
  }
}
