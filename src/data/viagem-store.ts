import type { ParadaRota, PassageiroRota, Rota } from '@/types/motorista';
import { supabase, USE_SUPABASE, DEMO_MOTORISTA } from '@/lib/supabase';
import { novoId } from '@/data/motorista-store';

/**
 * REGISTRO DAS VIAGENS (horários reais da navegação).
 *
 * Tudo que o motorista confirma na rua — início, chegada em cada parada,
 * embarque, desembarque, falta, fim — vira uma linha com o horário do celular.
 *
 * Na rua a internet falha: cada registro entra primeiro numa FILA guardada no
 * aparelho e só sai dela quando o servidor confirma. Nada se perde se o sinal
 * cair no meio da rota; o envio é retomado no registro seguinte ou na próxima
 * vez que a navegação for aberta.
 */

const USAR_BANCO = USE_SUPABASE && !DEMO_MOTORISTA;
const K_FILA = 'vambora.viagens.fila';
const K_LOCAL = 'vambora.demo.viagens';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuidOuNulo = (v: string | null | undefined) => (v && UUID_RE.test(v) ? v : null);

export type TipoEventoViagem = 'chegada' | 'embarque' | 'desembarque' | 'falta';

export interface EventoViagem {
  tipo: TipoEventoViagem;
  parada: ParadaRota;
  aluno?: PassageiroRota;
  /** Quando aconteceu (relógio do celular). */
  em: Date;
  /** Segundos de espera desde a chegada na parada. */
  esperaSeg?: number;
  posicao?: [number, number] | null;
}

type Operacao =
  | { tabela: 'route_trips'; acao: 'insert'; linha: Record<string, unknown> }
  | { tabela: 'route_trips'; acao: 'update'; id: string; linha: Record<string, unknown> }
  | { tabela: 'route_trip_events'; acao: 'insert'; linha: Record<string, unknown> };

function ler<T>(chave: string, vazio: T): T {
  try { const bruto = localStorage.getItem(chave); return bruto ? (JSON.parse(bruto) as T) : vazio; } catch { return vazio; }
}
function gravar(chave: string, valor: unknown): void {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem espaço/indisponível */ }
}

let enviando = false;
/** Envia a fila ao servidor, na ordem. Para no primeiro erro (tenta de novo depois). */
export async function enviarPendentes(): Promise<number> {
  if (!USAR_BANCO || !supabase || enviando) return ler<Operacao[]>(K_FILA, []).length;
  enviando = true;
  try {
    for (;;) {
      const fila = ler<Operacao[]>(K_FILA, []);
      const op = fila[0];
      if (!op) return 0;
      const { error } = op.acao === 'insert'
        ? await supabase.from(op.tabela).insert(op.linha)
        : await supabase.from(op.tabela).update(op.linha).eq('id', op.id);
      // 23505 = já gravado numa tentativa anterior cuja resposta se perdeu.
      if (error && error.code !== '23505') return fila.length;
      gravar(K_FILA, ler<Operacao[]>(K_FILA, []).slice(1));
    }
  } catch {
    return ler<Operacao[]>(K_FILA, []).length;
  } finally {
    enviando = false;
  }
}

function enfileirar(op: Operacao): void {
  if (USAR_BANCO) {
    gravar(K_FILA, [...ler<Operacao[]>(K_FILA, []), op]);
    void enviarPendentes();
  } else {
    // Sem banco (demonstração): fica só no aparelho, para conferência.
    gravar(K_LOCAL, [...ler<Operacao[]>(K_LOCAL, []), op].slice(-500));
  }
}

/** Registros ainda não confirmados pelo servidor. */
export const pendentesDeEnvio = (): number => (USAR_BANCO ? ler<Operacao[]>(K_FILA, []).length : 0);

/** Abre uma viagem (toque em "Iniciar rota") e devolve o id dela. */
export function iniciarViagem(rota: Rota, em = new Date()): string {
  const id = novoId();
  enfileirar({ tabela: 'route_trips', acao: 'insert', linha: {
    id, route_id: uuidOuNulo(rota.id), route_name: rota.nome ?? '', direction: rota.sentido, started_at: em.toISOString(),
  } });
  return id;
}

export function registrarEvento(viagemId: string, e: EventoViagem): void {
  enfileirar({ tabela: 'route_trip_events', acao: 'insert', linha: {
    id: novoId(), trip_id: viagemId, type: e.tipo,
    stop_id: uuidOuNulo(e.parada.id), stop_type: e.parada.tipo, stop_order: e.parada.ordem,
    stop_label: (e.parada.tipo === 'escola' ? e.parada.destinoNome || e.parada.rotulo : e.parada.rotulo) ?? '',
    passenger_id: uuidOuNulo(e.aluno?.id), passenger_name: e.aluno?.identificacao ?? null,
    occurred_at: e.em.toISOString(),
    wait_seconds: e.esperaSeg == null ? null : Math.max(0, Math.round(e.esperaSeg)),
    lat: e.posicao?.[0] ?? null, lng: e.posicao?.[1] ?? null,
  } });
}

export function finalizarViagem(viagemId: string, em = new Date()): void {
  enfileirar({ tabela: 'route_trips', acao: 'update', id: viagemId, linha: { finished_at: em.toISOString() } });
}
