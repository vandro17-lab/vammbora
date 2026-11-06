import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Users, Navigation, Clock, Plus, ChevronRight, MapPin, School, Sunrise, Sunset,
  Maximize2, Car, Flag, MapPinned, Route as RouteIcon,
} from 'lucide-react';
import { Path } from '@phosphor-icons/react';
import { VMShell } from '@/components/vm/VMShell';
import { VMSectionHeader } from '@/components/vm/VMHeader';
import { Card, SubHeader, DemoChip, EstadoVazio } from '@/components/vm/ui';
import { MapaInterativoRota } from '@/components/motorista/MapaInterativoRota';
import { useDadosMotorista } from '@/lib/vm/useDadosMotorista';
import { publicarRota } from '@/data/motorista-store';
import { distanciaRotaKm } from '@/lib/vm/cenario';
import { minutosParaTextoHora, cn } from '@/lib/utils';
import type { Rota } from '@/types/motorista';

const tempoMin = (km: number) => Math.max(5, Math.round((km / 35) * 60));
const trajeto = (r: Rota) => (r.sentido === 'ida' ? 'Casas → Colégio Paineiras' : 'Colégio Paineiras → Casas');
const horario = (r: Rota) => (r.ultimoDesembarqueMin != null ? minutosParaTextoHora(r.ultimoDesembarqueMin).replace(':', 'h') : '—');
const IconeTurno = (r: Rota) => (r.sentido === 'ida' ? Sunrise : Sunset);

/* ============================ TELA 1 — Minhas Rotas ============================ */
export function RotasPage() {
  const { dados } = useDadosMotorista();
  const [aba, setAba] = useState<'ativas' | 'simulacoes'>('ativas');
  const ativas = dados.rotas.length;

  return (
    <VMShell>
      <VMSectionHeader
        icon={Path}
        titulo="Minhas rotas"
        subtitulo="Gerencie, crie e simule suas rotas escolares."
        voltarPara={null}
        tituloKey="rotas.header.titulo"
        subtituloKey="rotas.header.subtitulo"
      />

      <div className="px-4 pt-4">
        {/* Abas segmentadas */}
        <div className="flex gap-1 rounded-full bg-white p-1 text-sm font-semibold shadow-card ring-1 ring-navy-100">
          <button onClick={() => setAba('ativas')}
            className={cn('flex-1 rounded-full py-2.5 transition', aba === 'ativas' ? 'bg-mint-500 text-white shadow-glow' : 'text-navy-500')}>
            Ativas ({ativas})
          </button>
          <button onClick={() => setAba('simulacoes')}
            className={cn('flex-1 rounded-full py-2.5 transition', aba === 'simulacoes' ? 'bg-mint-500 text-white shadow-glow' : 'text-navy-500')}>
            Simulações
          </button>
        </div>
        {dados.demo && <div className="mt-3 flex justify-end"><DemoChip /></div>}

        {aba === 'ativas' ? (
          <div className="mt-3 space-y-3">
            {ativas === 0 && !dados.demo ? (
              <EstadoVazio
                icon={RouteIcon}
                titulo="Nenhuma rota ainda"
                texto="Monte sua primeira rota no construtor para ver ocupação, horários e custos aqui."
                acao={<BotaoMontarRota to="/app/rotas/nova" />}
              />
            ) : (
              <>
                {dados.rotas.map((r) => {
                  const km = distanciaRotaKm(r);
                  const Ico = IconeTurno(r);
                  return (
                    <Link key={r.id} to={`/app/rotas/${r.id}`} className="block">
                      <Card className="vm-press relative flex items-center gap-3 overflow-hidden p-4 pl-5">
                        {/* Acento lateral verde */}
                        <span className="absolute inset-y-3 left-0 w-1.5 rounded-full bg-gradient-to-b from-mint-400 to-mint-600" />
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-600">
                          <Ico className="h-6 w-6" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-[15px] font-extrabold leading-tight text-navy-900">{r.nome}</p>
                          <p className="mt-0.5 truncate text-xs text-navy-500">{trajeto(r)}</p>
                          <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] font-medium text-navy-600">
                            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-navy-400" /> {r.passageiros.length}</span>
                            <span className="inline-flex items-center gap-1"><Navigation className="h-3.5 w-3.5 text-navy-400" /> {km.toFixed(1).replace('.', ',')} km</span>
                            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-navy-400" /> {horario(r)}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-navy-300" />
                      </Card>
                    </Link>
                  );
                })}

                <BotaoMontarRota to="/app/rotas/nova" />
              </>
            )}

            {/* Simule uma nova rota */}
            <Link to="/app/oportunidades" className="block">
              <Card className="vm-press flex items-center gap-3 p-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-mint-50 text-mint-600">
                  <MapPinned className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[15px] font-bold text-navy-900">Simule uma nova rota</p>
                  <p className="mt-0.5 text-xs leading-snug text-navy-500">Veja o impacto no tempo, no combustível e na ocupação.</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-navy-300" />
              </Card>
            </Link>
          </div>
        ) : (
          <div className="mt-6">
            <EstadoVazio
              icon={MapPinned}
              titulo="Nenhuma simulação salva"
              texto="Simule um encaixe em Oportunidades para ver o impacto na sua rota — nada é gravado até você confirmar."
              acao={
                <Link to="/app/oportunidades" className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-mint-500 font-semibold text-white shadow-float active:scale-[0.98]">
                  Abrir Oportunidades <ChevronRight className="h-5 w-5" />
                </Link>
              }
            />
          </div>
        )}
      </div>
    </VMShell>
  );
}

/** Botão principal "Montar nova rota" (pílula verde com + em círculo). */
function BotaoMontarRota({ to }: { to: string }) {
  return (
    <Link to={to}
      className="flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-mint-500 font-display text-base font-bold text-white shadow-float transition active:scale-[0.98]">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-white/25"><Plus className="h-4 w-4" strokeWidth={2.6} /></span>
      Montar nova rota
    </Link>
  );
}

/* ========================== TELA 2 — Detalhes da Rota ========================== */
export function RotaDetalhePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { dados, recarregar } = useDadosMotorista();
  const rota = dados.rotas.find((r) => r.id === id) ?? dados.rotas[0];
  const [todas, setTodas] = useState(false);
  const [mapaGrande, setMapaGrande] = useState(false);
  const [publicando, setPublicando] = useState(false);

  async function alternarPublicacao() {
    if (!rota) return;
    setPublicando(true);
    try {
      await publicarRota(rota.id, !rota.isPublished);
      recarregar();
    } finally {
      setPublicando(false);
    }
  }

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
  const Ico = IconeTurno(rota);
  const lista = todas ? paradasVisiveis : paradasVisiveis.slice(0, 4);
  let acc = 6 * 60 + 25;

  return (
    <VMShell nav={false}>
      <SubHeader titulo="Detalhes da Rota" onVoltar={() => navigate('/app/rotas')}
        acao={<button onClick={() => navigate(`/painel/rota/${rota.id}`)} className="grid h-8 w-8 place-items-center rounded-full bg-white/20" aria-label="Editar rota"><Path size={17} weight="bold" /></button>} />

      <div className="space-y-3.5 px-4 pb-10 pt-4">
        {dados.demo && <div className="flex justify-end"><DemoChip /></div>}

        {/* Resumo da rota em destaque */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-600"><Ico className="h-6 w-6" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[17px] font-extrabold leading-tight text-navy-900">{rota.nome}</p>
              <p className="mt-0.5 truncate text-xs text-navy-500">{trajeto(rota)}</p>
            </div>
            <span className="shrink-0 rounded-full bg-mint-100 px-3 py-1 text-[11px] font-bold text-mint-700">Ativa</span>
          </div>
          <div className="mt-3 flex items-center gap-5 border-t border-navy-50 pt-3 text-sm font-semibold text-navy-700">
            <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-navy-400" /> {rota.passageiros.length}</span>
            <span className="inline-flex items-center gap-1.5"><Navigation className="h-4 w-4 text-navy-400" /> {km.toFixed(1).replace('.', ',')} km</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4 text-navy-400" /> {tempoMin(km)} min</span>
          </div>
        </Card>

        {/* Publicar na busca pública (ação explícita do motorista) */}
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display font-bold text-navy-900">Busca pública</p>
              <p className="mt-0.5 text-xs leading-snug text-navy-500">
                {rota.isPublished
                  ? 'As famílias podem encontrar esta rota e ver o horário estimado de passagem.'
                  : 'Concluir não publica. Publique para as famílias encontrarem esta rota na busca.'}
              </p>
            </div>
            <button onClick={alternarPublicacao} disabled={publicando} aria-pressed={!!rota.isPublished}
              className={cn('shrink-0 rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 disabled:opacity-60',
                rota.isPublished ? 'bg-mint-500 text-white shadow-glow' : 'bg-navy-100 text-navy-700')}>
              {publicando ? '…' : rota.isPublished ? 'Publicada ✓' : 'Publicar'}
            </button>
          </div>
        </Card>

        {/* Mapa da sua rota (card titulado) */}
        <Card className="p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="inline-flex items-center gap-2 font-display font-bold text-navy-900">
              <Navigation className="h-4 w-4 text-mint-600" /> Mapa da sua rota
            </p>
            <button onClick={() => setMapaGrande((v) => !v)} aria-label="Ampliar mapa"
              className="grid h-8 w-8 place-items-center rounded-full bg-navy-50 text-navy-500 active:scale-95">
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
          <div className={cn('overflow-hidden rounded-2xl ring-1 ring-navy-100 transition-all', mapaGrande ? 'h-96' : 'h-60')}>
            <MapaInterativoRota paradas={rota.paradas} bare />
          </div>
          <p className="mt-2 text-[11px] leading-snug text-navy-400">Fonte: OpenStreetMap / OSRM — tempos são estimativas. Endereços permanecem privados.</p>
        </Card>

        {/* Indicadores */}
        <Card className="grid grid-cols-3 divide-x divide-navy-50 p-0">
          <Indicador icon={MapPin} cor="text-mint-600" valor={String(rota.paradas.length)} rotulo="Paradas" />
          <Indicador icon={Car} cor="text-blue-600" valor={`${km.toFixed(1).replace('.', ',')} km`} rotulo="Percurso" />
          <Indicador icon={Clock} cor="text-amber-600" valor={`${tempoMin(km)} min`} rotulo="Tempo estimado" />
        </Card>

        {/* Lista de paradas */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="font-display font-bold text-navy-900">Lista de paradas ({paradasVisiveis.length})</p>
            {paradasVisiveis.length > 4 && (
              <button onClick={() => setTodas((v) => !v)} className="text-xs font-bold text-mint-700">
                {todas ? 'ver menos' : 'ver todas'}
              </button>
            )}
          </div>
          <div className="mt-2 divide-y divide-navy-50">
            {lista.map((p, i) => {
              acc += 7;
              const hhmm = minutosParaTextoHora(acc).replace(':', 'h');
              const escola = p.tipo === 'escola';
              const Marco = escola ? School : (i === 0 ? Flag : MapPin);
              return (
                <div key={p.id} className="flex items-center gap-3 py-2.5">
                  <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold',
                    escola ? 'bg-navy-900 text-white' : 'bg-mint-100 text-mint-700')}>{i + 1}</span>
                  <Marco className={cn('h-4 w-4 shrink-0', escola ? 'text-navy-700' : 'text-navy-400')} />
                  <span className="flex-1 truncate text-sm text-navy-700">{p.rotulo || (escola ? 'Escola' : 'Parada')}</span>
                  <span className="text-xs font-semibold tabular-nums text-navy-500">{hhmm}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </VMShell>
  );
}

function Indicador({ icon: Icon, cor, valor, rotulo }: { icon: typeof MapPin; cor: string; valor: string; rotulo: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-2 py-3.5 text-center">
      <Icon className={cn('h-5 w-5', cor)} />
      <span className="font-display text-base font-extrabold leading-none tabular-nums text-navy-900">{valor}</span>
      <span className="text-[11px] font-medium text-navy-500">{rotulo}</span>
    </div>
  );
}
