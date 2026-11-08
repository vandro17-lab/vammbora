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
import { AcaoParada, Horarios, rotaNova } from '@/pages/motorista/RotaBuilderPage';
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
    <VMShell nav={false} wide className={etapa === 'paradas' ? 'h-dvh overflow-hidden pb-0' : undefined}>
      <SubHeader titulo="Criar rota" onVoltar={voltar} />
      <div className={etapa === 'paradas' ? 'px-3 pt-1' : 'px-4 pb-10 pt-4'}>
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
          <CadastroParadasPremium rota={rota} setRota={setRota} destinos={destinos} locais={locaisBusca} aBordo={aBordoFinal} capacidade={capacidade} veiculo={veiculo} aplicarTempos={aplicarTempos} problemas={problemas} onFinalizar={() => setEtapa('confirmacao')} />
        ) : (
          <ConfirmacaoRota rota={rota} setRota={setRota} veiculo={veiculo} capacidade={capacidade}
            aBordo={aBordoFinal.length} onConcluir={concluir} salvando={salvando} />
        )}
      </div>
    </VMShell>
  );
}

function CadastroParadasPremium({ rota, setRota, destinos, locais, aBordo, capacidade, veiculo, aplicarTempos, problemas, onFinalizar }: {
  rota: Rota; setRota: (r: Rota) => void;
  destinos: { id: string; nome: string; bairro: string; lat?: number | null; lng?: number | null }[];
  locais: { rotulo: string; lat: number; lng: number }[];
  aBordo: { id: string; identificacao: string }[];
  capacidade: number; veiculo: Veiculo | null; aplicarTempos: (tempos: number[]) => void;
  problemas: { mensagem: string }[]; onFinalizar: () => void;
}) {
  const ultima = [...rota.paradas].sort((a, b) => b.ordem - a.ordem)[0];
  const pode = podeFinalizar(rota, veiculo);
  return (
    <div className="h-[calc(100dvh-9.25rem)] min-h-0 overflow-hidden rounded-[1.5rem] bg-navy-950 p-2 shadow-2xl ring-1 ring-black/10 sm:h-[calc(100dvh-9rem)] sm:p-3 lg:h-[calc(100dvh-8.5rem)]">
      <div className="grid h-full min-h-0 grid-rows-[42%_58%] gap-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(22rem,0.7fr)] lg:grid-rows-1 lg:gap-3">
        <section className="relative min-h-0 overflow-hidden rounded-[1.2rem] bg-navy-100 shadow-xl">
          <MapaInterativoRota paradas={rota.paradas} onTempos={aplicarTempos} bare />
          <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2 sm:inset-x-4 sm:top-4">
            <div className="ml-10 rounded-2xl bg-navy-950/90 px-3 py-2 text-white shadow-xl backdrop-blur sm:ml-12"><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-mint-300">Percurso em construção</p><p className="mt-0.5 text-sm font-extrabold">{rota.paradas.length ? `${rota.paradas.length} ponto(s) confirmado(s)` : 'Comece pela saída da van'}</p></div>
            <div className="rounded-2xl bg-white/95 px-3 py-2 text-right text-[10px] font-bold text-navy-900 shadow-xl"><span className="block text-navy-400">VAN</span>{veiculo?.modelo || 'Sua van'}</div>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-bold text-navy-900 shadow-xl sm:bottom-4 sm:left-4">A van acompanha o último ponto</div>
        </section>
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-[1.2rem] bg-white shadow-xl">
          <div className="shrink-0 border-b border-navy-100 bg-gradient-to-r from-navy-950 to-navy-800 px-4 py-3 text-white sm:px-5">
            <div className="flex items-center justify-between gap-2"><div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-mint-300">Próximo ponto</p><h2 className="font-display text-lg font-extrabold">{ultima ? (ultima.tipo === 'escola' ? 'Escola final' : 'Adicionar endereço') : 'Endereço de saída'}</h2></div><Navigation className="h-5 w-5 text-mint-300" /></div>
            <div className="mt-2 flex gap-2 text-[10px] font-semibold text-white/70"><span className="rounded-full bg-white/10 px-2 py-1">{rota.passageiros.length} aluno(s)</span><span className="rounded-full bg-white/10 px-2 py-1">{aBordo.length}/{capacidade} a bordo</span></div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden p-2 sm:p-3">
            <AcaoParada rota={rota} setRota={setRota} destinos={destinos} locais={locais} aBordo={aBordo} capacidade={capacidade} escolaFinalObrigatoria compacto />
          </div>
          <div className="shrink-0 border-t border-navy-100 bg-navy-50 p-2 sm:p-3">
            {problemas.length > 0 && <p className="mb-2 flex items-start gap-1.5 text-[10px] font-semibold text-amber-700"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{problemas[0].mensagem}</p>}
            <button onClick={onFinalizar} disabled={!pode} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-mint-500 text-sm font-extrabold text-white shadow-lg transition hover:bg-mint-600 disabled:cursor-not-allowed disabled:opacity-40"><Flag className="h-4 w-4" /> Revisar e informar horário final</button>
          </div>
        </aside>
      </div>
    </div>
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
