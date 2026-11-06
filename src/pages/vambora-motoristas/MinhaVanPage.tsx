import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gauge, Fuel, Coins, Route as RouteIcon, FileText, Wrench, Pencil, ChevronRight, Check, Bus, Plus } from 'lucide-react';
import { VMShell } from '@/components/vm/VMShell';
import { Card, SubHeader, LinhaValor, DemoChip, EstadoVazio } from '@/components/vm/ui';
import { VanEscolar } from '@/components/vm/VanEscolar';
import { SlotIlustracao } from '@/components/vm/SlotImagem';
import { useDadosMotorista, lerPrefs, salvarPrefs } from '@/lib/vm/useDadosMotorista';
import { salvarVeiculo } from '@/data/motorista-store';
import { formatBRL, cn } from '@/lib/utils';
import type { Veiculo } from '@/types/motorista';

/* ============================= TELA 9 — Minha Van ============================= */
export function MinhaVanPage() {
  const navigate = useNavigate();
  const { dados, indicadores: ind } = useDadosMotorista();
  const v = dados.veiculo;
  const prefs = lerPrefs();

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
  const { dados } = useDadosMotorista();
  const prefs = lerPrefs();
  const [passo, setPasso] = useState(1);
  const [salvo, setSalvo] = useState(false);

  const [modelo, setModelo] = useState(dados.veiculo?.modelo ?? 'Mercedes-Benz Sprinter');
  const [ano, setAno] = useState(dados.veiculo?.ano ?? 2018);
  const [lugares, setLugares] = useState(dados.veiculo?.lugaresPassageiro ?? 15);
  const [consumo, setConsumo] = useState(prefs.consumoKmL);
  const [preco, setPreco] = useState(prefs.precoDiesel);
  const [mensalidade, setMensalidade] = useState(prefs.mensalidade);
  const [acEl, setAc] = useState(dados.veiculo?.arCondicionado ?? true);
  const [cintosEl, setCintos] = useState(dados.veiculo?.cintos ?? true);
  const [acessivelEl, setAcessivel] = useState(dados.veiculo?.acessivel ?? false);

  async function concluir() {
    const veic: Veiculo = {
      id: dados.veiculo?.id ?? '',
      modelo, ano, placa: dados.veiculo?.placa,
      lugaresPassageiro: lugares, arCondicionado: acEl, acessivel: acessivelEl, cintos: cintosEl,
      fotos: dados.veiculo?.fotos ?? [],
    };
    try { await salvarVeiculo(veic); } catch { /* protótipo: segue mesmo sem backend */ }
    salvarPrefs({ consumoKmL: consumo, precoDiesel: preco, mensalidade });
    setSalvo(true);
    setTimeout(() => navigate('/app'), 900);
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
              <VanEscolar className="w-24" />
              <div>
                <p className="font-display font-bold text-navy-900">Conte sobre a sua van</p>
                <p className="text-xs text-navy-500">Ajuda a calcular custos, consumo e oportunidades.</p>
              </div>
            </div>
            <label className="field-label mt-4">Modelo do veículo</label>
            <select className="field-input" value={modelo} onChange={(e) => setModelo(e.target.value)}>
              {MODELOS.map((m) => <option key={m}>{m}</option>)}
            </select>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div><label className="field-label">Ano</label><input className="field-input" inputMode="numeric" value={ano} onChange={(e) => setAno(Number(e.target.value.replace(/\D/g, '')) || 0)} /></div>
              <div><label className="field-label">Lugares para alunos</label><input className="field-input" inputMode="numeric" value={lugares} onChange={(e) => setLugares(Number(e.target.value.replace(/\D/g, '')) || 0)} /></div>
            </div>
            <label className="field-label mt-3">Rendimento (km/l)</label>
            <input className="field-input" inputMode="decimal" value={String(consumo).replace('.', ',')} onChange={(e) => setConsumo(Number(e.target.value.replace(',', '.').replace(/[^\d.]/g, '')) || 0)} />
            <label className="field-label mt-3">Preço do diesel (R$/litro)</label>
            <input className="field-input" inputMode="decimal" value={String(preco).replace('.', ',')} onChange={(e) => setPreco(Number(e.target.value.replace(',', '.').replace(/[^\d.]/g, '')) || 0)} />
          </Card>
        )}

        {passo === 2 && (
          <Card className="p-5">
            <p className="font-display font-bold text-navy-900">Operação</p>
            <p className="text-xs text-navy-500">Como você costuma cobrar e equipar a van.</p>
            <label className="field-label mt-4">Mensalidade por aluno (R$)</label>
            <input className="field-input" inputMode="numeric" value={mensalidade} onChange={(e) => setMensalidade(Number(e.target.value.replace(/\D/g, '')) || 0)} />
            <p className="field-label mt-4">Recursos da van</p>
            {[['Ar-condicionado', acEl, setAc], ['Cintos de 3 pontos', cintosEl, setCintos], ['Acessível (PCD)', acessivelEl, setAcessivel]].map(([label, val, set]) => (
              <button key={label as string} onClick={() => (set as (v: boolean) => void)(!(val as boolean))}
                className="mt-2 flex w-full items-center justify-between rounded-xl bg-navy-50 px-4 py-3 text-sm font-medium text-navy-700">
                {label as string}
                <span className={cn('grid h-6 w-11 items-center rounded-full p-0.5 transition', val ? 'bg-mint-500' : 'bg-navy-200')}>
                  <span className={cn('h-5 w-5 rounded-full bg-white transition', val ? 'translate-x-5' : '')} />
                </span>
              </button>
            ))}
          </Card>
        )}

        {passo === 3 && (
          <Card className="p-5 text-center">
            {salvo ? (
              <>
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-mint-100 text-mint-600"><Check className="h-8 w-8" /></span>
                <p className="mt-3 font-display text-lg font-bold">Van salva!</p>
                <p className="text-sm text-navy-500">Abrindo seu aplicativo…</p>
              </>
            ) : (
              <>
                <VanEscolar className="mx-auto w-32" />
                <p className="mt-2 font-display text-lg font-bold">Confira e conclua</p>
                <div className="mt-3 space-y-1.5 text-left text-sm">
                  {[['Modelo', modelo], ['Ano', ano], ['Lugares', lugares], ['Rendimento', `${String(consumo).replace('.', ',')} km/l`], ['Diesel', `${formatBRL(preco)}/l`], ['Mensalidade', formatBRL(mensalidade)]].map(([k, val]) => (
                    <div key={k as string} className="flex justify-between border-b border-navy-50 pb-1.5"><span className="text-navy-500">{k}</span><span className="font-semibold text-navy-800">{String(val)}</span></div>
                  ))}
                </div>
              </>
            )}
          </Card>
        )}

        {!salvo && (
          <button onClick={() => (passo < 3 ? setPasso(passo + 1) : concluir())}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-mint-500 text-base font-bold text-white shadow-float active:scale-[0.98]">
            {passo < 3 ? 'Continuar →' : 'Salvar van'}
          </button>
        )}
      </div>
    </VMShell>
  );
}
