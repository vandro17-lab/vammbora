import type { Rota } from '@/types/motorista';
import { novoId } from '@/data/motorista-store';

/**
 * Operações PURAS de montagem de rota usadas pelo construtor (ida e volta).
 *
 * A diferença entre ida e volta NÃO está nestas operações, e sim em QUEM as
 * chama: na ida, a casa embarca e a escola desembarca; na volta, a escola
 * embarca e a casa desembarca. Mantendo as operações puras e simétricas, o
 * mesmo modelo de dados e o mesmo motor atendem aos dois sentidos — e podem
 * ser cobertos por testes sem React.
 */

/** Embarca um aluno numa parada (casa na ida, escola na volta). */
export function embarcarAluno(rota: Rota, paradaId: string, identificacao: string): Rota {
  const nome = identificacao.trim();
  if (!paradaId || !nome) return rota;
  const parada = rota.paradas.find((p) => p.id === paradaId);
  return {
    ...rota,
    passageiros: [
      ...rota.passageiros,
      {
        id: novoId(),
        identificacao: nome,
        embarqueParadaId: paradaId,
        desembarqueParadaId: null,
        // Na volta, o aluno embarca na escola: guarda a escola de origem como destino.
        destinoId: parada?.tipo === 'escola' ? parada.destinoId ?? null : null,
        horarioHabitualMin: parada?.horarioChegadaMin ?? null,
      },
    ],
  };
}

/** Desembarca os alunos indicados numa parada (escola na ida, casa na volta). */
export function desembarcarAlunos(rota: Rota, paradaId: string, ids: string[]): Rota {
  if (!paradaId || ids.length === 0) return rota;
  const parada = rota.paradas.find((p) => p.id === paradaId);
  const alvo = new Set(ids);
  return {
    ...rota,
    passageiros: rota.passageiros.map((p) =>
      alvo.has(p.id)
        ? {
            ...p,
            desembarqueParadaId: paradaId,
            // Numa escola (ida), o desembarque também fixa o destino do aluno.
            destinoId: parada?.tipo === 'escola' ? parada.destinoId ?? p.destinoId ?? null : p.destinoId ?? null,
            // Numa casa (volta), herda o horário habitual da parada quando o aluno ainda não tem um.
            horarioHabitualMin: p.horarioHabitualMin ?? (parada?.tipo === 'casa' ? parada.horarioChegadaMin ?? null : p.horarioHabitualMin ?? null),
          }
        : p,
    ),
  };
}
