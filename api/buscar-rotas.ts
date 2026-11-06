/**
 * Busca pública sobre ROTAS REAIS — avaliação SERVER-SIDE.
 *
 * Por quê no servidor: a família é anônima e o RLS não deixa o cliente ler rotas
 * reais; além disso, casas de alunos já cadastrados são dados privados (PII). Esta
 * função usa a SERVICE ROLE (somente no servidor) para ler as rotas elegíveis,
 * roda o MESMO motor de encaixe (via `buscarEmRotasReais`) e devolve resultados
 * SEM PII (nenhum nome de aluno, nenhum endereço residencial de terceiros).
 *
 * Configuração (variáveis de ambiente do servidor):
 *   - VITE_SUPABASE_URL           (já usada pelo app)
 *   - SUPABASE_SERVICE_ROLE_KEY   (SEGREDO — nunca vai ao frontend)
 *
 * Elegibilidade (decisão de produto A): rota `concluida`, não-demo, cujo
 * motorista tem anúncio ATIVO (drivers.anuncio_ativo, is_published, não suspenso).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { buscarEmRotasReais, type PedidoFamilia, type EntradaBuscaReal } from '../src/lib/busca-rotas-reais';
import type { Rota, Veiculo, ParadaRota, PassageiroRota } from '../src/types/motorista';

function reply(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.end(JSON.stringify(data));
}

const sentidoValido = (s: unknown): s is 'ida' | 'volta' => s === 'ida' || s === 'volta';
const coordOk = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/* --------- Mapeadores de linha do banco -> domínio (mínimos, sem PII extra) --------- */
interface LinhaStop { id: string; ordem: number; type: string; label: string | null; lat: number | null; lng: number | null; confirmed: boolean; destination_id: string | null; leg_time_min: number | null; habitual_arrival_min: number | null }
interface LinhaPax { id: string; identificacao: string; board_stop_id: string | null; alight_stop_id: string | null; destination_id: string | null; horario_habitual_min: number | null }
interface LinhaRota {
  id: string; name: string | null; owner_id: string; vehicle_id: string | null; direction: string; turno: string | null;
  monitor: boolean; monitor_ocupa_lugar: boolean; reserved_seats: number; last_dropoff_min: number | null;
  status: string; is_demo: boolean; is_published: boolean; route_stops: LinhaStop[]; route_passengers: LinhaPax[];
}

function mapRota(r: LinhaRota): Rota {
  const paradas: ParadaRota[] = (r.route_stops ?? [])
    .map((s) => ({
      id: s.id, ordem: s.ordem, tipo: s.type as ParadaRota['tipo'], rotulo: s.label ?? '',
      lat: s.lat ?? undefined, lng: s.lng ?? undefined, confirmado: s.confirmed,
      destinoId: s.destination_id, tempoAteProximaMin: s.leg_time_min, horarioChegadaMin: s.habitual_arrival_min ?? null,
    }))
    .sort((a, b) => a.ordem - b.ordem);
  const passageiros: PassageiroRota[] = (r.route_passengers ?? []).map((p) => ({
    id: p.id, identificacao: p.identificacao, embarqueParadaId: p.board_stop_id, desembarqueParadaId: p.alight_stop_id,
    destinoId: p.destination_id, horarioHabitualMin: p.horario_habitual_min ?? null,
  }));
  return {
    id: r.id, nome: r.name ?? '', sentido: (r.direction as Rota['sentido']) ?? 'ida', turno: (r.turno as Rota['turno']) ?? null,
    dias: [], veiculoId: r.vehicle_id, monitor: r.monitor, monitorOcupaLugar: r.monitor_ocupa_lugar,
    lugaresReservados: r.reserved_seats, ultimoDesembarqueMin: r.last_dropoff_min, limiteAntecipacaoMin: null,
    status: (r.status as Rota['status']) ?? 'rascunho', isPublished: r.is_published, paradas, passageiros, atualizadoEm: '',
  };
}

interface LinhaVeiculo { id: string; seats_passenger: number }
function mapVeiculo(v: LinhaVeiculo | undefined): Veiculo | null {
  if (!v) return null;
  return { id: v.id, modelo: 'Van', lugaresPassageiro: v.seats_passenger ?? 0, arCondicionado: false, acessivel: false, cintos: false, fotos: [] };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return reply(res, 405, { erro: 'Use POST.' });

  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return reply(res, 503, { erro: 'Busca por rotas reais ainda não configurada no servidor (defina SUPABASE_SERVICE_ROLE_KEY).' });
  }

  // Corpo da requisição.
  let raw = '';
  for await (const chunk of req) {
    raw += (chunk as Buffer).toString();
    if (raw.length > 8000) return reply(res, 413, { erro: 'Solicitação muito grande.' });
  }
  let body: { origem?: { lat?: number; lng?: number }; destinoId?: string; sentido?: string; turno?: string | null; contratacao?: string | null };
  try { body = JSON.parse(raw || '{}'); } catch { return reply(res, 400, { erro: 'JSON inválido.' }); }

  if (!body.origem || !coordOk(body.origem.lat) || !coordOk(body.origem.lng)) return reply(res, 400, { erro: 'Origem (lat/lng) é obrigatória.' });
  if (!body.destinoId || typeof body.destinoId !== 'string') return reply(res, 400, { erro: 'destinoId é obrigatório.' });
  if (!sentidoValido(body.sentido)) return reply(res, 400, { erro: 'sentido deve ser ida ou volta.' });

  const pedido: PedidoFamilia = {
    origem: { lat: body.origem.lat, lng: body.origem.lng },
    destinoId: body.destinoId,
    sentido: body.sentido,
    turno: body.turno ?? null,
    contratacao: body.contratacao === 'avulso' ? 'avulso' : 'mensal',
  };

  try {
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // Rotas ELEGÍVEIS: concluídas, PUBLICADAS pelo motorista, não-demo, do sentido pedido.
    const { data: rotas, error: errR } = await db
      .from('routes')
      .select(
        'id,name,owner_id,vehicle_id,direction,turno,monitor,monitor_ocupa_lugar,reserved_seats,last_dropoff_min,status,is_demo,is_published,' +
          'route_stops(id,ordem,type,label,lat,lng,confirmed,destination_id,leg_time_min,habitual_arrival_min),' +
          'route_passengers(id,identificacao,board_stop_id,alight_stop_id,destination_id,horario_habitual_min)',
      )
      .eq('status', 'concluida')
      .eq('is_demo', false)
      .eq('is_published', true)
      .eq('direction', pedido.sentido);
    if (errR) return reply(res, 500, { erro: 'Falha ao consultar rotas.' });

    const linhas = (rotas ?? []) as unknown as LinhaRota[];
    if (linhas.length === 0) return reply(res, 200, { resultados: [], totalRotasAvaliadas: 0 });

    const vehicleIds = [...new Set(linhas.map((r) => r.vehicle_id).filter((v): v is string => !!v))];
    const vmap = new Map<string, LinhaVeiculo>();
    if (vehicleIds.length) {
      const { data: veics } = await db.from('vehicles').select('id,seats_passenger').in('id', vehicleIds);
      for (const v of veics ?? []) vmap.set(v.id as string, v as LinhaVeiculo);
    }

    const rotaPorId = new Map(linhas.map((r) => [r.id, r]));
    const entradas: EntradaBuscaReal[] = linhas.map((r) => ({
      rota: mapRota(r),
      veiculo: mapVeiculo(r.vehicle_id ? vmap.get(r.vehicle_id) : undefined),
    }));

    const { resultados, totalRotasAvaliadas } = buscarEmRotasReais(entradas, pedido);

    // Resposta SEM PII: dados da PRÓPRIA rota (nome + van), nenhum dado de aluno.
    const publico = resultados.map((res0) => {
      const linha = rotaPorId.get(res0.rotaId);
      const van = linha?.vehicle_id ? vmap.get(linha.vehicle_id) : undefined;
      return {
        rotaId: res0.rotaId,
        rotaNome: linha?.name ?? 'Rota',
        vanLugares: van?.seats_passenger ?? null,
        sentido: res0.sentido,
        status: res0.status,
        passagemCasaMin: res0.passagemCasaMin,
        horarioEscolaMin: res0.horarioEscolaMin,
        minutosABordo: res0.minutosABordo,
        fonteHorario: res0.fonteHorario,
        motivo: res0.motivo,
      };
    });

    return reply(res, 200, { resultados: publico, totalRotasAvaliadas });
  } catch (e) {
    return reply(res, 500, { erro: 'Erro interno ao avaliar rotas.' });
  }
}
