import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Sparkles, MapPin, CheckCircle2, AlertTriangle, ChevronRight, Zap, Users } from 'lucide-react';
import { Avatar } from '@/components/brand/Avatar';
import { VMShell } from '@/components/vm/VMShell';
import { Card, SubHeader, DemoChip, EstadoVazio, AvisoErro } from '@/components/vm/ui';
import { SlotIlustracao } from '@/components/vm/SlotImagem';
import { useDadosMotorista } from '@/lib/vm/useDadosMotorista';
import { OPORTUNIDADES_VM, simularEncaixe, DIAS_UTEIS_MES } from '@/lib/vm/encaixe';
import { formatBRL, cn } from '@/lib/utils';

/** Exemplos ilustrativos — exibidos SÓ no modo demonstração explícito. */
const NOVAS_REGIAO_DEMO = [
  { regiao: 'Jd. Sumaré', escola: 'Colégio Paineiras', turno: 'Manhã' },
  { regiao: 'Pozzobon', escola: 'Instituto São João', turno: 'Tarde' },
  { regiao: 'Umuarama', escola: 'Colégio Paineiras', turno: 'Manhã' },
  { regiao: 'Jardim Brasil', escola: 'Instituto São João', turno: 'Tarde' },
  { regiao: 'Icaray', escola: 'Colégio Paineiras', turno: 'Manhã' },
  { regiao: 'Conceição', escola: 'Instituto São João', turno: 'Tarde' },
  { regiao: 'Jussara', escola: 'Colégio Paineiras', turno: 'Manhã' },
  { regiao: 'São Joaquim', escola: 'Instituto São João', turno: 'Tarde' },
];

/* =========================== TELA 6 — Oportunidades =========================== */
export function OportunidadesPage() {
  const { dados, erro, recarregar } = useDadosMotorista();
  const [aba, setAba] = useState<'compat' | 'regiao'>('compat');

  // Oportunidades e regiões de exemplo existem apenas no cenário demonstrativo.
  // No fluxo real ainda não há pedidos de famílias persistidos: estado vazio.
  const NOVAS_REGIAO = dados.demo ? NOVAS_REGIAO_DEMO : [];
  const compativeis = useMemo(() => (dados.demo ? OPORTUNIDADES_VM : [])
    .map((op) => ({ op, r: simularEncaixe(dados, op) }))
    .filter((x) => x.r.cabe)
    .sort((a, b) => b.r.compatibilidadePct - a.r.compatibilidadePct), [dados]);

  return (
    <VMShell>
      <SubHeader titulo="Oportunidades" />
      <div className="px-4 pt-4">
        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          <button onClick={() => setAba('compat')} className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-2', aba === 'compat' ? 'bg-mint-500 text-white' : 'bg-navy-100 text-navy-500')}><Zap className="h-4 w-4" /> Compatíveis ({compativeis.length})</button>
          <button onClick={() => setAba('regiao')} className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-2', aba === 'regiao' ? 'bg-mint-500 text-white' : 'bg-navy-100 text-navy-500')}><Sparkles className="h-4 w-4" /> Novas da região ({NOVAS_REGIAO.length})</button>
        </div>
        {dados.demo && <div className="mt-3 flex justify-end"><DemoChip /></div>}

        {erro && <AvisoErro mensagem={erro} onTentar={recarregar} className="mt-3" />}

        {aba === 'compat' ? (
          <div className="mt-3 space-y-3">
            {compativeis.length === 0 && (
              <EstadoVazio
                icon={Zap}
                ilustracao={<SlotIlustracao slot="oportunidades.vazio" alt="" fallback={<Zap className="h-8 w-8" />} />}
                titulo="Nenhuma oportunidade compatível"
                texto="Quando houver famílias que encaixam na sua rota sem atrasar os outros alunos, elas aparecem aqui. Veja também as novas da região."
              />
            )}
            {compativeis.map(({ op, r }) => (
              <Link key={op.id} to={`/app/oportunidades/${op.id}`} className="block">
                <Card className="vm-press flex items-center gap-3 p-3.5">
                  <Avatar nome={op.regiao} className="h-11 w-11 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-navy-900">{op.regiao} → {op.escola}</p>
                    <p className="text-xs text-navy-500">{op.alunos} aluno{op.alunos > 1 ? 's' : ''} · {op.turno}</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-mint-700"><CheckCircle2 className="h-3.5 w-3.5" /> {r.compatibilidadePct}% de compatibilidade</p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-navy-300" />
                </Card>
              </Link>
            ))}
            {compativeis.length > 0 && (
              <p className="pt-1 text-center text-[11px] text-navy-400">Compatibilidade calculada pelo motor de encaixe, sobre a sua rota. Sem dados pessoais das famílias.</p>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-2.5">
            {NOVAS_REGIAO.length === 0 && (
              <EstadoVazio icon={MapPin} titulo="Nenhum pedido novo na região" texto="Quando famílias da sua região procurarem transporte, os pedidos aparecem aqui." />
            )}
            {NOVAS_REGIAO.map((n, i) => (
              <Card key={i} className="flex items-center gap-3 p-3.5">
                <span className="vm-chip-ico vm-ico-purple"><MapPin className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy-900">{n.regiao} → {n.escola}</p>
                  <p className="text-xs text-navy-500">{n.turno}</p>
                </div>
                <span className="chip bg-navy-50 text-navy-500">avaliar</span>
              </Card>
            ))}
          </div>
        )}
      </div>
    </VMShell>
  );
}

/* ========================== TELA 7 — Simular Encaixe ========================== */
export function SimularEncaixePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { dados } = useDadosMotorista();
  const [aceito, setAceito] = useState(false);
  const op = OPORTUNIDADES_VM.find((o) => o.id === id) ?? OPORTUNIDADES_VM[0];
  const r = useMemo(() => simularEncaixe(dados, op), [dados, op]);
  const c = r.comparativo;

  // A simulação usa uma oportunidade de EXEMPLO: só existe no modo demonstração.
  if (!dados.demo) {
    return (
      <VMShell nav={false}>
        <SubHeader titulo="Simular encaixe" onVoltar={() => navigate('/app/oportunidades')} />
        <p className="p-6 text-center text-navy-500">Oportunidade não encontrada.</p>
      </VMShell>
    );
  }

  const linhas = [
    { label: 'Alunos', antes: c.alunosAntes, depois: c.alunosDepois },
    { label: 'Ocupação', antes: `${c.ocupAntesPct}%`, depois: `${c.ocupDepoisPct}%` },
    { label: 'Distância diária', antes: `${c.kmDiaAntes.toFixed(1).replace('.', ',')} km`, depois: `${c.kmDiaDepois.toFixed(1).replace('.', ',')} km` },
    { label: 'Diesel por dia', antes: `${c.dieselDiaAntes.toFixed(1).replace('.', ',')} L`, depois: `${c.dieselDiaDepois.toFixed(1).replace('.', ',')} L` },
    { label: 'Custo por dia', antes: formatBRL(c.custoDiaAntes), depois: formatBRL(c.custoDiaDepois) },
  ];

  return (
    <VMShell nav={false}>
      <SubHeader titulo="Simular encaixe" onVoltar={() => navigate('/app/oportunidades')} />
      <div className="space-y-3.5 px-4 pt-4">
        <Card className="flex items-center gap-3 p-4">
          <Avatar nome={op.regiao} className="h-11 w-11 text-sm" />
          <div>
            <p className="font-bold text-navy-900">{op.regiao} → {op.escola}</p>
            <p className="text-xs text-navy-500">{op.alunos} aluno{op.alunos > 1 ? 's' : ''} · {op.turno}</p>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <p className="px-4 pt-4 font-display font-bold text-navy-900">Comparativo da rota</p>
          <div className="mt-2 grid grid-cols-[1fr_auto_auto] items-center">
            <div className="px-4 py-2" />
            <div className="px-3 py-2 text-center text-[11px] font-semibold text-navy-500">Rota atual</div>
            <div className="rounded-t-lg bg-mint-50 px-3 py-2 text-center text-[11px] font-semibold text-mint-700">Com novo aluno</div>
            {linhas.map((l) => (
              <div key={l.label} className="contents">
                <div className="border-t border-navy-50 px-4 py-2.5 text-sm text-navy-600">{l.label}</div>
                <div className="border-t border-navy-50 px-3 py-2.5 text-center text-sm font-semibold text-navy-700">{l.antes}</div>
                <div className="border-t border-navy-50 bg-mint-50/60 px-3 py-2.5 text-center text-sm font-bold text-navy-900">{l.depois}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className={cn('p-4', r.cabe ? 'ring-mint-200' : 'ring-amber-200')}>
          <div className="flex items-start gap-3">
            <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white', r.cabe ? 'bg-mint-500' : 'bg-amber-500')}>
              {r.cabe ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </span>
            <div>
              <p className="font-display font-bold text-navy-900">Análise da oportunidade</p>
              <p className="mt-0.5 text-sm text-navy-600">
                {r.cabe
                  ? `O novo aluno acrescenta cerca de ${formatBRL(c.custoExtraDia)} por dia em combustível e mantém os horários da escola.`
                  : 'Esse aluno não cabe sem atrasar os outros além da tolerância ou passar do horário da escola.'}
              </p>
            </div>
          </div>
        </Card>

        {r.cabe && (
          <button onClick={() => setAceito(true)} disabled={aceito}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-mint-500 text-base font-bold text-white shadow-float transition active:scale-[0.98] disabled:opacity-70">
            {aceito ? 'Oportunidade marcada ✓' : 'Aceitar oportunidade'}
          </button>
        )}
        {aceito && (
          <p className="text-center text-xs text-navy-500">
            A simulação <strong>não altera</strong> sua rota. Para incluir de verdade, abra o{' '}
            <Link to="/painel/rotas" className="font-semibold text-mint-700 underline">construtor de rotas</Link> e confirme.
          </p>
        )}
        <p className="pb-2 text-center text-[11px] text-navy-400"><Users className="mr-1 inline h-3 w-3" />Cálculo do motor real sobre a sua rota · receita extra estimada {formatBRL(c.receitaExtraMes)}/mês ({DIAS_UTEIS_MES} dias úteis).</p>
      </div>
    </VMShell>
  );
}
