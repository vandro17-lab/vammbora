import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gauge, Fuel, Coins, Route as RouteIcon, FileText, Wrench, Pencil, ChevronRight, Check, Bus, Plus,
  Minus, CalendarDays, Hash, Lock, Users, Snowflake, ShieldCheck, Accessibility, type LucideIcon,
} from 'lucide-react';
import { VMShell } from '@/components/vm/VMShell';
import { Card, SubHeader, LinhaValor, DemoChip, EstadoVazio, AvisoErro } from '@/components/vm/ui';
import { VanEscolar } from '@/components/vm/VanEscolar';
import { SlotIlustracao } from '@/components/vm/SlotImagem';
import { useDadosMotorista, lerPrefs, salvarPrefs } from '@/lib/vm/useDadosMotorista';
import { salvarVeiculo } from '@/data/motorista-store';
import { impactoDaVanNasRotas, textoDoImpacto, type ImpactoNaRota } from '@/lib/veiculo-rotas';
import { formatBRL, cn } from '@/lib/utils';
import type { Veiculo } from '@/types/motorista';

/* ============================= TELA 9 — Minha Van ============================= */
export function MinhaVanPage() {
  const navigate = useNavigate();
  const { dados, indicadores: ind, carregando, erro, recarregar } = useDadosMotorista();
  const v = dados.veiculo;
  const prefs = lerPrefs();

  // Ainda consultando, ou a consulta falhou: não é "sem van".
  if (!v && (carregando || erro)) {
    return (
      <VMShell>
        <SubHeader titulo="Minha Van" />
        <div className="px-4 pt-4">
          {erro ? <AvisoErro mensagem={erro} onTentar={recarregar} /> : <p className="py-10 text-center text-sm text-navy-400">Carregando…</p>}
        </div>
      </VMShell>
    );
  }

  // Dados reais, mas o motorista ainda não cadastrou a van.
  if (!dados.demo && !v) {
    return (
      <VMShell>
        <SubHeader titulo="Minha Van" />
        <div className="px-4 pt-4">
          <EstadoVazio
            icon={Bus}
            ilustracao={<SlotIlustracao slot="van.vazio" alt="" fallback={<Bus className="h-8 w-8" />} />}
            titulo="Cadastre sua van"
            texto="Informe modelo, lugares, consumo e preço do diesel para calcularmos custos, rotas e oportunidades."
            acao={
              <button onClick={() => navigate('/app/van/cadastro')} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-mint-500 font-semibold text-white shadow-float active:scale-[0.98]">
                <Plus className="h-5 w-5" /> Cadastrar van
              </button>
            }
          />
        </div>
      </VMShell>
    );
  }

  return (
    <VMShell>
      <SubHeader titulo="Minha Van" />
      <div className="space-y-3.5 px-4 pt-4">
        {dados.demo && <div className="flex justify-end"><DemoChip /></div>}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-28 shrink-0">
              <SlotIlustracao slot="van.ilustracao" alt="Van escolar" fallback={<VanEscolar className="w-full" />} />
            </div>
            <div className="flex-1">
              <p className="font-display text-lg font-extrabold text-navy-900">{v?.modelo ?? 'Mercedes-Benz Sprinter'}</p>
              <p className="text-sm text-navy-500">{v?.ano ?? 2018} · {v?.lugaresPassageiro ?? 15} lugares</p>
            </div>
            <button onClick={() => navigate('/app/van/cadastro')} className="grid h-9 w-9 place-items-center rounded-full bg-navy-50 text-navy-500" aria-label="Editar van"><Pencil className="h-4 w-4" /></button>
          </div>
        </Card>

        <Card className="px-4 py-1">
          <div className="divide-y divide-navy-50">
            <LinhaValor icon={Gauge} cor="green" label="Rendimento médio" valor={`${prefs.consumoKmL.toFixed(1).replace('.', ',')} km/l`} />
            <LinhaValor icon={Fuel} cor="rose" label="Preço do diesel" valor={`${formatBRL(prefs.precoDiesel)} / litro`} />
            <LinhaValor icon={RouteIcon} cor="blue" label="Custo por km" valor={formatBRL(ind.custoPorKmBRL)} />
            <LinhaValor icon={Coins} cor="amber" label={`Custo por dia (${Math.round(ind.distanciaDiaKm)} km)`} valor={formatBRL(ind.custoDiaBRL)} />
          </div>
        </Card>

        <button onClick={() => navigate('/app/mais/documentacao')} className="w-full text-left">
          <Card className="flex items-center gap-3 p-4">
            <span className="vm-chip-ico vm-ico-teal"><FileText className="h-5 w-5" /></span>
            <div className="flex-1"><p className="font-bold text-navy-900">Documentação</p><p className="text-xs text-navy-500">Vencimentos e anexos</p></div>
            <ChevronRight className="h-5 w-5 text-navy-300" />
          </Card>
        </button>
        <button onClick={() => navigate('/app/mais/manutencao')} className="w-full text-left">
          <Card className="flex items-center gap-3 p-4">
            <span className="vm-chip-ico vm-ico-slate"><Wrench className="h-5 w-5" /></span>
            <div className="flex-1"><p className="font-bold text-navy-900">Manutenção</p><p className="text-xs text-navy-500">Controle e lembretes</p></div>
            <ChevronRight className="h-5 w-5 text-navy-300" />
          </Card>
        </button>
      </div>
    </VMShell>
  );
}

/* ========================== TELA 2 — Cadastro da Van ========================== */
const MODELOS = ['Mercedes-Benz Sprinter', 'Renault Master', 'Fiat Ducato', 'Iveco Daily', 'Peugeot Boxer', 'Volkswagen Crafter'];

export function CadastroVanPage() {
  const navigate = useNavigate();
  const { dados, carregando, erro: erroCarga } = useDadosMotorista();
  const prefs = lerPrefs();
  const [passo, setPasso] = useState(1);
  const [salvo, setSalvo] = useState(false);
  // Rotas cuja capacidade mudou por causa desta edição (lugares da van).
  const [impactos, setImpactos] = useState<ImpactoNaRota[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [modelo, setModelo] = useState(dados.veiculo?.modelo ?? 'Mercedes-Benz Sprinter');
  const [ano, setAno] = useState(dados.veiculo?.ano ?? 2018);
  const [placa, setPlaca] = useState(dados.veiculo?.placa ?? '');
  const [lugares, setLugares] = useState(dados.veiculo?.lugaresPassageiro ?? 15);
  const [consumo, setConsumo] = useState(prefs.consumoKmL);
  const [preco, setPreco] = useState(prefs.precoDiesel);
  const [mensalidade, setMensalidade] = useState(prefs.mensalidade);
  const [acEl, setAc] = useState(dados.veiculo?.arCondicionado ?? true);
  const [cintosEl, setCintos] = useState(dados.veiculo?.cintos ?? true);
  const [acessivelEl, setAcessivel] = useState(dados.veiculo?.acessivel ?? false);

  // Os dados reais chegam DEPOIS do 1º render (que nasce com o cenário de
  // exemplo). Ao terminar de carregar, o formulário passa a mostrar a van
  // realmente cadastrada — senão editar gravaria os valores de exemplo por cima.
  const [sincronizado, setSincronizado] = useState(false);
  useEffect(() => {
    if (carregando || erroCarga || sincronizado) return;
    setSincronizado(true);
    const v = dados.demo ? null : dados.veiculo;
    if (!v) return;
    setModelo(v.modelo); setAno(v.ano ?? 0); setPlaca(v.placa ?? ''); setLugares(v.lugaresPassageiro);
    setAc(v.arCondicionado); setCintos(v.cintos); setAcessivel(v.acessivel);
  }, [carregando, erroCarga, sincronizado, dados]);

  async function concluir() {
    // Só edita uma van REAL do motorista; a van do cenário de exemplo vira cadastro novo.
    const existente = dados.demo ? null : dados.veiculo;
    const veic: Veiculo = {
      id: existente?.id ?? '',
      modelo, ano: ano || undefined, placa: placa.trim() || undefined,
      lugaresPassageiro: lugares, arCondicionado: acEl, acessivel: acessivelEl, cintos: cintosEl,
      fotos: existente?.fotos ?? [],
    };
    setErro(null); setSalvando(true);
    let gravado: Veiculo;
    try {
      gravado = await salvarVeiculo(veic);
    } catch (e) {
      // Qualquer falha real precisa aparecer (nunca "Van salva!" sem ter salvo).
      setSalvando(false);
      setErro('Não foi possível salvar a van: ' + (e as Error).message);
      return;
    }
    salvarPrefs({ consumoKmL: consumo, precoDiesel: preco, mensalidade });
    setSalvando(false);
    setSalvo(true);
    // A capacidade das rotas é recalculada a partir da van a cada busca/simulação:
    // mostramos ao motorista o que mudou. Nenhuma rota é alterada por aqui.
    const afetadas = existente ? impactoDaVanNasRotas(existente, gravado, dados.rotas) : [];
    setImpactos(afetadas);
    // Volta para onde veio (fluxo de criar rota ou Minha Van) — a menos que haja
    // rotas afetadas para o motorista ler antes.
    if (afetadas.length === 0) setTimeout(() => navigate(-1), 900);
  }

  return (
    <VMShell nav={false}>
      <SubHeader titulo="Cadastro da Van" onVoltar={() => (passo > 1 ? setPasso(passo - 1) : navigate('/app/van'))} />
      {/* Stepper */}
      <div className="flex items-center justify-center gap-2 px-6 py-5">
        {[['1', 'Veículo'], ['2', 'Operação'], ['3', 'Conclusão']].map(([n, label], i) => {
          const num = i + 1;
          return (
            <div key={n} className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <span className={cn('grid h-8 w-8 place-items-center rounded-full text-sm font-bold', passo >= num ? 'bg-mint-500 text-white' : 'bg-navy-100 text-navy-400')}>{passo > num ? <Check className="h-4 w-4" /> : n}</span>
                <span className={cn('mt-1 text-[10px] font-medium', passo >= num ? 'text-navy-700' : 'text-navy-400')}>{label}</span>
              </div>
              {i < 2 && <span className={cn('mb-4 h-0.5 w-8', passo > num ? 'bg-mint-500' : 'bg-navy-100')} />}
            </div>
          );
        })}
      </div>

      <div className="px-4">
        {passo === 1 && (
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-24 shrink-0"><SlotIlustracao slot="van.ilustracao" alt="Van escolar" fallback={<VanEscolar className="w-full" />} /></div>
              <div>
                <p className="font-display text-lg font-bold text-navy-900">Adicionar van</p>
                <p className="text-xs text-navy-500">Cadastre os dados da sua van escolar.</p>
              </div>
            </div>

            <CampoVan icon={Bus} label="Modelo da van">
              <input className="field-input" list="modelos-van" placeholder="Ex.: Sprinter, Master, Ducato…"
                value={modelo} onChange={(e) => setModelo(e.target.value)} />
              <datalist id="modelos-van">{MODELOS.map((m) => <option key={m} value={m} />)}</datalist>
            </CampoVan>

            <CampoVan icon={CalendarDays} label="Ano (opcional)">
              <input className="field-input" inputMode="numeric" placeholder="Ex.: 2020"
                value={ano || ''} onChange={(e) => setAno(Number(e.target.value.replace(/\D/g, '')) || 0)} />
            </CampoVan>

            <CampoVan icon={Hash} label="Placa (fica privada)">
              <input className="field-input" placeholder="Ex.: ABC0D12" maxLength={8}
                value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                style={{ textTransform: placa ? 'uppercase' : 'none' }} />
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-navy-400"><Lock className="h-3 w-3" /> Só a equipe vê. Não aparece às famílias.</p>
            </CampoVan>

            <div className="mt-4">
              <p className="field-label inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-navy-400" /> Quantos lugares para alunos?</p>
              <div className="mt-2 flex items-center gap-4">
                <button type="button" onClick={() => setLugares(Math.max(1, lugares - 1))} aria-label="Menos um lugar"
                  className="grid h-11 w-11 place-items-center rounded-full bg-navy-50 text-navy-700 ring-1 ring-navy-100 active:scale-95"><Minus className="h-5 w-5" /></button>
                <span className="w-12 text-center font-display text-3xl font-extrabold tabular-nums text-navy-900">{lugares}</span>
                <button type="button" onClick={() => setLugares(lugares + 1)} aria-label="Mais um lugar"
                  className="grid h-11 w-11 place-items-center rounded-full bg-mint-500 text-white active:scale-95"><Plus className="h-5 w-5" /></button>
              </div>
              <p className="mt-1.5 text-[11px] text-navy-400">Sem contar você, o motorista.</p>
            </div>

            <div className="mt-4">
              <p className="field-label">A van tem:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <ChipRecurso icon={Snowflake} label="Ar-condicionado" ativo={acEl} onClick={() => setAc(!acEl)} />
                <ChipRecurso icon={ShieldCheck} label="Cintos" ativo={cintosEl} onClick={() => setCintos(!cintosEl)} />
                <ChipRecurso icon={Accessibility} label="Acessível" ativo={acessivelEl} onClick={() => setAcessivel(!acessivelEl)} />
              </div>
            </div>
          </Card>
        )}

        {passo === 2 && (
          <Card className="p-5">
            <p className="font-display font-bold text-navy-900">Operação</p>
            <p className="text-xs text-navy-500">Consumo e valores para calcular custos, rotas e oportunidades.</p>
            <CampoVan icon={Gauge} label="Rendimento (km/l)">
              <input className="field-input" inputMode="decimal" value={String(consumo).replace('.', ',')}
                onChange={(e) => setConsumo(Number(e.target.value.replace(',', '.').replace(/[^\d.]/g, '')) || 0)} />
            </CampoVan>
            <CampoVan icon={Fuel} label="Preço do diesel (R$/litro)">
              <input className="field-input" inputMode="decimal" value={String(preco).replace('.', ',')}
                onChange={(e) => setPreco(Number(e.target.value.replace(',', '.').replace(/[^\d.]/g, '')) || 0)} />
            </CampoVan>
            <CampoVan icon={Coins} label="Mensalidade por aluno (R$)">
              <input className="field-input" inputMode="numeric" value={mensalidade}
                onChange={(e) => setMensalidade(Number(e.target.value.replace(/\D/g, '')) || 0)} />
            </CampoVan>
          </Card>
        )}

        {passo === 3 && (
          <Card className="p-5 text-center">
            {salvo ? (
              <>
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-mint-100 text-mint-600"><Check className="h-8 w-8" /></span>
                <p className="mt-3 font-display text-lg font-bold">Van salva!</p>
                {impactos.length === 0 ? <p className="text-sm text-navy-500">Abrindo seu aplicativo…</p> : (
                  <div className="mt-3 text-left" data-testid="impacto-van">
                    <p className="text-sm font-semibold text-navy-800">A mudança de lugares altera a disponibilidade destas rotas:</p>
                    <ul className="mt-2 space-y-2">
                      {impactos.map((i) => (
                        <li key={i.rotaId} className={cn('rounded-xl p-3 text-sm', i.efeito === 'excede' || i.efeito === 'sem_lugar' ? 'bg-amber-50 text-amber-900' : 'bg-navy-50 text-navy-700')}>{textoDoImpacto(i)}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-navy-500">Avaliações e simulações feitas antes desta mudança não valem mais: refaça-as.</p>
                    <button type="button" className="btn btn-primary mt-3 w-full" onClick={() => navigate(-1)}>Entendi</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <VanEscolar className="mx-auto w-32" />
                <p className="mt-2 font-display text-lg font-bold">Confira e conclua</p>
                <div className="mt-3 space-y-1.5 text-left text-sm">
                  {[['Modelo', modelo], ['Ano', ano || '—'], ['Lugares', lugares], ['Rendimento', `${String(consumo).replace('.', ',')} km/l`], ['Diesel', `${formatBRL(preco)}/l`], ['Mensalidade', formatBRL(mensalidade)]].map(([k, val]) => (
                    <div key={k as string} className="flex justify-between border-b border-navy-50 pb-1.5"><span className="text-navy-500">{k}</span><span className="font-semibold text-navy-800">{String(val)}</span></div>
                  ))}
                </div>
              </>
            )}
          </Card>
        )}

        {erro && <p className="mt-3 rounded-xl bg-red-50 p-2.5 text-sm font-medium text-red-600">{erro}</p>}

        {!salvo && (
          <button onClick={() => (passo < 3 ? setPasso(passo + 1) : concluir())} disabled={salvando || carregando}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-mint-500 text-base font-bold text-white shadow-float transition active:scale-[0.98] disabled:opacity-60">
            {passo < 3 ? 'Continuar →' : (salvando ? 'Salvando…' : 'Salvar van')}
          </button>
        )}
      </div>
    </VMShell>
  );
}

/* -------------------- Auxiliares do formulário de van -------------------- */
function CampoVan({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="mt-3.5">
      <label className="field-label inline-flex items-center gap-1.5"><Icon className="h-4 w-4 text-navy-400" /> {label}</label>
      {children}
    </div>
  );
}

function ChipRecurso({ icon: Icon, label, ativo, onClick }: { icon: LucideIcon; label: string; ativo: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo}
      className={cn('inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition active:scale-95',
        ativo ? 'bg-mint-500 text-white ring-mint-500' : 'bg-white text-navy-600 ring-navy-200')}>
      {ativo ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />} {label}
    </button>
  );
}
