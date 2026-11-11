import type { CriteriosBusca, ModalidadeTrajeto } from '@/types';
import { listarRotas, listarVeiculos } from '@/data/motorista-store';
import { criarMatrizDemo } from '@/lib/encaixe';
import {
  buscarEmRotasReais,
  rotaElegivelParaBusca,
  type EntradaBuscaReal,
  type StatusBuscaReal,
} from '@/lib/busca-rotas-reais';
import { horaParaMinutoDoDia } from '@/lib/searchParams';

/**
 * Cliente da BUSCA REAL. Produz os dados de cartão (`CartaoRotaRealDados`) a
 * partir de duas fontes equivalentes:
 *  - PROD: a função server-side `/api/buscar-rotas` (service role, sem PII);
 *  - DEMO: as rotas do próprio navegador (localStorage), rodando o MESMO núcleo.
 * O cliente NUNCA lê rotas reais direto do banco (RLS/PII).
 */

/** Dados mínimos, SEM PII, para renderizar o cartão de uma rota real. */
export interface CartaoRotaRealDados {
  rotaId: string;
  rotaNome: string;
  /** Rota de DEMONSTRAÇÃO (§6.1): o frontend mantém a identificação visível. */
  demo?: boolean;
  /** Mensalidade por ALUNO desta van (valor fixo por aluno, não por trecho). */
  precoMensal?: number | null;
  /** Tipo de preço: 'fixo' | 'dinamico' | 'a_combinar'. */
  precoTipo?: string | null;
  vanLugares: number | null;
  /** Vagas livres para novos passageiros (capacidade − ocupação). */
  vagas: number | null;
  /** A rota já atende a escola pedida (Tier A) ou foi avaliada por proximidade (Tier B). */
  atendeEscola: boolean;
  sentido: 'ida' | 'volta';
  status: StatusBuscaReal;
  /** Ida: hora que passa na CASA (coleta). Volta: hora que deixa em CASA. */
  passagemCasaMin: number | null;
  /** Ida: chegada à ESCOLA. Volta: saída da ESCOLA. */
  horarioEscolaMin: number | null;
  minutosABordo: number | null;
  /** Tempos de trajeto estimados (sem consulta viária): nunca "compatível". */
  temposEstimados?: boolean;
  motivo: string;
}

export type EstadoBuscaReal = 'nao_configurado' | 'ok' | 'erro';

const sentidosDe = (m: ModalidadeTrajeto): ('ida' | 'volta')[] => (m === 'ambos' ? ['ida', 'volta'] : [m]);
const mostravel = (s: StatusBuscaReal) => s === 'compativel' || s === 'sob_confirmacao';

export interface RespostaBuscaReal {
  estado: EstadoBuscaReal;
  /** Só compatível / sob confirmação (nunca um falso encaixe). */
  resultados: CartaoRotaRealDados[];
  /** Rotas candidatas que NÃO puderam ser avaliadas (dado faltando, van sem
   *  cadastro, trecho sem tempo, avaliação não concluída). Não é "sem vaga". */
  inconclusivas: number;
}

/** PROD: consulta a função server-side. Só mostra compatível/sob confirmação. */
export async function buscarRotasReais(
  criterios: CriteriosBusca,
  escolaPonto?: { lat: number; lng: number } | null,
  signal?: AbortSignal,
): Promise<RespostaBuscaReal> {
  if (!Number.isFinite(criterios.origemLat) || !Number.isFinite(criterios.origemLng) || !criterios.destinoId) {
    return { estado: 'ok', resultados: [], inconclusivas: 0 };
  }
  const todos: CartaoRotaRealDados[] = [];
  let inconclusivas = 0;
  for (const sentido of sentidosDe(criterios.modalidade)) {
    try {
      const r = await fetch('/api/buscar-rotas', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origem: { lat: criterios.origemLat, lng: criterios.origemLng },
          destinoId: criterios.destinoId,
          escolaPonto: escolaPonto ?? null,
          sentido,
          turno: criterios.turno,
          contratacao: criterios.contratacao,
          // Ida: precisa chegar até; volta: sai da escola a partir de.
          horarioMin: horaParaMinutoDoDia(criterios.horario),
        }),
      });
      if (r.status === 503) return { estado: 'nao_configurado', resultados: [], inconclusivas: 0 };
      if (!r.ok) return { estado: 'erro', resultados: [], inconclusivas: 0 };
      const d = (await r.json()) as { resultados?: CartaoRotaRealDados[]; inconclusivas?: number };
      const lista = d.resultados ?? [];
      for (const x of lista) if (mostravel(x.status)) todos.push(x);
      inconclusivas += typeof d.inconclusivas === 'number' ? d.inconclusivas : lista.filter((x) => x.status === 'indeterminado').length;
    } catch {
      return { estado: 'erro', resultados: [], inconclusivas: 0 };
    }
  }
  return { estado: 'ok', resultados: todos, inconclusivas };
}

/* ===================== Modo demonstração (localStorage) =====================
 * Sem backend, as rotas reais vivem no navegador do próprio usuário. Rodamos o
 * MESMO núcleo (buscarEmRotasReais) sobre as rotas ELEGÍVEIS (concluídas),
 * provando o fluxo ponta a ponta sem infra. */
export async function buscarRotasReaisDemo(
  criterios: CriteriosBusca,
  escolaPonto?: { lat: number; lng: number } | null,
): Promise<CartaoRotaRealDados[]> {
  return (await buscarRotasReaisDemoCompleta(criterios, escolaPonto)).resultados;
}

export async function buscarRotasReaisDemoCompleta(
  criterios: CriteriosBusca,
  escolaPonto?: { lat: number; lng: number } | null,
): Promise<RespostaBuscaReal> {
  const vazio: RespostaBuscaReal = { estado: 'ok', resultados: [], inconclusivas: 0 };
  if (!Number.isFinite(criterios.origemLat) || !Number.isFinite(criterios.origemLng) || !criterios.destinoId) return vazio;
  const [rotas, veiculos] = await Promise.all([listarRotas(), listarVeiculos()]);
  const veicPorId = new Map(veiculos.map((v) => [v.id, v]));
  const rotaPorId = new Map(rotas.map((r) => [r.id, r]));
  const entradas: EntradaBuscaReal[] = rotas
    .filter((r) => rotaElegivelParaBusca(r))
    .map((r) => ({ rota: r, veiculo: r.veiculoId ? veicPorId.get(r.veiculoId) ?? null : null }));
  if (entradas.length === 0) return vazio;

  const out: CartaoRotaRealDados[] = [];
  let inconclusivas = 0;
  for (const sentido of sentidosDe(criterios.modalidade)) {
    const { resultados, inconclusivas: n } = buscarEmRotasReais(entradas, {
      origem: { lat: criterios.origemLat!, lng: criterios.origemLng! },
      destinoId: criterios.destinoId,
      escolaPonto: escolaPonto ?? null,
      sentido,
      turno: criterios.turno,
      contratacao: criterios.contratacao,
      horarioFamiliaMin: horaParaMinutoDoDia(criterios.horario),
    // Demonstração local: tempos ESTIMADOS — o núcleo limita a "sob confirmação".
    }, criarMatrizDemo());
    inconclusivas += n;
    for (const r of resultados) {
      if (!mostravel(r.status)) continue; // nunca mostrar falso encaixe
      const rota = rotaPorId.get(r.rotaId);
      const van = rota?.veiculoId ? veicPorId.get(rota.veiculoId) : undefined;
      out.push({
        rotaId: r.rotaId,
        rotaNome: rota?.nome || 'Rota',
        vanLugares: van?.lugaresPassageiro ?? null,
        vagas: r.vagas,
        atendeEscola: r.atendeEscola,
        sentido: r.sentido,
        status: r.status,
        passagemCasaMin: r.passagemCasaMin,
        horarioEscolaMin: r.horarioEscolaMin,
        minutosABordo: r.minutosABordo,
        temposEstimados: r.temposEstimados,
        motivo: r.motivo,
      });
    }
  }
  return { estado: 'ok', resultados: out, inconclusivas };
}
