import { useEffect, useRef } from 'react';
import { ARACATUBA, type Precisao } from '@/lib/geocode';

/* Tipos mínimos do Leaflet (carregado dinamicamente, sem chave). */
type LeafletNS = typeof import('leaflet');
type LatLng = { lat: number; lng: number };
type LMap = {
  setView: (c: [number, number], z: number) => LMap;
  remove: () => void;
  on: (ev: string, cb: (e: { latlng: LatLng }) => void) => void;
};
type LMarker = {
  on: (ev: string, cb: () => void) => void;
  addTo: (m: unknown) => LMarker;
  setLatLng: (c: [number, number]) => LMarker;
  setIcon: (i: unknown) => LMarker;
  getLatLng: () => LatLng;
  bindTooltip: (t: string, o?: unknown) => LMarker;
};

const COR: Record<Precisao, string> = {
  exato: '#10b981',     // verde — número localizado
  ajustado: '#2563eb',  // azul — movido à mão
  rua: '#f59e0b',       // âmbar — só a rua
  aproximado: '#f59e0b',
};

/**
 * Mapa com UM alfinete ARRASTÁVEL para posicionar o endereço com precisão.
 * Tocar no mapa ou arrastar o alfinete chama `onMover(lat, lng)`.
 * OpenStreetMap + Leaflet, sem chave.
 */
export function SeletorPontoMapa({ ponto, precisao, onMover, altura = 'h-60' }: {
  ponto: LatLng | null;
  precisao?: Precisao;
  onMover: (lat: number, lng: number) => void;
  altura?: string;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const LRef = useRef<LeafletNS | null>(null);
  const mapRef = useRef<LMap | null>(null);
  const markRef = useRef<LMarker | null>(null);
  const onMoverRef = useRef(onMover);
  onMoverRef.current = onMover;

  function icone(L: LeafletNS, p?: Precisao) {
    const cor = COR[p ?? 'rua'];
    return L.divIcon({
      className: '',
      html: `<span style="display:block;width:22px;height:22px;border-radius:9999px 9999px 2px 9999px;transform:rotate(45deg);background:${cor};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.45)"></span>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }

  function colocar(lat: number, lng: number) {
    const L = LRef.current;
    const map = mapRef.current as unknown as Parameters<LMarker['addTo']>[0];
    if (!L || !map) return;
    const icon = icone(L, precisao);
    if (!markRef.current) {
      const m = L.marker([lat, lng], { draggable: true, icon, autoPan: true, keyboard: true }) as unknown as LMarker;
      m.on('dragend', () => { const ll = m.getLatLng(); onMoverRef.current(ll.lat, ll.lng); });
      m.addTo(map);
      m.bindTooltip('Arraste para ajustar', { direction: 'top', offset: [0, -10] });
      markRef.current = m;
    } else {
      markRef.current.setLatLng([lat, lng]);
      markRef.current.setIcon(icon);
    }
  }

  // Inicializa o mapa uma vez.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const mod = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      const L = ((mod as unknown as { default?: LeafletNS }).default ?? mod) as LeafletNS;
      if (cancelado || !elRef.current || mapRef.current) return;
      LRef.current = L;
      const centro: [number, number] = ponto ? [ponto.lat, ponto.lng] : [ARACATUBA.lat, ARACATUBA.lng];
      const map = L.map(elRef.current, { scrollWheelZoom: false }).setView(centro, ponto ? 17 : 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
      map.on('click', (e) => onMoverRef.current(e.latlng.lat, e.latlng.lng));
      mapRef.current = map as unknown as LMap;
      if (ponto) colocar(ponto.lat, ponto.lng);
    })();
    return () => {
      cancelado = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atualiza o alfinete quando o ponto/precisão mudam de fora (ex.: geocodificação).
  // Não recentraliza quando o próprio arraste já posicionou o marcador ali.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ponto) return;
    const m = markRef.current;
    const jaNoLugar = !!m && Math.abs(m.getLatLng().lat - ponto.lat) < 1e-6 && Math.abs(m.getLatLng().lng - ponto.lng) < 1e-6;
    colocar(ponto.lat, ponto.lng);
    if (!jaNoLugar) map.setView([ponto.lat, ponto.lng], 17);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ponto?.lat, ponto?.lng, precisao]);

  return (
    <div>
      <div ref={elRef} className={`w-full ${altura} overflow-hidden rounded-xl border border-navy-200 bg-navy-50`} />
      <p className="mt-2 text-xs text-navy-500">
        Toque no mapa ou <strong>arraste o alfinete</strong> para deixar o ponto exato na porta certa.
      </p>
    </div>
  );
}
