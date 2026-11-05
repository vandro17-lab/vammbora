import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

export interface SugestaoEndereco { rotulo: string; lat: number; lng: number }

function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Filtra a lista local (bairros/escolas de Araçatuba) pelo texto digitado. */
function filtrarLocais(locais: SugestaoEndereco[], q: string): SugestaoEndereco[] {
  const alvo = normalizar(q);
  if (!alvo) return [];
  const casa = locais.filter((l) => normalizar(l.rotulo).includes(alvo));
  // dedup por rótulo, mantendo ordem
  const vistos = new Set<string>();
  const out: SugestaoEndereco[] = [];
  for (const s of casa) {
    if (vistos.has(s.rotulo)) continue;
    vistos.add(s.rotulo);
    out.push(s);
    if (out.length >= 6) break;
  }
  return out;
}

/**
 * Campo de endereço com autocomplete de Araçatuba.
 *
 * Funciona SEMPRE: primeiro mostra, na hora, sugestões LOCAIS (bairros e
 * escolas/faculdades que já temos no catálogo, com coordenadas). Em paralelo,
 * se o serviço de mapas estiver configurado (Geoapify via /api/mapas,
 * GEOAPIFY_API_KEY na Vercel), enriquece com endereços de rua. Se o serviço
 * não responder, continua com as sugestões locais — sem erro para o usuário.
 */
export function AutocompleteEndereco({
  id, value, onChange, placeholder, locais = [],
}: {
  id?: string;
  value: string;
  onChange: (texto: string, coord?: { lat: number; lng: number }) => void;
  placeholder?: string;
  /** Lugares conhecidos de Araçatuba (bairros/escolas) para o fallback local. */
  locais?: SugestaoEndereco[];
}) {
  const [sugestoes, setSugestoes] = useState<SugestaoEndereco[]>([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const ignorar = useRef<string | null>(null); // valor recém-escolhido: não re-buscar

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2 || ignorar.current === value) { setSugestoes([]); setCarregando(false); setAberto(false); return; }

    // 1) Sugestões locais imediatas (bairros/escolas de Araçatuba).
    const base = filtrarLocais(locais, q);
    if (base.length) { setSugestoes(base); setAberto(true); }

    // 2) Enriquecimento remoto (só a partir de 3 letras), se disponível.
    if (q.length < 3) { setCarregando(false); return; }
    let vivo = true;
    setCarregando(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch('/api/mapas', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operacao: 'autocompletar', texto: q }),
        });
        if (!vivo) return;
        if (!r.ok) return; // mantém as sugestões locais já exibidas
        const d = (await r.json()) as { resultados?: SugestaoEndereco[] };
        if (!vivo) return;
        const remoto = Array.isArray(d.resultados) ? d.resultados : [];
        if (remoto.length) {
          // remoto primeiro, local depois; dedup por rótulo; máx. 6
          const vistos = new Set<string>();
          const merge: SugestaoEndereco[] = [];
          for (const s of [...remoto, ...base]) {
            if (vistos.has(s.rotulo)) continue;
            vistos.add(s.rotulo);
            merge.push(s);
            if (merge.length >= 6) break;
          }
          setSugestoes(merge);
          setAberto(true);
        }
      } catch {
        /* silêncio: segue com as sugestões locais */
      } finally {
        if (vivo) setCarregando(false);
      }
    }, 350);
    return () => { vivo = false; clearTimeout(t); };
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
