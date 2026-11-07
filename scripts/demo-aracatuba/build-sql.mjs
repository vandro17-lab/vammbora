// Gera os arquivos SQL do pacote demonstrativo VB150 a partir do MESMO gerador
// usado pelos testes de integração. Rode: `node scripts/demo-aracatuba/build-sql.mjs`
import { writeFileSync } from 'node:fs';
import { gerarBaseDemo } from './gerar.mjs';

const b = gerarBaseDemo();
const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const n = (v) => (v == null ? 'null' : String(v));
const bool = (v) => (v ? 'true' : 'false');
const arr = (items) => `'{${items.map((x) => `"${String(x).replace(/"/g, '\\"')}"`).join(',')}}'`;

const CID = "'aracatuba-sp'";
let nStops = 0, nPax = 0;
for (const r of b.routesDb) { nStops += r.stops.length; nPax += r.passengers.length; }

/* ============================ SEED (importação) ============================ */
const L = [];
L.push(`-- =====================================================================`);
L.push(`-- Vambora — BASE DEMONSTRATIVA "VB150" (Araçatuba) — IMPORTAÇÃO`);
L.push(`-- ---------------------------------------------------------------------`);
L.push(`-- GERADO por scripts/demo-aracatuba/build-sql.mjs (não editar à mão).`);
L.push(`-- ${b.meta.nMotoristas} motoristas, ${b.meta.nVeiculos} veículos, ${b.meta.nRotas} rotas`);
L.push(`-- (${b.meta.nRotas / 2} ida + ${b.meta.nRotas / 2} volta), ${nStops} paradas, ${nPax} passageiros.`);
L.push(`--`);
L.push(`-- Pontos de embarque: locais PÚBLICOS reais do OpenStreetMap (ponto de`);
L.push(`-- ônibus, praça, farmácia, UBS, terminal...), com osm_id no rótulo como`);
L.push(`-- prova. NUNCA sobre a coordenada da escola; não são residências reais.`);
L.push(`-- Escolas: apenas REFERENCIADAS por id (não recadastradas).`);
L.push(`--`);
L.push(`-- Identificadores ESTÁVEIS com prefixo de pacote 'b150d0' (uuid), o que`);
L.push(`-- permite remoção precisa (ver remover-demo-150-aracatuba.sql) sem tocar`);
L.push(`-- em dados reais nem em demonstrações anteriores (ids aleatórios).`);
L.push(`-- Idempotente (upsert por id + limpeza dos filhos do próprio pacote).`);
L.push(`-- Transacional (begin/commit). NÃO cria usuários no Supabase Auth: o dono`);
L.push(`-- placeholder é um profile existente (admin, senão o primeiro profile).`);
L.push(`-- =====================================================================`);
L.push(`begin;`);
L.push(``);
L.push(`-- Cidade garantida (idempotente).`);
L.push(`insert into public.cities (id,name,uf) values (${CID},'Araçatuba','SP') on conflict (id) do nothing;`);
L.push(``);
L.push(`-- Guarda: é preciso ao menos 1 profile para ser o dono placeholder de`);
L.push(`-- veículos/rotas (owner_id NOT NULL → profiles → auth.users). Erro claro`);
L.push(`-- em vez de violação de FK.`);
L.push(`do $$ begin`);
L.push(`  if (select count(*) from public.profiles) = 0 then`);
L.push(`    raise exception 'Nenhum profile encontrado para dono placeholder. Crie um usuário/admin antes de importar a demo.';`);
L.push(`  end if;`);
L.push(`end $$;`);
L.push(``);

// ---- DRIVERS ----
L.push(`-- MOTORISTAS (${b.drivers.length}) — is_demo=true, dono placeholder (owner_id null).`);
L.push(`insert into public.drivers (id,slug,owner_id,name,description,city_id,neighborhoods,turnos,capacity_total,seats_available,feature_ac,feature_monitor,feature_seatbelt,feature_accessible,price_type,price_month,price_daily,rating_avg,rating_count,boarding_time,tolerance_before_min,tolerance_after_min,whatsapp,doc_verified,is_demo,is_published,is_suspended,anuncio_ativo) values`);
const descr = (num) => `Perfil demonstrativo (VB150 #${num}) com rota sintética baseada em pontos públicos de Araçatuba (OpenStreetMap). Não representa pessoa ou serviço real.`;
L.push(b.drivers.map((d, i) => `(${q(d.id)},${q(d.slug)},null,${q(d.nome)},${q(descr(i + 1))},${CID},${arr(d.bairros)},${arr(d.turnos)}::public.turno[],${n(d.capacity_total)},${n(d.seats_available)},${bool(d.feature_ac)},${bool(d.feature_monitor)},${bool(d.feature_seatbelt)},${bool(d.feature_accessible)},${q(d.price_type)}::public.price_type,${n(d.price_month)},${n(d.price_daily)},0.0,0,${q(d.boarding_time)},3,7,null,false,true,true,false,false)`).join(',\n'));
L.push(`on conflict (id) do update set slug=excluded.slug,name=excluded.name,description=excluded.description,city_id=excluded.city_id,neighborhoods=excluded.neighborhoods,turnos=excluded.turnos,capacity_total=excluded.capacity_total,seats_available=excluded.seats_available,feature_ac=excluded.feature_ac,feature_monitor=excluded.feature_monitor,feature_seatbelt=excluded.feature_seatbelt,feature_accessible=excluded.feature_accessible,price_type=excluded.price_type,price_month=excluded.price_month,price_daily=excluded.price_daily,boarding_time=excluded.boarding_time,is_demo=true,is_published=excluded.is_published,is_suspended=excluded.is_suspended;`);
L.push(``);

// ---- VEHICLES ----
L.push(`-- VEÍCULOS (${b.vehicles.length}) — is_demo=true, dono = admin (ou 1º profile).`);
L.push(`with o as (select coalesce((select user_id from public.user_roles where role='admin' limit 1),(select id from public.profiles limit 1)) as oid)`);
L.push(`insert into public.vehicles (id,owner_id,model,year,plate,seats_passenger,feature_ac,feature_accessible,feature_seatbelt,photo_urls,is_demo)`);
L.push(`select v.id,o.oid,v.model,v.year,v.plate,v.seats,v.ac,v.acc,v.belt,'{}'::text[],true from o cross join (values`);
L.push(b.vehicles.map((v) => `(${q(v.id)}::uuid,${q(v.model)},${n(v.year)},${q(v.plate)},${n(v.seats_passenger)},${bool(v.feature_ac)},${bool(v.feature_accessible)},${bool(v.feature_seatbelt)})`).join(',\n'));
L.push(`) as v(id,model,year,plate,seats,ac,acc,belt)`);
L.push(`on conflict (id) do update set owner_id=excluded.owner_id,model=excluded.model,year=excluded.year,plate=excluded.plate,seats_passenger=excluded.seats_passenger,feature_ac=excluded.feature_ac,feature_accessible=excluded.feature_accessible,feature_seatbelt=excluded.feature_seatbelt,is_demo=true;`);
L.push(``);

// ---- ROUTES ----
L.push(`-- ROTAS (${b.routesDb.length}) — status=concluida, is_demo=true, dono = admin (ou 1º profile).`);
L.push(`with o as (select coalesce((select user_id from public.user_roles where role='admin' limit 1),(select id from public.profiles limit 1)) as oid)`);
L.push(`insert into public.routes (id,owner_id,vehicle_id,city_id,name,direction,turno,days,monitor,monitor_ocupa_lugar,reserved_seats,last_dropoff_min,early_leave_limit_min,status,is_demo,is_published)`);
L.push(`select r.id,o.oid,r.vehicle_id,${CID},r.name,r.direction,r.turno::public.turno,'{"segunda","terca","quarta","quinta","sexta"}',r.monitor,r.mol,r.reserved,r.ldm,r.elm,'concluida',true,true from o cross join (values`);
L.push(b.routesDb.map((r) => `(${q(r.id)}::uuid,${q(r.vehicle_id)}::uuid,${q(r.name)},${q(r.direction)},${q(r.turno)},${bool(r.monitor)},${bool(r.monitor_ocupa_lugar)},${n(r.reserved_seats)},${n(r.last_dropoff_min)},${n(r.early_leave_limit_min)})`).join(',\n'));
L.push(`) as r(id,vehicle_id,name,direction,turno,monitor,mol,reserved,ldm,elm)`);
L.push(`on conflict (id) do update set owner_id=excluded.owner_id,vehicle_id=excluded.vehicle_id,city_id=excluded.city_id,name=excluded.name,direction=excluded.direction,turno=excluded.turno,days=excluded.days,monitor=excluded.monitor,monitor_ocupa_lugar=excluded.monitor_ocupa_lugar,reserved_seats=excluded.reserved_seats,last_dropoff_min=excluded.last_dropoff_min,early_leave_limit_min=excluded.early_leave_limit_min,status='concluida',is_demo=true,is_published=true;`);
L.push(``);

// ---- limpeza idempotente dos filhos do pacote (antes de reinserir) ----
L.push(`-- Limpeza idempotente: remove paradas/passageiros ANTIGOS deste pacote`);
L.push(`-- (prefixo b150d0) antes de reinserir o estado atual. Só toca no pacote.`);
L.push(`delete from public.route_passengers where route_id::text like 'b150d0%';`);
L.push(`delete from public.route_stops      where route_id::text like 'b150d0%';`);
L.push(``);

// ---- ROUTE_STOPS ----
L.push(`-- PARADAS (${nStops}).`);
L.push(`insert into public.route_stops (id,route_id,ordem,type,label,lat,lng,confirmed,destination_id,leg_time_min,habitual_arrival_min) values`);
const stopRows = [];
for (const r of b.routesDb) {
  for (const s of r.stops) {
    stopRows.push(`(${q(s.id)}::uuid,${q(r.id)}::uuid,${n(s.ordem)},${q(s.type)},${q(s.label)},${n(s.lat)},${n(s.lng)},true,${s.destination_id ? q(s.destination_id) : 'null'},${n(s.leg_time_min)},${n(s.habitual_arrival_min)})`);
  }
}
L.push(stopRows.join(',\n'));
L.push(`on conflict (id) do update set route_id=excluded.route_id,ordem=excluded.ordem,type=excluded.type,label=excluded.label,lat=excluded.lat,lng=excluded.lng,confirmed=excluded.confirmed,destination_id=excluded.destination_id,leg_time_min=excluded.leg_time_min,habitual_arrival_min=excluded.habitual_arrival_min;`);
L.push(``);

// ---- ROUTE_PASSENGERS ----
L.push(`-- PASSAGEIROS (${nPax}) — identificadores anônimos (nenhum nome real).`);
L.push(`insert into public.route_passengers (id,route_id,identificacao,board_stop_id,alight_stop_id,destination_id,horario_habitual_min,atendimento_min,atendimento_origem) values`);
const paxRows = [];
for (const r of b.routesDb) {
  for (const p of r.passengers) {
    paxRows.push(`(${q(p.id)}::uuid,${q(r.id)}::uuid,${q(p.identificacao)},${q(p.board_stop_id)}::uuid,${q(p.alight_stop_id)}::uuid,${p.destination_id ? q(p.destination_id) : 'null'},${n(p.horario_habitual_min)},${n(p.atendimento_min)},'provisorio')`);
  }
}
L.push(paxRows.join(',\n'));
L.push(`on conflict (id) do update set route_id=excluded.route_id,identificacao=excluded.identificacao,board_stop_id=excluded.board_stop_id,alight_stop_id=excluded.alight_stop_id,destination_id=excluded.destination_id,horario_habitual_min=excluded.horario_habitual_min,atendimento_min=excluded.atendimento_min,atendimento_origem=excluded.atendimento_origem;`);
L.push(``);

// ---- DRIVER_DESTINATIONS ----
L.push(`-- VÍNCULO MOTORISTA↔ESCOLA (${b.driverDestinations.length}).`);
L.push(`insert into public.driver_destinations (driver_id,destination_id) values`);
L.push(b.driverDestinations.map((d) => `(${q(d.driver_id)}::uuid,${q(d.destination_id)})`).join(',\n'));
L.push(`on conflict (driver_id,destination_id) do nothing;`);
L.push(``);
L.push(`commit;`);
L.push(``);
L.push(`-- =====================================================================`);
L.push(`-- VALIDAÇÃO (rode após o commit; deve bater com os números do pacote):`);
L.push(`--   select count(*) from public.drivers           where id::text like 'b150d0%';  -- 150`);
L.push(`--   select count(*) from public.vehicles          where id::text like 'b150d0%';  -- 150`);
L.push(`--   select count(*) from public.routes            where id::text like 'b150d0%';  -- 300`);
L.push(`--   select count(*) from public.route_stops       where id::text like 'b150d0%';  -- ${nStops}`);
L.push(`--   select count(*) from public.route_passengers  where id::text like 'b150d0%';  -- ${nPax}`);
L.push(`--   -- cobertura: 41 escolas distintas atendidas por rotas do pacote:`);
L.push(`--   select count(distinct destination_id) from public.route_stops`);
L.push(`--     where id::text like 'b150d0%' and type='escola';                            -- 41`);
L.push(`-- =====================================================================`);

writeFileSync('supabase/seed-demo-150-aracatuba.sql', L.join('\n') + '\n');

/* ============================ REMOÇÃO SEGURA ============================ */
const D = [];
D.push(`-- =====================================================================`);
D.push(`-- Vambora — BASE DEMONSTRATIVA "VB150" — REMOÇÃO SEGURA`);
D.push(`-- ---------------------------------------------------------------------`);
D.push(`-- Remove EXCLUSIVAMENTE os registros gerados por este pacote (prefixo de`);
D.push(`-- uuid 'b150d0'). NÃO toca em: dados reais, destinos/escolas, nem em`);
D.push(`-- demonstrações anteriores (que usam ids aleatórios sem esse prefixo).`);
D.push(`-- Transacional e idempotente (rodar de novo não causa erro).`);
D.push(`-- =====================================================================`);
D.push(`begin;`);
D.push(`delete from public.route_passengers   where id::text like 'b150d0%' or route_id::text like 'b150d0%';`);
D.push(`delete from public.route_stops        where id::text like 'b150d0%' or route_id::text like 'b150d0%';`);
D.push(`delete from public.driver_destinations where driver_id::text like 'b150d0%';`);
D.push(`delete from public.routes             where id::text like 'b150d0%';`);
D.push(`delete from public.vehicles           where id::text like 'b150d0%';`);
D.push(`delete from public.drivers            where id::text like 'b150d0%';`);
D.push(`commit;`);
D.push(``);
writeFileSync('supabase/remover-demo-150-aracatuba.sql', D.join('\n') + '\n');

console.log('OK seed/remoção gerados. drivers=%d vehicles=%d routes=%d stops=%d pax=%d vinculos=%d',
  b.drivers.length, b.vehicles.length, b.routesDb.length, nStops, nPax, b.driverDestinations.length);
