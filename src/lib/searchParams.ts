import type { Contratacao, CriteriosBusca, ModalidadeTrajeto, Turno } from '@/types';
import { CIDADE_PADRAO } from '@/data/cidades';

const TURNOS_VALIDOS: Turno[] = ['manha', 'tarde', 'noite', 'integral'];
const MODALIDADES_VALIDAS: ModalidadeTrajeto[] = ['ida', 'volta', 'ambos'];
const HORA_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** "07:30" -> 450 (minuto do dia); inválido -> null. */
export function horaParaMinutoDoDia(hora: string | null | undefined): number | null {
  if (!hora || !HORA_RE.test(hora)) return null;
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/** Serializa os critérios na URL (busca compartilhável e recarregável). */
export function criteriosParaParams(c: CriteriosBusca): string {
  const p = new URLSearchParams();
  p.set('cidade', c.cidadeId);
  if (c.endereco) p.set('endereco', c.endereco);
  if (c.destinoId) p.set('destino', c.destinoId);
  if (c.turno) p.set('turno', c.turno);
  p.set('contratacao', c.contratacao);
  if (c.dataAvulso) p.set('data', c.dataAvulso);
  p.set('modalidade', c.modalidade);
  if (Number.isFinite(c.origemLat) && Number.isFinite(c.origemLng)) {
    p.set('olat', String(c.origemLat));
    p.set('olng', String(c.origemLng));
  }
  if (c.horario && HORA_RE.test(c.horario)) p.set('horario', c.horario);
  return p.toString();
}

/** Reconstrói critérios a partir da URL, com valores padrão seguros. */
export function paramsParaCriterios(sp: URLSearchParams): CriteriosBusca {
  const turno = sp.get('turno');
  const modalidade = sp.get('modalidade');
  const contratacao = sp.get('contratacao');

  return {
    cidadeId: sp.get('cidade') || CIDADE_PADRAO.id,
    endereco: sp.get('endereco') ?? '',
    destinoId: sp.get('destino') || null,
    turno: turno && (TURNOS_VALIDOS as string[]).includes(turno) ? (turno as Turno) : null,
    contratacao: (contratacao === 'avulso' ? 'avulso' : 'mensal') as Contratacao,
    dataAvulso: sp.get('data') ?? undefined,
    modalidade:
      modalidade && (MODALIDADES_VALIDAS as string[]).includes(modalidade)
        ? (modalidade as ModalidadeTrajeto)
        : 'ida',
    origemLat: numeroOuUndef(sp.get('olat')),
    origemLng: numeroOuUndef(sp.get('olng')),
    horario: HORA_RE.test(sp.get('horario') ?? '') ? (sp.get('horario') as string) : undefined,
  };
}

function numeroOuUndef(v: string | null): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
