/**
 * Proxy privado de geocodificação e roteamento Geoapify.
 * Configure GEOAPIFY_API_KEY nas variáveis de ambiente da Vercel.
 * Nunca exponha a chave no VITE_* nem armazene endereços em logs.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
type Point = { lat: number; lng: number };
const valid = (p: Point) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
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
    let raw = '';
    for await (const chunk of req) {
      raw += chunk.toString();
      if (raw.length > 12000) return reply(res, 413, { erro: 'Solicitação muito grande.' });
    }
    const data = JSON.parse(raw) as { operacao?: string; texto?: string; pontos?: Point[] };
    let url: URL;
    if (data.operacao === 'buscar') {
      const texto = data.texto?.trim() ?? '';
      if (texto.length < 5 || texto.length > 180) return reply(res, 400, { erro: 'Digite um endereço mais completo (até 180 caracteres).' });
      url = new URL('https://api.geoapify.com/v1/geocode/search');
      url.searchParams.set('text', texto + ', Araçatuba, São Paulo, Brasil');
      url.searchParams.set('filter', 'countrycode:br');
      url.searchParams.set('limit', '5');
    } else if (data.operacao === 'rota') {
      const pontos = data.pontos;
      if (!Array.isArray(pontos) || pontos.length < 2 || pontos.length > 25 || !pontos.every(valid)) return reply(res, 400, { erro: 'Informe de 2 a 25 pontos geográficos válidos.' });
      url = new URL('https://api.geoapify.com/v1/routing');
      url.searchParams.set('waypoints', pontos.map(p => p.lat + ',' + p.lng).join('|'));
      url.searchParams.set('mode', 'drive');
      url.searchParams.set('details', 'route_details');
    } else return reply(res, 400, { erro: 'Operação inválida.' });
    url.searchParams.set('apiKey', key);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let upstream: Response;
    try { upstream = await fetch(url, { signal: controller.signal }); }
    finally { clearTimeout(timer); }
    if (!upstream.ok) return reply(res, upstream.status === 429 ? 429 : 502, { erro: upstream.status === 429 ? 'Limite de consultas do mapa atingido. Tente mais tarde.' : 'Serviço de mapas indisponível. Tente novamente.' });
    const json = await upstream.json() as { features?: Array<{ properties?: Record<string, unknown> }> };
    if (data.operacao === 'buscar') {
      const resultados = (json.features ?? []).slice(0, 5).map(f => ({
        rotulo: String(f.properties?.formatted ?? ''),
        lat: Number(f.properties?.lat), lng: Number(f.properties?.lon),
      })).filter(valid => valid.rotulo && Number.isFinite(valid.lat) && Number.isFinite(valid.lng));
      return reply(res, 200, { resultados });
    }
    const props = json.features?.[0]?.properties;
    const legs = props?.legs as Array<{ time?: number; distance?: number }> | undefined;
    if (!Array.isArray(legs) || legs.length !== (data.pontos?.length ?? 0) - 1 || !legs.every(l => Number.isFinite(l.time) && Number.isFinite(l.distance))) return reply(res, 422, { erro: 'Não foi possível calcular todos os trechos pelas ruas.' });
    return reply(res, 200, { trechos: legs.map(l => ({ minutos: Math.max(1, Math.ceil((l.time ?? 0) / 60)), metros: Math.round(l.distance ?? 0) })), fonte: 'Geoapify / OpenStreetMap', estimativa: true });
  } catch {
    return reply(res, 502, { erro: 'Não foi possível consultar o mapa. Confira a conexão e tente novamente.' });
  }
}
