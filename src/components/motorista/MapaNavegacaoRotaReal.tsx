import { useEffect, useMemo, useRef } from 'react';
import type { ParadaRota } from '@/types/motorista';
import type { TrajetoRota } from '@/lib/geocode';

type LeafletMap = {
  fitBounds: (bounds: unknown, options?: unknown) => void;
  remove: () => void;
};
type LeafletLayer = { addTo: (map: unknown) => LeafletLayer; clearLayers?: () => void };
type LeafletNS = typeof import('leaflet');

function pontoNaGeometria(geometria: [number, number][], progresso: number): [number, number] {
  if (!geometria.length) return [0, 0];
  if (geometria.length === 1) return geometria[0];
  const p = Math.max(0, Math.min(1, progresso));
  const pos = p * (geometria.length - 1);
  const i = Math.min(geometria.length - 2, Math.floor(pos));
  const t = pos - i;
  return [
    geometria[i][0] + (geometria[i + 1][0] - geometria[i][0]) * t,
    geometria[i][1] + (geometria[i + 1][1] - geometria[i][1]) * t,
  ];
}

function vanIcon(L: LeafletNS) {
  return L.divIcon({
    className: 'vambora-van-icon-wrap',
    html: '<span class="vambora-van-icon" aria-hidden="true"><i></i><b></b><b></b></span>',
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  });
}

export function MapaNavegacaoRotaReal({
  paradas,
  trajeto,
  progresso,
  seguindo,
}: {
  paradas: ParadaRota[];
  trajeto: TrajetoRota;
  progresso: number;
  seguindo: boolean;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletNS | null>(null);
  const vanRef = useRef<{ setLatLng: (p: [number, number]) => void } | null>(null);
  const rotaLayerRef = useRef<LeafletLayer | null>(null);
  const assinatura = useMemo(() => trajeto.geometria.map(([lat, lng]) => `${lat.toFixed(6)},${lng.toFixed(6)}`).join('|'), [trajeto.geometria]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const mod = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      const L = ((mod as unknown as { default?: LeafletNS }).default ?? mod) as LeafletNS;
      if (cancelado || !elRef.current) return;
      leafletRef.current = L;
      const map = L.map(elRef.current, { zoomControl: false, attributionControl: true }) as unknown as LeafletMap;
      L.control.zoom({ position: 'bottomright' }).addTo(map as never);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(map as never);
      mapaRef.current = map;
      const layer = L.layerGroup().addTo(map as never) as unknown as LeafletLayer;
      rotaLayerRef.current = layer;
      if (!cancelado) desenhar(L, map, layer);
    })();
    return () => {
      cancelado = true;
      mapaRef.current?.remove();
      mapaRef.current = null;
      vanRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function desenhar(L: LeafletNS, map: LeafletMap, layer: LeafletLayer) {
    layer.clearLayers?.();
    const pontos = trajeto.geometria;
    if (pontos.length >= 2) {
      L.polyline(pontos, { color: '#2563eb', weight: 8, opacity: 0.2, lineCap: 'round', lineJoin: 'round' }).addTo(layer as never);
      L.polyline(pontos, { color: '#2563eb', weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(layer as never);
    }
    const paradasValidas = paradas.filter((p): p is ParadaRota & { lat: number; lng: number } => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    paradasValidas.forEach((p, i) => {
      const cor = p.tipo === 'escola' ? '#0b1f3a' : p.tipo === 'saida' ? '#facc15' : '#10b981';
      const icon = L.divIcon({
        className: 'vambora-stop-icon-wrap',
        html: `<span class="vambora-stop-icon" style="--stop-color:${cor}">${i + 1}</span>`,
        iconSize: [30, 30], iconAnchor: [15, 15],
      });
      L.marker([p.lat, p.lng], { icon }).addTo(layer as never).bindTooltip(p.tipo === 'escola' ? (p.destinoNome || 'Escola') : (p.rotulo || 'Parada'));
    });
    const van = L.marker(pontoNaGeometria(pontos, progresso), { icon: vanIcon(L), zIndexOffset: 1000 }).addTo(layer as never);
    vanRef.current = van as unknown as { setLatLng: (p: [number, number]) => void };
    if (pontos.length >= 2) map.fitBounds(L.latLngBounds(pontos), { padding: [34, 34], maxZoom: 16 });
  }

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapaRef.current;
    const layer = rotaLayerRef.current;
    if (!L || !map || !layer || !trajeto.geometria.length) return;
    desenhar(L, map, layer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, paradas.length]);

  useEffect(() => {
    if (!vanRef.current || !trajeto.geometria.length) return;
    vanRef.current.setLatLng(pontoNaGeometria(trajeto.geometria, progresso));
  }, [progresso, seguindo, trajeto.geometria]);

  return <div ref={elRef} className="h-full w-full bg-navy-100" aria-label="Mapa real da rota com a van em deslocamento" />;
}
