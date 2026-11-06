import { useState } from 'react';
import {
  ChartLineUp, CalendarBlank, Leaf, GasPump, Coins, ChartBar, Target, TrendUp, CaretRight, CaretDown,
} from '@phosphor-icons/react';
import { VMShell } from '@/components/vm/VMShell';
import { VMSectionHeader } from '@/components/vm/VMHeader';
import { Card } from '@/components/vm/ui';
import { useDadosMotorista } from '@/lib/vm/useDadosMotorista';
import { formatBRL, cn } from '@/lib/utils';

const MESES = ['Jul', 'Ago', 'Set', 'Out', 'Nov'];

/* ===================== TELA 8 — Inteligência (Financeiro) ===================== */
export function InteligenciaPage() {
  const { indicadores: ind } = useDadosMotorista();
  const [modal, setModal] = useState<null | 'mensalidade' | 'relatorio'>(null);

  // Série de receita derivada (crescimento leve até o mês atual) — PROJEÇÃO, não histórico.
  const serie = MESES.map((mes, i) => ({ mes, valor: Math.round(ind.receitaMesBRL * (0.92 + i * 0.02)) }));
  const max = Math.max(...serie.map((s) => s.valor), 1);

  return (
    <VMShell>
      <VMSectionHeader
        icon={ChartLineUp}
        titulo="Inteligência"
        subtitulo="Análises e projeções para otimizar sua operação escolar."
      />

      <div className="space-y-3 px-4 pt-4">
        {/* Seletor de mês */}
        <Card className="flex items-center justify-between p-3.5">
          <div className="flex items-center gap-3">
            <span className="vm-chip-ico vm-ico-teal"><CalendarBlank size={20} weight="duotone" /></span>
            <div>
              <p className="text-[11px] text-navy-400">Mês atual</p>
              <p className="font-display font-bold text-navy-900">Novembro/2026</p>
            </div>
          </div>
          <CaretDown size={18} weight="bold" className="text-navy-300" />
        </Card>

        {/* Receita + Custo */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <span className="vm-chip-ico vm-ico-green"><Leaf size={20} weight="duotone" /></span>
            <p className="mt-2 text-xs text-navy-500">Receita estimada</p>
            <p className="font-display text-2xl font-extrabold tabular-nums text-navy-900">{formatBRL(ind.receitaMesBRL)}</p>
          </Card>
          <Card className="p-4">
            <span className="vm-chip-ico vm-ico-amber"><GasPump size={20} weight="duotone" /></span>
            <p className="mt-2 text-xs text-navy-500">Custo combustível</p>
            <p className="font-display text-2xl font-extrabold tabular-nums text-amber-600">{formatBRL(ind.custoCombustivelMesBRL)}</p>
          </Card>
        </div>

        {/* Resultado estimado + % da receita */}
        <Card className="flex items-center gap-3 p-4">
          <span className="vm-chip-ico vm-ico-amber"><Coins size={20} weight="duotone" /></span>
          <div className="flex-1">
            <p className="text-xs text-navy-500">Resultado estimado</p>
            <p className="font-display text-2xl font-extrabold tabular-nums text-navy-900">{formatBRL(ind.resultadoMesBRL)}</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-mint-100 px-3 py-1.5 text-xs font-bold text-mint-700">
            <TrendUp size={14} weight="bold" /> {ind.resultadoPctReceita}% da receita
          </span>
        </Card>

        {/* Evolução da receita (projeção) */}
        <Card className="p-4">
          <p className="inline-flex items-center gap-2 font-display font-bold text-navy-900">
            <ChartBar size={20} weight="duotone" className="text-mint-600" /> Evolução da receita
          </p>
          <div className="mt-4 flex items-end justify-between gap-2.5" style={{ height: 136 }}>
            {serie.map((s, i) => (
              <div key={s.mes} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[10px] font-semibold tabular-nums text-navy-500">R$ {(s.valor / 1000).toFixed(1).replace('.', ',')}k</span>
                <div
                  className={cn('w-full rounded-lg bg-gradient-to-t from-mint-500 to-mint-300', i === serie.length - 1 && 'from-mint-600 to-mint-400')}
                  style={{ height: `${Math.round((s.valor / max) * 92)}px` }}
                />
                <span className="text-[11px] text-navy-400">{s.mes}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-navy-400">Projeção a partir da sua base de alunos e mensalidade (não é histórico registrado).</p>
        </Card>

        {/* Insight da semana */}
        <button onClick={() => setModal('relatorio')} className="w-full text-left">
          <Card className="vm-press flex items-center gap-3 p-4">
            <span className="vm-chip-ico vm-ico-green"><Target size={20} weight="duotone" /></span>
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center rounded-full bg-mint-100 px-2.5 py-0.5 text-[11px] font-bold text-mint-700">Insight da semana</span>
              <p className="mt-1 text-sm leading-snug text-navy-600">
                Sua ocupação está em <strong className="text-navy-900">{ind.ocupacaoPct}%</strong>. Há potencial para aumentar a receita em novas rotas.
              </p>
            </div>
            <CaretRight size={18} weight="bold" className="shrink-0 text-navy-300" />
          </Card>
        </button>

        {/* Simulador de mensalidade (recurso real, abaixo do destaque) */}
        <button onClick={() => setModal('mensalidade')}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-semibold text-navy-700 shadow-card ring-1 ring-navy-100 active:scale-[0.99]">
          <Coins size={18} weight="duotone" className="text-mint-600" /> Simular mensalidade por aluno
        </button>
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
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-navy-100 sm:hidden" />
        {tipo === 'mensalidade' ? (
          <>
            <h2 className="font-display text-lg font-bold">Simular mensalidade</h2>
            <p className="mt-1 text-sm text-navy-500">Ajuste o valor por aluno e veja o resultado do mês (combustível real descontado).</p>
            <label className="field-label mt-4">Mensalidade por aluno (R$)</label>
            <input type="range" min={200} max={600} step={10} value={valor} onChange={(e) => setValor(Number(e.target.value))} className="w-full accent-mint-500" />
            <p className="text-center font-display text-2xl font-extrabold tabular-nums text-navy-900">{formatBRL(valor)}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-navy-50 p-3"><p className="text-xs text-navy-500">Receita ({ind.alunos} alunos)</p><p className="font-display text-lg font-bold tabular-nums text-navy-900">{formatBRL(receita)}</p></div>
              <div className="rounded-xl bg-mint-50 p-3"><p className="text-xs text-navy-500">Resultado</p><p className="font-display text-lg font-bold tabular-nums text-mint-700">{formatBRL(resultado)}</p></div>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-lg font-bold">Relatório simplificado</h2>
            <div className="mt-3 space-y-2 text-sm">
              {[['Alunos ativos', ind.alunos], ['Ocupação da van', `${ind.ocupacaoPct}%`], ['Distância por dia', `${Math.round(ind.distanciaDiaKm)} km`], ['Custo/dia (diesel)', formatBRL(ind.custoDiaBRL)], ['Receita do mês', formatBRL(ind.receitaMesBRL)], ['Custo combustível/mês', formatBRL(ind.custoCombustivelMesBRL)], ['Resultado do mês', formatBRL(ind.resultadoMesBRL)]].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between border-b border-navy-50 pb-1.5"><span className="text-navy-500">{k}</span><span className="font-semibold tabular-nums text-navy-800">{v}</span></div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-navy-400">Indicadores calculados pelos motores reais sobre a sua rota; receita/combustível projetados pela sua base e preço informado.</p>
          </>
        )}
        <button onClick={onFechar} className="mt-5 h-12 w-full rounded-full bg-navy-900 font-semibold text-white">Fechar</button>
      </div>
    </div>
  );
}
