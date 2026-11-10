import { useEffect, useRef } from 'react';
import type * as Leaflet from 'leaflet';
import type { ParadaRota } from '@/types/motorista';
import { recorte, type Guia, type LatLng } from '@/lib/navegacao';

/* Desenhos dos marcadores (SVG embutido: o mapa não renderiza componentes React). */
const SVG = {
  casa: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/></svg>',
  escola: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v5"/><path d="M12 3.5l4 1.3-4 1.4"/><path d="M4 20V11l8-4 8 4v9"/><path d="M2.5 20h19"/><path d="M10 20v-4.5h4V20"/><path d="M7.5 13.5h.01M16.5 13.5h.01"/></svg>',
  saida: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4.5h12l-2.5 4 2.5 4H5"/></svg>',
  feito: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  van: '<svg viewBox="0 0 64 40" width="58" height="36" aria-hidden="true"><ellipse cx="32" cy="36" rx="25" ry="3" fill="rgba(11,31,58,.22)"/><path d="M5 9a5 5 0 0 1 5-5h31c3 0 5.6 1.4 7.4 3.8L55 16.5l3.6 1.8A4.5 4.5 0 0 1 61 22.3V28a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V11a2 2 0 0 1 2-2z" fill="#facc15" stroke="#0b1f3a" stroke-width="2.2" stroke-linejoin="round"/><path d="M3.5 20.5h57" stroke="#0b1f3a" stroke-width="1.6"/><rect x="8" y="8.5" width="9" height="8" rx="1.6" fill="#dbeafe" stroke="#0b1f3a" stroke-width="1.6"/><rect x="20" y="8.5" width="9" height="8" rx="1.6" fill="#dbeafe" stroke="#0b1f3a" stroke-width="1.6"/><rect x="32" y="8.5" width="9" height="8" rx="1.6" fill="#dbeafe" stroke="#0b1f3a" stroke-width="1.6"/><path d="M44.5 8.5h1.3c1 0 1.9.500 2.5 1.3l4.2 6.7H44.5z" fill="#dbeafe" stroke="#0b1f3a" stroke-width="1.6" stroke-linejoin="round"/><rect x="57" y="22.5" width="4" height="3" rx="1" fill="#fff" stroke="#0b1f3a" stroke-width="1.2"/><circle cx="16" cy="31" r="5.5" fill="#0b1f3a"/><circle cx="16" cy="31" r="2.2" fill="#fff"/><circle cx="47" cy="31" r="5.5" fill="#0b1f3a"/><circle cx="47" cy="31" r="2.2" fill="#fff"/></svg>',
};
const escapar = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function iconeParada(L: typeof Leaflet, p: ParadaRota, situacao: 'feita' | 'proxima' | 'adiante') {
  const classe = `vb-parada vb-parada--${p.tipo} vb-parada--${situacao}`;
  return L.divIcon({
    className: 'vb-marcador',
    html: `<span class="${classe}">${situacao === 'feita' ? SVG.feito : SVG[p.tipo]}</span>`,
    iconSize: [40, 40], iconAnchor: [20, 20],
  });
}

function iconeVan(L: typeof Leaflet, paraOeste: boolean, descem: string[]) {
  const nomes = descem.length ? `<span class="vb-van-nomes"><b>Desce${descem.length > 1 ? 'm' : ''}</b> ${escapar(descem.join(', '))}</span>` : '';
  return L.divIcon({
    className: 'vb-marcador',
    html: `<span class="vb-van">${nomes}<span class="vb-van-desenho${paraOeste ? ' vb-van-desenho--oeste' : ''}">${SVG.van}</span></span>`,
    iconSize: [58, 36], iconAnchor: [29, 22],
  });
}

/**
 * MAPA DO GPS: trajeto (percorrido em cinza, restante em azul), paradas com
 * ícone de casa/escola, e a van escolar na posição atual — com os nomes de
 * quem desce na próxima parada em cima dela.
 */
export function MapaGPS({ guia, paradas, indiceAlvo, van, descem, seguir, onSoltar, visaoGeral }: {
  guia: Guia;
  paradas: ParadaRota[];
  /** Índice da parada para onde a van está indo (as anteriores já foram feitas). */
  indiceAlvo: number;
  van: { ponto: LatLng; rumo: number; metros: number | null };
  descem: string[];
  /** Mantém a van no centro do mapa. */
  seguir: boolean;
  /** O motorista arrastou o mapa (para de seguir). */
  onSoltar: () => void;
  /** Mostra a rota inteira (antes de iniciar e ao terminar). */
  visaoGeral: boolean;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const L_ = useRef<typeof Leaflet | null>(null);
  const mapa = useRef<Leaflet.Map | null>(null);
  const camadaParadas = useRef<Leaflet.LayerGroup | null>(null);
  const linhaFeita = useRef<Leaflet.Polyline | null>(null);
  const linhaRestante = useRef<Leaflet.Polyline | null>(null);
  const linhaBorda = useRef<Leaflet.Polyline | null>(null);
  const marcadorVan = useRef<Leaflet.Marker | null>(null);
  const onSoltarRef = useRef(onSoltar);
  onSoltarRef.current = onSoltar;
  const paraOeste = van.rumo > 180 && van.rumo < 360;
  const assinaturaDescem = descem.join('|');

  function desenharLinha() {
    const m = van.metros ?? 0;
    linhaFeita.current?.setLatLngs(recorte(guia, 0, m));
    const restante = recorte(guia, m, guia.totalM);
    linhaBorda.current?.setLatLngs(restante);
    linhaRestante.current?.setLatLngs(restante);
  }
  function desenharParadas() {
    const L = L_.current, camada = camadaParadas.current;
    if (!L || !camada) return;
    camada.clearLayers();
    paradas.forEach((p, i) => {
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return;
      const situacao = i < indiceAlvo ? 'feita' : i === indiceAlvo ? 'proxima' : 'adiante';
      L.marker([p.lat, p.lng], { icon: iconeParada(L, p, situacao), zIndexOffset: situacao === 'proxima' ? 500 : 0, keyboard: false }).addTo(camada);
    });
  }
  function enquadrar() {
    const L = L_.current;
    if (!L || !mapa.current) return;
    mapa.current.invalidateSize({ animate: false });
    if (visaoGeral) mapa.current.fitBounds(L.latLngBounds(guia.geometria), { padding: [48, 48], maxZoom: 16, animate: false });
    else if (seguir) mapa.current.setView(van.ponto, Math.max(mapa.current.getZoom(), 17), { animate: false });
  }

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const mod = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      const L = ((mod as unknown as { default?: typeof Leaflet }).default ?? mod) as typeof Leaflet;
      if (cancelado || !elRef.current || mapa.current) return;
      L_.current = L;
      const map = L.map(elRef.current, { zoomControl: false, attributionControl: false, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false });
      L.control.attribution({ prefix: false, position: 'bottomleft' }).addTo(map);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
      const traco = { lineCap: 'round', lineJoin: 'round', interactive: false } as const;
      linhaFeita.current = L.polyline([], { ...traco, color: '#94a3b8', weight: 7, opacity: 0.9 }).addTo(map);
      linhaBorda.current = L.polyline([], { ...traco, color: '#1e3a8a', weight: 11, opacity: 0.9 }).addTo(map);
      linhaRestante.current = L.polyline([], { ...traco, color: '#3b82f6', weight: 7, opacity: 1 }).addTo(map);
      camadaParadas.current = L.layerGroup().addTo(map);
      marcadorVan.current = L.marker(van.ponto, { icon: iconeVan(L, paraOeste, descem), zIndexOffset: 1000, interactive: false, keyboard: false }).addTo(map);
      map.on('dragstart', () => onSoltarRef.current());
      mapa.current = map;
      map.setView(van.ponto, 16);
      desenharLinha(); desenharParadas(); enquadrar();
    })();
    return () => { cancelado = true; mapa.current?.remove(); mapa.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(desenharParadas, [paradas, indiceAlvo]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(desenharLinha, [guia, van.metros]);
  useEffect(() => {
    marcadorVan.current?.setLatLng(van.ponto);
    if (seguir && !visaoGeral) mapa.current?.setView(van.ponto, mapa.current.getZoom(), { animate: false });
  }, [van.ponto, seguir, visaoGeral]);
  useEffect(() => {
    if (L_.current) marcadorVan.current?.setIcon(iconeVan(L_.current, paraOeste, descem));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paraOeste, assinaturaDescem]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(enquadrar, [visaoGeral, seguir, guia]);

  return <div ref={elRef} className="h-full w-full bg-navy-100" aria-label="Mapa da navegação com a van e as paradas" data-testid="mapa-gps" />;
}
