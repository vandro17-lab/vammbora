import { useState } from 'react';
import { Leaf, Clock, TrendingUp, Calculator, FileBarChart } from 'lucide-react';
import { VMShell } from '@/components/vm/VMShell';
import { Card, SubHeader, DemoChip } from '@/components/vm/ui';
import { useDadosMotorista } from '@/lib/vm/useDadosMotorista';
import { formatBRL, cn } from '@/lib/utils';

const MESES = ['Jul', 'Ago', 'Set', 'Out', 'Nov'];

/* ============================ TELA 8 — Financeiro ============================ */
export function InteligenciaPage() {
  const { dados, indicadores: ind } = useDadosMotorista();
  const [modal, setModal] = useState<null | 'mensalidade' | 'relatorio'>(null);

  // Série de receita derivada (crescimento leve até o mês atual) — estimativa.
  const serie = MESES.map((mes, i) => ({ mes, valor: Math.round(ind.receitaMesBRL * (0.92 + i * 0.02)) }));
  const max = Math.max(...serie.map((s) => s.valor), 1);

  return (
    <VMShell>
      <SubHeader titulo="Financeiro" />
      <div className="space-y-3.5 px-4 pt-4">
        {/* Seletor de mês (estático no protótipo) */}
        <Card className="flex items-center justify-between p-3.5">
          <div>
            <p className="text-[11px] text-navy-400">Mês atual</p>
            <p className="font-display font-bold text-navy-900">Novembro/2026</p>
          </div>
          <span className="vm-chip-ico vm-ico-green"><TrendingUp className="h-5 w-5" /></span>
        </Card>
        {dados.demo && <div className="flex justify-end"><DemoChip /></div>}

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <span className="vm-chip-ico vm-ico-green"><Leaf className="h-5 w-5" /></span>
            <p className="mt-2 text-xs text-navy-500">Receita estimada</p>
            <p className="font-display text-2xl font-extrabold text-navy-900">{formatBRL(ind.receitaMesBRL)}</p>
          </Card>
          <Card className="p-4">
            <span className="vm-chip-ico vm-ico-amber"><Clock className="h-5 w-5" /></span>
            <p className="mt-2 text-xs text-navy-500">Custo combustível</p>
            <p className="font-display text-2xl font-extrabold text-amber-600">{formatBRL(ind.custoCombustivelMesBRL)}</p>
          </Card>
        </div>

        <Card className="p-4">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-600"><Leaf className="h-4 w-4 vm-accent" /> Resultado estimado</p>
          <div className="flex items-end justify-between">
            <p className="font-display text-3xl font-extrabold text-navy-900">{formatBRL(ind.resultadoMesBRL)}</p>
            <span className="chip bg-mint-100 text-mint-800">{ind.resultadoPctReceita}% da receita</span>
          </div>
        </Card>

        <Card className="p-4">
          <p className="font-display font-bold text-navy-900">Evolução da receita</p>
          <div className="mt-4 flex items-end justify-between gap-2" style={{ height: 130 }}>
            {serie.map((s) => (
              <div key={s.mes} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[10px] font-semibold text-navy-500">{(s.valor / 1000).toFixed(1)}k</span>
                <div className="w-full rounded-t-lg bg-gradient-to-t from-mint-500 to-mint-300" style={{ height: `${Math.round((s.valor / max) * 90)}px` }} />
                <span className="text-[11px] text-navy-400">{s.mes}</span>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-navy-400">Projeção a partir da sua base de alunos e mensalidade.</p>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setModal('mensalidade')} className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-semibold text-navy-700 shadow-card ring-1 ring-navy-100">
            <Calculator className="h-5 w-5 vm-accent" /> Simular mensalidade
          </button>
          <button onClick={() => setModal('relatorio')} className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-semibold text-navy-700 shadow-card ring-1 ring-navy-100">
            <FileBarChart className="h-5 w-5 vm-accent" /> Relatório simplificado
          </button>
        </div>
      </div>

      {modal && <ModalFinanceiro tipo={modal} onFechar={() => setModal(null)} />}
    </VMShell>
  );
}

function ModalFinanceiro({ tipo, onFechar }: { tipo: 'mensalidade' | 'relatorio'; onFechar: () => void }) {
  const { indicadores: ind, dados } = useDadosMotorista();
  const [valor, setValor] = useState(dados.mensalidade);
  const receita = valor * ind.alunos;
  const resultado = receita - ind.custoCombustivelMesBRL;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 sm:items-center" onClick={onFechar}>
      <div className={cn('w-full max-w-md rounded-t-3xl bg-white p-6 sm:rounded-3xl')} onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-navy-100 sm:hidden" />
        {tipo === 'mensalidade' ? (
          <>
            <h2 className="font-display text-lg font-bold">Simular mensalidade</h2>
            <p className="mt-1 text-sm text-navy-500">Ajuste o valor por aluno e veja o resultado do mês (combustível real descontado).</p>
            <label className="field-label mt-4">Mensalidade por aluno (R$)</label>
            <input type="range" min={200} max={600} step={10} value={valor} onChange={(e) => setValor(Number(e.target.value))} className="w-full accent-mint-500" />
            <p className="text-center font-display text-2xl font-extrabold text-navy-900">{formatBRL(valor)}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-navy-50 p-3"><p className="text-xs text-navy-500">Receita ({ind.alunos} alunos)</p><p className="font-display text-lg font-bold text-navy-900">{formatBRL(receita)}</p></div>
              <div className="rounded-xl bg-mint-50 p-3"><p className="text-xs text-navy-500">Resultado</p><p className="font-display text-lg font-bold text-mint-700">{formatBRL(resultado)}</p></div>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-lg font-bold">Relatório simplificado</h2>
            <div className="mt-3 space-y-2 text-sm">
              {[['Alunos ativos', ind.alunos], ['Ocupação da van', `${ind.ocupacaoPct}%`], ['Distância por dia', `${Math.round(ind.distanciaDiaKm)} km`], ['Custo/dia (diesel)', formatBRL(ind.custoDiaBRL)], ['Receita do mês', formatBRL(ind.receitaMesBRL)], ['Custo combustível/mês', formatBRL(ind.custoCombustivelMesBRL)], ['Resultado do mês', formatBRL(ind.resultadoMesBRL)]].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between border-b border-navy-50 pb-1.5"><span className="text-navy-500">{k}</span><span className="font-semibold text-navy-800">{v}</span></div>
              ))}
            </div>
          </>
        )}
        <button onClick={onFechar} className="mt-5 h-12 w-full rounded-full bg-navy-900 font-semibold text-white">Fechar</button>
      </div>
    </div>
  );
}
