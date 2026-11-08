import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check, Bus, Snowflake, ShieldCheck, Accessibility, CheckCircle2, ArrowRight, Loader2, Plus,
  Navigation, AlertCircle, Flag,
} from 'lucide-react';
import { VMShell } from '@/components/vm/VMShell';
import { SubHeader, Card } from '@/components/vm/ui';
import { VanEscolar } from '@/components/vm/VanEscolar';
import { SlotIlustracao } from '@/components/vm/SlotImagem';
import { MapaInterativoRota } from '@/components/motorista/MapaInterativoRota';
import { VanViz, LinhaPercurso, AcaoParada, Horarios, rotaNova } from '@/pages/motorista/RotaBuilderPage';
import { listarVeiculos, salvarRota } from '@/data/motorista-store';
import { USE_SUPABASE } from '@/lib/supabase';
import { VEICULO_CENARIO } from '@/lib/vm/cenario';
import { useVitrine } from '@/data/VitrineProvider';
import { capacidadeAlunos, aBordoEm, validarRota, podeFinalizar } from '@/lib/ocupacao-rota';
import { locaisDeDestinos } from '@/lib/geocode';
import type { Rota, Veiculo } from '@/types/motorista';
import { cn } from '@/lib/utils';

const PASSOS = ['Van', 'Paradas', 'Confirmação'];
type Etapa = 'van' | 'paradas' | 'confirmacao';

/* ===================== TELA 3 — Criar rota (fluxo guiado) =====================
   Stepper premium Van → Paradas → Confirmação. Aplica a regra de van já
   cadastrada (Bloco C) e o cenário Ideathon (Bloco D). Paradas e Confirmação
   REAPROVEITAM o motor real (geocodificação, ocupação, horários, persistência)
   via componentes exportados do construtor — sem criar um segundo motor. */
export function CriarRotaPage() {
  const navigate = useNavigate();
  const { destinos } = useVitrine();
  const [veiculos, setVeiculos] = useState<Veiculo[] | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [rota, setRota] = useState<Rota>(rotaNova());
  const [etapa, setEtapa] = useState<Etapa>('van');
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const reais = await listarVeiculos().catch(() => [] as Veiculo[]);
      // A van demonstrativa (id não-UUID) só entra no MODO DEMONSTRAÇÃO (sem banco).
      // Com banco conectado, usa só veículos reais — senão o save falha no UUID.
      const lista = reais.length > 0 ? reais : (!USE_SUPABASE ? [VEICULO_CENARIO] : []);
      if (!vivo) return;
      setVeiculos(lista);
      setSelId(lista[0]?.id ?? null);
    })();
    return () => { vivo = false; };
  }, []);

  const veiculo = useMemo(() => veiculos?.find((v) => v.id === rota.veiculoId) ?? null, [veiculos, rota.veiculoId]);
  const capacidade = capacidadeAlunos(rota, veiculo);
  const ultimaOrdem = rota.paradas.reduce((m, p) => Math.max(m, p.ordem), -1);
  const aBordoFinal = ultimaOrdem >= 0 ? aBordoEm(rota, ultimaOrdem) : [];
  const locaisBusca = useMemo(() => locaisDeDestinos(destinos), [destinos]);
  const problemas = validarRota(rota, veiculo);

  const aplicarTempos = useCallback((temposMin: number[]) => {
    setRota((prev) => {
      const ordenadas = [...prev.paradas].sort((a, b) => a.ordem - b.ordem);
      if (ordenadas.length !== temposMin.length + 1) return prev;
      let mudou = false;
      const novas = ordenadas.map((p, i) => {
        const t = i < temposMin.length ? temposMin[i] : null;
        if (p.tempoAteProximaMin !== t) mudou = true;
        return { ...p, tempoAteProximaMin: t };
      });
      return mudou ? { ...prev, paradas: novas } : prev;
    });
  }, []);

  function escolherVan() {
    const van = veiculos?.find((v) => v.id === selId);
    if (!van) return;
    setRota((r) => ({ ...r, veiculoId: van.id }));
    setEtapa('paradas');
  }

  async function concluir(rotaAtualizada: Rota) {
    setSalvando(true); setAviso(null);
    try {
      const nome = rotaAtualizada.nome || `Rota ${rotaAtualizada.sentido === 'ida' ? 'de ida' : 'de volta'}`;
      await salvarRota({ ...rotaAtualizada, nome, status: 'concluida' });
      navigate('/app/rotas');
    } catch (e) {
      setAviso('Não foi possível salvar: ' + (e as Error).message);
      setSalvando(false);
    }
  }

  function voltar() {
    if (etapa === 'van') navigate('/app/rotas');
    else if (etapa === 'paradas') setEtapa('van');
    else setEtapa('paradas');
  }

  const semVan = veiculos !== null && veiculos.length === 0;
  const idxEtapa = etapa === 'van' ? 0 : etapa === 'paradas' ? 1 : 2;

  return (
    <VMShell nav={false}>
      <SubHeader titulo="Criar rota" onVoltar={voltar} />
      <div className="px-4 pb-10 pt-4">
        <Stepper atual={idxEtapa} />

        {aviso && <p className="mb-3 rounded-xl bg-red-50 p-2.5 text-sm font-medium text-red-600">{aviso}</p>}

        {veiculos === null ? (
          <div className="flex justify-center py-16 text-navy-300"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : etapa === 'van' ? (
          semVan ? (
            <SemVan onCadastrar={() => navigate('/app/van/cadastro')} />
          ) : (
            <SelecionarVan veiculos={veiculos} selId={selId} onSel={setSelId}
              onCadastrarOutra={() => navigate('/app/van/cadastro')} onContinuar={escolherVan} />
          )
        ) : etapa === 'paradas' ? (
          <div className="space-y-3.5">
            <ConfigRota rota={rota} setRota={setRota} />
            <VanViz capacidade={capacidade} aBordo={aBordoFinal.length} rota={rota} veiculo={veiculo} />
            {rota.paradas.length > 0 && <LinhaPercurso rota={rota} setRota={setRota} mostrarHorarios={false} />}
            {rota.paradas.length > 0 && (
              <Card className="p-3.5">
                <p className="mb-2.5 inline-flex items-center gap-2 font-display font-bold text-navy-900">
                  <Navigation className="h-4 w-4 text-mint-600" /> Mapa da rota
                </p>
                <div className="h-60 overflow-hidden rounded-2xl ring-1 ring-navy-100">
                  <MapaInterativoRota paradas={rota.paradas} onTempos={aplicarTempos} bare />
                </div>
              </Card>
            )}
            <AcaoParada rota={rota} setRota={setRota} destinos={destinos} locais={locaisBusca} aBordo={aBordoFinal} capacidade={capacidade} escolaFinalObrigatoria />

            {problemas.length > 0 && (
              <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                {problemas.slice(0, 3).map((p, i) => (
                  <p key={i} className="inline-flex items-start gap-1.5"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {p.mensagem}</p>
                ))}
              </div>
            )}
            <button onClick={() => setEtapa('confirmacao')} disabled={!podeFinalizar(rota, veiculo)}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-mint-500 font-display text-base font-bold text-white shadow-float transition active:scale-[0.98] disabled:opacity-60">
              <Flag className="h-5 w-5" /> Finalizar rota
            </button>
          </div>
        ) : (
          <ConfirmacaoRota rota={rota} setRota={setRota} veiculo={veiculo} capacidade={capacidade}
            aBordo={aBordoFinal.length} onConcluir={concluir} salvando={salvando} />
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

/* ------------------------- Passo 1: Van ------------------------- */
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

function SelecionarVan({ veiculos, selId, onSel, onCadastrarOutra, onContinuar }: {
  veiculos: Veiculo[]; selId: string | null; onSel: (id: string) => void;
  onCadastrarOutra: () => void; onContinuar: () => void;
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

      <button onClick={onCadastrarOutra} className="flex w-full items-center justify-center gap-1.5 py-1 text-[13px] font-semibold text-mint-700">
        <Plus className="h-4 w-4" /> Cadastrar outra van
      </button>

      <button onClick={onContinuar} disabled={!selId}
        className="mt-1 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-mint-500 font-display text-base font-bold text-white shadow-float transition active:scale-[0.98] disabled:opacity-60">
        Continuar <ArrowRight className="h-5 w-5" />
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

/* ------------------------- Passo 2: configurações da rota ------------------------- */
function ConfigRota({ rota, setRota }: { rota: Rota; setRota: (r: Rota) => void }) {
  return (
    <Card className="p-4">
      <p className="field-label">Sentido</p>
      <div className="mt-1 flex gap-2">
        <PillSel ativo={rota.sentido === 'ida'} onClick={() => setRota({ ...rota, sentido: 'ida' })}>Ida (leva à escola)</PillSel>
        <PillSel ativo={rota.sentido === 'volta'} onClick={() => setRota({ ...rota, sentido: 'volta' })}>Volta (traz da escola)</PillSel>
      </div>
      <p className="field-label mt-4">Vai um monitor?</p>
      <div className="mt-1 flex gap-2">
        <PillSel ativo={rota.monitor} onClick={() => setRota({ ...rota, monitor: true })}>Sim</PillSel>
        <PillSel ativo={!rota.monitor} onClick={() => setRota({ ...rota, monitor: false, monitorOcupaLugar: false })}>Não</PillSel>
      </div>
      {rota.monitor && (
        <>
          <p className="field-label mt-3">O monitor ocupa um lugar?</p>
          <div className="mt-1 flex gap-2">
            <PillSel ativo={rota.monitorOcupaLugar} onClick={() => setRota({ ...rota, monitorOcupaLugar: true })}>Sim</PillSel>
            <PillSel ativo={!rota.monitorOcupaLugar} onClick={() => setRota({ ...rota, monitorOcupaLugar: false })}>Não</PillSel>
          </div>
        </>
      )}
    </Card>
  );
}

function PillSel({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo}
      className={cn('flex-1 rounded-full px-3 py-2 text-[13px] font-semibold transition',
        ativo ? 'bg-mint-500 text-white shadow-glow' : 'bg-navy-50 text-navy-600 ring-1 ring-navy-100')}>
      {children}
    </button>
  );
}

/* ------------------------- Passo 3: confirmação ------------------------- */
function ConfirmacaoRota({ rota, setRota, veiculo, capacidade, aBordo, onConcluir, salvando }: {
  rota: Rota; setRota: (r: Rota) => void; veiculo: Veiculo | null; capacidade: number;
  aBordo: number; onConcluir: (rotaAtualizada: Rota) => void; salvando: boolean;
}) {
  const alunos = rota.passageiros.length;
  const ocupacaoPct = capacidade > 0 ? Math.round((aBordo / capacidade) * 100) : 0;
  const paradasVisiveis = rota.paradas.filter((p) => p.tipo !== 'saida').length;

  return (
    <div className="space-y-3.5">
      <Card className="p-4">
        <p className="font-display font-bold text-navy-900">Revisão da rota</p>
        <div className="mt-3 space-y-2 text-sm">
          <LinhaResumo label="Van" valor={`${veiculo?.modelo || 'Van'} · ${capacidade} lugares`} />
          <LinhaResumo label="Sentido" valor={rota.sentido === 'ida' ? 'Ida (leva à escola)' : 'Volta (traz da escola)'} />
          <LinhaResumo label="Paradas" valor={String(paradasVisiveis)} />
          <LinhaResumo label="Alunos" valor={String(alunos)} />
          <LinhaResumo label="Ocupação" valor={`${ocupacaoPct}%`} />
        </div>
      </Card>

      <Card className="p-4">
        <label className="field-label">Nome da rota</label>
        <input className="field-input" placeholder={`Rota ${rota.sentido === 'ida' ? 'de ida' : 'de volta'}`}
          value={rota.nome} onChange={(e) => setRota({ ...rota, nome: e.target.value })} />
      </Card>

      {/* Horários (motor real) — o botão "Concluir rota" salva via salvarRota. */}
          <Horarios rota={rota} setRota={setRota} veiculo={veiculo} onConfirmar={onConcluir} salvando={salvando} />
    </div>
  );
}

function LinhaResumo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between border-b border-navy-50 pb-2 last:border-0">
      <span className="text-navy-500">{label}</span>
      <span className="font-semibold text-navy-900">{valor}</span>
    </div>
  );
}
