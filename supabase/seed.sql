-- ============================================================================
-- Vambora — Seed de DEMONSTRAÇÃO (idempotente)
-- ----------------------------------------------------------------------------
-- Espelha os dados de exemplo da vitrine. TODOS marcados is_demo = true.
-- Telefones fictícios (DDD 18). Nenhuma pessoa real. Pode rodar várias vezes.
-- Rode DEPOIS das migrações 0001–0004.
-- ============================================================================

-- Cidade
insert into public.cities (id, name, uf) values
  ('aracatuba-sp', 'Araçatuba', 'SP')
on conflict (id) do update set name = excluded.name, uf = excluded.uf;

-- Destinos (códigos INEP NÃO são oficiais aqui -> source = 'demonstração')
insert into public.destinations (id, type, name, neighborhood, city_id, inep_code, turnos, source, lat, lng, is_demo) values
  ('esc-paineiras', 'escola',    'Colégio Paineiras (demonstração)',          'Centro',             'aracatuba-sp', null, array['manha','tarde']::public.turno[],            'demonstração', -21.2086, -50.4326, true),
  ('esc-horizonte', 'escola',    'Escola Novo Horizonte (demonstração)',      'Jardim Nova Iorque', 'aracatuba-sp', null, array['manha','tarde','integral']::public.turno[], 'demonstração', -21.1962, -50.4601, true),
  ('esc-sao-joao',  'escola',    'Instituto São João (demonstração)',         'Vila Mendonça',      'aracatuba-sp', null, array['manha','tarde']::public.turno[],            'demonstração', -21.2155, -50.4489, true),
  ('fac-unifatec',  'faculdade', 'Fatec Araçatuba (demonstração)',            'Jardim Alvorada',    'aracatuba-sp', null, array['noite']::public.turno[],                    'demonstração', -21.2228, -50.4178, true),
  ('fac-unimed-campus','faculdade','Campus Universitário Leste (demonstração)','Água Branca',       'aracatuba-sp', null, array['manha','noite']::public.turno[],            'demonstração', -21.1889, -50.4012, true)
on conflict (id) do update set
  type = excluded.type, name = excluded.name, neighborhood = excluded.neighborhood,
  city_id = excluded.city_id, turnos = excluded.turnos, source = excluded.source,
  lat = excluded.lat, lng = excluded.lng, is_demo = excluded.is_demo;

-- Motoristas (uuids fixos p/ idempotência; owner_id null = dado de demo)
insert into public.drivers (
  id, slug, name, description, city_id, neighborhoods, turnos,
  capacity_total, seats_available,
  feature_ac, feature_monitor, feature_seatbelt, feature_accessible,
  price_type, price_month, price_daily, rating_avg, rating_count,
  boarding_time, tolerance_before_min, tolerance_after_min,
  whatsapp, doc_verified, is_demo
) values
  ('11111111-1111-1111-1111-111111111111','dona-marcia-van-azul','Márcia Oliveira',
   'Dirijo transporte escolar há mais de 10 anos no Centro e região. Van revisada, pontualidade e carinho com cada aluno.',
   'aracatuba-sp', array['Centro','Vila Mendonça','Jardim Nova Iorque'], array['manha','tarde']::public.turno[],
   15, 3, true, true, true, false, 'fixo', 320, 25, 4.9, 42, '06:38', 3, 7, '5518999990001', false, true),

  ('22222222-2222-2222-2222-222222222222','carlos-transporte-seguro','Carlos Henrique',
   'Transporte seguro para o fundamental e médio. Rota pela zona norte com horários flexíveis e monitor a bordo.',
   'aracatuba-sp', array['Jardim Nova Iorque','Água Branca'], array['manha','tarde','integral']::public.turno[],
   18, 5, true, true, true, true, 'fixo', 350, 28, 4.7, 28, '06:50', 3, 7, '5518999990002', false, true),

  ('33333333-3333-3333-3333-333333333333','van-universitaria-noturna','Patrícia Souza',
   'Especialista em rotas universitárias noturnas. Levo e trago estudantes com segurança após as aulas.',
   'aracatuba-sp', array['Centro','Jardim Alvorada','Água Branca'], array['noite']::public.turno[],
   16, 7, true, false, true, false, 'fixo', 280, 22, 4.8, 35, '18:10', 3, 7, '5518999990003', false, true),

  ('44444444-4444-4444-4444-444444444444','rota-vila-mendonca','João Batista',
   'Rota tradicional da Vila Mendonça. Preço a combinar conforme distância e período. Atendo creche até o médio.',
   'aracatuba-sp', array['Vila Mendonça','Centro'], array['manha','tarde']::public.turno[],
   12, 0, false, true, true, false, 'a_combinar', null, null, 4.5, 19, '06:25', 3, 7, '5518999990004', false, true),

  ('55555555-5555-5555-5555-555555555555','preco-dinamico-norte','Fernanda Lima',
   'Rotas pela zona norte com preço que varia conforme a distância do embarque. Van nova, ar-condicionado e monitor.',
   'aracatuba-sp', array['Jardim Nova Iorque','Água Branca','Jardim Alvorada'], array['manha','noite']::public.turno[],
   16, 2, true, true, true, false, 'dinamico', 330, 26, 4.6, 23, '06:45', 3, 7, '5518999990005', false, true),

  ('66666666-6666-6666-6666-666666666666','van-centro-integral','Roberto Alves',
   'Atendo período integral no Centro. Busco na porta e acompanho o aluno até a entrada da escola.',
   'aracatuba-sp', array['Centro','Vila Mendonça'], array['integral','manha']::public.turno[],
   14, 4, true, true, true, true, 'fixo', 390, 30, 5.0, 16, '07:05', 3, 7, '5518999990006', false, true)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, city_id = excluded.city_id,
  neighborhoods = excluded.neighborhoods, turnos = excluded.turnos,
  capacity_total = excluded.capacity_total, seats_available = excluded.seats_available,
  feature_ac = excluded.feature_ac, feature_monitor = excluded.feature_monitor,
  feature_seatbelt = excluded.feature_seatbelt, feature_accessible = excluded.feature_accessible,
  price_type = excluded.price_type, price_month = excluded.price_month, price_daily = excluded.price_daily,
  rating_avg = excluded.rating_avg, rating_count = excluded.rating_count,
  boarding_time = excluded.boarding_time, whatsapp = excluded.whatsapp,
  doc_verified = excluded.doc_verified, is_demo = excluded.is_demo;

-- Relação motorista <-> destinos
insert into public.driver_destinations (driver_id, destination_id) values
  ('11111111-1111-1111-1111-111111111111','esc-paineiras'),
  ('11111111-1111-1111-1111-111111111111','esc-sao-joao'),
  ('22222222-2222-2222-2222-222222222222','esc-horizonte'),
  ('22222222-2222-2222-2222-222222222222','esc-paineiras'),
  ('33333333-3333-3333-3333-333333333333','fac-unifatec'),
  ('33333333-3333-3333-3333-333333333333','fac-unimed-campus'),
  ('44444444-4444-4444-4444-444444444444','esc-sao-joao'),
  ('44444444-4444-4444-4444-444444444444','esc-paineiras'),
  ('55555555-5555-5555-5555-555555555555','esc-horizonte'),
  ('55555555-5555-5555-5555-555555555555','fac-unimed-campus'),
  ('66666666-6666-6666-6666-666666666666','esc-paineiras'),
  ('66666666-6666-6666-6666-666666666666','esc-horizonte')
on conflict (driver_id, destination_id) do nothing;
