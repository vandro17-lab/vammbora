-- ============================================================================
-- VanBora — a vitrine pública (public.public_listings) passa a ser SOMENTE LEITURA
-- ----------------------------------------------------------------------------
-- PROBLEMA (confirmado em 12/11/2026, apenas com leitura e EXPLAIN):
--   * public_listings é uma view simples, logo AUTOMATICAMENTE ATUALIZÁVEL:
--     INSERT/UPDATE/DELETE nela são repassados para public.drivers;
--   * views rodam com os privilégios da DONA (postgres, BYPASSRLS): as
--     políticas RLS de drivers NÃO se aplicam a escritas feitas pela view;
--   * os privilégios padrão do Supabase deram a anon e authenticated TODOS os
--     privilégios na view (anon=arwdDxtm), e o gatilho proteger_campos_driver
--     libera tudo quando auth.uid() é nulo (chamada anônima).
--   Resultado: com a chave anon (pública), era possível criar, alterar ou
--   apagar motoristas da vitrine pela API REST.
--
-- CORREÇÃO MÍNIMA: retirar SOMENTE os privilégios de escrita da view.
--   * SELECT continua concedido: a vitrine pública segue funcionando;
--   * a view NÃO é recriada; nenhuma tabela, linha, política, gatilho ou
--     função é alterada; service_role e postgres não são afetados.
--   * Idempotente: REVOKE de privilégio já ausente não gera erro.
--
-- EXECUÇÃO ATÔMICA: rode o arquivo inteiro numa única transação (a ferramenta
-- de migração do Supabase já faz isso; no psql use `psql -1 -f`). Se a
-- autoverificação falhar, o REVOKE é desfeito junto.
--
-- ATENÇÃO PARA O FUTURO: os privilégios padrão do schema public concedem tudo
-- a anon/authenticated em objetos NOVOS. Se esta view for apagada e criada de
-- novo (DROP + CREATE), a escrita volta. CREATE OR REPLACE VIEW mantém os
-- privilégios (ensaiado). Toda migração que recriar a view deve repetir este
-- REVOKE; o teste supabase/tests/public_listings_somente_leitura.sql acusa a
-- regressão.
-- ============================================================================

revoke insert, update, delete, truncate
  on table public.public_listings
  from anon, authenticated, public;

-- Autoverificação: aborta (e desfaz o REVOKE) se o resultado não for o esperado.
do $$
declare
  papel text;
  priv  text;
begin
  foreach papel in array array['anon', 'authenticated'] loop
    foreach priv in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
      if has_table_privilege(papel, 'public.public_listings', priv) then
        raise exception 'Correção incompleta: % ainda tem % em public.public_listings', papel, priv;
      end if;
    end loop;
    foreach priv in array array['INSERT', 'UPDATE'] loop
      if has_any_column_privilege(papel, 'public.public_listings', priv) then
        raise exception 'Correção incompleta: % ainda tem % em alguma coluna de public.public_listings', papel, priv;
      end if;
    end loop;
    if not has_table_privilege(papel, 'public.public_listings', 'SELECT') then
      raise exception 'A leitura pública seria perdida para %: abortando', papel;
    end if;
  end loop;
end $$;
