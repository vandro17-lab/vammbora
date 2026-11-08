import { describe, it } from 'vitest';

/**
 * FASE 1 — LACUNAS CONHECIDAS (NÃO corrigir nesta fase).
 *
 * Estes `it.todo` DOCUMENTAM comportamentos ainda NÃO implementados / divergências
 * já identificadas (ver docs/vambora-motoristas/02-MAPA-INTEGRACOES.md). Eles
 * aparecem como "todo" no relatório do Vitest — não passam nem falham, logo não
 * mascaram falhas existentes nem são "passados artificialmente". Viram testes
 * reais (que devem passar) nas fases que os corrigirem, conforme 05-PLANO.
 */

describe('LACUNAS CONHECIDAS — a corrigir em fases futuras (não na Fase 1)', () => {
  // GAP-1 — Fase 5
  it.todo('GAP-1: editar recursos/capacidade da van (vehicles) deve refletir no marketplace (drivers/public_listings), respeitando publicação');
  it.todo('GAP-1: deve existir sincronização ou fonte de verdade única entre vehicles e drivers (hoje não há trigger nem join)');

  // GAP-1b — Fase 5
  it.todo('GAP-1b: o motorista deve conseguir criar/editar o próprio registro drivers (perfil público); hoje só o admin escreve em drivers');

  // GAP-2 — Fase 8 / plano do marketplace
  it.todo('GAP-2: a busca deve poder filtrar por recursos da van (ar-condicionado, acessibilidade...) quando o produto decidir; hoje recursos só são exibidos');

  // GAP-3 — pré-requisito das Fases 7/8
  it.todo('GAP-3: aplicar a migração 0010 (colunas de compromisso em route_passengers) ao Supabase, após aprovação');
  it.todo('GAP-3: corrigir salvar_rota_completa para upsert por id + COALESCE nos compromissos (hoje apaga e recria, arriscando ids/vínculos)');
  it.todo('GAP-3: aplicar/confirmar a RPC confirmar_encaixe_rota (confirmação atômica de encaixe) — ainda não existe no banco');

  // GAP-4 — Fases 2/6
  it.todo('GAP-4: unificar /pro (demonstrativo) e /painel (real) numa única experiência VanBora Motoristas, sem perder lógica');
});
