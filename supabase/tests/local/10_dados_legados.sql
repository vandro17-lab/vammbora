-- Estado "antes da etapa 1": uma rota real gravada pelo app antigo.
insert into public.cities (id, name, uf) values ('aracatuba-sp', 'Araçatuba', 'SP') on conflict do nothing;
insert into public.destinations (id, type, name, city_id, lat, lng) values
  ('esc-a', 'escola', 'Escola A', 'aracatuba-sp', -21.20, -50.43),
  ('esc-b', 'escola', 'Escola B', 'aracatuba-sp', -21.21, -50.44),
  ('esc-c', 'escola', 'Escola C', 'aracatuba-sp', -21.22, -50.45)
on conflict do nothing;
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'motorista@teste.local'),
  ('22222222-2222-4222-8222-222222222222', 'outro@teste.local');
insert into public.vehicles (id, owner_id, model, seats_passenger)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Van', 15);
insert into public.routes (id, owner_id, vehicle_id, city_id, name, direction, turno, days, last_dropoff_min, early_leave_limit_min, status)
  values ('99999999-9999-4999-8999-999999999999', '11111111-1111-4111-8111-111111111111',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aracatuba-sp', 'Antiga', 'ida', 'manha', '{seg,ter}', 420, null, 'concluida');
insert into public.route_stops (id, route_id, ordem, type, label, lat, lng, confirmed, destination_id, habitual_arrival_min) values
  ('99999999-0000-4000-8000-000000000000', '99999999-9999-4999-8999-999999999999', 0, 'saida',  'Garagem', -21.19, -50.42, true, null, null),
  ('99999999-0000-4000-8000-000000000001', '99999999-9999-4999-8999-999999999999', 1, 'casa',   'Rua 1, 10', -21.195, -50.425, true, null, 400),
  ('99999999-0000-4000-8000-000000000002', '99999999-9999-4999-8999-999999999999', 2, 'escola', 'Escola A', -21.20, -50.43, true, 'esc-a', 415);
insert into public.route_passengers (id, route_id, identificacao, board_stop_id, alight_stop_id, destination_id, horario_habitual_min, atendimento_min, atendimento_origem)
  values ('99999999-1111-4111-8111-000000000001', '99999999-9999-4999-8999-999999999999', 'Ana',
          '99999999-0000-4000-8000-000000000001', '99999999-0000-4000-8000-000000000002', 'esc-a', 400, 2, 'informado');
