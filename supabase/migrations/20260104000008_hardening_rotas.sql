-- ============================================================================
-- Vambora — Migração 0008: endurecimento de segurança do cadastro/rotas
-- ----------------------------------------------------------------------------
-- Tira do acesso público (REST /rpc) funções internas que não devem ser
-- chamadas diretamente por ninguém de fora. Elas continuam funcionando:
--  - como gatilho (proteger_documento), e
--  - chamadas internamente pela view public_listings (que roda como dono).
-- salvar_rota_completa segue disponível só para usuários autenticados.
-- Nada aqui apaga dados; apenas ajusta permissões (GRANT/REVOKE).
-- ============================================================================

revoke execute on function public.proteger_documento() from public;
revoke execute on function public.condutor_documentos_ok(uuid, text) from public;
revoke execute on function public.veiculo_documentos_ok(uuid, uuid, text) from public;
revoke execute on function public.motorista_elegivel(public.drivers) from public;

revoke execute on function public.salvar_rota_completa(jsonb) from public;
grant execute on function public.salvar_rota_completa(jsonb) to authenticated;
