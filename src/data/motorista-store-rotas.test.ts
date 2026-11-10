import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Rota } from '@/types/motorista';

/**
 * Salvamento de rotas contra um Supabase SIMULADO que reproduz as regras da RPC
 * `salvar_rota_completa` e das tabelas de PRODUÇÃO (lidas do catálogo do banco):
 * ids UUID, FKs de van/escola/parada, apaga-e-recria paradas e alunos, e
 * "rota não encontrada" ao atualizar id inexistente.
 * NÃO grava no banco real — prova o contrato do cliente.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const db = vi.hoisted(() => ({
  usuario: 'user-1' as string | null,
  routes: [] as Record<string, unknown>[], stops: [] as Record<string, unknown>[], pax: [] as Record<string, unknown>[],
  vehicles: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'], destinations: ['esc-1', 'esc-2'],
  seq: 0, chamadasRpc: 0,
}));

vi.mock('@/lib/supabase', () => {
  const erro = (message: string, code: string) => ({ data: null, error: { message, code } });
  const uuid = (v: unknown, nulo = true) => {
    if (v == null || v === '') { if (nulo) return null; throw { message: 'null value', code: '23502' }; }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v))) throw { message: `invalid input syntax for type uuid: "${v}"`, code: '22P02' };
    return String(v);
  };
  function rpc(_nome: string, { p_rota: p }: { p_rota: Record<string, unknown> }) {
    db.chamadasRpc++;
    if (!db.usuario) return erro('Precisa estar autenticado.', 'P0001');
    const antes = JSON.stringify([db.routes, db.stops, db.pax]);
    try {
      let id = uuid(p.id);
      const veic = uuid(p.vehicle_id);
      if (veic && !db.vehicles.includes(veic)) throw { message: 'violates foreign key constraint "routes_vehicle_id_fkey"', code: '23503' };
      const campos = { vehicle_id: veic, name: p.name ?? '', direction: p.direction ?? 'ida', turno: p.turno ?? null, days: p.days ?? [], monitor: !!p.monitor, monitor_ocupa_lugar: !!p.monitor_ocupa_lugar, reserved_seats: p.reserved_seats ?? 0, last_dropoff_min: p.last_dropoff_min ?? null, early_leave_limit_min: p.early_leave_limit_min ?? null, status: p.status ?? 'rascunho' };
      if (!id) {
        id = `00000000-0000-4000-8000-${String(++db.seq).padStart(12, '0')}`;
        db.routes.push({ id, owner_id: db.usuario, is_demo: false, is_published: false, updated_at: String(db.seq), ...campos });
      } else {
        const r = db.routes.find((x) => x.id === id && x.owner_id === db.usuario);
        if (!r) throw { message: 'Rota não encontrada ou sem permissão.', code: 'P0001' };
        Object.assign(r, campos, { updated_at: String(++db.seq) });
      }
      db.pax = db.pax.filter((x) => x.route_id !== id);
      db.stops = db.stops.filter((x) => x.route_id !== id);
      for (const s of (p.stops as Record<string, unknown>[]) ?? []) {
        const sid = uuid(s.id) ?? `10000000-0000-4000-8000-${String(++db.seq).padStart(12, '0')}`;
        if (db.stops.some((x) => x.id === sid)) throw { message: 'duplicate key value violates unique constraint "route_stops_pkey"', code: '23505' };
        if (s.destination_id && !db.destinations.includes(String(s.destination_id))) throw { message: 'violates foreign key constraint "route_stops_destination_id_fkey"', code: '23503' };
        if (!['saida', 'casa', 'escola'].includes(String(s.type))) throw { message: 'check constraint', code: '23514' };
        db.stops.push({ ...s, id: sid, route_id: id });
      }
      for (const x of (p.passengers as Record<string, unknown>[]) ?? []) {
        const b = uuid(x.board_stop_id), a = uuid(x.alight_stop_id);
        for (const ref of [b, a]) if (ref && !db.stops.some((s) => s.id === ref)) throw { message: 'violates foreign key constraint "route_passengers_board_stop_id_fkey"', code: '23503' };
        db.pax.push({ ...x, id: uuid(x.id) ?? `20000000-0000-4000-8000-${String(++db.seq).padStart(12, '0')}`, route_id: id });
      }
      return { data: id, error: null };
    } catch (e) {
      [db.routes, db.stops, db.pax] = JSON.parse(antes); // transação: tudo ou nada
      return { data: null, error: e };
    }
  }
  function from(tabela: string) {
    const filtros: [string, unknown][] = [];
    let um = false;
    const exec = () => {
      if (tabela !== 'routes') return { data: [], error: null };
      const linhas = db.routes
        .filter((r) => (r.owner_id === db.usuario || r.is_demo) && filtros.every(([c, v]) => r[c] === v))
        .sort((a, b) => Number(b.updated_at) - Number(a.updated_at))
        .map((r) => ({ ...r, route_stops: db.stops.filter((s) => s.route_id === r.id), route_passengers: db.pax.filter((x) => x.route_id === r.id) }));
      return um ? { data: linhas[0] ?? null, error: null } : { data: linhas, error: null };
    };
    const q: Record<string, unknown> = {
      select: () => q, order: () => q, eq: (c: string, v: unknown) => { filtros.push([c, v]); return q; },
      maybeSingle: () => { um = true; return q; },
      then: (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(exec()).then(ok, ko),
    };
    return q;
  }
  return {
    USE_SUPABASE: true, DEMO_MOTORISTA: false,
    supabase: { from, rpc: async (n: string, a: { p_rota: Record<string, unknown> }) => rpc(n, a), auth: { getSession: async () => ({ data: { session: db.usuario ? { user: { id: db.usuario } } : null } }) } },
  };
});

import { listarRotas, obterRota, salvarRota, novoId, normalizarRotaParaSalvar } from './motorista-store';

const VAN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
/** Rota como o construtor monta: saída, 2 casas (endereços com lat/lng), 2 escolas, 3 alunos com horários. */
function rotaDoConstrutor(sentido: Rota['sentido'] = 'ida'): Rota {
  const [s, c1, c2, e1, e2] = [novoId(), novoId(), novoId(), novoId(), novoId()];
  return {
    id: '', nome: 'Manhã', sentido, turno: 'manha', dias: ['seg', 'qua'], veiculoId: VAN,
    monitor: true, monitorOcupaLugar: true, lugaresReservados: 1, ultimoDesembarqueMin: 420, limiteAntecipacaoMin: 15,
    status: 'concluida', atualizadoEm: '',
    paradas: [
      { id: s, ordem: 0, tipo: 'saida', rotulo: 'Garagem', lat: -21.2051, lng: -50.4401, confirmado: true, tempoAteProximaMin: 6 },
      { id: c1, ordem: 1, tipo: 'casa', rotulo: 'Rua José Geraldo, 580', lat: -21.210123, lng: -50.431987, confirmado: true, tempoAteProximaMin: 4, horarioChegadaMin: 390 },
      { id: c2, ordem: 2, tipo: 'casa', rotulo: 'Rua das Flores, 12', lat: -21.2155, lng: -50.4489, confirmado: true, tempoAteProximaMin: 9 },
      { id: e1, ordem: 3, tipo: 'escola', rotulo: 'Escola Um', lat: -21.2, lng: -50.42, confirmado: true, destinoId: 'esc-1', tempoAteProximaMin: 5, horarioChegadaMin: 410 },
      { id: e2, ordem: 4, tipo: 'escola', rotulo: 'Escola Dois', lat: -21.19, lng: -50.41, confirmado: true, destinoId: 'esc-2', tempoAteProximaMin: null, horarioChegadaMin: 420 },
    ],
    passageiros: [
      { id: novoId(), identificacao: 'Ana', embarqueParadaId: c1, desembarqueParadaId: e1, destinoId: 'esc-1', horarioHabitualMin: 390, ajusteAntesMin: 5, ajusteDepoisMin: 10, atendimentoMin: 2, atendimentoOrigem: 'informado' },
      { id: novoId(), identificacao: 'Bia', embarqueParadaId: c1, desembarqueParadaId: e2, destinoId: 'esc-2' },
      { id: novoId(), identificacao: 'Caio', embarqueParadaId: c2, desembarqueParadaId: e2, destinoId: 'esc-2', horarioHabitualMin: 396 },
    ],
  };
}
/** Só o que importa comparar (sem carimbos de data e campos derivados). */
const essencial = (r: Rota) => ({
  ...r, atualizadoEm: '', isPublished: undefined,
  paradas: r.paradas.map((p) => ({ id: p.id, ordem: p.ordem, tipo: p.tipo, rotulo: p.rotulo, lat: p.lat, lng: p.lng, destinoId: p.destinoId ?? null, tempo: p.tempoAteProximaMin ?? null, chegada: p.horarioChegadaMin ?? null })),
  passageiros: [...r.passageiros].sort((a, b) => a.identificacao.localeCompare(b.identificacao)).map((x) => ({ id: x.id, nome: x.identificacao, emb: x.embarqueParadaId, des: x.desembarqueParadaId, destino: x.destinoId ?? null, h: x.horarioHabitualMin ?? null, antes: x.ajusteAntesMin ?? null, depois: x.ajusteDepoisMin ?? null, atend: x.atendimentoMin ?? null })),
});

beforeEach(() => { db.usuario = 'user-1'; db.routes = []; db.stops = []; db.pax = []; db.seq = 0; db.chamadasRpc = 0; });

describe('salvamento de rotas (RPC simulada com as regras de produção)', () => {
  it.each(['ida', 'volta'] as const)('salva rota de %s completa e recupera tudo após "recarregar"', async (sentido) => {
    const salva = await salvarRota(rotaDoConstrutor(sentido));
    expect(salva.id).toMatch(UUID);
    const lida = await obterRota(salva.id); // leitura do zero
    expect(lida).not.toBeNull();
    expect(essencial(lida!)).toEqual(essencial(salva));
    expect(lida!.sentido).toBe(sentido);
    expect(lida!.veiculoId).toBe(VAN);
    // Latitude/longitude do endereço escolhido chegam intactas.
    expect(lida!.paradas[1]).toMatchObject({ rotulo: 'Rua José Geraldo, 580', lat: -21.210123, lng: -50.431987 });
    expect(lida!.paradas.filter((p) => p.tipo === 'escola').map((p) => p.destinoId)).toEqual(['esc-1', 'esc-2']);
    expect(lida!.passageiros).toHaveLength(3);
  });

  it('editar não perde paradas nem alunos e não duplica a rota', async () => {
    const a = await salvarRota(rotaDoConstrutor());
    const carregada = (await obterRota(a.id))!;
    const novaCasa = novoId();
    const editada: Rota = {
      ...carregada, nome: 'Manhã (editada)',
      paradas: [...carregada.paradas.slice(0, 3), { id: novaCasa, ordem: 2.5, tipo: 'casa', rotulo: 'Av. Brasil, 900', lat: -21.22, lng: -50.45, confirmado: true }, ...carregada.paradas.slice(3)],
      passageiros: [...carregada.passageiros, { id: novoId(), identificacao: 'Davi', embarqueParadaId: novaCasa, desembarqueParadaId: carregada.paradas[4].id, destinoId: 'esc-2' }],
    };
    const b = await salvarRota(editada);
    expect(b.id).toBe(a.id);
    expect(db.routes).toHaveLength(1);
    const lida = (await obterRota(a.id))!;
    expect(lida.nome).toBe('Manhã (editada)');
    expect(lida.paradas.map((p) => p.rotulo)).toEqual(['Garagem', 'Rua José Geraldo, 580', 'Rua das Flores, 12', 'Av. Brasil, 900', 'Escola Um', 'Escola Dois']);
    expect(lida.paradas.map((p) => p.ordem)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(lida.passageiros.map((x) => x.identificacao).sort()).toEqual(['Ana', 'Bia', 'Caio', 'Davi']);
    // Quem já existia manteve o MESMO id, vínculos e horários.
    const ana = lida.passageiros.find((x) => x.identificacao === 'Ana')!;
    expect(ana).toMatchObject({ id: carregada.passageiros.find((x) => x.identificacao === 'Ana')!.id, horarioHabitualMin: 390, ajusteAntesMin: 5, ajusteDepoisMin: 10, atendimentoMin: 2 });
    expect(lida.paradas.find((p) => p.id === ana.embarqueParadaId)!.rotulo).toBe('Rua José Geraldo, 580');
  });

  it('rota com ids que não são UUID (antiga do navegador/exemplo) é salva sem perder vínculos', async () => {
    const r = rotaDoConstrutor();
    const antiga: Rota = {
      ...r, id: 'rota-manha-ida',
      paradas: r.paradas.map((p, i) => ({ ...p, id: 'stop-' + i })),
      passageiros: r.passageiros.map((x, i) => ({ ...x, id: 'a' + i, embarqueParadaId: 'stop-' + r.paradas.findIndex((p) => p.id === x.embarqueParadaId), desembarqueParadaId: 'stop-' + r.paradas.findIndex((p) => p.id === x.desembarqueParadaId) })),
    };
    const salva = await salvarRota(antiga);
    const lida = (await obterRota(salva.id))!;
    expect(lida.paradas).toHaveLength(5);
    const bia = lida.passageiros.find((x) => x.identificacao === 'Bia')!;
    expect(lida.paradas.find((p) => p.id === bia.embarqueParadaId)!.rotulo).toBe('Rua José Geraldo, 580');
    expect(lida.paradas.find((p) => p.id === bia.desembarqueParadaId)!.rotulo).toBe('Escola Dois');
  });

  it('rota com UUID que ainda não existe no banco entra como nova (em vez de "não encontrada")', async () => {
    const salva = await salvarRota({ ...rotaDoConstrutor(), id: novoId() });
    expect(db.routes).toHaveLength(1);
    expect((await listarRotas())[0].id).toBe(salva.id);
  });

  it('falha no meio não deixa rota pela metade nem apaga a versão anterior', async () => {
    const a = await salvarRota(rotaDoConstrutor());
    const carregada = (await obterRota(a.id))!;
    const quebrada = { ...carregada, paradas: carregada.paradas.map((p) => (p.tipo === 'escola' ? { ...p, destinoId: 'escola-que-nao-existe' } : p)) };
    await expect(salvarRota(quebrada)).rejects.toThrow(/escolas escolhidas não existe.*foreign key/);
    const lida = (await obterRota(a.id))!;
    expect(lida.paradas).toHaveLength(5);
    expect(lida.passageiros).toHaveLength(3);
  });

  it('erros claros: sem login, van de exemplo, aluno sem embarque — sem chamar o banco', async () => {
    await expect(salvarRota({ ...rotaDoConstrutor(), veiculoId: 'van-vm-demo' })).rejects.toThrow(/van cadastrada/);
    const r = rotaDoConstrutor();
    await expect(salvarRota({ ...r, passageiros: [{ ...r.passageiros[0], embarqueParadaId: null }] })).rejects.toThrow(/sem parada de embarque/);
    db.usuario = null;
    await expect(salvarRota(rotaDoConstrutor())).rejects.toThrow('Faça login para salvar a rota.');
    expect(db.chamadasRpc).toBe(0);
    expect(await listarRotas()).toEqual([]);
  });

  it('lista só as rotas do próprio motorista', async () => {
    db.routes.push({ id: 'd', owner_id: 'outro', is_demo: true, updated_at: '0', name: 'Demo' }, { id: 'o', owner_id: 'outro', is_demo: false, updated_at: '0', name: 'Alheia' });
    await salvarRota(rotaDoConstrutor());
    expect((await listarRotas()).map((x) => x.nome)).toEqual(['Manhã']);
  });

  it('normalização: novoId é sempre UUID; coordenada/horário inválidos viram "não informado"', () => {
    expect(novoId()).toMatch(UUID);
    const r = rotaDoConstrutor();
    r.paradas[1] = { ...r.paradas[1], lat: NaN, horarioChegadaMin: 2000 };
    const n = normalizarRotaParaSalvar(r);
    expect(n.paradas[1]).toMatchObject({ lat: undefined, lng: undefined, horarioChegadaMin: null });
  });
});
