/**
 * Proxy privado de geocodificação e roteamento Geoapify.
 * Configure GEOAPIFY_API_KEY nas variáveis de ambiente da Vercel.
 * Nunca exponha a chave no VITE_* nem armazene endereços em logs.
 *
 * Operações:
 *  - 'autocompletar' | 'buscar' (geocodificação): liberadas para uso ANÔNIMO,
 *    porém protegidas — restritas a Araçatuba/SP, com limite por IP e tamanho
 *    mínimo de consulta. Servem ao autocomplete de endereço na busca pública.
 *  - 'rota' (roteamento, mais custoso): exige sessão Supabase (motorista logado).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

type Point = { lat: number; lng: number };
const valid = (p: Point) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

// Centro aproximado de Araçatuba, para enviesar a geocodificação.
const ARACATUBA = { lat: -21.2089, lng: -50.4328 };

const ESTADOS: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

/**
 * Município onde procurar o endereço. Sem `cidade`/`uf` (ou inválidos), vale o
 * padrão de sempre: Araçatuba/SP. Só letras, espaços, hífen e apóstrofo.
 */
export function municipioDaConsulta(cidade: unknown, uf: unknown): { cidade: string; estado: string } {
  const c = typeof cidade === 'string' ? cidade.trim() : '';
  const u = typeof uf === 'string' ? uf.trim().toUpperCase() : '';
  if (c.length >= 2 && c.length <= 60 && /^[\p{L} '’-]+$/u.test(c) && ESTADOS[u]) return { cidade: c, estado: ESTADOS[u] };
  return { cidade: 'Araçatuba', estado: 'São Paulo' };
}

/**
 * Separa a rua do número para a geocodificação ESTRUTURADA do Geoapify
 * (parâmetros `street` + `housenumber`, que não podem ser combinados com `text`).
 * Remove sufixos de cidade/estado/país e extrai um número embutido no texto
 * ("Rua X, 123") quando o campo número vier vazio.
 */
function separarRuaNumero(texto: string, numero: string): { rua: string; num: string } {
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

// Limite por IP (best-effort, por instância serverless). Reduz abuso da cota.
const BUCKETS = new Map<string, { count: number; reset: number }>();
function limitado(ip: string, max = 40, janelaMs = 60_000): boolean {
  const agora = Date.now();
  const b = BUCKETS.get(ip);
  if (!b || agora > b.reset) { BUCKETS.set(ip, { count: 1, reset: agora + janelaMs }); return false; }
  b.count += 1;
  return b.count > max;
}

function reply(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.end(JSON.stringify(data));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return reply(res, 405, { erro: 'Use POST.' });
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) return reply(res, 503, { erro: 'Serviço de mapas ainda não configurado. Adicione GEOAPIFY_API_KEY na Vercel.' });

  try {
    const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'desconhecido';
    if (limitado(ip)) return reply(res, 429, { erro: 'Muitas consultas em pouco tempo. Aguarde um instante.' });

    let raw = '';
    for await (const chunk of req) {
      raw += chunk.toString();
      if (raw.length > 12000) return reply(res, 413, { erro: 'Solicitação muito grande.' });
    }
    const data = JSON.parse(raw) as { operacao?: string; texto?: string; numero?: string; pontos?: Point[]; destinos?: Point[]; ponto?: Point; cidade?: string; uf?: string };
    const mun = municipioDaConsulta(data.cidade, data.uf);
    const op = data.operacao;

    // Roteamento e matriz são mais caros: exigem sessão Supabase (motorista logado).
    if (op === 'rota' || op === 'matriz') {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
      const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      if (!supabaseUrl || !anonKey) return reply(res, 503, { erro: 'Autenticação Supabase não configurada no servidor.' });
      if (!token) return reply(res, 401, { erro: 'Faça login como motorista para calcular trajetos.' });
      const authResponse = await fetch(new URL('/auth/v1/user', supabaseUrl), { headers: { apikey: anonKey, Authorization: 'Bearer ' + token } });
      if (!authResponse.ok) return reply(res, 401, { erro: 'Sessão expirada. Faça login novamente.' });
    }

    // Matriz viária (sources x targets): usada pelo simulador de encaixe.
    // Sem `destinos`: matriz quadrada dos `pontos`. Com `destinos`: um BLOCO
    // (pontos = origens) — é como rotas com mais de 25 pontos são calculadas.
    if (op === 'matriz') {
      const pontos = data.pontos;
      const emBloco = Array.isArray(data.destinos);
      const destinos = emBloco ? (data.destinos as Point[]) : pontos;
      if (!Array.isArray(pontos) || pontos.length < (emBloco ? 1 : 2) || pontos.length > 25 || !pontos.every(valid)
        || !Array.isArray(destinos) || destinos.length < 1 || destinos.length > 25 || !destinos.every(valid)) {
        return reply(res, 400, { erro: 'Informe de 2 a 25 pontos geográficos válidos.' });
      }
      const matrizUrl = new URL('https://api.geoapify.com/v1/routematrix');
      matrizUrl.searchParams.set('apiKey', key);
      const corpo = {
        mode: 'drive',
        sources: pontos.map((p) => ({ location: [p.lng, p.lat] })),
        targets: destinos.map((p) => ({ location: [p.lng, p.lat] })),
      };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      let upstream: Response;
      try {
        upstream = await fetch(matrizUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(corpo),
          signal: controller.signal,
        });
      } finally { clearTimeout(timer); }
      if (!upstream.ok) {
        return reply(res, upstream.status === 429 ? 429 : 502, {
          erro: upstream.status === 429 ? 'Limite de consultas do mapa atingido. Tente mais tarde.' : 'Serviço de mapas indisponível. Tente novamente.',
        });
      }
      const json = (await upstream.json()) as { sources_to_targets?: Array<Array<{ source_index?: number; target_index?: number; distance?: number | null; time?: number | null }>> };
      const linhas = json.sources_to_targets;
      if (!Array.isArray(linhas) || linhas.length !== pontos.length) {
        return reply(res, 422, { erro: 'Não foi possível calcular a matriz de trajetos pelas ruas.' });
      }
      const n = pontos.length, m = destinos.length;
      const tempos: (number | null)[][] = Array.from({ length: n }, () => Array<number | null>(m).fill(null));
      const distancias: (number | null)[][] = Array.from({ length: n }, () => Array<number | null>(m).fill(null));
      for (const linha of linhas) {
        for (const celula of linha) {
          const i = celula.source_index;
          const j = celula.target_index;
          if (typeof i !== 'number' || typeof j !== 'number' || i < 0 || j < 0 || i >= n || j >= m) continue;
          if (typeof celula.time === 'number' && Number.isFinite(celula.time)) tempos[i][j] = Math.max(0, Math.round((celula.time / 60) * 100) / 100); // fração de minuto: trecho curto não vira 1 min
          if (typeof celula.distance === 'number' && Number.isFinite(celula.distance)) distancias[i][j] = Math.max(0, Math.round(celula.distance));
        }
      }
      return reply(res, 200, { tempos, distancias, fonte: 'Geoapify / OpenStreetMap', estimativa: true });
    }

    let url: URL;
    if (op === 'autocompletar' || op === 'buscar') {
      const texto = data.texto?.trim() ?? '';
      const minimo = op === 'autocompletar' ? 3 : 5;
      if (texto.length < minimo || texto.length > 120) return reply(res, 400, { erro: 'Digite um pouco mais do endereço.' });
      const endpoint = op === 'autocompletar' ? 'autocomplete' : 'search';
      url = new URL('https://api.geoapify.com/v1/geocode/' + endpoint);
      url.searchParams.set('text', `${texto}, ${mun.cidade}, ${mun.estado}, Brasil`);
      url.searchParams.set('filter', 'countrycode:br');
      url.searchParams.set('bias', `proximity:${ARACATUBA.lng},${ARACATUBA.lat}`);
      url.searchParams.set('lang', 'pt');
      url.searchParams.set('limit', '5');
    } else if (op === 'geocodificar') {
      // Geocodificação ESTRUTURADA precisa (respeita o número da casa).
      const texto = data.texto?.trim() ?? '';
      if (texto.length < 3 || texto.length > 160) return reply(res, 400, { erro: 'Digite um pouco mais do endereço.' });
      const { rua, num } = separarRuaNumero(texto, data.numero ?? '');
      url = new URL('https://api.geoapify.com/v1/geocode/search');
      url.searchParams.set('street', rua);
      if (num) url.searchParams.set('housenumber', num);
      url.searchParams.set('city', mun.cidade);
      url.searchParams.set('state', mun.estado);
      url.searchParams.set('country', 'Brasil');
      url.searchParams.set('bias', `proximity:${ARACATUBA.lng},${ARACATUBA.lat}`);
      url.searchParams.set('lang', 'pt');
      url.searchParams.set('limit', '1');
    } else if (op === 'reverso') {
      // Geocodificação reversa: endereço aproximado do ponto que o motorista arrastou.
      const pt = data.ponto;
      if (!pt || !valid(pt)) return reply(res, 400, { erro: 'Ponto geográfico inválido.' });
      url = new URL('https://api.geoapify.com/v1/geocode/reverse');
      url.searchParams.set('lat', String(pt.lat));
      url.searchParams.set('lon', String(pt.lng));
      url.searchParams.set('lang', 'pt');
      url.searchParams.set('limit', '1');
    } else if (op === 'rota') {
      const pontos = data.pontos;
      if (!Array.isArray(pontos) || pontos.length < 2 || pontos.length > 25 || !pontos.every(valid)) return reply(res, 400, { erro: 'Informe de 2 a 25 pontos geográficos válidos.' });
      url = new URL('https://api.geoapify.com/v1/routing');
      url.searchParams.set('waypoints', pontos.map(p => p.lat + ',' + p.lng).join('|'));
      url.searchParams.set('mode', 'drive');
      url.searchParams.set('details', 'route_details');
    } else {
      return reply(res, 400, { erro: 'Operação inválida.' });
    }
    url.searchParams.set('apiKey', key);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let upstream: Response;
    try { upstream = await fetch(url, { signal: controller.signal }); }
    finally { clearTimeout(timer); }
    if (!upstream.ok) return reply(res, upstream.status === 429 ? 429 : 502, { erro: upstream.status === 429 ? 'Limite de consultas do mapa atingido. Tente mais tarde.' : 'Serviço de mapas indisponível. Tente novamente.' });
    const json = await upstream.json() as { features?: Array<{ properties?: Record<string, unknown> }> };

    if (op === 'autocompletar' || op === 'buscar') {
      const resultados = (json.features ?? []).slice(0, 5).map(f => ({
        rotulo: String(f.properties?.formatted ?? ''),
        lat: Number(f.properties?.lat), lng: Number(f.properties?.lon),
      })).filter(r => r.rotulo && Number.isFinite(r.lat) && Number.isFinite(r.lng));
      return reply(res, 200, { resultados });
    }

    if (op === 'geocodificar') {
      const f = json.features?.[0]?.properties as Record<string, unknown> | undefined;
      const lat = Number(f?.lat), lng = Number(f?.lon);
      if (!f || !Number.isFinite(lat) || !Number.isFinite(lng)) return reply(res, 200, { ponto: null });
      const resultType = String(f.result_type ?? '');
      // "Exato" só quando o mapa devolveu O número pedido — um imóvel vizinho
      // (outro número) é ponto de rua, não o endereço solicitado.
      const pedido = separarRuaNumero(data.texto?.trim() ?? '', data.numero ?? '').num;
      const devolvido = f.housenumber != null ? String(f.housenumber).replace(/\D/g, '') : '';
      const temNumero = devolvido !== '' && (!pedido || devolvido === pedido);
      const confianca = Number((f.rank as { confidence?: number } | undefined)?.confidence ?? 0);
      const precisao: 'exato' | 'rua' | 'aproximado' =
        (temNumero || (resultType === 'building' && !pedido)) ? 'exato'
        : (resultType === 'street' || resultType === 'street_part' || resultType === 'building') ? 'rua'
        : 'aproximado';
      return reply(res, 200, { ponto: { rotulo: String(f.formatted ?? ''), lat, lng, precisao, confianca } });
    }

    if (op === 'reverso') {
      const f = json.features?.[0]?.properties as Record<string, unknown> | undefined;
      // Município e UF do ponto (para conferir a cidade de embarque da família).
      return reply(res, 200, {
        rotulo: f ? String(f.formatted ?? '') : '',
        cidade: f && typeof f.city === 'string' ? f.city : '',
        uf: f && typeof f.state_code === 'string' ? f.state_code.toUpperCase() : '',
      });
    }

    const props = json.features?.[0]?.properties;
    const legs = props?.legs as Array<{ time?: number; distance?: number }> | undefined;
    if (!Array.isArray(legs) || legs.length !== (data.pontos?.length ?? 0) - 1 || !legs.every(l => Number.isFinite(l.time) && Number.isFinite(l.distance))) return reply(res, 422, { erro: 'Não foi possível calcular todos os trechos pelas ruas.' });
    return reply(res, 200, { trechos: legs.map(l => ({ minutos: Math.max(1, Math.ceil((l.time ?? 0) / 60)), metros: Math.round(l.distance ?? 0) })), fonte: 'Geoapify / OpenStreetMap', estimativa: true });
  } catch {
    return reply(res, 502, { erro: 'Não foi possível consultar o mapa. Confira a conexão e tente novamente.' });
  }
}
