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
  routes: [] as Record<string, unknown>[], stops: [] as Record<string, unknown>[], pax: [] as Record<string, unknown>[], avail: [] as Record<string, unknown>[],
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
    const antes = JSON.stringify([db.routes, db.stops, db.pax, db.avail]);
    try {
      let id = uuid(p.id);
      const veic = uuid(p.vehicle_id);
      if (veic && !db.vehicles.includes(veic)) throw { message: 'violates foreign key constraint "routes_vehicle_id_fkey"', code: '23503' };
      const campos = { vehicle_id: veic, name: p.name ?? '', direction: p.direction ?? 'ida', turno: p.turno ?? null, days: p.days ?? [], monitor: !!p.monitor, monitor_ocupa_lugar: !!p.monitor_ocupa_lugar, reserved_seats: p.reserved_seats ?? 0, last_dropoff_min: p.last_dropoff_min ?? null, early_leave_limit_min: p.early_leave_limit_min ?? null, status: p.status ?? 'rascunho', habitual_departure_min: p.habitual_departure_min ?? null, turno_confirmed: !!p.turno_confirmed, availability_reviewed: !!p.availability_reviewed };
      if (p.status === 'concluida' && ((p.stops as Record<string, unknown>[]) ?? []).some((s) => s.type === 'escola' && !s.destination_id)) throw { message: 'Há uma parada de escola sem escola do catálogo.', code: 'P0001' };
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
      // Escolas disponíveis: substituídas só quando a chave vem no payload (migração 0015).
      if ('school_availability' in p) {
        db.avail = db.avail.filter((x) => x.route_id !== id);
        for (const e of (p.school_availability as Record<string, unknown>[]) ?? []) {
          if (!db.destinations.includes(String(e.destination_id))) throw { message: 'violates foreign key constraint "route_school_availability_destination_id_fkey"', code: '23503' };
          if (db.avail.some((x) => x.route_id === id && x.destination_id === e.destination_id)) continue; // unique (route_id, destination_id)
          db.avail.push({ ...e, id: uuid(e.id) ?? `30000000-0000-4000-8000-${String(++db.seq).padStart(12, '0')}`, route_id: id });
        }
      }
      return { data: id, error: null };
    } catch (e) {
      [db.routes, db.stops, db.pax, db.avail] = JSON.parse(antes); // transação: tudo ou nada
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
        .map((r) => ({ ...r, route_stops: db.stops.filter((s) => s.route_id === r.id), route_passengers: db.pax.filter((x) => x.route_id === r.id), route_school_availability: db.avail.filter((x) => x.route_id === r.id) }));
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

import { listarRotas, obterRota, salvarRota, novoId, normalizarRotaParaSalvar, duplicarRota, copiaDaRota, rotaParaBanco } from './motorista-store';
import { pendenciasDeRevisao } from '@/lib/cadastro-rota';

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

beforeEach(() => { db.usuario = 'user-1'; db.routes = []; db.stops = []; db.pax = []; db.avail = []; db.seq = 0; db.chamadasRpc = 0; });

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

/* ============================================================================
 * ETAPA 1 da busca/encaixe — salvar, reabrir, editar e duplicar preservam os
 * dados novos; zero continua zero e ausente continua ausente.
 * ========================================================================== */

/** Volta do MEIO-DIA do período da MANHÃ, com tudo o que a etapa 1 cadastra. */
function rotaEtapa1(): Rota {
  const [s, e1, c1, c2] = [novoId(), novoId(), novoId(), novoId()];
  return {
    id: '', nome: 'Volta do meio-dia', sentido: 'volta', turno: 'manha', periodoConfirmado: true, dias: ['seg', 'ter', 'qua'], veiculoId: VAN,
    monitor: false, monitorOcupaLugar: false, lugaresReservados: 0,
    ultimoDesembarqueMin: 780, saidaHabitualMin: 715, limiteAntecipacaoMin: 0,
    status: 'concluida', atualizadoEm: '', disponibilidadeRevisada: true,
    paradas: [
      { id: s, ordem: 0, tipo: 'saida', rotulo: 'Garagem', lat: -21.2051, lng: -50.4401, confirmado: true, tempoAteProximaMin: 5 },
      // Portão específico (coordenada diferente da do catálogo), mesma unidade 'esc-1'.
      { id: e1, ordem: 1, tipo: 'escola', rotulo: 'Escola Um', lat: -21.20013, lng: -50.42027, confirmado: true, destinoId: 'esc-1', portaoEspecifico: true, liberacaoMin: 720, atendimentoGrupoMin: 0.5, limiteChegadaMin: null, tempoAteProximaMin: 7 },
      { id: c1, ordem: 2, tipo: 'casa', rotulo: 'Rua A, 1', lat: -21.21, lng: -50.43, confirmado: true, tempoAteProximaMin: 3 },
      { id: c2, ordem: 3, tipo: 'casa', rotulo: 'Rua B, 2', lat: -21.22, lng: -50.44, confirmado: true, tempoAteProximaMin: null },
    ],
    passageiros: [
      // 30 segundos de atendimento; sem flexibilidade para antes (zero INFORMADO).
      { id: novoId(), identificacao: 'Ana', embarqueParadaId: e1, desembarqueParadaId: c1, destinoId: 'esc-1', horarioHabitualMin: 735, ajusteAntesMin: 0, ajusteDepoisMin: 5, atendimentoMin: 0.5, atendimentoOrigem: 'informado' },
      // Atendimento ZERO informado; flexibilidade e horário AUSENTES.
      { id: novoId(), identificacao: 'Bia', embarqueParadaId: e1, desembarqueParadaId: c2, destinoId: 'esc-1', horarioHabitualMin: null, ajusteAntesMin: null, ajusteDepoisMin: null, atendimentoMin: 0, atendimentoOrigem: 'informado' },
    ],
    escolasDisponiveis: [
      { id: novoId(), destinoId: 'esc-2', dias: ['seg', 'qua'], liberacaoMin: 725, atendimentoGrupoMin: 1.25, portaoLat: -21.19004, portaoLng: -50.41002 },
    ],
  };
}
/** Tudo o que a etapa 1 acrescenta, por nome (ids fora, para comparar cópias). */
const etapa1 = (r: Rota) => ({
  sentido: r.sentido, turno: r.turno, periodoConfirmado: r.periodoConfirmado, dias: r.dias,
  saida: r.saidaHabitualMin ?? null, antecipacao: r.limiteAntecipacaoMin, pontoFinal: r.ultimoDesembarqueMin, revisada: r.disponibilidadeRevisada,
  escolas: r.paradas.filter((p) => p.tipo === 'escola').map((p) => ({ destino: p.destinoId, lat: p.lat, lng: p.lng, portao: p.portaoEspecifico, limite: p.limiteChegadaMin ?? null, liberacao: p.liberacaoMin ?? null, grupo: p.atendimentoGrupoMin ?? null })),
  enderecos: r.paradas.map((p) => [p.tipo, p.rotulo, p.lat, p.lng]),
  alunos: [...r.passageiros].sort((a, b) => a.identificacao.localeCompare(b.identificacao)).map((x) => ({
    nome: x.identificacao, destino: x.destinoId, h: x.horarioHabitualMin ?? null, antes: x.ajusteAntesMin ?? null, depois: x.ajusteDepoisMin ?? null, atend: x.atendimentoMin ?? null,
    casa: r.paradas.find((p) => p.id === x.desembarqueParadaId)?.rotulo, escola: r.paradas.find((p) => p.id === x.embarqueParadaId)?.destinoId,
  })),
  disponiveis: (r.escolasDisponiveis ?? []).map((e) => ({ destino: e.destinoId, dias: e.dias, lat: e.portaoLat ?? null, lng: e.portaoLng ?? null, limite: e.limiteChegadaMin ?? null, liberacao: e.liberacaoMin ?? null, grupo: e.atendimentoGrupoMin ?? null })),
});

describe('etapa 1 — cadastro: salvar, reabrir, editar e duplicar', () => {
  it('salva e reabre tudo: saída, antecipação zero, período da manhã numa volta, visita, portão e alunos', async () => {
    const original = rotaEtapa1();
    const salva = await salvarRota(original);
    const lida = (await obterRota(salva.id))!;
    expect(etapa1(lida)).toEqual(etapa1(original));
    // Sentido e período são independentes: VOLTA do período da MANHÃ.
    expect(lida).toMatchObject({ sentido: 'volta', turno: 'manha', periodoConfirmado: true, saidaHabitualMin: 715 });
    // Zero ≠ ausente.
    expect(lida.limiteAntecipacaoMin).toBe(0);
    const [ana, bia] = ['Ana', 'Bia'].map((n) => lida.passageiros.find((x) => x.identificacao === n)!);
    expect(ana).toMatchObject({ ajusteAntesMin: 0, ajusteDepoisMin: 5, atendimentoMin: 0.5 });
    expect(bia).toMatchObject({ ajusteAntesMin: null, ajusteDepoisMin: null, horarioHabitualMin: null, atendimentoMin: 0 });
    // Portão específico mantém o ID da unidade do catálogo.
    expect(lida.paradas[1]).toMatchObject({ destinoId: 'esc-1', portaoEspecifico: true, lat: -21.20013, lng: -50.42027, liberacaoMin: 720, atendimentoGrupoMin: 0.5 });
    // Só o que realmente falta aparece para revisão: os dados ausentes da Bia.
    expect(pendenciasDeRevisao(lida)).toEqual([{ alvo: 'aluno', id: bia.id, titulo: 'Bia', faltas: ['horário habitual', 'flexibilidade para antes (0 se não tem)', 'flexibilidade para depois (0 se não tem)'] }]);
  });

  it('escola apenas disponível é gravada à parte: não vira parada nem aluno', async () => {
    const salva = await salvarRota(rotaEtapa1());
    expect(db.avail).toHaveLength(1);
    expect(db.avail[0]).toMatchObject({ route_id: salva.id, destination_id: 'esc-2', days: ['seg', 'qua'] });
    expect(db.stops.filter((s) => s.route_id === salva.id)).toHaveLength(4);
    expect(db.stops.some((s) => s.destination_id === 'esc-2')).toBe(false);
    const lida = (await obterRota(salva.id))!;
    expect(lida.paradas.filter((p) => p.tipo === 'escola').map((p) => p.destinoId)).toEqual(['esc-1']);
    expect(lida.escolasDisponiveis!.map((e) => e.destinoId)).toEqual(['esc-2']);
  });

  it('a disponibilidade pertence à rota: outra rota do mesmo motorista não herda nada', async () => {
    await salvarRota(rotaEtapa1());
    const outra = await salvarRota(rotaDoConstrutor());
    const lida = (await obterRota(outra.id))!;
    expect(lida.escolasDisponiveis).toEqual([]);
    expect(lida.disponibilidadeRevisada).toBe(false);
  });

  it('editar preserva o resto: muda um aluno e uma escola disponível sem perder os outros dados', async () => {
    const salva = await salvarRota(rotaEtapa1());
    const carregada = (await obterRota(salva.id))!;
    const editada: Rota = {
      ...carregada,
      passageiros: carregada.passageiros.map((x) => (x.identificacao === 'Bia' ? { ...x, horarioHabitualMin: 742, ajusteAntesMin: 0, ajusteDepoisMin: 0 } : x)),
      escolasDisponiveis: carregada.escolasDisponiveis!.map((e) => ({ ...e, dias: null })),
    };
    const b = await salvarRota(editada);
    expect(b.id).toBe(salva.id);
    const lida = (await obterRota(salva.id))!;
    expect(lida.passageiros.find((x) => x.identificacao === 'Bia')).toMatchObject({ horarioHabitualMin: 742, ajusteAntesMin: 0, ajusteDepoisMin: 0, atendimentoMin: 0 });
    expect(lida.passageiros.find((x) => x.identificacao === 'Ana')).toMatchObject({ horarioHabitualMin: 735, ajusteAntesMin: 0, ajusteDepoisMin: 5, atendimentoMin: 0.5 });
    expect(lida.escolasDisponiveis).toHaveLength(1);
    expect(lida.escolasDisponiveis![0]).toMatchObject({ destinoId: 'esc-2', dias: null, liberacaoMin: 725, atendimentoGrupoMin: 1.25 });
    expect(etapa1(lida).escolas).toEqual(etapa1(carregada).escolas);
    expect(lida).toMatchObject({ saidaHabitualMin: 715, limiteAntecipacaoMin: 0, ultimoDesembarqueMin: 780, periodoConfirmado: true });
  });

  it('duplicar cria rota independente (rascunho, não publicada) com TODOS os dados', async () => {
    const salva = await salvarRota(rotaEtapa1());
    const original = (await obterRota(salva.id))!;
    const copia = await duplicarRota(salva.id);
    expect(copia.id).not.toBe(salva.id);
    expect(db.routes).toHaveLength(2);
    const lida = (await obterRota(copia.id))!;
    expect(lida).toMatchObject({ nome: 'Volta do meio-dia (cópia)', status: 'rascunho', isPublished: false });
    expect(etapa1(lida)).toEqual(etapa1(original));
    // Ids novos em tudo: mexer na cópia não toca na original.
    const ids = (r: Rota) => [...r.paradas.map((p) => p.id), ...r.passageiros.map((x) => x.id), ...(r.escolasDisponiveis ?? []).map((e) => e.id)];
    expect(ids(lida).some((id) => ids(original).includes(id))).toBe(false);
    await salvarRota({ ...lida, escolasDisponiveis: [], passageiros: lida.passageiros.slice(0, 1) });
    expect(etapa1((await obterRota(salva.id))!)).toEqual(etapa1(original));
  });

  it('cópia local (sem salvar) também reaponta embarque/desembarque para as paradas novas', () => {
    const r = rotaEtapa1();
    const c = copiaDaRota(r);
    for (const x of c.passageiros) {
      expect(c.paradas.some((p) => p.id === x.embarqueParadaId)).toBe(true);
      expect(c.paradas.some((p) => p.id === x.desembarqueParadaId)).toBe(true);
    }
  });

  it('cadastro antigo: nada é inventado ao ler, ao salvar de novo nem ao duplicar — fica pendente', async () => {
    const antiga = await salvarRota(rotaDoConstrutor()); // sem nenhum campo da etapa 1
    const lida = (await obterRota(antiga.id))!;
    expect(lida).toMatchObject({ saidaHabitualMin: null, periodoConfirmado: false, disponibilidadeRevisada: false, escolasDisponiveis: [] });
    for (const p of lida.paradas.filter((x) => x.tipo === 'escola')) {
      // O horário habitual da parada NÃO é promovido a limite de chegada.
      expect(p).toMatchObject({ limiteChegadaMin: null, liberacaoMin: null, atendimentoGrupoMin: null, portaoEspecifico: false });
    }
    const bia = lida.passageiros.find((x) => x.identificacao === 'Bia')!;
    expect(bia).toMatchObject({ horarioHabitualMin: null, ajusteAntesMin: null, ajusteDepoisMin: null, atendimentoMin: null });
    const faltas = pendenciasDeRevisao(lida);
    expect(faltas.find((f) => f.alvo === 'rota')!.faltas.join(' ')).toMatch(/saída.*confirmação do período.*escolas que você aceita/);
    expect(faltas.filter((f) => f.alvo === 'escola')).toHaveLength(2);
    expect(faltas.filter((f) => f.alvo === 'aluno').map((f) => f.titulo).sort()).toEqual(['Bia', 'Caio']); // a Ana já estava completa
    // Reabrir e salvar sem mexer, e duplicar, continuam sem inventar nada.
    await salvarRota(lida);
    const copia = await duplicarRota(antiga.id);
    for (const r of [(await obterRota(antiga.id))!, (await obterRota(copia.id))!]) {
      expect(r).toMatchObject({ saidaHabitualMin: null, periodoConfirmado: false, disponibilidadeRevisada: false, limiteAntecipacaoMin: 15 });
      expect(r.passageiros.find((x) => x.identificacao === 'Bia')).toMatchObject({ ajusteAntesMin: null, atendimentoMin: null });
    }
  });

  it('normalização: escola disponível repetida ou que já é parada sai da lista; valores fora da faixa viram ausentes', () => {
    const r = rotaEtapa1();
    const n = normalizarRotaParaSalvar({
      ...r, saidaHabitualMin: 5000,
      paradas: r.paradas.map((p) => (p.tipo === 'casa' ? { ...p, limiteChegadaMin: 400, atendimentoGrupoMin: 2, portaoEspecifico: true } : p)),
      passageiros: r.passageiros.map((x) => ({ ...x, ajusteAntesMin: -3, atendimentoMin: 0.333 })),
      escolasDisponiveis: [...r.escolasDisponiveis!, { id: 'x', destinoId: 'esc-2', dias: null }, { id: 'y', destinoId: 'esc-1', dias: null }, { id: 'z', destinoId: '', dias: null }],
    });
    expect(n.saidaHabitualMin).toBeNull();
    expect(n.escolasDisponiveis!.map((e) => e.destinoId)).toEqual(['esc-2']);
    expect(n.escolasDisponiveis![0].id).toMatch(UUID);
    // Dados de visita só existem em parada de escola.
    expect(n.paradas.filter((p) => p.tipo === 'casa').every((p) => p.limiteChegadaMin == null && p.atendimentoGrupoMin == null && !p.portaoEspecifico)).toBe(true);
    expect(n.passageiros[0]).toMatchObject({ ajusteAntesMin: null, atendimentoMin: 0.33 });
    expect(n.limiteAntecipacaoMin).toBe(0);
  });

  it('toda escola vem do catálogo: rota concluída com escola sem ID é recusada antes do banco', async () => {
    const r = rotaEtapa1();
    await expect(salvarRota({ ...r, paradas: r.paradas.map((p) => (p.tipo === 'escola' ? { ...p, destinoId: null } : p)) })).rejects.toThrow(/sem escola escolhida/);
    expect(db.chamadasRpc).toBe(0);
    // Escola disponível fora do catálogo é recusada pelo banco (chave estrangeira).
    await expect(salvarRota({ ...r, escolasDisponiveis: [{ id: novoId(), destinoId: 'escola-que-nao-existe', dias: null }] })).rejects.toThrow(/foreign key/);
    expect(db.routes).toHaveLength(0);
  });

  it('payload enviado à RPC usa os nomes de coluna da migração 0015', () => {
    const b = rotaParaBanco(normalizarRotaParaSalvar(rotaEtapa1())) as Record<string, unknown> & { stops: Record<string, unknown>[]; school_availability: Record<string, unknown>[] };
    expect(b).toMatchObject({ direction: 'volta', turno: 'manha', turno_confirmed: true, habitual_departure_min: 715, early_leave_limit_min: 0, last_dropoff_min: 780, availability_reviewed: true });
    expect(b.stops[1]).toMatchObject({ destination_id: 'esc-1', gate_custom: true, release_time_min: 720, group_service_min: 0.5, arrival_deadline_min: null });
    expect(b.school_availability[0]).toMatchObject({ destination_id: 'esc-2', days: ['seg', 'qua'], release_time_min: 725, group_service_min: 1.25, gate_lat: -21.19004, gate_lng: -50.41002 });
  });
});
