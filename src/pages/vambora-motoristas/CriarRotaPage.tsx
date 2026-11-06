import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check, Bus, Snowflake, ShieldCheck, Accessibility, CheckCircle2, ArrowRight, Loader2, Plus,
} from 'lucide-react';
import { VMShell } from '@/components/vm/VMShell';
import { SubHeader, Card } from '@/components/vm/ui';
import { VanEscolar } from '@/components/vm/VanEscolar';
import { SlotIlustracao } from '@/components/vm/SlotImagem';
import { listarVeiculos } from '@/data/motorista-store';
import { useDadosMotorista } from '@/lib/vm/useDadosMotorista';
import { VEICULO_CENARIO } from '@/lib/vm/cenario';
import type { Veiculo } from '@/types/motorista';
import { cn } from '@/lib/utils';

const PASSOS = ['Van', 'Paradas', 'Confirmação'];

/* ===================== TELA 3 — Criar rota (passo 1: Van) =====================
   Fluxo guiado premium. Este passo aplica a REGRA de van já cadastrada (Bloco C):
   usa os veículos vinculados ao motorista; no cenário demo, oferece a Sprinter
   pré-configurada (Bloco D) sem gravar em conta real. Paradas e Confirmação são
   conduzidas pelo CONSTRUTOR REAL (geocodificação, motor de ocupação, horários e
   persistência), reaproveitado via handoff — sem criar um segundo motor. */
export function CriarRotaPage() {
  const navigate = useNavigate();
  const { dados } = useDadosMotorista();
  const [veiculos, setVeiculos] = useState<Veiculo[] | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const reais = await listarVeiculos().catch(() => [] as Veiculo[]);
      // Sem veículos reais, no cenário demo oferece a van demonstrativa (isolada).
      const lista = reais.length > 0 ? reais : (dados.demo ? [VEICULO_CENARIO] : []);
      if (!vivo) return;
      setVeiculos(lista);
      setSelId(lista[0]?.id ?? null);
    })();
    return () => { vivo = false; };
  }, [dados.demo]);

  function continuar() {
    const van = veiculos?.find((v) => v.id === selId);
    if (!van) return;
    setIndo(true);
    // Handoff para o construtor real, levando a van escolhida (sem persistir nada
    // aqui). O construtor reaproveita o motor de rotas/ocupação e a geocodificação.
    navigate('/painel/rota/nova', { state: { veiculo: van } });
  }

  const semVan = veiculos !== null && veiculos.length === 0;

  return (
    <VMShell nav={false}>
      <SubHeader titulo="Criar rota" onVoltar={() => navigate('/app/rotas')} />
      <div className="px-4 pb-10 pt-4">
        <Stepper atual={0} />

        {veiculos === null ? (
          <div className="flex justify-center py-16 text-navy-300"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : semVan ? (
          <SemVan onCadastrar={() => navigate('/app/van/cadastro')} />
        ) : (
          <SelecionarVan
            veiculos={veiculos!}
            selId={selId}
            onSel={setSelId}
            onCadastrarOutra={() => navigate('/app/van/cadastro')}
            onContinuar={continuar}
            indo={indo}
          />
        )}
      </div>
    </VMShell>
  );
}

/* --------------------------------- Stepper --------------------------------- */
function Stepper({ atual }: { atual: number }) {
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      {PASSOS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <span className={cn('grid h-9 w-9 place-items-center rounded-full text-sm font-bold transition',
              i <= atual ? 'bg-mint-500 text-white' : 'bg-navy-100 text-navy-400')}>
              {i < atual ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={cn('mt-1 text-[10px] font-medium', i <= atual ? 'text-navy-700' : 'text-navy-400')}>{label}</span>
          </div>
          {i < PASSOS.length - 1 && <span className={cn('mb-4 h-0.5 w-8 rounded', i < atual ? 'bg-mint-500' : 'bg-navy-100')} />}
        </div>
      ))}
    </div>
  );
}

/* ------------------------- Sem van: cadastrar primeiro ------------------------- */
function SemVan({ onCadastrar }: { onCadastrar: () => void }) {
  return (
    <Card className="mt-2 p-6 text-center">
      <div className="mx-auto w-44"><SlotIlustracao slot="van.ilustracao" alt="Van escolar" fallback={<VanEscolar className="w-full" />} /></div>
      <p className="mt-2 font-display text-lg font-bold text-navy-900">Cadastre sua van primeiro</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-navy-500">Para montar a rota, precisamos saber quantos lugares sua van tem.</p>
      <ul className="mx-auto mt-4 max-w-[16rem] space-y-2 text-left text-sm text-navy-700">
        {['Defina a capacidade', 'Informe os recursos da van', 'Use nas suas rotas e simulações'].map((t) => (
          <li key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-mint-600" /> {t}</li>
        ))}
      </ul>
      <button onClick={onCadastrar}
        className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-mint-500 font-display text-base font-bold text-white shadow-float active:scale-[0.98]">
        <Bus className="h-5 w-5" /> Cadastrar van
      </button>
    </Card>
  );
}

/* ----------------------------- Selecionar a van ----------------------------- */
function SelecionarVan({ veiculos, selId, onSel, onCadastrarOutra, onContinuar, indo }: {
  veiculos: Veiculo[]; selId: string | null; onSel: (id: string) => void;
  onCadastrarOutra: () => void; onContinuar: () => void; indo: boolean;
}) {
  return (
    <div className="mt-2 space-y-3">
      <Card className="flex items-center gap-3 p-4">
        <div className="w-20 shrink-0"><SlotIlustracao slot="van.ilustracao" alt="Van escolar" fallback={<VanEscolar className="w-full" />} /></div>
        <div>
          <p className="font-display text-lg font-bold text-navy-900">Escolha a van</p>
          <p className="text-xs text-navy-500">Use uma van já cadastrada para montar a rota.</p>
        </div>
      </Card>

      {veiculos.map((v) => {
        const ativo = v.id === selId;
        return (
          <button key={v.id} onClick={() => onSel(v.id)} className="w-full text-left">
            <Card className={cn('vm-press flex items-center gap-3 p-4 ring-2 transition', ativo ? 'ring-mint-400' : 'ring-transparent')}>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-mint-50 text-mint-600"><Bus className="h-6 w-6" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold text-navy-900">{v.modelo || 'Van'}</p>
                <p className="text-xs text-navy-500">{v.ano ? `${v.ano} · ` : ''}{v.lugaresPassageiro} lugares para alunos</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {v.arCondicionado && <MiniRecurso icon={Snowflake} label="Ar" />}
                  {v.cintos && <MiniRecurso icon={ShieldCheck} label="Cintos" />}
                  {v.acessivel && <MiniRecurso icon={Accessibility} label="Acessível" />}
                </div>
              </div>
              <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full transition', ativo ? 'bg-mint-500 text-white' : 'ring-1 ring-navy-200')}>
                {ativo && <Check className="h-4 w-4" />}
              </span>
            </Card>
          </button>
        );
      })}

      <button onClick={onCadastrarOutra}
        className="flex w-full items-center justify-center gap-1.5 py-1 text-[13px] font-semibold text-mint-700">
        <Plus className="h-4 w-4" /> Cadastrar outra van
      </button>

      <button onClick={onContinuar} disabled={!selId || indo}
        className="mt-1 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-mint-500 font-display text-base font-bold text-white shadow-float transition active:scale-[0.98] disabled:opacity-60">
        {indo ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Continuar <ArrowRight className="h-5 w-5" /></>}
      </button>
    </div>
  );
}

function MiniRecurso({ icon: Icon, label }: { icon: typeof Snowflake; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2 py-0.5 text-[10px] font-semibold text-navy-500">
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}
