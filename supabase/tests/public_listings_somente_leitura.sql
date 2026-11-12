-- ============================================================================
-- TESTE (somente leitura): a vitrine pública aceita leitura e recusa escrita.
-- ----------------------------------------------------------------------------
-- Seguro para rodar em QUALQUER ambiente, inclusive produção:
--   * roda dentro de BEGIN READ ONLY e termina em ROLLBACK;
--   * as tentativas de escrita usam EXPLAIN (o PostgreSQL confere permissões
--     ao preparar o plano, mas não executa nada);
--   * nenhum dado é lido além de contagens.
-- Falha (RAISE EXCEPTION) se qualquer regra for violada.
-- ============================================================================
begin read only;

-- 1) Privilégios efetivos (catálogo)
do $$
declare papel text; priv text;
begin
  foreach papel in array array['anon', 'authenticated'] loop
    if not has_table_privilege(papel, 'public.public_listings', 'SELECT') then
      raise exception 'FALHA: % perdeu SELECT na vitrine', papel;
    end if;
    foreach priv in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
      if has_table_privilege(papel, 'public.public_listings', priv) then
        raise exception 'FALHA: % tem % na vitrine', papel, priv;
      end if;
    end loop;
    foreach priv in array array['INSERT', 'UPDATE'] loop
      if has_any_column_privilege(papel, 'public.public_listings', priv) then
        raise exception 'FALHA: % tem % em coluna da vitrine', papel, priv;
      end if;
    end loop;
  end loop;
  raise notice 'OK 1/3: privilégios do catálogo corretos';
end $$;

-- 2) Comportamento como anon e como authenticated: escrita recusada (42501)
do $$
declare papel text; cmd text; recusou boolean;
begin
  foreach papel in array array['anon', 'authenticated'] loop
    foreach cmd in array array[
      'explain update public.public_listings set name = name where id = ''00000000-0000-0000-0000-000000000000''::uuid',
      'explain delete from public.public_listings where id = ''00000000-0000-0000-0000-000000000000''::uuid',
      'explain insert into public.public_listings (slug, name, city_id) values (''teste-nao-executado'', ''x'', ''cidade-inexistente'')'
    ] loop
      recusou := false;
      begin
        execute format('set local role %I', papel);
        execute cmd;
      exception when insufficient_privilege then
        recusou := true;
      end;
      execute 'reset role';
      if not recusou then
        raise exception 'FALHA: % conseguiu preparar escrita na vitrine: %', papel, cmd;
      end if;
    end loop;
  end loop;
  raise notice 'OK 2/3: escrita recusada para anon e authenticated';
end $$;

-- 3) Leitura pública continua funcionando
do $$
declare n_anon bigint; n_auth bigint;
begin
  set local role anon;
  select count(*) into n_anon from public.public_listings;
  reset role;
  set local role authenticated;
  select count(*) into n_auth from public.public_listings;
  reset role;
  if n_anon <> n_auth then
    raise exception 'FALHA: anon vê % linhas e authenticated vê %', n_anon, n_auth;
  end if;
  raise notice 'OK 3/3: leitura pública funcionando (% linhas)', n_anon;
end $$;

rollback;
