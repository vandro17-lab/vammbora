import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Route as RouteIcon, Users, Navigation, Clock, Plus, ChevronRight, Pencil, MapPin, School } from 'lucide-react';
import { VMShell } from '@/components/vm/VMShell';
import { Card, SubHeader, DemoChip } from '@/components/vm/ui';
import { MapaInterativoRota } from '@/components/motorista/MapaInterativoRota';
import { useDadosMotorista } from '@/lib/vm/useDadosMotorista';
import { distanciaRotaKm } from '@/lib/vm/cenario';
import { minutosParaTextoHora, cn } from '@/lib/utils';
import type { Rota } from '@/types/motorista';

const tempoMin = (km: number) => Math.max(5, Math.round((km / 35) * 60));
const trajeto = (r: Rota) => (r.sentido === 'ida' ? 'Casas → Colégio Paineiras' : 'Colégio Paineiras → Casas');
const horario = (r: Rota) => (r.ultimoDesembarqueMin != null ? minutosParaTextoHora(r.ultimoDesembarqueMin).replace(':', 'h') : '—');

/* ============================ TELA 4 — Minhas Rotas ============================ */
export function RotasPage() {
  const { dados } = useDadosMotorista();
  const [aba, setAba] = useState<'ativas' | 'simulacoes'>('ativas');

  return (
    <VMShell>
      <SubHeader titulo="Minhas rotas" acao={
        <Link to="/painel/rota/nova" className="grid h-8 w-8 place-items-center rounded-full bg-white/20" aria-label="Nova rota"><Plus className="h-5 w-5" /></Link>
      } />
      <div className="px-4 pt-4">
        {/* Tabs */}
        <div className="flex rounded-full bg-navy-100 p-1 text-sm font-semibold">
          <button onClick={() => setAba('ativas')} className={cn('flex-1 rounded-full py-2', aba === 'ativas' ? 'bg-mint-500 text-white shadow' : 'text-navy-500')}>Ativas ({dados.rotas.length})</button>
          <button onClick={() => setAba('simulacoes')} className={cn('flex-1 rounded-full py-2', aba === 'simulacoes' ? 'bg-mint-500 text-white shadow' : 'text-navy-500')}>Simulações</button>
        </div>
        {dados.demo && <div className="mt-3 flex justify-end"><DemoChip /></div>}

        {aba === 'ativas' ? (
          <div className="mt-3 space-y-3">
            {dados.rotas.map((r) => {
              const km = distanciaRotaKm(r);
              return (
                <Link key={r.id} to={`/app/rotas/${r.id}`}>
                  <Card className="flex items-center gap-3 p-4">
                    <span className="vm-chip-ico vm-ico-green"><RouteIcon className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-navy-900">{r.nome}</p>
                      <p className="truncate text-xs text-navy-500">{trajeto(r)}</p>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-navy-500">
                        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {r.passageiros.length}</span>
                        <span className="inline-flex items-center gap-1"><Navigation className="h-3.5 w-3.5" /> {km.toFixed(1).replace('.', ',')} km</span>
                        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {horario(r)}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-navy-300" />
                  </Card>
                </Link>
              );
            })}
            <Link to="/painel/rota/nova" className="flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-dashed border-mint-300 font-semibold text-mint-700">
              <Plus className="h-5 w-5" /> Montar nova rota
            </Link>
            <Card className="flex items-center gap-3 p-4">
              <span className="vm-chip-ico vm-ico-teal"><MapPin className="h-5 w-5" /></span>
              <div className="flex-1">
                <p className="text-sm font-bold text-navy-900">Simule uma nova rota</p>
                <p className="text-xs text-navy-500">Veja o impacto no tempo, no combustível e na ocupação.</p>
              </div>
              <Link to="/app/oportunidades" className="chip bg-mint-50 text-mint-700">abrir</Link>
            </Card>
          </div>
        ) : (
          <div className="mt-6 text-center text-sm text-navy-500">
            <p>Nenhuma simulação salva ainda.</p>
            <p className="mt-1 text-xs text-navy-400">Simule um encaixe em Oportunidades — nada é gravado na rota.</p>
          </div>
        )}
      </div>
    </VMShell>
  );
}

/* ========================== TELA 5 — Detalhes da Rota ========================== */
export function RotaDetalhePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { dados } = useDadosMotorista();
  const rota = dados.rotas.find((r) => r.id === id) ?? dados.rotas[0];

  if (!rota) {
    return (
      <VMShell nav={false}>
        <SubHeader titulo="Detalhes da Rota" onVoltar={() => navigate('/app/rotas')} />
        <p className="p-6 text-center text-navy-500">Rota não encontrada.</p>
      </VMShell>
    );
  }

  const km = distanciaRotaKm(rota);
  const paradasOrd = [...rota.paradas].sort((a, b) => a.ordem - b.ordem);
  const paradasVisiveis = paradasOrd.filter((p) => p.tipo !== 'saida');
  let acc = rota.paradas.find((p) => p.tipo === 'saida')?.ordem === 0 ? 6 * 60 + 25 : 6 * 60 + 25;

  return (
    <VMShell nav={false}>
      <SubHeader titulo="Detalhes da Rota" onVoltar={() => navigate('/app/rotas')}
        acao={<button onClick={() => navigate(`/painel/rota/${rota.id}`)} className="grid h-8 w-8 place-items-center rounded-full bg-white/20" aria-label="Editar"><Pencil className="h-5 w-5" /></button>} />
      <div className="space-y-3.5 px-4 pt-4">
        {dados.demo && <div className="flex justify-end"><DemoChip /></div>}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-lg font-extrabold text-navy-900">{rota.nome}</p>
              <p className="text-xs text-navy-500">{trajeto(rota)}</p>
            </div>
            <span className="chip bg-mint-100 text-mint-800">Ativa</span>
          </div>
          <div className="mt-3 flex items-center gap-4 text-sm text-navy-700">
            <span className="inline-flex items-center gap-1"><Users className="h-4 w-4 text-navy-400" /> {rota.passageiros.length}</span>
            <span className="inline-flex items-center gap-1"><Navigation className="h-4 w-4 text-navy-400" /> {km.toFixed(1).replace('.', ',')} km</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4 text-navy-400" /> {tempoMin(km)} min</span>
          </div>
        </Card>

        {/* Mapa real (Leaflet + OSRM) */}
        <div className="overflow-hidden rounded-2xl">
          <MapaInterativoRota paradas={rota.paradas} />
        </div>

        {/* Paradas */}
        <Card className="p-4">
          <p className="font-display font-bold text-navy-900">Paradas ({paradasVisiveis.length})</p>
          <div className="mt-2 divide-y divide-navy-50">
            {paradasVisiveis.map((p, i) => {
              acc += 7;
              const hhmm = minutosParaTextoHora(acc).replace(':', 'h');
              const Icone = p.tipo === 'escola' ? School : MapPin;
              return (
                <div key={p.id} className="flex items-center gap-3 py-2.5">
                  <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold', p.tipo === 'escola' ? 'bg-navy-900 text-white' : 'bg-mint-100 text-mint-700')}>{i + 1}</span>
                  <Icone className="h-4 w-4 shrink-0 text-navy-400" />
                  <span className="flex-1 truncate text-sm text-navy-700">{p.rotulo || (p.tipo === 'escola' ? 'Escola' : 'Parada')}</span>
                  <span className="text-xs font-semibold text-navy-500">{hhmm}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </VMShell>
  );
}
