import type { CriteriosBusca, ModalidadeTrajeto } from '@/types';
import { listarRotas, listarVeiculos } from '@/data/motorista-store';
import {
  buscarEmRotasReais,
  rotaElegivelParaBusca,
  type EntradaBuscaReal,
  type StatusBuscaReal,
} from '@/lib/busca-rotas-reais';

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
  motivo: string;
}

export type EstadoBuscaReal = 'nao_configurado' | 'ok' | 'erro';

const sentidosDe = (m: ModalidadeTrajeto): ('ida' | 'volta')[] => (m === 'ambos' ? ['ida', 'volta'] : [m]);
const mostravel = (s: StatusBuscaReal) => s === 'compativel' || s === 'sob_confirmacao';

/** PROD: consulta a função server-side. Só mostra compatível/sob confirmação. */
export async function buscarRotasReais(
  criterios: CriteriosBusca,
  escolaPonto?: { lat: number; lng: number } | null,
): Promise<{ estado: EstadoBuscaReal; resultados: CartaoRotaRealDados[] }> {
  if (!Number.isFinite(criterios.origemLat) || !Number.isFinite(criterios.origemLng) || !criterios.destinoId) {
    return { estado: 'ok', resultados: [] };
  }
  const todos: CartaoRotaRealDados[] = [];
  for (const sentido of sentidosDe(criterios.modalidade)) {
    try {
      const r = await fetch('/api/buscar-rotas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origem: { lat: criterios.origemLat, lng: criterios.origemLng },
          destinoId: criterios.destinoId,
          escolaPonto: escolaPonto ?? null,
          sentido,
          turno: criterios.turno,
          contratacao: criterios.contratacao,
          horarioMaxChegadaMin: criterios.horarioMaxChegadaMin ?? null,
        }),
      });
      if (r.status === 503) return { estado: 'nao_configurado', resultados: [] };
      if (!r.ok) return { estado: 'erro', resultados: [] };
      const d = (await r.json()) as { resultados?: CartaoRotaRealDados[] };
      for (const x of d.resultados ?? []) if (mostravel(x.status)) todos.push(x);
    } catch {
      return { estado: 'erro', resultados: [] };
    }
  }
  return { estado: 'ok', resultados: todos };
}

/* ===================== Modo demonstração (localStorage) =====================
 * Sem backend, as rotas reais vivem no navegador do próprio usuário. Rodamos o
 * MESMO núcleo (buscarEmRotasReais) sobre as rotas ELEGÍVEIS (concluídas e
 * PUBLICADAS), provando o fluxo ponta a ponta sem infra. */
export async function buscarRotasReaisDemo(
  criterios: CriteriosBusca,
  escolaPonto?: { lat: number; lng: number } | null,
): Promise<CartaoRotaRealDados[]> {
  if (!Number.isFinite(criterios.origemLat) || !Number.isFinite(criterios.origemLng) || !criterios.destinoId) return [];
  const [rotas, veiculos] = await Promise.all([listarRotas(), listarVeiculos()]);
  const veicPorId = new Map(veiculos.map((v) => [v.id, v]));
  const rotaPorId = new Map(rotas.map((r) => [r.id, r]));
  const entradas: EntradaBuscaReal[] = rotas
    .filter((r) => rotaElegivelParaBusca(r))
    .map((r) => ({ rota: r, veiculo: r.veiculoId ? veicPorId.get(r.veiculoId) ?? null : null }));
  if (entradas.length === 0) return [];

  const out: CartaoRotaRealDados[] = [];
  for (const sentido of sentidosDe(criterios.modalidade)) {
    const { resultados } = buscarEmRotasReais(entradas, {
      origem: { lat: criterios.origemLat!, lng: criterios.origemLng! },
      destinoId: criterios.destinoId,
      escolaPonto: escolaPonto ?? null,
      sentido,
      turno: criterios.turno,
      contratacao: criterios.contratacao,
      horarioMaxChegadaMin: criterios.horarioMaxChegadaMin ?? null,
    });
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
        motivo: r.motivo,
      });
    }
  }
  return out;
}
