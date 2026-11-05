import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

export interface SugestaoEndereco { rotulo: string; lat: number; lng: number }

// Centro aproximado de Araçatuba e caixa (bbox) para filtrar resultados.
const ARACATUBA = { lat: -21.2089, lng: -50.4328 };
const BBOX = { latMin: -21.7, latMax: -20.7, lngMin: -51.0, lngMax: -49.9 };
const dentroDeAracatuba = (lat: number, lng: number) =>
  lat >= BBOX.latMin && lat <= BBOX.latMax && lng >= BBOX.lngMin && lng <= BBOX.lngMax;

function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Filtra a lista local (bairros/escolas de Araçatuba) pelo texto digitado. */
function filtrarLocais(locais: SugestaoEndereco[], q: string): SugestaoEndereco[] {
  const alvo = normalizar(q);
  if (!alvo) return [];
  const out: SugestaoEndereco[] = [];
  const vistos = new Set<string>();
  for (const s of locais) {
    if (!normalizar(s.rotulo).includes(alvo) || vistos.has(s.rotulo)) continue;
    vistos.add(s.rotulo);
    out.push(s);
    if (out.length >= 6) break;
  }
  return out;
}

// Se o proxy /api/mapas não estiver configurado, paramos de tentá-lo (evita
// uma chamada 503 a cada tecla). Vale para toda a sessão da página.
let proxyIndisponivel = false;

/** Busca endereços de rua. Tenta o proxy privado; se faltar, usa Photon (sem chave). */
async function buscarEnderecos(q: string, signal: AbortSignal): Promise<SugestaoEndereco[]> {
  // 1) Proxy privado Geoapify (melhor qualidade + privacidade), se configurado.
  if (!proxyIndisponivel) {
    try {
      const r = await fetch('/api/mapas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operacao: 'autocompletar', texto: q }), signal,
      });
      if (r.status === 503) {
        proxyIndisponivel = true; // sem GEOAPIFY_API_KEY: cai para o Photon
      } else if (r.ok) {
        const d = (await r.json()) as { resultados?: SugestaoEndereco[] };
        if (Array.isArray(d.resultados) && d.resultados.length) return d.resultados;
      }
    } catch {
      // segue para o fallback
    }
  }

  // 2) Fallback SEM CHAVE: Photon (OpenStreetMap), enviesado para Araçatuba.
  try {
    const u = new URL('https://photon.komoot.io/api/');
    u.searchParams.set('q', `${q}, Araçatuba`);
    u.searchParams.set('lat', String(ARACATUBA.lat));
    u.searchParams.set('lon', String(ARACATUBA.lng));
    u.searchParams.set('limit', '8');
    const r = await fetch(u, { signal });
    if (!r.ok) return [];
    const d = (await r.json()) as {
      features?: Array<{ geometry: { coordinates: [number, number] }; properties: Record<string, string> }>;
    };
    const out: SugestaoEndereco[] = [];
    const vistos = new Set<string>();
    for (const f of d.features ?? []) {
      const [lng, lat] = f.geometry?.coordinates ?? [NaN, NaN];
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !dentroDeAracatuba(lat, lng)) continue;
      const p = f.properties ?? {};
      const via = p.street || p.name || '';
      const linha = via ? `${via}${p.housenumber ? ', ' + p.housenumber : ''}` : (p.name || '');
      const rotulo = [linha, p.district || p.suburb, p.city].filter(Boolean).join(', ');
      if (!rotulo || vistos.has(rotulo)) continue;
      vistos.add(rotulo);
      out.push({ rotulo, lat, lng });
      if (out.length >= 6) break;
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Campo de endereço com autocomplete de Araçatuba.
 *
 * Refina a cada tecla: mostra na hora sugestões LOCAIS (bairros/escolas do
 * catálogo) e busca endereços de RUA em paralelo — pelo proxy /api/mapas
 * (Geoapify, se GEOAPIFY_API_KEY estiver na Vercel) ou, sem nenhuma chave,
 * pelo Photon/OpenStreetMap. Degrada sem erro para o usuário.
 */
export function AutocompleteEndereco({
  id, value, onChange, placeholder, locais = [],
}: {
  id?: string;
  value: string;
  onChange: (texto: string, coord?: { lat: number; lng: number }) => void;
  placeholder?: string;
  locais?: SugestaoEndereco[];
}) {
  const [sugestoes, setSugestoes] = useState<SugestaoEndereco[]>([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const ignorar = useRef<string | null>(null); // valor recém-escolhido: não re-buscar

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2 || ignorar.current === value) {
      setSugestoes([]); setCarregando(false); setAberto(false);
      return;
    }

    // 1) Sugestões locais imediatas (atualizam a CADA tecla, refinando/limpando).
    const base = filtrarLocais(locais, q);
    setSugestoes(base);
    setAberto(base.length > 0);

    // 2) Endereços de rua (a partir de 3 letras), com debounce.
    if (q.length < 3) { setCarregando(false); return; }
    const controlador = new AbortController();
    let vivo = true;
    setCarregando(true);
    const t = setTimeout(async () => {
      const remoto = await buscarEnderecos(q, controlador.signal);
      if (!vivo) return;
      // remoto (ruas) primeiro, depois locais (bairros/escolas); dedup; máx. 6.
      const vistos = new Set<string>();
      const merge: SugestaoEndereco[] = [];
      for (const s of [...remoto, ...base]) {
        if (vistos.has(s.rotulo)) continue;
        vistos.add(s.rotulo);
        merge.push(s);
        if (merge.length >= 6) break;
      }
      setSugestoes(merge);
      setAberto(merge.length > 0);
      setCarregando(false);
    }, 250);

    return () => { vivo = false; controlador.abort(); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, locais]);

  function escolher(s: SugestaoEndereco) {
    ignorar.current = s.rotulo;
    onChange(s.rotulo, { lat: s.lat, lng: s.lng });
    setSugestoes([]);
    setAberto(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          id={id}
          className="field-input pr-9"
          placeholder={placeholder}
          value={value}
          onChange={(e) => { ignorar.current = null; onChange(e.target.value); }}
          onFocus={() => { if (sugestoes.length) setAberto(true); }}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          autoComplete="off"
          role="combobox"
          aria-expanded={aberto}
          aria-autocomplete="list"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-navy-300">
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        </span>
      </div>
      {aberto && sugestoes.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-navy-100 bg-white shadow-float" role="listbox">
          {sugestoes.map((s, i) => (
            <li key={`${s.rotulo}-${i}`} role="option" aria-selected={false}>
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-mint-50"
                onMouseDown={(e) => { e.preventDefault(); escolher(s); }}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" />
                <span className="text-navy-700">{s.rotulo}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
