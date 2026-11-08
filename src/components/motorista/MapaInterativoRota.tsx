import { useEffect, useRef } from 'react';
import { Navigation } from 'lucide-react';
import type { ParadaRota } from '@/types/motorista';
import { ARACATUBA, trajetoOSRM } from '@/lib/geocode';

/* Tipos mínimos do Leaflet (carregado dinamicamente). */
type LeafletMap = { setView: (c: [number, number], z: number) => LeafletMap; remove: () => void; fitBounds: (b: unknown, o?: unknown) => void };
type LeafletNS = typeof import('leaflet');
type TrechoMapa = { minutos: number; metros: number };

/**
 * Mapa interativo da rota (OpenStreetMap + Leaflet, sem chave).
 *
 * Carrega sozinho e, a cada parada localizada, mostra os marcadores numerados
 * e desenha o TRAJETO pelas ruas (OSRM público). Quando todas as paradas estão
 * localizadas, devolve os minutos de cada trecho via `onTempos`.
 */
export function MapaInterativoRota({ paradas, onTempos, onTrechos, bare = false }: {
  paradas: ParadaRota[];
  onTempos?: (temposMin: number[]) => void;
  onTrechos?: (trechos: TrechoMapa[]) => void;
  /** Quando true, renderiza SÓ o mapa (sem card/título/notas), para encaixar em um container próprio. */
  bare?: boolean;
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

  // Paradas localizadas, em ordem, e uma assinatura das coordenadas (evita redesenhos à toa).
  const loc = [...paradas]
    .sort((a, b) => a.ordem - b.ordem)
    .filter((p): p is ParadaRota & { lat: number; lng: number } =>
      Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const assinatura = loc.map((p) => `${p.id}:${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');

  async function desenhar() {
    const desenhoAtual = ++desenhoRef.current;
    const L = LRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    if (!loc.length) { map.setView([ARACATUBA.lat, ARACATUBA.lng], 13); return; }

    const pts: [number, number][] = [];
    loc.forEach((p, i) => {
      const cor = p.tipo === 'escola' ? '#0b1f3a' : p.tipo === 'saida' ? '#f59e0b' : '#10b981';
      const icon = L.divIcon({
        className: '',
        html: `<span style="display:flex;width:26px;height:26px;align-items:center;justify-content:center;border-radius:9999px;background:${cor};color:#fff;font:700 12px sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.4);border:2px solid #fff">${i + 1}</span>`,
        iconSize: [26, 26], iconAnchor: [13, 13],
      });
      const titulo = p.tipo === 'escola' ? (p.destinoNome || 'Escola') : p.tipo === 'saida' ? 'Saída' : (p.rotulo || 'Casa');
      L.marker([p.lat, p.lng], { icon }).addTo(layer).bindPopup(`${i + 1}. ${titulo}`);
      pts.push([p.lat, p.lng]);
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
      L.marker(ultima, { icon: vanIcon, zIndexOffset: 900 }).addTo(layer as never).bindTooltip('Van neste ponto', { direction: 'top' });
    }

    if (pts.length === 1) map.setView(pts[0], 15);
    else map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 16 });
  }

  // Inicializa o mapa uma vez (import dinâmico do Leaflet + CSS).
  useEffect(() => {
    let cancelado = false;
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
      prontoRef.current = true;
      void desenhar();
    })();
    return () => {
      cancelado = true;
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
