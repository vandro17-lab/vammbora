// =====================================================================
// Gerador DETERMINÍSTICO da base demonstrativa de Araçatuba (pacote VB150).
// ---------------------------------------------------------------------
// Produz 150 motoristas, 150 veículos e 300 rotas (150 ida + 150 volta),
// cobrindo os 41 destinos escolares reais já cadastrados, usando:
//  - coordenadas de ESCOLA reais (catálogo Supabase, is_demo=false);
//  - pontos de EMBARQUE públicos reais do OpenStreetMap (nunca sobre a
//    coordenada da escola; nunca residências; cada ponto tem osm_id).
//
// Único ponto de verdade: tanto o SQL (build-sql.mjs) quanto os testes de
// integração consomem ESTE módulo — logo, o que os testes provam é o que
// o SQL grava.
//
// Matriz de tempo/distância IDÊNTICA à `criarMatrizDemo()` do motor
// (haversine * 1.35 de fator de ruas, 24 km/h), para que os horários
// gravados sejam coerentes com o que o motor recalcula na busca.
// =====================================================================
import { DESTINOS, PONTOS } from './dados.mjs';

/* ----------------------------- utilidades ----------------------------- */
const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
export function haversineMetros(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
const FATOR_RUAS = 1.35;
const M_POR_MIN = (24 * 1000) / 60; // 400 m/min
function trechoMin(a, b) {
  if (a.lat === b.lat && a.lng === b.lng) return 0;
  const metros = Math.round(haversineMetros(a, b) * FATOR_RUAS);
  return Math.max(1, Math.round(metros / M_POR_MIN));
}

// RNG determinístico (mulberry32).
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// UUID determinístico com prefixo FIXO do pacote: 'b150d0' + categoria(2 hex)
// + sequência(24 hex). Permite remoção precisa por `id::text like 'b150d0%'`
// sem tocar em dados reais nem em demos anteriores (ids aleatórios).
function uuid(cat, seq) {
  const hex = 'b150d0' + cat + seq.toString(16).padStart(24, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
const CAT = { driver: '01', vehicle: '02', route: '03', stop: '04', pax: '05' };

const BBOX = { s: -21.27, n: -21.14, w: -50.52, e: -50.38 };
const dentroBbox = (p) => p.lat > BBOX.s && p.lat < BBOX.n && p.lng > BBOX.w && p.lng < BBOX.e;

// Turnos e horários demonstrativos (minuto do dia). Hipótese explícita e
// consistente: sem horário escolar oficial confirmado, usamos janelas padrão.
const TURNOS = {
  manha:    { idaEscolaMin: 7 * 60,            voltaEscolaMin: 11 * 60 + 40 },
  tarde:    { idaEscolaMin: 12 * 60 + 40,      voltaEscolaMin: 17 * 60 + 40 },
  noite:    { idaEscolaMin: 18 * 60 + 40,      voltaEscolaMin: 22 * 60 + 30 },
  integral: { idaEscolaMin: 7 * 60,            voltaEscolaMin: 17 * 60 },
};
const ATEND_MIN = 1;         // atendimento por aluno (provisório)
const MARGEM_MIN = 5;        // margem operacional (igual ao motor)
const CAPS = [12, 15, 16, 20];
const MODELOS = {
  12: 'Mercedes-Benz Sprinter 415',
  15: 'Renault Master L2H2',
  16: 'Fiat Ducato Minibus',
  20: 'Iveco Daily Minibus',
};

/* --------------------- seleção de pontos de embarque --------------------- */
// Candidatos: pontos OSM a partir de 250 m da escola (nunca sobre a escola),
// dentro de um RAIO adaptativo para manter a operação geograficamente coerente
// (cluster justo). Começa em 2200 m e amplia só o necessário para reunir
// `minimo` pontos; teto 3500 m (ainda dentro da mesma região da cidade).
function candidatosPerto(escola, minimo = 10) {
  const todos = PONTOS
    .map((p) => ({ p, d: haversineMetros(escola, p) }))
    .filter((x) => x.d >= 250)
    .sort((a, b) => a.d - b.d);
  for (let raio = 2200; raio <= 3500; raio += 400) {
    const dentro = todos.filter((x) => x.d <= raio);
    if (dentro.length >= minimo) return dentro.map((x) => x.p);
  }
  return todos.filter((x) => x.d <= 3500).map((x) => x.p);
}

function distribuirPax(total, nCasas) {
  // distribui `total` passageiros em `nCasas` casas, cada uma >= 1.
  const base = Math.floor(total / nCasas);
  const resto = total - base * nCasas;
  const arr = Array.from({ length: nCasas }, (_, i) => base + (i < resto ? 1 : 0));
  return arr.map((n) => Math.max(1, n));
}

/* ------------------------------- gerador -------------------------------- */
export function gerarBaseDemo() {
  const rand = rng(20261107);
  const drivers = [];
  const vehicles = [];
  const driverDestinations = [];
  const routesDb = [];
  const routesDomain = []; // { rota, veiculo } no formato do domínio (src/types/motorista)

  let seqStop = 0;
  let seqPax = 0;

  // PLANO DE COBERTURA (fan-out): por escola, MUITAS vans em cada turno, para
  // garantir muitas opções em qualquer busca (perto ou longe), com horários e
  // preços variados. Toda van atende a escola DIRETAMENTE (Tier A).
  const POR_TURNO = { manha: 6, tarde: 4, noite: 3 };
  const plano = [];
  for (const escolaP of DESTINOS) {
    for (const [t, k] of Object.entries(POR_TURNO)) {
      for (let j = 0; j < k; j++) plano.push({ escola: escolaP, turno: t });
    }
  }

  for (let i = 0; i < plano.length; i++) {
    const num = i + 1;
    const driverId = uuid(CAT.driver, num);
    const vehicleId = uuid(CAT.vehicle, num);
    const escola = plano[i].escola;
    const turno = plano[i].turno;
    const horarios = TURNOS[turno];

    const seats = CAPS[i % CAPS.length];
    const monitor = i % 10 < 3;                   // ~30% com monitor
    const monitorOcupa = monitor && i % 2 === 0;   // metade dos monitores ocupa lugar
    const reserved = i % 12 === 0 ? 1 : 0;         // alguns com 1 lugar reservado
    const capAlunos = Math.max(1, seats - (monitorOcupa ? 1 : 0) - reserved);

    // Rota CURTA: 2–3 pontos de coleta (passageiros JÁ existentes; o novo aluno
    // é inserido na busca). Poucas paradas ⇒ pouco tempo a bordo e embarques
    // próximos ao horário de chegada.
    const nCasas = 2 + (i % 2); // 2 ou 3 coletas
    // Ocupação variada: algumas lotadas (0 vaga), outras com 1–5 vagas. O total
    // fica limitado pela rota curta (até 3 por parada), mantendo o payload leve.
    const vagasPool = [0, 0, 1, 1, 1, 2, 2, 3, 4, 5];
    const vagasAlvo = vagasPool[Math.floor(rand() * vagasPool.length)];
    // vagasAlvo 0 ⇒ van LOTADA (ocupa toda a capacidade, ainda em 2–3 paradas);
    // caso contrário, limita a ocupação pela rota curta (até 3 por parada).
    const nPax = vagasAlvo === 0
      ? capAlunos
      : Math.max(1, Math.min(capAlunos - vagasAlvo, 3 * nCasas));
    const vagas = Math.max(0, capAlunos - nPax); // vagas REAIS exibidas
    const precisa = nCasas + 1; // + saída (base)
    const cands = candidatosPerto(escola, precisa + 8).slice(0, precisa + 10);
    if (cands.length < 3) throw new Error('Poucos pontos para escola ' + escola.id);
    const janela = Math.max(precisa + 2, Math.min(cands.length, precisa + 5));
    const offset = (i * 2) % Math.max(1, cands.length - janela + 1);
    const pool = cands.slice(offset, offset + janela);
    // Escolhe `precisa` pontos distintos do pool (determinístico).
    const escolhidos = [];
    const usados = new Set();
    let k = 0;
    while (escolhidos.length < precisa && k < pool.length * 3) {
      const idx = (k * 7 + i) % pool.length;
      if (!usados.has(idx)) { usados.add(idx); escolhidos.push(pool[idx]); }
      k++;
    }
    while (escolhidos.length < precisa) escolhidos.push(pool[escolhidos.length % pool.length]);

    // 2ª escola próxima (multi-escola) para ~1 em cada 5 motoristas, se houver
    // destino real a <= 1600 m da primária.
    let escola2 = null;
    if (i % 5 === 2) {
      const perto = DESTINOS
        .filter((d) => d.id !== escola.id)
        .map((d) => ({ d, dist: haversineMetros(escola, d) }))
        .filter((x) => x.dist <= 1600)
        .sort((a, b) => a.dist - b.dist);
      if (perto.length) escola2 = perto[0].d;
    }

    const bairros = [escola.bairro, escola2?.bairro].filter(Boolean);
    // Mensalidade por ALUNO desta van: valor FIXO por aluno (não por trecho),
    // diferente de van para van. É o valor que o cartão de busca exibe.
    const precoMensal = 280 + (i % 25) * 7; // 280..448
    const boardingMin = horarios.idaEscolaMin - 70 - (i % 15);

    drivers.push({
      id: driverId,
      slug: `vb150-mot-${String(num).padStart(3, '0')}`,
      nome: `Transporte Escolar Demo ${String(num).padStart(3, '0')}`,
      bairros,
      turnos: [turno],
      capacity_total: seats,
      seats_available: vagas,
      feature_ac: i % 2 === 0,
      feature_monitor: monitor,
      feature_seatbelt: true,
      feature_accessible: i % 8 === 0,
      // Demo: todas as vans com mensalidade FIXA por aluno (valor visível na busca).
      price_type: 'fixo',
      price_month: precoMensal,
      price_daily: null,
      boarding_time: minToHHMM(boardingMin),
      turno,
    });

    vehicles.push({
      id: vehicleId,
      model: MODELOS[seats],
      year: 2018 + (i % 8),
      plate: `VB150-VAN-${String(num).padStart(3, '0')}`,
      seats_passenger: seats,
      feature_ac: i % 2 === 0,
      feature_accessible: i % 8 === 0,
      feature_seatbelt: true,
    });

    const vinc = new Set([escola.id]);
    if (escola2) vinc.add(escola2.id);
    for (const did of vinc) driverDestinations.push({ driver_id: driverId, destination_id: did });

    const veiculoDom = {
      id: vehicleId, modelo: MODELOS[seats], lugaresPassageiro: seats,
      arCondicionado: i % 2 === 0, acessivel: i % 8 === 0, cintos: true, fotos: [],
    };

    // Distribuição de passageiros por casa.
    const distr = distribuirPax(nPax, nCasas);

    // --------- ROTA DE IDA: base -> casas (longe->perto) -> escola(s) ---------
    const ida = construirIda({
      driverId, vehicleId, num, escola, escola2, turno, horarios,
      seats, monitor, monitorOcupa, reserved, escolhidos, distr, precoMensal,
      nextStop: () => uuid(CAT.stop, ++seqStop),
      nextPax: () => uuid(CAT.pax, ++seqPax),
    });
    // --------- ROTA DE VOLTA: base -> escola -> casas (perto->longe) ---------
    const volta = construirVolta({
      driverId, vehicleId, num, escola, turno, horarios,
      seats, monitor, monitorOcupa, reserved, escolhidos, distr, precoMensal,
      nextStop: () => uuid(CAT.stop, ++seqStop),
      nextPax: () => uuid(CAT.pax, ++seqPax),
    });

    for (const r of [ida, volta]) {
      routesDb.push(r.db);
      routesDomain.push({ rota: r.rota, veiculo: veiculoDom });
    }
  }

  return { drivers, vehicles, driverDestinations, routesDb, routesDomain,
    meta: { nMotoristas: drivers.length, nVeiculos: vehicles.length, nRotas: routesDb.length } };
}

function minToHHMM(m) {
  const mm = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
}

/* ----------------------- construção das rotas ----------------------- */
function construirIda(o) {
  const { driverId, vehicleId, num, escola, escola2, turno, horarios, seats,
    monitor, monitorOcupa, reserved, escolhidos, distr, precoMensal, nextStop, nextPax } = o;

  // escolhidos[0] = mais próximo da escola ... último = mais distante.
  // Ida: base (mais distante) -> casas (distante->perto) -> escola.
  const ordenados = [...escolhidos].reverse(); // distante -> perto
  const base = ordenados[0];
  const casasPts = ordenados.slice(1); // nCasas pontos, perto no fim

  const routeId = uuid('03', num * 2 - 1);
  const stops = [];
  const passengers = [];

  // saída (base)
  const saidaId = nextStop();
  stops.push({ id: saidaId, ordem: 0, type: 'saida', label: rotuloPonto(base), lat: base.lat, lng: base.lng, destination_id: null });

  // casas
  const casaStops = [];
  casasPts.forEach((pt, idx) => {
    const sid = nextStop();
    casaStops.push({ sid, pt, n: distr[idx] ?? 1 });
    stops.push({ id: sid, ordem: idx + 1, type: 'casa', label: rotuloPonto(pt), lat: pt.lat, lng: pt.lng, destination_id: null });
  });

  // escola(s)
  const escolaOrdem = casasPts.length + 1;
  const escolaStopId = nextStop();
  stops.push({ id: escolaStopId, ordem: escolaOrdem, type: 'escola', label: escola.nome, lat: escola.lat, lng: escola.lng, destination_id: escola.id });
  let escola2StopId = null;
  if (escola2) {
    escola2StopId = nextStop();
    stops.push({ id: escola2StopId, ordem: escolaOrdem + 1, type: 'escola', label: escola2.nome, lat: escola2.lat, lng: escola2.lng, destination_id: escola2.id });
  }

  // horários (minuto do dia), calculados de trás pra frente a partir da escola.
  const escolaChegada = horarios.idaEscolaMin;
  // tempo total base->...->escola (legs + atendimentos nas casas).
  const seqGeo = [base, ...casasPts, escola, ...(escola2 ? [escola2] : [])];
  // chegada por parada (forward), ancorando a 1ª escola em escolaChegada - margem.
  const tempos = calcularChegadas(seqGeo, casaStops.map((c) => c.n), escolaChegada - MARGEM_MIN, casasPts.length);
  // grava habitual_arrival_min: escola principal usa o LIMITE declarado (escolaChegada).
  stops[0].habitual_arrival_min = null; // saída não tem horário habitual
  casaStops.forEach((c, idx) => { stops[idx + 1].habitual_arrival_min = tempos.casas[idx]; });
  const escStop = stops[escolaOrdem];
  escStop.habitual_arrival_min = escolaChegada;
  if (escola2StopId) stops[escolaOrdem + 1].habitual_arrival_min = escolaChegada + 4;

  // leg_time_min (informativo): minutos até a próxima parada.
  for (let s = 0; s < stops.length - 1; s++) {
    stops[s].leg_time_min = trechoMin(stops[s], stops[s + 1]);
  }
  stops[stops.length - 1].leg_time_min = null;

  // passageiros: embarcam na casa, desembarcam na escola (alguns na 2ª escola).
  casaStops.forEach((c, idx) => {
    for (let j = 0; j < c.n; j++) {
      const pid = nextPax();
      // em multi-escola, ~1/3 dos alunos vai para a 2ª escola.
      const paraEscola2 = escola2 && ((idx + j) % 3 === 2);
      passengers.push({
        id: pid,
        identificacao: `VB150-D${String(num).padStart(3, '0')}-I-${String(idx + 1)}${j + 1}`,
        board_stop_id: c.sid,
        alight_stop_id: paraEscola2 ? escola2StopId : escolaStopId,
        destination_id: paraEscola2 ? escola2.id : escola.id,
        horario_habitual_min: tempos.casas[idx],
        atendimento_min: ATEND_MIN,
      });
    }
  });

  const lastDropoff = escola2StopId ? escolaChegada + 4 : escolaChegada;
  const db = montarDb({ routeId, driverId, vehicleId, num, escola, turno, direction: 'ida', monitor, monitorOcupa, reserved, lastDropoff, precoMensal, stops, passengers });
  const rota = montarDominio({ routeId, vehicleId, turno, direction: 'ida', monitor, monitorOcupa, reserved, lastDropoff, stops, passengers });
  return { db, rota };
}

function construirVolta(o) {
  const { driverId, vehicleId, num, escola, turno, horarios, seats,
    monitor, monitorOcupa, reserved, escolhidos, distr, precoMensal, nextStop, nextPax } = o;

  // Volta: base (perto da escola) -> escola (embarque) -> casas (perto->longe, desembarque).
  const ordenadosPerto = [...escolhidos]; // perto -> longe
  const base = ordenadosPerto[0];
  const casasPts = ordenadosPerto.slice(1); // perto no início, longe no fim

  const routeId = uuid('03', num * 2);
  const stops = [];
  const passengers = [];

  const saidaId = nextStop();
  stops.push({ id: saidaId, ordem: 0, type: 'saida', label: rotuloPonto(base), lat: base.lat, lng: base.lng, destination_id: null });

  const escolaStopId = nextStop();
  stops.push({ id: escolaStopId, ordem: 1, type: 'escola', label: escola.nome, lat: escola.lat, lng: escola.lng, destination_id: escola.id });

  const casaStops = [];
  casasPts.forEach((pt, idx) => {
    const sid = nextStop();
    casaStops.push({ sid, pt, n: distr[idx] ?? 1 });
    stops.push({ id: sid, ordem: idx + 2, type: 'casa', label: rotuloPonto(pt), lat: pt.lat, lng: pt.lng, destination_id: null });
  });

  // horários forward a partir da saída da escola.
  const escolaSaida = horarios.voltaEscolaMin;
  const seqGeo = [base, escola, ...casasPts];
  const chegadas = chegadasForward(seqGeo, [0, ...casaStops.map((c) => c.n)], escolaSaida);
  stops[0].habitual_arrival_min = null;
  stops[1].habitual_arrival_min = escolaSaida; // escola: saída declarada
  casaStops.forEach((c, idx) => { stops[idx + 2].habitual_arrival_min = chegadas[idx + 2]; });

  for (let s = 0; s < stops.length - 1; s++) stops[s].leg_time_min = trechoMin(stops[s], stops[s + 1]);
  stops[stops.length - 1].leg_time_min = null;

  casaStops.forEach((c, idx) => {
    for (let j = 0; j < c.n; j++) {
      const pid = nextPax();
      passengers.push({
        id: pid,
        identificacao: `VB150-D${String(num).padStart(3, '0')}-V-${String(idx + 1)}${j + 1}`,
        board_stop_id: escolaStopId,
        alight_stop_id: c.sid,
        destination_id: escola.id,
        horario_habitual_min: chegadas[idx + 2],
        atendimento_min: ATEND_MIN,
      });
    }
  });

  const lastDropoff = chegadas[chegadas.length - 1];
  const db = montarDb({ routeId, driverId, vehicleId, num, escola, turno, direction: 'volta', monitor, monitorOcupa, reserved, lastDropoff, precoMensal, stops, passengers });
  const rota = montarDominio({ routeId, vehicleId, turno, direction: 'volta', monitor, monitorOcupa, reserved, lastDropoff, stops, passengers });
  return { db, rota };
}

function rotuloPonto(pt) {
  const nome = pt.nome && pt.nome !== 'sem-nome' ? pt.nome : `Ponto público (${pt.tipo})`;
  return `Ponto de embarque demonstrativo — ${nome} [OSM ${pt.osm_type}/${pt.osm_id}]`;
}

// Calcula chegadas forward (ida): ancora a 1ª escola em `escolaAlvoMin`.
function calcularChegadas(seqGeo, paxPorCasa, escolaAlvoMin, nCasas) {
  // tempo relativo acumulado da saída (t=0) até cada parada.
  const rel = [0];
  for (let s = 1; s < seqGeo.length; s++) {
    const leg = trechoMin(seqGeo[s - 1], seqGeo[s]);
    const atendAnterior = s - 1 >= 1 && s - 1 <= nCasas ? (paxPorCasa[s - 2] ?? 0) * ATEND_MIN : 0;
    rel.push(rel[s - 1] + atendAnterior + leg);
  }
  // escola (índice nCasas+1) deve chegar em escolaAlvoMin -> partida:
  const idxEscola = nCasas + 1;
  const partida = escolaAlvoMin - rel[idxEscola];
  const casas = [];
  for (let c = 0; c < nCasas; c++) casas.push(partida + rel[c + 1]);
  return { partida, casas };
}

// Chegadas forward (volta): escola no índice 1 em `escolaSaidaMin`.
function chegadasForward(seqGeo, paxPorParada, escolaSaidaMin) {
  // parada 0 = base, 1 = escola (ancora), 2.. = casas.
  const rel = [0];
  for (let s = 1; s < seqGeo.length; s++) {
    const leg = trechoMin(seqGeo[s - 1], seqGeo[s]);
    const atendAnterior = (paxPorParada[s - 1] ?? 0) * ATEND_MIN;
    rel.push(rel[s - 1] + atendAnterior + leg);
  }
  const partida = escolaSaidaMin - rel[1];
  return rel.map((r) => partida + r);
}

function montarDb(o) {
  const { routeId, driverId, vehicleId, num, escola, turno, direction, monitor, monitorOcupa, reserved, lastDropoff, precoMensal, stops, passengers } = o;
  const nome = `Transporte Escolar Demo ${String(num).padStart(3, '0')} — ${escola.nome} — ${turno} — ${direction}`;
  return {
    id: routeId, owner_placeholder: true, driver_id: driverId, vehicle_id: vehicleId,
    name: nome, direction, turno, monitor, monitor_ocupa_lugar: monitorOcupa,
    reserved_seats: reserved, last_dropoff_min: lastDropoff, early_leave_limit_min: lastDropoff - 60,
    status: 'concluida', is_demo: true,
    price_type: 'fixo', price_month: precoMensal,
    stops, passengers,
  };
}

function montarDominio(o) {
  const { routeId, vehicleId, turno, direction, monitor, monitorOcupa, reserved, lastDropoff, stops, passengers } = o;
  return {
    id: routeId,
    nome: '',
    sentido: direction,
    turno,
    dias: ['segunda', 'terca', 'quarta', 'quinta', 'sexta'],
    veiculoId: vehicleId,
    monitor,
    monitorOcupaLugar: monitorOcupa,
    lugaresReservados: reserved,
    ultimoDesembarqueMin: lastDropoff,
    limiteAntecipacaoMin: lastDropoff - 60,
    status: 'concluida',
    isPublished: true,
    isDemo: true,
    atualizadoEm: '',
    paradas: stops.map((s) => ({
      id: s.id, ordem: s.ordem, tipo: s.type, rotulo: s.label,
      lat: s.lat, lng: s.lng, confirmado: true, destinoId: s.destination_id ?? null,
      destinoNome: s.type === 'escola' ? s.label : null,
      horarioChegadaMin: s.habitual_arrival_min ?? null, tempoAteProximaMin: s.leg_time_min ?? null,
    })),
    passageiros: passengers.map((p) => ({
      id: p.id, identificacao: p.identificacao,
      embarqueParadaId: p.board_stop_id, desembarqueParadaId: p.alight_stop_id,
      destinoId: p.destination_id ?? null, horarioHabitualMin: p.horario_habitual_min ?? null,
      atendimentoMin: p.atendimento_min ?? null, atendimentoOrigem: 'provisorio',
    })),
  };
}
