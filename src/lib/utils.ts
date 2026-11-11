import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Turno } from '@/types';

/** Combina classes Tailwind com resolução de conflitos. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata valor em Reais. */
export function formatBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export const TURNO_LABEL: Record<Turno, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  integral: 'Integral',
};

/** Pluraliza de forma simples: (1, "vaga", "vagas") -> "1 vaga". */
export function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Converte "HH:MM" em minutos desde a meia-noite. */
export function horaParaMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Converte minutos desde a meia-noite em texto "6h38". */
export function minutosParaTextoHora(minutos: number): string {
  const min = Math.round(minutos); // tempos de atendimento podem ter fração de minuto
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

/** Rótulo de apresentação; mantém a origem e os dados originais intactos. */
export function nomeDestinoParaExibicao(nome: string): string {
  return nome.replace(/\s*\(demonstração\)\s*$/i, '').trim();
}
