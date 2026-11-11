import { useEffect, useRef } from 'react';
import { Navigation } from 'lucide-react';
import type { ParadaRota } from '@/types/motorista';
import { ARACATUBA, trajetoOSRM } from '@/lib/geocode';

/* Tipos mínimos do Leaflet (carregado dinamicamente). */
type LeafletMap = {
  setView: (c: [number, number], z: number) => LeafletMap; remove: () => void; fitBounds: (b: unknown, o?: unknown) => void;
  getZoom: () => number; invalidateSize: () => void; on: (e: string, f: (ev: { latlng: { lat: number; lng: number } }) => void) => void;
};
type MarcadorRascunho = { setLatLng: (c: [number, number]) => void; getLatLng: () => { lat: number; lng: number }; setIcon: (i: unknown) => void; remove: () => void; on: (e: string, f: () => void) => void; addTo: (m: unknown) => MarcadorRascunho };

/** Ponto da parada que está sendo cadastrada/corrigida agora (ainda não confirmada). */
export interface RascunhoNoMapa { lat: number; lng: number; tipo: 'saida' | 'casa' | 'escola' }

/* Identidade VanBora nos marcadores: aluno em amarelo, escola e saída em preto. */
const AMARELO = '#FFC700', PRETO = '#111111';
const GLIFO = {
  saida: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
  escola: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c2 2 10 2 12 0v-4.500"/></svg>',
};
const escapar = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
type LeafletNS = typeof import('leaflet');
type TrechoMapa = { minutos: number; metros: number };

/**
 * Mapa interativo da rota (OpenStreetMap + Leaflet, sem chave).
 *
 * Carrega sozinho e, a cada parada localizada, mostra os marcadores numerados
 * e desenha o TRAJETO pelas ruas (OSRM público). Quando todas as paradas estão
 * localizadas, devolve os minutos de cada trecho via `onTempos`.
 */
export function MapaInterativoRota({ paradas, onTempos, onTrechos, bare = false, rotulos, rascunho = null, onMoverRascunho, ocultarId = null, onTocarParada }: {
  paradas: ParadaRota[];
  onTempos?: (temposMin: number[]) => void;
  onTrechos?: (trechos: TrechoMapa[]) => void;
  /** Quando true, renderiza SÓ o mapa (sem card/título/notas), para encaixar em um container próprio. */
  bare?: boolean;
  /** Nome curto mostrado ao lado do marcador (id da parada -> texto). PRIVADO: só no app do motorista. */
  rotulos?: Record<string, string>;
  /** Alfinete da parada em cadastro: aparece em destaque e pode ser arrastado. */
  rascunho?: RascunhoNoMapa | null;
  /** Arrastar o alfinete (ou tocar no mapa) informa o ponto corrigido. */
  onMoverRascunho?: (lat: number, lng: number) => void;
  /** Parada em edição: o marcador fixo dela some, para o alfinete ocupar o lugar. */
  ocultarId?: string | null;
  /** Tocar num marcador confirmado. */
  onTocarParada?: (paradaId: string) => void;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const LRef = useRef<LeafletNS | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<ReturnType<LeafletNS['layerGroup']> | null>(null);
  const prontoRef = useRef(false);
  const desenhoRef = useRef(0);
  const onTemposRef = useRef(onTempos);
  onTemposRef.current = onTempos;
  const onTrechosRef = useRef(onTrechos);
  onTrechosRef.current = onTrechos;
  const onMoverRef = useRef(onMoverRascunho);
  onMoverRef.current = onMoverRascunho;
  const onTocarRef = useRef(onTocarParada);
  onTocarRef.current = onTocarParada;
  const rascunhoRef = useRef(rascunho);
  rascunhoRef.current = rascunho;
  const pinoRef = useRef<MarcadorRascunho | null>(null);
  const ptsRef = useRef<[number, number][]>([]);
  // Sem ponto ainda, mas com cadastro aberto: tocar no mapa marca o ponto.
  const marcandoRef = useRef(false);
  marcandoRef.current = !!onMoverRascunho;

  // Paradas localizadas, em ordem, e uma assinatura das coordenadas (evita redesenhos à toa).
  const loc = [...paradas]
    .sort((a, b) => a.ordem - b.ordem)
    .filter((p): p is ParadaRota & { lat: number; lng: number } =>
      Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const assinatura = loc.map((p) => `${p.id}:${p.lat.toFixed(5)},${p.lng.toFixed(5)}:${rotulos?.[p.id] ?? ''}`).join('|') + `#${ocultarId ?? ''}`;

  /** Enquadra o percurso inteiro (ou a cidade, se ainda não há paradas). */
  function enquadrar() {
    const L = LRef.current, map = mapRef.current, pts = ptsRef.current;
    if (!L || !map) return;
    if (!pts.length) map.setView([ARACATUBA.lat, ARACATUBA.lng], 13);
    else if (pts.length === 1) map.setView(pts[0], 15);
    else map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 16 });
  }

  async function desenhar() {
    const desenhoAtual = ++desenhoRef.current;
    const L = LRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    ptsRef.current = loc.map((p) => [p.lat, p.lng]);
    if (!loc.length) { if (!rascunhoRef.current) enquadrar(); return; }

    const pts: [number, number][] = [];
    // A saída não conta como parada: as paradas são numeradas a partir de 1.
    let numero = 0;
    loc.forEach((p) => {
      const n = p.tipo === 'saida' ? 0 : ++numero;
      pts.push([p.lat, p.lng]);
      if (p.id === ocultarId) return; // em edição: o alfinete arrastável ocupa o lugar
      const escola = p.tipo === 'escola', saida = p.tipo === 'saida';
      const conteudo = saida ? GLIFO.saida : escola ? GLIFO.escola : String(n);
      const icon = L.divIcon({
        className: '',
        html: `<span style="display:flex;width:30px;height:30px;align-items:center;justify-content:center;border-radius:${escola ? '9px' : '9999px'};background:${escola || saida ? PRETO : AMARELO};color:${escola || saida ? AMARELO : PRETO};font:800 13px Inter,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.4);border:2.5px solid #fff">${conteudo}</span>`,
        iconSize: [30, 30], iconAnchor: [15, 15],
      });
      const titulo = escola ? (p.destinoNome || 'Escola') : saida ? 'Saída da van' : (p.rotulo || 'Casa');
      const nome = rotulos?.[p.id];
      const m = L.marker([p.lat, p.lng], { icon }).addTo(layer).bindPopup(`${n ? `${n}. ` : ''}${escapar(nome ? `${nome} — ${titulo}` : titulo)}`);
      if (nome) m.bindTooltip(escapar(nome), { permanent: true, direction: 'right', offset: [14, 0], className: 'vambora-stop-name' });
      if (onTocarRef.current) m.on('click', () => onTocarRef.current?.(p.id));
    });

    let linha: [number, number][] = pts;
    let trechos: TrechoMapa[] = loc.slice(0, -1).map(() => ({ minutos: 0, metros: 0 }));
    if (loc.length >= 2) {
      const tr = await trajetoOSRM(loc.map((p) => ({ lat: p.lat, lng: p.lng })));
      if (desenhoAtual !== desenhoRef.current) return;
      if (tr && tr.geometria.length) {
        linha = tr.geometria;
        trechos = loc.slice(0, -1).map((_, i) => ({ minutos: tr.temposMin[i] ?? 0, metros: tr.distanciasMetros[i] ?? 0 }));
        if (onTemposRef.current && tr.temposMin.length === loc.length - 1) onTemposRef.current(tr.temposMin);
        onTrechosRef.current?.(trechos);
      }
    }
    if (linha.length >= 2) {
      const cores = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#0f766e'];
      const indiceMaisProximo = (p: [number, number]) => linha.reduce((best, atual, i) => {
        const db = (linha[best][0] - p[0]) ** 2 + (linha[best][1] - p[1]) ** 2;
        const da = (atual[0] - p[0]) ** 2 + (atual[1] - p[1]) ** 2;
        return da < db ? i : best;
      }, 0);
      for (let i = 0; i < pts.length - 1; i += 1) {
        const inicio = indiceMaisProximo(pts[i]);
        const fim = Math.max(inicio + 1, indiceMaisProximo(pts[i + 1]));
        const parte = linha.slice(inicio, fim + 1);
        if (parte.length >= 2) L.polyline(parte, { color: cores[i % cores.length], weight: 6, opacity: 0.22, lineCap: 'round', lineJoin: 'round' }).addTo(layer);
        if (parte.length >= 2) L.polyline(parte, { color: cores[i % cores.length], weight: 4, opacity: 0.92, lineCap: 'round', lineJoin: 'round' }).addTo(layer);
        const meio = parte[Math.floor(parte.length / 2)] ?? pts[i];
        const trecho = trechos[i];
        const km = trecho.metros >= 1000 ? `${(trecho.metros / 1000).toFixed(1).replace('.', ',')} km` : `${trecho.metros} m`;
        const etiqueta = L.divIcon({ className: 'vambora-route-label-wrap', html: `<span class="vambora-route-label"><span>◷</span> ${trecho.minutos || '—'} min · ${km}</span>`, iconSize: [1, 1], iconAnchor: [0, 0] });
        L.marker(meio, { icon: etiqueta, interactive: false }).addTo(layer as never);
      }
    }

    const ultima = pts[pts.length - 1];
    if (ultima) {
      const vanIcon = L.divIcon({ className: 'vambora-van-icon-wrap', html: '<span class="vambora-van-icon"><i></i><b></b><b></b></span>', iconSize: [42, 42], iconAnchor: [21, 21] });
      // Só ilustra onde a van está: não captura toques (tocar ali marca/abre a parada).
      L.marker(ultima, { icon: vanIcon, zIndexOffset: 900, interactive: false }).addTo(layer as never);
    }

    // Com uma parada em cadastro, o foco fica nela; senão, no percurso inteiro.
    if (!rascunhoRef.current) enquadrar();
  }

  /** Alfinete arrastável da parada em cadastro (fora da camada que é redesenhada). */
  function atualizarPino() {
    const L = LRef.current, map = mapRef.current, r = rascunhoRef.current;
    if (!L || !map) return;
    if (!r) {
      if (pinoRef.current) { pinoRef.current.remove(); pinoRef.current = null; enquadrar(); }
      return;
    }
    const cor = r.tipo === 'casa' ? AMARELO : PRETO, miolo = r.tipo === 'casa' ? PRETO : AMARELO;
    const icon = L.divIcon({
      className: '',
      html: `<svg width="40" height="52" viewBox="0 0 34 44" style="display:block;overflow:visible;filter:drop-shadow(0 3px 5px rgba(0,0,0,.45))" aria-hidden="true"><path d="M17 1.5C8.4 1.5 1.5 8.3 1.5 16.8c0 10.9 13 23.600 14.600 25.100a1.300 1.300 0 0 0 1.800 0c1.600-1.500 14.600-14.200 14.600-25.100C32.500 8.300 25.600 1.500 17 1.500z" fill="${cor}" stroke="#fff" stroke-width="2.5"/><circle cx="17" cy="16.500" r="5.500" fill="${miolo}"/></svg>`,
      iconSize: [40, 52], iconAnchor: [20, 51],
    });
    const p = pinoRef.current;
    const jaNoLugar = !!p && Math.abs(p.getLatLng().lat - r.lat) < 1e-6 && Math.abs(p.getLatLng().lng - r.lng) < 1e-6;
    if (!p) {
      const m = L.marker([r.lat, r.lng], { draggable: !!onMoverRef.current, icon, autoPan: true, zIndexOffset: 1200, title: 'Arraste para ajustar o ponto' }) as unknown as MarcadorRascunho;
      m.on('dragend', () => { const ll = m.getLatLng(); onMoverRef.current?.(ll.lat, ll.lng); });
      m.addTo(map);
      pinoRef.current = m;
    } else {
      p.setLatLng([r.lat, r.lng]);
      p.setIcon(icon);
    }
    if (!jaNoLugar) map.setView([r.lat, r.lng], Math.max(map.getZoom(), 16));
  }

  // Inicializa o mapa uma vez (import dinâmico do Leaflet + CSS).
  useEffect(() => {
    let cancelado = false;
    let observador: ResizeObserver | null = null;
    (async () => {
      const mod = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      const L = ((mod as unknown as { default?: LeafletNS }).default ?? mod) as LeafletNS;
      if (cancelado || !elRef.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(elRef.current, { scrollWheelZoom: false }).setView([ARACATUBA.lat, ARACATUBA.lng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© OpenStreetMap',
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map as unknown as LeafletMap;
      // Tocar no mapa marca/corrige o ponto da parada em cadastro.
      mapRef.current.on('click', (e) => { if (rascunhoRef.current || marcandoRef.current) onMoverRef.current?.(e.latlng.lat, e.latlng.lng); });
      // O mapa muda de tamanho (teclado do celular, painéis): mantém os blocos certos.
      if (typeof ResizeObserver !== 'undefined') {
        observador = new ResizeObserver(() => mapRef.current?.invalidateSize());
        observador.observe(elRef.current);
      }
      prontoRef.current = true;
      void desenhar();
      atualizarPino();
    })();
    return () => {
      cancelado = true;
      observador?.disconnect();
      pinoRef.current = null;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      prontoRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redesenha quando as coordenadas das paradas mudam.
  useEffect(() => {
    if (prontoRef.current) void desenhar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura]);

  // Alfinete da parada em cadastro: acompanha o ponto e o tipo.
  useEffect(() => {
    if (prontoRef.current) atualizarPino();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rascunho?.lat, rascunho?.lng, rascunho?.tipo, !rascunho]);

  // Modo "bare": só o mapa (o container pai define moldura, cantos e altura).
  if (bare) {
    return <div ref={elRef} className="h-full w-full bg-navy-50" aria-label="Mapa da rota" />;
  }

  return (
    <section className="card mt-4 p-5" aria-label="Mapa da rota">
      <div className="flex items-center gap-2">
        <Navigation className="h-5 w-5 text-mint-600" />
        <h2 className="font-display text-lg font-bold">Mapa da sua rota</h2>
      </div>
      <p className="mt-2 text-sm text-navy-600">
        O trajeto aparece pelas ruas conforme você adiciona as paradas.
      </p>
      <div ref={elRef} className="mt-3 h-72 w-full overflow-hidden rounded-xl border border-navy-200 bg-navy-50" />
      <p className="mt-2 text-xs text-navy-500">
        <strong>{loc.length} de {paradas.length}</strong> paradas no mapa. Fonte: OpenStreetMap / OSRM — tempos são
        estimativas, sem garantia de trânsito. Os endereços permanecem privados no cadastro.
      </p>
    </section>
  );
}
