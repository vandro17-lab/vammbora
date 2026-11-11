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
 *   - GEOAPIFY_API_KEY            (SEGREDO — tempos REAIS de trajeto pelas ruas)
 *   - BUSCAR_ROTAS_MAX_VIARIAS    (opcional — nº máx. de rotas com consulta viária por busca; padrão 8)
 *
 * Elegibilidade: rota `concluida`, não-demo, do sentido (e turno) pedido.
 *
 * TEMPOS DE TRAJETO: um encaixe só é CONFIRMADO ("compatível") com tempos reais
 * do provedor viário. Sem chave, com falha do provedor ou além do limite de
 * consultas, a rota é avaliada por ESTIMATIVA e sai, no máximo, como "sob
 * confirmação" (`temposEstimados: true`) — nunca como encaixe confirmado.
 *
 * MODO DEMONSTRAÇÃO (§6.1): por padrão a busca IGNORA rotas de demonstração
 * (`is_demo = true`), preservando o comportamento de produção. O modo demo é
 * ligado APENAS por configuração do SERVIDOR (variável de ambiente
 * `BUSCAR_ROTAS_DEMO = '1' | 'true'`), nunca por um parâmetro arbitrário vindo
 * do navegador. Quando ligado, as rotas demonstrativas passam a ser avaliadas
 * pelo MESMO motor (sem baixar `is_demo` para false e sem expor PII), e cada
 * resultado carrega `demo: true` para o frontend manter a identificação visível.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import {
  buscarEmRotasReais, candidatasParaBusca, compararResultados, contarInconclusivas,
  type PedidoFamilia, type EntradaBuscaReal, type ResultadoRotaReal,
} from '../src/lib/busca-rotas-reais';
import { criarMatrizDemo } from '../src/lib/encaixe';
import { MatrizPorCoordenadas, consultarTabelasViarias, pontosDistintos } from '../src/lib/matriz-viaria-servidor';
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
interface LinhaStop { id: string; ordem: number; type: string; label: string | null; lat: number | null; lng: number | null; confirmed: boolean; destination_id: string | null; leg_time_min: number | null; habitual_arrival_min: number | null; arrival_deadline_min?: number | null; release_time_min?: number | null; group_service_min?: number | string | null }
interface LinhaPax { id: string; identificacao: string; board_stop_id: string | null; alight_stop_id: string | null; destination_id: string | null; horario_habitual_min: number | null; ajuste_antes_min?: number | null; ajuste_depois_min?: number | null; atendimento_min?: number | string | null }
/** numeric do Postgres pode chegar como texto; NULL continua NULL (não informado). */
const numero = (v: number | string | null | undefined): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
interface LinhaRota {
  id: string; name: string | null; owner_id: string; vehicle_id: string | null; direction: string; turno: string | null;
  monitor: boolean; monitor_ocupa_lugar: boolean; reserved_seats: number; last_dropoff_min: number | null; early_leave_limit_min?: number | null;
  status: string; is_demo: boolean; is_published: boolean; price_month: number | null; price_type: string | null;
  habitual_departure_min?: number | null; availability_reviewed?: boolean | null;
  route_stops: LinhaStop[]; route_passengers: LinhaPax[];
  route_school_availability?: { id: string; destination_id: string; days: string[] | null; gate_lat: number | null; gate_lng: number | null; arrival_deadline_min: number | null; release_time_min: number | null; group_service_min: number | string | null }[] | null;
}

function mapRota(r: LinhaRota): Rota {
  const paradas: ParadaRota[] = (r.route_stops ?? [])
    .map((s) => ({
      id: s.id, ordem: s.ordem, tipo: s.type as ParadaRota['tipo'], rotulo: s.label ?? '',
      lat: s.lat ?? undefined, lng: s.lng ?? undefined, confirmado: s.confirmed,
      destinoId: s.destination_id, tempoAteProximaMin: s.leg_time_min, horarioChegadaMin: s.habitual_arrival_min ?? null,
      // Visita à escola (etapa 1): limite de chegada, liberação e tempo do grupo.
      limiteChegadaMin: s.arrival_deadline_min ?? null, liberacaoMin: s.release_time_min ?? null, atendimentoGrupoMin: numero(s.group_service_min),
    }))
    .sort((a, b) => a.ordem - b.ordem);
  const passageiros: PassageiroRota[] = (r.route_passengers ?? []).map((p) => ({
    id: p.id, identificacao: p.identificacao, embarqueParadaId: p.board_stop_id, desembarqueParadaId: p.alight_stop_id,
    destinoId: p.destination_id, horarioHabitualMin: p.horario_habitual_min ?? null,
    ajusteAntesMin: p.ajuste_antes_min ?? null, ajusteDepoisMin: p.ajuste_depois_min ?? null, atendimentoMin: numero(p.atendimento_min),
  }));
  return {
    id: r.id, nome: r.name ?? '', sentido: (r.direction as Rota['sentido']) ?? 'ida', turno: (r.turno as Rota['turno']) ?? null,
    dias: [], veiculoId: r.vehicle_id, monitor: r.monitor, monitorOcupaLugar: r.monitor_ocupa_lugar,
    lugaresReservados: r.reserved_seats, ultimoDesembarqueMin: r.last_dropoff_min, limiteAntecipacaoMin: r.early_leave_limit_min ?? null,
    // Etapa 1: saída habitual cadastrada e escolas que o motorista aceita incluir nesta rota.
    saidaHabitualMin: r.habitual_departure_min ?? null, disponibilidadeRevisada: !!r.availability_reviewed,
    escolasDisponiveis: (r.route_school_availability ?? []).map((e) => ({
      id: e.id, destinoId: e.destination_id, dias: e.days ?? null, portaoLat: e.gate_lat ?? null, portaoLng: e.gate_lng ?? null,
      limiteChegadaMin: e.arrival_deadline_min ?? null, liberacaoMin: e.release_time_min ?? null, atendimentoGrupoMin: numero(e.group_service_min),
    })),
    status: (r.status as Rota['status']) ?? 'rascunho', isPublished: r.is_published, paradas, passageiros, atualizadoEm: '',
  };
}

interface LinhaVeiculo { id: string; seats_passenger: number }
function mapVeiculo(v: LinhaVeiculo | undefined): Veiculo | null {
  if (!v) return null;
  return { id: v.id, modelo: 'Van', lugaresPassageiro: v.seats_passenger ?? 0, arCondicionado: false, acessivel: false, cintos: false, fotos: [] };
}

// Limite por IP (best-effort, por instância serverless): a busca é anônima e
// cada uma consome cota do provedor de mapas.
const BUCKETS = new Map<string, { count: number; reset: number }>();
function limitado(ip: string, max = 20, janelaMs = 60_000): boolean {
  const agora = Date.now();
  const b = BUCKETS.get(ip);
  if (!b || agora > b.reset) { BUCKETS.set(ip, { count: 1, reset: agora + janelaMs }); return false; }
  b.count += 1;
  return b.count > max;
}

/**
 * Avalia as candidatas com TEMPOS REAIS de trajeto sempre que possível.
 *  1) Prévia por estimativa — serve SÓ para priorizar quais rotas recebem a
 *     consulta viária (cota limitada); nenhum resultado dela é confirmado.
 *  2) As mais promissoras ganham a matriz real (pontos da rota + casa da
 *     família + escola) e são REAVALIADAS pelo mesmo motor.
 *  3) Rota sem matriz real (sem chave, falha, limite) mantém o resultado da
 *     prévia, que o núcleo já rebaixa para "sob confirmação".
 */
async function avaliarComTemposReais(entradas: EntradaBuscaReal[], pedido: PedidoFamilia): Promise<{ resultados: ResultadoRotaReal[]; totalRotasAvaliadas: number; inconclusivas: number }> {
  const candidatas = candidatasParaBusca(entradas, pedido);
  if (candidatas.length === 0) return { resultados: [], totalRotasAvaliadas: 0, inconclusivas: 0 };
  const previa = buscarEmRotasReais(candidatas, pedido, criarMatrizDemo()).resultados;

  const key = process.env.GEOAPIFY_API_KEY;
  const maxViarias = Math.max(0, Math.min(40, Number(process.env.BUSCAR_ROTAS_MAX_VIARIAS) || 8));
  const porId = new Map(candidatas.map((e) => [e.rota.id, e]));
  const matrizReal = new MatrizPorCoordenadas();
  const comReal = new Set<string>();
  if (key && pedido.origem) {
    const origem = pedido.origem;
    await Promise.all(previa.slice(0, maxViarias).map(async (r) => {
      const e = porId.get(r.rotaId);
      if (!e) return;
      const pontos = pontosDistintos([
        ...e.rota.paradas.filter((p) => p.lat != null && p.lng != null).map((p) => ({ lat: p.lat as number, lng: p.lng as number })),
        origem,
        ...(pedido.escolaPonto ? [pedido.escolaPonto] : []),
      ]);
      const tabelas = await consultarTabelasViarias(pontos, key);
      if (!tabelas) return;
      matrizReal.adicionar(pontos, tabelas.tempos, tabelas.distancias);
      comReal.add(e.rota.id);
    }));
  }

  const reais = comReal.size
    ? buscarEmRotasReais(candidatas.filter((e) => comReal.has(e.rota.id)), pedido, matrizReal).resultados
    : [];
  // Sem matriz real (sem chave, falha do provedor ou fora do orçamento) a rota
  // fica com a prévia: encaixe positivo vira "sob confirmação"; recusa vira
  // INCONCLUSIVA (o núcleo já faz isso) — nunca uma impossibilidade.
  const estimados = previa.filter((r) => !comReal.has(r.rotaId));
  const resultados = [...reais, ...estimados].sort(compararResultados);
  return { resultados, totalRotasAvaliadas: candidatas.length, inconclusivas: contarInconclusivas(resultados) };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return reply(res, 405, { erro: 'Use POST.' });
  const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'desconhecido';
  if (limitado(ip)) return reply(res, 429, { erro: 'Muitas buscas em pouco tempo. Aguarde um instante.' });

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
  let body: { origem?: { lat?: number; lng?: number }; destinoId?: string; escolaPonto?: { lat?: number; lng?: number } | null; sentido?: string; turno?: string | null; contratacao?: string | null; horarioMin?: number | null };
  try { body = JSON.parse(raw || '{}'); } catch { return reply(res, 400, { erro: 'JSON inválido.' }); }

  if (!body.origem || !coordOk(body.origem.lat) || !coordOk(body.origem.lng)) return reply(res, 400, { erro: 'Origem (lat/lng) é obrigatória.' });
  if (!body.destinoId || typeof body.destinoId !== 'string') return reply(res, 400, { erro: 'destinoId é obrigatório.' });
  if (!sentidoValido(body.sentido)) return reply(res, 400, { erro: 'sentido deve ser ida ou volta.' });
  // Horário da família (minuto do dia): ida = precisa chegar até; volta = sai da escola a partir de.
  const horarioFamiliaMin = typeof body.horarioMin === 'number' && Number.isInteger(body.horarioMin) && body.horarioMin >= 0 && body.horarioMin <= 1439 ? body.horarioMin : null;

  // §6.1: modo demonstração ligado SÓ por configuração do servidor (nunca pelo cliente).
  const demoLigado = process.env.BUSCAR_ROTAS_DEMO === '1' || process.env.BUSCAR_ROTAS_DEMO === 'true';

  try {
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // Coordenadas da escola escolhida (para o Tier B — inserir escola nova).
    // Vêm do corpo; se ausentes, busca no catálogo `destinations`.
    let escolaPonto: { lat: number; lng: number } | null =
      body.escolaPonto && coordOk(body.escolaPonto.lat) && coordOk(body.escolaPonto.lng)
        ? { lat: body.escolaPonto.lat, lng: body.escolaPonto.lng } : null;
    if (!escolaPonto) {
      const { data: destRows } = await db.from('destinations').select('lat,lng').eq('id', body.destinoId);
      const dest = Array.isArray(destRows) ? (destRows[0] as { lat?: number; lng?: number } | undefined) : null;
      if (dest && coordOk(dest.lat) && coordOk(dest.lng)) escolaPonto = { lat: dest.lat, lng: dest.lng };
    }

    const pedido: PedidoFamilia = {
      origem: { lat: body.origem.lat, lng: body.origem.lng },
      destinoId: body.destinoId,
      escolaPonto,
      sentido: body.sentido,
      turno: body.turno ?? null,
      contratacao: body.contratacao === 'avulso' ? 'avulso' : 'mensal',
      horarioFamiliaMin,
    };

    // Rotas ELEGÍVEIS: concluídas, do sentido pedido. NÃO exige publicação
    // manual (decisão de produto: qualquer rota concluída é avaliada).
    // §6.1: em produção excluímos demos (`is_demo = false`); só o modo demo do
    // servidor passa a INCLUIR as rotas demonstrativas (sem alterar `is_demo`).
    // §10: `limit` alto e explícito evita o truncamento silencioso do PostgREST
    // (default 1000 linhas) com ~300 rotas na demonstração.
    const sentidoPedido = pedido.sentido;
    const consultar = (colunasDaParada: string, extras = '') => {
      let consulta = db
        .from('routes')
        .select(
          'id,name,owner_id,vehicle_id,direction,turno,monitor,monitor_ocupa_lugar,reserved_seats,last_dropoff_min,early_leave_limit_min,status,is_demo,is_published,price_month,price_type,' +
            `route_stops(${colunasDaParada}),` +
            'route_passengers(id,identificacao,board_stop_id,alight_stop_id,destination_id,horario_habitual_min,ajuste_antes_min,ajuste_depois_min,atendimento_min)' + extras,
        )
        .eq('status', 'concluida')
        .eq('direction', sentidoPedido);
      if (!demoLigado) consulta = consulta.eq('is_demo', false);
      return consulta.limit(5000);
    };
    const PARADA_BASE = 'id,ordem,type,label,lat,lng,confirmed,destination_id,leg_time_min,habitual_arrival_min';
    // Visita à escola (limite de chegada, liberação, tempo do grupo): mesmos
    // dados que o simulador do motorista usa. Banco ainda sem essas colunas
    // (migração da etapa 1 pendente): consulta no formato anterior.
    let { data: rotas, error: errR } = await consultar(`${PARADA_BASE},arrival_deadline_min,release_time_min,group_service_min`,
      ',habitual_departure_min,availability_reviewed,route_school_availability(id,destination_id,days,gate_lat,gate_lng,arrival_deadline_min,release_time_min,group_service_min)');
    if (errR && ['42703', '42P01', 'PGRST200', 'PGRST204'].includes(String((errR as { code?: string }).code))) ({ data: rotas, error: errR } = await consultar(PARADA_BASE));
    if (errR) return reply(res, 500, { erro: 'Falha ao consultar rotas.' });

    const linhas = (rotas ?? []) as unknown as LinhaRota[];
    if (linhas.length === 0) return reply(res, 200, { resultados: [], totalRotasAvaliadas: 0, inconclusivas: 0 });

    const vehicleIds = [...new Set(linhas.map((r) => r.vehicle_id).filter((v): v is string => !!v))];
    const vmap = new Map<string, LinhaVeiculo>();
    if (vehicleIds.length) {
      const { data: veics, error: errV } = await db.from('vehicles').select('id,seats_passenger').in('id', vehicleIds);
      // Sem as vans não dá para avaliar lugares: é ERRO de consulta, não "sem oferta".
      if (errV) return reply(res, 500, { erro: 'Falha ao consultar as vans das rotas.' });
      for (const v of veics ?? []) vmap.set(v.id as string, v as LinhaVeiculo);
    }

    const rotaPorId = new Map(linhas.map((r) => [r.id, r]));
    const entradas: EntradaBuscaReal[] = linhas.map((r) => ({
      rota: mapRota(r),
      veiculo: mapVeiculo(r.vehicle_id ? vmap.get(r.vehicle_id) : undefined),
    }));

    const { resultados, totalRotasAvaliadas, inconclusivas } = await avaliarComTemposReais(entradas, pedido);

    // Resposta SEM PII: dados da PRÓPRIA rota (nome + van), nenhum dado de aluno.
    const publico = resultados.map((res0) => {
      const linha = rotaPorId.get(res0.rotaId);
      const van = linha?.vehicle_id ? vmap.get(linha.vehicle_id) : undefined;
      return {
        rotaId: res0.rotaId,
        rotaNome: linha?.name ?? 'Rota',
        demo: !!linha?.is_demo,
        // Mensalidade por ALUNO (valor fixo por aluno da van, não por trecho).
        precoMensal: linha?.price_month ?? null,
        precoTipo: linha?.price_type ?? null,
        vanLugares: van?.seats_passenger ?? null,
        vagas: res0.vagas,
        atendeEscola: res0.atendeEscola,
        sentido: res0.sentido,
        status: res0.status,
        passagemCasaMin: res0.passagemCasaMin,
        horarioEscolaMin: res0.horarioEscolaMin,
        minutosABordo: res0.minutosABordo,
        fonteHorario: res0.fonteHorario,
        temposEstimados: res0.temposEstimados,
        motivo: res0.motivo,
      };
    });

    return reply(res, 200, { resultados: publico, totalRotasAvaliadas, inconclusivas });
  } catch (e) {
    return reply(res, 500, { erro: 'Erro interno ao avaliar rotas.' });
  }
}
