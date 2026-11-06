import type { CriteriosBusca, ResultadoCompatibilidade, Motorista, ModalidadeTrajeto } from '@/types';
import { minutosParaTextoHora } from '@/lib/utils';
import { listarRotas, listarVeiculos } from '@/data/motorista-store';
import {
  buscarEmRotasReais,
  rotaElegivelParaBusca,
  type EntradaBuscaReal,
  type ResultadoRotaReal,
} from '@/lib/busca-rotas-reais';

/**
 * Cliente da BUSCA REAL: chama a função server-side `/api/buscar-rotas` (que roda
 * o motor sobre rotas reais, com service role, e devolve SEM PII) e mapeia os
 * resultados para os cartões existentes da vitrine. Nunca lê rotas direto do
 * cliente (RLS/PII) — só consome o resultado já avaliado no servidor.
 */

interface ResultadoPublicoAPI {
  rotaId: string;
  driverSlug: string | null;
  sentido: 'ida' | 'volta';
  status: 'compativel' | 'sob_confirmacao' | 'indeterminado' | 'incompativel';
  passagemCasaMin: number | null;
  horarioEscolaMin: number | null;
  minutosABordo: number | null;
  fonteHorario: 'rota' | 'turno' | 'nenhuma';
  motivo: string;
}

export type EstadoBuscaReal = 'nao_configurado' | 'ok' | 'erro';

const sentidosDe = (m: ModalidadeTrajeto): ('ida' | 'volta')[] => (m === 'ambos' ? ['ida', 'volta'] : [m]);

export async function buscarRotasReais(
  criterios: CriteriosBusca,
): Promise<{ estado: EstadoBuscaReal; resultados: ResultadoPublicoAPI[] }> {
  // Sem origem CONFIRMADA ou destino, não há como classificar compatibilidade (§6.1).
  if (!Number.isFinite(criterios.origemLat) || !Number.isFinite(criterios.origemLng) || !criterios.destinoId) {
    return { estado: 'ok', resultados: [] };
  }
  const todos: ResultadoPublicoAPI[] = [];
  for (const sentido of sentidosDe(criterios.modalidade)) {
    try {
      const r = await fetch('/api/buscar-rotas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origem: { lat: criterios.origemLat, lng: criterios.origemLng },
          destinoId: criterios.destinoId,
          sentido,
          turno: criterios.turno,
          contratacao: criterios.contratacao,
        }),
      });
      if (r.status === 503) return { estado: 'nao_configurado', resultados: [] };
      if (!r.ok) return { estado: 'erro', resultados: [] };
      const d = (await r.json()) as { resultados?: ResultadoPublicoAPI[] };
      for (const x of d.resultados ?? []) todos.push(x);
    } catch {
      return { estado: 'erro', resultados: [] };
    }
  }
  return { estado: 'ok', resultados: todos };
}

/* ===================== Modo demonstração (localStorage) =====================
 * Sem backend, as rotas reais vivem no navegador do próprio usuário. Aqui a
 * família é anônima mas é o MESMO navegador, então podemos ler as rotas e rodar
 * o MESMO núcleo (buscarEmRotasReais) — provando o fluxo ponta a ponta sem infra.
 * O cartão é montado a partir da PRÓPRIA rota (nome + van), sem vitrine `drivers`. */
export interface ResultadoRotaRealEnriquecido extends ResultadoRotaReal {
  rotaNome: string;
  vanLugares: number | null;
}

export async function buscarRotasReaisDemo(criterios: CriteriosBusca): Promise<ResultadoRotaRealEnriquecido[]> {
  if (!Number.isFinite(criterios.origemLat) || !Number.isFinite(criterios.origemLng) || !criterios.destinoId) return [];
  const [rotas, veiculos] = await Promise.all([listarRotas(), listarVeiculos()]);
  const veicPorId = new Map(veiculos.map((v) => [v.id, v]));
  const rotaPorId = new Map(rotas.map((r) => [r.id, r]));
  const entradas: EntradaBuscaReal[] = rotas
    .filter((r) => rotaElegivelParaBusca(r))
    .map((r) => ({ rota: r, veiculo: r.veiculoId ? veicPorId.get(r.veiculoId) ?? null : null }));
  if (entradas.length === 0) return [];

  const sentidos: ('ida' | 'volta')[] = criterios.modalidade === 'ambos' ? ['ida', 'volta'] : [criterios.modalidade];
  const out: ResultadoRotaRealEnriquecido[] = [];
  for (const sentido of sentidos) {
    const { resultados } = buscarEmRotasReais(entradas, {
      origem: { lat: criterios.origemLat!, lng: criterios.origemLng! },
      destinoId: criterios.destinoId,
      sentido,
      turno: criterios.turno,
      contratacao: criterios.contratacao,
    });
    for (const r of resultados) {
      if (r.status !== 'compativel' && r.status !== 'sob_confirmacao') continue; // nunca mostrar falso encaixe
      const rota = rotaPorId.get(r.rotaId);
      const van = rota?.veiculoId ? veicPorId.get(rota.veiculoId) : undefined;
      out.push({ ...r, rotaNome: rota?.nome || 'Rota', vanLugares: van?.lugaresPassageiro ?? null });
    }
  }
  return out;
}

function nivelDe(s: ResultadoPublicoAPI['status']): ResultadoCompatibilidade['nivel'] {
  return s === 'compativel' ? 'disponivel' : s === 'sob_confirmacao' ? 'sob_consulta' : 'indisponivel';
}

/** Converte resultados reais nos cartões da vitrine, escondendo incompatíveis/indeterminados. */
export function mapearParaCartoes(
  resultados: ResultadoPublicoAPI[],
  motoristasPorSlug: Record<string, Motorista>,
): ResultadoCompatibilidade[] {
  const cartoes: ResultadoCompatibilidade[] = [];
  for (const r of resultados) {
    if (r.status !== 'compativel' && r.status !== 'sob_confirmacao') continue; // nunca mostrar falso encaixe
    const motorista = r.driverSlug ? motoristasPorSlug[r.driverSlug] : undefined;
    if (!motorista) continue; // sem anúncio público correspondente
    cartoes.push({
      motorista,
      nivel: nivelDe(r.status),
      resumo: r.motivo,
      passagemAproximada: r.passagemCasaMin != null ? minutosParaTextoHora(r.passagemCasaMin) : undefined,
      chegadaEscola: r.horarioEscolaMin != null ? minutosParaTextoHora(r.horarioEscolaMin) : undefined,
      tempoABordoMin: r.minutosABordo ?? undefined,
      fonteHorario: 'motor',
    });
  }
  return cartoes;
}
