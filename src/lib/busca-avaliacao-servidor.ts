import {
  avaliarRotaSegura, candidatasParaBusca, compararResultados, contarInconclusivas, dependeDeConsultaViaria,
  pontosDoPedido, resultadoPendente, resumirResultados, resumo, versaoDaAvaliacao,
  type EntradaBuscaReal, type OrigemEscola, type PedidoFamilia, type ResultadoRotaReal, type ResumoBusca,
} from '@/lib/busca-rotas-reais';
import { criarMatrizDemo } from '@/lib/encaixe';
import {
  MatrizPorCoordenadas, consultarTabelasEmBlocos, consultasNecessarias, pontosDistintos, type ConsultaBloco,
} from '@/lib/matriz-viaria-servidor';

/**
 * AVALIAÇÃO DA BUSCA COM TEMPOS REAIS (servidor) — orquestra QUAIS rotas
 * recebem a consulta viária em cada chamada. Não decide encaixe: quem decide
 * é sempre `avaliarRotaReal` (a mesma regra do simulador do motorista).
 *
 * Princípios:
 *  - Estimativa (linha reta × fator) serve SÓ para ordenar a fila. Nenhum
 *    resultado estimado é devolvido como encaixe nem como recusa.
 *  - Rota não calculada (fora do lote, provedor fora do ar, sem chave) é
 *    "avaliação incompleta" — nunca incompatível, nunca some.
 *  - O orçamento é por REQUISIÇÃO ao provedor; o que não coube devolve uma
 *    `continuacao`. Continuar avança a fila: as novas primeiro, depois as que
 *    falharam — as mesmas candidatas não ficam para sempre sem cálculo.
 *  - Falha de uma rota não derruba o resultado das outras.
 */

/** De onde a próxima chamada continua. `inicio`: posição na fila (ordem
 *  estável); `repetir`: rotas cuja consulta viária falhou e merecem nova tentativa. */
export interface Continuacao {
  inicio: number; repetir: string[];
  /** Assinatura da fila (rotas + vans) quando o lote anterior foi calculado. Se
   *  algo mudou desde então, a continuação NÃO vale: a avaliação recomeça. */
  assinatura?: string;
}

export interface OpcoesAvaliacao {
  /** Uma requisição ao provedor viário (origens × destinos). `null` = sem provedor configurado. */
  consultar: ConsultaBloco | null;
  /** Máx. de requisições ao provedor NESTA chamada. */
  maxConsultas: number;
  continuacao?: Continuacao | null;
}

export interface AvaliacaoServidor {
  /** Resultados desta chamada (sem PII): definitivos + os do lote calculado. */
  resultados: ResultadoRotaReal[];
  /** Candidatas do pedido (0 = ausência de oferta para esta escola/sentido). */
  totalRotasAvaliadas: number;
  inconclusivas: number;
  resumo: ResumoBusca;
  /** Rotas na fila que ainda NÃO receberam consulta viária (fora de `resultados`). */
  aguardando: number;
  /** Como continuar a avaliação; `null` = nada mais a calcular. */
  continuacao: Continuacao | null;
  /** O ambiente não tem provedor viário: nada pôde ser calculado pelas ruas. */
  semProvedor: boolean;
  /** A continuação recebida era de uma versão ANTIGA das rotas (alguém editou
   *  rota, alunos, escolas, horários ou a van): a fila recomeçou do zero e os
   *  resultados anteriores devem ser descartados por quem os guardou. */
  reiniciada: boolean;
}

const MOTIVO_SEM_PROVEDOR = 'O cálculo dos trajetos pelas ruas não está disponível neste ambiente — esta rota não pôde ser avaliada.';
const MOTIVO_FALHA_EXTERNA = 'O serviço de mapas não respondeu para esta rota — ela ainda não foi calculada. Isso não significa que não cabe.';
const MOTIVO_MATRIZ_PARCIAL = 'O serviço de mapas não devolveu todos os trechos desta rota — a avaliação ficou incompleta.';
const MOTIVO_ROTA_EXTENSA = 'Esta rota tem pontos demais para o cálculo automático — a avaliação não foi feita. Isso não significa que não cabe.';

const ORDEM_ORIGEM: Record<OrigemEscola, number> = { visita: 0, aceita: 1, proximidade: 2 };
const positivo = (r: ResultadoRotaReal) => r.status === 'compativel' || r.status === 'sob_confirmacao';

/** Ordem ESTÁVEL da fila de consulta viária. A estimativa só prioriza: quem
 *  parece caber primeiro, depois quem já visita a escola, quem a aceita e, por
 *  fim, cadastros antigos por proximidade. O id desempata (cursor reproduzível). */
function ordemDaFila(a: ResultadoRotaReal, b: ResultadoRotaReal): number {
  return Number(!positivo(a)) - Number(!positivo(b))
    || ORDEM_ORIGEM[a.origemEscola] - ORDEM_ORIGEM[b.origemEscola]
    || (a.minutosABordo ?? Infinity) - (b.minutosABordo ?? Infinity)
    || (a.rotaId < b.rotaId ? -1 : a.rotaId > b.rotaId ? 1 : 0);
}

export async function avaliarComTemposReais(
  entradas: EntradaBuscaReal[], pedido: PedidoFamilia, opcoes: OpcoesAvaliacao,
): Promise<AvaliacaoServidor> {
  const candidatas = candidatasParaBusca(entradas, pedido);
  const versoes = new Map(candidatas.map((e) => [e.rota.id, versaoDaAvaliacao(e.rota, e.veiculo)]));
  // Assinatura do conjunto avaliado: qualquer edição em rota, alunos, escolas,
  // horários ou van — e qualquer rota que entre/saia — muda este valor.
  const assinatura = resumo([...versoes].sort(([a], [b]) => (a < b ? -1 : 1)).map(([id, v]) => id + ':' + v).join(';'));
  const pedida = opcoes.continuacao ?? null;
  const reiniciada = !!pedida && pedida.assinatura !== undefined && pedida.assinatura !== assinatura;
  const anterior = reiniciada ? null : pedida;
  const fim = (resultados: ResultadoRotaReal[], aguardando: number, continuacao: Omit<Continuacao, 'assinatura'> | null, semProvedor = false): AvaliacaoServidor => {
    resultados.sort(compararResultados);
    return {
      resultados: resultados.map((r) => ({ ...r, versao: versoes.get(r.rotaId) })),
      totalRotasAvaliadas: candidatas.length, inconclusivas: contarInconclusivas(resultados) + aguardando,
      resumo: resumirResultados(resultados, candidatas.length), aguardando,
      continuacao: continuacao ? { ...continuacao, assinatura } : null, semProvedor, reiniciada,
    };
  };
  if (candidatas.length === 0) return fim([], 0, null);

  // 1) Prévia por estimativa: separa o que NÃO depende de tempo de trajeto
  //    (van sem cadastro, sem lugar, escola não aceita, falta de coordenada ou
  //    de horário) — definitivo, não gasta consulta — do que precisa das ruas.
  const estimativa = criarMatrizDemo();
  const porId = new Map(candidatas.map((e) => [e.rota.id, e]));
  const previa = candidatas.map((e) => avaliarRotaSegura(e.rota, e.veiculo, pedido, estimativa));
  const definitivos = previa.filter((r) => !dependeDeConsultaViaria(r));
  const fila = previa.filter(dependeDeConsultaViaria).sort(ordemDaFila);

  const pendente = (r: ResultadoRotaReal, motivo: string, codigo: 'sem_consulta_viaria' | 'busca_incompleta' | 'trecho') => {
    const e = porId.get(r.rotaId)!;
    return resultadoPendente(e.rota, pedido, motivo, codigo);
  };

  // 2) Sem provedor viário: nada é confirmado nem recusado.
  if (!opcoes.consultar) {
    return fim([...definitivos, ...fila.map((r) => pendente(r, MOTIVO_SEM_PROVEDOR, 'sem_consulta_viaria'))], 0, null, fila.length > 0);
  }
  const consultar = opcoes.consultar;

  // 3) Lote desta chamada: primeiro as ainda NÃO tentadas (a partir do cursor),
  //    depois as que falharam antes — com o que sobrar do orçamento.
  const orcamento = Math.max(1, Math.floor(opcoes.maxConsultas));
  const inicio = Math.max(0, Math.min(fila.length, Math.floor(anterior?.inicio ?? 0)));
  const naFila = new Set(fila.map((r) => r.rotaId));
  const repetirPedido = [...new Set(anterior?.repetir ?? [])].filter((id) => naFila.has(id));
  const extensas: ResultadoRotaReal[] = [];
  const lote: { r: ResultadoRotaReal; pontos: { lat: number; lng: number }[] }[] = [];
  let gasto = 0;
  const tentar = (r: ResultadoRotaReal): 'ok' | 'extensa' | 'sem_orcamento' => {
    const e = porId.get(r.rotaId)!;
    const pontos = pontosDistintos(pontosDoPedido(e.rota, pedido).pontos);
    const custo = consultasNecessarias(pontos.length);
    if (custo === 0) { extensas.push(pendente(r, MOTIVO_ROTA_EXTENSA, 'busca_incompleta')); return 'extensa'; }
    // Uma rota mais cara que o orçamento inteiro ainda é calculada quando é a primeira do lote.
    if (gasto + custo > orcamento && lote.length > 0) return 'sem_orcamento';
    gasto += custo;
    lote.push({ r, pontos });
    return 'ok';
  };
  let proximo = inicio;
  while (proximo < fila.length) {
    if (tentar(fila[proximo]) === 'sem_orcamento') break;
    proximo++;
  }
  const noLote = new Set(lote.map((x) => x.r.rotaId));
  const repetirDepois: string[] = [];
  const filaPorId = new Map(fila.map((r) => [r.rotaId, r]));
  for (const id of repetirPedido) {
    if (noLote.has(id)) continue;
    const idx = fila.findIndex((r) => r.rotaId === id);
    if (idx >= proximo) continue; // ainda será alcançada pelo cursor
    if (tentar(filaPorId.get(id)!) === 'sem_orcamento') repetirDepois.push(id);
  }

  // 4) Consulta e avaliação, rota a rota — a falha de uma não afeta as outras.
  const calculados = await Promise.all(lote.map(async ({ r, pontos }): Promise<{ res: ResultadoRotaReal; repetir: boolean }> => {
    const e = porId.get(r.rotaId)!;
    const tabelas = await consultarTabelasEmBlocos(pontos, consultar).catch(() => null);
    if (!tabelas) return { res: pendente(r, MOTIVO_FALHA_EXTERNA, 'sem_consulta_viaria'), repetir: true };
    const matriz = new MatrizPorCoordenadas();
    matriz.adicionar(pontos, tabelas.tempos, tabelas.distancias);
    const res = avaliarRotaSegura(e.rota, e.veiculo, pedido, matriz);
    // Matriz parcial: o que foi PROVADO com trechos reais vale; o que ficou sem
    // veredito por falta de trecho é avaliação incompleta (e merece nova tentativa
    // quando a causa foi um bloco que falhou).
    if (res.status === 'indeterminado' && res.pendencia === 'avaliacao_incompleta' && res.codigos.includes('trecho')) {
      return { res: { ...res, motivo: MOTIVO_MATRIZ_PARCIAL }, repetir: tabelas.blocosFalhos > 0 };
    }
    return { res, repetir: false };
  }));

  const repetir = [...calculados.filter((c) => c.repetir).map((c) => c.res.rotaId), ...repetirDepois];
  const aguardando = fila.length - proximo;
  const continuacao = aguardando > 0 || repetir.length > 0 ? { inicio: proximo, repetir } : null;
  return fim([...definitivos, ...extensas, ...calculados.map((c) => c.res)], aguardando, continuacao);
}
