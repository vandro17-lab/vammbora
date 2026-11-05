import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

export interface SugestaoEndereco { rotulo: string; lat: number; lng: number }

/**
 * Campo de endereço com autocomplete de ruas de Araçatuba (Geoapify, via proxy
 * /api/mapas). Protegido: mínimo de 3 letras e atraso ao digitar (debounce).
 *
 * Degrada com elegância: se o serviço de mapas não responder (ex.: sem a chave
 * no ambiente local), continua funcionando como um campo de texto normal, sem
 * sugestões e sem erro para o usuário.
 */
export function AutocompleteEndereco({
  id, value, onChange, placeholder,
}: {
  id?: string;
  value: string;
  onChange: (texto: string, coord?: { lat: number; lng: number }) => void;
  placeholder?: string;
}) {
  const [sugestoes, setSugestoes] = useState<SugestaoEndereco[]>([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const ignorar = useRef<string | null>(null); // valor recém-escolhido: não re-buscar

  useEffect(() => {
    const q = value.trim();
    if (q.length < 3 || ignorar.current === value) { setSugestoes([]); setCarregando(false); return; }
    let vivo = true;
    setCarregando(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch('/api/mapas', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operacao: 'autocompletar', texto: q }),
        });
        if (!vivo) return;
        if (!r.ok) { setSugestoes([]); setAberto(false); return; }
        const d = (await r.json()) as { resultados?: SugestaoEndereco[] };
        if (!vivo) return;
        const lista = Array.isArray(d.resultados) ? d.resultados.slice(0, 5) : [];
        setSugestoes(lista);
        setAberto(lista.length > 0);
      } catch {
        if (vivo) { setSugestoes([]); setAberto(false); }
      } finally {
        if (vivo) setCarregando(false);
      }
    }, 350);
    return () => { vivo = false; clearTimeout(t); };
  }, [value]);

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
            <li key={i} role="option" aria-selected={false}>
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
