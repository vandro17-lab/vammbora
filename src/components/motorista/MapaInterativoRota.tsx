import { useEffect, useRef } from 'react';
import { Navigation } from 'lucide-react';
import type { ParadaRota } from '@/types/motorista';
import { ARACATUBA, trajetoOSRM } from '@/lib/geocode';

/* Tipos mínimos do Leaflet (carregado dinamicamente). */
type LeafletMap = { setView: (c: [number, number], z: number) => LeafletMap; remove: () => void; fitBounds: (b: unknown, o?: unknown) => void };
type LeafletNS = typeof import('leaflet');

/**
 * Mapa interativo da rota (OpenStreetMap + Leaflet, sem chave).
 *
 * Carrega sozinho e, a cada parada localizada, mostra os marcadores numerados
 * e desenha o TRAJETO pelas ruas (OSRM público). Quando todas as paradas estão
 * localizadas, devolve os minutos de cada trecho via `onTempos`.
 */
export function MapaInterativoRota({ paradas, onTempos, bare = false, destacarParadaId = null }: {
  paradas: ParadaRota[];
  onTempos?: (temposMin: number[]) => void;
  /** Quando true, renderiza SÓ o mapa (sem card/título/notas), para encaixar em um container próprio. */
  bare?: boolean;
  /** Id da parada em foco: recebe um marcador maior com anel (coordena van ↔ mapa). */
  destacarParadaId?: string | null;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const LRef = useRef<LeafletNS | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<ReturnType<LeafletNS['layerGroup']> | null>(null);
  const prontoRef = useRef(false);
  const onTemposRef = useRef(onTempos);
  onTemposRef.current = onTempos;

  // Paradas localizadas, em ordem, e uma assinatura das coordenadas (evita redesenhos à toa).
  const loc = [...paradas]
    .sort((a, b) => a.ordem - b.ordem)
    .filter((p): p is ParadaRota & { lat: number; lng: number } =>
      Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const assinatura = loc.map((p) => `${p.id}:${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');

  async function desenhar() {
    const L = LRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    if (!loc.length) { map.setView([ARACATUBA.lat, ARACATUBA.lng], 13); return; }

    // Numeração alinhada à lista do percurso e à van: posição na ORDEM completa
    // (saída = 0), não 1..N só das paradas localizadas — mantém o mesmo número
    // para a mesma parada nos três lugares.
    const ordenadas = [...paradas].sort((a, b) => a.ordem - b.ordem);
    const pts: [number, number][] = [];
    loc.forEach((p) => {
      const n = Math.max(0, ordenadas.findIndex((x) => x.id === p.id));
      const cor = p.tipo === 'escola' ? '#0b1f3a' : p.tipo === 'saida' ? '#f59e0b' : '#10b981';
      const foco = p.id === destacarParadaId;
      const tam = foco ? 34 : 26;
      const anel = foco ? 'box-shadow:0 0 0 4px rgba(16,185,129,.35),0 1px 6px rgba(0,0,0,.5);border:3px solid #fff' : 'box-shadow:0 1px 4px rgba(0,0,0,.4);border:2px solid #fff';
      const icon = L.divIcon({
        className: '',
        html: `<span style="display:flex;width:${tam}px;height:${tam}px;align-items:center;justify-content:center;border-radius:9999px;background:${cor};color:#fff;font:700 ${foco ? 14 : 12}px sans-serif;${anel}">${n}</span>`,
        iconSize: [tam, tam], iconAnchor: [tam / 2, tam / 2],
      });
      const titulo = p.tipo === 'escola' ? (p.destinoNome || 'Escola') : p.tipo === 'saida' ? 'Saída' : (p.rotulo || 'Casa');
      const marcador = L.marker([p.lat, p.lng], { icon, zIndexOffset: foco ? 1000 : 0 }).addTo(layer).bindPopup(`${n}. ${titulo}`);
      if (foco) marcador.openPopup();
      pts.push([p.lat, p.lng]);
    });

    let linha: [number, number][] = pts;
    if (loc.length >= 2) {
      const tr = await trajetoOSRM(loc.map((p) => ({ lat: p.lat, lng: p.lng })));
      if (tr && tr.geometria.length) {
        linha = tr.geometria;
        if (onTemposRef.current && tr.temposMin.length === loc.length - 1) onTemposRef.current(tr.temposMin);
      }
    }
    if (linha.length >= 2) L.polyline(linha, { color: '#10b981', weight: 4, opacity: 0.85 }).addTo(layer);

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

  // Redesenha quando as coordenadas das paradas ou a parada em foco mudam.
  useEffect(() => {
    if (prontoRef.current) void desenhar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, destacarParadaId]);

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
