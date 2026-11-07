import { Clock, Home, School, Users, CheckCircle2, HelpCircle, Wallet } from 'lucide-react';
import { minutosParaTextoHora, cn } from '@/lib/utils';
import type { CartaoRotaRealDados } from '@/lib/busca-rotas-reais-cliente';

/**
 * Cartão de resultado de uma ROTA REAL (sem depender da vitrine `drivers`).
 * Mostra o horário estimado conforme o sentido, calculado pelo motor — sempre
 * rotulado como ESTIMATIVA, nunca como confirmado.
 */
export function CartaoRotaReal({ r }: { r: CartaoRotaRealDados }) {
  const hora = (m: number | null) => (m != null ? minutosParaTextoHora(m) : '—');
  const compat = r.status === 'compativel';
  const ida = r.sentido === 'ida';

  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-600">
          {ida ? <School className="h-3.5 w-3.5" /> : <Home className="h-3.5 w-3.5" />}
          {ida ? 'Ida (até a escola)' : 'Volta (até em casa)'}
        </span>
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
          compat ? 'bg-mint-100 text-mint-700' : 'bg-amber-100 text-amber-700')}>
          {compat ? <CheckCircle2 className="h-3.5 w-3.5" /> : <HelpCircle className="h-3.5 w-3.5" />}
          {compat ? 'Compatível (estimado)' : 'Sob confirmação'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-lg font-bold leading-tight text-navy-900">{r.rotaNome}</h3>
        {r.demo && (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">
            Demonstração
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-navy-50 p-3">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-navy-500">
            <Home className="h-3.5 w-3.5" /> {ida ? 'Passa na sua casa' : 'Deixa em casa'}
          </p>
          <p className="mt-0.5 font-display text-base font-extrabold tabular-nums text-navy-900">~{hora(r.passagemCasaMin)}</p>
        </div>
        <div className="rounded-xl bg-navy-50 p-3">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-navy-500">
            <School className="h-3.5 w-3.5" /> {ida ? 'Chega à escola' : 'Sai da escola'}
          </p>
          <p className="mt-0.5 font-display text-base font-extrabold tabular-nums text-navy-900">~{hora(r.horarioEscolaMin)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-navy-50 pt-3 text-sm text-navy-600">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-4 w-4 text-navy-400" />
          {r.vagas != null && r.vagas > 0
            ? `${r.vagas} ${r.vagas === 1 ? 'vaga' : 'vagas'}${r.vanLugares != null ? ` de ${r.vanLugares}` : ''}`
            : r.vanLugares != null ? `${r.vanLugares} lugares` : 'Van'}
        </span>
        {r.minutosABordo != null && (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-navy-400" /> ~{r.minutosABordo} min a bordo
          </span>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-navy-50 pt-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-600">
          <Wallet className="h-4 w-4 text-navy-400" /> Mensalidade por aluno
        </span>
        <span className="font-display text-base font-extrabold tabular-nums text-navy-900">
          {r.precoMensal != null
            ? `R$ ${Number(r.precoMensal).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}/mês`
            : 'A combinar'}
        </span>
      </div>

      <p className="text-xs leading-snug text-navy-400">{r.motivo}</p>
    </div>
  );
}
