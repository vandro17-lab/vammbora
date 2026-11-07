import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Heart, Star, SlidersHorizontal, X, Play, Pause, RotateCcw,
  ShieldCheck, Snowflake, UserRound, Check, Clock3, Ruler, Map as MapIcon,
  ListChecks, Users, GraduationCap, ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { OfertaDemo } from './engine';
import { VanIllustration } from '@/components/brand/VanIllustration';
import { Avatar } from '@/components/brand/Avatar';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { cn } from '@/lib/utils';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Props = { ofertas: OfertaDemo[]; carregando: boolean; erro?: string; horario: string; endereco: string; onEditar: () => void };
type Ordem = 'rapido' | 'preco' | 'vagas';
type Aba = 'trajeto' | 'perfil' | 'avaliacoes';

// Ícones dos recursos — mapeados a partir dos valores reais do catálogo.
const RECURSO_ICONE: Record<string, LucideIcon> = {
  'Cinto de segurança': ShieldCheck,
  'Ar-condicionado': Snowflake,
  Monitor: UserRound,
};
// Rótulo honesto do destaque do 1º resultado: descreve o critério de ordenação
// ativo (é, de fato, o melhor por aquele critério). Não é uma pontuação inventada.
const BADGE_ORDEM: Record<Ordem, string> = {
  rapido: 'Menor tempo a bordo',
  preco: 'Menor mensalidade',
  vagas: 'Mais vagas',
};

export function FamilyDemoResults({ ofertas, carregando, erro, horario, endereco, onEditar }: Props) {
  const [somenteVagas, setSomenteVagas] = useState(true);
  const [ordenacao, setOrdenacao] = useState<Ordem>('rapido');
  const [selecionado, setSelecionado] = useState<OfertaDemo | null>(null);
  const [aba, setAba] = useState<Aba>('trajeto');
  const [modoTrajeto, setModoTrajeto] = useState<'mapa' | 'lista'>('mapa');
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [parada, setParada] = useState(0);
  const [rodando, setRodando] = useState(false);
  const [fotoAberta, setFotoAberta] = useState(false);
  const [solicitacao, setSolicitacao] = useState(false);

  const lista = ofertas
    .filter((o) => !somenteVagas || o.vagas > 0)
    .sort((a, b) =>
      ordenacao === 'preco' ? a.precoMensal - b.precoMensal
        : ordenacao === 'vagas' ? b.vagas - a.vagas
          : a.duracaoMin - b.duracaoMin);

  // Reprodução da posição da van ao longo das paradas (apenas ilustrativa).
  useEffect(() => {
    if (!rodando || !selecionado) return;
    const timer = window.setInterval(() => setParada((n) => {
      if (n >= selecionado.paradas.length - 1) { setRodando(false); return n; }
      return n + 1;
    }), 1800);
    return () => clearInterval(timer);
  }, [rodando, selecionado]);

  // Fecha o modal com Escape (acessibilidade).
  useEffect(() => {
    if (!selecionado) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSelecionado(null); setRodando(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selecionado]);

  function abrir(o: OfertaDemo, tab: Aba) {
    setSelecionado(o); setAba(tab); setParada(0); setRodando(false); setSolicitacao(false); setModoTrajeto('mapa');
  }
  function favoritar(id: string) {
    setFavoritos((a) => a.includes(id) ? a.filter((x) => x !== id) : [...a, id]);
  }

  return (
    <section className="mt-7">
      {/* Cabeçalho dos resultados */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-navy-900">
            {carregando ? 'Calculando trajetos pelas ruas…' : `${lista.length} ${lista.length === 1 ? 'opção encontrada' : 'opções encontradas'}`}
          </h2>
          <p className="mt-0.5 text-sm text-navy-500">
            Horário escolhido: <b className="font-semibold text-navy-700">{horario}</b>
            {endereco ? <> · {endereco}</> : null}
          </p>
        </div>
        <button type="button" onClick={onEditar} className="btn btn-sm btn-ghost">
          <SlidersHorizontal size={15} /> Editar pesquisa
        </button>
      </div>

      {erro && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">{erro}</p>}

      {/* Barra de filtros */}
      {!carregando && lista.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSomenteVagas((v) => !v)}
            aria-pressed={somenteVagas}
            className={cn('chip ring-1 transition-colors', somenteVagas ? 'bg-navy-900 text-white ring-navy-900' : 'bg-white text-navy-600 ring-navy-200 hover:ring-navy-300')}
          >
            <Check size={14} /> Só com vagas
          </button>
          <label className="chip bg-white text-navy-600 ring-1 ring-navy-200">
            <SlidersHorizontal size={14} /> Ordenar
            <select
              className="bg-transparent text-xs font-semibold text-navy-800 outline-none"
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value as Ordem)}
              aria-label="Ordenar resultados"
            >
              <option value="rapido">Menor tempo a bordo</option>
              <option value="preco">Menor mensalidade</option>
              <option value="vagas">Mais vagas</option>
            </select>
          </label>
          <DemoBadge className="ml-auto" texto="Ofertas demonstrativas" />
        </div>
      )}

      {/* Estado vazio honesto */}
      {!carregando && lista.length === 0 && !erro && (
        <div className="mt-8 rounded-3xl bg-white p-8 text-center ring-1 ring-navy-100">
          <h3 className="font-display text-lg font-bold text-navy-900">Nenhuma opção viável nesta pesquisa</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-navy-500">Confirme o endereço e o destino, ou tente outro horário. O serviço de rotas também pode estar indisponível no momento.</p>
          <button onClick={onEditar} className="btn btn-md btn-primary mt-5">Alterar pesquisa</button>
        </div>
      )}

      {/* Grade de cards (marketplace) */}
      <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {lista.map((o, i) => {
          const destaque = i === 0 && lista.length > 1 && !carregando;
          return (
            <article key={o.id} className="group flex flex-col overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-navy-100/70 transition-shadow hover:shadow-card-hover">
              {/* Capa vetorial da van (segura de licença; sem depender de fotos externas) */}
              <div className="relative">
                <VanIllustration seedKey={o.slug} className="h-40 w-full" />
                {destaque && (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-mint-400 px-3 py-1 text-xs font-bold text-navy-950 shadow">
                    <Star size={13} className="fill-navy-950" /> {BADGE_ORDEM[ordenacao]}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => favoritar(o.id)}
                  aria-pressed={favoritos.includes(o.id)}
                  aria-label={favoritos.includes(o.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 shadow ring-1 ring-navy-100 transition-transform active:scale-90"
                >
                  <Heart size={18} className={favoritos.includes(o.id) ? 'fill-rose-500 text-rose-500' : 'text-navy-500'} />
                </button>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <button onClick={() => abrir(o, 'perfil')} className="flex items-center gap-3 text-left">
                  <Avatar nome={o.nome} className="h-11 w-11 text-sm" />
                  <span className="min-w-0">
                    <strong className="block truncate font-display text-navy-900">{o.nome}</strong>
                    <small className="text-navy-500">{o.modelo}</small>
                  </span>
                </button>

                {/* Avaliações — estado honesto: ainda não há avaliações verificadas */}
                <button onClick={() => abrir(o, 'avaliacoes')} className="mt-2.5 inline-flex w-fit items-center gap-1.5 text-xs text-navy-400">
                  <Star size={14} className="text-navy-300" /> Avaliações ainda não disponíveis
                </button>

                {/* Grade de horários */}
                <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-navy-100 text-center ring-1 ring-navy-100">
                  <Metrica rotulo="Embarque" valor={o.embarque} />
                  <Metrica rotulo="Chegada" valor={o.chegada} />
                  <Metrica rotulo="A bordo" valor={`${o.duracaoMin} min`} />
                </div>

                {/* Recursos com ícones */}
                {o.recursos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {o.recursos.map((r) => {
                      const Ico = RECURSO_ICONE[r] ?? Check;
                      return (
                        <span key={r} className="chip bg-navy-50 text-navy-600">
                          <Ico size={13} className="text-mint-700" /> {r}
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-navy-100 pt-3 text-sm">
                  <span className="text-navy-500">{o.vagas} {o.vagas === 1 ? 'vaga' : 'vagas'} · {o.paradas.length - 2} {o.paradas.length - 2 === 1 ? 'parada' : 'paradas'}</span>
                  <b className="font-display text-navy-900">R$ {o.precoMensal}<span className="text-xs font-medium text-navy-400">/mês</span></b>
                </div>

                <button onClick={() => abrir(o, 'trajeto')} className="btn btn-md btn-primary mt-4 w-full">
                  Ver trajeto completo <ChevronRight size={16} />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Modal de detalhes (telas 3, 4 e 5) */}
      {selecionado && (
        <div role="dialog" aria-modal="true" aria-label={`Detalhes de ${selecionado.nome}`} className="fixed inset-0 z-[1000] overflow-y-auto bg-navy-950/60 p-3 backdrop-blur-sm sm:p-8">
          <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-white shadow-float">
            <div className="flex items-center justify-between gap-3 border-b border-navy-100 px-5 py-4 sm:px-7">
              <button className="inline-flex items-center gap-2 text-sm font-semibold text-navy-700" onClick={() => { setSelecionado(null); setRodando(false); }}>
                <ArrowLeft size={18} /> Voltar aos resultados
              </button>
              <button aria-label="Fechar" onClick={() => setSelecionado(null)} className="grid h-9 w-9 place-items-center rounded-full text-navy-500 hover:bg-navy-50"><X size={18} /></button>
            </div>

            <div className="px-5 pb-7 pt-5 sm:px-7">
              <div className="flex items-center gap-3">
                <Avatar nome={selecionado.nome} className="h-12 w-12 text-sm" />
                <div>
                  <h2 className="font-display text-2xl font-bold text-navy-900">{selecionado.nome}</h2>
                  <p className="text-sm text-navy-500">{selecionado.modelo} · perfil demonstrativo</p>
                </div>
              </div>

              {/* Abas */}
              <div className="mt-5 flex gap-2 border-b border-navy-100 pb-3" role="tablist">
                {(['trajeto', 'perfil', 'avaliacoes'] as const).map((a) => (
                  <button
                    key={a}
                    role="tab"
                    aria-selected={aba === a}
                    onClick={() => setAba(a)}
                    className={cn('rounded-full px-4 py-2 text-sm font-semibold transition-colors', aba === a ? 'bg-navy-900 text-white' : 'bg-navy-50 text-navy-600 hover:bg-navy-100')}
                  >
                    {a === 'trajeto' ? 'Trajeto' : a === 'perfil' ? 'Perfil' : 'Avaliações'}
                  </button>
                ))}
              </div>

              {/* TELA 3 — Trajeto e paradas */}
              {aba === 'trajeto' && (
                <div className="mt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex rounded-full bg-navy-50 p-1" role="tablist" aria-label="Modo de visualização do trajeto">
                      {([['mapa', 'Mapa do trajeto', MapIcon], ['lista', 'Lista de paradas', ListChecks]] as const).map(([v, label, Ico]) => (
                        <button key={v} role="tab" aria-selected={modoTrajeto === v} onClick={() => setModoTrajeto(v)} className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors', modoTrajeto === v ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-500')}>
                          <Ico size={14} /> {label}
                        </button>
                      ))}
                    </div>
                    <span className="inline-flex items-center gap-3 text-xs text-navy-500">
                      <span className="inline-flex items-center gap-1"><Ruler size={13} /> ≈ {selecionado.distanciaAproximadaKm.toFixed(1)} km</span>
                      <span className="inline-flex items-center gap-1"><Clock3 size={13} /> {selecionado.duracaoMin} min</span>
                    </span>
                  </div>

                  {modoTrajeto === 'mapa' && (
                    <div className="mt-3">
                      <MapaDemo oferta={selecionado} parada={parada} />
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-500">
                        <LegendaPonto cor="#22C55E" rotulo="Origem (embarque)" />
                        <LegendaPonto cor="#FFC400" rotulo="Parada / destino" />
                        <span>Posição da van apenas ilustrativa</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button onClick={() => setRodando((v) => !v)} className="btn btn-sm btn-primary">
                          {rodando ? <><Pause size={15} /> Pausar</> : <><Play size={15} /> Reproduzir</>}
                        </button>
                        <button onClick={() => { setRodando(false); setParada(0); }} className="btn btn-sm btn-ghost">
                          <RotateCcw size={15} /> Reiniciar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Linha do tempo das paradas (sempre útil; destaque no modo lista) */}
                  <ol className="mt-4 space-y-0.5" aria-label="Paradas do trajeto">
                    {selecionado.paradas.map((p, idx) => {
                      const primeira = idx === 0;
                      const ultima = idx === selecionado.paradas.length - 1;
                      const ativa = parada === idx;
                      return (
                        <li key={idx}>
                          <button
                            onClick={() => { setParada(idx); setRodando(false); }}
                            className={cn('flex w-full items-stretch gap-3 rounded-xl px-2 py-1.5 text-left transition-colors', ativa ? 'bg-mint-50' : 'hover:bg-navy-50')}
                          >
                            <span className="flex flex-col items-center">
                              <span className={cn('mt-1.5 h-3 w-3 shrink-0 rounded-full ring-2 ring-white', primeira ? 'bg-emerald-500' : ultima ? 'bg-mint-500' : 'bg-navy-300')} />
                              {!ultima && <span className="w-px flex-1 bg-navy-200" />}
                            </span>
                            <span className="flex flex-1 items-center justify-between gap-3 pb-2">
                              <span className="text-sm text-navy-700">{p.titulo}</span>
                              <b className="shrink-0 text-sm tabular-nums text-navy-900">{p.horario}</b>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {/* TELA 4 — Perfil do motorista */}
              {aba === 'perfil' && (
                <div className="mt-5">
                  <div className="relative">
                    <button onClick={() => setFotoAberta(true)} className="block w-full overflow-hidden rounded-2xl" aria-label="Ampliar imagem do veículo">
                      <VanIllustration seedKey={selecionado.slug} className="h-56 w-full" />
                    </button>
                    <Avatar nome={selecionado.nome} className="absolute -bottom-6 left-5 h-20 w-20 text-lg ring-4 ring-white" />
                  </div>
                  <div className="mt-8 flex items-center justify-between gap-3">
                    <div>
                      <b className="font-display text-lg text-navy-900">{selecionado.nome}</b>
                      <p className="text-sm text-navy-500">Perfil demonstrativo</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => favoritar(selecionado.id)}
                      aria-pressed={favoritos.includes(selecionado.id)}
                      aria-label={favoritos.includes(selecionado.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                      className="grid h-11 w-11 place-items-center rounded-full ring-1 ring-navy-200 transition-transform active:scale-90"
                    >
                      <Heart size={19} className={favoritos.includes(selecionado.id) ? 'fill-rose-500 text-rose-500' : 'text-navy-500'} />
                    </button>
                  </div>

                  <dl className="mt-5 space-y-3 rounded-2xl bg-navy-50/60 p-4">
                    <InfoLinha Icone={GraduationCap} rotulo="Atende" valor={`${selecionado.escola} e região`} />
                    <InfoLinha Icone={Users} rotulo="Vagas informadas" valor={`${selecionado.vagas} ${selecionado.vagas === 1 ? 'vaga' : 'vagas'}`} />
                    <InfoLinha Icone={ShieldCheck} rotulo="Recursos do veículo" valor={selecionado.recursos.join(' · ')} />
                  </dl>

                  <button onClick={() => setSolicitacao(true)} className="btn btn-md btn-primary mt-5 w-full">
                    Tenho interesse nesta van
                  </button>
                  {solicitacao && (
                    <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
                      Interesse demonstrativo registrado nesta tela. Nenhuma solicitação foi enviada ao motorista.
                    </p>
                  )}
                </div>
              )}

              {/* TELA 5 — Avaliações (estado vazio honesto) */}
              {aba === 'avaliacoes' && (
                <div className="mt-6 rounded-2xl bg-navy-50/60 p-8 text-center">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white shadow-sm ring-1 ring-navy-100">
                    <Star className="text-navy-300" />
                  </span>
                  <h3 className="mt-4 font-display font-bold text-navy-900">Ainda não há avaliações verificadas</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-navy-500">
                    Não exibimos notas nem depoimentos inventados para perfis demonstrativos. As avaliações aparecerão aqui quando houver registros reais.
                  </p>
                </div>
              )}
            </div>
          </div>

          {fotoAberta && (
            <div role="dialog" aria-label="Imagem ampliada do veículo" className="fixed inset-0 z-[1100] flex items-center justify-center bg-navy-950/90 p-5" onClick={() => setFotoAberta(false)}>
              <div className="w-full max-w-2xl overflow-hidden rounded-2xl" onClick={(e) => e.stopPropagation()}>
                <VanIllustration seedKey={selecionado.slug} className="aspect-[5/3] w-full" />
              </div>
              <button aria-label="Fechar imagem" className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white" onClick={() => setFotoAberta(false)}><X /></button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Metrica({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <span className="bg-white px-1 py-2.5">
      <b className="block font-display text-base text-navy-900 tabular-nums">{valor}</b>
      <span className="text-[11px] text-navy-500">{rotulo}</span>
    </span>
  );
}

function InfoLinha({ Icone, rotulo, valor }: { Icone: LucideIcon; rotulo: string; valor: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-mint-700 ring-1 ring-navy-100"><Icone size={16} /></span>
      <div className="min-w-0">
        <dt className="text-xs text-navy-500">{rotulo}</dt>
        <dd className="text-sm font-semibold text-navy-800">{valor || '—'}</dd>
      </div>
    </div>
  );
}

function LegendaPonto({ cor, rotulo }: { cor: string; rotulo: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: cor }} /> {rotulo}
    </span>
  );
}

function MapaDemo({ oferta, parada }: { oferta: OfertaDemo; parada: number }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.CircleMarker[]>([]);
  useEffect(() => {
    if (!el.current || !oferta.geometria) return;
    const m = L.map(el.current, { scrollWheelZoom: false });
    map.current = m;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(m);
    const line = L.polyline(oferta.geometria, { color: '#E3A900', weight: 6 }).addTo(m);
    markers.current = oferta.paradas.map((p, i) => L.circleMarker([p.ponto.lat, p.ponto.lng], {
      radius: i === 0 || i === oferta.paradas.length - 1 ? 9 : 7,
      color: '#151515', weight: 2,
      fillColor: i === 0 ? '#22C55E' : '#FFC400', fillOpacity: 1,
    }).addTo(m).bindPopup(`${p.horario} · ${p.titulo}`));
    m.fitBounds(line.getBounds(), { padding: [25, 25] });
    return () => { m.remove(); map.current = null; markers.current = []; };
  }, [oferta]);
  useEffect(() => {
    const marker = markers.current[parada];
    if (marker && map.current) { map.current.panTo(marker.getLatLng()); marker.openPopup(); }
  }, [parada, oferta]);
  return <div ref={el} className="h-[310px] w-full overflow-hidden rounded-2xl bg-navy-100" aria-label="Mapa do trajeto" />;
}
