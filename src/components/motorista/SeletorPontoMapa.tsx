import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { Crosshair, Loader2 } from 'lucide-react';
import { ARACATUBA, type Precisao } from '@/lib/geocode';

type LatLng = { lat: number; lng: number };

/** Cor, rótulo e raio de incerteza (m) de cada situação do ponto. */
const SITUACAO: Record<Precisao, { cor: string; rotulo: string; raio: number }> = {
  exato: { cor: '#10b981', rotulo: 'Número localizado', raio: 0 },
  ajustado: { cor: '#2563eb', rotulo: 'Ponto marcado por você', raio: 0 },
  estimado: { cor: '#0d9488', rotulo: 'Posição estimada do número', raio: 30 },
  rua: { cor: '#f59e0b', rotulo: 'Ponto na rua — arraste até a porta', raio: 60 },
  aproximado: { cor: '#f59e0b', rotulo: 'Ponto aproximado — arraste até a porta', raio: 60 },
};

/** Alfinete em gota: a PONTA marca o ponto exato (âncora na ponta). */
function iconeAlfinete(L: typeof Leaflet, cor: string) {
  return L.divIcon({
    className: '',
    html: `<svg width="34" height="44" viewBox="0 0 34 44" style="display:block;overflow:visible;filter:drop-shadow(0 3px 4px rgba(11,31,58,.35))" aria-hidden="true"><path d="M17 1.5C8.4 1.5 1.5 8.3 1.5 16.8c0 10.9 13 23.600 14.600 25.100a1.300 1.300 0 0 0 1.800 0c1.600-1.500 14.600-14.200 14.600-25.100C32.500 8.300 25.600 1.500 17 1.500z" fill="${cor}" stroke="#fff" stroke-width="2.5"/><circle cx="17" cy="16.500" r="5.500" fill="#fff"/></svg>`,
    iconSize: [34, 44],
    iconAnchor: [17, 43],
    tooltipAnchor: [0, -40],
  });
}

/**
 * MAPA DO ENDEREÇO: um alfinete ARRASTÁVEL sobre o ponto localizado.
 * Tocar no mapa ou arrastar o alfinete chama `onMover(lat, lng)`. A cor do
 * alfinete, a etiqueta e o círculo de incerteza mostram quão preciso é o ponto.
 * OpenStreetMap + Leaflet, sem chave.
 */
export function SeletorPontoMapa({ ponto, precisao, onMover, legenda, buscando = false, altura = 'h-56 sm:h-64' }: {
  ponto: LatLng | null;
  precisao?: Precisao;
  onMover: (lat: number, lng: number) => void;
  /** Endereço como o mapa reconheceu o ponto (mostrado no rodapé do mapa). */
  legenda?: string | null;
  /** Ainda procurando/refinando o ponto. */
  buscando?: boolean;
  altura?: string;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const LRef = useRef<typeof Leaflet | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const markRef = useRef<Leaflet.Marker | null>(null);
  const haloRef = useRef<Leaflet.Circle | null>(null);
  const [pronto, setPronto] = useState(false);
  const onMoverRef = useRef(onMover);
  onMoverRef.current = onMover;

  const situacao = ponto ? SITUACAO[precisao ?? 'rua'] : null;

  function colocar(lat: number, lng: number) {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    const s = SITUACAO[precisao ?? 'rua'];
    const icon = iconeAlfinete(L, s.cor);
    if (!markRef.current) {
      const m = L.marker([lat, lng], { draggable: true, icon, autoPan: true, keyboard: true, title: 'Arraste para ajustar o ponto' });
      m.on('dragstart', () => { haloRef.current?.remove(); haloRef.current = null; });
      m.on('dragend', () => { const ll = m.getLatLng(); onMoverRef.current(ll.lat, ll.lng); });
      m.addTo(map);
      markRef.current = m;
    } else {
      markRef.current.setLatLng([lat, lng]);
      markRef.current.setIcon(icon);
    }
    // Círculo de incerteza: só quando o ponto não é o do imóvel.
    haloRef.current?.remove();
    haloRef.current = s.raio
      ? L.circle([lat, lng], { radius: s.raio, color: s.cor, weight: 1.5, opacity: 0.7, fillColor: s.cor, fillOpacity: 0.12, interactive: false }).addTo(map)
      : null;
  }

  // Inicializa o mapa uma vez.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const mod = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      const L = ((mod as unknown as { default?: typeof Leaflet }).default ?? mod) as typeof Leaflet;
      if (cancelado || !elRef.current || mapRef.current) return;
      LRef.current = L;
      const centro: [number, number] = ponto ? [ponto.lat, ponto.lng] : [ARACATUBA.lat, ARACATUBA.lng];
      const map = L.map(elRef.current, {
        scrollWheelZoom: false, zoomControl: false, attributionControl: false,
        zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false,
      }).setView(centro, ponto ? 17 : 13);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.control.attribution({ prefix: false, position: 'bottomleft' }).addTo(map);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
      map.on('click', (e: Leaflet.LeafletMouseEvent) => onMoverRef.current(e.latlng.lat, e.latlng.lng));
      mapRef.current = map;
      if (ponto) colocar(ponto.lat, ponto.lng);
      setPronto(true);
    })();
    return () => {
      cancelado = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markRef.current = null; haloRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atualiza o alfinete quando o ponto/precisão mudam de fora (ex.: geocodificação).
  // Não recentraliza quando o próprio arraste já posicionou o marcador ali.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!ponto) {
      // Texto mudou e o ponto antigo deixou de valer: tira o alfinete.
      markRef.current?.remove(); markRef.current = null;
      haloRef.current?.remove(); haloRef.current = null;
      return;
    }
    const m = markRef.current;
    const jaNoLugar = !!m && Math.abs(m.getLatLng().lat - ponto.lat) < 1e-6 && Math.abs(m.getLatLng().lng - ponto.lng) < 1e-6;
    colocar(ponto.lat, ponto.lng);
    if (!jaNoLugar) map.setView([ponto.lat, ponto.lng], Math.max(map.getZoom(), 17));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ponto?.lat, ponto?.lng, precisao, pronto]);

  const etiqueta = buscando ? 'Procurando no mapa…' : situacao ? situacao.rotulo : 'Toque no mapa para marcar o ponto';

  return (
    <div>
    {/* `isolate`: as camadas do mapa não passam por cima da lista de sugestões. */}
    <div className={`relative isolate w-full ${altura} overflow-hidden rounded-2xl bg-navy-50 shadow-sm ring-1 ring-navy-200`} data-testid="mapa-endereco">
      <div ref={elRef} className="h-full w-full" />

      <div className="pointer-events-none absolute left-2.5 top-2.5 z-[1000] flex max-w-[calc(100%-4.5rem)] items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-navy-800 shadow-md" role="status" data-testid="mapa-situacao">
        {buscando
          ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-navy-400" />
          : <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: situacao?.cor ?? '#94a3b8' }} />}
        <span className="truncate">{etiqueta}</span>
      </div>

      {ponto && (
        <button
          type="button" aria-label="Centralizar no alfinete" title="Centralizar no alfinete"
          onClick={() => mapRef.current?.setView([ponto.lat, ponto.lng], 17)}
          className="absolute right-2.5 top-2.5 z-[1000] flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-navy-700 shadow-md hover:text-mint-700"
        >
          <Crosshair className="h-4 w-4" />
        </button>
      )}

    </div>
    <p className="mt-1.5 text-xs text-navy-500">
      {ponto
        ? <>{legenda && <span className="font-medium text-navy-700">{legenda} · </span>}Arraste o alfinete ou toque no mapa para ajustar.</>
        : 'Toque no mapa no local do endereço para marcar o ponto.'}
    </p>
    </div>
  );
}
