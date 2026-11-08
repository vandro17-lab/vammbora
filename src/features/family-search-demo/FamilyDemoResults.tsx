import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Heart, Star, SlidersHorizontal, X, Play, Pause, RotateCcw,
  ShieldCheck, Check, Clock3, Ruler, Map as MapIcon, Snowflake, UserRoundCheck, RadioTower, Wrench, Baby,
  ListChecks, Users, GraduationCap, ChevronRight, ChevronDown, BadgeCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { OfertaDemo } from './engine';
import { gerarAvaliacoesDemo, type AvaliacoesDemo } from './avaliacoes-demo';
import { lerOverrides } from '@/data/motoristas-override';
import { VanIllustration } from '@/components/brand/VanIllustration';
import { Avatar } from '@/components/brand/Avatar';
import { Stars } from '@/components/ui/Stars';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { cn } from '@/lib/utils';
import ilustracaoSemResultado from '@/assets/ilustracoes/nenhum-resultado.png';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Props = { ofertas: OfertaDemo[]; carregando: boolean; erro?: string; horario: string; endereco: string; onEditar: () => void };
type Ordem = 'rapido' | 'preco' | 'vagas' | 'avaliacao';
type Aba = 'trajeto' | 'perfil' | 'avaliacoes';

// Documentação do motorista (sub-selo exibido ao abrir o perfil). Todos os
// perfis demonstrativos exibidos já passaram pela verificação documental.
const DOCUMENTOS_MOTORISTA: { nome: string; status: string }[] = [
  { nome: 'Habilitação (CNH)', status: 'OK' },
  { nome: 'Alvará de transporte escolar', status: 'OK' },
  { nome: 'Curso de condutor de veículo escolar', status: 'Autorizado' },
];
// Rótulo honesto do destaque do 1º resultado: descreve o critério de ordenação
// ativo (é, de fato, o melhor por aquele critério). Não é uma pontuação inventada.
const BADGE_ORDEM: Record<Ordem, string> = {
  rapido: 'Menor tempo a bordo',
  preco: 'Menor mensalidade',
  vagas: 'Mais vagas',
  avaliacao: 'Melhor avaliada',
};


/** Selos ilustrativos: distribuídos de forma estável por ID, sem afirmar verificação real. */
const SELOS_DEMO = [
  { nome: 'Documentação verificada', Icone: ShieldCheck, estilo: 'bg-emerald-50 text-emerald-800 ring-emerald-100' },
  { nome: 'Transporte infantil', Icone: Baby, estilo: 'bg-purple-50 text-purple-800 ring-purple-100' },
  { nome: 'Ar-condicionado', Icone: Snowflake, estilo: 'bg-sky-50 text-sky-800 ring-sky-100' },
  { nome: 'Monitor acompanhante', Icone: UserRoundCheck, estilo: 'bg-amber-50 text-amber-900 ring-amber-100' },
  { nome: 'Acompanhamento', Icone: RadioTower, estilo: 'bg-violet-50 text-violet-800 ring-violet-100' },
  { nome: 'Manutenção periódica', Icone: Wrench, estilo: 'bg-yellow-50 text-yellow-900 ring-yellow-100' },
] as const;
function selosParaOferta(o: OfertaDemo) {
  const numero = Number(o.id.replace(/\D/g, '')) || 1;
  return SELOS_DEMO.filter((_, i) => {
    if (i === 0 || i === 5) return true;
    if (i === 2) return o.recursos.includes('Ar-condicionado');
    if (i === 3) return o.recursos.includes('Monitor');
    return (numero + i) % 3 === 0;
  });
}

/** Foto do motorista (recorte circular). Volta às iniciais se a foto faltar. */
function FotoMotorista({ src, nome, className }: { src?: string; nome: string; className?: string }) {
  const [erro, setErro] = useState(false);
  if (!src || erro) return <Avatar nome={nome} className={className} />;
  return <img src={src} alt={nome} loading="lazy" draggable={false} onError={() => setErro(true)} className={cn('rounded-full bg-navy-100 object-cover', className)} />;
}

/** Foto da van. Volta à ilustração vetorial se a foto faltar (ex.: van 21–30). */
function FotoVan({ src, seed, alt, className }: { src?: string; seed: string; alt: string; className?: string }) {
  const [erro, setErro] = useState(false);
  if (!src || erro) return <VanIllustration seedKey={seed} className={className} />;
  return <img src={src} alt={alt} loading="lazy" draggable={false} onError={() => setErro(true)} className={cn('bg-navy-100 object-cover', className)} />;
}

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
  const [filtroNota, setFiltroNota] = useState<0 | 5 | 4 | 3>(0);
  const [docAberta, setDocAberta] = useState(false);

  // Aplica os ajustes do admin (nome/foto corrigidos no editor), se houver.
  const ofertasAjustadas = useMemo(() => {
    const ov = lerOverrides();
    return ofertas.map((o) => {
      const x = ov[o.slug];
      return x ? { ...o, nome: x.nome || o.nome, imagem: x.imagem || o.imagem } : o;
    });
  }, [ofertas]);

  // Avaliações demonstrativas, determinísticas e estáveis por motorista.
  const avaliacoes = useMemo(() => {
    const m: Record<string, AvaliacoesDemo> = {};
    for (const o of ofertasAjustadas) m[o.id] = gerarAvaliacoesDemo(o.id, o.nome);
    return m;
  }, [ofertasAjustadas]);

  const lista = ofertasAjustadas
    .filter((o) => !somenteVagas || o.vagas > 0)
    .sort((a, b) =>
      ordenacao === 'preco' ? a.precoMensal - b.precoMensal
        : ordenacao === 'vagas' ? b.vagas - a.vagas
          : ordenacao === 'avaliacao' ? (avaliacoes[b.id]?.media ?? 0) - (avaliacoes[a.id]?.media ?? 0)
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

  // Enquanto o modal está aberto, TRAVA a rolagem do fundo e guarda a posição.
  // Assim o pop-up abre enquadrado na tela (não "lá em cima") e, ao fechar, a
  // página volta exatamente para onde o usuário estava. Essencial no celular.
  useEffect(() => {
    if (!selecionado) return;
    const y = window.scrollY;
    const body = document.body;
    const anterior = body.style.cssText;
    body.style.position = 'fixed';
    body.style.top = `-${y}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    return () => {
      body.style.cssText = anterior;
      window.scrollTo(0, y);
    };
  }, [selecionado]);

  function abrir(o: OfertaDemo, tab: Aba) {
    setSelecionado(o); setAba(tab); setParada(0); setRodando(false); setSolicitacao(false); setModoTrajeto('mapa'); setFiltroNota(0); setDocAberta(false);
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
              <option value="avaliacao">Melhor avaliada</option>
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
          <img src={ilustracaoSemResultado} alt="" className="mx-auto mb-4 h-40 w-auto" />
          <h3 className="font-display text-lg font-bold text-navy-900">Nenhuma opção viável nesta pesquisa</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-navy-500">Confirme o endereço e o destino, ou tente outro horário. O serviço de rotas também pode estar indisponível no momento.</p>
          <button onClick={onEditar} className="btn btn-md btn-primary mt-5">Alterar pesquisa</button>
        </div>
      )}

      {/* Grade de cards (marketplace) */}
      <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {lista.map((o, i) => {
          const destaque = i === 0 && lista.length > 1 && !carregando;
          return (
            <article key={o.id} className="group flex min-w-0 flex-col overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-navy-100/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
              {/* Capa vetorial da van (segura de licença; sem depender de fotos externas) */}
              <div className="relative">
                <FotoVan src={o.vanImagem} seed={o.slug} alt={`Van de ${o.nome}`} className="h-44 w-full sm:h-48" />
                {destaque && (
                  <span className="absolute left-3 top-3 inline-flex max-w-[75%] items-center gap-1 rounded-full bg-[#FFC700] px-3 py-1 text-[11px] font-bold text-[#151515] shadow">
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

              <div className="flex flex-1 flex-col p-4 sm:p-5">
                <button onClick={() => abrir(o, 'perfil')} className="flex items-center gap-3 text-left">
                  <FotoMotorista src={o.imagem} nome={o.nome} className="h-11 w-11 text-sm" />
                  <span className="min-w-0">
                    <strong className="block truncate font-display text-navy-900">{o.nome}</strong>
                    <small className="text-navy-500">{o.modelo}</small>
                  </span>
                </button>

                {/* Avaliações demonstrativas — nota + total, abre a aba de avaliações */}
                <button onClick={() => abrir(o, 'avaliacoes')} className="mt-2.5 inline-flex w-fit items-center gap-1 rounded-lg px-1 py-0.5 -ml-1 hover:bg-navy-50" aria-label={`Ver avaliações de ${o.nome}`}>
                  <Stars media={avaliacoes[o.id]?.media ?? 0} quantidade={avaliacoes[o.id]?.total} />
                </button>

                {/* Grade de horários */}
                <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-navy-100 text-center ring-1 ring-navy-100">
                  <Metrica rotulo="Embarque" valor={o.embarque} />
                  <Metrica rotulo="Chegada" valor={o.chegada} />
                  <Metrica rotulo="A bordo" valor={`${o.duracaoMin} min`} />
                </div>

                {/* Selos de demonstração — recursos e verificações são ilustrativos. */}
                <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Características ilustrativas do serviço">
                  {selosParaOferta(o).map(({ nome, Icone, estilo }) => (
                    <span key={nome} className={cn('inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold leading-tight ring-1', estilo)}>
                      <Icone size={13} className="shrink-0" aria-hidden="true" /> {nome}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-navy-100 pt-3 text-sm">
                  <span className="text-navy-500">{o.vagas} {o.vagas === 1 ? 'vaga' : 'vagas'} · {o.paradas.length - 2} {o.paradas.length - 2 === 1 ? 'parada' : 'paradas'}</span>
                  <b className="font-display text-navy-900">R$ {o.precoMensal}<span className="text-xs font-medium text-navy-400">/mês</span></b>
                </div>

                <button onClick={() => abrir(o, 'trajeto')} className="btn btn-md btn-primary mt-4 w-full bg-[#FFC700] text-[#151515] hover:bg-[#FFD84D]">
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
                <FotoMotorista src={selecionado.imagem} nome={selecionado.nome} className="h-14 w-14 text-base" />
                <div className="min-w-0">
                  <h2 className="font-display text-2xl font-bold text-navy-900">{selecionado.nome}</h2>
                  <p className="text-sm text-navy-500">{selecionado.modelo}</p>
                  <button onClick={() => setAba('avaliacoes')} className="mt-1 inline-flex items-center rounded-lg -ml-1 px-1 hover:bg-navy-50">
                    <Stars media={avaliacoes[selecionado.id]?.media ?? 0} quantidade={avaliacoes[selecionado.id]?.total} />
                  </button>
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
                      <FotoVan src={selecionado.vanImagem} seed={selecionado.slug} alt={`Van de ${selecionado.nome}`} className="h-56 w-full" />
                    </button>
                    <FotoMotorista src={selecionado.imagem} nome={selecionado.nome} className="absolute -bottom-6 left-5 h-20 w-20 text-lg ring-4 ring-white" />
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
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-mint-700 ring-1 ring-navy-100"><ShieldCheck size={16} /></span>
                      <div className="min-w-0 flex-1">
                        <dt className="text-xs text-navy-500">Selos</dt>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {selecionado.recursos.map((r) => {
                            const ico = RECURSO_SVG[r];
                            if (r === 'Documentação') {
                              return (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => setDocAberta((v) => !v)}
                                  aria-expanded={docAberta}
                                  className={cn('chip ring-1 transition-colors', docAberta ? 'bg-mint-50 text-navy-900 ring-mint-300' : 'bg-white text-navy-700 ring-navy-200 hover:ring-navy-300')}
                                >
                                  {ico && <img src={ico} alt="" className="h-4 w-4" />} Documentação
                                  <ChevronDown size={13} className={cn('transition-transform', docAberta && 'rotate-180')} />
                                </button>
                              );
                            }
                            return (
                              <span key={r} className="chip bg-white text-navy-700 ring-1 ring-navy-200">
                                {ico ? <img src={ico} alt="" className="h-4 w-4" /> : <Check size={13} className="text-mint-700" />} {r}
                              </span>
                            );
                          })}
                        </div>
                        {docAberta && (
                          <ul className="mt-3 space-y-2 rounded-xl bg-white p-3 ring-1 ring-navy-100">
                            {DOCUMENTOS_MOTORISTA.map((d) => (
                              <li key={d.nome} className="flex items-center justify-between gap-3 text-sm">
                                <span className="inline-flex items-center gap-2 text-navy-700"><BadgeCheck size={15} className="shrink-0 text-emerald-500" /> {d.nome}</span>
                                <span className="chip shrink-0 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">{d.status}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="mt-2 text-[11px] text-navy-400">Documentação demonstrativa — confirme os dados reais com o motorista.</p>
                      </div>
                    </div>
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

              {/* TELA 5 — Avaliações (conjunto demonstrativo, claramente rotulado) */}
              {aba === 'avaliacoes' && (
                <PainelAvaliacoes av={avaliacoes[selecionado.id]} filtro={filtroNota} setFiltro={setFiltroNota} />
              )}
            </div>
          </div>

          {fotoAberta && (
            <div role="dialog" aria-label="Imagem ampliada do veículo" className="fixed inset-0 z-[1100] flex items-center justify-center bg-navy-950/90 p-5" onClick={() => setFotoAberta(false)}>
              <div className="w-full max-w-2xl overflow-hidden rounded-2xl" onClick={(e) => e.stopPropagation()}>
                <FotoVan src={selecionado.vanImagem} seed={selecionado.slug} alt={`Van de ${selecionado.nome}`} className="aspect-[5/3] w-full" />
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

/** Estrelas simples (sem número) — para comentários e para o resumo. */
function EstrelasSimples({ nota, size = 14 }: { nota: number; size?: number }) {
  const cheias = Math.round(nota);
  return (
    <span className="inline-flex" aria-label={`${nota.toFixed(1)} de 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={size} className={i < cheias ? 'fill-amber-400 text-amber-400' : 'fill-navy-100 text-navy-100'} />
      ))}
    </span>
  );
}

function PainelAvaliacoes({ av, filtro, setFiltro }: { av: AvaliacoesDemo; filtro: 0 | 5 | 4 | 3; setFiltro: (n: 0 | 5 | 4 | 3) => void }) {
  const comentarios = filtro === 0 ? av.comentarios : av.comentarios.filter((c) => c.nota === filtro);
  const filtros: Array<0 | 5 | 4 | 3> = [0, 5, 4, 3];
  return (
    <div className="mt-5">
      {/* Resumo: nota + barras por critério */}
      <div className="rounded-2xl bg-navy-50/60 p-5">
        <div className="flex items-center gap-5">
          <div className="shrink-0 text-center">
            <div className="font-display text-4xl font-extrabold leading-none text-navy-900">{av.media.toFixed(1)}</div>
            <div className="mt-1.5 flex justify-center"><EstrelasSimples nota={av.media} /></div>
            <div className="mt-1 text-xs text-navy-500">{av.total} avaliações</div>
          </div>
          <dl className="flex-1 space-y-2">
            {av.criterios.map((c) => (
              <div key={c.nome} className="flex items-center gap-3 text-sm">
                <dt className="w-24 shrink-0 text-navy-600 sm:w-28">{c.nome}</dt>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-navy-100">
                  <div className="h-full rounded-full bg-mint-400" style={{ width: `${(c.nota / 5) * 100}%` }} />
                </div>
                <dd className="w-8 text-right font-semibold tabular-nums text-navy-800">{c.nota.toFixed(1)}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-navy-400">
          <BadgeCheck size={13} /> Avaliações demonstrativas do modo de apresentação — não são depoimentos reais.
        </p>
      </div>

      {/* Filtros por estrela */}
      <div className="mt-4 flex flex-wrap gap-2">
        {filtros.map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            aria-pressed={filtro === f}
            className={cn('chip ring-1 transition-colors', filtro === f ? 'bg-navy-900 text-white ring-navy-900' : 'bg-white text-navy-600 ring-navy-200 hover:ring-navy-300')}
          >
            {f === 0 ? 'Todas' : <>{f} <Star size={12} className="fill-current" /></>}
          </button>
        ))}
      </div>

      {/* Comentários */}
      <ul className="mt-4 space-y-3">
        {comentarios.map((c, i) => (
          <li key={i} className="rounded-2xl bg-white p-4 ring-1 ring-navy-100">
            <div className="flex items-center gap-3">
              <Avatar nome={c.autor} className="h-9 w-9 text-xs" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <b className="truncate text-sm text-navy-900">{c.autor}</b>
                  <span className="shrink-0 text-xs text-navy-400">{c.quando}</span>
                </div>
                <EstrelasSimples nota={c.nota} size={13} />
              </div>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-navy-700">“{c.texto}”</p>
          </li>
        ))}
        {comentarios.length === 0 && (
          <li className="rounded-2xl bg-navy-50/60 p-6 text-center text-sm text-navy-500">Nenhum comentário com essa nota.</li>
        )}
      </ul>
    </div>
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
