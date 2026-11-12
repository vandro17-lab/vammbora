-- ============================================================================
-- Dados de CENÁRIO (banco local descartável) para o teste do perfil real do
-- motorista. NUNCA rodar no Supabase.
--   A: conta com van e rota CONCLUÍDA com a própria van   -> pode aparecer
--   B: conta com van e rota em RASCUNHO; e uma rota concluída que aponta para a
--      van de A (associação incorreta)                    -> não pode aparecer
--   C: conta sem van e sem rota                           -> não pode aparecer
--   + 3 motoristas de DEMONSTRAÇÃO (2 publicados, 1 suspenso)
-- ============================================================================
insert into public.cities (id, name, uf) values ('aracatuba-sp', 'Araçatuba', 'SP') on conflict do nothing;
insert into public.destinations (id, type, name, city_id) values ('esc-teste', 'escola', 'Escola Teste', 'aracatuba-sp') on conflict do nothing;

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'a@teste.local', '{"full_name":"Conta A"}'),
  ('22222222-2222-4222-8222-222222222222', 'b@teste.local', '{"full_name":"Conta B"}'),
  ('33333333-3333-4333-8333-333333333333', 'c@teste.local', '{"full_name":"Conta C"}');
-- o gatilho do Supabase cria o perfil; o stub local não tem o gatilho em auth.users
insert into public.profiles (id, full_name) values
  ('11111111-1111-4111-8111-111111111111', 'Conta A'),
  ('22222222-2222-4222-8222-222222222222', 'Conta B'),
  ('33333333-3333-4333-8333-333333333333', 'Conta C')
on conflict (id) do nothing;

insert into public.drivers (slug, name, city_id, is_demo, is_published, is_suspended, rating_avg, rating_count) values
  ('tio-joao', 'Tio João', 'aracatuba-sp', true, true, false, 4.8, 12),
  ('tia-ana',  'Tia Ana',  'aracatuba-sp', true, true, false, 0, 0),
  ('demo-suspenso', 'Demo Suspenso', 'aracatuba-sp', true, true, true, 0, 0);
insert into public.driver_destinations (driver_id, destination_id)
  select id, 'esc-teste' from public.drivers where slug = 'tio-joao';

insert into public.vehicles (id, owner_id, model, seats_passenger) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Sprinter', 15),
  ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Master', 12);

insert into public.routes (id, owner_id, vehicle_id, city_id, name, direction, status) values
  ('aaaaaaaa-1111-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'aracatuba-sp', 'Ida manhã A', 'ida', 'concluida'),
  ('bbbbbbbb-1111-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0000-4000-8000-000000000001', 'aracatuba-sp', 'Rascunho B', 'ida', 'rascunho'),
  ('bbbbbbbb-1111-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'aaaaaaaa-0000-4000-8000-000000000001', 'aracatuba-sp', 'B com van de A', 'volta', 'concluida');

insert into public.route_stops (id, route_id, ordem, type, label, lat, lng, destination_id) values
  ('aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000001', 0, 'casa', 'Casa privada', -21.2, -50.4, null),
  ('aaaaaaaa-2222-4000-8000-000000000002', 'aaaaaaaa-1111-4000-8000-000000000001', 1, 'escola', 'Escola Teste', -21.21, -50.41, 'esc-teste');
insert into public.route_passengers (id, route_id, identificacao, board_stop_id, alight_stop_id) values
  ('aaaaaaaa-3333-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000001', 'Aluno privado',
   'aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-2222-4000-8000-000000000002');
