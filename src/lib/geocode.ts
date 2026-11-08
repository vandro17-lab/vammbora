import type { Destino } from '@/types';
import { nomeDestinoParaExibicao } from '@/lib/utils';

export interface SugestaoEndereco { rotulo: string; lat: number; lng: number }

/** Precisão de um ponto geográfico. 'ajustado' = movido à mão pelo motorista. */
export type Precisao = 'exato' | 'rua' | 'aproximado' | 'ajustado';
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

/** Busca endereços de rua. Tenta o proxy privado (Geoapify); se faltar, usa Photon (sem chave). */
export async function buscarEnderecos(q: string, signal?: AbortSignal): Promise<SugestaoEndereco[]> {
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
        if (Array.isArray(d.resultados) && d.resultados.length) return d.resultados;
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
 */
export async function geocodificarPreciso(texto: string, numero: string, signal?: AbortSignal): Promise<PontoPreciso | null> {
  const rua = texto.trim();
  if (rua.length < 3) return null;
  const estruturado = separarRuaNumero(rua, numero);
  const exigeNumeroExato = Boolean(estruturado.num);

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
        if (d.ponto && Number.isFinite(d.ponto.lat) && Number.isFinite(d.ponto.lng) && (!exigeNumeroExato || d.ponto.precisao === 'exato')) return d.ponto;
        // Proxy respondeu sem ponto: ainda tentamos os fallbacks abaixo.
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
          if (hn) return { rotulo, lat, lng, precisao: 'exato' };
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
    if (!r.ok) return null;
    const d = (await r.json()) as { features?: Array<{ geometry: { coordinates: [number, number] }; properties: Record<string, string> }> };
    const f = d.features?.[0];
    const [lng, lat] = f?.geometry?.coordinates ?? [NaN, NaN];
    if (!f || !Number.isFinite(lat) || !Number.isFinite(lng) || !dentroDeAracatuba(lat, lng)) return null;
    const p = f.properties ?? {};
    const temNumero = !!p.housenumber;
    const viaNome = p.street || p.name || via;
    const rotulo = [`${viaNome}${p.housenumber ? ', ' + p.housenumber : (num ? ', ' + num : '')}`, p.district || p.suburb, p.city].filter(Boolean).join(', ');
    if (exigeNumeroExato && !temNumero) return null;
    return { rotulo, lat, lng, precisao: temNumero ? 'exato' : 'rua' };
  } catch {
    return null;
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
