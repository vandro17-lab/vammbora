import { useEffect, useState } from 'react';
import { Bus, Plus, Loader2, Snowflake, Accessibility, ShieldCheck, Check } from 'lucide-react';
import { MotoristaShell, ExigirMotorista } from './MotoristaShell';
import { listarRotas, listarVeiculos, salvarVeiculo } from '@/data/motorista-store';
import { impactoDaVanNasRotas, textoDoImpacto } from '@/lib/veiculo-rotas';
import type { Veiculo } from '@/types/motorista';
import { cn } from '@/lib/utils';

export function VeiculosPage() {
  return (
    <ExigirMotorista>
      <Veiculos />
    </ExigirMotorista>
  );
}

function vazio(): Veiculo {
  return { id: '', modelo: '', ano: undefined, placa: '', lugaresPassageiro: 15, arCondicionado: false, acessivel: false, cintos: true, fotos: [] };
}

function Veiculos() {
  const [lista, setLista] = useState<Veiculo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<Veiculo | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // Rotas cuja disponibilidade mudou com a última edição da van.
  const [impactos, setImpactos] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  async function recarregar() {
    setCarregando(true);
    try { setLista(await listarVeiculos()); }
    catch (e) { setErro('Não foi possível carregar suas vans: ' + (e as Error).message); }
    finally { setCarregando(false); }
  }
  useEffect(() => { recarregar(); }, []);

  async function salvar() {
    if (!editando) return;
    setSalvando(true);
    setAviso(null);
    setErro(null);
    setImpactos([]);
    try {
      const antes = lista.find((v) => v.id === editando.id) ?? null;
      const gravado = await salvarVeiculo(editando);
      setEditando(null);
      setAviso('Van salva!');
      // A capacidade das rotas vem da van a cada cálculo: mostra o que mudou
      // (nenhuma rota é alterada). Falha ao ler as rotas não desfaz o salvamento.
      if (antes) setImpactos(impactoDaVanNasRotas(antes, gravado, await listarRotas().catch(() => [])).map(textoDoImpacto));
      await recarregar(); // relê do banco: a lista mostra o que realmente ficou gravado
    } catch (e) {
      setErro('Não foi possível salvar: ' + (e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <MotoristaShell titulo="Minha van" voltarPara="/painel">
      {aviso && <p className="mb-4 rounded-xl bg-mint-50 p-3 text-sm text-mint-800">{aviso}</p>}
      {impactos.length > 0 && (
        <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" data-testid="impacto-van">
          <p className="font-semibold">A mudança de lugares altera a disponibilidade destas rotas:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">{impactos.map((t, i) => <li key={i}>{t}</li>)}</ul>
          <p className="mt-1 text-xs">Avaliações e simulações feitas antes desta mudança não valem mais: refaça-as.</p>
        </div>
      )}
      {erro && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{erro}</p>}

      {editando ? (
        <div className="card p-5">
          <h2 className="font-display text-lg font-bold">{editando.id ? 'Editar van' : 'Adicionar van'}</h2>
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Modelo da van" exemplo="Ex.: Sprinter, Master…">
                <input className="field-input" value={editando.modelo} onChange={(e) => setEditando({ ...editando, modelo: e.target.value })} />
              </Campo>
              <Campo rotulo="Ano (opcional)">
                <input className="field-input" inputMode="numeric" value={editando.ano ?? ''} maxLength={4} onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); setEditando({ ...editando, ano: d ? Number(d) : undefined }); }} />
              </Campo>
            </div>
            <Campo rotulo="Placa (fica privada)" exemplo="Só a equipe vê. Não aparece às famílias.">
              <input className="field-input" value={editando.placa ?? ''} onChange={(e) => setEditando({ ...editando, placa: e.target.value })} />
            </Campo>
            <Campo rotulo="Quantos lugares para alunos?" exemplo="Sem contar você, o motorista.">
              <div className="flex items-center gap-3">
                <button type="button" className="btn btn-md btn-ghost h-11 w-11 !px-0" onClick={() => setEditando({ ...editando, lugaresPassageiro: Math.max(1, editando.lugaresPassageiro - 1) })}>−</button>
                <span className="w-12 text-center font-display text-2xl font-bold">{editando.lugaresPassageiro}</span>
                <button type="button" className="btn btn-md btn-ghost h-11 w-11 !px-0" onClick={() => setEditando({ ...editando, lugaresPassageiro: editando.lugaresPassageiro + 1 })}>+</button>
              </div>
            </Campo>
            <div>
              <p className="field-label">A van tem:</p>
              <div className="flex flex-wrap gap-2">
                <Opcao ativo={editando.arCondicionado} onClick={() => setEditando({ ...editando, arCondicionado: !editando.arCondicionado })} Icone={Snowflake}>Ar-condicionado</Opcao>
                <Opcao ativo={editando.cintos} onClick={() => setEditando({ ...editando, cintos: !editando.cintos })} Icone={ShieldCheck}>Cintos</Opcao>
                <Opcao ativo={editando.acessivel} onClick={() => setEditando({ ...editando, acessivel: !editando.acessivel })} Icone={Accessibility}>Acessível</Opcao>
              </div>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button className="btn btn-lg btn-primary flex-1" onClick={salvar} disabled={salvando || !editando.modelo.trim()}>
              {salvando ? <><Loader2 className="h-5 w-5 animate-spin" /> Salvando…</> : 'Salvar van'}
            </button>
            <button className="btn btn-lg btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
          </div>
          <p className="mt-3 text-xs text-navy-400">Fotos da van entram numa próxima parte (envio pelo celular).</p>
        </div>
      ) : (
        <>
          {carregando ? (
            <div className="flex justify-center py-16 text-navy-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : lista.length === 0 ? (
            <div className="card p-8 text-center">
              <Bus className="mx-auto h-10 w-10 text-navy-300" />
              <p className="mt-3 text-navy-600">Você ainda não cadastrou sua van.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lista.map((v) => (
                <button key={v.id} onClick={() => setEditando(v)} className="card card-interactive flex w-full items-center gap-3 p-4 text-left">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-navy-50 text-navy-700"><Bus className="h-5 w-5" /></span>
                  <div className="flex-1">
                    <p className="font-semibold text-navy-900">{v.modelo || 'Van'}{v.ano ? ` · ${v.ano}` : ''}</p>
                    <p className="text-sm text-navy-500">{v.lugaresPassageiro} lugares para alunos</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          <button className="btn btn-lg btn-primary mt-5 w-full" onClick={() => setEditando(vazio())}>
            <Plus className="h-5 w-5" /> Adicionar van
          </button>
        </>
      )}
    </MotoristaShell>
  );
}

function Campo({ rotulo, exemplo, children }: { rotulo: string; exemplo?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label">{rotulo}</label>
      {children}
      {exemplo && <p className="mt-1 text-xs text-navy-400">{exemplo}</p>}
    </div>
  );
}

function Opcao({ ativo, onClick, Icone, children }: { ativo: boolean; onClick: () => void; Icone: typeof Snowflake; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo}
      className={cn('inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all',
        ativo ? 'bg-mint-500 text-white shadow-card' : 'bg-navy-50 text-navy-600 ring-1 ring-navy-100 hover:bg-navy-100')}>
      {ativo ? <Check className="h-4 w-4" /> : <Icone className="h-4 w-4" />} {children}
    </button>
  );
}
